const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const publicDir = process.argv[2] || path.join(__dirname, "../public");
const read = name => fs.readFileSync(path.join(publicDir, name), "utf8");

test("A profile reference never requests a conflicting frontal head", () => {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(read("profile-head-segmentation.js"), ctx);
  const api = ctx.window.LeaSegmentedProfile;
  const prompt = "POSE: standing beside a table, face toward camera, SETTING: meeting room, gaze toward camera";
  for (const direction of ["right", "left"]) {
    const oriented = api.orientPrompt(prompt, direction);
    assert.match(oriented, new RegExp(direction + "-facing profile"));
    assert.match(oriented, /standing beside a table/);
    assert.match(oriented, /meeting room/);
    assert.doesNotMatch(oriented, /face toward camera|gaze toward camera/);
  }
  assert.equal(api.orientPrompt(prompt, "frontal"), prompt);
});

test("Every human character gets both a seated and a standing alternative", () => {
  const ctx = { window: {} };
  vm.createContext(ctx);
  for (const [, file] of read("index.html").matchAll(/src="(characters[^"/]*\.js)"/g)) {
    vm.runInContext(read(file), ctx);
  }
  vm.runInContext(read("scenario-library.js"), ctx);
  const keys = ["CAST", "EXTRA_CAST", "LEA_CAST_NEW", "LEA_CAST_SPECIAL", "LEA_CAST_DIRECT", "LEA_CAST_CUPS", "LEA_CAST_COLLEGUES", "LEA_CAST_TAQUIN"];
  const catalog = [...new Map(keys.flatMap(key => ctx.window[key] || []).map(c => [c.id, c])).values()];
  assert.equal(catalog.length, 818);
  for (const c of catalog) {
    const poses = c.profile_scenes.map(scene => scene.pose).join(" | ");
    if (/mermaid|sir[eè]ne/i.test([c.id, c.title, c.body].join(" "))) {
      assert.match(poses, /scaled tail/);
      continue;
    }
    assert.match(poses, /seated|sitting/, c.id + ": no seated alternative");
    assert.match(poses, /standing/, c.id + ": no standing alternative");
  }
});

test("The final submission keeps the orientation produced by native preparation", async () => {
  const payload = {};
  const context = {
    window: { LeaSegmentedProfile: {
      active: () => true,
      prepareReference: async request => {
        assert.equal(request.prompt, "face toward camera");
        request.prompt = "head in right-facing profile";
        request.profile_scene_lock = request.prompt;
        return { head_image: "reference" };
      },
    } },
    duoProfile: false, payload, profileSceneLock: "face toward camera",
    setGenStatus() {}, cupLock: () => ({ neg: "" }), bodyNegatives: () => "", c: {},
    api: async (_url, options) => JSON.parse(options.body),
  };
  vm.createContext(context);
  const source = read("app.js");
  const from = source.indexOf("let headRestoration = null;");
  const until = source.indexOf("\n    if (!start.jobId)", from);
  assert(from >= 0 && until > from);
  const submitted = await vm.runInContext("(async()=>{" + source.slice(from, until) +
    "\nreturn start;})()", context);
  assert.equal(submitted.prompt, "head in right-facing profile");
  assert.equal(submitted.profile_scene_lock, submitted.prompt);
});
