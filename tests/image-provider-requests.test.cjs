const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const assert = require("node:assert/strict");

const root = path.join(__dirname, "..", "public");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

function setup() {
  const requests = [];
  const settings = {
    cfAccount: "fictional-account",
    cfToken: "fictional-token",
    cfImageModel: "@cf/black-forest-labs/flux-2-dev",
    pollinationsKey: "fictional-token",
    pollinationsModel: "black-forest-labs/flux.2-klein-4b",
  };
  const context = vm.createContext({
    window: {},
    localStorage: { getItem: () => JSON.stringify(settings) },
    readImageSettings: () => settings,
    profileIdentityAnchor: () => "SOLO-IDENTITY-MUST-NOT-LEAK-INTO-DUO",
    isDuoCharacter: (card) => Boolean(card && /^duo_/.test(card.id)),
    resolveCharacterRefB64: async () => null,
    character: () => ({ id: "solo_default" }),
    fetch: async (url, options) => {
      requests.push({ url: String(url), options });
      const response = String(url).includes("cloudflare")
        ? { success: true, result: { image: "YWJj", content_type: "image/png" } }
        : { data: [{ b64_json: "YWJj" }] };
      return { ok: true, text: async () => JSON.stringify(response) };
    },
  });
  vm.runInContext(read("image-provider-models.js"), context);
  const app = read("app.js");
  const speciesStart = app.indexOf("function fantasyKind(");
  const speciesEnd = app.indexOf("\n\nfunction roleScenePack", speciesStart);
  assert(speciesStart >= 0 && speciesEnd > speciesStart, "species prompt locks are available");
  vm.runInContext(app.slice(speciesStart, speciesEnd), context);
  const start = app.indexOf("async function nativeHttpPostJson(");
  const end = app.indexOf("\n\nasync function generatePhotoHordeFallback", start);
  assert(start >= 0 && end > start, "provider connector functions are available");
  vm.runInContext(app.slice(start, end), context);
  return { context, requests, settings };
}

test("Cloudflare and Pollinations preserve a duo scene without adding a solo identity anchor", async () => {
  const { context, requests } = setup();
  const duo = { id: "duo_sample", name: "Ana & Béa" };
  const scene = "EXACTLY TWO adult women; LEFT A-cup breasts; RIGHT H-cup breasts; shared kitchen scene";

  await context.generateCloudflareImage(scene, duo);
  const cloudflareBody = JSON.parse(requests[0].options.body);
  assert.match(requests[0].url, /@cf\/black-forest-labs\/flux-2-dev$/);
  assert.match(cloudflareBody.prompt, /exactly two distinct adult women/);
  assert.match(cloudflareBody.prompt, /LEFT A-cup breasts/);
  assert.match(cloudflareBody.prompt, /RIGHT H-cup breasts/);
  assert.doesNotMatch(cloudflareBody.prompt, /one adult woman|SOLO-IDENTITY/);

  await context.generatePollinationsImage(scene, duo, null);
  const pollinationsBody = JSON.parse(requests[1].options.body);
  assert.match(requests[1].url, /\/v1\/images\/generations$/);
  assert.match(pollinationsBody.prompt, /exactly two distinct adult women/);
  assert.match(pollinationsBody.prompt, /LEFT A-cup breasts/);
  assert.match(pollinationsBody.prompt, /RIGHT H-cup breasts/);
  assert.doesNotMatch(pollinationsBody.prompt, /one adult woman|SOLO-IDENTITY/);
});

test("Pollinations Klein uses reference edits, while its text-only FLUX alias rejects reference edits", async () => {
  const { context, requests, settings } = setup();
  const duo = { id: "duo_sample", name: "Ana & Béa" };
  const source = "A".repeat(600);

  await context.generatePollinationsImage("two women in a kitchen", duo, source);
  assert.match(requests[0].url, /\/v1\/images\/edits$/);
  const editBody = JSON.parse(requests[0].options.body);
  assert.equal(editBody.image, "data:image/jpeg;base64," + source);
  assert.match(editBody.prompt, /identity reference for both women/);

  settings.pollinationsModel = "black-forest-labs/flux.1-schnell";
  await assert.rejects(
    context.generatePollinationsImage("two women in a kitchen", duo, source),
    /FLUX ne prend pas la référence étoilée en charge/
  );
  assert.equal(requests.length, 1, "the text-only alias must fail before making a provider request");
});

test("Pollinations does not turn an unreadable starred reference into text-only generation", async () => {
  const { context, requests } = setup();
  context.resolveCharacterRefB64 = async () => {
    throw new Error("La photo étoilée est illisible.");
  };
  await assert.rejects(
    context.generatePollinationsProfileImage("two women in a kitchen", { id: "duo_sample" }),
    /photo étoilée est illisible/
  );
  assert.equal(requests.length, 0);
});

test("Cloudflare and Pollinations keep species traits and remove contradictory species features", async () => {
  const { context, requests } = setup();
  const fixtures = [
    {
      character: { id: "profile_kitsune", title: "Kitsune" },
      scene: "adult woman, fox ears, mermaid tail, fish scales, cat ears",
      expected: /kitsune|fox ears|fox tail/i,
      forbidden: /mermaid tail|fish scales|cat ears/i,
    },
    {
      character: { id: "profile_sirene", title: "Sirène" },
      scene: "adult woman, mermaid tail, horns, cat ears, fox ears",
      expected: /mermaid|fish tail/i,
      forbidden: /demon horns|cat ears|fox ears/i,
    },
    {
      character: { id: "profile_vampire", title: "Vampire" },
      scene: "adult woman, pale skin, subtle fangs, dragon horns, mermaid tail, bat wings",
      expected: /vampire woman|subtle fangs/i,
      forbidden: /dragon horns|mermaid tail|bat wings/i,
    },
  ];
  for (const fixture of fixtures) {
    const before = requests.length;
    await context.generateCloudflareImage(fixture.scene, fixture.character);
    const cf = JSON.parse(requests[before].options.body);
    assert.match(cf.prompt, fixture.expected);
    assert.doesNotMatch(cf.prompt, fixture.forbidden);

    await context.generatePollinationsImage(fixture.scene, fixture.character, null);
    const pollinations = JSON.parse(requests[before + 1].options.body);
    assert.match(pollinations.prompt, fixture.expected);
    assert.doesNotMatch(pollinations.prompt, fixture.forbidden);
  }
});
