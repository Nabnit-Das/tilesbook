import { it, expect } from "vitest";
import { openEmbedded, asUser } from "../src/server/embedded";
it("recovers an exported file using its tenant proof and verifies confirmation, integrity and role", async () => {
  const db = await openEmbedded();
  try {
    const b = "10000000-0000-4000-8000-000000000001",
      owner = "00000000-0000-4000-8000-000000000001",
      counter = "00000000-0000-4000-8000-000000000002";
    const call = (
      user: string,
      file: string | null = null,
      confirmed: boolean | null = false,
    ) =>
      asUser(db, user, (tx) =>
        tx.query<{ f: string }>("select tilebook_backup_file($1,$2,$3) f", [
          b,
          file,
          confirmed,
        ]),
      );
    const file = (await call(owner)).rows[0].f;
    const doc = JSON.parse(file);
    await expect(call(counter)).rejects.toThrow();
    await expect(call(owner, file)).rejects.toThrow();
    await expect(call(owner, file, null)).rejects.toThrow();
    await expect(
      call(owner, JSON.stringify({ ...doc, data: {} }), true),
    ).rejects.toThrow();
    await expect(
      call(owner, JSON.stringify({ ...doc, businessId: counter }), true),
    ).rejects.toThrow();
    await db.query("delete from tilebook.archives where id=$1", [
      doc.archiveId,
    ]);
    expect((await call(owner, file, true)).rows[0].f).toBe("Restored");
    expect(
      (await db.query("select count(*) n from public.sale_invoices")).rows[0],
    ).toMatchObject({ n: 30 });
  } finally {
    await db.close();
  }
}, 45000);
