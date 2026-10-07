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
    // Preserve selected necklines, skirts and lined lingerie; only replace
    // instructions that request exposed intimate anatomy.
    const revealing = /nude|naked|topless|transparent|see.through|d[eé]nud|nue\b/i;
    if (!revealing.test(value)) return value;
    const role = [character && character.id, character && character.title, character && character.body].join(" ");
    if (/mermaid|sir[eè]ne/i.test(role)) return "opaque scaled bodice covering the chest, complete mermaid tail";
    if (/nurse|infirmi[eè]re|doctor|m[eé]decin/i.test(role)) return "opaque buttoned medical uniform and trousers";
    if (/office|bureau|coll[eè]gue|secr[eé]taire/i.test(role)) return "opaque closed office blouse and tailored trousers";
    if (/sport|coach|athl[eè]te/i.test(role)) return "opaque sports shirt and full length training trousers";
    return "opaque closed role-appropriate blouse and trousers, no underwear visible";
  }

  function sceneLock(character, variant, extra, identity) {
    const c = character || {}, v = variant || {}, ex = extra || {}, scene = v.scene || {};
    const pose = ex.overridesPose ? ex.poseLine : v.scenarioPose || v.pose;
    const posture = ex.overridesPose ? "" : v.postureAccent;
    const place = ex.overridesPlace ? ex.placeLine : v.place;
    const outfit = ex.overridesOutfit ? ex.outfitLine : v.outfit;
    const smallA = /\bA[\s-]?cup\b|bonnet\s*A\b|very small breast|flat.chested/i.test(identity || "");
    return [
      "(complete face facing camera, both eyes visible, direct eye contact:1.4)",
      compact(identity, 150),
      smallA ? "(very small A cup chest:1.4), (minimal breast projection:1.3)" : "",
      "one adult woman, " + Math.max(18, Number(c.age) || 25) + " years old",
      "CAMERA: " + compact(v.cameraAngle || "wide head-to-knees view", 65),
      "WARDROBE: (" + compact(opaqueOutfit(outfit, c), 165) + ":1.4)",
      posture ? "POSTURE: (" + compact(posture, 55) + ":1.3)" : "",
      "POSE: " + compact(pose, 100),
      "SETTING: " + compact(place, 65),
      scene.prop ? "PROP: " + compact(scene.prop, 50) : "",
      "sharp body and fabric detail, hands in focus, deep focus, natural proportions, environment visible",
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
    if (["right", "left"].includes(direction)) {
      throw new Error("Une référence de face est requise ; le profil ne sera pas recopié.");
    }
    return text;
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

  async function prepareReference(payload, status, options) {
    if (!active() || payload.is_duo) return null;
    if (!payload.source_image && !options) throw new Error("Choisis une photo de référence avant de générer la scène.");
    if (status) status("Segmentation locale du visage et des cheveux…");
    let prepared;
    try {
      prepared = options && root.LeaFrontalReference
        ? await root.LeaFrontalReference.ensure(payload, status || (() => {}), options)
        : JSON.parse(root.LeaAndroid.prepareSegmentedProfileHead(payload.source_image));
    } catch (error) {
      throw new Error("Préparation locale du visage : " + error.message);
    }
    validatePrepared(prepared);
    payload.profile_scene_lock = orientPrompt(payload.profile_scene_lock, prepared.face_direction);
    payload.prompt = orientPrompt(payload.prompt, prepared.face_direction);
    // The provider contract documents WebP masks. Keep the local restoration PNG
    // private to this job, rather than uploading or storing it in the gallery.
    payload.source_processing = "inpainting";
    payload.profile_face_mask = true;
    payload.profile_head_segmented = true;
    payload.profile_identity_lock = true;
    payload.force_img2img = true;
    payload.denoising = 1;
    payload.nsfw = false;
    payload.is_profile_photo = true;
    payload.horde_anonymous = true;
    const restoration = {
      head_image: prepared.head_image,
      head_x: prepared.head_x, head_y: prepared.head_y,
      head_width: prepared.head_width, head_height: prepared.head_height,
      width: WIDTH, height: HEIGHT,
      prepared,
    };
    await setRenderSize(payload, restoration, false);
    return restoration;
  }

  async function setRenderSize(payload, restoration, compactMode = false) {
    const prepared = restoration.prepared;
    if (!prepared) throw new Error("Préparation du visage manquante.");
    const width = compactMode ? WIDTH : 512, height = compactMode ? HEIGHT : 640;
    const scale = width / WIDTH;
    const [source, mask] = await Promise.all([
      loadImage("data:image/webp;base64," + prepared.source_image),
      loadImage("data:image/png;base64," + prepared.source_mask),
    ]);
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d");
    context.fillStyle = "#a6a49e";
    context.fillRect(0, 0, width, height);
    // Uniform scaling preserves the head's proportions. Extra bottom space
    // belongs to the generated scene, not a stretched reference face.
    context.drawImage(source, 0, 0, WIDTH * scale, HEIGHT * scale);
    payload.source_image = canvas.toDataURL("image/webp", .98).split(",")[1];
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = false;
    context.drawImage(mask, 0, 0, WIDTH * scale, HEIGHT * scale);
    payload.source_mask = canvas.toDataURL("image/webp", 1).split(",")[1];
    payload.width = payload.profile_render_width = width;
    payload.height = payload.profile_render_height = height;
    Object.assign(restoration, {
      width, height,
      head_x: Math.round(prepared.head_x * scale), head_y: Math.round(prepared.head_y * scale),
      head_width: Math.round(prepared.head_width * scale), head_height: Math.round(prepared.head_height * scale),
    });
  }

  function sharpenScenePixels(pixels, width, height) {
    if (width < 3 || height < 3 || pixels.length !== width * height * 4) {
      throw new Error("Pixels de la scène incohérents.");
    }
    // Bounded luminance-only unsharp mask: modest contrast, no invented detail,
    // no colour shift, and no amplification of near-flat texture noise.
    const original = new Uint8ClampedArray(pixels);
    const luminance = new Float32Array(width * height);
    for (let n = 0; n < luminance.length; n++) {
      const p = n * 4;
      luminance[n] = .2126 * original[p] + .7152 * original[p + 1] + .0722 * original[p + 2];
    }
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const n = y * width + x, p = n * 4;
        if (original[p + 3] !== 255) continue;
        const blur = (luminance[n - width - 1] + 2 * luminance[n - width] + luminance[n - width + 1] +
          2 * luminance[n - 1] + 4 * luminance[n] + 2 * luminance[n + 1] +
          luminance[n + width - 1] + 2 * luminance[n + width] + luminance[n + width + 1]) / 16;
        const detail = luminance[n] - blur;
        if (Math.abs(detail) < 1.5) continue;
        const boost = Math.max(-8, Math.min(8, .75 * detail));
        for (let channel = 0; channel < 3; channel++) pixels[p + channel] = original[p + channel] + boost;
      }
    }
    return pixels;
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
    const scene = context.getImageData(0, 0, canvas.width, canvas.height);
    sharpenScenePixels(scene.data, canvas.width, canvas.height);
    context.putImageData(scene, 0, 0);
    // Restore the protected head AFTER sharpening, so reference pixels are not
    // sharpened or repainted along with the generated body.
    context.drawImage(head, restoration.head_x, restoration.head_y,
      restoration.head_width, restoration.head_height);
    // Lossless output keeps the selected facial pixels; never repaint the face.
    return canvas.toDataURL("image/png");
  }

  root.LeaSegmentedProfile = { active, sceneLock, opaqueOutfit, prepareReference,
    restoreImage, sharpenScenePixels, setRenderSize, validatePrepared, orientPrompt, WIDTH, HEIGHT };
})(window);
