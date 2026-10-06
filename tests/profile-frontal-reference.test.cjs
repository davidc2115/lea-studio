const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = name => fs.readFileSync(path.join(__dirname, "../public", name), "utf8");

function fixture(selected = "star-profile") {
  const values = new Map(), generated = [], saved = [];
  const root = {
    LeaAndroid: {
      prepareSegmentedProfileHead: image => JSON.stringify(
        image === "frontal" ? { ok: true, face_direction: "frontal" }
          : image === "broken" ? { ok: false, error: "Unreadable reference" }
          : { ok: false, needs_frontal_reference: true, frontal_source: "cropped-star-head" }),
    },
  };
  const context = { window: root };
  vm.createContext(context);
  vm.runInContext(read("profile-frontal-reference.js"), context);
  const options = {
    character: { id: "target", age: 33 },
    identity: "adult woman with auburn hair",
    generate: async request => { generated.push(request); return "frontal"; },
    persist: async (image, id) => { saved.push({ image, id }); return "gallery:frontal"; },
    resolve: async () => "frontal",
    storage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) },
  };
  return { api: root.LeaFrontalReference, payload: { source_image: selected }, options, generated, saved, values };
}

test("An existing frontal reference is reused without a new generation", async () => {
  const f = fixture("frontal");
  assert.equal((await f.api.ensure(f.payload, () => {}, f.options)).ok, true);
  assert.equal(f.generated.length, 0);
  assert.equal(f.saved.length, 0);
});

test("A profile prepares one cropped anonymous frontal request without censorship and caches its validated result", async () => {
  const f = fixture();
  await f.api.ensure(f.payload, () => {}, f.options);
  assert.equal(f.generated.length, 1);
  const request = f.generated[0];
  assert.equal(request.source_image, "cropped-star-head");
  assert.equal(request.horde_anonymous, true);
  assert.equal(request.nsfw, true);
  assert.equal(request.censor_nsfw, false);
  assert.equal(request.force_img2img, true);
  assert.match(request.prompt, /both eyes visible, direct eye contact/);
  assert.deepEqual(f.saved, [{ image: "frontal", id: "target" }]);
  assert.equal(f.payload.source_image, "star-profile");
  await f.api.ensure(f.payload, () => {}, f.options);
  assert.equal(f.generated.length, 1);
});

test("With no photo, a first frontal reference is generated without invented source_image", async () => {
  const f = fixture("");
  await f.api.ensure(f.payload, () => {}, f.options);
  assert.equal(f.generated.length, 1);
  assert.equal(f.generated[0].source_image, undefined);
});

test("Changing the star invalidates the derived frontal cache", async () => {
  const f = fixture();
  await f.api.ensure(f.payload, () => {}, f.options);
  f.payload.source_image = "different-star-profile";
  await f.api.ensure(f.payload, () => {}, f.options);
  assert.equal(f.generated.length, 2);
});

test("Unreadable selected photos fail explicitly rather than choosing another identity", async () => {
  const f = fixture("broken");
  await assert.rejects(f.api.ensure(f.payload, () => {}, f.options), /Unreadable/);
  assert.equal(f.generated.length, 0);
  assert.equal(f.saved.length, 0);
});

test("An output that is still in profile is neither saved nor used as a reference", async () => {
  const f = fixture();
  f.options.generate = async () => "still-profile";
  await assert.rejects(f.api.ensure(f.payload, () => {}, f.options), /visage de face/);
  assert.equal(f.saved.length, 0);
  assert.equal(f.values.size, 0);
});

test("Censorship or a provider failure cannot save or cache a reference", async () => {
  const f = fixture();
  f.options.generate = async () => { throw new Error("Horde censuré"); };
  await assert.rejects(f.api.ensure(f.payload, () => {}, f.options), /censuré/);
  assert.equal(f.saved.length, 0);
  assert.equal(f.values.size, 0);
});

test("The star outranks both the cast cover and other generated pictures", async () => {
  const requests = [];
  const context = {
    customCover: () => "starred-url",
    imageToBase64: async src => { requests.push(src); return "A".repeat(900); },
    window: {}, resolvedCover: () => "other-url", extraPhotos: () => ["third-url"],
  };
  vm.createContext(context);
  vm.runInContext(read("app.js").match(/async function resolveCharacterRefB64[\s\S]*?^\}/m)[0], context);
  const result = await context.resolveCharacterRefB64({ id: "target", cover: "cast-url" });
  assert.equal(result.length, 900);
  assert.deepEqual(requests, ["starred-url"]);
  context.imageToBase64 = async () => null;
  await assert.rejects(context.resolveCharacterRefB64({ id: "target", cover: "cast-url" }), /étoile.*illisible/);
});
