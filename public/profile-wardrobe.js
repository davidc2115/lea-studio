(function (root) {
  "use strict";
  // Tenues sexy / provocantes inspirées des références photo (mini-robes, décolletés, résille, talons…)
  const styles = [
    { id: "olive-mini-fishnet", label: "Mini robe kaki · résille · escarpins", outfit: "very tight short olive green spaghetti-strap mini dress with deep plunging V neckline, fishnet tights, black stiletto pumps", framing: "full body head to shoes, standing on stairs or elegant interior" },
    { id: "black-backless", label: "Robe noire dos nu · fente · escarpins", outfit: "tight black long-sleeve backless evening dress, deep plunging V neckline, high thigh slit, body-hugging, black high heel pumps", framing: "full body head to shoes, dress silhouette and shoes visible" },
    { id: "emerald-bodycon", label: "Mini robe émeraude moulante · collants · bottines", outfit: "tight emerald green long-sleeve bodycon mini dress with deep V neckline, sheer black tights, black heeled ankle boots", framing: "full body head to shoes, leaning on marble stair rail" },
    { id: "burgundy-satin", label: "Robe satin bordeaux · fente · talons", outfit: "short burgundy satin wrap mini dress with deep V neckline and thigh slit, black stiletto sandals", framing: "full body sitting on edge of bed or standing, legs visible" },
    { id: "navy-sheer-jeans", label: "Top marine décolleté transparent · jean moulant", outfit: "navy blue long-sleeve deep V wrap top with sheer mesh midriff, very tight dark blue skinny jeans, black flats", framing: "full body walking in hallway, head to shoes" },
    { id: "wet-crop-jeans", label: "Crop top mouillé · jean moulant", outfit: "soaking wet light blue tight crop top clinging to the body, bare midriff, tight light blue jeans, wet hair, water droplets on fabric and skin", framing: "medium full body, hallway or doorway" },
    { id: "cutout-crop-ripped", label: "Crop top ajouré · jean troué", outfit: "black long-sleeve crop top with large chest cutout showing cleavage and lace bra, tight blue ripped jeans with knee holes, bare midriff", framing: "full body head to hips, living room" },
    { id: "leather-mini-fishnet", label: "Crop noir · mini-jupe cuir · résille · escarpins", outfit: "black long-sleeve crop top, bare midriff, tight black leather mini skirt, black fishnet stockings, black stiletto pumps", framing: "full body head to shoes on elegant stairs" },
    { id: "crop-mini-garter", label: "Crop asymétrique · mini-jupe · bas résille jarretière", outfit: "black one-shoulder crop top, tight black mini skirt, black fishnet thigh-high stockings with lace garter tops, black patent stiletto pumps", framing: "full body head to shoes on stairs" },
    { id: "deepv-green-boots", label: "Top décolleté · jupe verte · cuissardes", outfit: "black long-sleeve deep V top, tight dark green mini skirt, sheer black tights, black thigh-high heeled boots", framing: "full body head to shoes on grand staircase" },
    { id: "lace-bodysuit", label: "Body dentelle noir sexy", outfit: "black sheer lace lingerie bodysuit with underwire cups, floral lace, straps, high-cut legs, very revealing but not fully nude", framing: "head to upper thighs, hands on hips" },
    { id: "olive-bodycon-curves", label: "Mini robe bodycon kaki décolleté", outfit: "tight olive green satin bodycon mini dress with deep plunging V neckline and thin straps, curves accentuated, no stockings", framing: "three-quarter body, seductive pose" },
    { id: "satin-robe-burgundy", label: "Peignoir satin bordeaux · dentelle", outfit: "open burgundy satin robe with black lace sleeves over matching lingerie, deep neckline, bare legs, barefoot or mules", framing: "sitting on hotel bed, full body" },
    { id: "black-lace-robe", label: "Nuisette noire · peignoir dentelle", outfit: "black lace sheer robe over black satin camisole and shorts, elegant bedroom, seductive seated pose", framing: "full body seated on chaise or bed" },
    { id: "white-crop-jeans", label: "Crop top blanc · jean moulant", outfit: "tight white sports crop top, bare midriff, very tight blue skinny jeans, casual sexy pose hand in hair", framing: "full body in bright hallway" },
    { id: "blouse-mini-heels", label: "Blouse décolletée · mini-jupe · talons lacés", outfit: "white fitted blouse loosely buttoned with plunging neckline, short tight black slit mini skirt, black lace-up high heel sandals", framing: "head to shoes view" },
    { id: "micro-skirt-heels", label: "Top très court · micro-jupe · talons", outfit: "very short tight black low-cut crop top, tight black micro mini skirt, bare waist, pointed stiletto pumps", framing: "head to shoes, full body" },
    { id: "towel-after-shower", label: "Serviette de bain décolleté", outfit: "white bath towel wrapped around the body with deep cleavage, wet hair pulled up, glasses optional", framing: "upper body to mid-thigh, bathroom or window light" },
  ];

  function options() {
    return '<option value="auto">Variée · sexy provocante</option><option value="scenario">Tenue du scénario</option>' +
      styles.map(s => '<option value="' + s.id + '">' + s.label + '</option>').join("");
  }

  function choose(character, variant, selection) {
    selection = selection || "auto";
    const c = character || {};
    const posePool = (typeof root.pickProfileScenePose === "function" && root.pickProfileScenePose(c, variant)) ||
      (typeof root.profileScenePosePool === "function" && (root.profileScenePosePool(c, variant) || [])[0]) || "";
    const sourcePose = String((variant && variant.pose) || posePool || "standing, face toward camera");
    const accents = /sir[eè]ne|mermaid|lamia|naga/i.test([c.title, c.body].join(" "))
      ? ["arched torso, flirty gaze", "shoulders back, alluring gaze", "body angled, teasing smile"]
      : /seat|sitt|sofa|chair|bed|assise/i.test(sourcePose)
        ? ["arched back, thighs angled, flirty gaze", "knees angled, shoulders back, teasing smile", "leaning forward slightly, deep cleavage visible, alluring gaze"]
        : ["arched back, hips angled, flirty gaze", "one hip pushed out, shoulders back, teasing smile", "body angled, weight on one leg, alluring gaze", "leaning on railing, seductive look over shoulder"];
    const poseKey = "lea.profilePosture." + (c.id || "x");
    let previous = "";
    try { previous = localStorage.getItem(poseKey) || ""; } catch (_) {}
    const alternatives = accents.filter(pose => pose !== previous);
    const accent = (alternatives.length ? alternatives : accents)[Math.floor(Math.random() * (alternatives.length || accents.length))];
    try { localStorage.setItem(poseKey, accent); } catch (_) {}
    variant = Object.assign({}, variant, { pose: sourcePose + ", " + accent });

    if (selection === "scenario") {
      return Object.assign({}, variant, { wardrobeStyle: "scenario" });
    }

    // Ne pas écraser costumes fantasy / infirmière
    const role = String(c.title || c.role || "");
    if (selection === "auto" && /elf|kitsune|succub|dragon|catgirl|sir[eè]ne|ange|d[eé]mon|vampir|f[eé]e|dryad|lamia|harpi|slime|andro|louve|centaur|gorgon|oni|naga|ph[eé]nix|fant[oô]me|sorci[eè]re|infirm|m[eé]dec/i.test(role)) {
      return Object.assign({}, variant, { wardrobeStyle: "scenario" });
    }

    let style = null;
    if (selection && selection !== "auto") {
      style = styles.find(s => s.id === selection) || null;
    }
    if (!style) {
      // auto: éviter de répéter la dernière tenue pour ce personnage
      const key = "lea.profileWardrobeLast." + (c.id || "x");
      let last = "";
      try { last = localStorage.getItem(key) || ""; } catch (_) {}
      const pool = styles.filter(s => s.id !== last);
      style = (pool.length ? pool : styles)[Math.floor(Math.random() * (pool.length || styles.length))];
      try { localStorage.setItem(key, style.id); } catch (_) {}
    }

    return Object.assign({}, variant, {
      outfit: style.outfit,
      wardrobeStyle: style.id,
      framing: style.framing,
      place: variant.place || "elegant interior, soft realistic lighting",
    });
  }

  root.LeaProfileWardrobe = { styles: styles, options: options, choose: choose };
})(typeof window !== "undefined" ? window : globalThis);
