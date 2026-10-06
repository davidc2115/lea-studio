(function (root) {
  "use strict";
  const styles = [
    { id: "black-backless", label: "Robe noire dos nu · fente haute · escarpins", outfit: "tight black backless evening dress, deep V neckline, high thigh slit, opaque bodice, high heel pumps", framing: "head to shoes view, dress silhouette and shoes visible" },
    { id: "emerald-satin", label: "Robe satin vert · décolleté · fente", outfit: "tight emerald satin wrap mini dress, deep V neckline, thigh slit, cardigan draped below shoulders, classic heels", framing: "three-quarter body view, hands and dress visible" },
    { id: "blouse-mini", label: "Blouse décolletée · mini-jupe · talons lacés", outfit: "white fitted blouse loosely buttoned with plunging neckline, short tight black slit mini skirt, black lace-up high heel sandals", framing: "head to shoes view, skirt and lace-up sandals visible" },
    { id: "lace-body", label: "Body noir en dentelle", outfit: "black lace bodysuit with opaque lined cups and opaque briefs, delicate floral lace, chest and pelvis covered", framing: "head to upper thighs view, complete bodysuit visible" },
    { id: "crop-jeans", label: "Crop top très court · jean moulant", outfit: "very short tight low-cut crop top, bare midriff, tight low-rise blue jeans, heeled ankle boots", framing: "head to shoes view, waist and jeans visible" },
    { id: "burgundy-robe", label: "Peignoir ouvert · nuisette courte bordeaux", outfit: "open burgundy satin robe over a very short matching opaque lace-trimmed slip dress, deep neckline, heeled mules", framing: "head to shoes view, satin robe and legs visible" },
    { id: "mini-boots", label: "Robe courte décolletée · cuissardes", outfit: "fitted short dark green dress with plunging V neckline and opaque bodice, black thigh-high heeled boots", framing: "head to shoes view, complete thigh-high boots visible" },
    { id: "leather-skirt", label: "Top décolleté · mini-jupe cuir · escarpins", outfit: "very short tight black low-cut top, tight black leather micro skirt, bare waist, pointed stiletto pumps", framing: "head to shoes view, leather skirt and pumps visible" },
  ];
  function options() {
    return '<option value="auto">Variée · inspirée des exemples</option><option value="scenario">Tenue du scénario</option>' +
      styles.map(s => '<option value="' + s.id + '">' + s.label + '</option>').join("");
  }
  function choose(character, variant, selection = "auto") {
    const c = character || {};
    const sourcePose = String(variant && variant.pose || "standing, face toward camera");
    const accents = /sir[eè]ne|mermaid|lamia|naga/i.test([c.title, c.body].join(" "))
      ? ["arched torso, flirty gaze", "shoulders back, alluring gaze", "body angled, teasing smile"]
      : /seat|sitt|sofa|chair|bed|assise/i.test(sourcePose)
        ? ["arched back, thighs angled, flirty gaze", "knees angled, shoulders back, teasing smile", "leaning forward slightly, alluring gaze"]
        : ["arched back, hips angled, flirty gaze", "one hip pushed out, shoulders back, teasing smile", "body angled, weight on one leg, alluring gaze"];
    const poseKey = "lea.profilePosture." + (c.id || "x");
    let previous = "";
    try { previous = localStorage.getItem(poseKey) || ""; } catch (_) {}
    const alternatives = accents.filter(pose => pose !== previous);
    const accent = alternatives[Math.floor(Math.random() * alternatives.length)];
    try { localStorage.setItem(poseKey, accent); } catch (_) {}
    variant = { ...variant, pose: sourcePose + ", " + accent };
    if (selection === "scenario") return { ...variant, wardrobeStyle: "scenario" };
    // Automatic styling must not replace a species costume or clinical uniform.
    const role = String(c.title || c.role || "");
    if (selection === "auto" && /elf|kitsune|succub|dragon|catgirl|sir[eè]ne|ange|d[eé]mon|vampir|f[eé]e|dryad|lamia|harpi|slime|andro|louve|centaur|gorgon|oni|naga|ph[eé]nix|fant[oô]me|sorci[eè]re|infirm|m[eé]dec/i.test(role)) {
      return { ...variant, wardrobeStyle: "scenario" };
    }
    let style = styles.find(s => s.id === selection);
    if (!style && selection !== "auto") throw new Error("Tenue de profil inconnue.");
    if (!style) {
      const work = /secr[eé]taire|coll[eè]gue|avocat|h[oô]tesse|mentore/i.test(role);
      const pool = styles.filter(s => !work || ["blouse-mini", "emerald-satin"].includes(s.id));
      let recent = [];
      const key = "lea.profileWardrobeRecent." + (c.id || "x");
      try { recent = JSON.parse(localStorage.getItem(key) || "[]"); } catch (_) {}
      if (!Array.isArray(recent)) recent = [];
      const unused = pool.filter(s => !recent.includes(s.id));
      const candidates = unused.length ? unused : pool.filter(s => s.id !== recent[recent.length - 1]);
      style = candidates[Math.floor(Math.random() * candidates.length)] || pool[0];
      try { localStorage.setItem(key, JSON.stringify(recent.concat(style.id).slice(-2))); } catch (_) {}
    }
    const tail = /sir[eè]ne|mermaid|lamia|naga/i.test([c.title, c.body].join(" "));
    const outfit = tail ? style.outfit.replace(/,? (?:black thigh-high heeled boots|high heel pumps|classic heels|black lace-up high heel sandals|heeled ankle boots|heeled mules|pointed stiletto pumps)/g, "") + ", preserve the complete species tail instead of human legs" : style.outfit;
    return { ...variant, outfit, wardrobeStyle: style.id,
      cameraAngle: tail ? "wide view, complete face and species tail visible" : style.framing + ", complete face toward camera, both eyes visible" };
  }
  root.LeaProfileWardrobe = { styles, options, choose };
})(window);
