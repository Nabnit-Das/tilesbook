import { z } from "zod";
export const profileSchema = z
  .object({
    ownerName: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(120),
    category: z.enum(["tiles", "sanitary", "marble", "mixed"]),
    gstStatus: z.enum(["registered", "unregistered"]),
    gstin: z.string().trim().toUpperCase().max(15).default(""),
    address: z.string().trim().min(1).max(400),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(80),
    pin: z.string().regex(/^[1-9]\d{5}$/),
    phone: z.string().regex(/^(?:\d{10})?$/).optional(),
    financialYear: z.string().regex(/^20\d{2}$/),
    language: z.enum(["en", "hi", "or"]),
  })
  .strict()
  .refine(
    (v) =>
      v.gstStatus === "unregistered" ||
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v.gstin),
  );
