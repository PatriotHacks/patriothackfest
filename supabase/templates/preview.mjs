import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { statusUpdateHtml } from "../../packages/email/src/status-update.ts";

const dir = dirname(fileURLToPath(import.meta.url));
const out = join(dir, ".preview");
mkdirSync(out, { recursive: true });

function write(name, html) {
  const target = join(out, name);
  writeFileSync(target, html);
  console.log(target);
}

for (const name of ["confirmation.html", "magic_link.html"]) {
  write(name, readFileSync(join(dir, name), "utf8").replaceAll("{{ .Token }}", "482913"));
}

write(
  "status-update.html",
  statusUpdateHtml(
    [
      "Hi Alex,",
      "There&#39;s an update on your application for Patriot HackFest Fall 2026. Sign in to the portal to see your current status.",
    ],
    "https://app.patriothackfest.com",
  ),
);
