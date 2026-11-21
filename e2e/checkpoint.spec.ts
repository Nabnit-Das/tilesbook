import {test,expect,type APIRequestContext} from '@playwright/test';

async function signIn(request:APIRequestContext,phone:string) {
  for (const data of [{action:'send',phone},{action:'verify',phone,otp:'123456'}]) {
    expect((await request.post('/api/auth',{data})).ok()).toBe(true);
  }
}

test('owner downloads a private checkpoint and counter cannot export it', async({request}) => {
  await signIn(request,'9999999999');
  const snapshot = await (await request.get('/api/data')).json();
  const options = {data:{action:'export',businessId:snapshot.business.id}};
  const response = await request.post('/api/backups/file',options);
  expect(response.ok()).toBe(true);
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(await response.json()).toMatchObject({businessId:snapshot.business.id,format:'tilebook-checkpoint-v2'});
  await signIn(request,'9999999998');
  const denied = await request.post('/api/backups/file',options);
  expect(denied.ok()).toBe(false);
  expect(await denied.json()).toEqual({error:expect.stringMatching(/owner|permission/i)});
});
