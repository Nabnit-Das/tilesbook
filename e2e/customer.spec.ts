import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
test("verified email customer provisions once, recovers access and restores records on a second device", async ({
  playwright,
  page,
  baseURL,
}) => {
  test.skip(
    process.env.TEST_SUPABASE !== "1",
    "Requires local Supabase Auth and its test inbox",
  );
  if (
    !baseURL ||
    !["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname)
  )
    throw Error("Local test app required");
  const email = "tilebook-" + randomUUID() + "@example.test",
    password = "Local-test-" + randomUUID(),
    replacement = password + "-new";
  const auth = (ctx: APIRequestContext, data: object) =>
    ctx.post("/api/auth", { data: { email, ...data } });
  async function code(subject: string, recipient=email) {
    let otp = "";
    await expect
      .poll(
        async () => {
          const r = await page.request.get(
            "http://127.0.0.1:54324/api/v1/messages",
          );
          const box = await r.json();
          const mail = box.messages.find(
            (m: { To: { Address: string }[]; Subject: string }) =>
              m.To.some((t) => t.Address === recipient) &&
              m.Subject.includes(subject),
          );
          if (mail) {
            const body = await (
              await page.request.get(
                "http://127.0.0.1:54324/api/v1/message/" + mail.ID,
              )
            ).json();
            otp = (body.Text || body.HTML).match(/\b\d{6}\b/)?.[0] || "";
          }
          return otp.length;
        },
        { timeout: 45000 },
      )
      .toBe(6);
    return otp;
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  if (
    await page.getByRole("button", { name: "Email", exact: true }).isVisible()
  )
    await page.getByRole("button", { name: "Email", exact: true }).click();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  const profile = {
    name: "Local shop",
    category: "tiles",
    state: "Odisha",
    city: "Cuttack",
    address: "Test Road",
    pin: "753001",
    phone: "9000000011",
    ownerName: "Test Owner",
    language: "en",
    financialYear: "2026",
    gstStatus: "unregistered",
  };
  const customer=(ctx:APIRequestContext,values:object)=>ctx.post("/api/customer",{data:values});
  const pass={password,confirm:password,terms:true,privacy:true};
  async function enroll(ctx:APIRequestContext, email:string){
    const start={action:"start",email,firstName:"Test",lastName:"Owner",company:"Local shop",category:"tiles"};
    expect((await customer(ctx,start)).ok()).toBe(true);
    expect((await customer(ctx,{action:"setPassword",...pass})).ok()).toBe(false);
    expect((await ctx.post("/api/workspaces",{data:profile})).ok()).toBe(false);
    expect((await customer(ctx,{action:"emailProof",email,code:"000000"})).ok()).toBe(false);
    expect((await customer(ctx,{action:"emailProof",email,code:await code("verification",email)})).ok()).toBe(true);
    expect((await ctx.post("/api/workspaces",{data:profile})).ok()).toBe(false);
    expect((await customer(ctx,{action:"setPassword",...pass})).ok()).toBe(true);
  }
  await enroll(page.request,email);
  await page.goto("/access");
  await expect(
    page.getByRole("heading", { name: "Set up your business" }),
  ).toBeVisible();
  const created = await page.request.post("/api/workspaces", { data: profile });
  expect(created.ok()).toBe(true);
  const { id } = await created.json();
  expect(
    await (
      await page.request.post("/api/workspaces", { data: profile })
    ).json(),
  ).toEqual({ id });
  expect(
    (
      await page.request.post("/api/data", {
        data: {
          businessId: id,
          resource: "parties",
          data: { name: "Persistent customer" },
          action: "create",
        },
      })
    ).ok(),
  ).toBe(true);
  const canonical=await (await page.request.get("/api/auth")).json();
  const second = await playwright.request.newContext({ baseURL });
  try {
    expect(
      (
        await auth(second, { action: "email", password: "incorrect-password" })
      ).ok(),
    ).toBe(false);
    expect((await auth(second, { action: "email", password })).ok()).toBe(true);
    expect(
      (await (await second.get("/api/data")).json()).records.parties,
    ).toEqual([expect.objectContaining({ name: "Persistent customer" })]);
    expect((await auth(second, { action: "logout" })).ok()).toBe(true);
    expect((await second.get("/api/auth")).status()).toBe(401);
    const recover=async(next:string)=>{
      const contact={email};
      expect((await customer(second,{action:"recoverEmail",...contact})).ok()).toBe(true);
      expect((await customer(second,{action:"checkRecoveryEmail",...contact,code:await code("recovery")})).ok()).toBe(true);
      expect((await customer(second,{action:"resetPassword",password:next,confirm:next})).ok()).toBe(true);
      expect((await second.get("/api/auth")).status()).toBe(401);
    };
    await recover(replacement);
    expect((await auth(second,{action:"email",password})).ok()).toBe(false);
    expect((await auth(second,{action:"email",password:replacement})).ok()).toBe(true);
    expect(await (await second.get("/api/auth")).json()).toEqual(canonical);
    expect((await (await second.get("/api/workspaces")).json())[0].id).toBe(id);
    expect((await (await second.get("/api/data")).json()).records.parties).toEqual([expect.objectContaining({name:"Persistent customer"})]);
    await auth(second,{action:"logout"});
    const otherEmail="tilebook-"+randomUUID()+"@example.test";await enroll(second,otherEmail);
    const otherWorkspace=await second.post("/api/workspaces",{data:{...profile,name:"Second test shop"}});
    expect(otherWorkspace.ok()).toBe(true);
    expect((await otherWorkspace.json()).id).not.toBe(id);
    expect((await (await second.get("/api/data")).json()).records.parties).toEqual([]);
    expect((await second.get("/api/data?businessId="+id)).status()).toBe(403);
    expect((await second.post("/api/data",{data:{businessId:id,resource:"parties",action:"create",data:{name:"Denied"}}})).status()).toBe(403);
  } finally {
    await second.dispose();
  }
});
