import { supabase } from '../../lib/supabase';
import { Alert } from '../../types/alerts';

export const alertsService = {
  getDaysDifference(dueDateStr: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const parts = dueDateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const dueLocal = new Date(year, month, day);
      dueLocal.setHours(0, 0, 0, 0);
      return Math.round((dueLocal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }
    
    const dueDate = new Date(dueDateStr);
    dueDate.setHours(0, 0, 0, 0);
    
    // Normalize to UTC to avoid timezone shifting
    const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const utcDue = Date.UTC(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    
    return Math.floor((utcDue - utcToday) / (1000 * 60 * 60 * 24));
  },

  async getAlerts(): Promise<Alert[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: vehicles } = await supabase.from('vehicles').select('*').eq('user_id', user.id);
    if (!vehicles) return [];

    let allAlerts: Alert[] = [];

    for (const vehicle of vehicles) {
      const { data: maintenance } = await supabase
        .from('maintenance_entries')
        .select('*')
        .eq('vehicle_id', vehicle.id);
      
      const { data: expenses } = await supabase
        .from('vehicle_expenses')
        .select('*')
        .eq('vehicle_id', vehicle.id)
        .eq('recurring', true);

      if (maintenance) {
        maintenance.forEach(m => {
          // Maintenance alerts
          const alerts: Alert[] = [];
          
          // KM Alert
          if (m.next_due_odometer_km) {
            const diff = m.next_due_odometer_km - (vehicle.odometer_km || 0);
            let severity: Alert['severity'] = 'INFORMATIVO';
            if (diff <= 0) severity = 'VENCIDO';
            else if (diff <= 100) severity = 'URGENTE';
            else if (diff <= 500) severity = 'PRÓXIMO';
            
            if (severity !== 'INFORMATIVO') {
              alerts.push({
                id: `${m.id}-km`,
                sourceType: 'maintenance',
                sourceId: m.id,
                vehicleId: vehicle.id,
                vehicleName: vehicle.name,
                severity,
                title: `Manutenção por KM: ${m.service_type}`,
                message: diff <= 0 ? 'Vencida por quilometragem.' : `Faltam ${diff} km.`,
                dueOdometerKm: m.next_due_odometer_km,
                status: 'active'
              });
            }
          }

          // Date Alert
          if (m.next_due_date) {
            const diffDays = this.getDaysDifference(m.next_due_date);
            
            let severity: Alert['severity'] = 'INFORMATIVO';
            if (diffDays <= 0) severity = 'VENCIDO';
            else if (diffDays <= 7) severity = 'URGENTE';
            else if (diffDays <= 30) severity = 'PRÓXIMO';

            if (severity !== 'INFORMATIVO') {
                alerts.push({
                    id: `${m.id}-date`,
                    sourceType: 'maintenance',
                    sourceId: m.id,
                    vehicleId: vehicle.id,
                    vehicleName: vehicle.name,
                    severity,
                    title: `Manutenção por Data: ${m.service_type}`,
                    message: diffDays <= 0 ? 'Vencida por data.' : `Vence em ${diffDays} dias.`,
                    dueDate: m.next_due_date,
                    status: 'active'
                });
            }
          }
          
          // Consolidate alerts for this maintenance
          if (alerts.length > 0) {
            const worst = alerts.sort((a, b) => this.severityPriority(b.severity) - this.severityPriority(a.severity))[0];
            allAlerts.push(worst);
          }
        });
      }

      if (expenses) {
        expenses.forEach(e => {
            allAlerts.push({
                id: e.id,
                sourceType: 'expense',
                sourceId: e.id,
                vehicleId: vehicle.id,
                vehicleName: vehicle.name,
                severity: 'INFORMATIVO',
                title: `Despesa Recorrente: ${e.category}`,
                message: 'Despesa marcada como recorrente.',
                status: 'active'
            });
        });
      }

      const { data: documents } = await supabase
        .from('vehicle_documents')
        .select('*')
        .eq('vehicle_id', vehicle.id)
        .eq('status', 'PENDING');
      
      if (documents) {
        documents.forEach(d => {
            if (d.due_date) {
                const diffDays = this.getDaysDifference(d.due_date);
                let severity: Alert['severity'] = 'INFORMATIVO';
                if (diffDays <= 0) severity = 'VENCIDO';
                else if (diffDays <= 7) severity = 'URGENTE';
                else if (diffDays <= 30) severity = 'PRÓXIMO';
                
                if (severity !== 'INFORMATIVO') {
                    allAlerts.push({
                        id: d.id,
                        sourceType: 'document',
                        sourceId: d.id,
                        vehicleId: vehicle.id,
                        vehicleName: vehicle.name,
                        severity,
                        title: `${d.title}`,
                        message: diffDays <= 0 ? `${d.title} está vencido.` : `${d.title} vence em ${diffDays} dias.`,
                        dueDate: d.due_date,
                        status: 'active'
                    });
                }
            }
        });
      }

      const { data: tires } = await supabase
        .from('vehicle_tires')
        .select('*')
        .eq('vehicle_id', vehicle.id)
        .eq('status', 'ACTIVE');

      if (tires) {
        tires.forEach(t => {
          if (t.expected_life_km) {
            const installedKm = Number(t.installed_odometer_km);
            const currentKm = vehicle.odometer_km || 0;
            const kmUsed = currentKm - installedKm;
            const remainingKm = Number(t.expected_life_km) - kmUsed;

            let severity: Alert['severity'] = 'INFORMATIVO';
            let message = '';

            const posLower = t.position.toLowerCase();
            let posLabel = 'dianteiro';
            if (posLower === 'rear') posLabel = 'traseiro';
            else if (posLower === 'front_left') posLabel = 'dianteiro esquerdo';
            else if (posLower === 'front_right') posLabel = 'dianteiro direito';
            else if (posLower === 'rear_left') posLabel = 'traseiro esquerdo';
            else if (posLower === 'rear_right') posLabel = 'traseiro direito';
            else if (posLower === 'spare') posLabel = 'de estepe';
            else if (posLower === 'other') posLabel = 'outra posição';

            if (remainingKm <= 0) {
              severity = 'VENCIDO';
              message = `Pneu ${posLabel} atingiu a vida útil estimada.`;
            } else if (remainingKm <= 500) {
              severity = 'URGENTE';
              message = `Pneu ${posLabel} possui aproximadamente ${Math.round(remainingKm)} km restantes.`;
            } else if (remainingKm <= 1500) {
              severity = 'PRÓXIMO';
              message = `Pneu ${posLabel} está próximo da substituição.`;
            }

            if (severity !== 'INFORMATIVO') {
              allAlerts.push({
                id: t.id,
                sourceType: 'tire',
                sourceId: t.id,
                vehicleId: vehicle.id,
                vehicleName: vehicle.name,
                severity,
                title: `Pneu ${posLabel.toUpperCase()}`,
                message,
                dueOdometerKm: installedKm + Number(t.expected_life_km),
                status: 'active'
              });
            }
          }
        });
      }
    }

    return allAlerts.sort((a, b) => this.severityPriority(a.severity) - this.severityPriority(b.severity));
  },

  severityPriority(severity: Alert['severity']): number {
    switch (severity) {
      case 'VENCIDO': return 1;
      case 'URGENTE': return 2;
      case 'PRÓXIMO': return 3;
      case 'INFORMATIVO': return 4;
    }
  }
};
