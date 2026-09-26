export const parsePtBrNumber = (value: string | number | null | undefined): number | null => {
  if (value === undefined || value === null || value === '') return null;
  
  if (typeof value === 'number') return value;

  // Remove thousands separators (.) and replace decimal separator (,) with (.)
  const sanitized = value.replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(sanitized);

  return isNaN(parsed) ? null : parsed;
};

export const formatPtBrNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};
