import {expect,test} from '@playwright/test';
test('owner can create a party, a tile and lot, bill with area conversion, then record payment',async({page})=>{
 const id=Date.now(),party='Playwright Customer '+id,product='Playwright Tile '+id;
 await page.goto('/');
 await page.getByLabel('Phone number').fill('9999999999');
 await page.getByLabel('One-time password').fill('123456');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Parties',exact:true}).click();
 await page.getByRole('button',{name:'Party Details',exact:true}).click();
 await page.getByRole('button',{name:'Add Party',exact:true}).first().click();
 await page.getByLabel('Party name').fill(party);
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByText(party,{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Items',exact:true}).click();
 await page.getByRole('button',{name:'Items',exact:true}).last().click();
 await page.getByRole('button',{name:'Add Item',exact:true}).click();
 await page.getByLabel('Item name').fill(product);
 await page.getByLabel('HSN', {exact:true}).fill('6907');
 await page.getByLabel('Sale price (₹)',{exact:true}).fill('3196');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByText(product,{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'View '+product,exact:true}).click();
 await page.getByRole('button',{name:'Add lot',exact:true}).click();
 await page.getByLabel('Lot number').fill('P'+id);
 await page.getByLabel('Shade').fill('A3');
 await page.getByLabel('Opening stock').fill('40');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByText('P'+id,{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Add Sale',exact:true}).first().click();
 await page.getByRole('combobox',{name:'Party',exact:true}).selectOption({label:party});
 await page.getByRole('combobox',{name:'Item',exact:true}).selectOption({label:product});
 await page.getByRole('combobox',{name:'Lot / Shade',exact:true}).selectOption({label:'P'+id+' / A3 · '+product});
 await page.getByRole('button',{name:'Sqft Converter',exact:true}).click();
 await page.getByRole('button',{name:'Use 23 boxes',exact:true}).click();
 await page.getByLabel('Document number').fill('QA-'+id);
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.getByRole('button',{name:'View QA-'+id,exact:true}).click();
 const pdf=page.waitForEvent('download');
 await page.getByRole('link',{name:'Download PDF'}).click();
 expect((await pdf).suggestedFilename()).toBe('QA-'+id+'.pdf');
 await page.getByRole('button',{name:'Record payment'}).click();
 await page.getByLabel('Amount (₹)',{exact:true}).fill('200');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Money received'})).toBeVisible();
 await page.getByRole('button',{name:'Reports',exact:true}).first().click();
 await page.getByRole('button',{name:'Who Owes Me',exact:true}).first().click();
 await expect(page.getByText('QA-'+id,{exact:true})).toBeVisible();
 const excel=page.waitForEvent('download');
 await page.getByRole('button',{name:'Excel',exact:true}).click();
 expect((await excel).suggestedFilename()).toBe('tilebook-receivables.xlsx');
});
test('counter cannot access purchase records or purchase costs',async({page})=>{
 await page.goto('/');
 await page.getByLabel('Phone number').fill('9999999998');
 await page.getByLabel('One-time password').fill('123456');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible();
 const result=await page.request.get('/api/records');
 const rows=await result.json();
 expect(rows.some((r:{kind:string})=>r.kind==='purchase')).toBe(false);
 expect(rows.filter((r:{kind:string})=>r.kind==='product').every((r:{data:object})=>!('cost' in r.data))).toBe(true);
});
test('sessions scope records, firm switches and PDF downloads to the signed-in tenant',async({request})=>{
 const signIn=await request.post('/api/session',{data:{phone:'9999999997',otp:'123456'}});
 expect(signIn.ok()).toBe(true);
 const records=await request.get('/api/records');
 expect((await records.json()).map((r:{id:string})=>r.id)).toEqual(['tilebook_second_party']);
 expect((await request.get('/api/print/tilebook_demo_invoice113')).status()).toBe(404);
 expect((await request.patch('/api/session',{data:{businessId:'tilebook_demo'}})).status()).toBe(404);
});

test('sample invoice and 80 mm receipt return PDFs',async({request})=>{
 expect((await request.post('/api/session',{data:{phone:'9999999999',otp:'123456'}})).ok()).toBe(true);
 for(const paper of ['A4','80mm']){
  const response=await request.get('/api/print/tilebook_demo_invoice113?paper='+paper);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toBe('application/pdf');
  const pdf=(await response.body()).toString('latin1');
  expect(pdf.startsWith('%PDF-')).toBe(true);
  expect(pdf).toContain(paper==='80mm'?'/MediaBox [0 0 226.771654':'/MediaBox [0 0 595.28');
 }
});

test('reservations, staged dispatch, returns and samples preserve the stock ledger',async({request})=>{
 expect((await request.post('/api/session',{data:{phone:'9999999999',otp:'123456'}})).ok()).toBe(true);
 type RecordRow={id:string;kind:string;data:Record<string,unknown>};
 const read=async():Promise<RecordRow[]> => (await request.get('/api/records')).json();
 const create=async(kind:string,data:object,status=201)=>{
  const response=await request.post('/api/records',{data:{kind,key:crypto.randomUUID(),data}});
  const result=await response.json();
  expect(response.status(),JSON.stringify(result)).toBe(status);
  return result as {id:string;error:string};
 };
 const date='2026-11-20',sequence=Date.now();
 const product=(await create('product',{name:'Ledger Test '+sequence,hsn:'6907',gst:18,unit:'Box',area:4,pack:4,price:100000,cost:70000,low:10})).id;
 const lot=(await create('lot',{productId:product,lot:'LEDGER-A',shade:'A3',quantity:210,date})).id;
 const other=(await create('lot',{productId:product,lot:'LEDGER-B',shade:'B2',quantity:10,date})).id;
 const balance=async()=> (await read()).filter(r=>r.kind==='movement'&&r.data.lotId===lot).reduce((s,r)=>s+Number(r.data.quantity),0);
 const partyId='tilebook_demo_party0';
 const line=(qty:number,lotId=lot)=>({productId:product,lotId,qty,price:100000,discount:0});
 const doc=(reference:string,qty:number)=>({partyId,date,reference:reference+'-'+sequence,lines:[line(qty)]});
 const order=(await create('order',{...doc('SO',200),received:10000})).id;
 expect(await balance()).toBe(210);
 expect((await create('invoice',{...doc('INV',1),lines:[line(1),line(1,other)]},422)).error).toContain('Mixed lots');
 await create('challan',{...doc('DC-1',60),orderId:order});
 expect(await balance()).toBe(150);
 const second=(await create('challan',{...doc('DC-2',140),orderId:order})).id;
 expect(await balance()).toBe(10);
 await create('challan',{...doc('DC-3',1),orderId:order},422);
 const invoice=(await create('invoice',{...doc('INV',140),sourceChallanId:second})).id;
 expect(await balance()).toBe(10);
 await create('credit',{sourceId:invoice,lotId:other,quantity:1,date,reference:'BAD-'+sequence},422);
 await create('credit',{sourceId:invoice,lotId:lot,quantity:1,date,reference:'CN-'+sequence});
 expect(await balance()).toBe(11);
 await create('display',{lotId:lot,quantity:2,name:'Display wall',date});
 expect(await balance()).toBe(9);
});



test('a bill entered offline syncs when the connection returns',async({page,context})=>{
 test.skip(process.env.TILEBOOK_TEST_PRODUCTION!=='true','The production service worker is required.');
 const reference='OFFLINE-'+Date.now();
 await page.goto('/');
 await page.getByLabel('Phone number').fill('9999999999');
 await page.getByLabel('One-time password').fill('123456');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible();
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 await context.setOffline(true);
 await page.getByRole('button',{name:'Add Sale',exact:true}).first().click();
 await page.getByRole('combobox',{name:'Party',exact:true}).selectOption({label:'Sai Builders'});
 await page.getByRole('combobox',{name:'Item',exact:true}).selectOption({label:'2x2 Glossy White Vitrified'});
 await page.getByRole('combobox',{name:'Lot / Shade',exact:true}).selectOption({label:'2531 / A3 · 2x2 Glossy White Vitrified'});
 await page.getByLabel('Document number').fill(reference);
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Saved on this device.');
 await context.setOffline(false);
 await expect.poll(async()=>{
  const response=await page.request.get('/api/records');
  const records=await response.json();
  return records.some((r:{data:{reference?:string}})=>r.data.reference===reference);
 }).toBe(true);
});
