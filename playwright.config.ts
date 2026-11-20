import {defineConfig} from '@playwright/test';
const external=process.env.TILEBOOK_TEST_URL;
export default defineConfig({
 testDir:'./e2e',
 timeout:60000,
 workers:1,
 use:{baseURL:external??'http://localhost:3000',acceptDownloads:true,channel:process.env.TILEBOOK_BROWSER_CHANNEL},
 webServer:external?undefined:{command:'npm run dev',url:'http://localhost:3000',reuseExistingServer:true,timeout:120000},
});
