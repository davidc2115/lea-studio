const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const publicDir = process.argv[2] || path.join(__dirname, "..", "public");
const read = file => fs.readFileSync(path.join(publicDir, file), "utf8");
const files = [...read("index.html").matchAll(/src="((?:characters[^"/]*|scenario-library|role-[^"/]+)\.js)"/g)].map(match => match[1]);
function setup() {
  const storage = new Map([["lea.chats", "saved chats"], ["lea.cover.kenza", "starred reference"], ["lea.gallery", "saved photos"]]);
  const context = vm.createContext({
    window: {}, console, Date, setTimeout, clearTimeout, setInterval, clearInterval,
    location: { protocol: "file:", hostname: "" },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
  });
  for (const file of files.filter(f => !f.startsWith("role-"))) vm.runInContext(read(file), context, { filename: file });
  const groups = ["CAST", "EXTRA_CAST", "LEA_CAST_NEW", "LEA_CAST_SPECIAL", "LEA_CAST_DIRECT", "LEA_CAST_CUPS", "LEA_CAST_COLLEGUES", "LEA_CAST_TAQUIN"];
  const catalog = [...new Map(groups.flatMap(k => context.window[k] || []).map(c => [c.id, c])).values()];
  const protectedFields = c => JSON.stringify([c.id, c.name, c.age, c.appearance, c.body, c.looks_en, c.cover, c.gallery, c.outfits, c.places, c.profile_scenes]);
  const before = new Map(catalog.map(c => [c.id, protectedFields(c)]));
  for (const file of files.filter(f => f.startsWith("role-"))) vm.runInContext(read(file), context, { filename: file });
  return { context, storage, catalog, before, protectedFields };
}

test("All 818 characters get new scenarios, coherent temperaments and distinct openings", () => {
  const { catalog } = setup();
  assert.equal(catalog.length, 818);
  const plots = new Set(), openings = new Set();
  for (const c of catalog) {
    assert.equal(c.story_profile.version, "role-personalities", c.id);
    assert(Number(c.age) >= 18);
    assert(c.scenario.length < 1600, c.id);
    assert.match(c.scenario, /Lieu :/);
    assert.match(c.scenario, /Tu peux/);
    assert.match(c.personality, /Tempérament principal :/);
    assert(!/SFW|NSFW|one.shot/i.test(c.personality), c.id);
    assert.notEqual(c.scenario, c.scenario_before_role_rewrite);
    assert.notEqual(c.greeting, c.greeting_before_role_rewrite);
    plots.add(c.scenario.split(c.name).join("[NAME]"));
    openings.add(c.greeting.split(c.name).join("[NAME]"));
  }
  assert.equal(plots.size, 818);
  assert.equal(openings.size, 818);
  assert.equal(new Set(catalog.map(c => [c.story_profile.role, c.story_profile.beat, c.story_profile.obstacle].join(":"))).size, 818, "Every plot/complication pair must differ, not just the voice, name or prop.");
});

test("The rewrite never touches physical identity, photo setup, saved photos, star or chats", () => {
  const { catalog, before, protectedFields, storage } = setup();
  for (const c of catalog) assert.equal(protectedFields(c), before.get(c.id), c.id);
  assert.equal(storage.get("lea.chats"), "saved chats");
  assert.equal(storage.get("lea.cover.kenza"), "starred reference");
  assert.equal(storage.get("lea.gallery"), "saved photos");
  const kenza = catalog.find(c => c.id === "cup_babysitter_07");
  assert.match(kenza.body, /A-cup/);
  assert.match(kenza.scenario, /tram.*annul/);
  assert.match(kenza.scenario, /babyphone/);
});

test("Specific titles outrank misleading inherited tags, including every professional and fantasy role", () => {
  const { context, catalog } = setup();
  const api = context.window.LeaRoleNarratives;
  const cases = {
    "Belle-mère": "belle_mere", "Belle-fille": "belle_fille", "Belle-sœur": "belle_soeur",
    "Secrétaire": "secretaire", "Collègue": "collegue", "Tante": "tante",
    "Maman d'ami": "maman_ami", "Fille d'ami(e)": "fille_ami",
    "Infirmières": "medical", "Avocates": "lawyer", "Hôtesses": "hostess",
    "Cheffes": "chef", "Sirène": "fantasy_sirene", "Slime": "fantasy_slime",
    "Meilleure amie de ta fille": "amie_fille", "Mère et fille 18+": "family_duo",
  };
  for (const [title, role] of Object.entries(cases)) {
    assert.equal(api.roleOf({ id: "fixture", title, tags: ["belle-mère", "babysitter", "jeu"] }), role, title);
  }
  for (const c of catalog) {
    const expected = cases[String(c.title).split("·")[0].trim()];
    if (expected) assert.equal(c.story_profile.role, expected, c.id);
  }
});

test("Large role groups redistribute all eligible temperaments, with family-only boundaries", () => {
  const { catalog, context } = setup();
  const api = context.window.LeaRoleNarratives;
  for (const role of ["secretaire", "collegue", "voisine", "amie", "babysitter", "belle_mere", "belle_fille", "belle_soeur", "tante"]) {
    const chars = catalog.filter(c => c.story_profile.role === role);
    const counts = Object.keys(api.temperaments).filter(t => !chars[0].story_profile.family || !["flirt", "romantique", "exhibitionniste"].includes(t)).map(t => chars.filter(c => c.story_profile.primary === t).length);
    assert(Math.max(...counts) - Math.min(...counts) <= 1, role);
    assert(counts.every(n => n > 0), role);
  }
  for (const c of catalog.filter(c => c.story_profile.family)) {
    assert(!["flirt", "romantique", "exhibitionniste"].includes(c.story_profile.primary));
    assert.match(api.instructions(c), /Cadre familial uniquement/);
  }
  for (const c of catalog.filter(c => c.story_profile.primary === "exhibitionniste")) assert.match(c.personality, /consenti/);
});

test("Every duo has two distinct named voices and deterministic reload preserves legacy backups", () => {
  const { catalog, context } = setup();
  for (const c of catalog.filter(c => /^duo_/.test(c.id))) {
    assert.equal(c.story_profile.speakers.length, 2, c.id);
    assert.notEqual(c.story_profile.speakers[0].primary, c.story_profile.speakers[1].primary, c.id);
    for (const speaker of c.story_profile.speakers) assert(c.greeting.includes(speaker.name + " :"), c.id);
  }
  const snapshot = JSON.stringify(catalog);
  context.window.LeaRoleNarratives.apply(catalog);
  assert.equal(JSON.stringify(catalog), snapshot);
  const imported = { id: "imp_fixture", imported: true, title: "Secrétaire", age: 25, scenario: "Custom plot", personality: "Custom personality" };
  context.window.LeaRoleNarratives.apply([imported]);
  assert.equal(imported.scenario, "Custom plot");
});

test("Native API exposes every rewritten card and role prompts do not invent legacy identities", async () => {
  const { context, catalog } = setup();
  vm.runInContext(read("native-api.js"), context);
  const result = await context.window.leaNativeApi("/api/characters");
  assert.equal(result.length, 818);
  for (const c of catalog) {
    const exposed = result.find(item => item.id === c.id);
    assert.equal(exposed.scenario, c.scenario);
    assert.equal(exposed.personality, c.personality);
    assert.equal(c.tags[0], context.window.LeaRoleNarratives.temperaments[c.story_profile.primary].label.toLowerCase(), c.id + ": new temperament must be visible before truncated old tags");
    const prompt = context.window.LeaRoleNarratives.instructions(c);
    assert(prompt.includes(c.name));
    assert(prompt.includes(c.story_profile.relation));
    assert(prompt.includes(c.personality));
  }
  const native = read("native-api.js");
  assert.match(native, /PERSONA\.story_profile\s*\?\s*"TEMPÉRAMENT ACTUEL/);
  assert.match(native, /system \+= "\\n\\n" \+ window\.LeaRoleNarratives\.instructions\(PERSONA\)/);
});
