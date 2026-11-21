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
});