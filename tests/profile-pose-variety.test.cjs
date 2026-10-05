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
