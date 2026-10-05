import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
let narrativeApi;
function getApi() {
  if (narrativeApi) return narrativeApi;
  const context = vm.createContext({ window: {} });
  const index = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
  for (const [, file] of index.matchAll(/src="((?:characters[^"/]*|scenario-library|role-[^"/]+)\.js)"/g)) {
    vm.runInContext(fs.readFileSync(path.join(publicDir, file), "utf8"), context, { filename: file, timeout: 1000 });
  }
  narrativeApi = context.window.LeaRoleNarratives;
  if (!narrativeApi) throw new Error("Le catalogue de scénarios par rôle n'a pas été chargé.");
  return narrativeApi;
}

export function applyRoleNarratives(characters) {
  const api = getApi();
  const builtInIds = new Set(api.catalog().map(c => c.id));
  // Never rewrite imported or user-created cards as a side effect of a catalog update.
  api.apply(characters.filter(c => c && builtInIds.has(c.id)));
  return characters;
}

export function roleNarrativeInstructions(character) {
  return getApi().instructions(character);
}
