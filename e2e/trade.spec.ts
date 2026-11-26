import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import words from "../src/features/messages/en.json";

async function save(page: Page, dialog: Locator) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/data" &&
        r.request().method() === "POST",
    ),
    dialog.getByRole("button", { name: words.save, exact: true }).click(),
  ]);
  const body = await response.text();
  expect(response.ok(), body).toBeTruthy();
  await expect(dialog).toHaveCount(0);
}

test("shopkeeper bills a new party from a new tile lot, records money, prints and exports", async ({
  page,
}) => {
  test.setTimeout(180000);
  const suffix = randomUUID().slice(0, 8);
  const customer = "E2E Builders " + suffix,
    product = "E2E Glossy tile " + suffix,
    lotNo = "E2E-" + suffix;
  await page.goto("/login");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page.locator("input[type=tel]").fill("9999999999");
  await page.locator("form button:not([type=button])").click();
  await page.locator('input[autocomplete="one-time-code"]').fill("123456");
  await Promise.all([
    page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/auth" &&
        r.request().method() === "POST" &&
        r.ok(),
    ),
    page.locator("form button:not([type=button])").click(),
  ]);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
  await page.waitForLoadState("networkidle");

  await page.goto("/parties?new=1", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/parties/);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator('[name="name"]').fill(customer);
  await dialog.locator('[name="type"]').selectOption("builder");
  await dialog.locator('[name="address"]').fill("Patia, Bhubaneswar");
  await dialog.locator('[name="state"]').fill("Odisha");
  await save(page, dialog);

  await page.goto("/items?new=1");
  await dialog.locator('[name="name"]').fill(product);
  await dialog.locator('[name="hsn"]').fill("6907");
  await dialog.locator('[name="salePrice"]').fill("100");
  await dialog.locator('[name="purchasePrice"]').fill("70");
  await dialog.locator('[name="baseUnit"]').selectOption("Box");
  await dialog.locator('[name="gstRate"]').fill("18");
  await dialog.locator('[name="sqftPerPiece"]').fill("4");
  await dialog.locator('[name="piecesPerBox"]').fill("4");
  await dialog.locator('[name="lotNo"]').fill(lotNo);
  await dialog.locator('[name="shade"]').fill("A3");
  await dialog.locator('[name="openingQty"]').fill("50");
  await save(page, dialog);

  await page.goto("/invoices?new=1");
  await dialog
    .locator("select")
    .filter({ has: page.getByRole("option", { name: customer, exact: true }) })
    .selectOption({ label: customer });
  const line = dialog.locator(".tb-linecard").first();
  await line
    .getByLabel(words.productId, { exact: false })
    .selectOption({ label: product });
  await expect(
    line.locator("select").nth(1).locator("option:checked"),
  ).toContainText(lotNo);
  await line.getByRole("button", { name: words.calculator }).click();
  const calculator = line.locator(".tb-calc");
  await calculator.getByLabel(words.requiredSqft, { exact: false }).fill("350");
  await calculator.getByLabel(words.wastage, { exact: false }).fill("0");
  await expect(calculator).toContainText("22 " + words.boxes);
  await calculator.getByRole("button", { name: words.applyQuantity }).click();
  await expect(line.locator('input[type="number"]').first()).toHaveValue("22");
  await expect(dialog.locator(".tb-grand")).toContainText("2,596");
  await save(page, dialog);
  await page.getByRole("textbox", { name: words.searchList }).fill(customer);
  const invoiceRow = page
    .locator("table tbody tr")
    .filter({ hasText: customer });
  await expect(invoiceRow).toHaveCount(1);
  const reference = (await invoiceRow
    .locator("td")
    .first()
    .textContent())!.trim();
  await invoiceRow.click();
  await dialog.getByRole("link", { name: words.recordPayment }).click();
  await expect(
    dialog.locator('[name="documentId"] option:checked'),
  ).toContainText(reference);
  await dialog.locator('[name="amount"]').fill("500");
  await dialog.locator('[name="mode"]').selectOption("cash");
  await save(page, dialog);

  await page.goto("/invoices?q=" + encodeURIComponent(customer));
  await page.locator("table tbody tr").filter({ hasText: customer }).click();
  const [pdf] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("link", { name: /download pdf/i }).click(),
  ]);
  expect(pdf.suggestedFilename()).toContain(reference);
  const pdfBytes = await readFile((await pdf.path())!);
  expect(pdfBytes.subarray(0, 5).toString()).toBe("%PDF-");
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const reader = getDocument({ data: new Uint8Array(pdfBytes) });
  try {
    const doc = await reader.promise;
    const content = await (await doc.getPage(1)).getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    for (const value of [customer, lotNo, "2,596", "500", "2,096"])
      expect(text).toContain(value);
  } finally {
    await reader.destroy();
  }

  await page.goto("/receivables?q=" + encodeURIComponent(customer));
  await expect(
    page.locator("table tbody tr").filter({ hasText: customer }),
  ).toContainText("2,096");
  await page.goto("/reports?view=sales-report");
  await page.getByRole("textbox", { name: words.searchList }).fill(customer);
  const [xlsx] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: words.excel, exact: true }).click(),
  ]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile((await xlsx.path())!);
  const exported = workbook.worksheets[0].getRow(2).values;
  expect(exported).toContain(customer);
  expect(exported).toContain(2596);
  expect(exported).toContain(2096);
  const report = await page.request.get("/api/reports/sales-report", {
    params: { q: customer, lang: "en" },
  });
  expect(report.status()).toBe(200);
  expect(report.headers()["content-type"]).toContain("application/pdf");
  const reportPdf = getDocument({ data: new Uint8Array(await report.body()) });
  try {
    const doc = await reportPdf.promise;
    const items = (await (await doc.getPage(1)).getTextContent()).items;
    const printed = items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    expect(printed).toContain(customer);
    expect(printed).toContain("2,596");
  } finally {
    await reportPdf.destroy();
  }
});

