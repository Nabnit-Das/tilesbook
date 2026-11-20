import {describe,expect,it} from 'vitest';
import {commission,convertArea,deadDays,invoiceTotals,mixedLots,rupeesInWords,stock,type Line} from '../lib/domain';
const main:Line={productId:'white',description:'2x2 Glossy White Vitrified',hsn:'6907',lotId:'2531',lot:'2531',shade:'A3',room:'',qty:23,unit:'Box',sqft:368,price:319600,discount:0,gst:18};
const adhesive:Line={...main,productId:'adhesive',description:'Tile Adhesive 20 kg',hsn:'3214',lotId:'adh',lot:'AD',qty:6,unit:'Bag',sqft:0,price:52000};
describe('TileBook business rules',()=>{
 it('rounds the required order to full boxes and supports loose pieces',()=>{
  expect(convertArea(350,0,4,4)).toMatchObject({boxes:22,loose:0});
  expect(convertArea(350,5,4,4)).toMatchObject({boxes:23,loose:0});
  expect(convertArea(34,0,4,4,false)).toMatchObject({boxes:2,loose:1});
  expect(()=>convertArea(34,0,0,4)).toThrow();
 });
 it('calculates GST, HSN groups, total and round-off for INV-113',()=>{
  const t=invoiceTotals([main,adhesive]);
  expect(t.total).toBe(9042100);expect(t.roundOff).toBe(-4);expect(t.total-5000000).toBe(4042100);
  expect(t.hsn).toMatchObject([{hsn:'6907',taxable:7350800,cgst:661572,sgst:661572,igst:0},{hsn:'3214',taxable:312000,cgst:28080,sgst:28080,igst:0}]);
  const interstate=invoiceTotals([main],true);
  expect(interstate.rows[0]).toMatchObject({cgst:0,sgst:0,igst:1323144});
 });
 it('spells amounts using lakh and crore',()=>{
  expect(rupeesInWords(9042100)).toBe('Ninety Thousand Four Hundred Twenty One Rupees Only');
  expect(rupeesInWords(1230000000)).toBe('One Crore Twenty Three Lakh Rupees Only');
 });
 it('detects mixed lots and derives stock from the ledger',()=>{
  expect(mixedLots([main,adhesive])).toBe(false);
  expect(mixedLots([main,{...main,lotId:'2416'}])).toBe(true);
  expect(stock([{lotId:'2531',quantity:200},{lotId:'2531',quantity:-60},{lotId:'2416',quantity:40},{lotId:'2531',quantity:-1}],main.lotId)).toBe(139);
 });
 it('calculates commission and calendar age',()=>{
  expect(commission(100000,10,2,0)).toBe(2000);
  expect(commission(100000,10,0,500)).toBe(5000);
  expect(deadDays('2026-01-01',new Date('2026-07-01'))).toBe(181);
 });
});