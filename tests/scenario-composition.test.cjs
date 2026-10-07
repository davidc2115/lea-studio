const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const dir = process.argv[2] || path.join(__dirname, "..", "public");
const read = name => fs.readFileSync(path.join(dir, name), "utf8");
const keys = ["CAST", "EXTRA_CAST", "LEA_CAST_NEW", "LEA_CAST_SPECIAL", "LEA_CAST_DIRECT", "LEA_CAST_CUPS", "LEA_CAST_COLLEGUES", "LEA_CAST_TAQUIN"];
const collect = ctx => [...new Map(keys.flatMap(k => ctx.window[k] || []).map(c => [c.id, c])).values()];

function setup() {
  const values = new Map();
  const requests = [];
  const ctx = {
    window: {}, console, location: { protocol: "file:", hostname: "", href: "file:///android_asset/www/index.html" },
    setTimeout, clearTimeout, setInterval, clearInterval, Date,
    localStorage: {
      getItem: k => values.get(k) ?? null,
      setItem: (k, v) => values.set(k, String(v)),
      removeItem: k => values.delete(k),
    },
    fetch: async (url, opts) => {
      if (String(url).includes("/status/models")) {
        return { ok: true, json: async () => [{ name: "Realistic Vision", count: 1 }] };
      }
      requests.push({ url, ...opts, payload: JSON.parse(opts.body) });
      return { ok: true, status: 202, json: async () => ({ id: "test-job" }) };
    },
  };
  vm.createContext(ctx);
  for (const [, name] of read("index.html").matchAll(/src="(characters[^"/]*\.js)"/g)) {
    vm.runInContext(read(name), ctx, { filename: name });
  }
  return { ctx, requests, values };
}

test("The entire 818-character catalog gets distinct plots, without rewriting physical identities", () => {
  const { ctx } = setup();
  const before = collect(ctx);
  assert.equal(before.length, 818);
  const physical = c => JSON.stringify([c.id, c.name, c.age, c.title, c.body, c.appearance, c.looks_en, c.tags, c.cover, c.gallery]);
  const original = new Map(before.map(c => [c.id, { physical: physical(c), scenario: c.scenario, greeting: c.greeting }]));
  vm.runInContext(read("scenario-library.js"), ctx);
  const after = collect(ctx);
  assert.equal(after.length, 818);
  const normalizedPlots = new Set();
  for (const c of after) {
    assert.equal(physical(c), original.get(c.id).physical, c.id + " identity changed");
    assert.equal(c.scenario_legacy, original.get(c.id).scenario);
    assert.equal(c.greeting_legacy, original.get(c.id).greeting);
    assert.equal(c.profile_scenes.length, 3);
    assert(c.scenario.length < 1600);
    assert.match(c.scenario, /Ton choix|Ton choix|Tu|Ton|Kenza/);
    const plot = c.scenario.slice(c.scenario.indexOf("Lieu :")).replace(c.name, "[NOM]");
    normalizedPlots.add(plot);
    for (let i = 0; i < 3; i++) {
      assert.equal(c.profile_scenes[i].outfit, c.outfits[i]);
      assert.equal(c.profile_scenes[i].place, c.places[i]);
      assert.match(c.profile_scenes[i].pose, /face toward camera|gaze toward camera/);
    }
  }
  assert.equal(normalizedPlots.size, 818, "Changing names or cup titles must not fake plot uniqueness");
  const kenza = after.find(c => c.id === "cup_babysitter_07");
  assert.match(kenza.scenario, /tram.*annul/);
  assert.match(kenza.scenario, /babyphone/);
  assert.match(kenza.body, /A-cup/);
  vm.runInContext(read("scenario-library.js"), ctx);
  assert.equal(kenza.scenario_legacy, original.get(kenza.id).scenario, "Reload must not overwrite the legacy backup");
});

test("Every scene keeps camera, pose, place and wardrobe within the native prompt budget", () => {
  const { ctx } = setup();
  vm.runInContext(read("profile-morphology.js"), ctx);
  vm.runInContext(read("scenario-library.js"), ctx);
  vm.runInContext(read("profile-composition.js"), ctx);
  for (const c of collect(ctx)) {
    for (const scene of c.profile_scenes) {
      const variant = { ...scene, cameraAngle: scene.camera, scene };
      const prompt = ctx.window.LeaProfileComposition.sceneLock(c, variant, {}, "natural adult body proportions");
      assert(prompt.length <= 920, c.id + ": " + prompt.length);
      for (const field of ["CAMERA:", "POSE:", "SETTING:", "WARDROBE:", "PROP:"]) assert(prompt.includes(field));
  assert.match(prompt, /fully clothed/);
      assert(prompt.indexOf("CAMERA:") < prompt.indexOf("WARDROBE:"));
    }
  }
  const kenza = collect(ctx).find((card) => card.id === "cup_babysitter_07");
  const selectedScene = kenza.profile_scenes[0];
  const locked = ctx.window.LeaProfileComposition.sceneLock(
    kenza, { ...selectedScene, scene: selectedScene }, {}, "same face"
  );
  assert.match(locked, /AUTHORITATIVE MORPHOLOGY: .*A-cup/);
});

test("Face-only canvas isolates the head, leaving most of the composition free", () => {
  const { ctx } = setup();
  vm.runInContext(read("profile-composition.js"), ctx);
  const api = ctx.window.LeaProfileComposition;
  const face = api.faceLayout({ x: 50, y: 40, width: 120, height: 160 }, 512, 768);
  assert(face.dw <= 112 && face.dh <= 136);
  assert(face.dw * face.dh < api.WIDTH * api.HEIGHT * .06);
  assert.equal(api.HEIGHT, 704);
  assert(api.WIDTH * api.HEIGHT < 625 * 625);
  assert.throws(() => api.faceLayout({ x: 999, y: 0, width: 2, height: 2 }, 512, 768));
  assert.throws(() => api.faceLayout({ x: NaN, y: 0, width: 50, height: 50 }, 512, 768));
});

test("Long user overrides retain every instruction within the 920-character limit", () => {
  const { ctx } = setup();
  vm.runInContext(read("profile-composition.js"), ctx);
  const long = "a ".repeat(500);
  const prompt = ctx.window.LeaProfileComposition.sceneLock(
    { id: "mermaid", age: 25, tags: [] },
    { cameraAngle: long, scene: { prop: long } },
    { overridesPose: true, poseLine: long, overridesPlace: true, placeLine: long, overridesOutfit: true, outfitLine: long },
    long,
  );
  assert(prompt.length <= 920, String(prompt.length));
  assert.match(prompt, /no human legs/);
  for (const label of ["CAMERA:", "POSE:", "SETTING:", "WARDROBE:", "PROP:"]) assert(prompt.includes(label));
});

test("Native character lookup includes the previously omitted 120 playful characters", async () => {
  const { ctx } = setup();
  vm.runInContext(read("scenario-library.js"), ctx);
  vm.runInContext(read("native-api.js"), ctx);
  const catalog = await ctx.window.leaNativeApi("/api/characters");
  assert.equal(catalog.length, 818);
  for (const c of ctx.window.LEA_CAST_TAQUIN) {
    assert(catalog.some(item => item.id === c.id && item.scenario === c.scenario));
  }
});

test("The real native API forwards the mask, compatible models, portrait dimensions and anonymous mode", async () => {
  const { ctx, requests, values } = setup();
  values.set("lea.settings", JSON.stringify({ hordeKey: "fictional-test-setting" }));
  vm.runInContext(read("scenario-library.js"), ctx);
  vm.runInContext(read("native-api.js"), ctx);
  const result = await ctx.window.leaNativeApi("/api/image", { method: "POST", body: JSON.stringify({
    engine: "horde", charId: "cup_babysitter_07", prompt: "one clothed adult woman in a living room",
    profile_scene_lock: "CAMERA: wide shot, POSE: seated diagonally, SETTING: living room, WARDROBE: opaque blouse and jeans",
    profile_face_mask: true, profile_identity_lock: true, is_profile_photo: true,
    horde_anonymous: true, source_image: "A".repeat(1000), source_mask: "B".repeat(1000),
    source_processing: "inpainting", force_img2img: true, denoising: 1,
    hordeModel: "Realistic Vision",
  }) });
  assert.match(result.mode, /visage protégé/);
  assert.equal(requests.length, 1);
  const { payload, headers } = requests[0];
  assert.equal(headers.apikey, "0000000000");
  assert.equal(payload.source_processing, "inpainting");
  assert.equal(payload.source_mask, "B".repeat(1000));
  assert.equal(payload.params.width, 512);
  assert.equal(payload.params.height, 704, "Late submission must not squash the face canvas to a square");
  assert.equal(payload.params.denoising_strength, 1);
  assert.deepEqual(Array.from(payload.models), ["Realistic Vision"]);
  assert.equal(payload.nsfw, true);
  assert.equal(payload.censor_nsfw, false);
  assert.equal(payload.shared, false);
});

test("Horde submits only the selected model and fails if that exact model is unavailable", async () => {
  const { ctx, requests } = setup();
  const originalFetch = ctx.fetch;
  ctx.fetch = async (url, options) => {
    if (String(url).includes("/status/models")) {
      return { ok: true, json: async () => [
        { name: "Realistic Vision", count: 1 },
        { name: "Juggernaut XL", count: 2 },
      ] };
    }
    return originalFetch(url, options);
  };
  vm.runInContext(read("native-api.js"), ctx);
  await ctx.window.leaNativeApi("/api/image", { method: "POST", body: JSON.stringify({
    engine: "horde", charId: "fixture", prompt: "one adult woman",
    horde_anonymous: true, hordeModel: "Juggernaut XL",
  }) });
  assert.deepEqual(Array.from(requests.at(-1).payload.models), ["Juggernaut XL"]);

  const unavailable = setup();
  const oldFetch = unavailable.ctx.fetch;
  unavailable.ctx.fetch = async (url, options) => {
    if (String(url).includes("/status/models")) {
      return { ok: true, json: async () => [{ name: "Realistic Vision", count: 1 }] };
    }
    return oldFetch(url, options);
  };
  vm.runInContext(read("native-api.js"), unavailable.ctx);
  await assert.rejects(unavailable.ctx.window.leaNativeApi("/api/image", {
    method: "POST",
    body: JSON.stringify({
      engine: "horde", charId: "fixture", prompt: "one adult woman",
      horde_anonymous: true, hordeModel: "Juggernaut XL v9",
    }),
  }), /Juggernaut XL v9.*pas disponible/i);
  assert.equal(unavailable.requests.length, 0);
});

test("A missing mask fails explicitly, instead of inventing a different face", async () => {
  const { ctx, requests } = setup();
  vm.runInContext(read("native-api.js"), ctx);
  await assert.rejects(ctx.window.leaNativeApi("/api/image", { method: "POST", body: JSON.stringify({
    engine: "horde", charId: "cup_babysitter_07", prompt: "one clothed adult woman",
    profile_scene_lock: "a full scene", profile_face_mask: true, source_processing: "inpainting",
    source_image: "A".repeat(1000), force_img2img: true,
  }) }), /Masque.*invalide/);
  assert.equal(requests.length, 0);
});

test("The unvalidated face-mask experiment remains disabled by default", async () => {
  const { ctx } = setup();
  vm.runInContext(read("profile-composition.js"), ctx);
  const payload = { source_image: "original-reference", source_processing: "img2img", denoising: .7 };
  await ctx.window.LeaProfileComposition.prepareReference(payload);
  assert.equal(payload.source_image, "original-reference");
  assert.equal(payload.source_processing, "img2img");
  assert.equal(payload.denoising, .7);
  assert.equal(payload.source_mask, undefined);
  assert.match(payload.profile_reference_note, /non validé/);
});

test("A censored provider result is never added to the gallery as a successful photo", async () => {
  const { ctx } = setup();
  ctx.fetch = async url => {
    if (String(url).includes("/status/models")) {
      return { ok: true, json: async () => [{ name: "Realistic Vision", count: 1 }] };
    }
    return { ok: true, json: async () => url.includes("/generate/check/")
      ? { done: true, faulted: false }
      : { generations: [{ img: "not-an-image", censored: true, state: "ok" }] } };
  };
  vm.runInContext(read("native-api.js"), ctx);
  const result = await ctx.window.leaNativeApi("/api/image-status", { method: "POST", body: JSON.stringify({ jobId: "test-job", host: "https://aihorde.net/api/v2" }) });
  assert.equal(result.done, true);
  assert.match(result.error, /censuré/);
  assert.equal(result.url, undefined);
});
