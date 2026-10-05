(function (root) {
  "use strict";
  const FACE = "(head facing camera, complete unobstructed face, both eyes visible, direct eye contact:1.4)";
  function fingerprint(value) {
    const text = String(value || "");
    let a = 2166136261, b = 5381;
    for (let i = 0; i < text.length; i++) {
      a = Math.imul(a ^ text.charCodeAt(i), 16777619);
      b = Math.imul(b, 33) ^ text.charCodeAt(i);
    }
    return text.length + ":" + (a >>> 0) + ":" + (b >>> 0);
  }
  function prompt(character, identity) {
    return [FACE, "single adult woman, " + Math.max(18, Number(character.age) || 25) + " years old",
      "frontal head-and-shoulders photograph, upright head, camera at eye level",
      "opaque fully buttoned blouse, chest covered, plain softly lit background",
      String(identity || "").replace(/full body or head to knees, face visible, setting visible/gi, "").slice(0, 300),
      "same woman as reference when provided, natural facial proportions, natural eyes, RAW DSLR photograph, unretouched skin texture"].join(", ");
  }
  function readPreparation(source) {
    let result;
    try { result = JSON.parse(root.LeaAndroid.prepareSegmentedProfileHead(source)); }
    catch (_) { throw new Error("Préparation locale du visage indisponible."); }
    if (result && result.ok && ["left", "right"].includes(result.face_direction)) {
      return { ok: false, needs_frontal_reference: true };
    }
    return result;
  }
  async function ensure(payload, status, options) {
    const { character, generate, resolve, persist, storage } = options;
    if (!character || !character.id) throw new Error("Personnage de référence manquant.");
    const selected = payload.source_image || "";
    let generationSource = selected;
    const sourceKey = fingerprint(selected);
    const key = "lea.frontal.reference." + character.id;
    let cached;
    try { cached = JSON.parse(storage.getItem(key) || "null"); } catch (_) {}
    if (cached && cached.sourceKey === sourceKey && cached.image) {
      const image = await resolve(cached.image);
      if (image) {
        const prepared = readPreparation(image);
        if (prepared && prepared.ok) return prepared;
      }
    }
    if (selected) {
      const prepared = readPreparation(selected);
      if (prepared && prepared.ok) return prepared;
      if (!prepared || !prepared.needs_frontal_reference) {
        throw new Error(prepared && prepared.error || "La référence choisie est illisible ; aucune autre identité substituée.");
      }
      generationSource = prepared.frontal_source || selected;
    }
    status(selected
      ? "Préparation d'une vue de face depuis la référence choisie ; ressemblance non garantie…"
      : "Création de la première référence de face…");
    const image = await generate({
      engine: "horde", charId: character.id,
      prompt: prompt(character, options.identity),
      profile_scene_lock: prompt(character, options.identity),
      negative: "side profile, head turned away, looking away, hidden eye, covered face, cropped head, nude, underwear, transparent clothing",
      is_profile_photo: true, horde_anonymous: true, nsfw: false,
      profile_frontal_reference: true,
      profile_identity_lock: true,
      ...(selected ? { source_image: generationSource, source_processing: "img2img", force_img2img: true, denoising: .9 } : {}),
    });
    if (!image) throw new Error("Aucune référence de face reçue.");
    const prepared = readPreparation(image);
    if (!prepared || !prepared.ok) {
      throw new Error("Le résultat ne fournit pas un visage de face exploitable ; aucune photo ajoutée. " +
        (prepared && prepared.error || ""));
    }
    // Validate before persistence. Do not replace the selected/starred picture.
    const stored = await persist(image, character.id);
    storage.setItem(key, JSON.stringify({ sourceKey, image: stored }));
    return prepared;
  }
  root.LeaFrontalReference = { ensure, prompt, fingerprint, FACE };
})(window);
