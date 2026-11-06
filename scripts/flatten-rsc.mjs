// Post-build fix for static export (Next 16.4): the router prefetches segment
// payloads as flat names (`__next.$d$lang.catalog.__PAGE__.txt`), but export
// writes them nested (`__next.$d$lang/catalog/__PAGE__.txt`). A static host
// such as Cloudflare Pages has no rewrite for that, so copy each nested file to
// the flat name beside it. Without this, client navigation still works but
// every prefetch 404s and falls back to a full page load.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("out");
let copied = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("__next.")) flatten(dir, full, entry.name);
    else walk(full);
  }
}

function flatten(routeDir, segDir, prefix) {
  for (const entry of fs.readdirSync(segDir, { withFileTypes: true })) {
    const full = path.join(segDir, entry.name);
    const name = `${prefix}.${entry.name}`;
    if (entry.isDirectory()) flatten(routeDir, full, name);
    else {
      fs.copyFileSync(full, path.join(routeDir, name));
      copied++;
    }
  }
}

if (fs.existsSync(root)) walk(root);
console.log(`flatten-rsc: ${copied} segment files`);
