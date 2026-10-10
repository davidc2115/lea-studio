(function () {
  const esc = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  let lastQuery = "";

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
    `;
    root.querySelector("#import-search").onclick = () => search(root);
    root.querySelector("#import-query").addEventListener("keydown", (event) => {
      if (event.key === "Enter") search(root);
    });
  }

  window.LeaImporter = { render };
})();
