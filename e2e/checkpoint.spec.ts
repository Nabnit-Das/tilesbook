import {test,expect,type APIRequestContext} from '@playwright/test';

async function signIn(request:APIRequestContext,role:string) {
 expect((await request.post('/api/auth',{data:{action:'demo',role}})).ok()).toBe(true);
}

test('owner downloads a private checkpoint and counter cannot export it', async({request}) => {
  await signIn(request,'owner');
  const snapshot = await (await request.get('/api/data')).json();
  const options = {data:{action:'export',businessId:snapshot.business.id}};
  const response = await request.post('/api/backups/file',options);
  expect(response.ok()).toBe(true);
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(await response.json()).toMatchObject({businessId:snapshot.business.id,format:'tilebook-checkpoint-v2'});
  await signIn(request,'counter');
  const denied = await request.post('/api/backups/file',options);
  expect(denied.ok()).toBe(false);
  expect(await denied.json()).toEqual({error:expect.stringMatching(/owner|permission/i)});
});
