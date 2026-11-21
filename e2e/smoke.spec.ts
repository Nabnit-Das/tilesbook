import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {navRoutes} from '../src/lib/nav';
async function login(page:Page){
 await page.goto('/login');
 await page.getByLabel('Mobile number').fill('9999999999');
 await page.getByRole('button',{name:'Send code'}).click();
 await page.getByLabel('Verification code').fill('123456');
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Business overview'})).toBeVisible();
}
for(const [size,width,height] of [['desktop',1440,960],['mobile',390,844]] as const){
 test('all workspace routes on '+size,async({page})=>{
  await page.setViewportSize({width,height});const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400&&r.url().startsWith('http://127.0.0.1:3150'))errors.push(r.status()+' '+r.url());});
  await login(page);
  for(const {slug} of navRoutes){if(!slug)continue;await page.goto('/'+slug);await expect(page.locator('#content h1,#content h2').first(),slug).toBeVisible();expect(await page.locator('img').evaluateAll(images=>images.filter(el=>{const im=el as HTMLImageElement;return !im.complete||!im.naturalWidth;}).length)).toBe(0);}
  expect(errors).toEqual([]);
 });
}
test('key screens are usable with assistive technology',async({page})=>{
 await login(page);for(const route of ['/','/parties','/invoices','/settings']){await page.goto(route);await expect(page.locator('#content h1').first()).toBeVisible();const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(scan.violations.filter(v=>['serious','critical'].includes(v.impact??'')).map(v=>[route,v.id,v.nodes.map(n=>n.target)] )).toEqual([]);}
});
