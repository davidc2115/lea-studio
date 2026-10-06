const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const assert = require("node:assert/strict");

const dir = process.argv[2] || path.join(__dirname, "..", "public");
const app = fs.readFileSync(path.join(dir, "app.js"), "utf8");
const store = {};
const ctx = { window: {}, localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } } };
vm.createContext(ctx);
const a = app.indexOf("function profileScenePosePool(");
const b = app.indexOf("function pickProfileCameraAngle(", a);
vm.runInContext(app.slice(a, b), ctx);

test("Custom poses replace automatic poses and never repeat the last 3", () => {
  const c = { id: "t1", title: "voisine" };
  const mine = ["pose A", "pose B", "pose C", "pose D", "pose A"];
  assert.equal(JSON.stringify(ctx.saveCustomPoses(c, mine)), JSON.stringify(["pose A", "pose B", "pose C", "pose D"]));
  const seen = [];
  for (let i = 0; i < 12; i++) {
    const p = ctx.pickProfileScenePose(c, { place: "sofa" });
    assert(["pose A", "pose B", "pose C", "pose D"].includes(p));
    assert(!seen.slice(-3).includes(p));
    seen.push(p);
  }
});

test("Empty library falls back to automatic poses; card field 'poses' is used by default", () => {
  const c = { id: "t2" };
  ctx.saveCustomPoses(c, []);
  assert(ctx.pickProfileScenePose(c, { place: "sofa" }).length > 5);
  const card = { id: "t3", poses: ["pose fiche"] };
  assert.equal(ctx.pickProfileScenePose(card, { place: "sofa" }), "pose fiche");
});
