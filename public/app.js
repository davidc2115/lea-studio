const FALLBACK_LEA = {
  id: "lea",
  name: "Léa Moreau",
  age: 18,
  title: "Ta meilleure amie coincée par l'orage",
  tags: ["timide", "meilleure amie", "romance", "réaliste", "nsfw"],
  greeting:
    "Euh… désolée de te déranger…\nJe… j'ai été surprise par l'orage et…\nJe suis complètement trempée…\nTu… tu pourrais me laisser entrer un moment… s'il te plaît ?",
  scenario:
    "Léa, meilleure amie d'enfance de 18 ans, s'est fait surprendre par un orage violent. Elle frappe à la porte de chez toi, trempée, en jean moulant et top court.",
  personality: "Timide, maladroite, voix douce. Rougit facilement.",
  appearance: "Cheveux bruns lisses jusqu'aux reins, yeux marron foncé, peau claire, poitrine généreuse 95D.",
};

const state = {
  characters: [FALLBACK_LEA],
  chat: { messages: [], memories: [], summaries: [], relationship: { closeness: 1, trust: 1, heat: 0 } },
  current: "lea",
  mode: localStorage.getItem("lea.mode") || "auto",
  view: "discover",
};

function character() {
  return (state.characters && state.characters[0]) || FALLBACK_LEA;
}

const $ = (id) => document.getElementById(id);

async function api(path, opts = {}) {
  if (window.LEA_NATIVE && window.leaNativeApi) {
    return window.leaNativeApi(path, opts);
  }
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function show(view) {
  state.view = view;
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  document.querySelectorAll(".nav").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $("view-" + view).classList.remove("hidden");
}


function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function buildLeaImagePrompt(extra = "") {
  const c = (state.characters && state.characters[0]) || {};
  const moods = [
    "shy blushing, looking down then peeking up",
    "playful mischievous smirk, espiègle",
    "soft sexy gaze at camera, lips slightly parted",
    "provocative but still a bit timid, biting lip",
    "embarrassed, cheeks pink, arms loosely crossed",
    "teasing half-smile, one eyebrow raised",
    "vulnerable and wet, quiet intimacy"
  ];
  const poses = [
    "standing in the open apartment doorway",
    "leaning on the doorframe, hip cocked",
    "just inside the entrance, dripping on the tiles",
    "one hand in wet hair, other on the door",
    "sitting on the floor by the open door, knees up",
    "turning back toward the rain then looking over her shoulder"
  ];
  const cams = [
    "medium shot", "three-quarter portrait", "full body in doorway", "close cinematic portrait"
  ];
  const mood = pick(moods);
  const pose = pick(poses);
  const cam = pick(cams);
  return [
    "Photorealistic photograph of " + (c.name || "Léa") + ", 18 years old.",
    "Physical: " + (c.appearance || "long straight dark brown hair to lower back, dark brown eyes, fair skin, generous 95D bust, slim waist, marked hips") + ".",
    "SCENARIO LOCK (must keep clothing + place): violent thunderstorm night, apartment front door / hallway, she is soaked from the rain, wearing a short wet white crop top clinging to her chest and tight wet dark jeans. Rain and lightning visible outside. Warm indoor lamp light.",
    "Pose: " + pose + ".",
    "Attitude: " + mood + ".",
    "Camera: " + cam + ".",
    extra ? ("User note: " + extra) : "",
    "Same unique face every time. Realistic skin, wet hair, rain droplets. Adult 18+. Not nude, stay in the wet crop top and jeans of the storm scene."
  ].filter(Boolean).join(" ");
}

const GALLERY = [
  { src: "images/lea-portrait.jpg", title: "Portrait" },
  { src: "images/lea-orage.jpg", title: "Trempée à la porte" },
  { src: "images/lea-orage-timide.jpg", title: "Orage, timide" },
  { src: "images/lea-orage-espiegle.jpg", title: "Orage, espiègle" },
  { src: "images/lea-orage-sol.jpg", title: "Assise sous la pluie" },
  { src: "images/lea-orage-dentelle.jpg", title: "Orage, top dentelle" },
  { src: "images/lea-feu.jpg", title: "Sèche ses cheveux au feu" },
  { src: "images/lea-serviette.jpg", title: "Serviette au coin du feu" },
  { src: "images/lea-feu-sol.jpg", title: "Trempée au tapis" },
  { src: "images/lea-feu-pierre.jpg", title: "Devant la cheminée" },
  { src: "images/lea-feu-genoux.jpg", title: "À genoux près du feu" },
  { src: "images/lea-canape.jpg", title: "Nuisette satin" },
  { src: "images/lea-nuisette-satin.jpg", title: "Nuisette satin, sourire" },
  { src: "images/lea-nuisette-dentelle.jpg", title: "Nuisette dentelle fine" },
  { src: "images/lea-nuisette-timide.jpg", title: "Nuisette, regard baissé" },
  { src: "images/lea-lingerie-ivoire.jpg", title: "Lingerie ivoire" },
  { src: "images/lea-lingerie-rouge.jpg", title: "Lingerie rouge" },
  { src: "images/lea-lingerie-rouge-dos.jpg", title: "Lingerie rouge, de dos" },
  { src: "images/lea-sortie.jpg", title: "Haut blanc, prête à sortir" },
  { src: "images/lea-sortie-decollete.jpg", title: "Sortie, décolleté" },
];

function openFull(src) {
  $("lightbox-img").src = src;
  $("lightbox").classList.remove("hidden");
}

function extraPhotos() {
  try { return JSON.parse(localStorage.getItem("lea.photos") || "[]"); } catch { return []; }
}
function saveExtra(list) { localStorage.setItem("lea.photos", JSON.stringify(list)); }

function renderDiscover() {
  const c = character();
  $("view-discover").innerHTML = `
    <h1>Découvrir</h1>
    <div class="grid">
      <article class="card discover-card">
        <div class="cover-frame"><img class="cover-img" src="images/lea-orage-dentelle.jpg" alt="Léa" /></div>
        <div class="body">
          <strong>${c.name}</strong>
          <div style="color:var(--muted);font-size:13px">${c.title}</div>
          <div class="tags">${(c.tags || []).map((t) => `<span class="tag">${t}</span>`).join("")}</div>
          <p style="color:#d7c8dc;font-size:14px">${c.scenario || ""}</p>
          <button class="cta" id="start-lea">Discuter</button>
          <button class="cta" id="open-profile" style="margin-left:8px;background:#3a2048">Profil</button>
        </div>
      </article>
    </div>`;
  $("start-lea").onclick = () => { show("chat"); renderChat(); };
  $("open-profile").onclick = () => { show("profile"); renderProfile(); };
}

function renderProfile() {
  const extras = extraPhotos();
  const all = GALLERY.concat(extras.map((src, i) => ({ src, title: "Générée " + (i + 1) })));
  $("view-profile").innerHTML = `
    <h1>Léa Moreau</h1>
    <img class="profile-hero" src="images/lea-portrait.jpg" alt="Léa" data-full="images/lea-portrait.jpg" />
    <p style="color:var(--muted)">18 ans · meilleure amie timide · coincée par l'orage</p>
    <p>Cheveux bruns lisses jusqu'aux reins, regard doux, poitrine généreuse. Elle rougit facilement.</p>
    <h3>Photos</h3>
    <div class="gallery">
      ${all.map((g) => `<img src="${g.src}" alt="${g.title}" title="${g.title}" data-full="${g.src}" />`).join("")}
    </div>
    <h3 style="margin-top:18px">Photo du scénario</h3>
    <p style="color:var(--muted);font-size:13px">Toujours Léa : physique + orage + top court mouillé + jean moulant + porte. Pose et attitude tirées au sort (timide, sexy, provocante, espiègle…).</p>
    <textarea class="field" id="imgprompt" rows="2" placeholder="Optionnel : détail en plus (ex: elle frappe à la porte)"></textarea>
    <p style="margin-top:8px">
      <button class="cta" id="genimg">Générer (aléatoire)</button>
    </p>
    <p class="err" id="imgerr"></p>`;
  $("view-profile").onclick = (e) => {
    const full = e.target.getAttribute("data-full");
    if (full) openFull(full);
  };
  $("genimg").onclick = generatePhoto;
}

async function generatePhoto() {
  const extra = ($("imgprompt").value || "").trim();
  const prompt = buildLeaImagePrompt(extra);
  $("imgerr").textContent = "Génération scène orage…";
  try {
    const data = await api("/api/image", { method: "POST", body: JSON.stringify({ prompt }) });
    const list = extraPhotos();
    list.unshift(data.url);
    saveExtra(list.slice(0, 20));
    $("imgerr").textContent = "";
    renderProfile();
    openFull(data.url);
  } catch (e) {
    $("imgerr").textContent = e.message;
  }
}

function paintMessages() {
  const box = $("msgs");
  if (!box) return;
  const c = character();
  const msgs = state.chat?.messages || [];
  if (!msgs.length) {
    box.innerHTML = `<div class="bubble assistant">${escapeHtml(c.greeting)}</div>`;
  } else {
    box.innerHTML = msgs.map((m) => `<div class="bubble ${m.role === "user" ? "user" : "assistant"}">${escapeHtml(m.content)}</div>`).join("");
  }
  box.scrollTop = box.scrollHeight;
  const rel = state.chat?.relationship || {};
  if ($("rel")) {
    $("rel").innerHTML = `<p style="font-size:13px;color:var(--rose)">Proximité ${rel.closeness || 1}/10 · Confiance ${rel.trust || 1}/10 · Tension ${rel.heat || 0}/10</p>`;
  }
  if ($("mode-now")) {
    const heat = rel.heat || 0;
    const label = state.mode === "nsfw" ? "NSFW forcé" : state.mode === "sfw" ? "SFW forcé" : (heat >= 4 ? "Auto · NSFW" : "Auto · SFW");
    $("mode-now").textContent = label;
  }
}

function renderChat() {
  const c = character();
  $("view-chat").innerHTML = `
    <div class="chat-wrap">
      <div class="thread">
        <div style="padding:12px 16px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div><strong>${c.name}</strong><div style="font-size:12px;color:var(--muted)">${c.title}</div><div class="mode-pill" id="mode-now">Auto · SFW</div></div>
          <button class="cta" type="button" id="reset">Nouvelle scène</button>
        </div>
        <div class="msgs" id="msgs"></div>
        <div class="composer">
          <textarea id="input" placeholder="Écris à Léa…"></textarea>
          <button class="cta" type="button" id="send">Envoyer</button>
        </div>
      </div>
      <aside class="side">
        <label>Mode</label>
        <select id="mode">
          <option value="auto">Auto (SFW ↔ NSFW)</option>
          <option value="sfw">SFW forcé</option>
          <option value="nsfw">NSFW 18+ forcé</option>
        </select>
        <p style="font-size:12px;color:var(--muted)">Auto par défaut : Léa reste douce, puis bascule en NSFW seulement si tu l'orientes.</p>
        <p style="font-size:13px;color:var(--muted);white-space:pre-wrap">${escapeHtml(c.greeting)}</p>
        <div id="rel"></div>
        <p class="err" id="err"></p>
      </aside>
    </div>`;
  const modeEl = $("mode");
  if (modeEl) {
    modeEl.value = state.mode || "auto";
    modeEl.onchange = (e) => {
      state.mode = e.target.value || "auto";
      localStorage.setItem("lea.mode", state.mode);
      paintMessages();
    };
  }
  paintMessages();
  $("send").onclick = (e) => { e.preventDefault(); send(); };
  $("input").onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };
  $("reset").onclick = async () => {
    try {
      state.chat = await api("/api/chat/lea/reset", { method: "POST" });
    } catch {
      state.chat = { messages: [], memories: [], summaries: [], relationship: { closeness: 1, trust: 1, heat: 0 } };
    }
    paintMessages();
  };
}

async function send() {
  const input = $("input");
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  if (!state.chat) state.chat = { messages: [], memories: [], summaries: [], relationship: { closeness: 1, trust: 1, heat: 0 } };
  if (!Array.isArray(state.chat.messages)) state.chat.messages = [];
  state.chat.messages.push({ role: "user", content: text, ts: Date.now() });
  paintMessages();
  const box = $("msgs");
  if (box) {
    box.insertAdjacentHTML("beforeend", `<div class="bubble assistant" id="pending">Léa réfléchit…</div>`);
    box.scrollTop = box.scrollHeight;
  }
  if ($("err")) $("err").textContent = "";
  const sendBtn = $("send");
  if (sendBtn) sendBtn.disabled = true;
  try {
    const data = await api("/api/chat/lea/message", {
      method: "POST",
      body: JSON.stringify({ text, mode: state.mode || "auto" }),
    });
    if (data && data.chat && Array.isArray(data.chat.messages) && data.chat.messages.length) {
      state.chat = data.chat;
    } else if (data && data.reply) {
      state.chat.messages.push({ role: "assistant", content: data.reply, ts: Date.now() });
    } else {
      throw new Error("Réponse vide");
    }
    paintMessages();
  } catch (e) {
    const pending = $("pending");
    if (pending) pending.remove();
    state.chat.messages.push({
      role: "assistant",
      content: "*elle reste sur le seuil, trempée, la voix petite*\nJe… je t'écoute.\n(" + (e.message || "erreur") + " — ajoute une clé Gemini / OpenAI / Grok dans Réglages.)",
      ts: Date.now(),
    });
    paintMessages();
    if ($("err")) $("err").textContent = e.message;
  } finally {
    if ($("send")) $("send").disabled = false;
    if ($("input")) $("input").focus();
  }
}

function renderMemory() {
  const mems = state.chat?.memories || [];
  const sums = state.chat?.summaries || [];
  $("view-memory").innerHTML = `
    <h1>Gestionnaire de mémoire</h1>
    <p style="color:var(--muted)">Comme SpicyChat : faits extraits auto, souvenirs épinglés, résumés de scènes.</p>
    <div style="display:flex;gap:8px;margin:12px 0">
      <input id="newmem" placeholder="Ajouter un souvenir (max 250)" />
      <button class="cta" id="addmem">Ajouter</button>
    </div>
    ${mems.map((m) => `
      <div class="mem">
        ${m.pinned ? "📌 " : ""}${escapeHtml(m.text)}
        <div style="margin-top:6px">
          <button data-pin="${m.id}">${m.pinned ? "Désépingler" : "Épingler"}</button>
          <button data-del="${m.id}">Supprimer</button>
        </div>
      </div>`).join("") || "<p>Pas encore de souvenirs.</p>"}
    <h3>Résumés</h3>
    ${sums.map((s) => `<div class="mem">${escapeHtml(s.text)}</div>`).join("") || "<p>Aucun résumé.</p>"}`;
  $("addmem").onclick = async () => {
    const text = $("newmem").value.trim();
    if (!text) return;
    state.chat = await api("/api/chat/lea/memory", { method: "POST", body: JSON.stringify({ text, pinned: true }) });
    renderMemory();
  };
  $("view-memory").onclick = async (e) => {
    const pin = e.target.getAttribute("data-pin");
    const del = e.target.getAttribute("data-del");
    if (pin) {
      const mem = mems.find((m) => String(m.id) === pin);
      state.chat = await api(`/api/chat/lea/memory/${pin}`, { method: "PATCH", body: JSON.stringify({ pinned: !mem.pinned }) });
      renderMemory();
    }
    if (del) {
      state.chat = await api(`/api/chat/lea/memory/${del}`, { method: "DELETE" });
      renderMemory();
    }
  };
}

function renderSettings() {
  $("view-settings").innerHTML = `
    <h1>Clés API & persona</h1>
    <label>Provider par défaut</label>
    <select id="provider">
      <option value="gemini">Gemini</option>
      <option value="openai">OpenAI</option>
    </select>
    <label>Modèle Gemini (texte / chat)</label>
    <select id="gemtextmodel">
      <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite (défaut, NSFW ok)</option>
      <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
      <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
    </select>
    <label>Clés Gemini (plusieurs, séparées par virgule)</label>
    <textarea class="field" id="gemini" rows="3" placeholder="AIza...,AIza..."></textarea>
    <label>Clés OpenAI (plusieurs, séparées par virgule)</label>
    <textarea class="field" id="openai" rows="3" placeholder="sk-...,sk-..."></textarea>
    <label>Clés Grok / xAI (plusieurs, séparées par virgule)</label>
    <textarea class="field" id="grok" rows="3" placeholder="xai-...,xai-..."></textarea>
    <h3>Génération d'images</h3>
    <label>Provider images</label>
    <select id="imgprov">
      <option value="grok">Grok Imagine (xAI)</option>
      <option value="gemini">Gemini (Nano Banana 2 / 2.5 Flash Image)</option>
      <option value="openai">OpenAI (gpt-image / DALL·E)</option>
      <option value="auto">Auto (Grok → Gemini → OpenAI)</option>
    </select>
    <label>Modèle Gemini images</label>
    <select id="gemimgmodel">
      <option value="gemini-3.1-flash-image">Nano Banana 2 (gemini-3.1-flash-image)</option>
      <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image</option>
      <option value="auto">Auto (Nano Banana 2 puis 2.5 Flash Image)</option>
    </select>
    <label>Clés images (optionnel — sinon on réutilise Gemini / OpenAI ci-dessus)</label>
    <textarea class="field" id="imgkeys" rows="3" placeholder="xai-... / AIza... / sk-... une par ligne"></textarea>
    <p style="color:var(--muted);font-size:13px">Les clés restent sur l'appareil (réglages). Rien n'est collé dans le code.</p>
    <label>Ton nom / persona</label>
    <input id="pname" />
    <label>Bio persona</label>
    <textarea class="field" id="pbio" rows="3"></textarea>
    <p style="margin-top:12px"><button class="cta" id="save">Enregistrer</button></p>
    <p id="st" class="err"></p>`;
  api("/api/status").then((s) => {
    $("provider").value = s.settings.provider || "gemini";
    if ($("gemtextmodel")) $("gemtextmodel").value = s.settings.geminiTextModel || "gemini-3.5-flash-lite";
    $("imgprov").value = s.settings.imageProvider || "auto";
    if ($("gemimgmodel")) $("gemimgmodel").value = s.settings.geminiImageModel || "auto";
    $("pname").value = s.settings.personaName || "";
    $("pbio").value = s.settings.personaBio || "";
    $("gemini").value = s.settings.geminiKeys || "";
    $("openai").value = s.settings.openaiKeys || "";
    $("grok").value = s.settings.grokKeys || "";
    $("imgkeys").value = s.settings.imageKeys || "";
    $("st").textContent = `Clés — Gemini: ${s.keys.gemini} | OpenAI: ${s.keys.openai} | Grok: ${s.keys.grok || 0} | Images: ${s.keys.image || 0}`;
    $("st").style.color = "#9dffc2";
  });
  $("save").onclick = async () => {
    const data = await api("/api/settings", {
      method: "POST",
      body: JSON.stringify({
        provider: $("provider").value,
        personaName: $("pname").value,
        personaBio: $("pbio").value,
        geminiKeys: $("gemini").value,
        openaiKeys: $("openai").value,
        grokKeys: $("grok").value,
        imageKeys: $("imgkeys").value,
        imageProvider: $("imgprov").value,
        geminiImageModel: $("gemimgmodel") ? $("gemimgmodel").value : "auto",
        geminiTextModel: $("gemtextmodel") ? $("gemtextmodel").value : "gemini-3.5-flash-lite",
      }),
    });
    $("st").textContent = `OK — Gemini ${data.keys.gemini} / OpenAI ${data.keys.openai} / Grok ${data.keys.grok || 0} / Images ${data.keys.image || 0}`;
    $("st").style.color = "#9dffc2";
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

document.querySelectorAll(".nav").forEach((b) => {
  b.onclick = () => {
    show(b.dataset.view);
    if (b.dataset.view === "discover") renderDiscover();
    if (b.dataset.view === "profile") renderProfile();
    if (b.dataset.view === "chat") renderChat();
    if (b.dataset.view === "memory") renderMemory();
    if (b.dataset.view === "settings") renderSettings();
  };
});

(async function init() {
  try {
    const chars = await api("/api/characters");
    if (Array.isArray(chars) && chars[0]) state.characters = chars;
  } catch { /* fallback Léa déjà en mémoire */ }
  try {
    const chat = await api("/api/chat/lea");
    if (chat) state.chat = chat;
  } catch { /* chat vide local */ }
  if (!state.mode) state.mode = "auto";
  renderDiscover();
})();
