// `npm run deploy`: D1 migrations, then `wrangler deploy`.
//
// Migrations run first so new code never meets an old schema. On the very
// first deploy of a fresh copy the D1 database does not exist yet
// (wrangler.jsonc has no database_id; `wrangler deploy` creates it), so the
// migration step fails with "Couldn't find a D1 DB". Then we deploy first,
// which provisions D1 and R2, and apply the migrations right after.
//
// Extra arguments are passed to both wrangler commands (e.g. `-c other.jsonc`).
import { spawnSync } from "node:child_process";

const extra = process.argv.slice(2);

function wrangler(args, capture) {
  const r = spawnSync("npx", ["wrangler", ...args, ...extra], {
    shell: true,
    encoding: "utf8",
    stdio: capture ? ["inherit", "pipe", "pipe"] : "inherit",
    env: { ...process.env, CI: process.env.CI ?? "true" },
  });
  if (capture) {
    process.stdout.write(r.stdout ?? "");
    process.stderr.write(r.stderr ?? "");
  }
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

const migrate = ["d1", "migrations", "apply", "DB", "--remote"];

const first = wrangler(migrate, true);
if (first.ok) {
  if (!wrangler(["deploy"]).ok) process.exit(1);
} else if (/Couldn't find a D1 DB/i.test(first.out)) {
  console.log("\nD1 bazası hələ yoxdur: əvvəl deploy (bazanı yaradır), sonra migration.\n");
  if (!wrangler(["deploy"]).ok) process.exit(1);
  if (!wrangler(migrate).ok) process.exit(1);
} else {
  process.exit(1);
}
