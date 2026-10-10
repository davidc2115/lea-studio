/**
 * Léa Studio — Léa uniquement · chat + images Cloudflare profil
 */
const state = {
  character: null,
  chat: { messages: [] },
  view: "discover",
  editMode: false,
  lbIndex: 0,
  sending: false,
  importedCharacters: [],
  leaCharacter: null,
};

const $ = (id) => document.getElementById(id);

async function api(path, opts = {}) {
  if (typeof window.leaNativeApi === "function") {
    try {
      return await window.leaNativeApi(path, {
        method: opts.method || "GET",
        body: opts.body,
      });
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      const bridge = (window.LeaAndroid && typeof window.LeaAndroid.httpPostJson === "function") ? "oui" : "non";
      throw new Error(msg + " [bridge=" + bridge + "]");
    }
  }
  if (String(location.protocol || "").indexOf("file") === 0) {
    throw new Error("API native absente (file://) — réinstalle l'APK du dernier build");
  }
  const res = await fetch(path, {
    method: opts.method || "GET",
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || "HTTP " + res.status);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}
window.leaAppApi = api;


function resolveImgSrc(src) {
  if (!src) return "";
  if (String(src).indexOf("gallery:") === 0) {
    if (window.LeaAndroid && typeof window.LeaAndroid.loadGalleryImage === "function") {
      try {
        const d = window.LeaAndroid.loadGalleryImage(src);
        if (d && d.length > 32) return d;
      } catch (_) {}
    }
    return "";
  }
  return src;
}

function persistGeneratedImage(charId, dataUrl) {
  if (!dataUrl) return "";
  if (String(dataUrl).indexOf("gallery:") === 0) return dataUrl;
  if (window.LeaAndroid && typeof window.LeaAndroid.saveGalleryImage === "function") {
    try {
      const key = window.LeaAndroid.saveGalleryImage(charId || "lea", dataUrl);
      if (key && key.indexOf("gallery:") === 0) return key;
    } catch (_) {}
  }
  return dataUrl;
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function tagPresentation(tag) {
  const value = String(tag || "").trim().toLowerCase();
  if (/^(nsfw|adult|18\+|explicite)$/.test(value)) return { icon: "🔞", kind: "adult", label: "Contenu adulte" };
  if (/orage|pluie|temp[eê]te|feu|neige|for[eê]t/.test(value)) return { icon: "🌦️", kind: "story", label: "Univers et scénario" };
  if (/timide|douce|espi[eè]gle|dr[oô]le|calme|rebelle/.test(value)) return { icon: "💭", kind: "personality", label: "Personnalité" };
  if (/romance|amie|amour|relation|flirt/.test(value)) return { icon: "💞", kind: "relationship", label: "Relation" };
  if (/brune|blonde|rousse|cheveux|yeux|voluptueuse|mince|grande|petite/.test(value)) return { icon: "✨", kind: "appearance", label: "Apparence" };
  return { icon: "✦", kind: "default", label: "Tag" };
}

function renderTagChip(tag) {
  const text = String(tag || "").trim().replace(/^#+/, "");
  if (!text) return "";
  const presentation = tagPresentation(text);
  return `<span class="tag tag--${presentation.kind}" title="${presentation.label}"><span aria-hidden="true">${presentation.icon}</span><span>#${escapeHtml(text)}</span></span>`;
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem("lea.settings") || "{}");
  } catch {
    return {};
  }
}
function saveSettings(s) {
  localStorage.setItem("lea.settings", JSON.stringify(s));
}

function roleplayMemoryKey() {
  return "lea.memory." + String((state.character && state.character.id) || "lea");
}
function loadRoleplayMemory() {
  try {
    const raw = JSON.parse(localStorage.getItem(roleplayMemoryKey()) || "{}");
    return {
      scene: typeof raw.scene === "string" ? raw.scene : "",
      relationship: typeof raw.relationship === "string" ? raw.relationship : "",
      intimacy: typeof raw.intimacy === "string" ? raw.intimacy : "",
      facts: typeof raw.facts === "string" ? raw.facts : "",
      updatedAt: Number(raw.updatedAt) || 0,
    };
  } catch (_) {
    return { scene: "", relationship: "", intimacy: "", facts: "", updatedAt: 0 };
  }
}
function saveRoleplayMemory(memory) {
  const current = loadRoleplayMemory();
  const next = { updatedAt: Date.now() };
  Object.keys(current).filter((key) => key !== "updatedAt").forEach((key) => {
    next[key] = String(memory[key] || "").trim().slice(0, key === "scene" ? 480 : 640);
  });
  localStorage.setItem(roleplayMemoryKey(), JSON.stringify(next));
}
function escapeMemoryMarkup(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function loadCharOverrides() {
  try {
    return JSON.parse(localStorage.getItem("lea.char.lea") || "null");
  } catch {
    return null;
  }
}
function saveCharOverrides(c) {
  localStorage.setItem("lea.char.lea", JSON.stringify(c));
}

function mergeGalleries(baseGallery, overrideGallery) {
  const base = Array.isArray(baseGallery) ? baseGallery.slice() : [];
  const over = Array.isArray(overrideGallery) ? overrideGallery.slice() : [];
  const seen = new Set();
  const out = [];
  // Générées / clés gallery: d'abord, puis assets d'origine
  function push(src) {
    if (!src || seen.has(src)) return;
    seen.add(src);
    out.push(src);
  }
  over.forEach(push);
  base.forEach(push);
  return out.slice(0, 300);
}

function mergeChar(base) {
  const o = loadCharOverrides();
  if (!o) return base;
  const gallery = mergeGalleries(base.gallery || [], o.gallery || []);
  const merged = Object.assign({}, base, o, {
    id: "lea",
    gallery: gallery,
  });
  // Toujours réécrire si les assets d'origine manquent dans l'override
  try {
    const baseCount = (base.gallery || []).filter((x) => String(x).indexOf("images/") === 0).length;
    const overAssets = (o.gallery || []).filter((x) => String(x).indexOf("images/") === 0).length;
    if (baseCount > 0 && overAssets < baseCount) {
      saveCharOverrides(merged);
    }
  } catch (_) {}
  return merged;
}

function showView(name) {
  state.view = name;
  ["discover", "profile", "chat", "settings", "import"].forEach((v) => {
    const el = $("view-" + v);
    if (el) el.classList.toggle("hidden", v !== name);
  });
  document.querySelectorAll(".tabbar .nav").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === name || (name === "profile" && b.dataset.view === "discover"));
  });
  if (name === "discover") renderDiscover();
  if (name === "profile") renderProfile();
  if (name === "chat") renderChat();
  if (name === "settings") renderSettings();
  if (name === "import" && window.LeaImporter) window.LeaImporter.render($("view-import"));
}

function persistActiveCharacter(next) {
  if (next.id === "lea") {
    saveCharOverrides(next);
  } else {
    const index = state.importedCharacters.findIndex((c) => c.id === next.id);
    if (index >= 0) {
      state.importedCharacters[index] = next;
      localStorage.setItem("lea.imported.characters", JSON.stringify(state.importedCharacters));
    }
  }
  state.character = next;
}

function activateCharacter(next) {
  if (!next) return;
  persistActiveCharacter(next);
  state.chat = { messages: [] };
  state.editMode = false;
  localStorage.setItem("lea.activeCharacterId", next.id);
  showView("discover");
}

window.leaOnImportedCharacter = function (character) {
  if (!character || !character.id) return;
  const existing = state.importedCharacters.findIndex((item) => item.id === character.id);
  if (existing >= 0) state.importedCharacters[existing] = character;
  else state.importedCharacters.unshift(character);
  localStorage.setItem("lea.imported.characters", JSON.stringify(state.importedCharacters));
  state.chat = { messages: [] };
  state.editMode = false;
  state.character = character;
  localStorage.setItem("lea.activeCharacterId", character.id);
  showView("discover");
};

function activeChatPath() {
  return "/api/chat/" + encodeURIComponent((state.character && state.character.id) || "lea");
}

function promptCharacterPayload(char) {
  const c = char || {};
  return {
    id: c.id,
    name: c.name,
    age: c.age,
    title: c.title,
    tags: c.tags,
    scenario: c.scenario,
    personality: c.personality,
    appearance: c.appearance,
    system_extra: c.system_extra,
  };
}

function formatMessageHtml(text) {
  const esc = String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // *actions*  (thoughts)  rest = speech
  let out = esc
    .replace(/\(([^)]+)\)/g, '<span class="thought">($1)</span>')
    .replace(/\*([^*]+)\*/g, '<span class="action">*$1*</span>');
  // wrap remaining plain segments lightly
  return out;
}

function renderDiscover() {
  const c = state.character;
  const root = $("view-discover");
  if (!root) return;
  if (!c) {
    root.innerHTML = '<div class="startup-state startup-state--error" role="alert"><strong>Le profil n’a pas pu se charger.</strong><span>Réessaie en touchant « Découvrir » ou ferme puis relance l’application.</span></div>';
    return;
  }
  const cover = c.cover || (c.gallery && c.gallery[0]) || "";
  const coverSrc = resolveImgSrc(cover);
  const tags = (c.tags || []).map(renderTagChip).join("");
  root.innerHTML = `
    <div class="hero-card">
      ${coverSrc ? `<img class="cover" src="${escapeHtml(coverSrc)}" alt="${escapeHtml(c.name)}" onerror="this.classList.add('cover-broken');this.removeAttribute('src');this.alt='Image indisponible';" />` : '<div class="cover cover-placeholder" role="img" aria-label="Aucune image de profil"><span>🖼️</span><span>Image de profil indisponible</span></div>'}
      <div class="hero-gradient">
        <h1>💜 ${escapeHtml(c.name)}</h1>
        <div class="meta">${c.age ? escapeHtml(c.age) + " ans" : "âge non précisé"} · ${escapeHtml(c.title || "")}</div>
        <div class="tags">${tags}</div>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" id="go-chat">💬 Discuter</button>
          <button type="button" class="btn btn-secondary" id="go-profile">👤 Profil</button>
        </div>
      </div>
    </div>
    <div class="section">
      <h2>🌧️ Scénario</h2>
      <p>${(c.scenario || "").slice(0, 280)}${(c.scenario || "").length > 280 ? "…" : ""}</p>
    </div>
    <div class="section">
      <h2>💌 Message d'accueil</h2>
      <div class="greeting-box">
        <div class="label">Premier message de ${escapeHtml(c.name)}</div>
        <div class="body-text">${formatMessageHtml(c.greeting || "")}</div>
      </div>
    </div>
    ${state.importedCharacters.length ? `
      <div class="section">
        <h2>📚 Ma bibliothèque</h2>
        <div class="import-library">
          <button type="button" class="import-library-card" id="activate-lea">
            <span class="cover-placeholder">💜</span>
            <span><strong>Léa Moreau</strong><small>Personnage d’origine</small></span>
          </button>
          ${state.importedCharacters.map((item) => {
            const src = resolveImgSrc(item.cover || "");
            return `<button type="button" class="import-library-card" data-character-id="${escapeHtml(item.id)}">
              ${src ? `<img src="${escapeHtml(src)}" alt="" />` : '<span class="cover-placeholder">🖼️</span>'}
              <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.title || "Personnage importé")}</small></span>
            </button>`;
          }).join("")}
        </div>
      </div>
    ` : ""}
  `;
  $("go-chat") && ($("go-chat").onclick = () => { showView("chat"); });
  $("go-profile") && ($("go-profile").onclick = () => { showView("profile"); });
  root.querySelectorAll("[data-character-id]").forEach((button) => {
    button.onclick = () => {
      const selected = state.importedCharacters.find((item) => item.id === button.dataset.characterId);
      if (selected) activateCharacter(selected);
    };
  });
  const leaButton = $("activate-lea");
  if (leaButton) leaButton.onclick = () => activateCharacter(state.leaCharacter);
}

function renderProfile() {
  const c = state.character;
  const root = $("view-profile");
  if (!c || !root) return;
  const edit = state.editMode;
  const gallery = c.gallery || [];
  const coverSrc = resolveImgSrc(c.cover || gallery[0] || "");
  const field = (key, label, emoji, multiline) => {
    const val = c[key] || "";
    if (!edit) {
      return `<div class="section"><h2>${emoji} ${label}</h2><div class="body-text">${
        key === "greeting" ? formatMessageHtml(val) : escapeHtml(val)
      }</div></div>`;
    }
    return `<div class="section"><h2>${emoji} ${label}</h2>${
      multiline
        ? `<textarea class="edit-area" data-field="${key}">${escapeHtml(val)}</textarea>`
        : `<input class="edit-input" data-field="${key}" value="${escapeHtml(val)}" />`
    }</div>`;
  };

  root.innerHTML = `
    <div class="hero-card" style="margin-bottom:12px">
      ${coverSrc ? `<img class="cover" src="${escapeHtml(coverSrc)}" alt="${escapeHtml(c.name)}" style="max-height:36vh" onerror="this.classList.add('cover-broken');this.removeAttribute('src');this.alt='Image indisponible';" />` : '<div class="cover cover-placeholder" role="img" aria-label="Aucune image de profil" style="max-height:36vh"><span>🖼️</span><span>Image de profil indisponible</span></div>'}
      <div class="hero-gradient">
        <h1>💜 ${escapeHtml(c.name)}</h1>
        <div class="meta">${c.age} ans · ${c.title || ""}</div>
      </div>
    </div>
    ${edit ? `
      <div class="section">
        <h2>✏️ Identité</h2>
        <label class="hint">Nom</label>
        <input class="edit-input" data-field="name" value="${(c.name || "").replace(/"/g, "&quot;")}" />
        <label class="hint" style="margin-top:8px">Âge</label>
        <input class="edit-input" data-field="age" type="number" value="${c.age || ""}" placeholder="Non précisé" />
        <label class="hint" style="margin-top:8px">Titre</label>
        <input class="edit-input" data-field="title" value="${(c.title || "").replace(/"/g, "&quot;")}" />
        <label class="hint" style="margin-top:8px">Tags (virgules)</label>
        <input class="edit-input" data-field="tags" value="${(c.tags || []).join(", ")}" />
        <label class="hint" style="margin-top:8px">Image de couverture (chemin)</label>
        <input class="edit-input" data-field="cover" value="${(c.cover || "").replace(/"/g, "&quot;")}" />
      </div>
    ` : ""}
    ${field("greeting", "Message d'accueil", "💌", true)}
    ${field("scenario", "Scénario", "🌧️", true)}
    ${field("personality", "Tempérament & caractère", "🎭", true)}
    ${field("appearance", "Descriptif physique", "✨", true)}
    ${c.sourceScenario != null ? `
      <div class="section">
        <h2>📥 Fiche source conservée</h2>
        <p class="hint">Origine : <a href="${escapeHtml(c.sourceUrl || "#")}" target="_blank" rel="noopener noreferrer">${escapeHtml(c.source || "Import")}</a></p>
        <label class="hint">Scénario d'origine (inchangé)</label>
        <div class="body-text">${escapeHtml(c.sourceScenario || "Aucun scénario source.")}</div>
        <label class="hint" style="display:block;margin-top:10px">Message d'accueil d'origine (inchangé)</label>
        <div class="body-text">${escapeHtml(c.sourceGreeting || "Aucun message source.")}</div>
        <details class="source-card-details">
          <summary>Afficher la fiche source complète</summary>
          <pre>${escapeHtml(JSON.stringify(c.sourceCard || {}, null, 2))}</pre>
        </details>
      </div>
    ` : ""}
    <div class="section">
      <h2>🖼️ Galerie (${gallery.length})</h2>
      <p class="hint">★ = photo de profil · 🗑️ = supprimer</p>
      <div class="gallery-grid">
        ${gallery.map((src, i) => {
          const isCover = (c.cover === src) || (!c.cover && i === 0);
          const safe = String(src).replace(/"/g, "&quot;");
          return `<div class="gal-card">
            <button type="button" class="gal-img-btn" data-i="${i}">
              <img src="${resolveImgSrc(src)}" alt="Léa ${i+1}" loading="lazy" />
              ${isCover ? '<span class="gal-badge">★ Profil</span>' : ''}
            </button>
            <div class="gal-actions">
              <button type="button" class="gal-btn gal-cover" data-i="${i}" title="Photo de profil">★</button>
              <button type="button" class="gal-btn gal-del" data-i="${i}" title="Supprimer">🗑️</button>
            </div>
          </div>`;
        }).join("")}
      </div>
      ${edit ? `<label class="hint" style="margin-top:10px">Galerie (une URL / chemin par ligne)</label>
        <textarea class="edit-area" data-field="gallery">${gallery.join("\n")}</textarea>` : ""}
    </div>
    ${!edit ? `
    <div class="section">
      <h2>☁️ Générer une image (Cloudflare)</h2>
      <p class="hint">La photo étoilée sert de référence du visage. Choisis une tenue et une pose, ou laisse « Aléatoire » pour alterner. Une seule tentative par clic.</p>
      <label class="hint" for="gen-outfit">Tenue</label>
      <select class="edit-input" id="gen-outfit" style="margin:4px 0 10px">
        <option value="random">Aléatoire — styles variés</option>
        <option value="rain-lace" ${adultCharacter ? "" : "disabled"}>Scénario pluie — crop top dentelle mouillé et jean moulant trempé${adultCharacter ? "" : " (18+)"}</option>
        <option value="satin-dress">Robe satinée décolletée</option>
        <option value="mini-boots">Mini-jupe et cuissardes</option>
        <option value="nightdress" ${adultCharacter ? "" : "disabled"}>Nuisette satinée${adultCharacter ? "" : " (18+)"}</option>
        <option value="lingerie-robe" ${adultCharacter ? "" : "disabled"}>Lingerie dentelle et peignoir${adultCharacter ? "" : " (18+)"}</option>
        <option value="robe">Peignoir en satin</option>
        <option value="towel" ${adultCharacter ? "" : "disabled"}>Serviette de bain, style spa${adultCharacter ? "" : " (18+)"}</option>
      </select>
      <label class="hint" for="gen-pose">Pose</label>
      <select class="edit-input" id="gen-pose" style="margin:4px 0 10px">
        <option value="random">Aléatoire — éviter la pose précédente</option>
        <option value="standing">Debout, trois-quarts, main dans les cheveux</option>
        <option value="seated">Assise de côté sur une chaise</option>
        <option value="walking">En marche vers l’appareil photo</option>
        <option value="wall">Appuyée contre un mur, regard par-dessus l’épaule</option>
        <option value="bed">Assise au bord du lit, jambes de côté</option>
        <option value="stretch">Debout, bras relevés, étirement naturel</option>
        <option value="window">Près d’une fenêtre pluvieuse, regard caméra</option>
      </select>
      <input class="edit-input" id="gen-extra" placeholder="Détail facultatif : expression, accessoire, ambiance…" style="margin-bottom:10px" />
      <p class="hint">Les options nuisette, lingerie et serviette sont réservées aux personnages adultes. Cloudflare peut refuser certains prompts de transparence ou de lingerie (filtre 3030).</p>
      <button type="button" class="btn btn-primary" id="btn-gen-img">✨ Générer (physique fidèle)</button>
      <div id="gen-status" class="hint" style="margin-top:10px"></div>
      <div id="gen-preview" style="margin-top:12px"></div>
    </div>
    ` : ""}
    ${edit ? `
      <div class="edit-actions">
        <button type="button" class="btn btn-primary" id="save-char">💾 Enregistrer</button>
        <button type="button" class="btn btn-secondary" id="cancel-edit">Annuler</button>
        ${c.id === "lea" ? '<button type="button" class="btn btn-secondary" id="reset-char">♻️ Défaut</button>' : ""}
      </div>
    ` : `
      <div class="btn-row">
        <button type="button" class="btn btn-primary" id="prof-chat">💬 Discuter</button>
        <button type="button" class="btn btn-secondary" id="prof-edit">✏️ Modifier</button>
      </div>
    `}
  `;

  root.querySelectorAll(".gal-img-btn").forEach((btn) => {
    btn.onclick = () => openLightbox(Number(btn.dataset.i) || 0);
  });
  root.querySelectorAll(".gal-cover").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const i = Number(btn.dataset.i) || 0;
      const g = (state.character && state.character.gallery) || [];
      if (!g[i]) return;
       const next = Object.assign({}, state.character, { cover: g[i] });
       persistActiveCharacter(next);
      renderProfile();
    };
  });
  root.querySelectorAll(".gal-del").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const i = Number(btn.dataset.i) || 0;
      const g = ((state.character && state.character.gallery) || []).slice();
      if (!g[i]) return;
      if (!confirm("Supprimer cette image de la galerie ?")) return;
      const removed = g.splice(i, 1)[0];
      if (removed && String(removed).indexOf("gallery:") === 0 && window.LeaAndroid && window.LeaAndroid.deleteGalleryImage) {
        try { window.LeaAndroid.deleteGalleryImage(removed); } catch (_) {}
      }
      const next = Object.assign({}, state.character, { gallery: g });
      if (next.cover === removed) next.cover = g[0] || "";
       persistActiveCharacter(next);
      renderProfile();
    };
  });
  if ($("btn-gen-img")) {
    $("btn-gen-img").onclick = () => generateProfileImage();
    if (state.genRunning) {
      $("btn-gen-img").disabled = true;
      $("btn-gen-img").textContent = "⏳ Génération…";
      setGenBanner("⏳ Génération Cloudflare en arrière-plan…", "");
    }
  }
  if ($("prof-chat")) $("prof-chat").onclick = () => showView("chat");
  if ($("prof-edit")) $("prof-edit").onclick = () => { state.editMode = true; renderProfile(); };
  if ($("cancel-edit")) $("cancel-edit").onclick = () => { state.editMode = false; renderProfile(); };
  if ($("reset-char")) $("reset-char").onclick = () => {
    localStorage.removeItem("lea.char.lea");
    state.editMode = false;
    initCharacter().then(() => renderProfile());
  };
  if ($("save-char")) $("save-char").onclick = () => {
       const next = Object.assign({}, c);
    root.querySelectorAll("[data-field]").forEach((el) => {
      const k = el.dataset.field;
      let v = el.value;
       if (k === "age") v = parseInt(v, 10) || null;
      if (k === "tags") v = v.split(/[,;#]+/).map((x) => x.trim()).filter(Boolean);
      if (k === "gallery") v = v.split("\n").map((x) => x.trim()).filter(Boolean);
      next[k] = v;
    });
      if (next.sourceScenario != null) {
        next.system_extra = Number(next.age) >= 18
          ? "Personnage importé. Respecte son scénario et son tempérament; l'intimité doit rester facultative et réciproque."
          : "Âge adulte non confirmé. Roleplay strictement non sexuel; ne sexualise pas le personnage.";
      }
     persistActiveCharacter(next);
    state.editMode = false;
    renderProfile();
  };
}

async function ensureChatStarted() {
  const c = state.character;
  if (!c) return;
  try {
      const data = await api(activeChatPath());
    if (data && Array.isArray(data.messages)) {
      state.chat = data;
    }
  } catch (_) {}
  if (!state.chat.messages || !state.chat.messages.length) {
    // Inject greeting as first message
    const greet = c.greeting || "Salut…";
    state.chat = {
      messages: [{ role: "assistant", content: greet, ts: Date.now() }],
    };
    try {
      await api(activeChatPath(), {
        method: "POST",
        body: JSON.stringify({ messages: state.chat.messages, init: true }),
      });
    } catch (_) {
      localStorage.setItem("lea.chat." + c.id, JSON.stringify(state.chat));
    }
  }
}

function renderChat() {
  const c = state.character;
  const root = $("view-chat");
  if (!c || !root) return;
  const cover = c.cover || (c.gallery && c.gallery[0]) || "";
  root.innerHTML = `
    <div class="chat-wrap">
      <div class="chat-header">
          <img src="${escapeHtml(resolveImgSrc(cover))}" alt="" />
        <div class="info">
           <strong>💜 ${escapeHtml(c.name)}</strong>
           <small>${c.age ? escapeHtml(c.age) + " ans" : "âge non précisé"} · ${escapeHtml(c.title || "")}</small>
        </div>
        <button type="button" class="icon-btn" id="chat-reset" title="Nouvelle conversation" style="margin-left:auto">🔄</button>
      </div>
      <div class="chat-msgs" id="chat-msgs"></div>
      <div class="typing hidden" id="chat-typing">Léa écrit…</div>
      <div class="chat-input-row">
        <textarea id="chat-input" rows="1" placeholder="Écris à Léa… (*action*) (pensée)"></textarea>
        <button type="button" class="send" id="chat-send">➤</button>
      </div>
    </div>
  `;
  paintMessages();
  ensureChatStarted().then(() => paintMessages());

  const input = $("chat-input");
  input && input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(120, input.scrollHeight) + "px";
  });
  $("chat-send") && ($("chat-send").onclick = sendMessage);
  input && input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  $("chat-reset") && ($("chat-reset").onclick = async () => {
       if (!confirm("Recommencer la conversation avec " + c.name + " ?")) return;
    state.chat = { messages: [] };
       localStorage.removeItem("lea.chat." + c.id);
    try {
         await api(activeChatPath(), { method: "DELETE" });
    } catch (_) {}
    await ensureChatStarted();
    paintMessages();
  });
}

function paintMessages() {
  const box = $("chat-msgs");
  if (!box) return;
  const msgs = (state.chat && state.chat.messages) || [];
  box.innerHTML = msgs
    .map((m) => {
      const who = m.role === "user" ? "me" : "them";
      return `<div class="bubble ${who}">${formatMessageHtml(m.content)}</div>`;
    })
    .join("");
  box.scrollTop = box.scrollHeight;
}

async function sendMessage() {
  if (state.sending) return;
  const input = $("chat-input");
  const text = (input && input.value || "").trim();
  if (!text) return;
  input.value = "";
  input.style.height = "auto";
  state.chat.messages = state.chat.messages || [];
  state.chat.messages.push({ role: "user", content: text, ts: Date.now() });
  paintMessages();
  state.sending = true;
  const typing = $("chat-typing");
  if (typing) typing.classList.remove("hidden");
  try {
    const res = await api(activeChatPath(), {
      method: "POST",
      body: JSON.stringify({
        message: text,
        messages: state.chat.messages,
        character: promptCharacterPayload(state.character),
        settings: loadSettings(),
      }),
    });
    const reply = (res && (res.reply || res.content || res.message)) || (res && res.messages && res.messages.slice(-1)[0]?.content);
    if (reply) {
      state.chat.messages.push({ role: "assistant", content: reply, ts: Date.now() });
    } else if (res && Array.isArray(res.messages)) {
      state.chat.messages = res.messages;
    } else {
      state.chat.messages.push({
        role: "assistant",
        content: "(Je… je sais pas quoi dire.)\n*elle joue avec une mèche mouillée*\nTu peux répéter… ?",
        ts: Date.now(),
      });
    }
    localStorage.setItem("lea.chat." + state.character.id, JSON.stringify(state.chat));
  } catch (e) {
    state.chat.messages.push({
      role: "assistant",
      content: `*elle regarde le sol*\nDésolée… j'ai un souci pour répondre (${String(e.message || e).slice(0, 220)}).\nVérifie tes clés API dans ⚙️ Réglages.`,
      ts: Date.now(),
    });
  }
  state.sending = false;
  if (typing) typing.classList.add("hidden");
  paintMessages();
}


function setGenBanner(msg, kind) {
  state.genStatus = { msg: msg, kind: kind || "", ts: Date.now() };
  const status = $("gen-status");
  if (status) {
    const cls = kind === "ok" ? "ok" : kind === "bad" ? "bad" : "";
    status.innerHTML = '<span class="status-pill ' + cls + '">' + msg + "</span>";
  }
  // Bandeau global discret
  let bar = $("gen-banner");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "gen-banner";
    bar.style.cssText = "position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:9999;max-width:90%;padding:8px 14px;border-radius:20px;font-size:13px;background:rgba(40,20,60,0.92);color:#fff;box-shadow:0 4px 20px rgba(0,0,0,0.35);display:none";
    document.body.appendChild(bar);
  }
  if (msg && (state.genRunning || kind === "ok" || kind === "bad")) {
    bar.style.display = "block";
    bar.textContent = msg.replace(/<[^>]+>/g, "");
    if (kind === "ok" || kind === "bad") {
      setTimeout(() => { if (bar && !state.genRunning) bar.style.display = "none"; }, 5000);
    }
  } else if (!state.genRunning) {
    bar.style.display = "none";
  }
}

async function generateProfileImage() {
  if (state.genRunning) {
    setGenBanner("⏳ Une génération est déjà en cours…", "");
    return;
  }
  const c = state.character;
  if (!c) return;
  const st = loadSettings();
  const generationOptions = {
    outfit: ($("gen-outfit") && $("gen-outfit").value) || "random",
    pose: ($("gen-pose") && $("gen-pose").value) || "random",
    note: ($("gen-extra") && $("gen-extra").value.trim()) || "",
  };

  const btn = $("btn-gen-img");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Génération…"; }
  state.genRunning = true;
  setGenBanner("⏳ Génération Cloudflare en arrière-plan…", "");
  await new Promise((r) => setTimeout(r, 30));
  // Job détaché : survit au changement d'onglet
  const jobChar = Object.assign({}, c);
  (async () => {
    try {
      const res = await api("/api/image/cloudflare", {
        method: "POST",
        body: JSON.stringify({
          character: Object.assign(promptCharacterPayload(jobChar), {
            cover: jobChar.cover || (Array.isArray(jobChar.gallery) && jobChar.gallery[0]) || "",
            Poitrine: jobChar.Poitrine || jobChar.poitrine ||
              (jobChar.sourceCard && (jobChar.sourceCard.data || jobChar.sourceCard).Poitrine) || "",
            sourceDescription: jobChar.sourceDescription || "",
            collection: jobChar.collection || "",
          }),
          settings: st,
          extra: generationOptions,
        }),
      });
      if (!res || !res.image) throw new Error((res && res.error) || "Pas d'image renvoyée");
      const dataUrl = res.image;
      const stored = persistGeneratedImage(jobChar.id || "lea", dataUrl);
      // Fusionner avec base + générées (ne jamais perdre les images assets)
      const baseGal = (state.character && state.character.gallery) || jobChar.gallery || [];
      const next = Object.assign({}, state.character || jobChar);
      next.gallery = mergeGalleries(
        baseGal.filter((x) => String(x).indexOf("images/") === 0),
        [stored].concat(baseGal.filter((x) => String(x).indexOf("images/") !== 0))
      );
      // generated first
      next.gallery = [stored].concat(next.gallery.filter((x) => x !== stored)).slice(0, 300);
      next.cover = stored;
       persistActiveCharacter(next);
      state.genRunning = false;
      setGenBanner("✓ Image ajoutée à la galerie (" + next.gallery.length + ")", "ok");
      if (state.view === "profile") {
        try { renderProfile(); } catch (_) {}
      }
    } catch (e) {
      state.genRunning = false;
      setGenBanner("✗ " + String(e.message || e).slice(0, 160), "bad");
      const status = $("gen-status");
      if (status) status.innerHTML = '<span class="status-pill bad">✗ ' + String(e.message || e).slice(0, 280) + "</span>";
    }
    const b = $("btn-gen-img");
    if (b) { b.disabled = false; b.textContent = "✨ Générer (physique fidèle)"; }
  })();
}

function renderSettings() {
  const root = $("view-settings");
  const s = loadSettings();
  const memory = loadRoleplayMemory();
  const origin = (state.character && state.character.scenario) ||
    "Léa est surprise par un orage, vient frapper à la porte et est la meilleure amie de ta fille.";
  root.innerHTML = `
    <div class="section">
      <h2>🔑 Clés API (dialogue)</h2>
      <div class="settings-block">
        <label>Gemini (une clé par ligne)</label>
        <textarea class="edit-area" id="set-gemini" placeholder="aq… ou AIza…">${s.geminiKeys || s.GEMINI_API_KEYS || ""}</textarea>
        <p class="hint">Une clé par ligne (AIza… ou aq…). En cas de <strong>429 quota</strong>, rotation auto vers la clé suivante. Prévoir plusieurs clés gratuites AI Studio.</p>
      </div>
      <div class="settings-block">
        <label>OpenAI (optionnel, une par ligne)</label>
        <textarea class="edit-area" id="set-openai" placeholder="sk-…">${s.openaiKeys || ""}</textarea>
      </div>
      <div class="settings-block">
        <label>Groq (optionnel, une par ligne)</label>
        <textarea class="edit-area" id="set-groq" placeholder="gsk_…">${s.groqKeys || ""}</textarea>
      </div>
    </div>
    <div class="section">
      <h2>☁️ Cloudflare (génération d'images profil)</h2>
      <div class="settings-block">
        <label>Account ID</label>
        <input class="edit-input" id="set-cf-account" value="${(s.cfAccount || "").replace(/"/g, "&quot;")}" placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
      </div>
      <div class="settings-block">
        <label>Tokens API (un par ligne, ou accountId|token)</label>
        <textarea class="edit-area" id="set-cf-keys" placeholder="token…\nou\naccountId|token">${s.cfKeys || s.cfToken || ""}</textarea>
        <p class="hint">Workers AI · FLUX.2 Klein 4B avec la photo de profil comme référence. Une seule requête par génération, sans bascule vers un modèle text-only.</p>
      </div>
    </div>
    <div class="section">
      <h2>👤 Toi (biographie joueur)</h2>
      <div class="settings-block">
        <label>Prénom / nom affiché</label>
        <input class="edit-input" id="set-username" value="${(s.userName || "").replace(/"/g, "&quot;")}" placeholder="Alex" />
      </div>
      <div class="settings-block">
        <label>Biographie (âge, apparence, contexte…)</label>
        <textarea class="edit-area" id="set-bio" placeholder="Homme, 38 ans, …">${s.userBio || ""}</textarea>
      </div>
    </div>
    <div class="section">
      <h2>💬 Chat</h2>
      <div class="settings-block">
        <label>Modèle préféré</label>
        <select class="edit-input" id="set-model">
          <option value="gemini" ${s.chatEngine === "gemini" || !s.chatEngine ? "selected" : ""}>Gemini</option>
          <option value="openai" ${s.chatEngine === "openai" ? "selected" : ""}>OpenAI</option>
          <option value="groq" ${s.chatEngine === "groq" ? "selected" : ""}>Groq</option>
        </select>
      </div>
      <p class="hint">Images profil via Cloudflare (réglages ☁️). Dialogue via Gemini / OpenAI / Groq.</p>
    </div>
    <div class="section memory-section">
      <h2>🧠 Mémoire longue — stockée sur cet appareil</h2>
      <p class="hint">Le scénario de départ reste fixe. Les résumés ci-dessous sont conservés séparément du chat et survivent à « Nouvelle conversation ». Ils ne sont pas synchronisés vers d’autres appareils.</p>
      <div class="settings-block">
        <label>Scénario d’origine (lecture seule)</label>
        <p class="memory-origin">${escapeMemoryMarkup(origin)}</p>
      </div>
      <div class="settings-block">
        <label>Scène actuelle et faits immédiats</label>
        <textarea class="edit-area" id="memory-scene" rows="3" placeholder="Lieu, moment, objets, action en cours…">${escapeMemoryMarkup(memory.scene)}</textarea>
      </div>
      <div class="settings-block">
        <label>Évolution de la relation</label>
        <textarea class="edit-area" id="memory-relationship" rows="3" placeholder="Confiance, affection, limites et évolution réciproque…">${escapeMemoryMarkup(memory.relationship)}</textarea>
      </div>
      <div class="settings-block">
        <label>Moments intimes et limites explicites</label>
        <textarea class="edit-area" id="memory-intimacy" rows="3" placeholder="Seulement les événements qui ont réellement eu lieu dans le jeu…">${escapeMemoryMarkup(memory.intimacy)}</textarea>
      </div>
      <div class="settings-block">
        <label>Faits et promesses partagés</label>
        <textarea class="edit-area" id="memory-facts" rows="3" placeholder="Informations durables à ne pas confondre avec la scène actuelle…">${escapeMemoryMarkup(memory.facts)}</textarea>
      </div>
      <button type="button" class="btn btn-primary" id="save-memory">💾 Enregistrer la mémoire</button>
      <button type="button" class="btn btn-secondary" id="clear-memory">Effacer les souvenirs évolutifs</button>
      <div id="memory-status"></div>
    </div>
    <button type="button" class="btn btn-primary" id="save-settings">💾 Enregistrer les réglages</button>
    <div id="set-status"></div>
  `;
  $("save-settings").onclick = () => {
    const next = Object.assign({}, s, {
      geminiKeys: $("set-gemini").value.trim(),
      openaiKeys: $("set-openai").value.trim(),
      groqKeys: $("set-groq").value.trim(),
      cfAccount: ($("set-cf-account") && $("set-cf-account").value.trim()) || "",
      cfKeys: ($("set-cf-keys") && $("set-cf-keys").value.trim()) || "",
      userName: $("set-username").value.trim(),
      userBio: $("set-bio").value.trim(),
      chatEngine: $("set-model").value,
    });
    saveSettings(next);
    const st = $("set-status");
    st.innerHTML = `<span class="status-pill ok">✓ Enregistré</span>`;
  };
  $("save-memory").onclick = () => {
    saveRoleplayMemory({
      scene: $("memory-scene").value,
      relationship: $("memory-relationship").value,
      intimacy: $("memory-intimacy").value,
      facts: $("memory-facts").value,
    });
    $("memory-status").innerHTML = '<span class="status-pill ok">✓ Mémoire enregistrée sur cet appareil</span>';
  };
  $("clear-memory").onclick = () => {
    if (!confirm("Effacer la scène, la relation et les souvenirs mémorisés ? Le scénario d'origine et l'historique du chat resteront inchangés.")) return;
    saveRoleplayMemory({ scene: "", relationship: "", intimacy: "", facts: "" });
    ["memory-scene", "memory-relationship", "memory-intimacy", "memory-facts"].forEach((id) => { $(id).value = ""; });
    $("memory-status").innerHTML = '<span class="status-pill ok">✓ Souvenirs évolutifs effacés</span>';
  };
}

function openLightbox(i) {
  const g = (state.character && state.character.gallery) || [];
  if (!g.length) return;
  state.lbIndex = ((i % g.length) + g.length) % g.length;
  const lb = $("lightbox");
  const img = $("lightbox-img");
  img.src = resolveImgSrc(g[state.lbIndex]);
  lb.classList.remove("hidden");
}
function closeLightbox() {
  $("lightbox").classList.add("hidden");
}

async function initCharacter() {
  let base = window.__LEA_DEFAULT__ || null;
  try {
    const list = await Promise.race([
      api("/api/characters"),
      new Promise((resolve) => setTimeout(() => resolve(null), 3500)),
    ]);
    if (Array.isArray(list) && list[0]) base = list.find((x) => x.id === "lea") || list[0];
  } catch (_) {}
  if (!base) {
    try {
      const res = await fetch("characters.json");
      // fallback embedded via native
    } catch (_) {}
  }
  if (!base && window.__LEA_DEFAULT__) base = window.__LEA_DEFAULT__;
  if (!base) {
    // last resort minimal
    base = {
      id: "lea",
      name: "Léa Moreau",
      age: 18,
      title: "Meilleure amie de ta fille · Orage",
      tags: ["timide", "amie", "orage"],
      cover: "images/lea-orage-dentelle.jpg",
      gallery: ["images/lea-orage-dentelle.jpg", "images/lea-portrait.jpg"],
      greeting: "Euh… désolée de te déranger… L'orage m'a surprise… Je peux entrer ?",
      scenario: "Léa, trempée, frappe à ta porte.",
      personality: "Timide, douce.",
      appearance: "Brune, cheveux longs, 95D.",
    };
  }
  const lea = mergeChar(base);
  state.leaCharacter = lea;
  const activeId = localStorage.getItem("lea.activeCharacterId");
  state.character = state.importedCharacters.find((item) => item.id === activeId) || lea;
}

function bindNav() {
  document.querySelectorAll(".tabbar .nav").forEach((b) => {
    b.onclick = () => showView(b.dataset.view);
  });
  $("btn-edit-toggle") && ($("btn-edit-toggle").onclick = () => {
    if (state.view !== "profile") showView("profile");
    state.editMode = !state.editMode;
    renderProfile();
  });
  $("lb-close") && ($("lb-close").onclick = closeLightbox);
  $("lightbox") && ($("lightbox").onclick = (e) => {
    if (e.target.id === "lightbox") closeLightbox();
  });
  $("lb-prev") && ($("lb-prev").onclick = (e) => {
    e.stopPropagation();
    openLightbox(state.lbIndex - 1);
  });
  $("lb-next") && ($("lb-next").onclick = (e) => {
    e.stopPropagation();
    openLightbox(state.lbIndex + 1);
  });
}

(async function boot() {
  try {
    bindNav();
    await initCharacter();
    showView("discover");
  } catch (error) {
    console.error("Léa Studio startup failed", error);
    const root = $("view-discover");
    if (root) {
      root.innerHTML = `
        <div class="startup-state startup-state--error" role="alert">
          <strong>Le profil n’a pas pu se charger.</strong>
          <span>Ferme puis relance l’application. Si le problème revient, installe la dernière version.</span>
        </div>`;
    }
  }
})();
