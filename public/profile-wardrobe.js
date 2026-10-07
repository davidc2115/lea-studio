(function (root) {
  "use strict";
  const styles = [
    { id: "black-backless", label: "Robe noire sculptante · dos nu · fente très haute", outfit: "bodycon black backless dress, plunging V neckline, very high thigh slit, opaque bodice, thin straps, high heel pumps", framing: "head to shoes view, dress silhouette and shoes visible" },
    { id: "emerald-satin", label: "Mini-robe satin · fines bretelles · décolleté plongeant", outfit: "tight emerald satin mini dress, plunging neckline, thin straps, side slit, bare shoulders, opaque bodice, classic heels", framing: "three-quarter body view, hands and dress visible" },
    { id: "blouse-mini", label: "Blouse nouée décolletée · micro-jupe · talons lacés", outfit: "white blouse tied at waist, deep open neckline, opaque chest coverage, tight black slit micro skirt, black lace-up high heel sandals", framing: "head to shoes view, skirt and lace-up sandals visible" },
    { id: "lace-body", label: "Body dentelle échancré · décolleté plongeant", outfit: "black high-cut lace bodysuit, plunging neckline, opaque lined cups and briefs, floral lace, chest and pelvis covered", framing: "head to upper thighs view, complete bodysuit visible" },
    { id: "crop-jeans", label: "Crop top dos nu très court · jean taille basse moulant", outfit: "tiny fitted halter crop top, deep neckline, opaque chest coverage, bare midriff, tight low-rise blue jeans, heeled ankle boots", framing: "head to shoes view, waist and jeans visible" },
    { id: "burgundy-robe", label: "Peignoir tombant des épaules · nuisette satin très courte", outfit: "burgundy satin robe draped below shoulders, very short opaque satin slip dress, plunging neckline, lace hem, heeled mules", framing: "head to shoes view, satin robe and legs visible" },
    { id: "mini-boots", label: "Mini-robe sculptante · découpes taille · cuissardes", outfit: "bodycon dark green mini dress, plunging V neckline, waist cutouts, opaque bodice and skirt, black thigh-high heeled boots", framing: "head to shoes view, complete thigh-high boots visible" },
    { id: "leather-skirt", label: "Bustier corseté · micro-jupe cuir fendue · talons aiguilles", outfit: "low-cut fitted black corset top, opaque lined chest, bare waist, tight black leather slit micro skirt, pointed stiletto pumps", framing: "head to shoes view, leather skirt and pumps visible" },
  ];
  function options() {
    return '<option value="auto">Variée · inspirée des exemples</option><option value="scenario">Tenue du scénario</option>' +
      styles.map(s => '<option value="' + s.id + '">' + s.label + '</option>').join("");
  }
  function choose(character, variant, selection = "auto") {
    const c = character || {};
    const sourcePose = String(variant && variant.pose || "standing, face toward camera");
    const accents = /sir[eè]ne|mermaid|lamia|naga/i.test([c.title, c.body].join(" "))
      ? ["arched torso, shoulders drawn back", "torso angled, curved waist, shoulders back", "leaning forward slightly, graceful curved torso"]
      : /seat|sitt|sofa|chair|bed|assise/i.test(sourcePose)
        ? ["arched back, knees together angled sideways", "leaning forward from hips, shoulders back", "reclining slightly, hips angled, knees together"]
        : ["arched back, hip pushed out, one knee bent", "S-curve stance, hips tilted, shoulders drawn back", "leaning forward from hips, shoulders back"];
    const poseKey = "lea.profilePosture." + (c.id || "x");
    let previous = "";
    try { previous = localStorage.getItem(poseKey) || ""; } catch (_) {}
    const alternatives = accents.filter(pose => pose !== previous);
    const accent = alternatives[Math.floor(Math.random() * alternatives.length)];
    try { localStorage.setItem(poseKey, accent); } catch (_) {}
    variant = { ...variant, pose: sourcePose + ", " + accent,
      scenarioPose: sourcePose, postureAccent: accent };
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
      const pool = styles.filter(s => !work || ["blouse-mini", "emerald-satin", "leather-skirt", "mini-boots"].includes(s.id));
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
