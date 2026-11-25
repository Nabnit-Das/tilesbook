import {expect,test} from '@playwright/test';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import AxeBuilder from '@axe-core/playwright';

test('public mobile login localizes signup and recovery and disables the demo even with its environment flag',async({page})=>{
 const origin='http://127.0.0.1:3162';
 const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3162'],{
   stdio:'ignore',env:{...process.env,TILEBOOK_LOCAL_DEMO:'1',TILEBOOK_SMS_ENABLED:'0',TILEBOOK_TEST_SMS:'0',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',NEXT_PUBLIC_SUPABASE_ANON_KEY:'local-test-public-key'}
 });
 const exited=once(server,'exit');
 try{
 await expect.poll(async()=>{if(server.exitCode!==null)throw Error('Isolated server failed to start');return fetch(origin+'/login').then(r=>r.status).catch(()=>0);},{timeout:45000}).toBe(200);
 const result=await page.request.post(origin+'/api/auth',{headers:{'X-Forwarded-Host':'localhost'},data:{action:'verify',phone:'9999999999',otp:'123456'}});
 expect(result.ok()).toBe(false);
 await page.setViewportSize({width:390,height:844});
 await page.goto(origin+'/login');await page.getByRole('button',{name:'Create account',exact:true}).click();
 await expect(page.getByLabel('Full name')).toBeVisible();
 await page.getByRole('button',{name:'Show password',exact:true}).click();await expect(page.locator('input[name=password]')).toHaveAttribute('type','text');
 await page.getByRole('button',{name:'हिन्दी',exact:true}).click();await expect(page.getByRole('heading',{name:'खाता बनाएँ'})).toBeVisible();
 await page.getByRole('button',{name:'ଓଡ଼ିଆ',exact:true}).click();await expect(page.getByRole('heading',{name:'ଖାତା ଖୋଲନ୍ତୁ'})).toBeVisible();
 await page.getByRole('button',{name:'English',exact:true}).click();
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations.filter(v=>['critical','serious'].includes(v.impact||'')).map(v=>v.id)).toEqual([]);
 await page.getByRole('button',{name:'Sign in to TileBook',exact:true}).click();await page.getByRole('button',{name:'Forgot password',exact:true}).click();await expect(page.getByLabel('Email',{exact:true})).toBeVisible();
 }finally{server.kill();await exited;}
});
