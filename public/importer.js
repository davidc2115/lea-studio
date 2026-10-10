(function () {
  const esc = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  let lastQuery = "";
  let pendingChubSession = "";

  function message(root, text, error) {
    const status = root.querySelector("#import-status");
    if (status) {
      status.textContent = text;
      status.className = "hint import-status" + (error ? " bad" : "");
    }
  }

  function renderResults(root, posts) {
    const list = root.querySelector("#import-results");
    if (!list) return;
    if (!posts.length) {
      list.innerHTML = '<p class="empty">Aucun résultat. Essaie d’autres tags.</p>';
      return;
    }
    list.innerHTML = posts.map((post) => {
      const id = String(post.id || "");
      const name = post.character_name || post.meta_name || ("Personnage " + id);
      const tags = (post.tags || []).map((tag) => typeof tag === "string" ? tag : tag.name).filter(Boolean).slice(0, 6);
      return `<article class="import-result">
        <div class="import-result-placeholder">🖼️</div>
        <div class="import-result-content">
          <strong>${esc(name)}</strong>
          <small>${esc(tags.map((tag) => "#" + tag).join(" · "))}</small>
          <p>${esc(post.tagline || post.description_excerpt || "")}</p>
          <button type="button" class="btn btn-primary" data-import-id="${esc(id)}">Importer et adapter</button>
        </div>
      </article>`;
    }).join("");
    list.querySelectorAll("[data-import-id]").forEach((button) => {
      button.onclick = () => importCharacter(root, posts.find((post) => String(post.id) === button.dataset.importId));
    });
  }

  async function search(root) {
    const query = [root.querySelector("#import-query")?.value, root.querySelector("#import-tags")?.value]
      .map((part) => String(part || "").trim()).filter(Boolean).join(" ");
    if (!query) {
      message(root, "Saisis un nom ou un ou plusieurs tags.", true);
      return;
    }
    lastQuery = query;
    const button = root.querySelector("#import-search");
    if (button) { button.disabled = true; button.textContent = "Recherche…"; }
    message(root, "Recherche Botbooru…");
    try {
      const data = await window.leaAppApi("/api/import/botbooru/search?q=" + encodeURIComponent(query));
      if (data && data.error) throw new Error(data.error);
      const posts = Array.isArray(data && data.posts) ? data.posts : [];
      renderResults(root, posts);
      message(root, posts.length ? `${posts.length} résultat(s) affiché(s) sur ${Number(data.total) || posts.length}.` : "Aucun résultat.");
    } catch (error) {
      message(root, "Recherche impossible : " + String(error.message || error), true);
    } finally {
      if (button) { button.disabled = false; button.textContent = "Rechercher"; }
    }
  }

  function compactImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1024 / img.naturalWidth, 1280 / img.naturalHeight, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("Impossible de préparer la photo."));
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => reject(new Error("Image de référence illisible."));
      img.src = dataUrl;
    });
  }

  function explicitAge(data) {
    const raw = data && data.age;
    const value = Number(raw);
    return Number.isInteger(value) && value >= 1 && value <= 120 ? value : null;
  }

  function normalizeChubUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      if (url.protocol !== "https:" || url.hostname !== "chub.ai" ||
          !/^\/characters\/[a-z0-9_-]+\/[a-z0-9_-]+\/?$/i.test(url.pathname)) return "";
      return url.origin + url.pathname.replace(/\/$/, "");
    } catch (_) {
      return "";
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Lecture du PNG impossible."));
      reader.readAsDataURL(file);
    });
  }

  async function importChubCard(root) {
    const button = root.querySelector("#chub-import");
    const jsonFile = root.querySelector("#chub-json")?.files?.[0];
    const imageFile = root.querySelector("#chub-image")?.files?.[0];
    if (!jsonFile || !imageFile) {
      chubMessage(root, "Choisis le JSON et l’image PNG téléchargés depuis Chub.", true);
      return;
    }
    if (jsonFile.size > 5 * 1024 * 1024 || imageFile.size > 12 * 1024 * 1024) {
      chubMessage(root, "Fichier trop volumineux. Limites : JSON 5 Mo, PNG 12 Mo.", true);
      return;
    }
    if (button) { button.disabled = true; button.textContent = "Analyse Gemini Vision…"; }
    chubMessage(root, "Lecture de la carte et analyse de l’image…");
    try {
      const card = JSON.parse(await jsonFile.text());
      const data = card && card.data && typeof card.data === "object" ? card.data : card;
      if (!data || typeof data !== "object" || !String(data.name || data.char_name || "").trim()) {
        throw new Error("Ce fichier ne contient pas de carte de personnage reconnue.");
      }
      const imageDataUrl = await compactImage(await readFileAsDataUrl(imageFile));
      if (typeof window.leaVisionCharacter !== "function") throw new Error("Analyse Gemini Vision indisponible.");
      const adapted = await window.leaVisionCharacter(card, imageDataUrl);
      const chubMeta = data.extensions && data.extensions.chub || {};
      const rawId = chubMeta.id || chubMeta.full_path || data.name;
      const safeId = String(rawId).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
      const id = "chub-" + (safeId || "character");
      const inputUrl = root.querySelector("#chub-url")?.value;
      const sourceUrl = normalizeChubUrl(inputUrl) ||
        (String(chubMeta.full_path || "").match(/^[a-z0-9_-]+\/[a-z0-9_-]+$/i)
          ? "https://chub.ai/characters/" + chubMeta.full_path
          : "");
      let cover = imageDataUrl;
      if (window.LeaAndroid && typeof window.LeaAndroid.saveGalleryImage === "function") {
        const localKey = window.LeaAndroid.saveGalleryImage(id, imageDataUrl);
        if (localKey && String(localKey).indexOf("gallery:") === 0) cover = localKey;
      }
      const age = explicitAge(data);
      const originalScenario = String(data.scenario || "");
      const originalGreeting = String(data.first_mes || data.greeting || "");
      const character = {
        id,
        name: String(data.name || data.char_name || "Personnage importé"),
        age,
        title: String(adapted.title || ""),
        tags: Array.isArray(adapted.tags) ? adapted.tags.slice(0, 12) : [],
        cover,
        gallery: [cover],
        scenario: String(adapted.scenario || originalScenario),
        greeting: String(adapted.greeting || originalGreeting),
        personality: String(adapted.personality || data.personality || ""),
        appearance: String(adapted.appearance || ""),
        system_extra: age >= 18
          ? "Personnage importé. Respecte son scénario et son tempérament; l'intimité doit rester facultative et réciproque."
          : "Âge adulte non confirmé. Roleplay strictement non sexuel; ne sexualise pas le personnage.",
        source: "Chub",
        sourceUrl,
        sourceScenario: originalScenario,
        sourceGreeting: originalGreeting,
        sourcePersonality: String(data.personality || ""),
        sourceDescription: String(data.description || ""),
        sourceCard: card,
        importedAt: Date.now(),
      };
      const existing = JSON.parse(localStorage.getItem("lea.imported.characters") || "[]");
      const next = Array.isArray(existing) ? existing.filter((item) => item.id !== id) : [];
      next.unshift(character);
      localStorage.setItem("lea.imported.characters", JSON.stringify(next));
      if (typeof window.leaOnImportedCharacter === "function") window.leaOnImportedCharacter(character);
      chubMessage(root, `« ${character.name} » ajouté à Ma bibliothèque. La carte JSON d’origine est conservée.`);
    } catch (error) {
      chubMessage(root, "Import non terminé : " + String(error.message || error), true);
    } finally {
      if (button) { button.disabled = false; button.textContent = "Importer la carte"; }
    }
  }

  async function checkPendingChub() {
    const bridge = window.LeaAndroid;
    if (!bridge || typeof bridge.getPendingChubCard !== "function" || pendingChubSession) return;
    let pending;
    try {
      const raw = bridge.getPendingChubCard();
      if (!raw) return;
      pending = JSON.parse(raw);
      if (!pending.sessionId || !pending.cardText || !pending.imageDataUrl) return;
    } catch (error) {
      console.error("Lecture de la carte Chub en attente impossible", error);
      return;
    }

    pendingChubSession = String(pending.sessionId);
    document.querySelector('.tabbar .nav[data-view="import"]')?.click();
    const root = document.querySelector("#view-import");
    if (!root) { pendingChubSession = ""; return; }
    chubMessage(root, "Carte reçue. Ajout du personnage à Ma bibliothèque…");
    try {
      const card = JSON.parse(pending.cardText);
      const data = card && card.data && typeof card.data === "object" ? card.data : card;
      if (!data || !String(data.name || data.char_name || "").trim()) throw new Error("Carte Chub illisible.");
      if (typeof window.leaVisionCharacter !== "function") throw new Error("Analyse Gemini Vision indisponible.");
      const image = await compactImage(pending.imageDataUrl);
      const adapted = await window.leaVisionCharacter(card, image);
      const meta = data.extensions && data.extensions.chub || {};
      const rawId = meta.id || meta.full_path || data.name;
      const safeId = String(rawId).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
      const id = "chub-" + (safeId || "character");
      let cover = image;
      if (typeof bridge.saveGalleryImage === "function") {
        const localKey = bridge.saveGalleryImage(id, image);
        if (localKey && String(localKey).startsWith("gallery:")) cover = localKey;
      }
      const age = explicitAge(data);
      const originalScenario = String(data.scenario || "");
      const originalGreeting = String(data.first_mes || data.greeting || "");
      const character = {
        id, name: String(data.name || data.char_name || "Personnage importé"), age,
        title: String(adapted.title || ""), tags: Array.isArray(adapted.tags) ? adapted.tags.slice(0, 12) : [],
        cover, gallery: [cover], scenario: String(adapted.scenario || originalScenario),
        greeting: String(adapted.greeting || originalGreeting),
        personality: String(adapted.personality || data.personality || ""),
        appearance: String(adapted.appearance || ""),
        system_extra: age >= 18
          ? "Personnage importé. Respecte son scénario et son tempérament; l'intimité doit rester facultative et réciproque."
          : "Âge adulte non confirmé. Roleplay strictement non sexuel; ne sexualise pas le personnage.",
        source: "Chub",
        sourceUrl: normalizeChubUrl("https://chub.ai/characters/" + String(meta.full_path || "")),
        sourceScenario: originalScenario, sourceGreeting: originalGreeting,
        sourcePersonality: String(data.personality || ""), sourceDescription: String(data.description || ""),
        sourceCard: card, importedAt: Date.now(),
      };
      const current = JSON.parse(localStorage.getItem("lea.imported.characters") || "[]");
      const next = Array.isArray(current) ? current.filter((item) => item.id !== id) : [];
      next.unshift(character);
      localStorage.setItem("lea.imported.characters", JSON.stringify(next));
      if (typeof window.leaOnImportedCharacter === "function") window.leaOnImportedCharacter(character);
      if (typeof bridge.clearPendingChubCard === "function") bridge.clearPendingChubCard(pendingChubSession);
      pendingChubSession = "";
      chubMessage(root, `« ${character.name} » a été ajouté directement à Ma bibliothèque.`);
    } catch (error) {
      chubMessage(root, "Ajout impossible : " + String(error.message || error), true);
      pendingChubSession = "";
    }
  }

  function chubMessage(root, text, error) {
    const status = root.querySelector("#chub-status");
    if (status) {
      status.textContent = text;
      status.className = "hint import-status" + (error ? " bad" : "");
    }
  }

  function openChub(root) {
    const url = normalizeChubUrl(root.querySelector("#chub-url")?.value);
    if (!url) {
      chubMessage(root, "Saisis un lien de fiche Chub valide avant de l’ouvrir.", true);
      return;
    }
    if (window.LeaAndroid && typeof window.LeaAndroid.openChubCharacter === "function") {
      if (!window.LeaAndroid.openChubCharacter(url)) chubMessage(root, "Impossible d’ouvrir cette fiche Chub.", true);
      else chubMessage(root, "La fiche s’ouvre dans Léa Studio. Télécharge son JSON et son PNG : le personnage sera ajouté et sélectionné à ton retour.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function importCharacter(root, post) {
    if (!post || !post.id) return;
    const button = root.querySelector(`[data-import-id="${CSS.escape(String(post.id))}"]`);
    if (button) { button.disabled = true; button.textContent = "Analyse Gemini Vision…"; }
    message(root, `Téléchargement de la fiche et analyse visuelle de « ${post.character_name || "ce personnage"} »…`);
    try {
      const card = await window.leaAppApi(`/api/import/botbooru/card/${encodeURIComponent(post.id)}`);
      if (!card || card.error) throw new Error((card && card.error) || "Carte JSON introuvable.");
      const imageResponse = await window.leaAppApi(`/api/import/botbooru/image/${encodeURIComponent(post.id)}`);
      const imageDataUrl = imageResponse && imageResponse.dataUrl;
      if (!imageDataUrl) throw new Error("L’image de référence n’a pas été téléchargée.");
      if (typeof window.leaVisionCharacter !== "function") throw new Error("Analyse Gemini Vision indisponible.");

      const data = card.data && typeof card.data === "object" ? card.data : card;
      const compact = await compactImage(imageDataUrl);
      const adapted = await window.leaVisionCharacter(card, compact);
      const id = "botbooru-" + String(post.id);
      let cover = compact;
      if (window.LeaAndroid && typeof window.LeaAndroid.saveGalleryImage === "function") {
        const localKey = window.LeaAndroid.saveGalleryImage(id, compact);
        if (localKey && String(localKey).indexOf("gallery:") === 0) cover = localKey;
      }
      const age = explicitAge(data);
      const originalScenario = String(data.scenario || "");
      const originalGreeting = String(data.first_mes || data.greeting || "");
      const character = {
        id,
        name: String(data.name || data.char_name || post.character_name || "Personnage importé"),
        age,
        title: String(adapted.title || ""),
        tags: Array.isArray(adapted.tags) ? adapted.tags.slice(0, 12) : [],
        cover,
        gallery: [cover],
        scenario: String(adapted.scenario || originalScenario),
        greeting: String(adapted.greeting || originalGreeting),
        personality: String(adapted.personality || data.personality || ""),
        appearance: String(adapted.appearance || ""),
        system_extra: age >= 18
          ? "Personnage importé. Respecte son scénario et son tempérament; l'intimité doit rester facultative et réciproque."
          : "Âge adulte non confirmé. Roleplay strictement non sexuel; ne sexualise pas le personnage.",
        source: "Botbooru",
        sourceUrl: `https://botbooru.com/post/${encodeURIComponent(post.id)}`,
        sourceScenario: originalScenario,
        sourceGreeting: originalGreeting,
        sourcePersonality: String(data.personality || ""),
        sourceDescription: String(data.description || ""),
        sourceCard: card,
        importedAt: Date.now(),
      };
      const existing = JSON.parse(localStorage.getItem("lea.imported.characters") || "[]");
      const next = Array.isArray(existing) ? existing.filter((item) => item.id !== id) : [];
      next.unshift(character);
      localStorage.setItem("lea.imported.characters", JSON.stringify(next));
      if (typeof window.leaOnImportedCharacter === "function") window.leaOnImportedCharacter(character);
      message(root, `« ${character.name} » ajouté à Ma bibliothèque. Le scénario source est conservé séparément.`);
    } catch (error) {
      message(root, "Import non terminé : " + String(error.message || error), true);
    } finally {
      if (button) { button.disabled = false; button.textContent = "Importer et adapter"; }
    }
  }

  function render(root) {
    root.innerHTML = `
      <div class="section">
        <h2>⬇️ Importer un personnage</h2>
        <p class="hint">Recherche dans Botbooru par nom ou tags. La fiche d’origine reste conservée; Gemini Vision analyse l’image et adapte les champs de jeu.</p>
        <label class="hint" for="import-query">Nom ou mots-clés</label>
        <input class="edit-input" id="import-query" placeholder="Ex. mage, détective, fantasy" value="${esc(lastQuery)}" />
        <label class="hint" for="import-tags" style="display:block;margin-top:10px">Tags supplémentaires</label>
        <input class="edit-input" id="import-tags" placeholder="Ex. fantasy, romance" />
        <button type="button" class="btn btn-primary" id="import-search" style="margin-top:12px">Rechercher</button>
        <p class="hint import-status" id="import-status">Les résultats sont limités au contenu tout public.</p>
      </div>
      <div id="import-results" class="import-results"></div>
      <div class="section chub-import-section">
        <h2>🌐 Importer depuis Chub</h2>
        <p class="hint">Ouvre la fiche dans Léa Studio et télécharge sa carte JSON et son image PNG. À ton retour, le personnage est ajouté directement à Ma bibliothèque, sans passer par les Téléchargements publics.</p>
        <label class="hint" for="chub-url">Lien public de la fiche</label>
        <input class="edit-input" id="chub-url" type="url" placeholder="https://chub.ai/characters/auteur/personnage" />
        <button type="button" class="btn btn-secondary" id="chub-open" style="margin-top:10px">Voir la fiche sur Chub</button>
        <label class="hint" for="chub-json" style="display:block;margin-top:14px">Carte JSON</label>
        <input class="edit-input" id="chub-json" type="file" accept=".json,application/json" />
        <label class="hint" for="chub-image" style="display:block;margin-top:10px">Image PNG de la carte</label>
        <input class="edit-input" id="chub-image" type="file" accept=".png,image/png" />
        <button type="button" class="btn btn-primary" id="chub-import" style="margin-top:12px">Importer la carte</button>
        <p class="hint import-status" id="chub-status">Tu peux aussi importer manuellement une paire JSON + PNG.</p>
      </div>
    `;
    root.querySelector("#import-search").onclick = () => search(root);
    root.querySelector("#import-query").addEventListener("keydown", (event) => {
      if (event.key === "Enter") search(root);
    });
    root.querySelector("#chub-open").onclick = () => openChub(root);
    root.querySelector("#chub-import").onclick = () => importChubCard(root);
  }

  window.LeaImporter = { render, checkPendingChub };
})();
