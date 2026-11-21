import {test,expect} from '@playwright/test';
test('creates a bill offline and replays it once on reconnect',async({page,context})=>{
 const login=await context.request.post('/api/auth',{data:{action:'send',phone:'9999999999'}});expect(login.ok()).toBe(true);
 expect((await context.request.post('/api/auth',{data:{action:'verify',phone:'9999999999',otp:'123456'}})).ok()).toBe(true);
 await page.goto('/invoices?new=1');await expect(page.locator('.tb-recordform,.tb-docform,.tb-formhead').first()).toBeVisible();
 const before=await (await context.request.get('/api/data')).json();
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 await context.setOffline(true);await page.goto('/offline?new=1');await expect(page.locator('.tb-formhead').first()).toBeVisible();
 const selects=page.locator('form select');const party=page.locator('select').filter({has:page.locator('option',{hasText:'Sai Builders'})}).first();
 await party.selectOption({label:'Sai Builders'});
 const product=before.records.products.find((p:{id:string})=>before.records.lots.some((l:{productId:string;sellable:number})=>l.productId===p.id&&l.sellable>=1));
 const item=selects.filter({has:page.locator('option[value="'+product.id+'"]')}).first();await item.selectOption(product.id);
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:/sync|offline/i}).first()).toBeVisible();
 await context.setOffline(false);await expect.poll(async()=>{const s=await (await context.request.get('/api/data')).json();return s.records.saleInvoices.length;}).toBe(before.records.saleInvoices.length+1);
 await page.reload();const after=await (await context.request.get('/api/data')).json();expect(after.records.saleInvoices).toHaveLength(before.records.saleInvoices.length+1);
});