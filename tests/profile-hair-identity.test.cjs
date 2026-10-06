const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const dir = process.argv[2] || path.join(__dirname, "..", "public");
const ctx = { window: {}, console };
vm.createContext(ctx);
for (const f of fs.readdirSync(dir).filter((f) => /^characters.*\.js$/.test(f))) {
  vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), ctx);
}
const app = fs.readFileSync(path.join(dir, "app.js"), "utf8");
const from = app.indexOf("function canonicalProfileCup(");
const to = app.indexOf("function describeLooks(", from);
vm.runInContext(app.slice(from, to), ctx);
const cast = Object.values(ctx.window).filter(Array.isArray).flat().filter((c) => c && c.appearance);
const colorOf = (s) => {
  s = String(s || "").toLowerCase();
  if (/platin/.test(s)) return "blonde";
  if (/blond/.test(s)) return "blonde";
  if (/roux|rousse|ginger|\bred\b|auburn|cuivr/.test(s)) return "red";
  if (/noir|black|jais/.test(s)) return "black";
  if (/ch[aâ]tain|chestnut/.test(s)) return "brown";
  if (/brun|brown/.test(s)) return "brown";
  if (/argent|silver|blanc|white/.test(s)) return "silver";
  if (/\brose|pink/.test(s)) return "pink";
  if (/violet|purple|lavand/.test(s)) return "purple";
  if (/bleu|blue/.test(s)) return "blue";
  if (/vert|green/.test(s)) return "green";
  return "";
};
test("Hair color/style and cup always come from the card, never from scenario or outfit words", () => {
let bad = 0, total = 0;
for (const c of cast) {
  const decl = ((String(c.appearance).match(/Cheveux\s*:\s*([^\n]+)/i) || [])[1] || "").split(/\\n|\.\s|\.$/)[0];
  if (!decl) continue;
  const want = colorOf(decl);
  if (!want) continue;
  total++;
  const id = ctx.identityFromCard(c).split(",")[2];
  const pl = (ctx.physicalLocksFromText(c).positive.find((p) => /hair/.test(p) && colorOf(p)) || "");
  const a = colorOf(id), b = colorOf(pl);
  const cup = ctx.canonicalProfileCup(c);
  const cupOk = !cup || ctx.cupLock(c).pos.includes(cup + "-cup");
  if (a !== want || b !== want || !cupOk) {
    bad++;
    if (bad <= 25) console.log(c.id, "| card:", decl.trim().slice(0, 50), "| identity:", id, "| locks:", pl, cupOk ? "" : "| CUP KO " + cup);
  }
}
assert(total > 500);
assert.equal(bad, 0, "mismatch " + bad + " / " + total);
});
