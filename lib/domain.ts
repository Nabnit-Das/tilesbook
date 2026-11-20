export function convertArea(area: number, wastage: number, sqftPerPiece: number, piecesPerBox: number, fullBoxes = true) {
  if (![area,wastage,sqftPerPiece,piecesPerBox].every(Number.isFinite) || area < 0 || wastage < 0 || sqftPerPiece <= 0 || !Number.isInteger(piecesPerBox) || piecesPerBox < 1) throw new Error('Enter valid tile dimensions and area.');
  const requiredArea = area * (1 + wastage / 100);
  const pieces = Math.ceil(requiredArea / sqftPerPiece);
  return {requiredArea, pieces, boxes: fullBoxes ? Math.ceil(pieces / piecesPerBox) : Math.floor(pieces / piecesPerBox), loose: fullBoxes ? 0 : pieces % piecesPerBox};
}

export type Line = {productId: string; description: string; hsn: string; lotId: string; lot: string; shade: string; room: string; qty: number; unit: string; sqft: number; price: number; discount: number; gst: number};
export type Balance = {lotId: string; quantity: number};
export function invoiceTotals(lines: Line[], interstate = false) {
  const rows = lines.map(line => {
    const taxable = Math.round(line.qty * line.price) - line.discount;
    if (!Number.isSafeInteger(taxable) || taxable < 0) throw new Error('Discount exceeds line value.');
    const tax = Math.round(taxable * line.gst / 100);
    const cgst = interstate ? 0 : Math.floor(tax / 2);
    return {...line, taxable, tax, cgst, sgst: interstate ? 0 : tax - cgst, igst: interstate ? tax : 0, amount: taxable + tax};
  });
  const net = rows.reduce((sum,row) => sum + row.amount,0);
  const total = Math.round(net / 100) * 100;
  const hsn = new Map<string, {hsn: string; taxable: number; cgst: number; sgst: number; igst: number}>();
  for(const row of rows) {
    const item = hsn.get(row.hsn) ?? {hsn: row.hsn, taxable: 0, cgst: 0, sgst: 0, igst: 0};
    item.taxable += row.taxable;
    item.cgst += row.cgst;
    item.sgst += row.sgst;
    item.igst += row.igst;
    hsn.set(row.hsn,item);
  }
  return {rows, total, net, roundOff: total - net, hsn: [...hsn.values()]};
}
export function stock(movements: Balance[], lotId: string) {
  return movements.reduce((sum,row) => sum + (row.lotId === lotId ? row.quantity : 0),0);
}
export function mixedLots(lines: Line[]) {
  const chosen = new Map<string,string>();
  return lines.some(line => {
    const first = chosen.get(line.productId);
    chosen.set(line.productId,line.lotId);
    return first !== undefined && first !== line.lotId;
  });
}
export function deadDays(lastSold: string, today = new Date()) {
  return Math.max(0,Math.floor((today.getTime() - new Date(lastSold).getTime()) / 86400000));
}
export function commission(amount: number, boxes: number, percent: number, perBox: number) {
  return Math.round(amount * percent / 100) + Math.round(boxes * perBox);
}
const small = 'Zero One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve Thirteen Fourteen Fifteen Sixteen Seventeen Eighteen Nineteen'.split(' ');
const tens = 'Zero Ten Twenty Thirty Forty Fifty Sixty Seventy Eighty Ninety'.split(' ');
function words(n: number): string {
  for (const [size, name] of [[10000000,'Crore'],[100000,'Lakh'],[1000,'Thousand'],[100,'Hundred']] as const) {
    if (n >= size) return words(Math.floor(n/size)) + ' ' + name + (n%size ? ' ' + words(n%size) : '');
  }
  return n < 20 ? small[n] : tens[Math.floor(n/10)] + (n%10 ? ' ' + small[n%10] : '');
}
export const rupeesInWords = (paise: number) => words(Math.floor(paise / 100)) + ' Rupees Only';
export const money = (paise: number) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:paise%100 ? 2 : 0}).format(paise / 100);