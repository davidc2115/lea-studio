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
  genRunning: false,
  genBanner: null,
};

const $ = (id) => document.getElementById(id);

/** Bannière de génération (profil + toast global) */
function setGenBanner(msg, kind) {
  const text = String(msg || "").trim();
  const k = kind === "ok" || kind === "bad" ? kind : "";
  state.genBanner = text ? { msg: text, kind: k } : null;

  const status = $("gen-status");
  if (status) {
    if (!text) {
      status.innerHTML = "";
    } else {
      const cls = k === "ok" ? "ok" : k === "bad" ? "bad" : "busy";
      status.innerHTML = '<span class="status-pill ' + cls + '">' + escapeHtml(text) + "</span>";
    }
  }

  let toast = $("gen-banner-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "gen-banner-toast";
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
  }
  if (!text) {
    toast.className = "gen-banner-toast";
    toast.textContent = "";
    return;
  }
  toast.textContent = text;
  toast.className = "gen-banner-toast show" + (k ? " " + k : " busy");
  if (k === "ok" || k === "bad") {
    try { clearTimeout(setGenBanner._hideTimer); } catch (_) {}
    setGenBanner._hideTimer = setTimeout(() => {
      if (toast && state.genBanner && state.genBanner.kind === k) {
        toast.classList.remove("show");
      }
    }, k === "ok" ? 5500 : 9000);
  }
}


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
  try {
    localStorage.setItem("lea.settings", JSON.stringify(s || {}));
  } catch (e) {
    throw new Error("Impossible d'enregistrer (stockage plein ?): " + String(e.message || e).slice(0, 80));
  }
  try {
    const k = String((s && s.hordeApiKey) || "").trim();
    if (k && k !== "0000000000") localStorage.setItem("lea.hordeApiKey", k);
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
  const cumulative = new Set(["relationship", "intimacy", "promises", "facts"]);
  Object.keys(current).filter((key) => key !== "updatedAt").forEach((key) => {
    const limit = key === "intimacy" ? 1200 : key === "wardrobe" || key === "clothesLocation" ? 500 : key === "scene" ? 600 : 800;
    const value = String(memory[key] || "").trim();
    next[key] = cumulative.has(key) ? value : value.slice(0, limit);
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

function findBundledCharacterForPrompt(id) {
      const targetId = String(id || "");
      if (!targetId || typeof window === "undefined") return null;
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
      for (const list of lists) {
        if (!Array.isArray(list)) continue;
        const found = list.find((item) => item && String(item.id) === targetId);
        if (found) return found;
      }
      return null;
    }

    function promptCharacterPayload(char, imageProvider) {
      const c = char || {};
      const bundled = findBundledCharacterForPrompt(c.id);
      // Local overrides remain saved and visible in the profile, but bundled identities
      // use the latest catalogue physical fields when constructing an image prompt.
      const source = bundled ? Object.assign({}, c, {
        name: bundled.name || c.name,
        age: bundled.age != null && bundled.age !== "" ? bundled.age : c.age,
        title: bundled.title || c.title,
        tags: Array.isArray(bundled.tags) ? bundled.tags : c.tags,
        appearance: typeof bundled.appearance === "string" ? bundled.appearance : c.appearance,
        looks_en: typeof bundled.looks_en === "string" ? bundled.looks_en : (c.looks_en || ""),
        ethnicity: typeof bundled.ethnicity === "string" ? bundled.ethnicity : (c.ethnicity || ""),
        body: typeof bundled.body === "string" ? bundled.body : (c.body || ""),
        Poitrine: bundled.Poitrine || bundled.poitrine || "",
        poitrine: bundled.Poitrine || bundled.poitrine || "",
        canonicalCupSize: bundled.canonicalCupSize || "",
        bustEstimate: bundled.bustEstimate || "",
        nonHumanTraits: bundled.nonHumanTraits || "",
      }) : c;
      return {
        id: source.id,
        name: source.name,
        age: source.age,
        title: source.title,
        canonicalCupSize: source.canonicalCupSize || "",
        tags: source.tags,
        scenario: source.scenario,
        personality: source.personality,
        appearance: source.appearance,
        looks_en: source.looks_en || "",
        ethnicity: source.ethnicity || "",
        body: source.body || "",
        Poitrine: source.Poitrine || source.poitrine || "",
        poitrine: source.Poitrine || source.poitrine || "",
        bustEstimate: source.bustEstimate || "",
        estimatedAge: source.estimatedAge || null,
        nonHumanTraits: source.nonHumanTraits || "",
        system_extra: source.system_extra,
        // Requis pour img2img (identité visage) en scène conversation + profil
        // Horde uses current catalog references for bundled characters; Cloudflare's
        // previously validated Hortense reference remains unchanged.
        cover: bundled && String(imageProvider || "").toLowerCase() === "horde"
          ? (bundled.cover || source.cover || "")
          : (bundled && String(bundled.id) === "aya"
              ? "images/cast/hortense-build1106-reference.jpg"
              : (source.cover || "")),
        gallery: bundled && String(imageProvider || "").toLowerCase() === "horde"
          ? (Array.isArray(bundled.gallery) && bundled.gallery.length
              ? bundled.gallery.slice(0, 12)
              : (Array.isArray(source.gallery) ? source.gallery.slice(0, 12) : []))
          : (bundled && String(bundled.id) === "aya"
              ? []
              : (Array.isArray(source.gallery) ? source.gallery.slice(0, 12) : [])),
      };
    }

function stripLeaMemory(text) {
  return String(text || "")
    .replace(/<\s*LEA_MEMORY\s*>[\s\S]*?<\s*\/\s*LEA_MEMORY\s*>/gi, "")
    .replace(/<\s*LEA_MEMORY\s*>[\s\S]*$/gi, "")
    .replace(/\{\s*"wardrobe"\s*:[\s\S]{0,900}$/g, "")
    .trim();
}

function formatMessageHtml(text, options) {
  let raw = stripLeaMemory(text);
  raw = raw
    .replace(/\*\*([^*]+)\*\*/g, "*$1*")
    .replace(/(^|\n)[ \t]*(?:\*{0,2})(?:actions?|dialogues?|pens[eé]es?|thoughts?|paroles?)\s*[:：]\s*/gi, "$1")
    .replace(/\*{1,2}\s*\[([^\]]{1,80})\]\s*:\*{0,2}/g, "[$1]:")
    .replace(/\*{1,2}\s*\[([^\]]{1,80})\]\s*\*{0,2}\s*:/g, "[$1]:")
    .replace(/\b(?:actions?|dialogues?|pens[eé]es?|thoughts?)\s*[:：]\s*/gi, "");

  // Speaker labels may appear mid-line or at the beginning of a line.
  const nonSpeakerLabels = /^(?:euh|eh|hé|hum|hmm|oh|ah|bah|ben|bon|alors|voilà|oui|non)$/i;
      raw = raw.replace(/\[([^\]]{1,80})\]\s*:\s*/g, function (_match, name) {
        return nonSpeakerLabels.test(String(name).trim()) ? String(name).trim() + ": " : "\n@@@SPEAKER:" + name + "@@@\n";
      });
  raw = raw.replace(
    /(^|\n)((?:La |Le |Ma |Mon |Sa |Son |Ta |Ton )?(?:fille|femme|m[eè]re|s[oe]ur|belle-?[mèe]re|belle-?s[oe]ur|amie|mari|fr[eè]re|p[eè]re|coloc|voisin(?:e)?|[A-ZÀ-Ü][A-Za-zÀ-ÿ'’\-]{2,28})(?:\s+[A-ZÀ-Ü][A-Za-zÀ-ÿ'’\-]{1,28})?)\s*:\s+/g,
    function (_match, prefix, name) {
      if (/^(actions?|dialogues?|pens[eé]es?|thoughts?|paroles?)$/i.test(String(name).trim())) return prefix;
      if (nonSpeakerLabels.test(String(name).trim())) return prefix + String(name).trim() + ": ";
      return prefix + "\n@@@SPEAKER:" + name + "@@@\n";
    }
  );

  function escapeText(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatSegments(value) {
    const source = String(value || "");
    const markers = /(\*[^*\n]+\*|\*[^*\n]+(?=\n|$)|\([^)\n]{1,200}\))/g;
    let html = "";
    let cursor = 0;
    let match;
    function speech(text) {
      if (!text) return;
      html += '<span class="speech">' + escapeText(text).replace(/\n/g, "<br>") + "</span>";
    }
    while ((match = markers.exec(source))) {
      speech(source.slice(cursor, match.index));
      const token = match[0];
      if (token.charAt(0) === "*") {
        const action = token.replace(/^\*/, "").replace(/\*$/, "");
        html += '<span class="action">' + escapeText(action) + "</span>";
      } else {
        html += '<span class="thought">' + escapeText(token.slice(1, -1)) + "</span>";
      }
      cursor = match.index + token.length;
    }
    speech(source.slice(cursor));
    return html;
  }

  const parts = raw.split(/\n?@@@SPEAKER:([^@]+)@@@\n?/);
  const activeName = typeof state !== "undefined" && state.character ? String(state.character.name || "") : "";
  const bubbleTurns = !!(options && options.bubbleTurns);
    function isMainSpeaker(name) {
    if (!name) return true;
    const normalize = (value) => String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase()
      .replace(/\bpersonnage principal\b/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    const candidate = normalize(name);
    const active = normalize(activeName);
    if (!candidate || candidate === active) return true;
    return candidate === active.split(/\s+/)[0];
  }
  function renderTurn(name, body) {
    const isMain = isMainSpeaker(name);
    const formatted = formatSegments(body);
    if (!bubbleTurns) {
      if (isMain) return formatted;
      return '<div class="third-party"><div class="speaker">' + escapeText(name) +
        '</div><div class="third-party-body">' + formatted + "</div></div>";
    }
    const speaker = escapeText(name || activeName || "Personnage");
    const bubbleClass = isMain ? "bubble them speaker-turn speaker-main" : "bubble them speaker-turn third-party-turn";
    const bodyClass = isMain ? "speaker-turn-body" : "third-party-body";
    return '<div class="' + bubbleClass + '"><div class="speaker">' + speaker +
      '</div><div class="' + bodyClass + '">' + formatted + "</div></div>";
  }
  const groups = [];
      const bySpeaker = new Map();
      function addTurn(name, body) {
        const content = String(body || "").trim();
        if (!content) return;
        const main = isMainSpeaker(name);
        const label = main ? (activeName || String(name || "Personnage").trim()) : String(name || "Tierce personne").trim();
        const key = main ? "__main__" : label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        let group = bySpeaker.get(key);
        if (!group) {
          group = { name: label, bodies: [] };
          bySpeaker.set(key, group);
          groups.push(group);
        }
        group.bodies.push(content);
      }
      addTurn(activeName, parts[0]);
      for (let i = 1; i < parts.length; i += 2) {
        addTurn(String(parts[i] || "").trim(), parts[i + 1]);
      }
      return groups.map((group) => renderTurn(group.name, group.bodies.join("\n"))).join("");
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
        key === "greeting"
          ? (typeof formatMessageHtml === "function" ? formatMessageHtml(val) : escapeHtml(val))
          : escapeHtml(val)
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
        <input class="edit-input" data-field="tags" value="${escapeHtml(tags.map((tag) => typeof tag === "string" ? tag : (tag && (tag.name || tag.label)) || "").filter(Boolean).join(", "))}" />
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
        ${gallery.filter(Boolean).map((src, i) => {
          const isCover = (c.cover === src) || (!c.cover && i === 0);
          const resolved = resolveImgSrc(src) || "";
          return `<div class="gal-card">
            <button type="button" class="gal-img-btn" data-i="${i}">
              ${resolved
                ? `<img src="${escapeHtml(resolved)}" alt="${escapeHtml(c.name || "Personnage")} ${i+1}" loading="lazy" onerror="this.style.opacity=0.3" />`
                : `<div class="cover-placeholder" style="height:120px;display:grid;place-items:center">🖼️</div>`}
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
      <p class="hint">La photo de profil sert de référence pour le visage. Mode SFW Horde (tenues modestes, pas de lingerie) pour éviter la censure worker. Visage ancré sur la photo de profil. Horde peut attendre en file.</p>
      <label class="hint" for="gen-provider">Moteur</label>
      <select class="edit-input" id="gen-provider" style="margin:4px 0 10px">
        <option value="cloudflare" ${resolveHordeApiKey() ? "" : "selected"}>Cloudflare · FLUX.2 Klein</option>
        <option value="horde" ${resolveHordeApiKey() ? "selected" : ""}>AI Horde · img2img${resolveHordeApiKey() ? "" : " (clé recommandée)"}</option>
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
      const bmsg = (state.genBanner && state.genBanner.msg)
        ? state.genBanner.msg
        : "⏳ Génération…";
      setGenBanner(bmsg, (state.genBanner && state.genBanner.kind) || "");
    } else if (state.genBanner && state.genBanner.msg) {
      setGenBanner(state.genBanner.msg, state.genBanner.kind || "");
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

function resolveCharacterForChat(id) {
  const sid = String(id || "");
  if (!sid) return null;
  // Recherche complète : cast + importés + Léa + personnage actif
  const found = (typeof findCharacterById === "function" ? findCharacterById(sid) : null)
    || (state.character && String(state.character.id) === sid ? state.character : null)
    || (state.leaCharacter && String(state.leaCharacter.id) === sid ? state.leaCharacter : null);
  if (found) return found;
  // Dernier recours : parcourir cast + importés
  const pools = [
    ...(Array.isArray(state.castCharacters) ? state.castCharacters : []),
    ...(Array.isArray(state.importedCharacters) ? state.importedCharacters : []),
  ];
  return pools.find((x) => x && String(x.id) === sid) || null;
}

function readSavedChats() {
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
        const character = resolveCharacterForChat(id) || { id, name: id };
        entries.push({ id, character, messages: chat.messages, latest });
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
    const character = entry.character || resolveCharacterForChat(entry.id) || {};
    const displayName = String(character.name || character.title || entry.id || "?").trim();
    const last = entry.messages[entry.messages.length - 1] || {};
    const preview = String(last.content || "").replace(/\s+/g, " ").trim().slice(0, 90);
    const active = state.character && String(state.character.id) === entry.id;
    const stamp = entry.latest ? new Date(entry.latest).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "";
    const coverRaw = character.cover || (Array.isArray(character.gallery) && character.gallery[0]) || "";
    const image = resolveImgSrc(coverRaw);
    const avatarHtml = image
      ? `<img class="chat-history-photo" src="${escapeHtml(image)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='grid')" />`
        + `<span class="chat-history-avatar" style="display:none">💬</span>`
      : '<span class="chat-history-avatar">💬</span>';
    return `<div class="chat-history-row">
      <button type="button" class="chat-history-item${active ? " is-active" : ""}" data-chat-id="${escapeHtml(entry.id)}">
        ${avatarHtml}
        <span class="chat-history-copy"><strong>${escapeHtml(displayName)}</strong><small>${escapeHtml(stamp)}</small><span>${escapeHtml(preview)}</span></span>
      </button>
      <button type="button" class="chat-history-delete" data-delete-chat="${escapeHtml(entry.id)}" title="Supprimer la conversation">🗑️</button>
    </div>`;
  }).join("");
  root.querySelectorAll("[data-chat-id]").forEach((button) => {
    button.onclick = () => {
      const id = button.dataset.chatId;
      const selected = resolveCharacterForChat(id) || findCharacterById(id);
      if (!selected) {
        // Conversation orpheline (perso retiré) : ouvrir quand même avec un stub
        state.character = { id: id, name: id, age: 18, title: "", appearance: "", gallery: [], cover: "" };
      } else {
        state.character = selected;
      }
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
      <div class="chat-bg-panel" id="chat-bg-panel">
        <div class="chat-bg-sliders">
          <label>Transparence bulles <input type="range" id="chat-bubble-opacity" min="25" max="100" value="88" /></label>
          <label>Visibilité fond <input type="range" id="chat-bg-opacity" min="5" max="90" value="35" /></label>
        </div>
        <div class="chat-bg-grid" id="chat-bg-grid"></div>
        <button type="button" class="chat-bg-btn" id="chat-bg-clear">Aucun fond</button>
      </div>
      <div class="chat-input-row">
        <textarea id="chat-input" rows="1" placeholder="Écris…  *geste*  (ressenti)"></textarea>
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
      const text = !m.content
        ? ""
        : who === "them"
          ? formatMessageHtml(m.content, { bubbleTurns: true })
          : `<div class="bubble ${who}">${formatMessageHtml(m.content)}</div>`;
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
  const st = Object.assign({}, loadSettings() || {});
  const hordeKey = resolveHordeApiKey();
  if (hordeKey) st.hordeApiKey = hordeKey;
  // Ne pas forcer 0000000000 ici : generateHordeImage gère anonyme + message clair
  const extra = ($("gen-extra") && $("gen-extra").value.trim()) || "";
  const provider = $("gen-provider")?.value === "horde" ? "horde" : "cloudflare";
  const btn = $("btn-gen-img");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Génération…"; }
  state.genRunning = true;
  const startMsg = provider === "horde"
    ? (hordeKey
        ? "⏳ Horde… file en cours"
        : "⏳ Horde anonyme… file en cours")
    : "⏳ Cloudflare…";
  setGenBanner(startMsg, "");
  const statusEl = $("gen-status");
  if (statusEl) {
    statusEl.innerHTML = '<span class="status-pill busy">' + escapeHtml(startMsg) + "</span>";
  }
  await new Promise((r) => setTimeout(r, 30));
  // Job détaché : survit au changement d'onglet
  const jobChar = Object.assign({}, c);
  (async () => {
    try {
      const res = await api(provider === "horde" ? "/api/image/horde" : "/api/image/cloudflare", {
        method: "POST",
        body: JSON.stringify({
          character: Object.assign(promptCharacterPayload(jobChar, provider), {
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
        ? " (Horde saturé → Cloudflare, moins NSFW — réessaie plus tard)"
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
    <div class="settings-save-bar" id="settings-save-bar">
      <button type="button" class="btn btn-primary" id="save-settings-top">💾 Enregistrer clés & réglages</button>
      <div id="set-status-top" class="hint"></div>
    </div>
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
        <label>Clé API AI Horde ${resolveHordeApiKey() ? "✅ enregistrée (prioritaire)" : "(optionnelle — anonyme possible)"}</label>
        <input class="edit-input" id="set-horde-key" type="text" autocomplete="off" spellcheck="false" value="${escapeHtml(s.hordeApiKey || resolveHordeApiKey() || "")}" placeholder="${resolveHordeApiKey() ? "Laisser vide pour conserver la clé actuelle" : "Optionnel — sinon mode anonyme"}" />
        <p class="hint">Profil Horde fonctionne en anonyme. Une clé gratuite (aihorde.net) accélère la file et réduit les refus. Si le champ reste vide à l’enregistrement, l’ancienne clé est conservée.</p>
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
    <div class="section">
      <button type="button" class="btn btn-primary" id="save-settings" style="width:100%">💾 Enregistrer les clés et réglages</button>
      <div id="set-status" class="hint" style="margin-top:10px"></div>
      <p class="hint">Les clés Gemini, Cloudflare et AI Horde sont stockées uniquement sur cet appareil.</p>
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
      <button type="button" class="btn btn-primary" id="save-settings-bottom" style="width:100%;margin-bottom:12px">💾 Enregistrer clés & réglages</button>
      <div id="set-status-bottom" class="hint" style="margin-bottom:12px"></div>
      <button type="button" class="btn btn-primary" id="save-memory">💾 Enregistrer la mémoire</button>
      <button type="button" class="btn btn-secondary" id="clear-memory">Effacer les souvenirs évolutifs</button>
      <div id="memory-status"></div>
    </div>
  `;
  function doSaveSettings() {
    try {
      const prevKey = resolveHordeApiKey();
      const typedHorde = ($("set-horde-key") && $("set-horde-key").value.trim()) || "";
      const hordeApiKey = typedHorde || prevKey || s.hordeApiKey || "";
      const next = Object.assign({}, s, {
        geminiKeys: ($("set-gemini") && $("set-gemini").value.trim()) || "",
        openaiKeys: ($("set-openai") && $("set-openai").value.trim()) || "",
        groqKeys: ($("set-groq") && $("set-groq").value.trim()) || "",
        cfAccount: ($("set-cf-account") && $("set-cf-account").value.trim()) || "",
        cfKeys: ($("set-cf-keys") && $("set-cf-keys").value.trim()) || "",
        hordeApiKey: hordeApiKey,
        userName: ($("set-username") && $("set-username").value.trim()) || "",
        userBio: ($("set-bio") && $("set-bio").value.trim()) || "",
        chatEngine: ($("set-model") && $("set-model").value) || "gemini",
      });
      saveSettings(next);
      if (hordeApiKey && hordeApiKey !== "0000000000") {
        try { localStorage.setItem("lea.hordeApiKey", hordeApiKey); } catch (_) {}
      }
      const bits = [];
      if (next.geminiKeys) bits.push("Gemini");
      if (next.cfKeys || next.cfAccount) bits.push("Cloudflare");
      if (hordeApiKey) bits.push("Horde ✓");
      else bits.push("Horde anonyme");
      const okHtml = '<span class="status-pill ok">✓ Clés enregistrées (' + bits.join(", ") + ")</span>";
      ["set-status", "set-status-top", "set-status-bottom"].forEach((id) => {
        const el = $(id);
        if (el) el.innerHTML = okHtml;
      });
      return true;
    } catch (e) {
      const bad = '<span class="status-pill bad">✗ ' + String(e.message || e).slice(0, 120) + "</span>";
      ["set-status", "set-status-top", "set-status-bottom"].forEach((id) => {
        const el = $(id);
        if (el) el.innerHTML = bad;
      });
      return false;
    }
  }
  ["save-settings", "save-settings-top", "save-settings-bottom"].forEach((id) => {
    const btn = $(id);
    if (btn) btn.onclick = doSaveSettings;
  });
  // placeholder to replace start of old handler
  // save handlers bound via doSaveSettings
  // Sauvegarde auto des clés quand on quitte un champ
  ["set-gemini", "set-openai", "set-groq", "set-cf-account", "set-cf-keys", "set-horde-key", "set-username", "set-bio", "set-model"].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("change", () => { doSaveSettings(); });
  });

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


function cupSizeFromCollectionTitle(title) {
  const text = String(title || "").trim();
  const bandCup = text.match(/\b(\d{2,3})\s*([A-K])\b/i);
  if (bandCup) return bandCup[1] + bandCup[2].toUpperCase();
  const namedCup = text.match(/\b(?:cup|bonnet)\s*[-:]?\s*([A-K])\b/i)
    || text.match(/\b([A-K])\s*[- ]?(?:cup|bonnet)\b/i)
    || text.match(/^(?:bonnet\s*)?([A-K])$/i);
  return namedCup ? (namedCup[1] || namedCup[2]).toUpperCase() : "";
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
      const titleCup = list === window.LEA_CAST_CUPS ? cupSizeFromCollectionTitle(c.title) : "";
      byId.set(id, Object.assign({}, c, {
        id: id,
        ...(titleCup ? { canonicalCupSize: titleCup } : {}),
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
        // L'ancienne fiche locale d'Hortense ne doit pas masquer les valeurs canoniques du catalogue.
        if (id === "aya") {
          for (const key of ["name", "age", "tags", "appearance", "looks_en", "ethnicity", "body", "Poitrine", "poitrine", "nonHumanTraits"]) {
            if (Object.prototype.hasOwnProperty.call(base, key)) merged[key] = base[key];
          }
          merged.Poitrine = base.Poitrine || base.poitrine || "";
          merged.poitrine = merged.Poitrine;
          merged.canonicalCupSize = base.canonicalCupSize || "";
          merged.bustEstimate = base.bustEstimate || "";
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
