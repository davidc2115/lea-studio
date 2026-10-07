const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const assert = require("node:assert/strict");

const source = fs.readFileSync(
  path.join(__dirname, "..", "public", "image-provider-models.js"),
  "utf8"
);
const context = { window: {} };
vm.createContext(context);
vm.runInContext(source, context);
const models = context.window.LeaImageProviderModels;

test("provider catalogs keep official FLUX identifiers in their own namespace", () => {
  assert.deepEqual(
    Array.from(models.catalog.cloudflare, (model) => model.id),
    [
      "@cf/black-forest-labs/flux-2-dev",
      "@cf/black-forest-labs/flux-2-klein-9b",
      "@cf/black-forest-labs/flux-2-klein-4b",
    ]
  );
  assert.deepEqual(
    Array.from(models.catalog.pollinations, (model) => model.id),
    ["black-forest-labs/flux.2-klein-4b", "black-forest-labs/flux.1-schnell"]
  );
  assert.equal(models.catalog.pollinations[0].acceptsReference, true);
  assert.equal(models.catalog.pollinations[1].acceptsReference, false);
});

test("Horde version matching does not mislabel a generic model as a numbered release", () => {
  const horde = models.catalog.horde;
  const juggernaut9 = horde.find((model) => model.label === "Juggernaut XL v9");
  const genericJuggernaut = horde.find((model) => model.label.includes("version non précisée") && model.label.startsWith("Juggernaut"));
  const realVision6 = horde.find((model) => model.label === "Realistic Vision V6");

  assert.equal(juggernaut9.match.test("Juggernaut XL"), false);
  assert.equal(genericJuggernaut.match.test("Juggernaut XL"), true);
  assert.equal(realVision6.match.test("Realistic Vision"), false);
});

test("optimized FLUX prompt keeps the requested scene and exact morphology", () => {
  const prompt = models.buildFluxPrompt(
    "walking through the selected kitchen, wearing a red dress, NOT a studio portrait",
    "hazel eyes, long dark hair, NOT blonde",
    "slim hourglass figure, A-cup breasts"
  );
  assert.match(prompt, /selected kitchen/);
  assert.match(prompt, /red dress/);
  assert.match(prompt, /hazel eyes/);
  assert.match(prompt, /slim hourglass figure/);
  assert.match(prompt, /A-cup breasts/);
  assert.doesNotMatch(prompt, /NOT studio portrait|NOT blonde/);
});

test("duo FLUX prompt keeps exactly two people and independent left/right morphologies", () => {
  const prompt = models.buildFluxPrompt(
    "(2girls:1.9), LEFT A-cup breasts, RIGHT H-cup breasts, different hair",
    "",
    "",
    { isDuo: true }
  );
  assert.match(prompt, /exactly two distinct adult women/);
  assert.match(prompt, /LEFT A-cup breasts/);
  assert.match(prompt, /RIGHT H-cup breasts/);
  assert.match(prompt, /morphologies separate/);
  assert.doesNotMatch(prompt, /one adult woman/);
});
