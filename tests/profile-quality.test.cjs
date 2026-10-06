const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");
const dir = path.join(__dirname, "../public");
const read = name => fs.readFileSync(path.join(dir, name), "utf8");

test("Detailed canvas preserves head proportions and compact fallback restores the original layout", async () => {
  const draws = [], canvases = [];
  class Image {
    set src(value) { this.source = value; this.onload(); }
  }
  const ctx = vm.createContext({
    window: {}, Image, console,
    document: { createElement() {
      const canvas = { width: 0, height: 0,
        getContext: () => ({ fillRect() {}, drawImage(...args) { draws.push(args); } }),
        toDataURL: () => "data:image/webp;base64,canvas-" + canvas.width + "-" + canvas.height };
      canvases.push(canvas);
      return canvas;
    } },
  });
  vm.runInContext(read("profile-head-segmentation.js"), ctx);
  const payload = {}, restoration = { prepared: {
    source_image: "source", source_mask: "mask", head_image: "original-head",
    head_x: 134, head_y: 20, head_width: 116, head_height: 142,
  }, head_image: "original-head" };
  await ctx.window.LeaSegmentedProfile.setRenderSize(payload, restoration);
  assert.equal(payload.width, 512);
  assert.equal(payload.height, 640);
  assert.equal(restoration.width, 512);
  assert.equal(restoration.height, 640);
  assert.equal(restoration.head_image, "original-head");
  assert.equal(restoration.head_width, 155);
  assert.equal(restoration.head_height, 189);
  assert.equal(draws[0][3] / 384, draws[0][4] / 512);
  await ctx.window.LeaSegmentedProfile.setRenderSize(payload, restoration, true);
  assert.equal(payload.profile_render_width, 384);
  assert.equal(payload.profile_render_height, 512);
  assert.equal(restoration.head_x, 134);
  assert.equal(restoration.head_y, 20);
  assert.equal(restoration.head_width, 116);
  assert.equal(restoration.head_height, 142);
  assert.equal(canvases.length, 2);
});

function submissionContext(api, resize) {
  const ctx = vm.createContext({
    api, window: { LeaSegmentedProfile: { setRenderSize: resize } }, setGenStatus() {},
  });
  const source = read("app.js");
  const from = source.indexOf("async function submitProfileImage(");
  vm.runInContext(source.slice(from, source.indexOf("\nasync function generatePhoto(", from)), ctx);
  return ctx;
}

test("Anonymous work refusal retries once at compact resolution without changing identity or authentication", async () => {
  const requests = [];
  const ctx = submissionContext(async (_url, options) => {
    requests.push(JSON.parse(options.body));
    if (requests.length === 1) throw new Error("Anonymous requests require upfront kudos for this resolution");
    return { jobId: "compact-job" };
  }, async (payload, restoration, compact) => {
    assert.equal(compact, true);
    payload.profile_render_width = restoration.width = 384;
  });
  const payload = { horde_anonymous: true, source_image: "star", profile_scene_lock: "selected-scene", profile_render_width: 512 };
  const result = await ctx.submitProfileImage(payload, { width: 512 });
  assert.equal(result.jobId, "compact-job");
  assert.equal(requests.length, 2);
  assert.equal(requests[1].horde_anonymous, true);
  assert.equal(requests[1].source_image, "star");
  assert.equal(requests[1].profile_scene_lock, "selected-scene");
  assert.equal(requests[1].profile_render_width, 384);
});

test("Censorship and network failures do not cause a resolution retry or a silent identity replacement", async () => {
  for (const message of ["Horde a censuré cette image", "network unavailable"]) {
    let count = 0;
    const ctx = submissionContext(async () => { count++; throw new Error(message); },
      async () => { throw new Error("must not resize"); });
    await assert.rejects(ctx.submitProfileImage({}, { width: 512 }), error => error.message === message);
    assert.equal(count, 1);
  }
});

test("The actual provider request retains the larger canvas, 26 steps and detail sampler past img2img limits", async () => {
  const requests = [], values = new Map();
  const ctx = vm.createContext({
    window: {}, console, Date, setTimeout, clearTimeout, setInterval, clearInterval,
    location: { protocol: "file:", hostname: "", href: "file:///android_asset/www/index.html" },
    localStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) },
    fetch: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return { ok: true, status: 202, json: async () => ({ id: "detailed-job" }) };
    },
  });
  for (const [, file] of read("index.html").matchAll(/src="(characters[^"/]*\.js)"/g)) vm.runInContext(read(file), ctx);
  vm.runInContext(read("native-api.js"), ctx);
  await ctx.window.leaNativeApi("/api/image", { method: "POST", body: JSON.stringify({
    charId: "lea", engine: "horde", prompt: "adult woman in a fitted satin dress",
    profile_scene_lock: "POSE: hip angled, WARDROBE: short satin dress, sharp fabric detail",
    is_profile_photo: true, horde_anonymous: true, profile_identity_lock: true,
    profile_face_mask: true, profile_head_segmented: true,
    profile_render_width: 512, profile_render_height: 640,
    source_image: "A".repeat(1000), source_mask: "B".repeat(128),
    source_processing: "inpainting", force_img2img: true,
  }) });
  assert.equal(requests.length, 1);
  const actual = requests[0];
  assert.equal(actual.params.width, 512);
  assert.equal(actual.params.height, 640);
  assert.equal(actual.params.steps, 26);
  assert.equal(actual.params.sampler_name, "k_dpmpp_2m");
  assert.equal(actual.params.karras, true);
  assert.equal(actual.source_processing, "inpainting");
  assert.equal(actual.censor_nsfw, false);
  assert.equal(actual.shared, false);
  assert.match(actual.prompt, /blurred clothing/);
});
