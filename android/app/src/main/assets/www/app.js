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
  castCharacters: [],
  leaCharacter: null,
  chatListMode: true,
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
    const hasBridge = !!(window.LeaAndroid);
    throw new Error(
      hasBridge
        ? "Module natif incomplet (leaNativeApi manquant) — réinstalle l'APK du dernier build vert"
        : "Pont Android absent (LeaAndroid) — ouvre l'app installée (pas Chrome) et réinstalle l'APK du dernier build"
    );
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
  let s = {};
  try {
    s = JSON.parse(localStorage.getItem("lea.settings") || "{}") || {};
  } catch {
    s = {};
  }
  // Backup dédié (évite perte si le champ password est vide au save)
  try {
    const backup = String(localStorage.getItem("lea.hordeApiKey") || "").trim();
    if (backup && !String(s.hordeApiKey || "").trim()) s.hordeApiKey = backup;
  } catch (_) {}
  return s;
}
function saveSettings(s) {
  localStorage.setItem("lea.settings", JSON.stringify(s || {}));
  try {
    const k = String((s && s.hordeApiKey) || "").trim();
    if (k) localStorage.setItem("lea.hordeApiKey", k);
  } catch (_) {}
}

function chatBgKey(charId) {
  return "lea.chatBg." + String(charId || "lea");
}
function loadChatBg(charId) {
  try {
    return JSON.parse(localStorage.getItem(chatBgKey(charId)) || "null");
  } catch (_) {
    return null;
  }
}
function saveChatBg(charId, data) {
  try {
    localStorage.setItem(chatBgKey(charId), JSON.stringify(data || {}));
  } catch (_) {}
}
function loadChatUiPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem("lea.chatUi") || "{}");
    return {
      bubbleOpacity: Math.min(1, Math.max(0.25, Number(p.bubbleOpacity) || 0.88)),
      bgOpacity: Math.min(1, Math.max(0.05, Number(p.bgOpacity) || 0.35)),
    };
  } catch (_) {
    return { bubbleOpacity: 0.88, bgOpacity: 0.35 };
  }
}
function saveChatUiPrefs(p) {
  try {
    localStorage.setItem("lea.chatUi", JSON.stringify(p || loadChatUiPrefs()));
  } catch (_) {}
}
function applyChatAppearance() {
  const wrap = document.querySelector(".chat-wrap");
  if (!wrap) return;
  const prefs = loadChatUiPrefs();
  const c = state.character;
  const bg = c ? loadChatBg(c.id) : null;
  wrap.style.setProperty("--bubble-opacity", String(prefs.bubbleOpacity));
  wrap.style.setProperty("--chat-bg-opacity", String(prefs.bgOpacity));
  if (bg && bg.src) {
    const src = resolveImgSrc(bg.src);
    wrap.style.setProperty("--chat-bg-image", src ? 'url("' + src.replace(/"/g, '\"') + '")' : "none");
  } else {
    wrap.style.setProperty("--chat-bg-image", "none");
  }
}

function resolveHordeApiKey() {
  const st = loadSettings() || {};
  let k = String(st.hordeApiKey || st.horde_key || st.hordeKey || "").trim();
  if (!k) {
    try { k = String(localStorage.getItem("lea.hordeApiKey") || "").trim(); } catch (_) {}
  }
  if (!k || k === "0000000000") return "";
  return k;
}

function roleplayMemoryKey() {
  return "lea.memory." + String((state.character && state.character.id) || "lea");
}
function loadRoleplayMemory() {
  try {
    const raw = JSON.parse(localStorage.getItem("lea.memory." + (state.character && state.character.id || "lea")) || "{}");
    return {
      scene: typeof raw.scene === "string" ? raw.scene : "",
      wardrobe: typeof raw.wardrobe === "string" ? raw.wardrobe : "",
      clothesLocation: typeof raw.clothesLocation === "string" ? raw.clothesLocation : "",
      relationship: typeof raw.relationship === "string" ? raw.relationship : "",
      intimacy: typeof raw.intimacy === "string" ? raw.intimacy : "",
      promises: typeof raw.promises === "string" ? raw.promises : "",
      facts: typeof raw.facts === "string" ? raw.facts : "",
      updatedAt: Number(raw.updatedAt) || 0,
    };
  } catch (_) {
    return { scene: "", wardrobe: "", clothesLocation: "", relationship: "", intimacy: "", promises: "", facts: "", updatedAt: 0 };
  }
}
function saveRoleplayMemory(memory) {
  const current = loadRoleplayMemory();
  const next = { updatedAt: Date.now() };
  Object.keys(current).filter((key) => key !== "updatedAt").forEach((key) => {
    const limit = key === "intimacy" ? 1200 : key === "wardrobe" || key === "clothesLocation" ? 500 : key === "scene" ? 600 : 800;
    next[key] = String(memory[key] || "").trim().slice(0, limit);
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
  if (name === "profile") {
    try {
      renderProfile();
    } catch (error) {
      console.error("Affichage du profil impossible", error);
      const root = $("view-profile");
      if (root) root.innerHTML = `<div class="startup-state startup-state--error" role="alert"><strong>Cette fiche ne peut pas être affichée.</strong><span>${escapeHtml(String(error && error.message || error).slice(0, 180))}</span></div>`;
    }
  }
  if (name === "chat") renderChat();
  if (name === "settings") renderSettings();
  if (name === "import" && window.LeaImporter) window.LeaImporter.render($("view-import"));
}

function saveCastOverride(next) {
  if (!next || !next.id || String(next.id) === "lea") return;
  try {
    const ov = JSON.parse(localStorage.getItem("lea.cast.overrides") || "{}");
    ov[String(next.id)] = next;
    localStorage.setItem("lea.cast.overrides", JSON.stringify(ov));
  } catch (_) {}
  const idx = (state.castCharacters || []).findIndex((c) => String(c.id) === String(next.id));
  if (idx >= 0) state.castCharacters[idx] = next;
}

function persistActiveCharacter(next) {
  if (!next || !next.id) return;
  if (next.id === "lea") {
    saveCharOverrides(next);
    state.leaCharacter = next;
  } else {
    const index = state.importedCharacters.findIndex((c) => c.id === next.id);
    if (index >= 0) {
      state.importedCharacters[index] = next;
      localStorage.setItem("lea.imported.characters", JSON.stringify(state.importedCharacters));
    } else {
      // Personnage du cast embarqué
      saveCastOverride(next);
    }
  }
  state.character = next;
}

function persistImageToCharacter(charId, stored, fallbackCharacter) {
  const id = String(charId || "lea");
  const target = id === "lea"
    ? ((state.character && String(state.character.id) === id && state.character) || state.leaCharacter || fallbackCharacter)
    : (state.importedCharacters.find((item) => String(item.id) === id)
      || (state.castCharacters || []).find((item) => String(item.id) === id)
      || (state.character && String(state.character.id) === id ? state.character : null)
      || fallbackCharacter);
  if (!target) throw new Error("Le profil cible n’existe plus; l’image n’a pas été ajoutée à une autre fiche.");

  const currentGallery = Array.isArray(target.gallery)
    ? target.gallery
    : (Array.isArray(fallbackCharacter && fallbackCharacter.gallery) ? fallbackCharacter.gallery : []);
  const next = Object.assign({}, target, {
    gallery: [stored].concat(currentGallery.filter((item) => item !== stored)).slice(0, 300),
    // Ne pas changer automatiquement la photo de profil (★ manuel uniquement)
    cover: target.cover || (currentGallery[0] || stored),
  });

  if (id === "lea") {
    saveCharOverrides(next);
    state.leaCharacter = next;
  } else {
    const index = state.importedCharacters.findIndex((item) => String(item.id) === id);
    if (index >= 0) {
      state.importedCharacters[index] = next;
      localStorage.setItem("lea.imported.characters", JSON.stringify(state.importedCharacters));
    } else {
      saveCastOverride(next);
    }
  }
  if (state.character && String(state.character.id) === id) state.character = next;
  return next;
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
    looks_en: c.looks_en || "",
    ethnicity: c.ethnicity || "",
    body: c.body || "",
    Poitrine: c.Poitrine || c.poitrine || "",
    poitrine: c.Poitrine || c.poitrine || "",
    bustEstimate: c.bustEstimate || "",
    estimatedAge: c.estimatedAge || null,
    nonHumanTraits: c.nonHumanTraits || "",
    system_extra: c.system_extra,
    // Requis pour img2img (identité visage) en scène conversation + profil
    cover: c.cover || "",
    gallery: Array.isArray(c.gallery) ? c.gallery.slice(0, 12) : [],
  };
}

function stripLeaMemory(text) {
  return String(text || "")
    .replace(/<\s*LEA_MEMORY\s*>[\s\S]*?<\s*\/\s*LEA_MEMORY\s*>/gi, "")
    .replace(/<\s*LEA_MEMORY\s*>[\s\S]*$/gi, "")
    .replace(/\{\s*"wardrobe"\s*:[\s\S]{0,900}$/g, "")
    .trim();
}

function formatMessageHtml(text) {
  let raw = stripLeaMemory(text);
  raw = raw
    .replace(/\*{1,2}\s*\[([^\]]{1,40})\]\s*:\*{0,2}/g, "[$1]:")
    .replace(/\*{1,2}\s*\[([^\]]{1,40})\]\s*\*{0,2}\s*:/g, "[$1]:");
  // Normalize **action** → *action*
  raw = raw.replace(/\*\*([^*]+)\*\*/g, "*$1*");
  const esc = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // *actions* → cyan. (pensées) → jaune. Narration physique dans () → action.
  function isReallyAction(inner) {
    const s = String(inner || "").trim();
    if (!s) return false;
    // Vraie pensée courte / ressenti interne → jaune
    const thoughty = /\b(je (me )?dis|je pense|dans ma t[eê]te|j['’]ai peur|j['’]ose pas|pourquoi|est-ce que|mon c[oe]ur|c['’]est irr[eé]el|je ne (veux|serai|peux)|prisonni[eè]re|honte|troubl[eé]e?)\b/i.test(s);
    if (thoughty && s.length < 120) return false;
    // Narration physique / sexuelle → action (même si le modèle a mis des parenthèses)
    if (/\b(pousse|enfonce|jouis|hurle|spasme|tremble|effondre|g[eé]mit|cambre|caresse|embrasse|glisse|l[eè]vres?|doigts?|verge|sexe|clito|seins?|culotte|hanches?|cuisses?|baiser|orgue|contraction)\b/i.test(s))
      return true;
    if (s.length > 90) return true; // long bloc = narration, pas une pensée
    return false;
  }
  let out = esc
    .replace(/(^|\n)\[([^\]]{1,40})\]:\s*/g, '$1<span class="speaker">$2</span> — ')
    .replace(/\*([^*]+)\*/g, '<span class="action">$1</span>')
    .replace(/\(([^)]+)\)/g, function (_, inner) {
      if (isReallyAction(inner)) return '<span class="action">' + inner + '</span>';
      return '<span class="thought">' + inner + '</span>';
    });
  return out;
}

function renderDiscover() {
  const c = state.character;
  const root = $("view-discover");
  if (!root) return;
  if (!c) {
    root.innerHTML = `
      <div class="startup-state startup-state--error" role="alert">
        <strong>Le profil n’a pas pu se charger.</strong>
        <span>Réessaie en touchant « Découvrir » ou ferme puis relance l’application.</span>
      </div>`;
    return;
  }
  const candidates = [
    ...(Array.isArray(state.castCharacters) ? state.castCharacters : []),
    ...(Array.isArray(state.importedCharacters) ? state.importedCharacters : []),
  ].filter(Boolean);
  // Toujours afficher le perso actif en premier si absent
  if (c && !candidates.some((x) => String(x.id) === String(c.id))) candidates.unshift(c);
  const seen = new Set();
  const characters = candidates.filter((item) => {
    const id = String(item.id || "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  root.innerHTML = `
    <div class="discover-search-wrap">
      <input type="search" id="discover-search" class="discover-search" placeholder="🔍 Nom ou tag (brune, secrétaire, métisse…)" autocomplete="off" />
      <div class="discover-search-meta" id="discover-search-meta">${characters.length} personnage(s)</div>
    </div>
    <div class="discover-grid" id="discover-grid">
      ${characters.map((item) => {
        const cover = item.cover || (Array.isArray(item.gallery) && item.gallery[0]) || "";
        const src = resolveImgSrc(cover);
        const tags = (Array.isArray(item.tags) ? item.tags : []).slice(0, 8).map(renderTagChip).join("");
        const scenario = String(item.scenario || "").replace(/\s+/g, " ").trim();
        const summary = scenario.length > 150 ? scenario.slice(0, 147).trimEnd() + "…" : (scenario || "Scénario non renseigné.");
        const id = escapeHtml(item.id);
        const canDelete = String(item.id) !== "lea" && (state.importedCharacters || []).some((x) => String(x.id) === String(item.id));
        return `<article class="discover-card${item.id === c.id ? " is-active" : ""}">
          ${src
            ? `<img class="discover-image" src="${escapeHtml(src)}" alt="" loading="lazy" onerror="this.classList.add('cover-broken');this.removeAttribute('src');" />`
            : '<div class="discover-image discover-placeholder" role="img" aria-label="Image de personnage indisponible">🖼️</div>'}
          <div class="discover-name">${escapeHtml(item.name || "Sans nom")}</div>
          <div class="discover-overlay">
            <div class="discover-tags">${tags}</div>
            <p class="discover-scenario">${escapeHtml(summary)}</p>
            <div class="discover-actions">
              <button type="button" class="discover-action discover-chat" data-character-id="${id}">💬 Discuter</button>
              <button type="button" class="discover-action discover-profile" data-character-id="${id}">Profil</button>
              ${canDelete ? `<button type="button" class="discover-action discover-delete" data-character-id="${id}" title="Supprimer">🗑️</button>` : ""}
            </div>
          </div>
        </article>`;
      }).join("")}
    </div>
  `;
  root.querySelectorAll(".discover-chat").forEach((button) => {
    button.onclick = () => {
      const selected = characters.find((item) => String(item.id) === button.dataset.characterId);
      if (!selected) return;
      if (selected.id !== state.character.id) activateCharacter(selected);
      state.chatListMode = false;
      showView("chat");
    };
  });
  root.querySelectorAll(".discover-profile").forEach((button) => {
    button.onclick = () => {
      const selected = characters.find((item) => String(item.id) === button.dataset.characterId);
      if (!selected) return;
      if (selected.id !== state.character.id) activateCharacter(selected);
      showView("profile");
    };
  });
  root.querySelectorAll(".discover-delete").forEach((button) => {
    button.onclick = (e) => {
      e.stopPropagation();
      const id = String(button.dataset.characterId || "");
      if (!id || id === "lea") return;
      const selected = characters.find((item) => String(item.id) === id);
      const label = selected && selected.name ? selected.name : id;
      if (!confirm("Supprimer définitivement « " + label + " » de ta bibliothèque ?")) return;
      state.importedCharacters = (state.importedCharacters || []).filter((item) => String(item.id) !== id);
      localStorage.setItem("lea.imported.characters", JSON.stringify(state.importedCharacters));
      try { localStorage.removeItem("lea.chat." + id); } catch (_) {}
      try { localStorage.removeItem("lea.memory." + id); } catch (_) {}
      if (state.character && String(state.character.id) === id) {
        state.character = state.leaCharacter || state.character;
        localStorage.setItem("lea.activeCharacterId", "lea");
      }
      renderDiscover();
    };
  });


  const searchInput = $("discover-search");
  const grid = $("discover-grid");
  const meta = $("discover-search-meta");
  function applyDiscoverFilter() {
    const q = String(searchInput && searchInput.value || "").trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    let visible = 0;
    if (!grid) return;
    grid.querySelectorAll(".discover-card").forEach((card) => {
      const name = String(card.querySelector(".discover-name") && card.querySelector(".discover-name").textContent || "").toLowerCase();
      const tags = String(card.querySelector(".discover-tags") && card.querySelector(".discover-tags").textContent || "").toLowerCase();
      const scenario = String(card.querySelector(".discover-scenario") && card.querySelector(".discover-scenario").textContent || "").toLowerCase();
      const hay = name + " " + tags + " " + scenario;
      const ok = !tokens.length || tokens.every((t) => hay.indexOf(t) >= 0);
      card.style.display = ok ? "" : "none";
      if (ok) visible++;
    });
    if (meta) meta.textContent = (tokens.length ? visible + " résultat(s)" : characters.length + " personnage(s)");
  }
  if (searchInput) {
    searchInput.oninput = applyDiscoverFilter;
    searchInput.onsearch = applyDiscoverFilter;
  }

}


function renderProfile() {
  const c = state.character;
  const root = $("view-profile");
  if (!root) return;
  if (!c) {
    root.innerHTML = '<div class="startup-state startup-state--error" role="alert"><strong>Aucun personnage sélectionné.</strong><span>Retourne dans « Découvrir » et choisis une fiche.</span></div>';
    return;
  }
  const edit = state.editMode;
  const gallery = Array.isArray(c.gallery) ? c.gallery : [];
  const tags = Array.isArray(c.tags) ? c.tags : [];
  const declaredAge = c.age == null || c.age === "" ? null : Number(c.age);
  const adultCharacter = Number.isInteger(declaredAge) && declaredAge >= 18;
  const knownMinor = Number.isInteger(declaredAge) && declaredAge < 18;
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
        <div class="meta">${escapeHtml(c.age == null ? "Âge non renseigné" : c.age + " ans")}${c.estimatedAge ? ` · Estimation visuelle : ${escapeHtml(c.estimatedAge)} ans (indicative)` : ""} · ${escapeHtml(c.title || "")}</div>
      </div>
    </div>
    ${edit ? `
      <div class="section">
        <h2>✏️ Identité</h2>
        <label class="hint">Nom</label>
        <input class="edit-input" data-field="name" value="${escapeHtml(c.name || "")}" />
        <label class="hint" style="margin-top:8px">Âge</label>
        <input class="edit-input" data-field="age" type="number" value="${c.age || ""}" placeholder="Non précisé" />
        <label class="hint" style="margin-top:8px">Titre</label>
        <input class="edit-input" data-field="title" value="${escapeHtml(c.title || "")}" />
        <label class="hint" style="margin-top:8px">Tags (virgules)</label>
        <input class="edit-input" data-field="tags" value="${tags.map((tag) => typeof tag === "string" ? tag : (tag && tag.name) || "").join(", ")}" />
        <label class="hint" style="margin-top:8px">Image de couverture (chemin)</label>
        <input class="edit-input" data-field="cover" value="${escapeHtml(c.cover || "")}" />
      </div>
    ` : ""}
    ${field("greeting", "Message d'accueil", "💌", true)}
    ${field("scenario", "Scénario", "🌧️", true)}
    ${field("personality", "Tempérament & caractère", "🎭", true)}
    ${field("appearance", "Descriptif physique", "✨", true)}
    ${(c.nonHumanTraits || edit) ? field("nonHumanTraits", "Traits non humains", "👽", true) : ""}
    ${(c.Poitrine || c.bustEstimate) ? `
      <div class="section">
        <h2>📏 Taille de poitrine</h2>
        <div class="body-text">${c.Poitrine ? `Valeur de la fiche : ${escapeHtml(c.Poitrine)}` : `Estimation visuelle indicative : ${escapeHtml(c.bustEstimate)}`}</div>
      </div>` : ""}
    ${c.sourceScenario != null ? `
      <div class="section">
        <h2>📥 Fiche source conservée</h2>
        <p class="hint">Origine : <a href="${escapeHtml(c.sourceUrl || "#")}" target="_blank" rel="noopener noreferrer">${escapeHtml(c.source || "Import")}</a></p>
        <label class="hint">Scénario d'origine (inchangé)</label>
        <div class="body-text">${escapeHtml(c.sourceScenario || "Aucun scénario source.")}</div>
        <label class="hint" style="display:block;margin-top:10px">Message d'accueil d'origine (inchangé)</label>
        <div class="body-text">${escapeHtml(c.sourceGreeting || "Aucun message source.")}</div>
        <details class="source-card-details">
          <summary>Afficher un aperçu de la fiche source</summary>
          <pre>Ouvre cette section pour charger l’aperçu.</pre>
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
              <img src="${escapeHtml(resolveImgSrc(src))}" alt="${escapeHtml(c.name || "Personnage")} ${i+1}" loading="lazy" />
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
      <h2>🖼️ Générer une image</h2>
      <p class="hint">La photo de profil sert de référence pour le visage. Tenues sexy / dentelle / transparent / décolleté, poses provocantes. Visage ancré sur la photo de profil. Horde peut attendre en file.</p>
      <label class="hint" for="gen-provider">Moteur</label>
      <select class="edit-input" id="gen-provider" style="margin:4px 0 10px">
        <option value="cloudflare">Cloudflare · FLUX.2 Klein</option>
        <option value="horde">AI Horde · img2img</option>
      </select>
      <input class="edit-input" id="gen-extra" placeholder="Optionnel : pose / tenue / ambiance (ex. regard espiègle, robe satinée…)" style="margin-bottom:10px" />
      ${knownMinor
        ? `<p class="hint bad">La génération est désactivée : l’âge renseigné est inférieur à 18 ans.</p>`
        : `${adultCharacter ? "" : `<label class="hint" style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><input id="gen-adult-confirm" type="checkbox" /> Je confirme que ce personnage est majeur.</label>`}
          <button type="button" class="btn btn-primary" id="btn-gen-img">✨ Générer (physique fidèle)</button>`}
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

  const sourceDetails = root.querySelector(".source-card-details");
  if (sourceDetails) {
    sourceDetails.addEventListener("toggle", () => {
      if (!sourceDetails.open || sourceDetails.dataset.loaded) return;
      sourceDetails.dataset.loaded = "true";
      const preview = sourceDetails.querySelector("pre");
      try {
        const source = JSON.stringify(c.sourceCard || {}, null, 2);
        preview.textContent = source.length > 12000 ? source.slice(0, 12000) + "\n… (aperçu tronqué)" : source;
      } catch (_) {
        preview.textContent = "La fiche source ne peut pas être affichée.";
      }
    });
  }

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
  if ($("prof-chat")) $("prof-chat").onclick = () => { state.chatListMode = false; showView("chat"); };
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
      localStorage.setItem("lea.chat." + c.id, JSON.stringify(state.chat));
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
      // Keep the local conversation available even when the server is offline.
    }
    localStorage.setItem("lea.chat." + c.id, JSON.stringify(state.chat));
  }
}

function readSavedChats() {
  const characterMap = new Map();
  [state.leaCharacter, state.character, ...(Array.isArray(state.importedCharacters) ? state.importedCharacters : [])]
    .filter((item) => item && item.id)
    .forEach((item) => characterMap.set(String(item.id), item));
  const entries = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith("lea.chat.")) continue;
    const id = key.slice("lea.chat.".length);
    try {
      const chat = JSON.parse(localStorage.getItem(key) || "{}");
      if (Array.isArray(chat.messages) && chat.messages.length) {
        const latest = chat.messages.reduce((max, message) => {
          const ts = Number(message && message.ts) || Date.parse(message && message.ts) || 0;
          return Math.max(max, ts);
        }, 0);
        entries.push({ id, character: characterMap.get(id) || { id, name: id }, messages: chat.messages, latest });
      }
    } catch (_) {}
  }
  const currentId = state.character && String(state.character.id);
  if (currentId && state.chat && Array.isArray(state.chat.messages) && state.chat.messages.length &&
      !entries.some((entry) => entry.id === currentId)) {
    const latest = state.chat.messages.reduce((max, message) => Math.max(max, Number(message && message.ts) || 0), 0);
    entries.push({ id: currentId, character: state.character, messages: state.chat.messages, latest });
  }
  return entries.sort((a, b) => b.latest - a.latest);
}

function renderChatHistory() {
  const root = $("chat-history-list");
  if (!root) return;
  const entries = readSavedChats();
  if (!entries.length) {
    root.innerHTML = '<p class="chat-history-empty">Les conversations apparaîtront ici après le premier message.</p>';
    return;
  }
  root.innerHTML = entries.map((entry) => {
    const character = entry.character || {};
    const last = entry.messages[entry.messages.length - 1] || {};
    const preview = String(last.content || "").replace(/\s+/g, " ").trim().slice(0, 90);
    const active = state.character && String(state.character.id) === entry.id;
    const stamp = entry.latest ? new Date(entry.latest).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "";
    const image = resolveImgSrc(character.cover || (Array.isArray(character.gallery) && character.gallery[0]) || "");
    return `<div class="chat-history-row">
      <button type="button" class="chat-history-item${active ? " is-active" : ""}" data-chat-id="${escapeHtml(entry.id)}">
        ${image ? `<img src="${escapeHtml(image)}" alt="" />` : '<span class="chat-history-avatar">💬</span>'}
        <span class="chat-history-copy"><strong>${escapeHtml(character.name || entry.id)}</strong><small>${escapeHtml(stamp)}</small><span>${escapeHtml(preview)}</span></span>
      </button>
      <button type="button" class="chat-history-delete" data-delete-chat="${escapeHtml(entry.id)}" title="Supprimer la conversation">🗑️</button>
    </div>`;
  }).join("");
  root.querySelectorAll("[data-chat-id]").forEach((button) => {
    button.onclick = () => {
      const id = button.dataset.chatId;
      const selected = findCharacterById(id);
      if (!selected) return;
      state.character = selected;
      try { state.chat = JSON.parse(localStorage.getItem("lea.chat." + id) || '{"messages":[]}'); }
      catch (_) { state.chat = { messages: [] }; }
      state.editMode = false;
      state.chatListMode = false;
      localStorage.setItem("lea.activeCharacterId", id);
      showView("chat");
    };
  });
  root.querySelectorAll("[data-delete-chat]").forEach((button) => {
    button.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = button.dataset.deleteChat;
      if (!id) return;
      if (!confirm("Supprimer cette conversation ?")) return;
      try { localStorage.removeItem("lea.chat." + id); } catch (_) {}
      try { localStorage.removeItem("lea.memory." + id); } catch (_) {}
      if (state.character && String(state.character.id) === String(id)) {
        state.chat = { messages: [] };
      }
      renderChatHistory();
    };
  });
}

function renderChat() {
  const c = state.character;
  const root = $("view-chat");
  if (!c || !root) return;
  if (state.chatListMode) {
    root.innerHTML = `
      <section class="chat-history-panel chat-history-picker">
        <h2>Conversations <span>plus récente en premier</span></h2>
        <div class="chat-history-list" id="chat-history-list"></div>
      </section>`;
    renderChatHistory();
    return;
  }
  const cover = c.cover || (c.gallery && c.gallery[0]) || "";
  root.innerHTML = `
    <div class="chat-wrap">
      <div class="chat-header chat-header--compact">
        <button type="button" class="chat-back-icon" id="chat-back" title="Conversations">←</button>
        <button type="button" class="chat-header-avatar" id="chat-open-profile" title="Voir le profil">
          <img src="${escapeHtml(resolveImgSrc(cover))}" alt="" />
        </button>
        <div class="info" id="chat-open-profile-info" role="button" tabindex="0" title="Voir le profil">
           <strong>${escapeHtml(c.name)}</strong>
           <small>${c.age ? escapeHtml(String(c.age)) + " ans" : ""} · ${escapeHtml(c.title || "")}</small>
        </div>
        <button type="button" class="icon-btn" id="chat-reset" title="Nouvelle conversation">🔄</button>
        <button type="button" class="icon-btn" id="chat-delete" title="Supprimer la conversation">🗑️</button>
      </div>
      <div class="chat-msgs" id="chat-msgs"></div>
      <div class="typing hidden" id="chat-typing"></div>
      <div class="chat-scene-row">
        <button type="button" class="chat-scene-btn" id="chat-gen-scene" title="Générer la scène">🖼️ Scène</button>
        <button type="button" class="chat-bg-btn" id="chat-bg-toggle" title="Fond de conversation">🎨 Fond</button>
        <span class="chat-scene-hint" id="chat-scene-status"></span>
      </div>
      <div class="chat-bg-panel" id="chat-bg-panel">
        <div class="chat-bg-sliders">
          <label>Transparence bulles <input type="range" id="chat-bubble-opacity" min="25" max="100" value="88" /></label>
          <label>Visibilité fond <input type="range" id="chat-bg-opacity" min="5" max="90" value="35" /></label>
        </div>
        <div class="chat-bg-grid" id="chat-bg-grid"></div>
        <button type="button" class="chat-bg-btn" id="chat-bg-clear">Aucun fond</button>
      </div>
      <div class="chat-input-row">
        <textarea id="chat-input" rows="1" placeholder="Écris… (*action*) (pensée)"></textarea>
        <button type="button" class="send" id="chat-send">➤</button>
      </div>
    </div>
  `;
  paintMessages();
  applyChatAppearance();
  setupChatBackgroundUi();
  (function hideTyping() {
    const t = $("chat-typing");
    if (t && !state.sending) {
      t.classList.remove("is-on");
      t.classList.add("hidden");
      t.style.display = "none";
      t.textContent = "";
    }
  })();
  ensureChatStarted().then(() => {
    paintMessages();
    renderChatHistory();
    applyChatAppearance();
    const t = $("chat-typing");
    if (t && !state.sending) {
      t.classList.remove("is-on");
      t.classList.add("hidden");
      t.style.display = "none";
    }
  });

  const input = $("chat-input");
  input && input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(120, input.scrollHeight) + "px";
  });
  $("chat-send") && ($("chat-send").onclick = sendMessage);
  $("chat-gen-scene") && ($("chat-gen-scene").onclick = generateConversationScene);
  $("chat-back") && ($("chat-back").onclick = () => {
    state.chatListMode = true;
    renderChat();
  });
  input && input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  const openProfile = () => {
    state.editMode = false;
    showView("profile");
  };
  $("chat-open-profile") && ($("chat-open-profile").onclick = openProfile);
  $("chat-open-profile-info") && ($("chat-open-profile-info").onclick = openProfile);
  $("chat-reset") && ($("chat-reset").onclick = async () => {
       if (!confirm("Recommencer la conversation avec " + c.name + " ?")) return;
    state.chat = { messages: [] };
       localStorage.removeItem("lea.chat." + c.id);
    try {
         await api(activeChatPath(), { method: "DELETE" });
    } catch (_) {}
    await ensureChatStarted();
    paintMessages();
    renderChatHistory();
  });
  $("chat-delete") && ($("chat-delete").onclick = async () => {
    if (!confirm("Supprimer définitivement la conversation avec " + c.name + " ?")) return;
    state.chat = { messages: [] };
    try { localStorage.removeItem("lea.chat." + c.id); } catch (_) {}
    try { localStorage.removeItem("lea.memory." + c.id); } catch (_) {}
    try { await api(activeChatPath(), { method: "DELETE" }); } catch (_) {}
    state.chatListMode = true;
    renderChat();
  });
}

function paintMessages() {
  const box = $("chat-msgs");
  if (!box) return;
  const msgs = (state.chat && state.chat.messages) || [];
  box.innerHTML = msgs
    .map((m) => {
      const who = m.role === "user" ? "me" : "them";
      const img = m.image ? `<div class="bubble-image"><img src="${escapeHtml(resolveImgSrc(m.image))}" alt="scène" loading="lazy" /></div>` : "";
      const text = m.content ? `<div class="bubble ${who}">${formatMessageHtml(m.content)}</div>` : "";
      return img + text;
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
  if (typing) {
    const who = (state.character && state.character.name) ? state.character.name : "Personnage";
    typing.textContent = who + " écrit…";
    typing.classList.add("is-on");
    typing.classList.remove("hidden");
    typing.style.display = "block";
  }
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
    let reply = (res && (res.reply || res.content || res.message)) || (res && res.messages && res.messages.slice(-1)[0]?.content);
    if (reply) {
      reply = stripLeaMemory(reply);
      state.chat.messages.push({ role: "assistant", content: reply, ts: Date.now() });
    } else if (res && Array.isArray(res.messages)) {
      state.chat.messages = res.messages.map((m) =>
        m && m.role === "assistant" ? Object.assign({}, m, { content: stripLeaMemory(m.content) }) : m
      );
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
  try { localStorage.setItem("lea.chat." + state.character.id, JSON.stringify(state.chat)); } catch (_) {}
  state.sending = false;
  if (typing) {
    typing.classList.remove("is-on");
    typing.classList.add("hidden");
    typing.style.display = "none";
    typing.textContent = "";
  }
  paintMessages();
  renderChatHistory();
}




function setupChatBackgroundUi() {
  const c = state.character;
  if (!c) return;
  const panel = $("chat-bg-panel");
  const grid = $("chat-bg-grid");
  const toggle = $("chat-bg-toggle");
  const clearBtn = $("chat-bg-clear");
  const bubbleRange = $("chat-bubble-opacity");
  const bgRange = $("chat-bg-opacity");
  const prefs = loadChatUiPrefs();
  const current = loadChatBg(c.id) || {};

  if (bubbleRange) bubbleRange.value = String(Math.round(prefs.bubbleOpacity * 100));
  if (bgRange) bgRange.value = String(Math.round(prefs.bgOpacity * 100));

  if (grid) {
    const imgs = [];
    if (c.cover) imgs.push(c.cover);
    (Array.isArray(c.gallery) ? c.gallery : []).forEach((g) => {
      if (g && imgs.indexOf(g) < 0) imgs.push(g);
    });
    grid.innerHTML = imgs.slice(0, 24).map((src, i) => {
      const resolved = resolveImgSrc(src);
      const active = current.src && (current.src === src || current.src === resolved);
      return `<button type="button" class="${active ? "is-active" : ""}" data-bg-src="${escapeHtml(src)}" title="Fond ${i + 1}">
        ${resolved ? `<img src="${escapeHtml(resolved)}" alt="" loading="lazy" />` : "🖼️"}
      </button>`;
    }).join("") || "<span class='hint'>Aucune image dans la galerie</span>";

    grid.querySelectorAll("button[data-bg-src]").forEach((btn) => {
      btn.onclick = () => {
        const src = btn.getAttribute("data-bg-src");
        saveChatBg(c.id, { src: src });
        grid.querySelectorAll("button").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        applyChatAppearance();
      };
    });
  }

  if (toggle) {
    toggle.onclick = () => {
      if (panel) panel.classList.toggle("open");
    };
  }
  if (clearBtn) {
    clearBtn.onclick = () => {
      saveChatBg(c.id, {});
      if (grid) grid.querySelectorAll("button").forEach((b) => b.classList.remove("is-active"));
      applyChatAppearance();
    };
  }
  const onSlide = () => {
    const next = {
      bubbleOpacity: bubbleRange ? Number(bubbleRange.value) / 100 : 0.88,
      bgOpacity: bgRange ? Number(bgRange.value) / 100 : 0.35,
    };
    saveChatUiPrefs(next);
    applyChatAppearance();
  };
  if (bubbleRange) bubbleRange.oninput = onSlide;
  if (bgRange) bgRange.oninput = onSlide;
}

async function generateConversationScene() {
  if (state.genRunning) {
    setGenBanner("⏳ Une génération est déjà en cours…", "");
    return;
  }
  const c = state.character;
  if (!c) return;
  const age = c.age == null || c.age === "" ? null : Number(c.age);
  if (Number.isInteger(age) && age < 18) {
    setGenBanner("Génération désactivée : personnage mineur.", "bad");
    return;
  }
  if (!Number.isInteger(age) || age < 18) {
    setGenBanner("Âge 18+ requis sur la fiche pour générer une scène.", "bad");
    return;
  }
  const btn = $("chat-gen-scene");
  const status = $("chat-scene-status");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Scène…"; }
  if (status) status.textContent = "File Horde — tenue de la conversation…";
  state.genRunning = true;
  setGenBanner("⏳ Scène → Horde (secours Pollinations si file saturée)…", "");
  try {
    const memory = loadRoleplayMemory();
    // Scènes conversation : mode anonyme autorisé (pas de clé obligatoire)
    const st = Object.assign({}, loadSettings() || {});
    const hordeKey = resolveHordeApiKey();
    if (hordeKey) st.hordeApiKey = hordeKey;
    else st.hordeApiKey = "0000000000"; // anonyme AI Horde
    st.hordeAnonymous = !hordeKey;
    const res = await api("/api/image/scene", {
      method: "POST",
      body: JSON.stringify({
        mode: "conversation",
        character: promptCharacterPayload(c),
        memory: memory,
        messages: (state.chat && state.chat.messages) || [],
        settings: st,
        extra: "",
        allowAnonymous: true,
      }),
    });
    if (!res || (!res.image && !res.ok)) {
      throw new Error((res && (res.error || res.message)) || "Pas d'image renvoyée");
    }
    const image = res.image || res.galleryKey || res.url;
    if (!image) throw new Error("Réponse sans image");
    // Ajouter en bas de conversation
    state.chat.messages = state.chat.messages || [];
    state.chat.messages.push({
      role: "assistant",
      content: res.fallbackFrom === "horde"
        ? "*[scène générée — Horde indisponible, fallback Cloudflare (moins explicite)]*"
        : "*[scène générée d’après la tenue / situation en cours]*",
      image: image,
      ts: Date.now(),
    });
    try { localStorage.setItem("lea.chat." + c.id, JSON.stringify(state.chat)); } catch (_) {}
    // Ajouter aussi à la galerie du personnage (sans forcer photo de profil)
    try {
      const g = Array.isArray(c.gallery) ? c.gallery.slice() : [];
      if (g.indexOf(image) < 0) {
        g.push(image);
        c.gallery = g.slice(-80);
        if (c.id === "lea") {
          try { localStorage.setItem("lea.char.lea", JSON.stringify(Object.assign({}, loadCharOverrides() || {}, { gallery: c.gallery }))); } catch (_) {}
        } else {
          saveCastOverride(Object.assign({}, c));
        }
      }
    } catch (_) {}
    paintMessages();
    const via = res.engine === "horde" ? "Horde" : (res.engine || (res.fallbackFrom ? "fallback" : "OK"));
    setGenBanner("✅ Scène ajoutée (" + via + ")", "ok");
    if (status) status.textContent = "✅ " + via;
  } catch (e) {
    setGenBanner("Scène : " + String(e.message || e).slice(0, 160), "bad");
    if (status) status.textContent = "Erreur";
  } finally {
    state.genRunning = false;
    if (btn) { btn.disabled = false; btn.textContent = "🖼️ Scène"; }
  }
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
  const declaredAge = c.age == null || c.age === "" ? null : Number(c.age);
  if (Number.isInteger(declaredAge) && declaredAge < 18) {
    setGenBanner("La génération est désactivée pour un personnage dont l’âge renseigné est inférieur à 18 ans.", "bad");
    return;
  }
  const confirmedAdult = Number.isInteger(declaredAge) && declaredAge >= 18;
  if (!confirmedAdult && (!Number.isInteger(Number(c.estimatedAge)) || Number(c.estimatedAge) < 18 ||
      !$("gen-adult-confirm")?.checked)) {
    setGenBanner("Confirme que le personnage est majeur; une estimation visuelle ne prouve pas son âge.", "bad");
    return;
  }
  const st = loadSettings();
  const extra = ($("gen-extra") && $("gen-extra").value.trim()) || "";
  const provider = $("gen-provider")?.value === "horde" ? "horde" : "cloudflare";
  const btn = $("btn-gen-img");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Génération…"; }
  state.genRunning = true;
  setGenBanner(provider === "horde" ? "⏳ Envoi à AI Horde; la file d’attente peut prendre plusieurs minutes…" : "⏳ Génération Cloudflare en arrière-plan…", "");
  await new Promise((r) => setTimeout(r, 30));
  // Job détaché : survit au changement d'onglet
  const jobChar = Object.assign({}, c);
  (async () => {
    try {
      const res = await api(provider === "horde" ? "/api/image/horde" : "/api/image/cloudflare", {
        method: "POST",
        body: JSON.stringify({
          character: Object.assign(promptCharacterPayload(jobChar), {
            cover: jobChar.cover || (Array.isArray(jobChar.gallery) && jobChar.gallery[0]) || "",
            adultConfirmed: confirmedAdult || $("gen-adult-confirm")?.checked === true,
          }),
          settings: st,
          extra,
        }),
      });
      if (!res || !res.image) throw new Error((res && res.error) || "Pas d'image renvoyée");
      const dataUrl = res.image;
      const targetId = String(jobChar.id || "lea");
      const stored = persistGeneratedImage(targetId, dataUrl);
      const next = persistImageToCharacter(targetId, stored, jobChar);
      state.genRunning = false;
      const via = res.fallbackFrom === "horde"
        ? " (Horde indisponible → Cloudflare)"
        : (res.engine === "horde" ? " via Horde" : "");
      setGenBanner("✓ Image ajoutée au profil de " + String(next.name || "la personne choisie") + via, "ok");
      if (state.view === "profile" && state.character && String(state.character.id) === targetId) {
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
      <h2>🎨 AI Horde (optionnel)</h2>
      <div class="settings-block">
        <label>Clé API AI Horde ${resolveHordeApiKey() ? "✅ enregistrée (prioritaire)" : "(optionnelle — Scène en anonyme)"}</label>
        <input class="edit-input" id="set-horde-key" type="password" autocomplete="off" value="${escapeHtml(s.hordeApiKey || resolveHordeApiKey() || "")}" placeholder="${resolveHordeApiKey() ? "Laisser vide pour conserver la clé actuelle" : "Optionnel — sinon mode anonyme"}" />
        <p class="hint">Les scènes conversation fonctionnent en anonyme sans clé. Une clé (aihorde.net) réduit les 429 et accélère la file. Si le champ reste vide à l’enregistrement, l’ancienne clé est conservée.</p>
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
      <h2>🧠 Mémoire de roleplay</h2>
      <p class="hint">Souvenirs évolutifs de la conversation active. Enregistrés localement.</p>
      <div class="settings-block">
        <label>Scénario d'origine (lecture seule)</label>
        <p class="memory-origin">${escapeMemoryMarkup(origin)}</p>
      </div>
      <div class="settings-block">
        <label>Scène actuelle et faits immédiats</label>
        <textarea class="edit-area" id="memory-scene" rows="3" placeholder="Lieu, moment, objets, action en cours…">${escapeMemoryMarkup(memory.scene)}</textarea>
      </div>
      <div class="settings-block">
        <label>Tenue actuelle (ce qui est porté maintenant)</label>
        <textarea class="edit-area" id="memory-wardrobe" rows="3" placeholder="Ex. culotte uniquement, robe baissée, lingerie noire…">${escapeMemoryMarkup(memory.wardrobe)}</textarea>
      </div>
      <div class="settings-block">
        <label>Emplacement des vêtements</label>
        <textarea class="edit-area" id="memory-clothesLocation" rows="2" placeholder="Vêtements retirés : au sol, sur le canapé, étendoir…">${escapeMemoryMarkup(memory.clothesLocation || "")}</textarea>
      </div>
      <div class="settings-block">
        <label>Évolution de la relation</label>
        <textarea class="edit-area" id="memory-relationship" rows="3" placeholder="Confiance, affection, limites…">${escapeMemoryMarkup(memory.relationship)}</textarea>
      </div>
      <div class="settings-block">
        <label>Moments intimes et limites explicites</label>
        <textarea class="edit-area" id="memory-intimacy" rows="3" placeholder="Lieu, position, actes, limites…">${escapeMemoryMarkup(memory.intimacy)}</textarea>
      </div>
      <div class="settings-block">
        <label>Promesses et engagements</label>
        <textarea class="edit-area" id="memory-promises" rows="2" placeholder="Ce qui a été promis…">${escapeMemoryMarkup(memory.promises || "")}</textarea>
      </div>
      <div class="settings-block">
        <label>Faits partagés</label>
        <textarea class="edit-area" id="memory-facts" rows="3" placeholder="Infos durables…">${escapeMemoryMarkup(memory.facts)}</textarea>
      </div>
      <button type="button" class="btn btn-primary" id="save-memory">💾 Enregistrer la mémoire</button>
      <button type="button" class="btn btn-secondary" id="clear-memory">Effacer les souvenirs évolutifs</button>
      <div id="memory-status"></div>
    </div>
  `;
  $("save-settings").onclick = () => {
    const next = Object.assign({}, s, {
      geminiKeys: $("set-gemini").value.trim(),
      openaiKeys: $("set-openai").value.trim(),
      groqKeys: $("set-groq").value.trim(),
      cfAccount: ($("set-cf-account") && $("set-cf-account").value.trim()) || "",
      cfKeys: ($("set-cf-keys") && $("set-cf-keys").value.trim()) || "",
      hordeApiKey: (($("set-horde-key") && $("set-horde-key").value.trim()) || s.hordeApiKey || resolveHordeApiKey() || ""),
      userName: $("set-username").value.trim(),
      userBio: $("set-bio").value.trim(),
      chatEngine: $("set-model").value,
    });
    saveSettings(next);
    const st = $("set-status");
    st.innerHTML = '<span class="status-pill ok">✓ Enregistré</span>';
  };
  $("save-memory").onclick = () => {
    saveRoleplayMemory({
      scene: $("memory-scene").value,
      wardrobe: $("memory-wardrobe").value,
      clothesLocation: ($("memory-clothesLocation") && $("memory-clothesLocation").value) || "",
      relationship: $("memory-relationship").value,
      intimacy: $("memory-intimacy").value,
      promises: ($("memory-promises") && $("memory-promises").value) || "",
      facts: $("memory-facts").value,
    });
    $("memory-status").innerHTML = '<span class="status-pill ok">✓ Mémoire enregistrée sur cet appareil</span>';
  };
  $("clear-memory").onclick = () => {
    if (!confirm("Effacer la scène, la tenue, la relation et les souvenirs mémorisés ? Le scénario d'origine et l'historique du chat resteront inchangés.")) return;
    saveRoleplayMemory({ scene: "", wardrobe: "", clothesLocation: "", relationship: "", intimacy: "", promises: "", facts: "" });
    ["memory-scene", "memory-wardrobe", "memory-clothesLocation", "memory-relationship", "memory-intimacy", "memory-promises", "memory-facts"].forEach((id) => { $(id).value = ""; });
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


function mergeAllCasts() {
  const lists = [
    window.CAST,
    window.EXTRA_CAST,
    window.LEA_CAST_NEW,
    window.LEA_CAST_SPECIAL,
    window.LEA_CAST_DIRECT,
    window.LEA_CAST_CUPS,
    window.LEA_CAST_COLLEGUES,
    window.LEA_CAST_TAQUIN,
  ];
  const byId = new Map();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const c of list) {
      if (!c || c.id == null) continue;
      const id = String(c.id);
      if (byId.has(id)) continue;
      const age = c.age == null || c.age === "" ? null : Number(c.age);
      if (Number.isInteger(age) && age < 18) continue;
      byId.set(id, Object.assign({}, c, {
        id: id,
        adultConfirmed: Number.isInteger(age) && age >= 18 ? true : c.adultConfirmed,
      }));
    }
  }
  // Overrides locaux (modifs utilisateur) — ne pas écraser scénario/accueil packagés par d'anciennes versions génériques
  try {
    const ov = JSON.parse(localStorage.getItem("lea.cast.overrides") || "{}");
    if (ov && typeof ov === "object") {
      for (const id of Object.keys(ov)) {
        if (!byId.has(id) || !ov[id] || typeof ov[id] !== "object") continue;
        const base = byId.get(id);
        const o = ov[id];
        const oSc = String(o.scenario || "");
        const staleScenario =
          /orage,\s*dispute|débarque\s*\(|soirée qui dérape|au choix|\(orage/i.test(oSc) ||
          (oSc.length > 0 && oSc.length < 120 && !oSc.includes("💜") && !oSc.includes("🏠"));
        const oGr = String(o.greeting || "");
        const staleGreeting =
          /je passais|venais voir si t.?étais seul|Je passais\. Enfin non/i.test(oGr);
        const merged = Object.assign({}, base, o, { id: id });
        // Toujours préférer le pack APK pour titre / scénario / accueil / personnalité si override obsolète ou générique
        if (staleScenario || !o.scenario) {
          merged.scenario = base.scenario;
          merged.title = base.title || merged.title;
        }
        if (staleGreeting || !o.greeting) {
          merged.greeting = base.greeting;
        }
        if (!o.personality || String(o.personality).length < 40) {
          merged.personality = base.personality;
        }
        // Conserver galerie / champs édités volontairement
        byId.set(id, merged);
      }
    }
  } catch (_) {}
  return Array.from(byId.values());
}

function findCharacterById(id) {
  const sid = String(id || "");
  if (!sid) return null;
  if (state.leaCharacter && String(state.leaCharacter.id) === sid) return state.leaCharacter;
  const imp = (state.importedCharacters || []).find((x) => String(x.id) === sid);
  if (imp) return imp;
  return (state.castCharacters || []).find((x) => String(x.id) === sid) || null;
}

async function initCharacter() {
  try {
    const saved = JSON.parse(localStorage.getItem("lea.imported.characters") || "[]");
    state.importedCharacters = Array.isArray(saved)
      ? saved.filter((item) => item && item.id != null).map((item) => Object.assign({}, item, { id: String(item.id) }))
      : [];
  } catch (_) {
    state.importedCharacters = [];
  }
  let base = window.__LEA_DEFAULT__ || null;
  try {
    const list = await Promise.race([
      api("/api/characters"),
      new Promise((resolve) => setTimeout(() => resolve(null), 3500)),
    ]);
    if (Array.isArray(list) && list[0]) base = list.find((x) => x.id === "lea") || list[0];
  } catch (_) {}
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
  state.castCharacters = mergeAllCasts();
  // Remplacer lea du cast par la version enrichie
  const leaIdx = state.castCharacters.findIndex((c) => String(c.id) === "lea");
  if (leaIdx >= 0) state.castCharacters[leaIdx] = Object.assign({}, state.castCharacters[leaIdx], lea);
  else state.castCharacters.unshift(lea);
  const activeId = localStorage.getItem("lea.activeCharacterId");
  state.character = findCharacterById(activeId) || lea;
}

function bindNav() {
  document.querySelectorAll(".tabbar .nav").forEach((b) => {
    b.onclick = () => {
      if (b.dataset.view === "chat") state.chatListMode = true;
      showView(b.dataset.view);
    };
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
    // Toujours rouvrir sur Découvrir (pas Import)
    showView("discover");
    // Double-sécurité: si quelque chose bascule vers Import juste après le boot, revenir
    setTimeout(() => {
      try {
        if (state.view === "import") showView("discover");
      } catch (_) {}
    }, 1200);
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

// Au retour au premier plan: rester sur la vue actuelle, ne pas ouvrir Import sans raison
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (state.view === "import") {
    // Si aucun import en cours, revenir à Découvrir
    try {
      if (window.LeaImporter && typeof window.LeaImporter.hasPendingWork === "function") {
        if (!window.LeaImporter.hasPendingWork()) showView("discover");
      }
    } catch (_) {}
  }
});
