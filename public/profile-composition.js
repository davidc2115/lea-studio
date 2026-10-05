(function (root) {
  "use strict";
  // Experimental canvas. Horde's anonymous limits vary with server demand.
  const WIDTH = 512, HEIGHT = 704;

  function faceLayout(face, width, height) {
    if (!face || ![face.x, face.y, face.width, face.height, width, height].every(Number.isFinite)) {
      throw new Error("Coordonnées du visage invalides.");
    }
    const x = Math.max(0, face.x), y = Math.max(0, face.y);
    const w = Math.min(face.width, width - x), h = Math.min(face.height, height - y);
    if (w < 20 || h < 20) throw new Error("Visage trop petit dans la référence.");
    const scale = Math.min(112 / w, 136 / h);
    const dw = Math.round(w * scale), dh = Math.round(h * scale);
    return { x, y, width: w, height: h, dx: Math.round((WIDTH - dw) / 2), dy: 60, dw, dh };
  }

  function stripDataUrl(value) {
    return String(value || "").replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
  }

  async function loadImage(source) {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("Impossible de lire la référence."));
      image.src = /^data:/i.test(source) ? source : "data:image/jpeg;base64," + source;
    });
    return image;
  }

  async function findFace(image, source) {
    if (root.LeaAndroid && typeof root.LeaAndroid.detectProfileFace === "function") {
      const found = JSON.parse(root.LeaAndroid.detectProfileFace(source));
      if (!found.ok) throw new Error(found.error || "Visage non détecté.");
      return found.face;
    }
    if (typeof root.FaceDetector === "function") {
      const faces = await new root.FaceDetector({ fastMode: false, maxDetectedFaces: 2 }).detect(image);
      if (faces.length !== 1) throw new Error("Une seule personne de face est nécessaire.");
      const b = faces[0].boundingBox;
      return { x: b.x - b.width * .12, y: b.y - b.height * .4, width: b.width * 1.24, height: b.height * 1.5 };
    }
    throw new Error("Détection du visage indisponible sur cet appareil.");
  }

  async function prepareReference(payload, status) {
    if (!payload || payload.is_duo || !payload.source_image || payload.profile_face_mask) return payload;
    if (root.LEA_ENABLE_EXPERIMENTAL_FACE_MASK !== true) {
      payload.profile_reference_note = "Référence entière conservée ; masque expérimental non validé";
      return payload;
    }
    const original = payload.source_image;
    try {
      const image = await loadImage(original);
      const face = await findFace(image, original);
      const r = faceLayout(face, image.naturalWidth, image.naturalHeight);
      const source = document.createElement("canvas"), mask = document.createElement("canvas");
      source.width = mask.width = WIDTH; source.height = mask.height = HEIGHT;
      const s = source.getContext("2d"), m = mask.getContext("2d");
      s.fillStyle = "#98938e"; s.fillRect(0, 0, WIDTH, HEIGHT);
      s.drawImage(image, r.x, r.y, r.width, r.height, r.dx, r.dy, r.dw, r.dh);
      m.fillStyle = "#fff"; m.fillRect(0, 0, WIDTH, HEIGHT);
      // White regenerates body/background; black protects the face and hair.
      m.save();
      m.translate(r.dx + r.dw / 2, r.dy + r.dh / 2);
      m.scale(r.dw / 2, r.dh / 2);
      const edge = m.createRadialGradient(0, 0, .88, 0, 0, 1);
      edge.addColorStop(0, "#000"); edge.addColorStop(1, "#fff");
      m.fillStyle = edge; m.beginPath(); m.arc(0, 0, 1, 0, Math.PI * 2); m.fill();
      m.restore();
      payload.source_image = stripDataUrl(source.toDataURL("image/webp", .96));
      payload.source_mask = stripDataUrl(mask.toDataURL("image/webp", 1));
      payload.source_processing = "inpainting";
      payload.profile_face_mask = true;
      payload.force_img2img = true;
      payload.width = WIDTH; payload.height = HEIGHT;
      payload.denoising = 1;
      payload.nsfw = false;
      payload.profile_reference_note = "Visage protégé ; corps et décor régénérés";
      if (status) status(payload.profile_reference_note + "…");
    } catch (error) {
      // Keep the chosen identity rather than silently switching to a new face.
      payload.source_image = original;
      payload.source_processing = "img2img";
      delete payload.source_mask;
      payload.profile_face_mask = false;
      payload.profile_reference_note = "Référence entière conservée : " + error.message;
      if (status) status(payload.profile_reference_note);
    }
    return payload;
  }

  function sceneLock(c, variant, ex, identity) {
    if (!c || !variant) return "";
    const item = ex || {};
    const scene = variant.scene || {};
    const pose = item.overridesPose ? item.poseLine : variant.pose;
    const place = item.overridesPlace ? item.placeLine : variant.place;
    const outfit = item.overridesOutfit ? item.outfitLine : variant.outfit;
    const camera = variant.cameraAngle || "wide head-to-knees view, room and furniture visible";
    const mermaid = /mermaid|sir[eè]ne/i.test([c.id, c.title, c.body, ...(c.tags || [])].join(" "));
    // Fixed budgets for each instruction, not a blind cut of the entire prompt.
    const compact = (s, max) => String(s || "").replace(/\s+/g, " ").trim().slice(0, max);
    return [
      compact(identity, 140),
      "one adult woman, " + Math.max(18, Number(c.age) || 25) + " years old",
      "CAMERA: " + compact(camera, 72),
      "POSE: " + compact(pose, 140),
      "SETTING: " + compact(place, 110),
      "WARDROBE: " + compact(outfit, 110),
      scene.prop ? "PROP: " + compact(scene.prop, 50) : "",
      "fully clothed fashion photo, playful confident gaze, natural body proportions",
      mermaid
        ? "body turned three quarters, face toward camera; scaled tail and environment visible, no human legs"
        : "body turned three quarters, face toward camera; visible legs and environment",
    ].filter(Boolean).join(", ");
  }

  root.LeaProfileComposition = { faceLayout, prepareReference, sceneLock, WIDTH, HEIGHT };
})(window);
