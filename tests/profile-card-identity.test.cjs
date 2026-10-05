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
const from = app.indexOf("function canonicalProfileCup(");
const to = app.indexOf("function describeLooks(", from);
assert(from >= 0 && to > from, "Canonical morphology helpers must exist");
vm.runInContext(app.slice(from, to), context);
const anchorFrom = app.indexOf("function profileIdentityAnchor(");
const anchorTo = app.indexOf("function buildLeaImagePrompt(", anchorFrom);
vm.runInContext(app.slice(anchorFrom, anchorTo), context);
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
