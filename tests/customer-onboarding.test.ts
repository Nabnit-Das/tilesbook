import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, it, expect } from "vitest";
import { openEmbedded, asUser } from "../src/server/embedded";
import { profileSchema } from "../src/server/onboarding";
import { demoAllowed } from "../src/server/auth-policy";
import {customerInput} from "../src/server/customer-input";
const owners = [randomUUID(), randomUUID(), randomUUID()],
  staff = randomUUID();
const profile = {
  name: "Customer Tiles",
  category: "tiles",
  state: "Odisha",
  city: "Cuttack",
  pin: "753001",
  phone: "9000000011",
  ownerName: "Test Owner",
  language: "or",
  financialYear: "2026",
  address: "Test Road",
  gstStatus: "unregistered",
};
let db: Awaited<ReturnType<typeof openEmbedded>>;
beforeAll(async () => {
  db = await openEmbedded();
  await db.exec(
    "alter table auth.users add column if not exists email text, add column if not exists email_confirmed_at timestamptz",
  );
  for (const [i, id] of [...owners, staff].entries())
    await db.query(
      "insert into auth.users(id,phone,phone_confirmed_at,email,email_confirmed_at) values($1,$2,now(),$2||'@example.test',now())",
      [id, "91900000001" + i],
    );
}, 45000);
afterAll(async () => {
  await db?.close();
});
const rpc = (who: string, sql: string, params: unknown[] = []) =>
  asUser(
    db,
    who,
    async (tx) =>
      (await tx.query<{ v: unknown }>("select " + sql + " v", params)).rows[0]
        .v,
  );
const onboard = (id: string, data: object = profile) =>
  rpc(id, "tilebook_onboard($1)", [JSON.stringify(data)]);
it("creates three isolated empty workspaces and returns the original on concurrent retry", async () => {
  const [a, again, b, c] = await Promise.all([
    onboard(owners[0]),
    onboard(owners[0]),
    onboard(owners[1]),
    onboard(owners[2]),
  ]);
  expect(a).toBe(again);
  expect(new Set([a, b, c]).size).toBe(3);
  await db.exec(
    "alter table auth.users add column if not exists email text, add column if not exists email_confirmed_at timestamptz",
  );
  for (const [i, id] of [a, b, c].entries()) {
    expect(await rpc(owners[i], "tilebook_workspaces()")).toEqual([
      { id, name: profile.name },
    ]);
    expect(await rpc(owners[i], "tilebook_snapshot($1)", [id])).toMatchObject({
      role: "Owner",
      records: { saleInvoices: [], parties: [], products: [] },
    });
    await expect(
      rpc(owners[(i + 1) % 3], "tilebook_snapshot($1)", [id]),
    ).rejects.toThrow(/denied/);
    await expect(
      rpc(owners[(i + 1) % 3], "tilebook_mutate($1,'parties','create',$2,$3)", [
        id,
        '{"name":"Foreign"}',
        randomUUID(),
      ]),
    ).rejects.toThrow(/denied/);
  }
});
it("rejects invalid onboarding atomically and honors verified staff invitations and revocation", async () => {
  await expect(onboard(staff, { ...profile, pin: "x" })).rejects.toThrow();
  expect(await rpc(staff, "tilebook_workspaces()")).toEqual([]);
  const b = await onboard(owners[0]);
  const invited = (await rpc(
    owners[0],
    "tilebook_mutate($1,'users','create',$2,$3)",
    [
      b,
      JSON.stringify({
        name: "Counter",
        phone: "919000000013",
        role: "Counter",
      }),
      randomUUID(),
    ],
  )) as { row: { id: string } };
  expect(await onboard(staff)).toBe(b);
  expect(await rpc(staff, "tilebook_snapshot($1)", [b])).toMatchObject({
    role: "Counter",
    records: { purchaseBills: [] },
  });
  await expect(
    rpc(staff, "tilebook_revoke_staff($1,$2)", [b, invited.row.id]),
  ).rejects.toThrow();
  await rpc(owners[0], "tilebook_revoke_staff($1,$2)", [b, invited.row.id]);
  expect(await rpc(staff, "tilebook_workspaces()")).toEqual([]);
  await expect(rpc(staff, "tilebook_snapshot($1)", [b])).rejects.toThrow(
    /denied/,
  );
});
it("requires verified identity even when a database role is authenticated", async () => {
  const id = randomUUID();
  await db.query("insert into auth.users(id) values($1)", [id]);
  await expect(onboard(id)).rejects.toThrow(/Verified/);
});
it("admits an email-verified owner without a phone and rejects a phone-only identity", async () => {
  for (const emailOnly of [true, false]) {
    const id = randomUUID();
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at,phone,phone_confirmed_at) values($1,$2,$3,$4,$5)",
      [
        id,
        id + "@example.test",
        emailOnly ? new Date() : null,
        emailOnly ? null : "919777777777",
        emailOnly ? null : new Date(),
      ],
    );
    if(emailOnly){expect(await onboard(id)).toBeTruthy();}
    else {await expect(onboard(id)).rejects.toThrow(/Verified email/);expect(await rpc(id,"tilebook_workspaces()")).toEqual([]);}
  }
});
it("uses protected enrollment state until both contacts and a subsequent password change",async()=>{
 const who=randomUUID();await db.exec("alter table auth.users add column if not exists encrypted_password text");
 await db.query("insert into auth.users(id,phone,phone_confirmed_at,encrypted_password) values($1,'919777777779',now(),'initial-hash')",[who]);
 await expect(db.query("update auth.users set encrypted_password='too-early' where id=$1",[who])).rejects.toThrow(/Verify your email/);
 await db.query("update auth.users set email='verified@example.test', email_confirmed_at=now(),raw_user_meta_data=$2 where id=$1",[who,JSON.stringify({tilebook_password_pending:false})]);
 await expect(onboard(who)).rejects.toThrow(/Set a password/);
 await db.query("update auth.users set encrypted_password='after-proof' where id=$1",[who]);
 expect(await onboard(who)).toBe(await onboard(who));
});
it("requires consent and matching passwords and validates optional GST", () => {
  const signup = {
    action: "setPassword",
    email: "test@example.com",
    password: "1234567890a",
    confirm: "1234567890a",
    fullName: "Test",
    terms: true,
    privacy: true,
    phone: "9000000011",
  };
  expect(customerInput.safeParse(signup).success).toBe(true);
  for (const change of [
    { terms: false },
    { privacy: false },
    { confirm: "typo" },
  ])
    expect(customerInput.safeParse({ ...signup, ...change }).success).toBe(false);
  expect(profileSchema.safeParse(profile).success).toBe(true);
  expect(
    profileSchema.safeParse({ ...profile, gstStatus: "registered" }).success,
  ).toBe(false);
});
it("requires a dedicated loopback listener before accepting demo headers", () => {
  expect(demoAllowed(false, true, "localhost", "localhost", false)).toBe(false);
  expect(demoAllowed(true, true, "localhost", null, true)).toBe(false);
  expect(demoAllowed(true, true, "localhost", "public.example", false)).toBe(
    false,
  );
  expect(demoAllowed(true, true, "localhost:3150", null, false)).toBe(true);
});

it("claims an email invitation only for the verified address, preserving the invited role", async()=>{
 const b=await onboard(owners[0]);
 const id=randomUUID(), email=id+"@example.test";
 await rpc(owners[0],"tilebook_mutate($1,'users','create',$2,$3)",[b,JSON.stringify({name:"Staff",email:email.toUpperCase(),role:"Godown",status:"Active",userId:owners[0]}),randomUUID()]);
 await db.query("insert into auth.users(id,email) values($1,$2)",[id,email]);
 expect(await rpc(id,"tilebook_workspaces()")).toEqual([]);
 await db.query("update auth.users set email_confirmed_at=now() where id=$1",[id]);
 expect(await rpc(id,"tilebook_workspaces()")).toEqual([{id:b,name:profile.name}]);
 expect(await rpc(id,"tilebook_snapshot($1)",[b])).toMatchObject({role:"Godown"});
});
