import http from "node:http";
import { existsSync } from "node:fs";
import next from "next";
const args = process.argv.slice(2);
const portFlag = args.findIndex((a) => a === "--port" || a === "-p");
const port = Number(
  portFlag >= 0 ? args[portFlag + 1] : process.env.PORT || 3000,
);
const hostname = "127.0.0.1";
process.env.TILEBOOK_LOCAL_DEMO = "1";
const chrome = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/chromium",
].find(existsSync);
if (chrome) process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??= chrome;
const app = next({
  dev: !args.includes("--production"),
  hostname,
  port,
  webpack: true,
});
await app.prepare();
const handle = app.getRequestHandler();
const server = http.createServer(handle);
server.listen(port, hostname, () => {
  Object.defineProperty(process, "tilebookLoopbackDemo", { value: true });
  console.log("TileBook demo at http://" + hostname + ":" + port);
});
