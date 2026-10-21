// Runtime audit of Horde prompts and face-reference cropping for all bundled character profiles.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const storage = new Map();
const draws = [];
class MockImage {
  constructor() { this.naturalWidth = 453; this.naturalHeight = 677; }
  set src(value) { queueMicrotask(() => this.onload?.()); }
}
const document = {
  createElement() {
    return {
      width: 0, height: 0,
      getContext: () => ({ drawImage: (...args) => draws.push(args) }),
      toDataURL: () => 'data:image/jpeg;base64,' + 'a'.repeat(120),
    };
  },
};
const window = {};
const context = {
  window, document, Image: MockImage,
  localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) },
  Math, Date, console, setTimeout, clearTimeout, Promise, URL, Blob,
  fetch: async () => { throw new Error('Unexpected network access in prompt test'); },
};
let source = fs.readFileSync(path.join(root, 'public/native-api.js'), 'utf8');
source = source.replace(/\}\)\(\);\s*$/, 'window.__buildHordePrompt = buildPhysicalImagePrompt; window.__profileReferenceForTest = profileReferenceImageB64; })();');
vm.runInNewContext(source, context, { timeout: 5000 });
if (typeof window.__buildHordePrompt !== 'function') throw new Error('Could not load runtime prompt builder');
if (!/const HORDE_COMMON_DENOISE\s*=\s*0\.68/.test(source)) throw new Error('Expected balanced Horde denoise 0.68');
if (!/faceOnlyRef:\s*false,[\s\S]{0,80}strictFaceOnly:\s*false/.test(source)) throw new Error('Horde must use the full-frame reference to preserve body and framing');

await window.__profileReferenceForTest({ cover: 'data:image/jpeg;base64,source' }, 'image/jpeg', true, true);
const crop = draws.at(-1);
if (!crop || crop[4] < 677 * 0.42 || crop[4] >= 677 * 0.60 || crop[2] !== 0) {
  throw new Error(`Face crop does not include enough of a portrait face: ${JSON.stringify(crop?.slice(1, 5))}`);
}

const catalogueFiles = fs.readdirSync(path.join(root, 'public')).filter((name) => /^characters.*\.js$/.test(name)).sort();
let checked = 0, customPrompts = 0;
const failures = [];
for (const file of catalogueFiles) {
  const text = fs.readFileSync(path.join(root, 'public', file), 'utf8');
  const start = text.indexOf('['), end = text.lastIndexOf(']');
  for (const profile of JSON.parse(text.slice(start, end + 1))) {
    checked++;
    if (profile.prompt_horde || profile.image_prompt_horde) customPrompts++;
    const first = window.__buildHordePrompt(profile, '', 'horde');
    const second = window.__buildHordePrompt(profile, '', 'horde');
    const outfit1 = first.match(/OUTFIT \(must follow\): ([^.]+)\. POSE/);
    const pose1 = first.match(/POSE \(must follow\): ([^.]+)\. LOCATION/);
    const outfit2 = second.match(/OUTFIT \(must follow\): ([^.]+)\. POSE/);
    const pose2 = second.match(/POSE \(must follow\): ([^.]+)\. LOCATION/);
    if (!outfit1 || !pose1 || !outfit2 || !pose2) failures.push(`${profile.id}: missing explicit outfit/pose`);
    if (first.length > 1400) failures.push(`${profile.id}: prompt exceeds 1400 chars`);
    if (!Number.isInteger(Number(profile.age)) || Number(profile.age) < 18) failures.push(`${profile.id}: adult age missing`);
    if (!first.includes(`${Number(profile.age)} year old`)) failures.push(`${profile.id}: exact age missing`);
    if (outfit1?.[1] === outfit2?.[1]) failures.push(`${profile.id}: outfit repeats immediately`);
    if (pose1?.[1] === pose2?.[1]) failures.push(`${profile.id}: pose repeats immediately`);
    if ((profile.cover || profile.gallery?.[0]) && !first.includes('identity/body reference only')) failures.push(`${profile.id}: missing identity/body reference instruction`);
    if (!first.includes('FULL-LENGTH WIDE SHOT')) failures.push(`${profile.id}: missing full-body framing instruction`);
    if (/plus-size|chubby|ronde|bbw/i.test([profile.body, profile.looks_en, profile.appearance, ...(profile.tags || [])].join(' ')) && !first.includes('BODY TYPE LOCK')) failures.push(`${profile.id}: missing explicit body-type lock`);
  }
}
if (failures.length) {
  console.error(failures.slice(0, 25).join('\n'));
  console.error(`Failures: ${failures.length}`);
  process.exit(1);
}
console.log(`Horde audit passed: ${checked} profiles; ${customPrompts} custom sheets; ${checked - customPrompts} profile-derived; portrait face crop ${crop[4]}px.`);
