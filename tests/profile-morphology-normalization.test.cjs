const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const assert = require("node:assert/strict");

const source = fs.readFileSync(
  path.join(__dirname, "..", "public", "profile-morphology.js"),
  "utf8"
);
const context = { window: {} };
vm.createContext(context);
vm.runInContext(source, context);
const normalizeCard = context.window.LeaProfileMorphology.normalizeCard;

test("explicit solo chest and silhouette replace conflicting title, body, tags and legacy fiche", () => {
  const card = {
    id: "solo_regression",
    title: "Portrait · bonnet H",
    appearance: [
      "Cheveux : châtains.",
      "Poitrine : bonnet A.",
      "Corps et silhouette : silhouette sablier.",
      "Fiche body : heavy H-cup, very thin.",
    ].join("\n"),
    body: "heavy H-cup breasts, very thin",
    looks_en: "brown hair, heavy H-cup breasts, very thin",
    tags: ["bonnet H", "hourglass", "brown hair"],
  };

  normalizeCard(card);

  assert.equal(card.morphology_fr, "silhouette sablier");
  assert.match(card.morphology_en, /hourglass figure/);
  assert.match(card.morphology_en, /A-cup/);
  for (const value of [card.title, card.appearance, card.body, card.looks_en, ...card.tags]) {
    assert.doesNotMatch(value, /H-cup|bonnet H|heavy H-cup|very thin/);
  }
  assert.match(card.appearance, /Poitrine : bonnet A/);
  assert.match(card.appearance, /Fiche body : .*A-cup/);
});

test("explicit cup retains non-conflicting legacy shape when no silhouette field exists", () => {
  const card = {
    id: "solo_legacy_shape",
    appearance: "Poitrine : bonnet C.",
    body: "slim figure, medium C-cup breasts",
    tags: [],
  };

  normalizeCard(card);

  assert.match(card.morphology_en, /slim, slender figure/);
  assert.match(card.morphology_en, /C-cup/);
  assert.doesNotMatch(card.morphology_en, /medium C-cup/);
});

test("duo morphology remains untouched and is not collapsed to a solo card", () => {
  const duo = {
    id: "duo_twins",
    people: [{ cup: "A" }, { cup: "E" }],
    appearance: "Poitrine : bonnet C.\nCorps et silhouette : silhouette sablier.",
    body: "separate morphologies",
  };
  const before = JSON.stringify(duo);

  normalizeCard(duo);

  assert.equal(JSON.stringify(duo), before);
});
