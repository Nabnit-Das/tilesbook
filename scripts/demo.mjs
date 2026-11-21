import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
const options=process.argv.slice(2);
const executable=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/chromium'].find(existsSync);
const child=spawn(process.execPath,['node_modules/next/dist/bin/next',options.includes('--production')?'start':'dev',...(options.includes('--production')?[]:['--webpack']),'--hostname','127.0.0.1',...options.filter(x=>x!=='--production')],{stdio:'inherit',env:{...process.env,TILEBOOK_LOCAL_DEMO:'1',...(executable?{PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:executable}:{})}});
child.on('exit',code=>process.exit(code??1));
