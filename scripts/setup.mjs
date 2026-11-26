import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { exec } from "./cli.mjs";

const [major, minor] = process.versions.node.split(".").map(Number);

if (major < 22 || (major === 22 && minor < 16)) {
  throw new Error(
    "Node.js 22.16.0 or higher is required. " +
      "Node.js 24 LTS is recommended."
  );
}

exec("npm", ["ci"]);

try {
  exec("docker", ["info"], { stdio: "ignore" });
} catch {
  throw new Error(
    "Start Docker Desktop and rerun npm run setup. " +
      "To use the embedded local demo, run npm run demo."
  );
}

exec("npx", ["supabase", "start"]);

const out = exec("npx", ["supabase", "status", "-o", "env"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
}).stdout;

const env = Object.fromEntries(
  [...out.matchAll(/^(\w+)="([^"]*)"$/gm)].map((m) => [m[1], m[2]])
);

if (!env.API_URL || !(env.ANON_KEY || env.PUBLISHABLE_KEY)) {
  throw new Error("Supabase CLI did not return local credentials.");
}

if (!existsSync(".env.local")) {
  writeFileSync(
    ".env.local",
    readFileSync(".env.example", "utf8")
      .replace(
        /^NEXT_PUBLIC_SUPABASE_URL=.*$/m,
        "NEXT_PUBLIC_SUPABASE_URL=" + env.API_URL
      )
      .replace(
        /^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*$/m,
        "NEXT_PUBLIC_SUPABASE_ANON_KEY=" +
          (env.ANON_KEY || env.PUBLISHABLE_KEY)
      )
  );
}

exec("npx", ["supabase", "migration", "up", "--local"]);
exec("npm", ["run", "db:types"]);
exec("npx", ["playwright", "install", "chromium"]);
