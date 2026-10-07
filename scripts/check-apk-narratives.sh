#!/usr/bin/env bash
# Vérifie les assets du paquet final en lecture seule, sans outils Android.
set -euo pipefail

if [[ $# -ne 1 || ! -f "$1" ]]; then
  echo "Usage: bash scripts/check-apk-narratives.sh chemin/vers/application.apk" >&2
  exit 1
fi

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
EXTRACTED=$(mktemp -d)
trap 'rm -rf "$EXTRACTED"' EXIT
# Contrôler exactement l'APK final destiné à l'upload, sans le modifier.
unzip -q "$1" 'assets/www/*' -d "$EXTRACTED"
WWW="$EXTRACTED/assets/www"
node - "$WWW" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const www = process.argv[2];
const expected = [
  "role-stories-family.js",
  "role-stories-work.js",
  "role-stories-social.js",
  "role-stories-fantasy.js",
  "role-temperaments.js",
  "role-narratives.js",
];
const html = fs.readFileSync(path.join(www, "index.html"), "utf8")
  .replace(/<!--[\s\S]*?-->/g, "");
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)]
  .map(match => match[1]);
for (const file of expected) {
  const asset = path.join(www, file);
  assert(fs.existsSync(asset) && fs.statSync(asset).isFile(),
    `APK incomplet : assets/www/${file} manquant`);
  assert(scripts.includes(file),
    `APK incomplet : ${file} non chargé dans assets/www/index.html`);
}
console.log("Les six scripts de scénarios sont présents et chargés dans l'APK.");
NODE
node --test-reporter=tap "$SCRIPT_DIR/../tests/role-narratives.test.cjs" "$WWW"
