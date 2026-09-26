/**
 * Helper to format distance based on user preference.
 * Default is KM.
 */
export const formatDistance = (km: number, preference?: 'KM' | 'MI'): string => {
  if (km === undefined || km === null || isNaN(km)) return '0 km';
  
  if (preference === 'MI') {
    const mi = km / 1.609344;
    return `${mi.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;
  }
  
  return `${km.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
};

/**
 * Helper to format currency based on user preference using Intl.NumberFormat.
 * Default is BRL.
 */
export const formatCurrency = (amount: number, preference?: 'BRL' | 'USD' | 'EUR'): string => {
  const value = amount || 0;
  
  const currencyMap = {
    BRL: { locale: 'pt-BR', code: 'BRL' },
    USD: { locale: 'en-US', code: 'USD' },
    EUR: { locale: 'de-DE', code: 'EUR' }
  };
  
  const cfg = currencyMap[preference || 'BRL'] || currencyMap.BRL;
  
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency',
    currency: cfg.code
  }).format(value);
};

/**
 * Helper to format civil date string timezone-safely based on user preference.
 * Default is DD/MM/YYYY.
 */
export const formatAppDate = (
  dateInput: string | Date | null | undefined, 
  preference?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
): string => {
  if (!dateInput) return '—';
  
  let year = 0;
  let month = 0; // 0-indexed
  let day = 0;
  
  if (typeof dateInput === 'string') {
    const cleanStr = dateInput.split('T')[0];
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else {
      const parsed = new Date(dateInput);
      year = parsed.getFullYear();
      month = parsed.getMonth();
      day = parsed.getDate();
    }
  } else if (dateInput instanceof Date) {
    year = dateInput.getFullYear();
    month = dateInput.getMonth();
    day = dateInput.getDate();
  } else {
    return '—';
  }
  
  const formatType = preference || 'DD/MM/YYYY';
  const pad = (n: number) => String(n).padStart(2, '0');
  
  const yyyy = String(year);
  const mm = pad(month + 1);
  const dd = pad(day);
  
  if (formatType === 'MM/DD/YYYY') {
    return `${mm}/${dd}/${yyyy}`;
  }
  if (formatType === 'YYYY-MM-DD') {
    return `${yyyy}-${mm}-${dd}`;
  }
  
  return `${dd}/${mm}/${yyyy}`;
};
