/**
 * Computes the GS1 Modulo-10 checksum digit for 12 digits.
 */
export function calculateEan13CheckDigit(first12Digits: string): number {
  const cleaned = first12Digits.replace(/\D/g, '');
  if (cleaned.length !== 12) {
    throw new Error('Must provide exactly 12 numeric digits to compute EAN-13 checksum');
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(cleaned[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }

  return (10 - (sum % 10)) % 10;
}

/**
 * Validates an EAN-13 barcode using the official GS1 Modulo-10 checksum algorithm.
 */
export function isValidEan13(ean: string | null | undefined): boolean {
  if (!ean) return false;
  const cleaned = ean.replace(/[\s-]/g, '');
  if (!/^\d{13}$/.test(cleaned)) return false;

  const expectedCheckDigit = calculateEan13CheckDigit(cleaned.substring(0, 12));
  return expectedCheckDigit === parseInt(cleaned[12], 10);
}

/**
 * Normalizes SKU strings, trimming whitespace and upper-casing.
 */
export function sanitizeSku(sku: string): string {
  if (!sku) return '';
  return sku.trim().toUpperCase();
}

/**
 * Robust numeric parser handling both German comma (12,50) and international dot (12.50) notations.
 */
export function parseNumeric(value: number | string | null | undefined, defaultValue: number = 0): number {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'number') return isNaN(value) ? defaultValue : value;

  const cleaned = value.toString().trim().replace(/[€$\s]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? defaultValue : Math.round(parsed * 100) / 100;
}
