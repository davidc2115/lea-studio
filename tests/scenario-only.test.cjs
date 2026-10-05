const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { test } = require("node:test");

const dir = process.argv[2] || path.join(__dirname, "..", "public");
const read = name => fs.readFileSync(path.join(dir, name), "utf8");
// This regression suite checks the intentionally limited scenario-only release.
// Photo releases have separate identity, composition and gallery-protection suites.
const scenarioOnlyScope = {
  skip: read("index.html").includes('src="profile-head-segmentation.js"')
    ? "Scenario-only release checks; this package includes the photo renderer."
    : false,
};
const groups = ["CAST", "EXTRA_CAST", "LEA_CAST_NEW", "LEA_CAST_SPECIAL", "LEA_CAST_DIRECT", "LEA_CAST_CUPS", "LEA_CAST_COLLEGUES", "LEA_CAST_TAQUIN"];
const collect = ctx => [...new Map(groups.flatMap(k => ctx.window[k] || []).map(c => [c.id, c])).values()];
function setup() {
  const values = new Map();
  const ctx = { window: {}, console, location: { protocol: "file:", hostname: "", href: "file:///android_asset/www/index.html" },
    localStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) } };
  vm.createContext(ctx);
  for (const [, file] of read("index.html").matchAll(/src="(characters[^"/]*\.js)"/g)) vm.runInContext(read(file), ctx);
  return { ctx, values };
}
function unchangedFields(c) {
  const copy = { ...c };
  for (const field of ["scenario", "greeting", "scenario_legacy", "greeting_legacy", "scenario_version"]) delete copy[field];
  return JSON.stringify(copy);
}

test("818 distinct plots and openings change only story fields, never photo or identity settings", scenarioOnlyScope, () => {
  const { ctx, values } = setup();
  const before = collect(ctx);
  assert.equal(before.length, 818);
  const originals = new Map(before.map(c => [c.id, { fields: unchangedFields(c), scenario: c.scenario, greeting: c.greeting }]));
  values.set("lea.chats", "existing-conversations");
  values.set("lea.gallery", "existing-photos");
  vm.runInContext(read("scenario-library.js"), ctx);
  const after = collect(ctx);
  const plots = new Set(), openings = new Set();
  assert.equal(after.length, 818);
  for (const c of after) {
    assert.equal(unchangedFields(c), originals.get(c.id).fields, c.id + ": unrelated field changed");
    assert.equal(c.scenario_legacy, originals.get(c.id).scenario);
    assert.equal(c.greeting_legacy, originals.get(c.id).greeting);
    assert.match(c.scenario, /Lieu :/);
    const normalized = c.scenario.slice(c.scenario.indexOf("Lieu :")).split(c.name).join("[NOM]");
    plots.add(normalized);
    openings.add(c.greeting.split(c.name).join("[NOM]"));
  }
  assert.equal(plots.size, 818);
  assert.equal(openings.size, 818);
  assert.equal(values.get("lea.chats"), "existing-conversations");
  assert.equal(values.get("lea.gallery"), "existing-photos");
  const kenza = after.find(c => c.id === "cup_babysitter_07");
  assert.match(kenza.body, /A-cup/);
  assert.match(kenza.scenario, /tram.*annul/);
  assert.match(kenza.scenario, /babyphone/);
});

test("Native registry exposes every updated character, including all 120 playful characters", scenarioOnlyScope, async () => {
  const { ctx } = setup();
  vm.runInContext(read("scenario-library.js"), ctx);
  vm.runInContext(read("native-api.js"), ctx);
  const native = await ctx.window.leaNativeApi("/api/characters");
  assert.equal(native.length, 818);
  for (const c of collect(ctx)) {
    const exposed = native.find(item => item.id === c.id);
    assert(exposed, c.id);
    assert.equal(exposed.scenario, c.scenario);
    assert.equal(exposed.greeting, c.greeting);
  }
});

test("Scenario-only package does not load the experimental photo module", scenarioOnlyScope, () => {
  const index = read("index.html");
  assert(index.includes('src="scenario-library.js"'));
  assert(!index.includes("profile-composition.js"));
  assert(!read("app.js").includes("LEA_ENABLE_EXPERIMENTAL_FACE_MASK"));
  assert(!read("native-api.js").includes("profile_face_mask"));
});
