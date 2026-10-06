(function (root) {
  "use strict";
  const styles = [
    { id: "black-backless", label: "Robe noire dos nu · escarpins", outfit: "fitted long black backless evening dress, opaque front, high heel pumps", framing: "head to shoes view, dress silhouette and shoes visible" },
    { id: "emerald-satin", label: "Robe satin vert · épaules dégagées", outfit: "emerald green satin wrap dress with V neckline, cream cardigan draped below shoulders, delicate necklace, classic heels", framing: "three-quarter body view, hands and dress visible" },
    { id: "blouse-mini", label: "Blouse blanche · mini-jupe · talons lacés", outfit: "white lightweight deep V blouse over an opaque matching camisole, fitted black mini skirt, black lace-up high heel sandals", framing: "head to shoes view, skirt and lace-up sandals visible" },
    { id: "lace-body", label: "Body noir en dentelle", outfit: "black lace bodysuit with opaque lined cups and opaque briefs, delicate floral lace, chest and pelvis covered", framing: "head to upper thighs view, complete bodysuit visible" },
    { id: "crop-jeans", label: "Crop top ajusté · jean", outfit: "fitted cropped top with flattering V neckline, fitted blue jeans, heeled ankle boots", framing: "head to shoes view, waist and jeans visible" },
    { id: "burgundy-robe", label: "Peignoir satin bordeaux · nuisette", outfit: "burgundy satin robe over a matching short opaque satin slip dress with lace trim, relaxed sleeves, heeled mules", framing: "head to shoes view, satin robe and legs visible" },
    { id: "mini-boots", label: "Robe courte décolletée · cuissardes", outfit: "fitted short dark green dress with plunging V neckline and opaque bodice, black thigh-high heeled boots", framing: "head to shoes view, complete thigh-high boots visible" },
    { id: "leather-skirt", label: "Top court · jupe cuir · escarpins", outfit: "fitted black cropped V-neck top, short black leather skirt, pointed stiletto pumps", framing: "head to shoes view, leather skirt and pumps visible" },
  ];
  function options() {
    return '<option value="auto">Variée · inspirée des exemples</option><option value="scenario">Tenue du scénario</option>' +
      styles.map(s => '<option value="' + s.id + '">' + s.label + '</option>').join("");
  }
  function choose(character, variant, selection = "auto") {
    const c = character || {};
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
      const pool = styles.filter(s => work ? ["blouse-mini", "emerald-satin"].includes(s.id) : s.id !== "lace-body");
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
