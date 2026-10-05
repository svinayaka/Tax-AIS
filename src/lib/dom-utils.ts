/**
 * Shared DOM and Text Sanitization Utilities
 */

/**
 * Escapes unsafe characters in HTML to prevent XSS injection
 */
export function escapeHtml(str: string | null | undefined): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Formats a number as Indian Currency (INR) string: ₹1,23,456
 */
export function formatInr(amount: number | string | null | undefined): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount || 0));
  if (isNaN(num)) return '₹0';
  return '₹' + num.toLocaleString('en-IN');
}

/**
 * Escapes characters for CSV cells
 */
export function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).replace(/"/g, '""');
}
