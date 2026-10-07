const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { test } = require("node:test");

const app = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");

function setup() {
  const context = vm.createContext({
    window: {},
    profileScenarioText: () => "two people at home",
    pickProfileScenarioVariant: () => ({ outfit: "casual clothes", place: "the kitchen" }),
    describePlaceDetail: place => place,
    pickProfileScenePose: () => "standing together",
  });
  for (const name of ["duoProfileTraits", "buildDuoShot", "isDuoCharacter", "duoAgeHead", "duoCompositionBlock"]) {
    const match = app.match(new RegExp("function " + name + "\\([\\s\\S]*?^\\}", "m"));
    assert(match, name + " is available");
    vm.runInContext(match[0], context);
  }
  return context;
}

test("LEFT/RIGHT ages and cup sizes stay attached to their stated identities despite conflicting legacy fields", () => {
  const context = setup();
  const duo = {
    id: "duo_fixture",
    name: "Person A & Person B",
    body: "duo: Person A 46 ans bonnet D + Person B 20 ans bonnet A",
    looks_en: "(2girls:1.95), LEFT Iris 46 year old adult face long dark hair (B-cup breasts ONLY:1.9), RIGHT Ivy 20 year old adult face blonde hair (E-cup breasts ONLY:1.9), different breast sizes, NOT same age look, photorealistic",
    appearance: "Femme 1 : Person A, 46 ans, bonnet D. Femme 2 : Person B, 20 ans, bonnet A.",
  };

  const prompt = context.buildDuoShot(duo, { outfit: "blue dresses", place: "a kitchen" });
  assert.match(prompt, /LEFT woman is 46 years old/);
  assert.match(prompt, /RIGHT woman is 20 years old/);
  assert.match(prompt, /LEFT B-cup breasts/);
  assert.match(prompt, /RIGHT E-cup breasts/);
  assert.doesNotMatch(prompt, /LEFT woman is 20 years old|RIGHT woman is 46 years old/);
  assert.doesNotMatch(prompt, /LEFT D-cup breasts|RIGHT A-cup breasts/);

  const ageHead = context.duoAgeHead(duo);
  assert.match(ageHead, /LEFT age 46 and RIGHT age 20/);
  assert.doesNotMatch(ageHead, /LEFT age 20 and RIGHT age 46/);
});

test("Missing ages or bust sizes are not invented; ordered structured values only fill absent side details", () => {
  const context = setup();
  const incomplete = {
    id: "duo_incomplete",
    name: "A & B",
    looks_en: "(2girls:1.9), LEFT woman with dark curly hair, RIGHT woman with blonde hair, photorealistic",
  };
  const unknownPrompt = context.buildDuoShot(incomplete, { outfit: "shirts", place: "a room" });
  assert.doesNotMatch(unknownPrompt, /\b(?:[A-J]-cup|bonnet [A-J])\b/i);
  assert.doesNotMatch(unknownPrompt, /\b(?:18|19|2[0-9]|3[0-9]|4[0-9]) years old/);
  assert.doesNotMatch(unknownPrompt, /NOT both the same age|NOT same age/);

  const structuredFallback = {
    id: "duo_ordered",
    name: "A & B",
    body: "duo: Person A 32 ans bonnet B + Person B 21 ans bonnet F",
    looks_en: "(2girls:1.9), LEFT woman with dark hair, RIGHT woman with blonde hair, photorealistic",
  };
  const fallbackPrompt = context.buildDuoShot(structuredFallback, { outfit: "shirts", place: "a room" });
  assert.match(fallbackPrompt, /LEFT woman is 32 years old/);
  assert.match(fallbackPrompt, /RIGHT woman is 21 years old/);
  assert.match(fallbackPrompt, /LEFT B-cup breasts/);
  assert.match(fallbackPrompt, /RIGHT F-cup breasts/);

  const appearanceFallback = {
    id: "duo_appearance",
    name: "A & B",
    looks_en: "(2girls:1.9), LEFT woman with dark hair, RIGHT woman with blonde hair, photorealistic",
    appearance: "Femme 1 : Adulte A, 35 ans, bonnet C. Femme 2 : Adulte B, 24 ans, bonnet D.",
  };
  const appearancePrompt = context.buildDuoShot(appearanceFallback, { outfit: "shirts", place: "a room" });
  assert.match(appearancePrompt, /LEFT woman is 35 years old/);
  assert.match(appearancePrompt, /RIGHT woman is 24 years old/);
  assert.match(appearancePrompt, /LEFT C-cup breasts/);
  assert.match(appearancePrompt, /RIGHT D-cup breasts/);
});
