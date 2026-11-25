import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import {profileSchema} from './onboarding';
import { identity, localRequest } from "./identity";
import { asUser, embeddedDatabase } from "./embedded";
import type { Json, MutationResult, Snapshot } from "../types/database";
import type { Database } from "../types/generated";
type Functions = Database["public"]["Functions"];
type Operation =
  | "tilebook_snapshot"
  | "tilebook_mutate"
  | "tilebook_new_business"
  | "tilebook_workspaces" | "tilebook_onboard" | "tilebook_revoke_staff" | "tilebook_prepare_messages" | "tilebook_backup_file";
export type {
  Row,
  Json,
  Business,
  Role,
  MutationResult,
  Snapshot,
} from "../types/database";

const mutation = z
  .object({
    businessId: z.uuid().optional(),
    requestId: z.uuid().optional(),
    expectedUser:z.uuid().optional(),
    resource: z.string().regex(/^[a-z][A-Za-z]{1,40}$/),
    action: z.enum(["create", "update", "restore"]).default("create"),
    data: z.record(z.string(), z.json()),
  })
  .strict();
const businessInfo = z
  .object({
    name: z.string().trim().min(1).max(120),
    state: z.string().trim().min(1).max(80),
    address: z.string().max(400).default(""),
  })
  .strict();
function supabase(token?: string) {
  const url = z.url().parse((process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL));
  const key = z
    .string()
    .min(1)
    .parse(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(token
      ? { global: { headers: { Authorization: "Bearer " + token } } }
      : {}),
  });
}
export async function health(): Promise<void> {
  if (await localRequest()) {
    await (await embeddedDatabase()).query("select 1");
    return;
  }
  const { error } = await supabase().rpc("tilebook_health");
  if (error) throw new Error("Database connection unavailable");
}
async function invoke<F extends Operation>(
  fn: F,
  params: Functions[F]["Args"], expectedUser?:string,
): Promise<Functions[F]["Returns"]> {
  const user = await identity();
  if(expectedUser && user.id!==expectedUser)throw new Error('Session identity changed');
  if (!user?.id) throw new Error("Sign in required");
  if (await localRequest()) {
    const db = await embeddedDatabase();
    return asUser(db, user.id, async (tx) => {
      if (fn === "tilebook_snapshot")
        await tx.query("select public.tilebook_accept_invites()");
      const placeholders = Object.keys(params)
        .map((name, index) => name + " => $" + (index + 1))
        .join(", ");
      const result = await tx.query<{ data: Functions[F]["Returns"] }>(
        "select public." + fn + "(" + placeholders + ") as data",
        Object.values(params).map((v) =>
          typeof v === "object" && v !== null ? JSON.stringify(v) : v,
        ),
      );
      return result.rows[0].data;
    });
  }
  if (!user.token) throw new Error("Sign in required");
  const db = supabase(user.token);
  if (fn === "tilebook_snapshot") {
    const { error } = await db.rpc("tilebook_accept_invites");
    if (error) throw new Error(error.message);
  }
  const { data, error } = await db.rpc(fn, params);
  if (error) throw new Error(error.message);
  return data as Functions[F]["Returns"];
}
export async function getPortal(token: string): Promise<Json> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  if (await localRequest()) {
    const db = await embeddedDatabase();
    return db.transaction(async (tx) => {
      await tx.exec("set local role anon");
      return (
        await tx.query<{ data: Json }>(
          "select public.tilebook_portal($1) as data",
          [token],
        )
      ).rows[0].data;
    });
  }
  const { data, error } = await supabase().rpc("tilebook_portal", {
    p_token: token,
  });
  if (error) throw new Error("Portal unavailable");
  return data as Json;
}
export function newBusiness(input: unknown): Promise<string> {
  const value = businessInfo.parse(input);
  return invoke("tilebook_new_business", {
    p_name: value.name,
    p_state: value.state,
    p_address: value.address,
  });
}
export async function prepareMessages(input: unknown) {
  const { businessId } = z
    .object({ businessId: z.uuid() })
    .strict()
    .parse(input);
  const value = await invoke("tilebook_prepare_messages", {
    p_business_id: businessId,
  });
  return z
    .object({
      queued: z.number().int().nonnegative(),
      reminders: z.number().int().nonnegative(),
    })
    .parse(value);
}
export async function getSnapshot(businessId?: string): Promise<Snapshot> {
  const params = businessId
    ? { p_business_id: z.uuid().parse(businessId) }
    : {};
  return (await invoke("tilebook_snapshot", params)) as unknown as Snapshot;
}
export async function mutate(input: unknown): Promise<MutationResult> {
  const v = mutation.parse(input);
  const businessId = v.businessId ?? (await getSnapshot()).business.id;
  return (await invoke("tilebook_mutate", {
    p_business_id: businessId,
    p_resource: v.resource,
    p_action: v.action,
    p_data: v.data,
    p_request_id: v.requestId ?? randomUUID(),
  },v.expectedUser)) as unknown as MutationResult;
}

export async function workspaces(){return z.array(z.object({id:z.uuid(),name:z.string()})).parse(await invoke("tilebook_workspaces",{}));}
export function onboard(input:unknown){return invoke("tilebook_onboard",{p_profile:profileSchema.parse(input)});}
export function revokeStaff(businessId:string,invitation:string){return invoke("tilebook_revoke_staff",{p_business_id:businessId,p_invitation:invitation});}
export function backupFile(businessId:string,file?:string){return invoke("tilebook_backup_file",{p_business_id:businessId,p_confirm:file!==undefined,...(file===undefined?{}:{p_file:file})});}
