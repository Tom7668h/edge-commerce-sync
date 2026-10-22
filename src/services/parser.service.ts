import { RawSupplierItem } from '../models/catalog.js';
import { parseNumeric, sanitizeSku } from '../utils/validator.js';
import { logger } from '../utils/logger.js';

export class ParserService {
  /**
   * Parses CSV string adhering to RFC-4180 with support for multi-line quoted fields
   * and auto-detection of delimiters (semicolon, comma, tab).
   */
  parseCsv(csvContent: string): RawSupplierItem[] {
    if (!csvContent || !csvContent.trim()) {
      return [];
    }

    const lines = this.splitIntoCsvRecords(csvContent);
    if (lines.length < 2) {
      return [];
    }

    const headerLine = lines[0];
    const delimiter = this.detectDelimiter(headerLine);
    const headers = this.parseCsvLine(headerLine, delimiter).map((h) => h.trim().toLowerCase());

    const colMap = this.mapHeaderColumns(headers);

    const items: RawSupplierItem[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || !line.trim()) continue;

      const fields = this.parseCsvLine(line, delimiter);
      if (fields.length === 0 || fields.every((f) => !f.trim())) continue;

      const sku = sanitizeSku(this.getField(fields, colMap.sku) || `GEN-${Date.now()}-${i}`);
      const title = this.getField(fields, colMap.title) || 'Unbekannter Artikel';
      const brand = this.getField(fields, colMap.brand) || 'Generic';
      const category = this.getField(fields, colMap.category) || 'Allgemein';
      const ean = this.getField(fields, colMap.ean) || undefined;
      const purchasePrice = parseNumeric(this.getField(fields, colMap.purchasePrice), 0);
      const stock = parseInt(this.getField(fields, colMap.stock) || '0', 10) || 0;
      const supplierName = this.getField(fields, colMap.supplierName) || 'Lieferant Standard';

      items.push({
        sku,
        ean: ean && ean.trim() ? ean.trim() : undefined,
        title,
        brand,
        category,
        purchasePrice,
        stock,
        supplierName,
      });
    }

    logger.info(`ParserService: successfully parsed ${items.length} items from CSV`);
    return items;
  }

  /**
   * Parses JSON string into RawSupplierItem array.
   */
  parseJson(jsonContent: string): RawSupplierItem[] {
    try {
      const parsed = JSON.parse(jsonContent);
      const arrayData = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : [parsed];

      return arrayData.map((item: any, idx: number) => ({
        sku: sanitizeSku(item.sku || item.articleNo || `SKU-${idx}`),
        ean: item.ean || item.gtin || undefined,
        title: item.title || item.name || 'Unbekanntes Produkt',
        brand: item.brand || item.manufacturer || 'Generic',
        category: item.category || 'Allgemein',
        purchasePrice: parseNumeric(item.purchasePrice || item.price, 0),
        stock: parseNumeric(item.stock || item.quantity, 0),
        supplierName: item.supplierName || item.supplier || 'Standard',
      }));
    } catch (err) {
      logger.error('Failed to parse JSON supplier feed', err);
      throw new Error('Invalid JSON format for supplier feed');
    }
  }

  private detectDelimiter(headerLine: string): string {
    const semicolonCount = (headerLine.match(/;/g) || []).length;
    const commaCount = (headerLine.match(/,/g) || []).length;
    const tabCount = (headerLine.match(/\t/g) || []).length;

    if (semicolonCount >= commaCount && semicolonCount >= tabCount) return ';';
    if (tabCount > commaCount) return '\t';
    return ',';
  }

  private splitIntoCsvRecords(text: string): string[] {
    const records: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        current += char;
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && text[i + 1] === '\n') {
          i++; // skip \n
        }
        if (current.trim()) {
          records.push(current);
        }
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      records.push(current);
    }
    return records;
  }

  private parseCsvLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  }

  private mapHeaderColumns(headers: string[]): Record<string, number> {
    const map: Record<string, number> = {
      sku: -1,
      ean: -1,
      title: -1,
      brand: -1,
      category: -1,
      purchasePrice: -1,
      stock: -1,
      supplierName: -1,
    };

    headers.forEach((h, idx) => {
      if (h.match(/^(sku|artikelnr|artikelnummer|partnumber|id)$/i)) map.sku = idx;
      else if (h.match(/^(ean|gtin|barcode)$/i)) map.ean = idx;
      else if (h.match(/^(title|titel|name|bezeichnung|beschreibung|description)$/i)) map.title = idx;
      else if (h.match(/^(brand|marke|hersteller|manufacturer)$/i)) map.brand = idx;
      else if (h.match(/^(category|kategorie|warengruppe|rubrik)$/i)) map.category = idx;
      else if (h.match(/^(purchaseprice|ek|einkaufspreis|preis|price|cost)$/i)) map.purchasePrice = idx;
      else if (h.match(/^(stock|bestand|menge|qty|quantity)$/i)) map.stock = idx;
      else if (h.match(/^(supplier|lieferant|suppliername)$/i)) map.supplierName = idx;
    });

    return map;
  }

  private getField(fields: string[], index: number): string | undefined {
    if (index >= 0 && index < fields.length) {
      return fields[index];
    }
    return undefined;
  }
}
