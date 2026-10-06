const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const dir = process.argv[2] || path.join(__dirname, "../public");
const read = name => fs.readFileSync(path.join(dir, name), "utf8");

function setup() {
  const values = new Map([["lea.chats", "preserved"], ["lea.gallery", "preserved"], ["lea.cover.fixture", "starred"]]);
  const requests = [];
  const ctx = vm.createContext({
    window: {}, console, Date, setTimeout, clearTimeout, setInterval, clearInterval,
    location: { protocol: "file:", hostname: "", href: "file:///android_asset/www/index.html" },
    localStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) },
    fetch: async (url, opts) => {
      if (opts && opts.body) requests.push({ url, opts, body: JSON.parse(opts.body) });
      return { ok: true, status: 202, json: async () => ({ id: "wardrobe-test" }) };
    },
    cupLock: () => ({ pos: "small A-cup breasts", neg: "large breasts" }),
    physicalLocksFromText: () => ({ positive: ["slim body"], features: ["green eyes", "red hair"] }),
    expandProfileExtra: extra => extra ? { hasAny: true, overridesOutfit: true, outfitLine: extra } : {},
    profileIdentityAnchor: () => "same adult woman, green eyes, red hair, small A-cup breasts",
    pickProfileScenePose: () => "standing beside the table, face toward camera",
    pickProfileCameraAngle: () => "wide head-to-shoes view",
    isDuoCharacter: () => false,
    describeLooks: () => "green eyes, red hair, slim adult woman",
    fantasyKind: () => "",
  });
  vm.runInContext(read("profile-wardrobe.js"), ctx);
  vm.runInContext(read("profile-head-segmentation.js"), ctx);
  const app = read("app.js");
  const from = app.indexOf("function buildProfileSceneLock(");
  vm.runInContext(app.slice(from, app.indexOf("\nfunction roleSexyPick(", from)), ctx);
  const finalize = app.indexOf("function finalizeProfilePrompt(");
  vm.runInContext(app.slice(finalize, app.indexOf("\nasync function generatePhoto(", finalize)), ctx);
  return { ctx, values, requests, api: ctx.window.LeaProfileWardrobe };
}
const character = { id: "fixture", age: 28, name: "Fixture", title: "Voisine", body: "A-cup" };
const variant = { index: 2, outfit: "original outfit", place: "original living room", pose: "seated on the sofa, face toward camera", scene: { prop: "cards on the table" } };

test("Eight reference-inspired outfits preserve scenario, body, star, chats and gallery", () => {
  const { api, values } = setup();
  assert.equal(api.styles.length, 8);
  const original = JSON.stringify([character, variant]);
  for (const style of api.styles) {
    const selected = api.choose(character, variant, style.id);
    assert.equal(selected.outfit, style.outfit);
    assert.equal(selected.place, variant.place);
    assert(selected.pose.startsWith(variant.pose + ", "));
    assert.match(selected.pose, /arched|shoulders|leaning/);
    assert.equal(selected.index, variant.index);
    assert.match(selected.cameraAngle, /face toward camera/);
  }
  assert.equal(JSON.stringify([character, variant]), original);
  assert.equal(values.get("lea.chats"), "preserved");
  assert.equal(values.get("lea.gallery"), "preserved");
  assert.equal(values.get("lea.cover.fixture"), "starred");
  assert.throws(() => api.choose(character, variant, "unknown"), /inconnue/);
});

test("Automatic outfits vary without repeating the last choice and keep clinical/species wardrobe", () => {
  const { api } = setup();
  let previous;
  for (let i = 0; i < 30; i++) {
    const selected = api.choose(character, variant);
    assert.notEqual(selected.wardrobeStyle, previous);
    previous = selected.wardrobeStyle;
  }
  for (const title of ["Infirmière", "Sirène", "Kitsune", "Elfe"]) {
    assert.equal(api.choose({ ...character, title }, variant).outfit, variant.outfit);
  }
  const tail = api.choose({ ...character, title: "Sirène" }, variant, "mini-boots");
  assert.doesNotMatch(tail.outfit, /boots/);
  assert.match(tail.outfit, /species tail/);
  assert.equal(api.choose(character, variant, "scenario").outfit, variant.outfit);
});

test("The authoritative scene lock keeps every selected outfit, including lace and open necklines", () => {
  const { ctx, api } = setup();
  for (const native of [false, true]) {
    ctx.window.LeaAndroid = native ? { prepareSegmentedProfileHead() {} } : undefined;
    for (const style of api.styles) {
      const selected = api.choose(character, variant, style.id);
      const lock = ctx.buildProfileSceneLock(character, selected, "");
      assert(lock.includes(style.outfit), style.id + ": lost selected wardrobe");
      assert.match(lock, /A.cup/i);
      assert.match(lock, /green eyes/);
      assert.doesNotMatch(lock, /fully closed|opaque closed/);
      assert(lock.length <= 920);
      const custom = ctx.buildProfileSceneLock(character, selected, "blue cotton blouse and white trousers");
      assert.match(custom, /blue cotton blouse and white trousers/);
      assert(!custom.includes(style.outfit));
    }
  }
});

test("Finalization does not replace selected clothing or ban lace bodysuits", () => {
  const { ctx, api } = setup();
  for (const style of api.styles) {
    const selected = api.choose(character, variant, style.id);
    const request = {};
    ctx.finalizeProfilePrompt(request, character, selected);
    assert(request.prompt.includes(style.outfit), style.id);
    assert.match(request.prompt, /green eyes/);
    assert.doesNotMatch(request.negative, /lingerie only|bra only|underwear|cleavage/);
  }
});

test("Duo generation uses the selected wardrobe without switching to a solo portrait", () => {
  const { ctx, api } = setup();
  const source = read("app.js"), from = source.indexOf("function buildDuoShot(");
  vm.runInContext(source.slice(from, source.indexOf("\nfunction ", from + 1)), ctx);
  const scenario = source.indexOf("function profileScenarioText(");
  vm.runInContext(source.slice(scenario, source.indexOf("\nfunction pickProfileScenarioVariant(", scenario)), ctx);
  ctx.describePlaceDetail = place => place;
  ctx.isDuoCharacter = () => true;
  const duo = { ...character, id: "duo_fixture", name: "First & Second", looks_en: "two adult women, 28 and 32 years old" };
  const selected = api.choose(duo, variant, "burgundy-robe");
  const request = {};
  ctx.finalizeProfilePrompt(request, duo, selected);
  assert.equal(request.is_duo, true);
  assert(request.prompt.includes(selected.outfit));
  assert.match(request.prompt, /2girls/);
  assert.doesNotMatch(request.prompt, /exactly one real woman/);
});

test("Native Horde submission receives the selected outfit after segmented scene preparation", async () => {
  const { ctx, api, requests } = setup();
  ctx.window.LeaAndroid = { prepareSegmentedProfileHead() {} };
  for (const [, file] of read("index.html").matchAll(/src="(characters[^"/]*\.js)"/g)) vm.runInContext(read(file), ctx);
  vm.runInContext(read("native-api.js"), ctx);
  for (const id of ["lace-body", "mini-boots", "burgundy-robe"]) {
    const selected = api.choose(character, variant, id);
    const lock = ctx.buildProfileSceneLock(character, selected);
    await ctx.window.leaNativeApi("/api/image", { method: "POST", body: JSON.stringify({
      engine: "horde", charId: "lea", prompt: lock, profile_scene_lock: lock,
      is_profile_photo: true, profile_identity_lock: true, horde_anonymous: true,
      source_image: "A".repeat(1000), source_processing: "img2img", denoising: .58,
    }) });
    const sent = requests[requests.length - 1];
    assert(sent, id + ": no Horde request");
    assert(sent.body.prompt.includes(selected.outfit), id + ": actual provider lost wardrobe");
    assert.equal(sent.opts.headers.apikey, "0000000000");
    assert.equal(sent.body.censor_nsfw, false);
    assert.equal(sent.body.shared, false);
    assert.doesNotMatch(sent.body.prompt.split(" ### ")[1] || "", /underwear|cleavage|lingerie only/);
  }
});

test("Profile selector is wired before scene-lock construction and loaded in the Android frontend", () => {
  assert.match(read("index.html"), /src="profile-wardrobe.js"/);
  const app = read("app.js"), generation = app.slice(app.indexOf("async function generatePhoto("));
  assert.match(app, /id="profile-wardrobe"/);
  assert.match(app, /profile-wardrobe"\)\.onchange/);
  assert(generation.indexOf("LeaProfileWardrobe.choose") < generation.indexOf("buildProfileSceneLock"));
  assert.doesNotMatch(generation, /transparent clothes, underwear, cleavage/);
});
