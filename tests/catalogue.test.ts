import { expect, it } from "vitest";
import { report } from "../src/features/reporting";
import { catalogueItems, cataloguePhoto } from "../src/features/catalogue-data";
import type { Snapshot } from "../src/features/model";

const shop: Snapshot = { business: { id: "shop" }, userId: "u", role: "Owner", records: {
  saleInvoices: [{id:"i",date:"2026-11-20",salesperson:"Counter 1",taxable:10000,tax:1800,total:11800}],
  stockMovements: [{id:"m",date:"2026-11-20",physical:-2,reserved:-2,display:0,kind:"challans"}]
}};
const scope={start:"",end:"",user:""};
it("reports actual signed dispatch movements and salesperson totals",()=>{
  const stock=report(shop,"stock-detail",scope);
  expect(stock.columns).toEqual(expect.arrayContaining(["physical","reserved","display","kind"]));
  expect(stock.rows[0].physical).toBe(-2);
  expect(report(shop,"staff-sales",scope).rows[0]).toMatchObject({salesperson:"Counter 1",taxable:10000,tax:1800,total:11800});
});
it("keeps supplier prices and unrelated photo URLs out of the customer catalogue",()=>{
  const rows=catalogueItems([{id:"p",name:"White tile",salePrice:500,purchasePrice:100}],"white");
  expect(rows[0].price).toBe(500);
  expect(rows[0]).not.toHaveProperty("purchasePrice");
  expect(cataloguePhoto("https://example.org/private.jpg","shop")).toEqual({});
});
