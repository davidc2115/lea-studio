const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");
const dir = path.join(__dirname, "../public");
const read = name => fs.readFileSync(path.join(dir, name), "utf8");

test("Scene sharpening is bounded, preserves colour and alpha, and leaves flat areas unchanged", () => {
  const ctx = vm.createContext({ window: {} });
  vm.runInContext(read("profile-head-segmentation.js"), ctx);
  const sharpen = ctx.window.LeaSegmentedProfile.sharpenScenePixels;
  const flat = new Uint8ClampedArray(Array.from({ length: 25 }, () => [80, 100, 120, 255]).flat());
  const before = flat.slice();
  sharpen(flat, 5, 5);
  assert.deepEqual(flat, before);
  const edge = before.slice();
  edge.set([110, 130, 150, 255], 12 * 4);
  const original = edge.slice();
  sharpen(edge, 5, 5);
  assert(edge[48] > original[48]);
  assert(edge[48] - original[48] <= 8);
  assert.equal(edge[49] - edge[48], 20);
  assert.equal(edge[50] - edge[49], 20);
  for (let n = 3; n < edge.length; n += 4) assert.equal(edge[n], original[n]);
  const translucent = before.slice();
  translucent.set([110, 130, 150, 128], 48);
  sharpen(translucent, 5, 5);
  assert.deepEqual([...translucent.slice(48, 52)], [110, 130, 150, 128]);
  assert.throws(() => sharpen(new Uint8ClampedArray(4), 5, 5), /incohérents/);
});

test("Actual restoration sharpens the scene before drawing the untouched reference head and exports PNG", async () => {
  const events = [];
  const pixels = new Uint8ClampedArray(Array.from({ length: 9 }, () => [100, 100, 100, 255]).flat());
  class Image {
    constructor() { this.naturalWidth = 3; this.naturalHeight = 3; }
    set src(value) { this.source = value; this.onload(); }
  }
  const ctx = vm.createContext({
    window: {}, Image,
    document: { createElement() { return {
      getContext() { return {
        drawImage(image) { events.push(image.source.includes("original-head") ? "head" : "scene"); },
        getImageData() { events.push("read"); return { data: pixels }; },
        putImageData() { events.push("sharpened"); },
      }; },
      toDataURL(format) { events.push(format); return "data:" + format + ";base64,restored"; },
    }; } },
  });
  vm.runInContext(read("profile-head-segmentation.js"), ctx);
  const output = await ctx.window.LeaSegmentedProfile.restoreImage("data:image/webp;base64,scene", {
    width: 3, height: 3, head_image: "original-head", head_x: 0, head_y: 0, head_width: 1, head_height: 1,
  });
  assert.deepEqual(events, ["scene", "read", "sharpened", "head", "image/png"]);
  assert.match(output, /^data:image\/png/);
});

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
    fetch: async (url, options) => {
      if (String(url).includes("/status/models")) {
        return { ok: true, json: async () => [{ name: "Realistic Vision", count: 1 }] };
      }
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
