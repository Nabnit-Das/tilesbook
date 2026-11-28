import { writeFileSync, mkdirSync } from "node:fs";
import { exec } from "./cli.mjs";

const out = exec(
  "npx",
  [
    "supabase",
    "gen",
    "types",
    "typescript",
    "--local",
    "--schema",
    "public"
  ],
  {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 8e6
  },
).stdout;

if (!out.includes("export type Database"))
  throw new Error("Expected generated database types.");

mkdirSync("src/types", { recursive: true });

writeFileSync("src/types/generated.ts", out);