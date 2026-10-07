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
const appSource = fs.readFileSync(
  path.join(__dirname, "..", "public", "app.js"),
  "utf8"
);
const identityStart = appSource.indexOf("function profileAppearanceField(");
const identityEnd = appSource.indexOf("\n\nfunction physicalLocksFromText", identityStart);
assert(identityStart >= 0 && identityEnd > identityStart, "character identity prompt helpers are available");
vm.runInContext(appSource.slice(identityStart, identityEnd), context);

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

test("round and very-round descriptors override stale slim fields while preserving the declared cup", () => {
  const fixtures = [
    {
      tag: "ronde",
      expected: /full-figured softly rounded body/,
      notExpected: /very full-bodied plus-size/,
    },
    {
      tag: "très ronde",
      expected: /very full-bodied plus-size figure with a prominent soft rounded abdomen/,
      notExpected: /slim|slender|narrow waist|petite frame/i,
    },
  ];

  for (const fixture of fixtures) {
    const card = {
      id: "solo_" + fixture.tag.replace(/\s+/g, "_"),
      appearance: [
        "Cheveux : châtains.",
        "Corps et silhouette : silhouette mince et élancée : taille fine, peu de volume.",
        "Poitrine : bonnet B.",
        "Fiche body : full-figured body, soft belly, wide hips, thick thighs, small B-cup breasts, petite slim frame",
      ].join("\n"),
      body: "full-figured body, soft belly, wide hips, thick thighs, small B-cup breasts, petite slim frame",
      looks_en: "full-figured body, soft belly, wide hips, thick thighs, small B-cup breasts, slim slender body",
      tags: [fixture.tag, "bonnet B"],
    };

    normalizeCard(card);

    const normalized = [
      card.appearance,
      card.body,
      card.looks_en,
      card.morphology_en,
      ...card.tags,
    ].join(" ");
    assert.match(card.morphology_en, fixture.expected);
    assert.doesNotMatch(card.morphology_en, fixture.notExpected);
    assert.match(card.morphology_en, /B-cup breasts/);
    assert.match(card.appearance, /Corps et silhouette : silhouette/);
    assert.match(card.appearance, /Poitrine : bonnet B/);
    assert(card.tags.includes(fixture.tag));
    assert.doesNotMatch(normalized, /slim|slender|narrow waist|petite frame/i);
  }
});

test("a small cup does not turn a round body into a slim frame in the identity prompt", () => {
  const card = {
    id: "solo_round_small_cup",
    name: "Maëlys Park",
    age: 24,
    tags: ["très ronde", "bonnet B"],
    appearance: "Corps et silhouette : silhouette mince et élancée.\nPoitrine : bonnet B.",
    body: "very plus-size chubby body, soft belly, wide hips, thick thighs, small B-cup breasts",
    looks_en: "very plus-size chubby body, soft belly, wide hips, thick thighs, small B-cup breasts",
  };

  const prompt = context.buildCharacterIdentityBlock(card);

  assert.match(prompt, /small B-cup breasts/);
  assert.match(prompt, /very full-bodied plus-size body/);
  assert.doesNotMatch(prompt, /slim petite frame|narrow chest/);
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

test("D-through-J morphology normalization describes the declared visible bust volume", () => {
  const cues = {
    D: /full D-cup breasts with clearly visible natural projection and rounded volume/,
    E: /prominent full E-cup breasts with clearly visible natural projection and rounded volume/,
    F: /large full F-cup breasts with pronounced natural projection and rounded volume/,
    G: /very large heavy G-cup breasts with clear natural projection and visibly full volume/,
    H: /huge heavy H-cup breasts with natural weight and clearly visible projection/,
    I: /enormous heavy I-cup breasts with clearly visible natural projection and rounded volume/,
    J: /massive extremely heavy J-cup breasts with clearly visible natural volume and strong projection/,
  };

  for (const cup of ["D", "E", "F", "G", "H", "I", "J"]) {
    const card = {
      id: "normalized_cup_" + cup.toLowerCase(),
      appearance: `Poitrine : 95${cup} / bonnet ${cup}.`,
      body: `${cup}-cup breasts`,
      tags: [],
    };
    normalizeCard(card);

    assert.equal(context.window.LeaProfileMorphology.explicitBandCup(card), `95${cup}`);
    assert.match(card.morphology_en, cues[cup]);
    assert.match(card.appearance, new RegExp(`Poitrine : 95${cup} / bonnet ${cup}`));
  }
});

