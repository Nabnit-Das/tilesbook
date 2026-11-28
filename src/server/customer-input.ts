import { z } from "zod";
const email=z.string().trim().toLowerCase().pipe(z.email().max(254));
const code=z.string().regex(/^\d{6}$/);
const passwords={password:z.string().min(10).max(128),confirm:z.string().max(128)};
export const customerInput=z.discriminatedUnion("action",[
 z.object({action:z.literal("start"),email,firstName:z.string().trim().min(1).max(60),lastName:z.string().trim().min(1).max(60),company:z.string().trim().min(1).max(120),category:z.enum(["tiles","sanitary","marble","mixed"])}),
 z.object({action:z.literal("linkEmail"),email}),
 z.object({action:z.literal("verifyLink"),email,code}),
 z.object({action:z.literal("resend"),email}),
 z.object({action:z.literal("emailProof"),email,code}),
 z.object({action:z.literal("setPassword"),...passwords,terms:z.literal(true),privacy:z.literal(true)}),
 z.object({action:z.literal("recoverEmail"),email}),
 z.object({action:z.literal("checkRecoveryEmail"),email,code}),
 z.object({action:z.literal("resetPassword"),...passwords})
]).refine(v=>!("confirm" in v)||v.password===v.confirm);
