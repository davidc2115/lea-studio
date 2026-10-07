const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const assert = require("node:assert/strict");

const sourceDir = process.argv[2] || path.join(__dirname, "..", "public");
const app = fs.readFileSync(path.join(sourceDir, "app.js"), "utf8");
const cards = fs.readFileSync(path.join(sourceDir, "characters-cups.js"), "utf8");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(cards, context);
const from = app.indexOf("function profileAppearanceField(");
const to = app.indexOf("function describeLooks(", from);
assert(from >= 0 && to > from, "Canonical morphology helpers must exist");
vm.runInContext(app.slice(from, to), context);
const anchorFrom = app.indexOf("function profileIdentityAnchor(");
const anchorTo = app.indexOf("function buildLeaImagePrompt(", anchorFrom);
vm.runInContext(app.slice(anchorFrom, anchorTo), context);
context.isDuoCharacter = () => false;
context.ageNegatives = () => "";
const morphFrom = app.indexOf("function morphWeights(");
const morphTo = app.indexOf("\n\n/** Traits OBLIGATOIRES", morphFrom);
assert(morphFrom >= 0 && morphTo > morphFrom, "Cup morphology weights must exist");
vm.runInContext(app.slice(morphFrom, morphTo), context);
const negativeFrom = app.indexOf("function bodyNegatives(");
const negativeTo = app.indexOf("\n\n/** Poids morphologie", negativeFrom);
assert(negativeFrom >= 0 && negativeTo > negativeFrom, "Body negatives must exist");
vm.runInContext(app.slice(negativeFrom, negativeTo), context);
const detailFrom = app.indexOf("function enrichLooksDetail(");
const detailTo = app.indexOf("\nfunction fixedAppearanceBlock(", detailFrom);
assert(detailFrom >= 0 && detailTo > detailFrom, "Detailed identity prompts must exist");
vm.runInContext(app.slice(detailFrom, detailTo), context);
const kenza = context.window.LEA_CAST_CUPS.find((c) => c.id === "cup_babysitter_07");

test("Kenza has a consistent A-cup card, without legacy H-cup instructions", () => {
  assert(kenza);
  assert.match(kenza.title, /bonnet A/);
  assert.match(kenza.appearance, /Poitrine : bonnet A/);
  assert.match(kenza.body, /A-cup/);
  assert.match(kenza.looks_en, /A-cup/);
  for (const text of [kenza.title, kenza.appearance, kenza.body, kenza.looks_en, ...kenza.outfits]) {
    assert.doesNotMatch(text, /H-cup|bonnet H|large breasts|poitrine généreuse|deep cleavage/);
  }
  assert.match(kenza.system_extra, /UNIQUEMENT Kenza Cisse/);
});

test("Explicit breast description beats conflicting legacy body, tags and title", () => {
  const mixed = {
    name: "Example", age: 25, appearance: "Poitrine : bonnet A.\nFiche body : huge H-cup breasts",
    body: "huge H-cup breasts", looks_en: "H-cup breasts", title: "bonnet H", tags: ["bonnet H"],
  };
  assert.equal(context.canonicalProfileCup(mixed), "A");
  assert.match(context.cupLock(mixed).pos, /A-cup/);
  const positive = context.physicalLocksFromText(mixed).positive.join(", ");
  assert.match(positive, /A-cup/);
  assert.doesNotMatch(positive, /H-cup/);
});

test("Canonical size is included before any identity prompt truncation", () => {
  const anchor = context.profileIdentityAnchor(kenza);
  assert.match(anchor.slice(0, 180), /A-cup/);
  assert.match(anchor.slice(0, 300), /blonde hair/);
  assert.match(anchor.slice(0, 300), /blue (?:eyes|iris)/);
  assert.doesNotMatch(anchor, /H-cup/);
  assert(app.includes("breast size must match the written character card, not the reference image"));
});

test("Correct C and H descriptions retain their sizes", () => {
  for (const cup of ["C", "H"]) {
    const card = { appearance: `Poitrine : bonnet ${cup}.`, body: `${cup}-cup breasts`, tags: [] };
    assert.equal(context.canonicalProfileCup(card), cup);
    assert(context.cupLock(card).pos.includes(`${cup}-cup`));
    assert(context.physicalLocksFromText(card).positive.join(", ").includes(`${cup}-cup`));
  }
});

test("Kenza variants contain her scenario prop rather than an unspecified room", () => {
  assert.equal(kenza.outfits.length, kenza.places.length);
  for (const place of kenza.places) assert.match(place, /baby monitor/i);
  assert.match(kenza.scenario, /babyphone/i);
});

test("D-to-J sizes stay visibly full through identity, morphology, and negative prompt helpers", () => {
  const cues = {
    D: /full D-cup breasts with clearly visible natural projection and rounded volume/i,
    E: /prominent full E-cup breasts with clearly visible natural projection and rounded volume/i,
    F: /large full F-cup breasts with pronounced natural projection and rounded volume/i,
    G: /very large heavy G-cup breasts with clear natural projection/i,
    H: /huge heavy H-cup breasts with natural weight and clearly visible projection/i,
    I: /enormous heavy I-cup breasts with clearly visible natural projection and rounded volume/i,
    J: /massive extremely heavy J-cup breasts with clearly visible natural volume and strong projection/i,
  };

  for (const cup of ["D", "E", "F", "G", "H", "I", "J"]) {
    const card = {
      id: "cup_size_" + cup.toLowerCase(),
      name: "Example Woman",
      age: 28,
      appearance: `Poitrine : 95${cup} / bonnet ${cup}.`,
      body: `${cup}-cup breasts`,
      looks_en: `${cup}-cup breasts`,
      tags: [],
    };
    const lock = context.cupLock(card);
    const physical = context.physicalLocksFromText(card);
    const weight = context.morphWeights(card);
    const negatives = context.bodyNegatives(card);
    const detailed = context.enrichLooksDetail(card);

    assert.match(lock.pos, new RegExp(`95${cup} bra size`, "i"));
    assert.match(lock.pos, cues[cup]);
    assert.match(weight, new RegExp(`95${cup} bra size`, "i"));
    assert.match(weight, cues[cup]);
    assert(physical.positive.some((item) => cues[cup].test(item)));
    assert(physical.features.includes(`${cup}-cup breasts`));
    assert.match(negatives, /medium breasts/);
    assert.match(negatives, /average breasts/);
    assert.match(negatives, /modest chest/);
    assert.match(detailed, cues[cup]);
    if (cup === "F") assert.doesNotMatch(detailed, /E-cup breasts/i);
  }

  const cCupNegatives = context.bodyNegatives({
    appearance: "Poitrine : bonnet C.",
    body: "medium C-cup breasts",
    tags: [],
  });
  assert.doesNotMatch(cCupNegatives, /medium breasts|average breasts|modest chest/i);
});

