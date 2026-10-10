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

function mergeChar(base) {
  const o = loadCharOverrides();
  if (!o) return base;
  return Object.assign({}, base, o, {
    id: "lea",
    gallery: Array.isArray(o.gallery) && o.gallery.length ? o.gallery : base.gallery,
  });
}

function showView(name) {
  state.view = name;
  ["discover", "profile", "chat", "settings"].forEach((v) => {
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
  if (!c || !root) return;
  const cover = c.cover || (c.gallery && c.gallery[0]) || "";
  const tags = (c.tags || []).map((t) => {
    const pink = /timide|nsfw|romance|orage/.test(t);
    return `<span class="tag${pink ? " pink" : ""}">#${t}</span>`;
  }).join("");
  root.innerHTML = `
    <div class="hero-card">
      <img class="cover" src="${cover}" alt="${c.name}" onerror="this.style.background='#2a1445'" />
      <div class="hero-gradient">
        <h1>💜 ${c.name}</h1>
        <div class="meta">${c.age} ans · ${c.title || ""}</div>
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
        <div class="label">Premier message de Léa</div>
        <div class="body-text">${formatMessageHtml(c.greeting || "")}</div>
      </div>
    </div>
  `;
  $("go-chat") && ($("go-chat").onclick = () => { showView("chat"); });
  $("go-profile") && ($("go-profile").onclick = () => { showView("profile"); });
}

function renderProfile() {
  const c = state.character;
  const root = $("view-profile");
  if (!c || !root) return;
  const edit = state.editMode;
  const gallery = c.gallery || [];
  const field = (key, label, emoji, multiline) => {
    const val = c[key] || "";
    if (!edit) {
      return `<div class="section"><h2>${emoji} ${label}</h2><div class="body-text">${
        key === "greeting" ? formatMessageHtml(val) : val.replace(/</g, "&lt;")
      }</div></div>`;
    }
    return `<div class="section"><h2>${emoji} ${label}</h2>${
      multiline
        ? `<textarea class="edit-area" data-field="${key}">${val.replace(/</g, "&lt;")}</textarea>`
        : `<input class="edit-input" data-field="${key}" value="${String(val).replace(/"/g, "&quot;")}" />`
    }</div>`;
  };

  root.innerHTML = `
    <div class="hero-card" style="margin-bottom:12px">
      <img class="cover" src="${c.cover || gallery[0] || ""}" alt="${c.name}" style="max-height:36vh" />
      <div class="hero-gradient">
        <h1>💜 ${c.name}</h1>
        <div class="meta">${c.age} ans · ${c.title || ""}</div>
      </div>
    </div>
    ${edit ? `
      <div class="section">
        <h2>✏️ Identité</h2>
        <label class="hint">Nom</label>
        <input class="edit-input" data-field="name" value="${(c.name || "").replace(/"/g, "&quot;")}" />
        <label class="hint" style="margin-top:8px">Âge</label>
        <input class="edit-input" data-field="age" type="number" value="${c.age || 18}" />
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
    <div class="section">
      <h2>🖼️ Galerie (${gallery.length})</h2>
      <div class="gallery">
        ${gallery.map((src, i) => `<img src="${src}" data-i="${i}" alt="Léa ${i + 1}" />`).join("")}
      </div>
      ${edit ? `<label class="hint" style="margin-top:10px">Galerie (une URL / chemin par ligne)</label>
        <textarea class="edit-area" data-field="gallery">${gallery.join("\n")}</textarea>` : ""}
    </div>
    ${!edit ? `
    <div class="section">
      <h2>☁️ Générer une image (Cloudflare)</h2>
      <p class="hint">Le prompt utilise tout le descriptif physique + la tenue du scénario (orage / trempée). Pose aléatoire à chaque fois.</p>
      <input class="edit-input" id="gen-extra" placeholder="Optionnel : pose / détail (ex: sourire espiègle, de profil…)" style="margin-bottom:10px" />
      <button type="button" class="btn btn-primary" id="btn-gen-img">✨ Générer (physique fidèle)</button>
      <div id="gen-status" class="hint" style="margin-top:10px"></div>
      <div id="gen-preview" style="margin-top:12px"></div>
    </div>
    ` : ""}
    ${edit ? `
      <div class="edit-actions">
        <button type="button" class="btn btn-primary" id="save-char">💾 Enregistrer</button>
        <button type="button" class="btn btn-secondary" id="cancel-edit">Annuler</button>
        <button type="button" class="btn btn-secondary" id="reset-char">♻️ Défaut</button>
      </div>
    ` : `
      <div class="btn-row">
        <button type="button" class="btn btn-primary" id="prof-chat">💬 Discuter</button>
        <button type="button" class="btn btn-secondary" id="prof-edit">✏️ Modifier</button>
      </div>
    `}
  `;

  root.querySelectorAll(".gallery img").forEach((img) => {
    img.onclick = () => openLightbox(Number(img.dataset.i) || 0);
  });
  if ($("btn-gen-img")) $("btn-gen-img").onclick = () => generateProfileImage();
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
      if (k === "age") v = parseInt(v, 10) || 18;
      if (k === "tags") v = v.split(/[,;#]+/).map((x) => x.trim()).filter(Boolean);
      if (k === "gallery") v = v.split("\n").map((x) => x.trim()).filter(Boolean);
      next[k] = v;
    });
    saveCharOverrides(next);
    state.character = next;
    state.editMode = false;
    renderProfile();
  };
}

async function ensureChatStarted() {
  const c = state.character;
  if (!c) return;
  try {
    const data = await api("/api/chat/lea");
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
      await api("/api/chat/lea", {
        method: "POST",
        body: JSON.stringify({ messages: state.chat.messages, init: true }),
      });
    } catch (_) {
      localStorage.setItem("lea.chat.lea", JSON.stringify(state.chat));
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
        <img src="${cover}" alt="" />
        <div class="info">
          <strong>💜 ${c.name}</strong>
          <small>${c.age} ans · ${c.title || ""}</small>
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
    if (!confirm("Recommencer la conversation avec Léa ?")) return;
    state.chat = { messages: [] };
    localStorage.removeItem("lea.chat.lea");
    try {
      await api("/api/chat/lea", { method: "DELETE" });
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
    const res = await api("/api/chat/lea", {
      method: "POST",
      body: JSON.stringify({
        message: text,
        messages: state.chat.messages,
        character: state.character,
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
    localStorage.setItem("lea.chat.lea", JSON.stringify(state.chat));
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


async function generateProfileImage() {
  const c = state.character;
  if (!c) return;
  const st = loadSettings();
  const status = $("gen-status");
  const preview = $("gen-preview");
  const btn = $("btn-gen-img");
  const extra = ($("gen-extra") && $("gen-extra").value.trim()) || "";
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Génération…"; }
  if (status) status.textContent = "Envoi à Cloudflare Workers AI (FLUX)…";
  try {
    const res = await api("/api/image/cloudflare", {
      method: "POST",
      body: JSON.stringify({ character: c, settings: st, extra }),
    });
    if (!res || !res.image) throw new Error((res && res.error) || "Pas d'image renvoyée");
    const dataUrl = res.image;
    // Ajouter en tête de galerie + overrides
    const next = Object.assign({}, c);
    next.gallery = [dataUrl].concat((c.gallery || []).filter((x) => x !== dataUrl)).slice(0, 40);
    next.cover = dataUrl;
    saveCharOverrides(next);
    state.character = next;
    if (status) status.innerHTML = '<span class="status-pill ok">✓ Image ajoutée à la galerie</span>';
    if (preview) preview.innerHTML = '<img src="' + dataUrl + '" alt="Générée" style="width:100%;border-radius:14px;max-height:60vh;object-fit:contain" />';
    // refresh gallery grid without full re-render if possible
    renderProfile();
  } catch (e) {
    if (status) status.innerHTML = '<span class="status-pill bad">✗ ' + String(e.message || e).slice(0, 280) + '</span>';
  }
  if (btn) { btn.disabled = false; btn.textContent = "✨ Générer (physique fidèle)"; }
}

function renderSettings() {
  const root = $("view-settings");
  const s = loadSettings();
  root.innerHTML = `
    <div class="section">
      <h2>🔑 Clés API (dialogue)</h2>
      <div class="settings-block">
        <label>Gemini (une clé par ligne)</label>
        <textarea class="edit-area" id="set-gemini" placeholder="aq… ou AIza…">${s.geminiKeys || s.GEMINI_API_KEYS || ""}</textarea>
        <p class="hint">Clés Google AI Studio (<strong>AIza…</strong> ou <strong>aq…</strong>). Modèles : <strong>gemini-3.5-flash-lite</strong>, 3.8-flash (les 2.x renvoient souvent 404).</p>
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
        <p class="hint">Workers AI · FLUX.1 Schnell. Multi-clés avec rotation auto si quota / erreur 400-429.</p>
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
}

function openLightbox(i) {
  const g = (state.character && state.character.gallery) || [];
  if (!g.length) return;
  state.lbIndex = ((i % g.length) + g.length) % g.length;
  const lb = $("lightbox");
  const img = $("lightbox-img");
  img.src = g[state.lbIndex];
  lb.classList.remove("hidden");
}
function closeLightbox() {
  $("lightbox").classList.add("hidden");
}

async function initCharacter() {
  let base = null;
  try {
    const list = await api("/api/characters");
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
  state.character = mergeChar(base);
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
  bindNav();
  await initCharacter();
  showView("discover");
})();
