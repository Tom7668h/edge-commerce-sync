import { describe, it, expect } from 'vitest';
import { isValidEan13, calculateEan13CheckDigit, sanitizeSku, parseNumeric } from '../../src/utils/validator.js';

describe('Validator Utilities', () => {
  describe('calculateEan13CheckDigit', () => {
    it('should compute exact GS1 Modulo-10 checksum digit', () => {
      // 400638133393 -> 1
      expect(calculateEan13CheckDigit('400638133393')).toBe(1);
      // 401234500001 -> 6
      expect(calculateEan13CheckDigit('401234500001')).toBe(6);
      // 401234500002 -> 3
      expect(calculateEan13CheckDigit('401234500002')).toBe(3);
    });
  });

  describe('isValidEan13', () => {
    it('should validate valid EAN-13 barcodes correctly', () => {
      expect(isValidEan13('4006381333931')).toBe(true);
      expect(isValidEan13('4012345000016')).toBe(true);
      expect(isValidEan13('4012345000023')).toBe(true);
    });

    it('should reject invalid checksums', () => {
      expect(isValidEan13('4006381333932')).toBe(false);
      expect(isValidEan13('4012345000019')).toBe(false);
    });

    it('should reject invalid length and non-digits', () => {
      expect(isValidEan13('12345')).toBe(false);
      expect(isValidEan13('401234500001A')).toBe(false);
      expect(isValidEan13(null)).toBe(false);
      expect(isValidEan13(undefined)).toBe(false);
    });

    it('should handle formatted EANs with hyphens or spaces', () => {
      expect(isValidEan13('4006-381-333931')).toBe(true);
      expect(isValidEan13('401 2345 000016')).toBe(true);
    });
  });

  describe('sanitizeSku', () => {
    it('should trim and uppercase SKUs', () => {
      expect(sanitizeSku('  nfz-br-1001  ')).toBe('NFZ-BR-1001');
      expect(sanitizeSku('bosch_0281002 ')).toBe('BOSCH_0281002');
    });

    it('should handle empty input', () => {
      expect(sanitizeSku('')).toBe('');
    });
  });

  describe('parseNumeric', () => {
    it('should parse numbers and strings with dot or comma', () => {
      expect(parseNumeric(12.5)).toBe(12.5);
      expect(parseNumeric('12.50')).toBe(12.5);
      expect(parseNumeric('12,50')).toBe(12.5);
      expect(parseNumeric(' 149,99 € ')).toBe(149.99);
    });

    it('should return default value for invalid input', () => {
      expect(parseNumeric('invalid', 0)).toBe(0);
      expect(parseNumeric(null, 5)).toBe(5);
    });
  });
});
