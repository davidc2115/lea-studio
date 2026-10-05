(function (root) {
  "use strict";

  // Enabled after two uncensored, visually checked seated/standing scene renders
  // with local matte restoration. The older elliptical-mask experiment stays off.
  const ENABLED = true;
  const WIDTH = 384, HEIGHT = 512;

  function active() {
    return ENABLED && root.LeaAndroid &&
      typeof root.LeaAndroid.prepareSegmentedProfileHead === "function";
  }

  function compact(text, budget) {
    return String(text || "").replace(/\s+/g, " ").trim().slice(0, budget);
  }

  function opaqueOutfit(outfit, character) {
    const value = compact(outfit, 150);
    const revealing = /lingerie|transparent|sheer|see.through|nude|naked|topless|bra\b|panties|thong|nuisette|sous.v[eê]tement|d[eé]nud|nue\b/i;
    if (!revealing.test(value)) return "opaque fabric, " + value + ", fully closed clothing";
    const role = [character && character.id, character && character.title, character && character.body].join(" ");
    if (/mermaid|sir[eè]ne/i.test(role)) return "opaque scaled bodice covering the chest, complete mermaid tail";
    if (/nurse|infirmi[eè]re|doctor|m[eé]decin/i.test(role)) return "opaque buttoned medical uniform and trousers";
    if (/office|bureau|coll[eè]gue|secr[eé]taire/i.test(role)) return "opaque closed office blouse and tailored trousers";
    if (/sport|coach|athl[eè]te/i.test(role)) return "opaque sports shirt and full length training trousers";
    return "opaque closed role-appropriate blouse and trousers, no underwear visible";
  }

  function sceneLock(character, variant, extra, identity) {
    const c = character || {}, v = variant || {}, ex = extra || {}, scene = v.scene || {};
    const pose = ex.overridesPose ? ex.poseLine : v.pose;
    const place = ex.overridesPlace ? ex.placeLine : v.place;
    const outfit = ex.overridesOutfit ? ex.outfitLine : v.outfit;
    const smallA = /\bA[\s-]?cup\b|bonnet\s*A\b|very small breast|flat.chested/i.test(identity || "");
    return [
      compact(identity, 175),
      smallA ? "(very small A cup chest:1.4), (minimal breast projection:1.3)" : "",
      "one adult woman, " + Math.max(18, Number(c.age) || 25) + " years old",
      "CAMERA: " + compact(v.cameraAngle || "wide head-to-knees view", 65),
      "POSE: " + compact(pose, 125),
      "SETTING: " + compact(place, 100),
      "WARDROBE: (" + compact(opaqueOutfit(outfit, c), 130) + ":1.4)",
      scene.prop ? "PROP: " + compact(scene.prop, 50) : "",
      "fully clothed, face toward camera, soft natural light, environment visible, natural proportions",
    ].filter(Boolean).join(", ").slice(0, 920);
  }

  function validatePrepared(result) {
    if (!result || result.ok !== true) {
      throw new Error(result && result.error || "Préparation locale du visage impossible.");
    }
    if (result.width !== WIDTH || result.height !== HEIGHT ||
        ![result.head_x, result.head_y, result.head_width, result.head_height].every(Number.isInteger) ||
        result.head_x < 0 || result.head_y < 0 || result.head_width < 20 || result.head_height < 30 ||
        result.head_x + result.head_width > WIDTH || result.head_y + result.head_height > HEIGHT ||
        !result.source_image || !result.source_mask || !result.head_image) {
      throw new Error("Préparation du visage incohérente ; aucune génération envoyée.");
    }
  }

  function orientPrompt(text, direction) {
    if (!["right", "left"].includes(direction)) return text;
    return String(text || "").replace(/face toward camera|gaze toward camera|looking (?:at|toward) camera/gi,
      "head in " + direction + "-facing profile, body pose independent of head");
  }

  async function loadImage(source) {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("Image de référence illisible."));
      image.src = source;
    });
    return image;
  }

  async function prepareReference(payload, status) {
    if (!active() || payload.is_duo) return null;
    if (!payload.source_image) throw new Error("Choisis une photo de référence avant de générer la scène.");
    if (status) status("Segmentation locale du visage et des cheveux…");
    let prepared;
    try {
      prepared = JSON.parse(root.LeaAndroid.prepareSegmentedProfileHead(payload.source_image));
    } catch (error) {
      throw new Error("Préparation locale du visage : " + error.message);
    }
    validatePrepared(prepared);
    payload.profile_scene_lock = orientPrompt(payload.profile_scene_lock, prepared.face_direction);
    payload.prompt = orientPrompt(payload.prompt, prepared.face_direction);
    // The provider contract documents WebP masks. Keep the local restoration PNG
    // private to this job, rather than uploading or storing it in the gallery.
    const mask = await loadImage("data:image/png;base64," + prepared.source_mask);
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH; canvas.height = HEIGHT;
    canvas.getContext("2d").drawImage(mask, 0, 0);
    payload.source_image = prepared.source_image;
    payload.source_mask = canvas.toDataURL("image/webp", 1).split(",")[1];
    payload.source_processing = "inpainting";
    payload.profile_face_mask = true;
    payload.profile_head_segmented = true;
    payload.profile_identity_lock = true;
    payload.force_img2img = true;
    payload.width = WIDTH; payload.height = HEIGHT;
    payload.denoising = 1;
    payload.nsfw = false;
    payload.is_profile_photo = true;
    payload.horde_anonymous = true;
    return {
      head_image: prepared.head_image,
      head_x: prepared.head_x, head_y: prepared.head_y,
      head_width: prepared.head_width, head_height: prepared.head_height,
      width: WIDTH, height: HEIGHT,
    };
  }

  async function restoreImage(url, restoration) {
    if (!restoration) return url;
    let dataUrl = url;
    if (!String(url).startsWith("data:")) {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Téléchargement de la scène impossible ; aucune photo ajoutée.");
      const blob = await response.blob();
      dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Lecture de la scène impossible."));
        reader.readAsDataURL(blob);
      });
    }
    const image = await loadImage(dataUrl);
    if (image.naturalWidth !== restoration.width || image.naturalHeight !== restoration.height) {
      throw new Error("Horde a changé le cadrage ; aucune recomposition ni photo ajoutée.");
    }
    const head = await loadImage("data:image/png;base64," + restoration.head_image);
    const canvas = document.createElement("canvas");
    canvas.width = restoration.width; canvas.height = restoration.height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    context.drawImage(head, restoration.head_x, restoration.head_y,
      restoration.head_width, restoration.head_height);
    // Lossless output keeps the selected facial pixels; never repaint the face.
    return canvas.toDataURL("image/png");
  }

  root.LeaSegmentedProfile = { active, sceneLock, opaqueOutfit, prepareReference,
    restoreImage, validatePrepared, orientPrompt, WIDTH, HEIGHT };
})(window);
