import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Shield, 
  Save, 
  CheckCircle2, 
  Database, 
  Settings, 
  Globe, 
  Eye, 
  Palette,
  ShieldAlert,
  Car,
  Download,
  Upload,
  FileJson,
  FileSpreadsheet,
  AlertTriangle,
  Loader2,
  RefreshCw,
  FileDown,
  Activity,
  Layers
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { usePreferences } from './PreferencesContext';
import { supabase, getStoredSupabaseConfig, saveSupabaseConfig } from '../../lib/supabase';
import { PageHeader } from '../../components/common/CommonComponents';
import { Vehicle } from '../../types';
import { backupService, ImportReport } from './backupService';

export function ProfileView() {
  const { user, profile, refreshProfile } = useAuth();
  const { preferences, savePreferences } = usePreferences();
  
  // Tab control
  const [activeTab, setActiveTab] = useState<'profile' | 'backup'>('profile');

  // --- TAB 1: Profile & Preferences state ---
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Supabase Config state
  const currentConfig = getStoredSupabaseConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(currentConfig.url);
  const [supabaseKey, setSupabaseKey] = useState(currentConfig.key);
  const [configSuccess, setConfigSuccess] = useState(false);

  // Vehicles list for Default Vehicle selection
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  // Preferences form state
  const [defaultVehicleId, setDefaultVehicleId] = useState<string>(preferences.default_vehicle_id || '');
  const [distanceUnit, setDistanceUnit] = useState<'KM' | 'MI'>(preferences.distance_unit);
  const [currencyCode, setCurrencyCode] = useState<'BRL' | 'USD' | 'EUR'>(preferences.currency_code);
  const [dateFormat, setDateFormat] = useState<'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'>(preferences.date_format);
  const [alertUpcomingEnabled, setAlertUpcomingEnabled] = useState<boolean>(preferences.alert_upcoming_enabled);
  const [alertUrgentEnabled, setAlertUrgentEnabled] = useState<boolean>(preferences.alert_urgent_enabled);
  const [alertOverdueEnabled, setAlertOverdueEnabled] = useState<boolean>(preferences.alert_overdue_enabled);
  const [themePreference, setThemePreference] = useState<'SYSTEM' | 'LIGHT' | 'DARK'>(preferences.theme_preference);

  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsSuccess, setPrefsSuccess] = useState(false);
  const [prefsError, setPrefsError] = useState<string | null>(null);

  // --- TAB 2: Backup & Export state ---
  const [supabaseCounts, setSupabaseCounts] = useState<any>({
    vehicles: 0, trips: 0, tripPoints: 0, fuelEntries: 0, maintenanceEntries: 0, vehicleExpenses: 0, vehicleDocuments: 0, vehicleTires: 0
  });
  const [countsLoading, setCountsLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // CSV exports state
  const [csvLoading, setCsvLoading] = useState<string | null>(null);

  // Import state workflow
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileLimitError, setFileLimitError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportReport | null>(null);
  const [parsedPayload, setParsedPayload] = useState<any>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewErrorLoading] = useState(false);

  const [importingState, setImportingState] = useState<'IDLE' | 'IMPORTING' | 'DONE' | 'FAILED'>('IDLE');
  const [importProgressText, setImportProgressText] = useState<string>('');
  const [importFinalReport, setImportFinalReport] = useState<ImportReport | null>(null);

  // Load vehicles
  useEffect(() => {
    if (user) {
      supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true })
        .then(({ data }) => {
          const list = data || [];
          setVehicles(list);

          // If there is only Titan 125 (or only 1 vehicle), auto-select it if nothing else is selected
          if (list.length === 1 && !defaultVehicleId) {
            setDefaultVehicleId(list[0].id);
          }
        });
    }
  }, [user, defaultVehicleId]);

  // Sync state if context preferences change (e.g., loaded asynchronously)
  useEffect(() => {
    setDefaultVehicleId(preferences.default_vehicle_id || '');
    setDistanceUnit(preferences.distance_unit);
    setCurrencyCode(preferences.currency_code);
    setDateFormat(preferences.date_format);
    setAlertUpcomingEnabled(preferences.alert_upcoming_enabled);
    setAlertUrgentEnabled(preferences.alert_urgent_enabled);
    setAlertOverdueEnabled(preferences.alert_overdue_enabled);
    setThemePreference(preferences.theme_preference);
  }, [preferences]);

  // Load backend counts for summary before exporting
  const loadDatabaseCounts = async () => {
    if (!user) return;
    try {
      setCountsLoading(true);
      const counts = await backupService.getBackupSummary(user.id);
      setSupabaseCounts(counts);
    } catch (err) {
      console.error('Failed to load database counts:', err);
    } finally {
      setCountsLoading(false);
    }
  };

  useEffect(() => {
    if (user && activeTab === 'backup') {
      loadDatabaseCounts();
    }
  }, [user, activeTab]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('user_id', user.id);

      if (error) throw error;
      await refreshProfile();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar perfil.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig(supabaseUrl, supabaseKey);
    setConfigSuccess(true);
    setTimeout(() => {
      setConfigSuccess(false);
      window.location.reload();
    }, 1000);
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setPrefsLoading(true);
      setPrefsError(null);
      setPrefsSuccess(false);

      await savePreferences({
        default_vehicle_id: defaultVehicleId || null,
        distance_unit: distanceUnit,
        currency_code: currencyCode,
        date_format: dateFormat,
        alert_upcoming_enabled: alertUpcomingEnabled,
        alert_urgent_enabled: alertUrgentEnabled,
        alert_overdue_enabled: alertOverdueEnabled,
        theme_preference: themePreference
      });

      setPrefsSuccess(true);
      setTimeout(() => setPrefsSuccess(false), 3000);
    } catch (err: any) {
      setPrefsError(err.message || 'Erro ao salvar preferências.');
    } finally {
      setPrefsLoading(false);
    }
  };

  // --- TAB 2 HANDLERS: Backup, Export & Restore ---
  const handleExportBackup = async () => {
    if (!user) return;
    try {
      setExportLoading(true);
      const data = await backupService.exportBackupJSON(user.id);
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ph-drive-backup-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to export backup:', err);
    } finally {
      setExportLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset workflow states
    setSelectedFile(file);
    setFileLimitError(null);
    setImportPreview(null);
    setParsedPayload(null);
    setPreviewError(null);
    setImportingState('IDLE');

    // Limit check: 50 MB (50 * 1024 * 1024 bytes)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setFileLimitError('O arquivo selecionado excede o limite razoável de 50 MB. Por favor, escolha um arquivo menor.');
      return;
    }

    try {
      setPreviewErrorLoading(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          const result = await backupService.previewBackup(json, user?.id || '');
          if (!result.valid) {
            setPreviewError(result.error || 'Erro ao validar arquivo de backup.');
          } else {
            setImportPreview(result.preview || null);
            setParsedPayload(result.payload || null);
          }
        } catch (err) {
          setPreviewError('O arquivo selecionado não contém um formato JSON de backup válido.');
        } finally {
          setPreviewErrorLoading(false);
        }
      };
      reader.readAsText(file);
    } catch (err) {
      setPreviewError('Falha ao ler o arquivo selecionado.');
      setPreviewErrorLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!user || !parsedPayload || !importPreview) return;
    try {
      setImportingState('IMPORTING');
      
      setImportProgressText('Validando formato e referências do backup...');
      await new Promise(r => setTimeout(r, 600));

      setImportProgressText('Importando veículos do backup...');
      await new Promise(r => setTimeout(r, 500));

      setImportProgressText('Importando viagens e registrando odômetros...');
      await new Promise(r => setTimeout(r, 600));

      setImportProgressText('Importando pontos de GPS em batches otimizados...');
      await new Promise(r => setTimeout(r, 700));

      setImportProgressText('Importando abastecimentos e manutenções...');
      await new Promise(r => setTimeout(r, 500));

      setImportProgressText('Importando despesas, pneus e documentos...');
      await new Promise(r => setTimeout(r, 600));

      setImportProgressText('Sincronizando preferências e finalizando importação...');
      
      const finalReport = await backupService.executeImport(parsedPayload, user.id, importPreview);
      setImportFinalReport(finalReport);
      setImportingState('DONE');
      
      // Refresh DB counts and profile
      loadDatabaseCounts();
      refreshProfile();
    } catch (err: any) {
      console.error('Import failed:', err);
      setImportingState('FAILED');
    }
  };

  const handleExportCSV = async (moduleName: string) => {
    if (!user) return;
    try {
      setCsvLoading(moduleName);
      const csv = await backupService.exportCSV(moduleName, user.id);
      if (csv) {
        const blob = new Blob([csv.data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', csv.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error(`Failed to export CSV for ${moduleName}:`, err);
    } finally {
      setCsvLoading(null);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Configurações & Perfil"
        subtitle="Gerencie suas informações pessoais, preferências, dados, exportações e backups do sistema"
      />

      {/* Tabs Selector */}
      <div className="flex border-b border-slate-800 gap-1 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 py-3 px-5 text-sm font-bold border-b-2 transition shrink-0 ${
            activeTab === 'profile'
              ? 'border-blue-500 text-white bg-slate-900/40 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
          }`}
        >
          <Settings className="w-4 h-4 text-blue-400" />
          <span>Perfil & Preferências</span>
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-2 py-3 px-5 text-sm font-bold border-b-2 transition shrink-0 ${
            activeTab === 'backup'
              ? 'border-blue-500 text-white bg-slate-900/40 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
          }`}
        >
          <Database className="w-4 h-4 text-emerald-400" />
          <span>Dados e Backup</span>
        </button>
      </div>

      {/* TAB 1 CONTENT: PROFILE & PREFERENCES */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT & CENTER COLUMNS: Preferences (Main settings) */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                <div className="p-3 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Preferências do Aplicativo</h2>
                  <p className="text-xs text-slate-400">Personalize sua experiência de uso no PH Drive</p>
                </div>
              </div>

              {prefsSuccess && (
                <div className="mb-6 p-4 bg-emerald-950/50 border border-emerald-800/50 text-emerald-300 text-sm rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                  <span>Preferências salvas com sucesso!</span>
                </div>
              )}

              {prefsError && (
                <div className="mb-6 p-4 bg-red-950/50 border border-red-800/50 text-red-300 text-sm rounded-xl flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0" />
                  <span>{prefsError}</span>
                </div>
              )}

              <form onSubmit={handleSavePreferences} className="space-y-8">
                
                {/* Section 1: Geral */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Car className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Geral</h3>
                  </div>
                  <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-850/60">
                    <label className="block text-xs font-semibold text-slate-300 mb-2">Veículo Padrão (Seleção Inicial)</label>
                    <select
                      value={defaultVehicleId}
                      onChange={(e) => setDefaultVehicleId(e.target.value)}
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer transition hover:border-slate-700"
                    >
                      <option value="">Nenhum (Usar mais recente)</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.name} {v.brand ? `(${v.brand})` : ''}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1.5">O veículo padrão será automaticamente exibido ao carregar a página inicial.</p>
                  </div>
                </div>

                {/* Section 2: Unidades */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Globe className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Unidades e Exibição</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/40 p-4 rounded-2xl border border-slate-850/60">
                    
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-2">Unidade de Distância</label>
                      <select
                        value={distanceUnit}
                        onChange={(e) => setDistanceUnit(e.target.value as 'KM' | 'MI')}
                        className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm cursor-pointer transition hover:border-slate-700"
                      >
                        <option value="KM">Quilômetros (km)</option>
                        <option value="MI">Milhas (mi)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-2">Moeda</label>
                      <select
                        value={currencyCode}
                        onChange={(e) => setCurrencyCode(e.target.value as 'BRL' | 'USD' | 'EUR')}
                        className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm cursor-pointer transition hover:border-slate-700"
                      >
                        <option value="BRL">Real brasileiro (BRL)</option>
                        <option value="USD">Dólar americano (USD)</option>
                        <option value="EUR">Euro (EUR)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-2">Formato de Data</label>
                      <select
                        value={dateFormat}
                        onChange={(e) => setDateFormat(e.target.value as any)}
                        className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm cursor-pointer transition hover:border-slate-700"
                      >
                        <option value="DD/MM/YYYY">DD/MM/AAAA</option>
                        <option value="MM/DD/YYYY">MM/DD/AAAA</option>
                        <option value="YYYY-MM-DD">AAAA-MM-DD</option>
                      </select>
                    </div>

                  </div>
                </div>

                {/* Section 3: Alertas */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Eye className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Alertas</h3>
                  </div>
                  <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-850/60 space-y-4">
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white block">Mostrar alertas próximos</span>
                        <span className="text-[10px] text-slate-400">Exibir lembretes com status PRÓXIMO.</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={alertUpcomingEnabled} 
                          onChange={(e) => setAlertUpcomingEnabled(e.target.checked)}
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white" />
                      </label>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-800/60">
                      <div>
                        <span className="text-xs font-bold text-white block">Mostrar alertas urgentes</span>
                        <span className="text-[10px] text-slate-400">Exibir lembretes com status URGENTE.</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={alertUrgentEnabled} 
                          onChange={(e) => setAlertUrgentEnabled(e.target.checked)}
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white" />
                      </label>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-800/60">
                      <div>
                        <span className="text-xs font-bold text-white block">Mostrar alertas vencidos</span>
                        <span className="text-[10px] text-slate-400">Exibir lembretes com status VENCIDO.</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={alertOverdueEnabled} 
                          onChange={(e) => setAlertOverdueEnabled(e.target.checked)}
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white" />
                      </label>
                    </div>

                    <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-start gap-2.5 mt-2">
                      <ShieldAlert className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-slate-400">
                        <strong>Nota Explicativa:</strong> Essas opções controlam apenas a exibição dos alertas. Os vencimentos continuam sendo monitorados internamente em segundo plano.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 4: Aparência */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Palette className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Aparência</h3>
                  </div>
                  <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-850/60">
                    <label className="block text-xs font-semibold text-slate-300 mb-2">Tema Visual</label>
                    <select
                      value={themePreference}
                      onChange={(e) => setThemePreference(e.target.value as any)}
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm cursor-pointer transition hover:border-slate-700"
                    >
                      <option value="SYSTEM">Seguir sistema</option>
                      <option value="LIGHT">Claro</option>
                      <option value="DARK">Escuro</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={prefsLoading}
                  className="w-full md:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                >
                  <Save className="w-4.5 h-4.5" />
                  <span>{prefsLoading ? 'Salvando...' : 'Salvar Preferências'}</span>
                </button>

              </form>
            </div>
          </div>

          {/* RIGHT COLUMN: User Account & Supabase Connection Info */}
          <div className="space-y-8">
            
            {/* Profile Info Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Dados do Usuário</h2>
                  <p className="text-[11px] text-slate-400">Sua conta no PH Drive</p>
                </div>
              </div>

              {success && (
                <div className="mb-4 p-3 bg-emerald-950/50 border border-emerald-800/50 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Perfil atualizado com sucesso!</span>
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-950/50 border border-red-800/50 text-red-300 text-xs rounded-xl flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">E-mail (Autenticação)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="email"
                      disabled
                      value={user?.email || ''}
                      className="w-full pl-9 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-400 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Nome Completo</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <User className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Seu Nome Completo"
                      className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-600 transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 hover:text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2 border border-slate-700/50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{loading ? 'Salvando...' : 'Salvar Dados'}</span>
                </button>
              </form>
            </div>

            {/* Supabase Connection Settings */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Conexão Supabase</h2>
                  <p className="text-[11px] text-slate-400">Credenciais PostgreSQL</p>
                </div>
              </div>

              {configSuccess && (
                <div className="mb-4 p-3 bg-emerald-950/50 border border-emerald-800/50 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Configuração salva! Recarregando...</span>
                </div>
              )}

              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Project URL</label>
                  <input
                    type="url"
                    required
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    placeholder="https://seu-projeto.supabase.co"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Anon Key</label>
                  <input
                    type="password"
                    required
                    value={supabaseKey}
                    onChange={(e) => setSupabaseKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-[10px] text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-600 transition font-mono"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2 border border-slate-700/50"
                >
                  <Database className="w-3.5 h-3.5 text-blue-400" />
                  <span>Atualizar Conexão</span>
                </button>
              </form>
            </div>

          </div>

        </div>
      )}

      {/* TAB 2 CONTENT: DADOS E BACKUP */}
      {activeTab === 'backup' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT & CENTER COLUMNS: Backup management & Previews */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Database summary counts pre-export */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Seus Dados Conectados</h2>
                    <p className="text-xs text-slate-400">Resumo de todos os seus registros armazenados na nuvem</p>
                  </div>
                </div>
                <button
                  onClick={loadDatabaseCounts}
                  disabled={countsLoading}
                  className="p-2 text-slate-400 hover:text-white bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 transition"
                  title="Atualizar contagem"
                >
                  <RefreshCw className={`w-4 h-4 ${countsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-950/40 p-4 border border-slate-850/60 rounded-2xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">Veículos</span>
                  <span className="text-2xl font-black text-white mt-1 block font-mono">{supabaseCounts.vehicles}</span>
                </div>
                <div className="bg-slate-950/40 p-4 border border-slate-850/60 rounded-2xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">Viagens</span>
                  <span className="text-2xl font-black text-white mt-1 block font-mono">{supabaseCounts.trips}</span>
                </div>
                <div className="bg-slate-950/40 p-4 border border-slate-850/60 rounded-2xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">Pontos GPS</span>
                  <span className="text-2xl font-black text-white mt-1 block font-mono">{supabaseCounts.tripPoints}</span>
                </div>
                <div className="bg-slate-950/40 p-4 border border-slate-850/60 rounded-2xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">Abast.</span>
                  <span className="text-2xl font-black text-white mt-1 block font-mono">{supabaseCounts.fuelEntries}</span>
                </div>
                <div className="bg-slate-950/40 p-4 border border-slate-850/60 rounded-2xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">Manut.</span>
                  <span className="text-2xl font-black text-white mt-1 block font-mono">{supabaseCounts.maintenanceEntries}</span>
                </div>
                <div className="bg-slate-950/40 p-4 border border-slate-850/60 rounded-2xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">Despesas</span>
                  <span className="text-2xl font-black text-white mt-1 block font-mono">{supabaseCounts.vehicleExpenses}</span>
                </div>
                <div className="bg-slate-950/40 p-4 border border-slate-850/60 rounded-2xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">Documentos</span>
                  <span className="text-2xl font-black text-white mt-1 block font-mono">{supabaseCounts.vehicleDocuments}</span>
                </div>
                <div className="bg-slate-950/40 p-4 border border-slate-850/60 rounded-2xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">Pneus</span>
                  <span className="text-2xl font-black text-white mt-1 block font-mono">{supabaseCounts.vehicleTires}</span>
                </div>
              </div>
            </div>

            {/* Backup workflow interface */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                <div className="p-3 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Importar / Restaurar Backup</h2>
                  <p className="text-xs text-slate-400">Insira um arquivo de backup JSON estruturado do PH Drive</p>
                </div>
              </div>

              {/* Warnings and alerts */}
              <div className="p-4 bg-blue-950/40 border border-blue-900/40 rounded-2xl flex gap-3 text-xs leading-relaxed text-slate-300">
                <AlertTriangle className="w-4.5 h-4.5 text-blue-400 shrink-0 mt-0.5" />
                <p>
                  <strong>Aviso de Restauração:</strong> A restauração adiciona registros ausentes e não apaga seus dados atuais (executa apenas uma operação segura de merge/idempotência).
                </p>
              </div>

              {/* Step 1: Upload input file */}
              <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-850/60">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-3">Selecione o arquivo .json do backup</label>
                <input 
                  type="file" 
                  accept=".json"
                  onChange={handleFileChange}
                  className="w-full text-slate-300 font-medium text-xs bg-slate-950 border border-slate-800 rounded-xl p-3.5 file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-800 file:text-white file:cursor-pointer transition hover:border-slate-700"
                />
                <p className="text-[10px] text-slate-500 mt-2">Limite máximo recomendado para o arquivo de backup: 50 megabytes.</p>
              </div>

              {/* Size limit / Error display */}
              {fileLimitError && (
                <div className="p-4 bg-red-950/40 border border-red-900/40 text-red-300 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4.5 h-4.5 text-red-400 shrink-0" />
                  <span>{fileLimitError}</span>
                </div>
              )}

              {previewLoading && (
                <div className="p-8 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                  <span>Validando estrutura do backup...</span>
                </div>
              )}

              {previewError && (
                <div className="p-4 bg-red-950/40 border border-red-900/40 text-red-300 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4.5 h-4.5 text-red-400 shrink-0" />
                  <span>{previewError}</span>
                </div>
              )}

              {/* Step 2: Show Preview summary if file valid */}
              {importPreview && parsedPayload && importingState === 'IDLE' && (
                <div className="space-y-6 bg-slate-950/20 p-5 rounded-2xl border border-slate-800">
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">Prévia dos Dados no Backup</h4>
                    <p className="text-[11px] text-slate-400">Verifique as entidades mapeadas antes de confirmar a importação física.</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-2.5">Tabela / Módulo</th>
                          <th className="py-2.5 text-center">Total</th>
                          <th className="py-2.5 text-center text-emerald-400">Novos</th>
                          <th className="py-2.5 text-center text-slate-400">Existentes</th>
                          <th className="py-2.5 text-center text-yellow-400">Conflito (Pula)</th>
                          <th className="py-2.5 text-center text-red-400">Inválidos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40 text-slate-300">
                        {Object.entries(importPreview).filter(([k]) => k !== 'preferences').map(([key, data]: [string, any]) => (
                          <tr key={key}>
                            <td className="py-2.5 font-bold capitalize text-slate-200">{key === 'tripPoints' ? 'Pontos GPS' : key === 'fuelEntries' ? 'Abastecimentos' : key === 'maintenanceEntries' ? 'Manutenções' : key === 'vehicleExpenses' ? 'Despesas' : key === 'vehicleDocuments' ? 'Documentos' : key === 'vehicleTires' ? 'Pneus' : key}</td>
                            <td className="py-2.5 text-center font-mono font-bold">{data.total}</td>
                            <td className="py-2.5 text-center font-mono text-emerald-400 font-bold">+{data.inserted}</td>
                            <td className="py-2.5 text-center font-mono text-slate-500">{data.existing}</td>
                            <td className="py-2.5 text-center font-mono text-yellow-500">{data.conflicts}</td>
                            <td className="py-2.5 text-center font-mono text-red-500">{data.invalid}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl space-y-1.5 text-[11px] leading-relaxed text-slate-400">
                    <p><strong>Regras de Negócio Importantes Aplicadas:</strong></p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li><strong>Garantia de Ownership:</strong> Todos os registros importados serão de propriedade exclusiva do usuário logado (<span className="text-white font-mono">{user?.email}</span>), ignorando quaisquer IDs de usuário contidos no backup.</li>
                      <li><strong>Validação de Órfãos:</strong> Pontos GPS sem viagem, viagens sem veículo, ou quaisquer despesas órfãs foram catalogados como inválidos e serão excluídos.</li>
                      <li><strong>Restrições de Pneus e Docs:</strong> Apenas um pneu ATIVO por posição é tolerado. Documentos pagos sem data de pagamento foram desqualificados.</li>
                      <li><strong>Integridade de Odômetro:</strong> O odômetro final do veículo importado será ajustado para o maior valor consistente. O odômetro atual do banco nunca retrocederá.</li>
                    </ul>
                  </div>

                  <button
                    onClick={handleExecuteImport}
                    className="w-full py-3 px-5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4.5 h-4.5" />
                    <span>Confirmar e Importar</span>
                  </button>
                </div>
              )}

              {/* Step 3: Executing view */}
              {importingState === 'IMPORTING' && (
                <div className="p-8 text-center bg-slate-950/40 rounded-2xl border border-slate-850/60 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-white">Importação em andamento...</p>
                    <p className="text-xs text-slate-400">{importProgressText}</p>
                  </div>
                </div>
              )}

              {/* Step 4: Final execution Report display */}
              {importingState === 'DONE' && importFinalReport && (
                <div className="bg-slate-950/40 p-6 rounded-2xl border border-emerald-900/30 space-y-6">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-white">Importação Executada com Sucesso!</h4>
                      <p className="text-[11px] text-slate-400">Verifique o relatório final dos dados restaurados no Supabase.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(importFinalReport).filter(([k]) => k !== 'preferences').map(([key, data]: [string, any]) => (
                      <div key={key} className="bg-slate-900/60 p-3.5 border border-slate-800 rounded-xl">
                        <span className="text-[10px] text-slate-500 font-extrabold uppercase block">{key === 'tripPoints' ? 'Pontos GPS' : key === 'fuelEntries' ? 'Abastecimentos' : key === 'maintenanceEntries' ? 'Manutenções' : key === 'vehicleExpenses' ? 'Despesas' : key === 'vehicleDocuments' ? 'Documentos' : key === 'vehicleTires' ? 'Pneus' : key}</span>
                        <div className="grid grid-cols-4 text-center mt-2 gap-2 text-xs">
                          <div>
                            <span className="text-[9px] text-slate-400 block">Total</span>
                            <span className="font-bold text-white font-mono">{data.total}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-emerald-400 block">Inseridos</span>
                            <span className="font-bold text-emerald-400 font-mono">{data.inserted}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 block">Existentes</span>
                            <span className="font-bold text-slate-400 font-mono">{data.existing}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-red-400 block">Falhas</span>
                            <span className="font-bold text-red-400 font-mono">{data.failures}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setImportingState('IDLE')}
                    className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition"
                  >
                    Fazer outra importação
                  </button>
                </div>
              )}

            </div>
          </div>

          {/* RIGHT COLUMN: Export options */}
          <div className="space-y-8">
            
            {/* Complete JSON Export Block */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                <div className="p-2.5 bg-emerald-600/20 text-emerald-400 rounded-lg border border-emerald-500/30">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Exportar Backup JSON</h2>
                  <p className="text-[11px] text-slate-400">Gere um backup total dos seus dados</p>
                </div>
              </div>

              {exportSuccess && (
                <div className="mb-4 p-3 bg-emerald-950/50 border border-emerald-800/50 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Backup gerado e baixado!</span>
                </div>
              )}

              <button
                onClick={handleExportBackup}
                disabled={exportLoading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2"
              >
                {exportLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processando dados...</span>
                  </>
                ) : (
                  <>
                    <FileJson className="w-4.5 h-4.5" />
                    <span>Exportar backup completo</span>
                  </>
                )}
              </button>
              <p className="text-[9px] text-slate-500 text-center mt-3">Arquivo no padrão UTF-8 contendo vehicles, trips, fuel_entries, tire_entries, documents e despesas operacionais.</p>
            </div>

            {/* Individual CSV Export Block */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Exportar Tabelas em CSV</h2>
                  <p className="text-[11px] text-slate-400">Arquivos compatíveis com Excel</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {[
                  { key: 'trips', label: 'Viagens' },
                  { key: 'fuel', label: 'Abastecimentos' },
                  { key: 'maintenance', label: 'Manutenções' },
                  { key: 'expenses', label: 'Despesas Gerais' },
                  { key: 'documents', label: 'Documentos' },
                  { key: 'tires', label: 'Pneus e DOTs' }
                ].map(item => (
                  <button
                    key={item.key}
                    disabled={csvLoading !== null}
                    onClick={() => handleExportCSV(item.key)}
                    className="w-full p-3 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-700 rounded-xl flex items-center justify-between text-xs text-slate-200 font-semibold transition group"
                  >
                    <span className="flex items-center gap-2">
                      <FileDown className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition" />
                      {item.label}
                    </span>
                    {csvLoading === item.key ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                    ) : (
                      <span className="text-[9px] text-slate-500 group-hover:text-slate-300">CSV</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
