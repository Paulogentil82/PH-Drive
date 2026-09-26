import { supabase } from '../../lib/supabase';
import { DEFAULT_PREFERENCES, UserPreferences } from './preferencesService';

export interface BackupPayload {
  app: 'ph-drive';
  schemaVersion: 1;
  exportedAt: string;
  user: {
    preferences: Partial<UserPreferences>;
  };
  vehicles: any[];
  trips: any[];
  tripPoints: any[];
  fuelEntries: any[];
  maintenanceEntries: any[];
  maintenance_entries?: any[];
  vehicleExpenses: any[];
  vehicleDocuments: any[];
  vehicleTires: any[];
}

export interface TableReport {
  total: number;
  inserted: number;
  existing: number;
  conflicts: number;
  invalid: number;
  failures: number;
}

export interface ImportReport {
  vehicles: TableReport;
  trips: TableReport;
  tripPoints: TableReport;
  fuelEntries: TableReport;
  maintenanceEntries: TableReport;
  vehicleExpenses: TableReport;
  vehicleDocuments: TableReport;
  vehicleTires: TableReport;
  preferences: { updated: boolean };
}

// Simple UUID validation
const isValidUUID = (id: string): boolean => {
  if (typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

export const backupService = {
  /**
   * Helper to fetch a full table with pagination to bypass Supabase's default limit of 1000 records
   */
  async fetchFullTable(tableName: string, userId: string, orderByFields?: { field: string; ascending?: boolean }[]): Promise<any[]> {
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from(tableName)
        .select('*')
        .eq('user_id', userId);

      if (orderByFields && orderByFields.length > 0) {
        for (const order of orderByFields) {
          query = query.order(order.field, { ascending: order.ascending ?? true });
        }
      } else {
        query = query.order('id', { ascending: true });
      }

      const { data, error } = await query.range(from, from + pageSize - 1);

      if (error) {
        console.error(`Error fetching paginated ${tableName}:`, error.message);
        break;
      }

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          from += pageSize;
        }
      } else {
        hasMore = false;
      }
    }

    return allData;
  },

  /**
   * Safe exporter of all user tables
   */
  async exportBackupJSON(userId: string): Promise<BackupPayload> {
    const [
      profilesRes,
      vehiclesRes,
      tripsRes,
      fuelEntriesRes,
      maintenanceEntriesRes,
      expensesRes,
      documentsRes,
      tiresRes
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', userId),
      supabase.from('vehicles').select('*').eq('user_id', userId),
      supabase.from('trips').select('*').eq('user_id', userId),
      supabase.from('fuel_entries').select('*').eq('user_id', userId),
      supabase.from('maintenance_entries').select('*').eq('user_id', userId),
      supabase.from('vehicle_expenses').select('*').eq('user_id', userId),
      supabase.from('vehicle_documents').select('*').eq('user_id', userId),
      supabase.from('vehicle_tires').select('*').eq('user_id', userId)
    ]);

    const fullTripPoints = await this.fetchFullTable('trip_points', userId, [
      { field: 'trip_id', ascending: true },
      { field: 'sequence_number', ascending: true }
    ]);

    const profileData = profilesRes.data?.[0] || {};
    
    // Filter and sanitize preferences
    const preferences: Partial<UserPreferences> = {
      default_vehicle_id: profileData.default_vehicle_id || null,
      distance_unit: profileData.distance_unit || DEFAULT_PREFERENCES.distance_unit,
      currency_code: profileData.currency_code || DEFAULT_PREFERENCES.currency_code,
      date_format: profileData.date_format || DEFAULT_PREFERENCES.date_format,
      alert_upcoming_enabled: profileData.alert_upcoming_enabled !== false,
      alert_urgent_enabled: profileData.alert_urgent_enabled !== false,
      alert_overdue_enabled: profileData.alert_overdue_enabled !== false,
      theme_preference: profileData.theme_preference || DEFAULT_PREFERENCES.theme_preference
    };

    // Helper to sanitize arrays (remove credentials, tokens, or foreign user_ids just in case)
    const sanitize = (list: any[]) => {
      return (list || []).map(({ token, access_token, refresh_token, password, secret, api_key, ...rest }) => rest);
    };

    return {
      app: 'ph-drive',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      user: {
        preferences
      },
      vehicles: sanitize(vehiclesRes.data || []),
      trips: sanitize(tripsRes.data || []),
      tripPoints: sanitize(fullTripPoints || []),
      fuelEntries: sanitize(fuelEntriesRes.data || []),
      maintenanceEntries: sanitize(maintenanceEntriesRes.data || []),
      vehicleExpenses: sanitize(expensesRes.data || []),
      vehicleDocuments: sanitize(documentsRes.data || []),
      vehicleTires: sanitize(tiresRes.data || [])
    };
  },

  /**
   * Count of current data in Supabase for user
   */
  async getBackupSummary(userId: string) {
    const counts = await Promise.all([
      supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('trips').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('trip_points').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('fuel_entries').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('maintenance_entries').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('vehicle_expenses').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('vehicle_documents').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('vehicle_tires').select('id', { count: 'exact', head: true }).eq('user_id', userId)
    ]);

    return {
      vehicles: counts[0].count || 0,
      trips: counts[1].count || 0,
      tripPoints: counts[2].count || 0,
      fuelEntries: counts[3].count || 0,
      maintenanceEntries: counts[4].count || 0,
      vehicleExpenses: counts[5].count || 0,
      vehicleDocuments: counts[6].count || 0,
      vehicleTires: counts[7].count || 0
    };
  },

  /**
   * Preview a loaded backup payload
   */
  async previewBackup(payload: any, userId: string): Promise<{ valid: boolean; error?: string; preview?: ImportReport; payload?: BackupPayload }> {
    if (!payload || typeof payload !== 'object') {
      return { valid: false, error: 'O arquivo não contém um objeto JSON válido.' };
    }

    if (payload.app !== 'ph-drive') {
      return { valid: false, error: 'Backup inválido: este arquivo não pertence ao aplicativo PH Drive.' };
    }

    if (payload.schemaVersion !== 1) {
      return { valid: false, error: 'Backup incompatível: a versão de esquema deste arquivo não é suportada.' };
    }

    // Fetch existing data for overlap checking
    const [
      vehiclesRes,
      tripsRes,
      fuelEntriesRes,
      maintenanceEntriesRes,
      expensesRes,
      documentsRes,
      tiresRes
    ] = await Promise.all([
      supabase.from('vehicles').select('*').eq('user_id', userId),
      supabase.from('trips').select('*').eq('user_id', userId),
      supabase.from('fuel_entries').select('*').eq('user_id', userId),
      supabase.from('maintenance_entries').select('*').eq('user_id', userId),
      supabase.from('vehicle_expenses').select('*').eq('user_id', userId),
      supabase.from('vehicle_documents').select('*').eq('user_id', userId),
      supabase.from('vehicle_tires').select('*').eq('user_id', userId)
    ]);

    const fullTripPoints = await this.fetchFullTable('trip_points', userId);

    const existingVehicles = new Map(vehiclesRes.data?.map(v => [v.id, v]));
    const existingTrips = new Map(tripsRes.data?.map(t => [t.id, t]));
    const existingPoints = new Set(fullTripPoints.map(p => p.id));
    const existingFuels = new Map(fuelEntriesRes.data?.map(f => [f.id, f]));
    const existingMaintenances = new Map(maintenanceEntriesRes.data?.map(m => [m.id, m]));
    const existingExpenses = new Map(expensesRes.data?.map(e => [e.id, e]));
    const existingDocuments = new Map(documentsRes.data?.map(d => [d.id, d]));
    const existingTires = new Map(tiresRes.data?.map(t => [t.id, t]));

    const report: ImportReport = {
      vehicles: { total: 0, inserted: 0, existing: 0, conflicts: 0, invalid: 0, failures: 0 },
      trips: { total: 0, inserted: 0, existing: 0, conflicts: 0, invalid: 0, failures: 0 },
      tripPoints: { total: 0, inserted: 0, existing: 0, conflicts: 0, invalid: 0, failures: 0 },
      fuelEntries: { total: 0, inserted: 0, existing: 0, conflicts: 0, invalid: 0, failures: 0 },
      maintenanceEntries: { total: 0, inserted: 0, existing: 0, conflicts: 0, invalid: 0, failures: 0 },
      vehicleExpenses: { total: 0, inserted: 0, existing: 0, conflicts: 0, invalid: 0, failures: 0 },
      vehicleDocuments: { total: 0, inserted: 0, existing: 0, conflicts: 0, invalid: 0, failures: 0 },
      vehicleTires: { total: 0, inserted: 0, existing: 0, conflicts: 0, invalid: 0, failures: 0 },
      preferences: { updated: !!payload.user?.preferences }
    };

    // 1. Vehicles
    const vehiclesList = Array.isArray(payload.vehicles) ? payload.vehicles : [];
    report.vehicles.total = vehiclesList.length;
    const backupVehiclesSet = new Set(vehiclesList.map((v: any) => v.id));

    for (const v of vehiclesList) {
      if (!v || !isValidUUID(v.id) || !v.name) {
        report.vehicles.invalid++;
        continue;
      }
      const existing = existingVehicles.get(v.id);
      if (existing) {
        // Compare essential fields for conflicts
        if (existing.name !== v.name || existing.type !== v.type) {
          report.vehicles.conflicts++;
        } else {
          report.vehicles.existing++;
        }
      } else {
        report.vehicles.inserted++;
      }
    }

    // Helper check if vehicle will exist (either pre-existing or imported)
    const vehicleWillExist = (id: string) => existingVehicles.has(id) || backupVehiclesSet.has(id);

    // 2. Trips
    const tripsList = Array.isArray(payload.trips) ? payload.trips : [];
    report.trips.total = tripsList.length;
    const backupTripsSet = new Set(tripsList.map((t: any) => t.id));

    for (const t of tripsList) {
      if (!t || !isValidUUID(t.id) || !isValidUUID(t.vehicle_id) || !t.started_at) {
        report.trips.invalid++;
        continue;
      }
      if (!vehicleWillExist(t.vehicle_id)) {
        report.trips.invalid++; // Orphan trip
        continue;
      }
      const existing = existingTrips.get(t.id);
      if (existing) {
        if (existing.vehicle_id !== t.vehicle_id || existing.started_at !== t.started_at) {
          report.trips.conflicts++;
        } else {
          report.trips.existing++;
        }
      } else {
        report.trips.inserted++;
      }
    }

    const tripWillExist = (id: string) => existingTrips.has(id) || backupTripsSet.has(id);

    // 3. Trip Points
    const pointsList = Array.isArray(payload.tripPoints) ? payload.tripPoints : [];
    report.tripPoints.total = pointsList.length;

    for (const p of pointsList) {
      if (!p || !isValidUUID(p.id) || !isValidUUID(p.trip_id) || typeof p.latitude !== 'number' || typeof p.longitude !== 'number') {
        report.tripPoints.invalid++;
        continue;
      }
      if (!tripWillExist(p.trip_id)) {
        report.tripPoints.invalid++; // Orphan point
        continue;
      }
      if (existingPoints.has(p.id)) {
        report.tripPoints.existing++;
      } else {
        report.tripPoints.inserted++;
      }
    }

    // 4. Fuel Entries
    const fuelsList = Array.isArray(payload.fuelEntries) ? payload.fuelEntries : [];
    report.fuelEntries.total = fuelsList.length;

    for (const f of fuelsList) {
      if (!f || !isValidUUID(f.id) || !isValidUUID(f.vehicle_id) || typeof f.liters !== 'number' || !f.filled_at) {
        report.fuelEntries.invalid++;
        continue;
      }
      if (!vehicleWillExist(f.vehicle_id)) {
        report.fuelEntries.invalid++;
        continue;
      }
      const existing = existingFuels.get(f.id);
      if (existing) {
        if (Number(existing.liters) !== Number(f.liters) || existing.filled_at !== f.filled_at) {
          report.fuelEntries.conflicts++;
        } else {
          report.fuelEntries.existing++;
        }
      } else {
        report.fuelEntries.inserted++;
      }
    }

    // 5. Maintenance Entries
    const maintList = Array.isArray(payload.maintenance_entries) ? payload.maintenance_entries : 
                      (Array.isArray(payload.maintenanceEntries) ? payload.maintenanceEntries : []);
    report.maintenanceEntries.total = maintList.length;

    for (const m of maintList) {
      if (!m || !isValidUUID(m.id) || !isValidUUID(m.vehicle_id) || !m.performed_at || !m.service_type) {
        report.maintenanceEntries.invalid++;
        continue;
      }
      if (!vehicleWillExist(m.vehicle_id)) {
        report.maintenanceEntries.invalid++;
        continue;
      }
      const existing = existingMaintenances.get(m.id);
      if (existing) {
        if (existing.service_type !== m.service_type || existing.performed_at !== m.performed_at) {
          report.maintenanceEntries.conflicts++;
        } else {
          report.maintenanceEntries.existing++;
        }
      } else {
        report.maintenanceEntries.inserted++;
      }
    }

    // 6. Vehicle Expenses
    const expensesList = Array.isArray(payload.vehicleExpenses) ? payload.vehicleExpenses : [];
    report.vehicleExpenses.total = expensesList.length;

    for (const e of expensesList) {
      if (!e || !isValidUUID(e.id) || !isValidUUID(e.vehicle_id) || !e.expense_date || typeof e.amount !== 'number') {
        report.vehicleExpenses.invalid++;
        continue;
      }
      if (!vehicleWillExist(e.vehicle_id)) {
        report.vehicleExpenses.invalid++;
        continue;
      }
      const existing = existingExpenses.get(e.id);
      if (existing) {
        if (Number(existing.amount) !== Number(e.amount) || existing.expense_date !== e.expense_date) {
          report.vehicleExpenses.conflicts++;
        } else {
          report.vehicleExpenses.existing++;
        }
      } else {
        report.vehicleExpenses.inserted++;
      }
    }

    // 7. Vehicle Documents
    const docsList = Array.isArray(payload.vehicleDocuments) ? payload.vehicleDocuments : [];
    report.vehicleDocuments.total = docsList.length;

    for (const d of docsList) {
      if (!d || !isValidUUID(d.id) || !isValidUUID(d.vehicle_id) || !d.title) {
        report.vehicleDocuments.invalid++;
        continue;
      }
      if (!vehicleWillExist(d.vehicle_id)) {
        report.vehicleDocuments.invalid++;
        continue;
      }
      // Business rule: PAID -> paid_at obrigatório
      if (d.status === 'PAID' && !d.paid_at) {
        report.vehicleDocuments.invalid++;
        continue;
      }
      const existing = existingDocuments.get(d.id);
      if (existing) {
        if (existing.title !== d.title || existing.status !== d.status) {
          report.vehicleDocuments.conflicts++;
        } else {
          report.vehicleDocuments.existing++;
        }
      } else {
        report.vehicleDocuments.inserted++;
      }
    }

    // 8. Vehicle Tires
    const tiresList = Array.isArray(payload.vehicleTires) ? payload.vehicleTires : [];
    report.vehicleTires.total = tiresList.length;

    // Track active positions from database and backup to prevent multiple active tires per position
    const activePositionsByVehicle = new Map<string, Set<string>>();
    
    // Seed with existing active tires
    tiresRes.data?.forEach(t => {
      if (t.active) {
        if (!activePositionsByVehicle.has(t.vehicle_id)) {
          activePositionsByVehicle.set(t.vehicle_id, new Set());
        }
        activePositionsByVehicle.get(t.vehicle_id)!.add(t.position);
      }
    });

    for (const t of tiresList) {
      if (!t || !isValidUUID(t.id) || !isValidUUID(t.vehicle_id) || !t.position) {
        report.vehicleTires.invalid++;
        continue;
      }
      if (!vehicleWillExist(t.vehicle_id)) {
        report.vehicleTires.invalid++;
        continue;
      }

      const existing = existingTires.get(t.id);
      if (existing) {
        if (existing.position !== t.position || existing.active !== t.active) {
          report.vehicleTires.conflicts++;
        } else {
          report.vehicleTires.existing++;
        }
      } else {
        // Business rule: One ACTIVE tire per position
        if (t.active) {
          const activeSet = activePositionsByVehicle.get(t.vehicle_id);
          if (activeSet && activeSet.has(t.position)) {
            report.vehicleTires.conflicts++; // Duplicate active position
            continue;
          }
          if (!activePositionsByVehicle.has(t.vehicle_id)) {
            activePositionsByVehicle.set(t.vehicle_id, new Set());
          }
          activePositionsByVehicle.get(t.vehicle_id)!.add(t.position);
        }
        report.vehicleTires.inserted++;
      }
    }

    return { valid: true, preview: report, payload };
  },

  /**
   * Execute the actual safe restoration process
   */
  async executeImport(payload: BackupPayload, userId: string, previewReport: ImportReport): Promise<ImportReport> {
    const finalReport: ImportReport = JSON.parse(JSON.stringify(previewReport));

    // Clear stats that will be computed during execution
    const clearRunStats = (rep: TableReport) => {
      rep.inserted = 0;
      rep.existing = 0;
      rep.failures = 0;
    };
    clearRunStats(finalReport.vehicles);
    clearRunStats(finalReport.trips);
    clearRunStats(finalReport.tripPoints);
    clearRunStats(finalReport.fuelEntries);
    clearRunStats(finalReport.maintenanceEntries);
    clearRunStats(finalReport.vehicleExpenses);
    clearRunStats(finalReport.vehicleDocuments);
    clearRunStats(finalReport.vehicleTires);

    // Get current DB state maps again to be thread-safe/freshest possible
    const [
      vehiclesRes,
      tripsRes,
      fuelEntriesRes,
      maintenanceEntriesRes,
      expensesRes,
      documentsRes,
      tiresRes
    ] = await Promise.all([
      supabase.from('vehicles').select('*').eq('user_id', userId),
      supabase.from('trips').select('*').eq('user_id', userId),
      supabase.from('fuel_entries').select('*').eq('user_id', userId),
      supabase.from('maintenance_entries').select('*').eq('user_id', userId),
      supabase.from('vehicle_expenses').select('*').eq('user_id', userId),
      supabase.from('vehicle_documents').select('*').eq('user_id', userId),
      supabase.from('vehicle_tires').select('*').eq('user_id', userId)
    ]);

    const fullTripPoints = await this.fetchFullTable('trip_points', userId);

    const existingVehicles = new Map(vehiclesRes.data?.map(v => [v.id, v]));
    const existingTrips = new Map(tripsRes.data?.map(t => [t.id, t]));
    const existingPoints = new Set(fullTripPoints.map(p => p.id));
    const existingFuels = new Map(fuelEntriesRes.data?.map(f => [f.id, f]));
    const existingMaintenances = new Map(maintenanceEntriesRes.data?.map(m => [m.id, m]));
    const existingExpenses = new Map(expensesRes.data?.map(e => [e.id, e]));
    const existingDocuments = new Map(documentsRes.data?.map(d => [d.id, d]));
    const existingTires = new Map(tiresRes.data?.map(t => [t.id, t]));

    // Track max odometer for each imported vehicle
    const maxOdometerByVehicle = new Map<string, number>();

    // Helper: sanitize keys for insert (forces current authenticated userId and removes metadata)
    const prepareForInsert = (item: any) => {
      const { created_at, updated_at, ...cleaned } = item;
      return { ...cleaned, user_id: userId };
    };

    // 1. Vehicles
    const vehiclesList = Array.isArray(payload.vehicles) ? payload.vehicles : [];
    for (const v of vehiclesList) {
      if (!v || !isValidUUID(v.id) || !v.name) continue;
      
      const existing = existingVehicles.get(v.id);
      if (existing) {
        if (existing.name !== v.name || existing.type !== v.type) {
          // Conflicts are skipped
          continue;
        }
        finalReport.vehicles.existing++;
        maxOdometerByVehicle.set(v.id, Math.max(v.odometer_km || 0, existing.odometer_km || 0));
        continue;
      }

      try {
        const { error } = await supabase.from('vehicles').insert(prepareForInsert(v));
        if (error) {
          console.error('Failed to insert vehicle:', error.message);
          finalReport.vehicles.failures++;
        } else {
          finalReport.vehicles.inserted++;
          maxOdometerByVehicle.set(v.id, v.odometer_km || 0);
        }
      } catch (err) {
        finalReport.vehicles.failures++;
      }
    }

    const vehicleWillExist = (id: string) => existingVehicles.has(id) || maxOdometerByVehicle.has(id);

    // 2. Trips
    const tripsList = Array.isArray(payload.trips) ? payload.trips : [];
    const tripsCreatedThisRun = new Set<string>();

    for (const t of tripsList) {
      if (!t || !isValidUUID(t.id) || !isValidUUID(t.vehicle_id) || !t.started_at) continue;
      if (!vehicleWillExist(t.vehicle_id)) continue;

      const existing = existingTrips.get(t.id);
      if (existing) {
        if (existing.vehicle_id !== t.vehicle_id || existing.started_at !== t.started_at) {
          continue; // skip conflicts
        }
        finalReport.trips.existing++;
        tripsCreatedThisRun.add(t.id);

        // Odometer tracking
        const endOdo = t.end_odometer_km || t.start_odometer_km || 0;
        const currentMax = maxOdometerByVehicle.get(t.vehicle_id) || 0;
        maxOdometerByVehicle.set(t.vehicle_id, Math.max(currentMax, endOdo));
        continue;
      }

      try {
        const { error } = await supabase.from('trips').insert(prepareForInsert(t));
        if (error) {
          finalReport.trips.failures++;
        } else {
          finalReport.trips.inserted++;
          tripsCreatedThisRun.add(t.id);
          
          const endOdo = t.end_odometer_km || t.start_odometer_km || 0;
          const currentMax = maxOdometerByVehicle.get(t.vehicle_id) || 0;
          maxOdometerByVehicle.set(t.vehicle_id, Math.max(currentMax, endOdo));
        }
      } catch (err) {
        finalReport.trips.failures++;
      }
    }

    const tripWillExist = (id: string) => existingTrips.has(id) || tripsCreatedThisRun.has(id);

    // 3. Trip Points (BATCH INSERT to prevent N+1)
    const pointsList = Array.isArray(payload.tripPoints) ? payload.tripPoints : [];
    const validPointsToInsert = [];

    for (const p of pointsList) {
      if (!p || !isValidUUID(p.id) || !isValidUUID(p.trip_id) || typeof p.latitude !== 'number' || typeof p.longitude !== 'number') continue;
      if (!tripWillExist(p.trip_id)) continue;

      if (existingPoints.has(p.id)) {
        finalReport.tripPoints.existing++;
        continue;
      }
      validPointsToInsert.push(prepareForInsert(p));
    }

    // Insert in batches of 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < validPointsToInsert.length; i += BATCH_SIZE) {
      const batch = validPointsToInsert.slice(i, i + BATCH_SIZE);
      try {
        const { error } = await supabase.from('trip_points').insert(batch);
        if (error) {
          console.error('Batch points insert error:', error.message);
          finalReport.tripPoints.failures += batch.length;
        } else {
          finalReport.tripPoints.inserted += batch.length;
        }
      } catch (err) {
        finalReport.tripPoints.failures += batch.length;
      }
    }

    // 4. Fuel Entries
    const fuelsList = Array.isArray(payload.fuelEntries) ? payload.fuelEntries : [];
    for (const f of fuelsList) {
      if (!f || !isValidUUID(f.id) || !isValidUUID(f.vehicle_id) || typeof f.liters !== 'number' || !f.filled_at) continue;
      if (!vehicleWillExist(f.vehicle_id)) continue;

      const existing = existingFuels.get(f.id);
      if (existing) {
        if (Number(existing.liters) !== Number(f.liters) || existing.filled_at !== f.filled_at) {
          continue;
        }
        finalReport.fuelEntries.existing++;
        const currentMax = maxOdometerByVehicle.get(f.vehicle_id) || 0;
        maxOdometerByVehicle.set(f.vehicle_id, Math.max(currentMax, f.odometer_km || 0));
        continue;
      }

      try {
        const { error } = await supabase.from('fuel_entries').insert(prepareForInsert(f));
        if (error) {
          finalReport.fuelEntries.failures++;
        } else {
          finalReport.fuelEntries.inserted++;
          const currentMax = maxOdometerByVehicle.get(f.vehicle_id) || 0;
          maxOdometerByVehicle.set(f.vehicle_id, Math.max(currentMax, f.odometer_km || 0));
        }
      } catch (err) {
        finalReport.fuelEntries.failures++;
      }
    }

    // 5. Maintenance Entries
    const maintList = Array.isArray(payload.maintenance_entries) ? payload.maintenance_entries : 
                      (Array.isArray(payload.maintenanceEntries) ? payload.maintenanceEntries : []);
    for (const m of maintList) {
      if (!m || !isValidUUID(m.id) || !isValidUUID(m.vehicle_id) || !m.performed_at || !m.service_type) continue;
      if (!vehicleWillExist(m.vehicle_id)) continue;

      const existing = existingMaintenances.get(m.id);
      if (existing) {
        if (existing.service_type !== m.service_type || existing.performed_at !== m.performed_at) {
          continue;
        }
        finalReport.maintenanceEntries.existing++;
        const currentMax = maxOdometerByVehicle.get(m.vehicle_id) || 0;
        maxOdometerByVehicle.set(m.vehicle_id, Math.max(currentMax, m.odometer_km || 0));
        continue;
      }

      try {
        const { error } = await supabase.from('maintenance_entries').insert(prepareForInsert(m));
        if (error) {
          finalReport.maintenanceEntries.failures++;
        } else {
          finalReport.maintenanceEntries.inserted++;
          const currentMax = maxOdometerByVehicle.get(m.vehicle_id) || 0;
          maxOdometerByVehicle.set(m.vehicle_id, Math.max(currentMax, m.odometer_km || 0));
        }
      } catch (err) {
        finalReport.maintenanceEntries.failures++;
      }
    }

    // 6. Expenses
    const expensesList = Array.isArray(payload.vehicleExpenses) ? payload.vehicleExpenses : [];
    for (const e of expensesList) {
      if (!e || !isValidUUID(e.id) || !isValidUUID(e.vehicle_id) || !e.expense_date || typeof e.amount !== 'number') continue;
      if (!vehicleWillExist(e.vehicle_id)) continue;

      const existing = existingExpenses.get(e.id);
      if (existing) {
        if (Number(existing.amount) !== Number(e.amount) || existing.expense_date !== e.expense_date) {
          continue;
        }
        finalReport.vehicleExpenses.existing++;
        continue;
      }

      try {
        const { error } = await supabase.from('vehicle_expenses').insert(prepareForInsert(e));
        if (error) {
          finalReport.vehicleExpenses.failures++;
        } else {
          finalReport.vehicleExpenses.inserted++;
        }
      } catch (err) {
        finalReport.vehicleExpenses.failures++;
      }
    }

    // 7. Documents
    const docsList = Array.isArray(payload.vehicleDocuments) ? payload.vehicleDocuments : [];
    for (const d of docsList) {
      if (!d || !isValidUUID(d.id) || !isValidUUID(d.vehicle_id) || !d.title) continue;
      if (!vehicleWillExist(d.vehicle_id)) continue;
      if (d.status === 'PAID' && !d.paid_at) continue;

      const existing = existingDocuments.get(d.id);
      if (existing) {
        if (existing.title !== d.title || existing.status !== d.status) {
          continue;
        }
        finalReport.vehicleDocuments.existing++;
        continue;
      }

      try {
        const { error } = await supabase.from('vehicle_documents').insert(prepareForInsert(d));
        if (error) {
          finalReport.vehicleDocuments.failures++;
        } else {
          finalReport.vehicleDocuments.inserted++;
        }
      } catch (err) {
        finalReport.vehicleDocuments.failures++;
      }
    }

    // 8. Tires
    const tiresList = Array.isArray(payload.vehicleTires) ? payload.vehicleTires : [];
    const activePositionsByVehicleRun = new Map<string, Set<string>>();
    tiresRes.data?.forEach(t => {
      if (t.active) {
        if (!activePositionsByVehicleRun.has(t.vehicle_id)) {
          activePositionsByVehicleRun.set(t.vehicle_id, new Set());
        }
        activePositionsByVehicleRun.get(t.vehicle_id)!.add(t.position);
      }
    });

    for (const t of tiresList) {
      if (!t || !isValidUUID(t.id) || !isValidUUID(t.vehicle_id) || !t.position) continue;
      if (!vehicleWillExist(t.vehicle_id)) continue;

      const existing = existingTires.get(t.id);
      if (existing) {
        if (existing.position !== t.position || existing.active !== t.active) {
          continue;
        }
        finalReport.vehicleTires.existing++;
        continue;
      }

      // Check duplicate active tire
      if (t.active) {
        const activeSet = activePositionsByVehicleRun.get(t.vehicle_id);
        if (activeSet && activeSet.has(t.position)) {
          continue;
        }
        if (!activePositionsByVehicleRun.has(t.vehicle_id)) {
          activePositionsByVehicleRun.set(t.vehicle_id, new Set());
        }
        activePositionsByVehicleRun.get(t.vehicle_id)!.add(t.position);
      }

      try {
        const { error } = await supabase.from('vehicle_tires').insert(prepareForInsert(t));
        if (error) {
          finalReport.vehicleTires.failures++;
        } else {
          finalReport.vehicleTires.inserted++;
        }
      } catch (err) {
        finalReport.vehicleTires.failures++;
      }
    }

    // 9. Update Vehicle Odometers with Maximum Consistent Values (Never reduce)
    for (const [vId, maxOdo] of maxOdometerByVehicle.entries()) {
      const currentDbVehicle = existingVehicles.get(vId);
      const currentOdoInDb = currentDbVehicle ? (currentDbVehicle.odometer_km || 0) : 0;
      
      const targetOdometer = Math.max(currentOdoInDb, maxOdo);
      if (targetOdometer > currentOdoInDb) {
        try {
          await supabase
            .from('vehicles')
            .update({ odometer_km: targetOdometer })
            .eq('id', vId)
            .eq('user_id', userId);
        } catch (err) {
          console.error('Failed to adjust vehicle odometer to consistency:', err);
        }
      }
    }

    // 10. Preferences
    if (payload.user?.preferences) {
      try {
        const currentPrefsRes = await supabase.from('profiles').select('*').eq('user_id', userId).single();
        if (currentPrefsRes.data) {
          const loadedPrefs = payload.user.preferences;
          await supabase
            .from('profiles')
            .update({
              distance_unit: loadedPrefs.distance_unit ?? currentPrefsRes.data.distance_unit,
              currency_code: loadedPrefs.currency_code ?? currentPrefsRes.data.currency_code,
              date_format: loadedPrefs.date_format ?? currentPrefsRes.data.date_format,
              alert_upcoming_enabled: loadedPrefs.alert_upcoming_enabled ?? currentPrefsRes.data.alert_upcoming_enabled,
              alert_urgent_enabled: loadedPrefs.alert_urgent_enabled ?? currentPrefsRes.data.alert_urgent_enabled,
              alert_overdue_enabled: loadedPrefs.alert_overdue_enabled ?? currentPrefsRes.data.alert_overdue_enabled,
              theme_preference: loadedPrefs.theme_preference ?? currentPrefsRes.data.theme_preference
            })
            .eq('user_id', userId);
          finalReport.preferences.updated = true;
        }
      } catch (err) {
        console.error('Preferences import error:', err);
      }
    }

    return finalReport;
  },

  /**
   * Helper to generate CSV files with UTF-8 BOM
   */
  async exportCSV(moduleName: string, userId: string): Promise<{ data: string; filename: string } | null> {
    const BOM = '\uFEFF';
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = `ph-drive-${moduleName}-${new Date().toISOString().split('T')[0]}.csv`;

    switch (moduleName) {
      case 'trips': {
        const { data } = await supabase.from('trips').select('*').eq('user_id', userId).order('started_at', { ascending: false });
        headers = ['Data início', 'Data fim', 'Distância', 'Duração', 'Odômetro inicial', 'Odômetro final', 'Status', 'Origem', 'Destino'];
        rows = (data || []).map(t => [
          t.started_at ? new Date(t.started_at).toLocaleString('pt-BR') : '',
          t.ended_at ? new Date(t.ended_at).toLocaleString('pt-BR') : '',
          (t.gps_distance_km || t.distance_km || 0).toString(),
          t.duration_seconds ? `${Math.round(t.duration_seconds / 60)} min` : '',
          (t.start_odometer_km || 0).toString(),
          (t.end_odometer_km || 0).toString(),
          t.status,
          t.origin_label || '',
          t.destination_label || ''
        ]);
        break;
      }
      case 'fuel': {
        const { data } = await supabase.from('fuel_entries').select('*').eq('user_id', userId).order('filled_at', { ascending: false });
        headers = ['Data', 'Litros', 'Preço por Litro', 'Total Pago', 'Odômetro', 'Tipo Combustível'];
        rows = (data || []).map(f => [
          f.filled_at ? new Date(f.filled_at).toLocaleString('pt-BR') : '',
          f.liters.toString(),
          f.price_per_liter.toString(),
          f.total_amount.toString(),
          (f.odometer_km || 0).toString(),
          f.fuel_type || ''
        ]);
        break;
      }
      case 'maintenance': {
        const { data } = await supabase.from('maintenance_entries').select('*').eq('user_id', userId).order('performed_at', { ascending: false });
        headers = ['Data realizada', 'Tipo Serviço', 'Custo', 'Odômetro', 'Oficina', 'Próxima devida'];
        rows = (data || []).map(m => [
          m.performed_at ? new Date(m.performed_at).toLocaleString('pt-BR') : '',
          m.service_type,
          m.cost_amount ? m.cost_amount.toString() : '0',
          m.odometer_km ? m.odometer_km.toString() : '',
          m.workshop_name || '',
          m.next_due_date || ''
        ]);
        break;
      }
      case 'expenses': {
        const { data } = await supabase.from('vehicle_expenses').select('*').eq('user_id', userId).order('expense_date', { ascending: false });
        headers = ['Data', 'Descrição', 'Categoria', 'Valor'];
        rows = (data || []).map(e => [
          e.expense_date ? new Date(e.expense_date).toLocaleString('pt-BR') : '',
          e.description,
          e.category || '',
          e.amount.toString()
        ]);
        break;
      }
      case 'documents': {
        const { data } = await supabase.from('vehicle_documents').select('*').eq('user_id', userId).order('due_date', { ascending: false });
        headers = ['Título', 'Tipo Documento', 'Vencimento', 'Status', 'Valor', 'Pago em'];
        rows = (data || []).map(d => [
          d.title,
          d.document_type,
          d.due_date ? new Date(d.due_date).toLocaleDateString('pt-BR') : '',
          d.status,
          d.amount ? d.amount.toString() : '0',
          d.paid_at ? new Date(d.paid_at).toLocaleDateString('pt-BR') : ''
        ]);
        break;
      }
      case 'tires': {
        const { data } = await supabase.from('vehicle_tires').select('*').eq('user_id', userId).order('installed_at', { ascending: false });
        headers = ['Posição', 'Marca', 'Modelo', 'Medida', 'Instalado em', 'Odômetro instalação', 'Ativo'];
        rows = (data || []).map(t => [
          t.position,
          t.brand || '',
          t.model || '',
          t.dot || '',
          t.installed_at ? new Date(t.installed_at).toLocaleDateString('pt-BR') : '',
          t.installed_odometer_km ? t.installed_odometer_km.toString() : '',
          t.active ? 'Ativo' : 'Inativo'
        ]);
        break;
      }
      default:
        return null;
    }

    const sanitizeCSVCell = (val: string): string => {
      const trimmed = val.trim();
      if (trimmed.startsWith('=') || trimmed.startsWith('+') || trimmed.startsWith('-') || trimmed.startsWith('@')) {
        return `'${val}`;
      }
      return val;
    };

    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.map(val => {
        const sanitized = sanitizeCSVCell(val);
        return `"${sanitized.replace(/"/g, '""')}"`;
      }).join(';'))
    ].join('\n');

    return {
      data: BOM + csvContent,
      filename
    };
  }
};
