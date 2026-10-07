// Exécution sans SDK, compilation, signature ni dépendance npm :
// node --test tests/apk-narratives.test.cjs (Node, bash, zip et unzip requis).
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const guard = path.join(root, "scripts/check-apk-narratives.sh");
// Liste indépendante du garde-fou : retirer une exigence du script doit casser les tests.
const roles = [
  "role-stories-family.js", "role-stories-work.js", "role-stories-social.js",
  "role-stories-fantasy.js", "role-temperaments.js", "role-narratives.js",
];
const sourceHtml = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
const assets = [...sourceHtml.matchAll(/src="((?:characters[^"/]*|scenario-library|role-[^"/]+)\.js)"/g)]
  .map(match => match[1]);
const scriptTag = file => `<script src="${file}"></script>`;
const minimalHtml = `<!doctype html><html><head>\n${assets.map(scriptTag).join("\n")}\n</head></html>\n`;
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

function fixture(t, mutate = () => {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lea apk regression "));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const www = path.join(dir, "assets/www");
  fs.mkdirSync(www, { recursive: true });
  fs.writeFileSync(path.join(www, "index.html"), minimalHtml);
  for (const file of [...assets, "native-api.js"]) {
    fs.copyFileSync(path.join(publicDir, file), path.join(www, file));
  }
  mutate(www);
  const apk = path.join(dir, "petite archive.apk");
  const zipped = spawnSync("zip", ["-q", "-r", apk, "assets"], { cwd: dir, encoding: "utf8" });
  assert.equal(zipped.status, 0, zipped.error?.message || zipped.stderr);
  assert(fs.statSync(apk).size < 1024 * 1024, "La fixture doit rester une petite archive, sans ressources Android.");
  return { dir, apk };
}

function check({ dir, apk }) {
  const before = fs.readFileSync(apk);
  const temporary = path.join(dir, "extraction");
  fs.mkdirSync(temporary);
  const env = { ...process.env, TMPDIR: temporary };
  // Ne pas transmettre le protocole binaire interne du runner Node au processus
  // de contrôle : reproduire son lancement autonome dans GitHub Actions.
  delete env.NODE_TEST_CONTEXT;
  // Lancer ailleurs que la racine du projet et avec des espaces dans le chemin.
  const result = spawnSync("bash", [guard, apk], {
    cwd: dir, encoding: "utf8", timeout: 30000,
    env,
  });
  const after = fs.readFileSync(apk);
  assert.deepEqual(after, before, "Le contrôle ne doit modifier aucun octet de l'APK, même en cas de refus.");
  assert.equal(digest(after), digest(before), "Le SHA-256 de l'APK doit rester identique.");
  assert.deepEqual(fs.readdirSync(temporary), [], "L'extraction temporaire doit être nettoyée.");
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return { ...result, output: result.stdout + result.stderr };
}

test("une archive valide est acceptée et les vrais tests de scénarios sont exécutés", t => {
  const result = check(fixture(t));
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Les six scripts de scénarios sont présents et chargés/);
  assert.match(result.output, /All 818 characters get new scenarios/);
  assert.match(result.output, /# tests 6/);
  assert.match(result.output, /# fail 0/);
});

for (const file of roles) {
  test(`un APK sans ${file} est refusé`, t => {
    const result = check(fixture(t, www => fs.unlinkSync(path.join(www, file))));
    assert.notEqual(result.status, 0, result.output);
    assert(result.output.includes(`APK incomplet : assets/www/${file} manquant`), result.output);
  });
  for (const mode of ["commenté", "non chargé"]) {
    test(`un script ${file} ${mode} est refusé même si le fichier existe`, t => {
      const result = check(fixture(t, www => {
        const tag = scriptTag(file);
        const replacement = mode === "commenté" ? `<!--\n${tag}\n-->` : "";
        fs.writeFileSync(path.join(www, "index.html"), minimalHtml.replace(tag, replacement));
      }));
      assert.notEqual(result.status, 0, result.output);
      assert(result.output.includes(`APK incomplet : ${file} non chargé dans assets/www/index.html`), result.output);
    });
  }
}

test("des scénarios invalides dans l'APK sont refusés par role-narratives.test.cjs, pas masqués par les sources", t => {
  const result = check(fixture(t, www => {
    // JS valide et six scripts présents/chargés, mais scénarios embarqués corrompus.
    fs.appendFileSync(path.join(www, "role-narratives.js"), `
for (const group of ["CAST", "EXTRA_CAST", "LEA_CAST_NEW", "LEA_CAST_SPECIAL",
  "LEA_CAST_DIRECT", "LEA_CAST_CUPS", "LEA_CAST_COLLEGUES", "LEA_CAST_TAQUIN"]) {
  for (const character of window[group] || []) character.scenario = "Scénario invalide";
}
`);
  }));
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /Les six scripts de scénarios sont présents et chargés/);
  assert.match(result.output, /not ok 1 - All 818 characters get new scenarios/);
  assert.match(result.output, /Lieu/);
  assert.match(result.output, /# fail [1-9]/);
});

test("un index absent est refusé sans modifier l'archive", t => {
  const result = check(fixture(t, www => fs.unlinkSync(path.join(www, "index.html"))));
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /ENOENT.*index\.html/);
});

test("un fichier qui n'est pas une archive est refusé sans modifier ses octets", t => {
  const archive = fixture(t);
  fs.writeFileSync(archive.apk, "Ce fichier n'est pas un ZIP.");
  const result = check(archive);
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /End-of-central-directory signature not found/);
});

test("le workflow exécute les régressions sans Android et contrôle l'APK final avant l'upload", () => {
  const workflow = fs.readFileSync(path.join(root, ".github/workflows/build-apk.yml"), "utf8");
  const regressionJob = workflow.split("  guard-tests:\n")[1]?.split("\n  build:\n")[0];
  assert(regressionJob, "Le job autonome de régression doit être présent.");
  assert.match(regressionJob, /node --test tests\/apk-narratives\.test\.cjs/);
  assert.doesNotMatch(regressionJob, /gradle|setup-java|sdkmanager|apksigner|zipalign/);
  assert.match(workflow, /needs: guard-tests/);
  for (const file of ["scripts/check-apk-narratives.sh", "tests/apk-narratives.test.cjs", "tests/role-narratives.test.cjs"]) {
    assert(workflow.includes(`- "${file}"`), `Les changements de ${file} doivent déclencher le workflow.`);
  }
  const start = workflow.indexOf("- name: Vérifier les scénarios réellement embarqués dans l'APK");
  const upload = workflow.indexOf("- uses: actions/upload-artifact@v4", start);
  assert(start > 0 && upload > start);
  assert.match(workflow.slice(start, upload), /run: bash scripts\/check-apk-narratives\.sh lea-studio\.apk/);
});
