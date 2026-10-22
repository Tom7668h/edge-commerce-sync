import { describe, it, expect } from 'vitest';
import { ParserService } from '../../src/services/parser.service.js';

describe('ParserService', () => {
  const parser = new ParserService();

  it('should parse semicolon-delimited CSV feed', () => {
    const csv = `SKU;EAN;Title;Brand;Category;PurchasePrice;Stock;SupplierName
NFZ-001;4012345000018;Bremsscheibe MAN TGX;OE-ERSATZ-PRO;Bremsen;89.50;20;EuroTruck
NFZ-002;4012345000025;Bremsbelagsatz;AFTERMARKET-LINE;Bremsen;42.00;50;EuroTruck`;

    const items = parser.parseCsv(csv);
    expect(items).toHaveLength(2);
    expect(items[0].sku).toBe('NFZ-001');
    expect(items[0].ean).toBe('4012345000018');
    expect(items[0].purchasePrice).toBe(89.5);
    expect(items[0].stock).toBe(20);
    expect(items[0].brand).toBe('OE-ERSATZ-PRO');
  });

  it('should parse comma-delimited CSV feed with German number formats', () => {
    const csv = `Artikelnr,Barcode,Bezeichnung,Marke,Warengruppe,EK,Menge,Lieferant
BOS-991,4012345000032,"Common Rail Injektor, 2.5 bar",Bosch,Motor,"180,50",15,BoschPartner`;

    const items = parser.parseCsv(csv);
    expect(items).toHaveLength(1);
    expect(items[0].sku).toBe('BOS-991');
    expect(items[0].title).toBe('Common Rail Injektor, 2.5 bar');
    expect(items[0].purchasePrice).toBe(180.5);
    expect(items[0].stock).toBe(15);
  });

  it('should return empty array for empty or whitespace-only CSV', () => {
    expect(parser.parseCsv('')).toEqual([]);
    expect(parser.parseCsv('   \n\n  ')).toEqual([]);
  });

  it('should parse JSON supplier feeds', () => {
    const json = JSON.stringify([
      {
        sku: 'OIL-5W30',
        title: 'Motorenöl LongLife 5W-30',
        brand: 'Castrol',
        category: 'Schmierstoffe',
        price: '34.90',
        quantity: 100,
        supplier: 'Castrol Direkt',
      },
    ]);

    const items = parser.parseJson(json);
    expect(items).toHaveLength(1);
    expect(items[0].sku).toBe('OIL-5W30');
    expect(items[0].purchasePrice).toBe(34.9);
    expect(items[0].stock).toBe(100);
  });
});
