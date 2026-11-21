import {defineConfig} from '@playwright/test';
import {existsSync} from 'node:fs';
const systemChrome=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
export default defineConfig({testDir:'./e2e',timeout:180000,expect:{timeout:20000},workers:1,fullyParallel:false,reporter:[['list'],['html',{open:'never'}]],use:{baseURL:process.env.BASE_URL||'http://127.0.0.1:3150',browserName:'chromium',launchOptions:{executablePath:systemChrome},trace:'retain-on-failure',screenshot:'only-on-failure'},globalSetup:'./e2e/server.ts'});
