import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { printHtml } from "./html";
import type { PrintModel } from "./model";

async function fontFaces() {
  // Embed both scripts so customer names can use a different script from headings.
  const families = [
    ["noto-sans-devanagari", "devanagari", "TB Hindi"],
    ["noto-sans-oriya", "oriya", "TB Odia"],
  ];
  const faces = await Promise.all(
    families.flatMap(([pkg, script, family]) =>
      [400, 700].map(async (weight) => {
        const file = path.join(
          process.cwd(),
          "node_modules",
          "@fontsource",
          pkg,
          "files",
          `${pkg}-${script}-${weight}-normal.woff2`,
        );
        const content = await readFile(file);
        return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};src:url('data:font/woff2;base64,${content.toString("base64")}') format('woff2')}`;
      }),
    ),
  );
  return faces.join("\n");
}

let fonts: Promise<string> | undefined;
function printExecutable() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (existsSync(chromium.executablePath())) return chromium.executablePath();
  // A system installation also works on desktops that already have Chrome or Edge.
  if (process.platform === "win32") {
    for (const app of [
      path.join(
        process.env.ProgramFiles || "C:/Program Files",
        "Google/Chrome/Application/chrome.exe",
      ),
      path.join(
        process.env["ProgramFiles(x86)"] || "C:/Program Files (x86)",
        "Microsoft/Edge/Application/msedge.exe",
      ),
    ]) {
      if (existsSync(app)) return app;
    }
  }
  return undefined;
}

export async function renderPdf(model: PrintModel) {
  return printPage((fonts) => printHtml(model, fonts), model.prefs.paper);
}

/** Render only server-generated templates, with all external network requests blocked. */
export async function printPage(
  createHtml: (fontCss: string) => string | Promise<string>,
  paper: PrintModel["prefs"]["paper"],
) {
  fonts ??= fontFaces().catch((error) => {
    fonts = undefined;
    throw error;
  });
  const html = await createHtml(await fonts);
  const browser = process.env.PLAYWRIGHT_CDP_ENDPOINT
    ? await chromium.connectOverCDP(process.env.PLAYWRIGHT_CDP_ENDPOINT)
    : await chromium.launch({
        executablePath: printExecutable(),
        headless: true,
      });
  try {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      locale: "en-IN",
      timezoneId: "Asia/Kolkata",
      serviceWorkers: "block",
    });
    try {
      await context.route(/^https?:\/\//, (route) => route.abort());
      const page = await context.newPage();
      await page.setContent(html, { waitUntil: "load" });
      await page.emulateMedia({ media: "print" });
      await page.evaluate(() => document.fonts.ready);
      if (paper === "80mm") {
        const height = await page
          .locator(".sheet")
          .first()
          .evaluate((sheet) => Math.ceil(sheet.getBoundingClientRect().height));
        return await page.pdf({
          width: "80mm",
          height: Math.min(15000, Math.max(100, height + 2)) + "px",
          printBackground: true,
          tagged: true,
        });
      }
      return await page.pdf({
        format: paper,
        landscape: paper === "A5",
        printBackground: true,
        preferCSSPageSize: true,
        tagged: true,
      });
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
