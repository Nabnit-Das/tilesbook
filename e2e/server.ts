import { spawn } from "node:child_process";
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import { once } from "node:events";
import { existsSync } from "node:fs";
export default async function start() {
  if (process.env.BASE_URL) return;
  const exe =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    [
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    ].find(existsSync);
  const server = spawn(
    process.execPath,
    process.env.TEST_SUPABASE !== "1" ? ["scripts/demo.mjs","--production","--port","3150"] : [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3150",
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        TILEBOOK_LOCAL_DEMO: process.env.TEST_SUPABASE === "1" ? "0" : "1",
        TILEBOOK_TEST_SMS: process.env.TEST_SUPABASE === "1" ? "1" : "0",
        TILEBOOK_DATA_DIR: join(mkdtempSync(join(tmpdir(),'tilebook-e2e-')),'data'),
        ...(exe ? { PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: exe } : {}),
      },
    },
  );
  const exited = once(server, "exit");
  const stop = async () => {
    server.kill();
    await exited;
  };
  try {
    const end = Date.now() + 120000;
    while (Date.now() < end) {
      if (server.exitCode !== null)
        throw Error("Test server exited during startup");
      try {
        if (
          (
            await fetch("http://127.0.0.1:3150/api/health", {
              signal: AbortSignal.timeout(5000),
            })
          ).ok
        )
          return stop;
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    throw Error("Database readiness timed out");
  } catch (e) {
    await stop();
    throw e;
  }
}
