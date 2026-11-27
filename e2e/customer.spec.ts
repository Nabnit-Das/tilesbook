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
  const phone = process.env.TILEBOOK_TEST_CUSTOMER_PHONE || "9000000091";
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
  const register = {
    action: "register",
    password,
    confirm: password,
    fullName: "Test Owner",
    terms: true,
    privacy: true,
    phone,
  };
  expect((await auth(page.request, register)).ok()).toBe(true);
  expect((await auth(page.request, { action: "email", password })).ok()).toBe(
    false,
  );
  expect(
    (
      await auth(page.request, {
        action: "confirm",
        otp: await code("verification"),
      })
    ).ok(),
  ).toBe(true);
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
  expect(
    (await page.request.post("/api/workspaces", { data: profile })).ok(),
  ).toBe(false);
  expect((await auth(page.request, { action: "linkPhone", phone })).ok()).toBe(
    true,
  );
  expect(
    (
      await auth(page.request, { action: "confirmPhone", phone, otp: "483216" })
    ).ok(),
  ).toBe(true);
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
    expect((await auth(second, register)).ok()).toBe(true);
    expect((await auth(second, { action: "forgot" })).ok()).toBe(true);
    expect(
      (
        await auth(second, {
          action: "reset",
          otp: await code("recovery"),
          password: replacement,
          confirm: replacement,
        })
      ).ok(),
    ).toBe(true);
    expect(
      (await auth(second, { action: "email", password: replacement })).ok(),
    ).toBe(true);
    await auth(second, { action: "logout" });
    expect((await auth(second, { action: "send", phone })).ok()).toBe(true);
    expect(
      (await auth(second, { action: "verify", phone, otp: "483216" })).ok(),
    ).toBe(true);
    expect(
      (await (await second.get("/api/data")).json()).records.parties,
    ).toEqual([expect.objectContaining({ name: "Persistent customer" })]);
    await auth(second, {action:"logout"});
    const otherEmail="tilebook-"+randomUUID()+"@example.test";
    const otherPhone=process.env.TILEBOOK_TEST_OTHER_PHONE||"9000000092";
    const other=(values:object)=>second.post("/api/auth",{data:{email:otherEmail,...values}});
    expect((await other({...register,phone:otherPhone})).ok()).toBe(true);
    expect((await other({action:"confirm",otp:await code("verification",otherEmail)})).ok()).toBe(true);
    expect((await other({action:"linkPhone",phone:otherPhone})).ok()).toBe(true);
    expect((await other({action:"confirmPhone",phone:otherPhone,otp:"483216"})).ok()).toBe(true);
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
