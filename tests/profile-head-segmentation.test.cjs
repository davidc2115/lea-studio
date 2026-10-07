const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const publicDir = path.join(__dirname, "../public");
const read = name => fs.readFileSync(path.join(publicDir, name), "utf8");

function helper() {
  const context = { window: {}, console };
  vm.createContext(context);
  vm.runInContext(read("profile-head-segmentation.js"), context);
  return { context, api: context.window.LeaSegmentedProfile };
}

function nativeApi() {
  const settings = new Map([["lea.settings", JSON.stringify({ hordeKey: "fictional-test-setting" })]]);
  const requests = [];
  const context = {
    window: {}, console, Date, setTimeout, clearTimeout, setInterval, clearInterval,
    location: { protocol: "file:", hostname: "", href: "file:///android_asset/www/index.html" },
    localStorage: {
      getItem: key => settings.get(key) ?? null,
      setItem: (key, value) => settings.set(key, String(value)),
      removeItem: key => settings.delete(key),
    },
    fetch: async (url, options) => {
      if (String(url).includes("/status/models")) {
        return { ok: true, json: async () => [{ name: "Realistic Vision", count: 1 }] };
      }
      requests.push({ url, options, body: JSON.parse(options.body) });
      return { ok: true, status: 202, json: async () => ({ id: "head-job" }) };
    },
  };
  vm.createContext(context);
  for (const [, file] of read("index.html").matchAll(/src="(characters[^"/]*\.js)"/g)) {
    vm.runInContext(read(file), context);
  }
  vm.runInContext(read("native-api.js"), context);
  return { context, requests, settings };
}

test("The segmented method requires its local Android bridge; the old mask stays disabled", () => {
  const { context, api } = helper();
  assert(!api.active());
  context.window.LeaAndroid = { prepareSegmentedProfileHead() {} };
  assert(api.active());
  assert.equal(context.window.LEA_ENABLE_EXPERIMENTAL_FACE_MASK, undefined);
});

test("Scene instructions retain A-cup morphology, varied action, props and opaque role clothing", () => {
  const { api } = helper();
  const c = { id: "cup_babysitter_07", age: 25, title: "Baby-sitter", body: "Poitrine : bonnet A" };
  const before = JSON.stringify(c);
  const prompt = api.sceneLock(c, {
    pose: "seated sideways, holding a mug", place: "bright kitchen",
    cameraAngle: "wide head-to-knees view", outfit: "transparent lingerie",
    scene: { prop: "baby monitor" },
  }, {}, "(small A-cup breasts:1.7), narrow torso");
  assert.match(prompt, /very small A cup/);
  assert.match(prompt, /minimal breast projection/);
  assert.match(prompt, /seated sideways/);
  assert.match(prompt, /baby monitor/);
  assert.match(prompt, /opaque closed role-appropriate blouse/);
  assert.doesNotMatch(prompt, /transparent lingerie/);
  assert.equal(JSON.stringify(c), before);
  const long = "x".repeat(3000);
  const bounded = api.sceneLock(c, { pose: long, place: long, cameraAngle: long, outfit: long,
    scene: { prop: long } }, {}, long);
  assert(bounded.length <= 920);
  for (const token of ["CAMERA:", "POSE:", "SETTING:", "WARDROBE:", "PROP:"]) assert(bounded.includes(token));
});

test("Malformed native preparations fail before any provider request", () => {
  const { api } = helper();
  assert.throws(() => api.validatePrepared({ ok: false, error: "one face required" }), /one face required/);
  assert.throws(() => api.validatePrepared({ ok: true }), /incohérente/);
  assert.doesNotThrow(() => api.validatePrepared({
    ok: true, width: 384, height: 512, head_x: 134, head_y: 20,
    head_width: 116, head_height: 146, source_image: "source", source_mask: "mask", head_image: "head",
  }));
});

test("A compact valid matte keeps 384x512, 22 detail steps, inpainting and anonymous auth", async () => {
  const { context, requests, settings } = nativeApi();
  const savedSettings = settings.get("lea.settings");
  await context.window.leaNativeApi("/api/image", { method: "POST", body: JSON.stringify({
    engine: "horde", charId: "cup_babysitter_07",
    prompt: "one clothed adult woman, A-cup, seated sideways in a kitchen",
    profile_scene_lock: "one adult woman, A-cup, opaque blouse, visible kitchen",
    profile_face_mask: true, profile_head_segmented: true, profile_identity_lock: true,
    is_profile_photo: true, horde_anonymous: true, source_image: "A".repeat(1000),
    source_mask: "B".repeat(128), source_processing: "inpainting", force_img2img: true,
    denoising: 1,
  }) });
  assert.equal(requests.length, 1);
  const { body, options } = requests[0];
  assert.equal(options.headers.apikey, "0000000000");
  assert.equal(body.params.width, 384);
  assert.equal(body.params.height, 512);
  assert.equal(body.params.steps, 22);
  assert.equal(body.params.sampler_name, "k_dpmpp_2m");
  assert.equal(body.params.karras, true);
  assert.equal(body.params.denoising_strength, 1);
  assert.equal(body.source_mask, "B".repeat(128));
  assert.equal(body.source_processing, "inpainting");
  assert.deepEqual(Array.from(body.models), ["Realistic Vision"]);
  assert.equal(body.nsfw, true);
  assert.equal(body.censor_nsfw, false);
  assert.equal(settings.get("lea.settings"), savedSettings);
});

test("Provider censorship metadata is rejected even if its boolean flag is false", async () => {
  const { context } = nativeApi();
  context.fetch = async url => {
    if (String(url).includes("/status/models")) {
      return { ok: true, json: async () => [{ name: "Realistic Vision", count: 1 }] };
    }
    return { ok: true, json: async () => url.includes("/check/")
      ? { done: true }
      : { generations: [{ censored: false, img: "https://example.invalid/censored.webp",
        gen_metadata: [{ type: "censorship", value: "nsfw" }] }] } };
  };
  const result = await context.window.leaNativeApi("/api/image-status", {
    method: "POST", body: JSON.stringify({ jobId: "censored-job", host: "https://aihorde.net/api/v2" }),
  });
  assert.match(result.error, /censuré/);
  assert.equal(result.url, undefined);
});

test("Frontal bootstrap does not re-enable Horde censorship even with legacy nsfw:false input", async () => {
  const { context, requests } = nativeApi();
  await context.window.leaNativeApi("/api/image", { method: "POST", body: JSON.stringify({
    engine: "horde", charId: "collegue_10",
    prompt: "frontal head and shoulders, both eyes visible, adult woman in an opaque blouse",
    profile_scene_lock: "frontal head and shoulders, both eyes visible, adult woman in an opaque blouse",
    profile_frontal_reference: true, is_profile_photo: true, horde_anonymous: true,
    profile_identity_lock: true, source_image: "A".repeat(2000),
    source_processing: "img2img", force_img2img: true, denoising: .9, nsfw: false,
  }) });
  assert.equal(requests[0].options.headers.apikey, "0000000000");
  assert.equal(requests[0].body.censor_nsfw, false);
  assert.equal(requests[0].body.nsfw, true);
  assert.equal(requests[0].body.shared, false);
  assert.equal(requests[0].body.source_processing, "img2img");
  assert.equal(requests[0].body.params.denoising_strength, .9);
  assert.equal(requests[0].body.params.cfg_scale, 7);
  assert.equal(requests[0].body.params.clip_skip, 1);
  assert.doesNotMatch(requests[0].body.prompt.split("###")[1], /headshot only/);
});

test("The measured three-quarter QA head is rejected rather than treated as frontal", () => {
  const java = fs.readFileSync(path.join(__dirname,
    "../android/app/src/main/java/com/leastudio/app/ProfileHeadProcessor.java"), "utf8");
  const limit = Number(java.match(/Math\.abs\(face\[8\] - eyeX\) > (\.\d+)f \* faceWidth/)[1]);
  const width = 242.3616, eyeMidpoint = (256.9127 + 343.9953) / 2, noseX = 327.0937;
  assert(Math.abs(noseX - eyeMidpoint) / width > limit);
  assert(limit <= .06);
});

function galleryPoll(result, restore) {
  const existing = ["previous-photo"];
  const writes = [], statuses = [];
  const context = {
    window: { _leaGenBusy: true, LeaSegmentedProfile: { restoreImage: restore } },
    state: { current: "different-character", view: "chat" }, console, Date,
    setTimeout: callback => { callback(); return 1; },
    localStorage: { getItem: () => null, setItem: () => {} },
    api: async () => result,
    addToGallery: async (url, id) => { writes.push({ url, id }); return url; },
    setGenStatus: text => statuses.push(text),
    renderProfile() { throw new Error("must not switch the current conversation"); },
  };
  vm.createContext(context);
  const fn = read("app.js").match(/async function pollHordeJob[\s\S]*?^\}/m)[0];
  vm.runInContext(fn, context);
  return { context, existing, writes, statuses };
}

test("Only the restored image is added to the requested profile, without changing existing photos", async () => {
  const { context, writes, existing } = galleryPoll(
    { done: true, url: "https://example.invalid/scene.webp" },
    async () => "data:image/png;base64,restored-head",
  );
  await context.pollHordeJob("job", "host", "requested-character", { head_image: "selected-reference" });
  assert.deepEqual(writes, [{ url: "data:image/png;base64,restored-head", id: "requested-character" }]);
  assert.deepEqual(existing, ["previous-photo"]);
  assert.equal(context.state.current, "different-character");
  assert.equal(context.window._leaGenBusy, false);
});

test("Failed facial restoration never silently saves the generated replacement face", async () => {
  const { context, writes, statuses } = galleryPoll(
    { done: true, url: "https://example.invalid/scene.webp" },
    async () => { throw new Error("unexpected dimensions"); },
  );
  await context.pollHordeJob("job", "host", "requested-character", { head_image: "selected-reference" });
  assert.deepEqual(writes, []);
  assert(statuses.some(text => text.includes("unexpected dimensions")));
  assert.equal(context.window._leaGenBusy, false);
});

test("A censored result is never restored over or added to a gallery", async () => {
  let restored = false;
  const { context, writes } = galleryPoll(
    { done: true, error: "Horde a censuré cette image." },
    async () => { restored = true; },
  );
  await context.pollHordeJob("job", "host", "requested-character", {});
  assert.equal(restored, false);
  assert.deepEqual(writes, []);
});

function protectedGallery(quotaFailure = false) {
  const prior = Array.from({ length: 80 }, (_, i) => "gallery:old-" + i);
  const values = new Map([
    ["lea.photos.target", JSON.stringify(prior)],
    ["lea.chat.target", JSON.stringify({ messages: ["existing conversation"] })],
  ]);
  const context = {
    window: { LeaAndroid: { saveGalleryImage: () => "gallery:new-scene" } },
    state: { current: "other", view: "chat" }, console,
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => {
        if (quotaFailure) throw new Error("quota exceeded");
        values.set(key, value);
      },
    },
    compressToJpeg: async () => "data:image/jpeg;base64,new-scene",
    extraPhotos() { throw new Error("must not prune the existing index"); },
    saveExtra() { throw new Error("must not use quota cleanup for protected writes"); },
    maybeAutoCover() {},
  };
  vm.createContext(context);
  vm.runInContext(read("app.js").match(/async function addToGallery[\s\S]*?^\}/m)[0], context);
  return { context, values, prior };
}

test("Protected gallery writes retain all existing photos beyond the legacy limit and preserve chat", async () => {
  const { context, values, prior } = protectedGallery();
  const chat = values.get("lea.chat.target");
  await context.addToGallery("data:image/png;base64,restored", "target", { preserveExisting: true });
  assert.deepEqual(JSON.parse(values.get("lea.photos.target")), ["gallery:new-scene", ...prior]);
  assert.equal(values.get("lea.chat.target"), chat);
});

test("Restored profile PNG is saved without another lossy JPEG conversion", async () => {
  const { context } = protectedGallery();
  const original = "data:image/png;base64,restored-face-and-fabric";
  let written;
  context.compressToJpeg = async () => { throw new Error("must not recompress restored PNG"); };
  context.window.LeaAndroid.saveGalleryImage = (id, data) => {
    assert.equal(id, "target");
    written = data;
    return "gallery:new-scene";
  };
  await context.addToGallery(original, "target", { preserveExisting: true });
  assert.equal(written, original);
});

test("A full storage index fails explicitly instead of deleting earlier photos or chat", async () => {
  const { context, values } = protectedGallery(true);
  const before = [...values.entries()];
  await assert.rejects(context.addToGallery("data:image/png;base64,restored", "target",
    { preserveExisting: true }), /quota exceeded/);
  assert.deepEqual([...values.entries()], before);
});

test("The release wires preparation only into profile generation, not SD.cpp rescue", () => {
  const app = read("app.js");
  const rescue = app.slice(app.indexOf("async function generatePhotoHordeFallback"),
    app.indexOf("async function pollSdCppJob"));
  assert.doesNotMatch(rescue, /headRestoration|prepareSegmentedProfileHead|LeaSegmentedProfile/);
  const prepare = app.indexOf("headRestoration = await window.LeaSegmentedProfile.prepareReference");
  assert(prepare > app.indexOf('console.warn("[profile final prompt]"'));
  assert.match(app.slice(prepare, app.indexOf("async function pollLocalJob", prepare)),
    /pollHordeJob\(start.jobId, start.host, c.id, headRestoration\)/);
  assert(read("index.html").indexOf('src="profile-head-segmentation.js"') <
    read("index.html").indexOf('src="app.js"'));
});
