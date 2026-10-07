const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts/android-version.sh");
const properties = fs.readFileSync(path.join(root, "android/version.properties"), "utf8");
const name = properties.match(/^versionName=(.+)$/m)[1];
const minimum = Number(properties.match(/^versionCode=(.+)$/m)[1]);
const resolve = (code, file) => spawnSync("bash", [script, String(code), ...(file ? [file] : [])], { encoding: "utf8" });

test("push et lancement manuel partagent le nom et conservent le numéro du run", () => {
  assert.match(name, /^\d+\.\d+\.\d+$/);
  assert.ok(minimum > 666);
  assert.ok(name.localeCompare("1.0.7", undefined, { numeric: true }) > 0);
  for (const code of [minimum, minimum + 1, 2100000000]) {
    const result = resolve(code);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, `VERSION_NAME=${name}\nVERSION_CODE=${code}\n`);
  }
  const workflow = fs.readFileSync(path.join(root, ".github/workflows/build-apk.yml"), "utf8");
  assert.match(workflow, /workflow_dispatch: \{\}/);
  assert.match(workflow, /BUILD_NUMBER: \$\{\{ github\.run_number \}\}/);
  assert.match(workflow, /bash scripts\/android-version\.sh "\$BUILD_NUMBER" >> "\$GITHUB_ENV"/);
  assert.match(workflow, /-PversionCode="\$VERSION_CODE"/);
  assert.match(workflow, /OUT="lea-studio-v\$\{VERSION_NAME\}-b\$\{VERSION_CODE\}\.apk"/);
  assert.doesNotMatch(workflow, /github\.event\.inputs\.version|1\.0\.0|-PversionName=/);
});

test("les codes anciens, manquants, malformés et hors limite sont refusés sans sortie", () => {
  for (const code of [664, 666, minimum - 1, "", "0", "-1", "1.2", "0667", "abc", "667\n", "2100000001", "999999999999999999"]) {
    const result = resolve(code);
    assert.notEqual(result.status, 0, `code accepté : ${JSON.stringify(code)}`);
    assert.equal(result.stdout, "");
  }
});

test("une source de version absente ou invalide bloque la résolution", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lea-version-"));
  const file = path.join(dir, "version.properties");
  try {
    assert.notEqual(resolve(minimum, file).status, 0);
    for (const content of [
      "versionName=1.0.8\nversionCode=666\n",
      "versionName=1.0.8\nversionCode=abc\n",
      "versionName=01.0.8\nversionCode=667\n",
      "versionName=\nversionCode=667\n",
      "versionName=1.0.8\nversionName=1.0.9\nversionCode=667\n",
      "versionName=1.0.8\n",
    ]) {
      fs.writeFileSync(file, content);
      const result = resolve(minimum, file);
      assert.notEqual(result.status, 0, `source acceptée : ${content}`);
      assert.equal(result.stdout, "");
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("Gradle lit la même source et protège les codes sans changer le package", () => {
  const gradle = fs.readFileSync(path.join(root, "android/app/build.gradle"), "utf8");
  assert.match(gradle, /rootProject\.file\("version\.properties"\)/);
  assert.match(gradle, /releaseVersion\.getProperty\("versionName"\)/);
  assert.match(gradle, /versionInt < minimumCode\.toInteger\(\)/);
  assert.match(gradle, /applicationId "com\.leastudio\.app"/);
  assert.doesNotMatch(gradle, /"1\.0\.0"/);
});
