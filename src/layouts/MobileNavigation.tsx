import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Map, 
  Navigation, 
  Car, 
  Fuel, 
  Wrench, 
  BarChart3, 
  Settings, 
  Menu, 
  X, 
  LogOut,
  User as UserIcon,
  Disc
} from 'lucide-react';
import { NavigationTab } from '../types';
import { useAuth } from '../features/auth/AuthContext';

interface MobileNavigationProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
}

export function MobileNavigation({ currentTab, onSelectTab }: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { user, profile, signOut } = useAuth();

  const navItems: { id: NavigationTab; label: string; icon: React.ElementType; badge?: string }[] = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'map', label: 'Mapa', icon: Map },
    { id: 'trips', label: 'Viagens', icon: Navigation },
    { id: 'vehicles', label: 'Veículos', icon: Car },
    { id: 'fuel', label: 'Abastecimentos', icon: Fuel, badge: 'Em breve' },
    { id: 'maintenance', label: 'Manutenções', icon: Wrench, badge: 'Em breve' },
    { id: 'tires', label: 'Pneus', icon: Disc },
    { id: 'reports', label: 'Relatórios', icon: BarChart3, badge: 'Em breve' },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  const handleSelect = (tab: NavigationTab) => {
    onSelectTab(tab);
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 text-white rounded-lg shadow">
            <Car className="w-4 h-4" />
          </div>
          <span className="font-bold text-white text-base">PH Drive</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-slate-300 hover:text-white bg-slate-800 rounded-lg border border-slate-700"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden flex flex-col justify-end">
          <div className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
                  {profile?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{profile?.full_name || 'Usuário'}</p>
                  <p className="text-xs text-slate-400">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="space-y-1.5 mb-6">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <button
              onClick={() => { signOut(); setIsOpen(false); }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 rounded-xl text-sm font-medium transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair da conta</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
