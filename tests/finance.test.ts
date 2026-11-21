import {expect,it} from 'vitest';
import {journal,statements} from '../src/finance/ledger';import type {Snapshot} from '../src/features/model';
it('reconciles billed GST, receipt, stock consumption and retained earnings',()=>{
 const doc={id:'inv',date:'2026-11-19',partyId:'p',total:11800,taxable:10000,tax:1800,roundOff:0,lines:[{id:'a',productId:'tile',qty:2,baseQty:2}]};
 const book:Snapshot={business:{id:'b'},userId:'u',role:'Owner',records:{saleInvoices:[doc],products:[{id:'tile',purchasePrice:3000}],payments:[{id:'r',date:doc.date,documentId:'inv',direction:'in',mode:'cash',amount:4000}]}};
 expect(journal(book).reduce((s,e)=>s+e.paise,0)).toBe(0);
 const scope={start:'',end:'',user:''};
 const pl=statements(book,'profit-loss',scope).rows;
 expect(pl.find(v=>v.id==='earnings')).toMatchObject({net:4000});
 const balance=statements(book,'balance-sheet',scope).rows;
 expect(balance.find(v=>v.id==='receivableControl')).toMatchObject({amount:7800});
 expect(balance.find(v=>v.id==='outputGst')).toMatchObject({amount:1800});
 expect(statements(book,'trial-balance',{...scope,end:'2026-11-18'}).rows).toEqual([]);
});it('carries openings into the trial balance and reverses returns at the original sale valuation', () => {
  const lot = {productId:'tile', lotId:'lot', qty:1};
  const book:Snapshot = {business:{id:'b'},userId:'u',role:'Owner',records:{
    banks:[{id:'bank',date:'2026-01-01',openingBalance:50000}],
    purchaseBills:[{id:'p1',date:'2026-01-01',lines:[{...lot,id:'a',landedCost:3000}]},
      {id:'p2',date:'2026-03-01',lines:[{...lot,id:'b',landedCost:6000}]}],
    saleInvoices:[{id:'invoice',date:'2026-02-01',lines:[{...lot,id:'s'}]}],
    creditNotes:[{id:'return',sourceId:'invoice',date:'2026-04-01',lines:[{...lot,id:'r'}]}]
  }};
  const scope={start:'2026-04-01',end:'2026-04-30',user:''};
  const trial=statements(book,'trial-balance',scope).rows;
  expect(trial.find(r=>r.id==='cashAtBank')).toMatchObject({debitPaise:50000});
  expect(trial.find(r=>r.id==='costOfSales')).toBeUndefined();
  expect(statements(book,'profit-loss',scope).rows.find(r=>r.id==='costOfSales')).toMatchObject({net:3000});
});
