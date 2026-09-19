const FALLBACK_LEA = (window.CAST && window.CAST[0]) || { id: "lea", name: "Léa Moreau", age: 18, title: "", tags: [], greeting: "", scenario: "", personality: "", appearance: "", cover: "images/lea-portrait.jpg", gallery: [] };

const state = {
  characters: window.CAST || [FALLBACK_LEA],
  chat: { messages: [], memories: [], summaries: [], relationship: { closeness: 1, trust: 1, heat: 0 } },
  current: "lea",
  mode: localStorage.getItem("lea.mode") || "auto",
  view: "discover",
};

function character() {
  const list = state.characters.length ? state.characters : window.CAST || [FALLBACK_LEA];
  return list.find((c) => c.id === state.current) || list[0] || FALLBACK_LEA;
}

function chatKey() {
  return "lea.chat." + (state.current || "lea");
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
  document.body.classList.toggle("chat-open", view === "chat");
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  document.querySelectorAll(".nav").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $("view-" + view).classList.remove("hidden");
}


function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function buildLeaImagePrompt(extra = "") {
  const c = character();
  if (c.id === "lea") {
    // Très court + ordre strict. Img2img part d'une photo ORAGE déjà trempée.
    return [
      `${c.age || 21} year old woman who looks ${c.age || 21}, not older,`,
      "keep the exact same face and body,",
      "soaked wet white short crop top clinging to large breasts,",
      "tight wet dark blue skinny jeans,",
      "rain water droplets on skin and clothes,",
      "apartment doorway hallway at night thunderstorm,",
      "photorealistic DSLR photo natural skin pores,",
      extra || "",
      "NOT dry, NOT studio wall, NOT burgundy top, NOT long sleeves, NOT outdoor forest, NOT plastic skin, NOT CGI"
    ].filter(Boolean).join(" ");
  }
  const outfit = pick(c.outfits || ["sexy casual outfit"]);
  const place = pick(c.places || ["apartment interior at night"]);
  const age = c.age || 21;
  const bodyLock = {
    sofia: "VOLUPTUOUS hourglass, extremely LARGE heavy 100E breasts, tiny cinched waist, wide hips, curvy Italian, NOT slim, NOT athletic, NOT small chest",
    amelie: "CHUBBY plus-size soft belly, very LARGE heavy breasts, round cheeks, NOT slim",
    aya: "ATHLETIC lean muscle, SMALL firm A-B breasts, NOT large chest",
    jade: "VERY THIN petite, FLAT small A-cup, glasses, NOT curvy",
    bruna: "tiny waist HUGE round Brazilian butt, NOT skinny hips",
    elise: "very LARGE heavy breasts, soft French body",
    fatou: "tall powerful hips, extremely LARGE heavy breasts",
    lina: "petite Korean, VERY small chest, NOT busty",
    mei: "thin Chinese, flat chest, NOT curvy",
    olga: "plump Russian, heavy large breasts, full hips",
    keisha: "dark skin, large breasts, very round butt",
    camila: "thick round butt, slim waist, Colombian curves",
    myriam: "full soft body, large D breasts, wide hips",
    ines: "golden tan, wide hips, medium C breasts, NOT tiny",
  }[c.id] || (c.body || "");
  return [
    bodyLock + ",",
    age + " year old woman who looks " + age + ", not older,",
    (c.appearance || "") + ",",
    outfit + ",",
    place + ",",
    "photorealistic unique face, adult " + age + ",",
    extra || ""
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
  const btn = $("lb-bg");
  if (btn) {
    btn.onclick = (e) => {
      e.stopPropagation();
      localStorage.setItem("lea.chatBg", src);
      btn.textContent = "Fond du chat ✓";
    };
    btn.textContent = "Utiliser comme fond";
  }
}

function extraPhotos() {
  try { return JSON.parse(localStorage.getItem("lea.photos." + (state.current || "lea")) || "[]"); } catch { return []; }
}
function saveExtra(list) { localStorage.setItem("lea.photos." + (state.current || "lea"), JSON.stringify(list)); }
function loadChat(id) {
  try { return JSON.parse(localStorage.getItem("lea.chat." + (id || "lea")) || "null"); } catch { return null; }
}

function chatPreview(chat) {
  const msgs = chat?.messages || [];
  if (!msgs.length) return "Nouvelle conversation";
  const last = msgs[msgs.length - 1];
  return String(last.content || "").replace(/\s+/g, " ").slice(0, 80);
}

function renderDiscover() {
  const list = state.characters.length ? state.characters : [FALLBACK_LEA];
  $("view-discover").innerHTML = `
    <h1>Découvrir</h1>
    <div class="grid">
      ${list.map((c) => `
      <article class="card discover-card">
        <div class="cover-frame"><img class="cover-img" src="${c.cover || "images/lea-portrait.jpg"}" alt="${c.name}" /></div>
        <div class="body">
          <strong>${c.name}</strong>
          <div style="color:var(--muted);font-size:13px">${c.title || ""}</div>
          <div class="tags">${[c.body, c.ethnicity].filter(Boolean).concat(c.tags || []).slice(0,6).map((t) => `<span class="tag">${t}</span>`).join("")}</div>
          <p style="color:#d7c8dc;font-size:14px">${c.scenario || ""}</p>
          <button class="cta start-chat" data-id="${c.id}">Discuter</button>
          <button class="cta open-profile" data-id="${c.id}" style="margin-left:8px;background:#3a2048">Profil</button>
        </div>
      </article>`).join("")}
    </div>`;
  $("view-discover").onclick = (e) => {
    const start = e.target.closest(".start-chat");
    const prof = e.target.closest(".open-profile");
    if (start) {
      state.current = start.dataset.id || "lea";
      state.chat = loadChat(state.current) || { messages: [], memories: [], summaries: [], relationship: { closeness: 1, trust: 1, heat: 0 } };
      show("chat"); renderChat();
    }
    if (prof) { state.current = prof.dataset.id || "lea"; show("profile"); renderProfile(); }
  };
}

function renderChats() {
  const list = state.characters.length ? state.characters : [FALLBACK_LEA];
  const chat = state.chat || {};
  $("view-chats").innerHTML = `
    <h1>Chats</h1>
    <p style="color:var(--muted);font-size:13px">Reprends une discussion en cours.</p>
    ${list.map((c) => `
      <article class="card" style="margin-top:12px">
        <div class="body" style="display:flex;gap:12px;align-items:center">
          <img src="${c.cover || "images/lea-portrait.jpg"}" alt="" style="width:56px;height:56px;border-radius:14px;object-fit:cover" />
          <div style="flex:1;min-width:0">
            <strong>${c.name}</strong>
            <div style="color:var(--muted);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${chatPreview(loadChat(c.id))}</div>
          </div>
          <button class="cta resume-chat" data-id="${c.id}">Ouvrir</button>
        </div>
      </article>`).join("")}`;
  $("view-chats").onclick = (e) => {
    const b = e.target.closest(".resume-chat");
    if (!b) return;
    state.current = b.dataset.id || "lea";
    state.chat = loadChat(state.current) || { messages: [], memories: [], summaries: [], relationship: { closeness: 1, trust: 1, heat: 0 } };
    show("chat");
    renderChat();
  };
}

function renderProfile() {
  const c = character();
  const extras = extraPhotos();
  const base = (c.gallery && c.gallery.length ? c.gallery : GALLERY.map((g) => g.src)).map((src, i) => ({ src, title: "Photo " + (i + 1) }));
  const genItems = extras.map((src, i) => ({ src, title: "Générée " + (i + 1), gen: true, idx: i }));
  const all = base.map((g) => ({ ...g, gen: false })).concat(genItems);
  $("view-profile").innerHTML = `
    <h1>${c.name}</h1>
    <img class="profile-hero" src="${c.cover || (all[0] && all[0].src) || ""}" alt="${c.name}" data-full="${c.cover || (all[0] && all[0].src) || ""}" />
    <p style="color:var(--muted)">${c.age || 18} ans · ${c.title || ""}</p>
    <p>${c.appearance || ""}</p>
    <p style="color:#d7c8dc;font-size:14px">${c.scenario || ""}</p>
    <h3>Photos</h3>
    <div class="gallery">
      ${all.map((g) => g.gen
        ? `<div class="gal-item"><img src="${g.src}" alt="${g.title}" title="${g.title}" data-full="${g.src}" /><button type="button" class="gal-del" data-del="${g.idx}" title="Supprimer">×</button></div>`
        : `<div class="gal-item"><img src="${g.src}" alt="${g.title}" title="${g.title}" data-full="${g.src}" /></div>`
      ).join("")}
    </div>
    <h3 style="margin-top:18px">Photo du scénario</h3>
    <p style="color:var(--muted);font-size:13px">${c.id === 'lea' ? 'Toujours Léa orage : top court blanc MOUILLÉ + jean moulant + porte la nuit. Horde gratuit = visage variable. Tu peux supprimer les générées avec ×.' : ('Scénario de ' + c.name + ' · × pour supprimer une générée.')}</p>
    <textarea class="field" id="imgprompt" rows="2" placeholder="Optionnel : détail en plus (ex: elle frappe à la porte)"></textarea>
    <label style="display:block;margin-top:10px">Moteur images</label>
    <select id="imgengine-profile">
      <option value="horde">Horde (cloud gratuit)</option>
      <option value="local">Local SD 1.5 (pack téléphone)</option>
    </select>
    <p style="margin-top:8px">
      <button class="cta" id="genimg">Générer (aléatoire)</button>
    </p>
    <p class="err" id="imgerr"></p>`;
  $("view-profile").onclick = (e) => {
    const del = e.target.getAttribute("data-del");
    if (del != null) {
      e.stopPropagation();
      const list = extraPhotos();
      const i = Number(del);
      if (i >= 0 && i < list.length) {
        list.splice(i, 1);
        saveExtra(list);
        renderProfile();
      }
      return;
    }
    const full = e.target.getAttribute("data-full");
    if (full) openFull(full);
  };
  try {
    const st = JSON.parse(localStorage.getItem("lea.settings") || "{}");
    if ($("imgengine-profile")) $("imgengine-profile").value = st.imageEngine || "horde";
    $("imgengine-profile").onchange = () => {
      const cur = JSON.parse(localStorage.getItem("lea.settings") || "{}");
      cur.imageEngine = $("imgengine-profile").value;
      localStorage.setItem("lea.settings", JSON.stringify(cur));
    };
  } catch (_) {}
  $("genimg").onclick = generatePhoto;
}

function setGenStatus(t) {
  if ($("imgerr")) $("imgerr").textContent = t;
}

async function imageToBase64(src) {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const s = String(fr.result || "");
        const i = s.indexOf(",");
        resolve(i >= 0 ? s.slice(i + 1) : s);
      };
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function generatePhoto() {
  if (window._leaGenBusy) {
    setGenStatus("Déjà une génération en cours…");
    return;
  }
  const extra = ($("imgprompt") && $("imgprompt").value || "").trim();
  const prompt = buildLeaImagePrompt(extra);
  const c = character();
  window._leaGenBusy = true;
  setGenStatus("Préparation…");
  try {
    const engine = (localStorage.getItem("lea.settings") && JSON.parse(localStorage.getItem("lea.settings") || "{}").imageEngine) || "horde";
    if (engine === "local") {
      setGenStatus("Local SD 1.5…");
      let localOk = false;
      if (window.LeaAndroid && window.LeaAndroid.localGenerate) {
        try {
          const raw = window.LeaAndroid.localGenerate(prompt);
          const data = typeof raw === "string" ? JSON.parse(raw) : raw;
          if (data && data.url) {
            const list = extraPhotos();
            list.unshift(data.url);
            saveExtra(list.slice(0, 20));
            setGenStatus(data.note || "Image locale prête");
            window._leaGenBusy = false;
            if (state.view === "profile") renderProfile();
            openFull(data.url);
            return;
          }
        } catch (_) {}
      }
      setGenStatus("Pack local absent → Horde (morphologie du perso)…");
    }
    const payload = { prompt };
    // Léa : img2img depuis une photo de la galerie pour coller le visage
    if (c.id === "lea") {
      setGenStatus("Référence visage Léa…");
      // Réf ORAGE (déjà trempée + porte) — pas le portrait sec
      const ref = await imageToBase64("images/lea-orage-dentelle.jpg")
        || await imageToBase64("images/lea-orage.jpg")
        || await imageToBase64("images/lea-orage-timide.jpg");
      if (ref) {
        payload.source_image = ref;
        payload.source_processing = "img2img";
        payload.denoising = 0.28;
        setGenStatus("Horde Juggernaut/ICBINP img2img (orage)…");
      } else {
        setGenStatus("Horde texte (sans ref)…");
      }
    } else {
      setGenStatus("Horde : envoi du job…");
    }
    const start = await api("/api/image", { method: "POST", body: JSON.stringify(payload) });
    if (!start.jobId) throw new Error("Pas de job Horde");
    setGenStatus("Horde file d’attente… tu peux quitter cet écran");
    pollHordeJob(start.jobId, start.host);
  } catch (e) {
    window._leaGenBusy = false;
    setGenStatus(String(e.message || e));
  }
}

async function pollHordeJob(jobId, host) {
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    try {
      const st = await api("/api/image-status", { method: "POST", body: JSON.stringify({ jobId, host }) });
      if (!st.done) {
        const q = st.queue != null ? " file " + st.queue : "";
        const w = st.wait != null ? " ~" + st.wait + "s" : "";
        setGenStatus("Horde en arrière-plan" + q + w + " (" + (i + 1) + ")");
        continue;
      }
      window._leaGenBusy = false;
      if (st.error) {
        setGenStatus(st.error);
        return;
      }
      const list = extraPhotos();
      list.unshift(st.url);
      saveExtra(list.slice(0, 20));
      setGenStatus("Image Horde prête");
      if (state.view === "profile") renderProfile();
      if (st.url) openFull(st.url);
      return;
    } catch (e) {
      setGenStatus("Horde… " + (e.message || e));
    }
  }
  window._leaGenBusy = false;
  setGenStatus("Horde timeout (>3 min). Réessaie.");
}

function formatBubble(text) {
  const raw = String(text || "");
  const parts = [];
  const re = /(~[^~\n]+~|\*[^*\n]+\*|_[^_\n]+_|\([^)\n]{3,}\))/g;
  let last = 0;
  let m;
  while ((m = re.exec(raw))) {
    if (m.index > last) parts.push({ t: "say", v: raw.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith("~") || tok.startsWith("_")) parts.push({ t: "think", v: tok.slice(1, -1) });
    else parts.push({ t: "act", v: tok.slice(1, -1) });
    last = m.index + tok.length;
  }
  if (last < raw.length) parts.push({ t: "say", v: raw.slice(last) });
  if (!parts.length) parts.push({ t: "say", v: raw });
  return parts.map((p) => {
    const v = escapeHtml(p.v).replace(/\n/g, "<br>");
    if (!v.trim()) return "";
    if (p.t === "think") return `<span class="seg think">${v}</span>`;
    if (p.t === "act") return `<span class="seg act">${v}</span>`;
    return `<span class="seg say">${v}</span>`;
  }).join("");
}

function paintMessages() {
  const box = $("msgs");
  if (!box) return;
  const c = character();
  const msgs = state.chat?.messages || [];
  if (!msgs.length) {
    box.innerHTML = `<div class="bubble assistant">${formatBubble(c.greeting)}</div>`;
  } else {
    box.innerHTML = msgs.map((m) => `<div class="bubble ${m.role === "user" ? "user" : "assistant"}">${formatBubble(m.content)}</div>`).join("");
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

function chatBg() {
  return localStorage.getItem("lea.chatBg") || "images/lea-orage-dentelle.jpg";
}
function applyChatLook() {
  const bub = Number(localStorage.getItem("lea.bub") || 82);
  const bgv = Number(localStorage.getItem("lea.bgv") || 38);
  document.documentElement.style.setProperty("--bub", String(bub / 100));
  document.documentElement.style.setProperty("--bgv", String(bgv / 100));
  const el = document.querySelector(".chat-bg");
  if (el) el.style.backgroundImage = "url('" + chatBg() + "')";
}
function applyChatBg() { applyChatLook(); }

function renderChat() {
  const c = character();
  const extras = extraPhotos().map((src, i) => ({ src, title: "Générée " + (i + 1) }));
  const bgs = GALLERY.concat(extras);
  const current = chatBg();
  $("view-chat").innerHTML = `
    <div class="chat-full">
      <div class="chat-bg" style="background-image:url('${current}')"></div>
      <div class="chat-bg-dim"></div>
      <div class="chat-head">
        <button type="button" id="back-disc">←</button>
        <img src="${c.cover || "images/lea-portrait.jpg"}" alt="" />
        <div class="grow">
          <strong>${c.name}</strong>
          <div class="mode-pill" id="mode-now">Auto · SFW</div>
        </div>
        <button type="button" id="open-sheet">⋮</button>
      </div>
      <div class="msgs" id="msgs"></div>
      <div class="composer">
        <textarea id="input" placeholder="Écris à ${c.name}…"></textarea>
        <button class="cta" type="button" id="send">Envoyer</button>
      </div>
      <aside class="sheet hidden" id="sheet">
        <label>Mode</label>
        <select id="mode">
          <option value="auto">Auto (SFW ↔ NSFW)</option>
          <option value="sfw">SFW forcé</option>
          <option value="nsfw">NSFW 18+ forcé</option>
        </select>
        <div id="rel"></div>
        <p class="err" id="err"></p>
        <label>Transparence des bulles</label>
        <input type="range" id="bub-alpha" min="25" max="95" value="${localStorage.getItem("lea.bub") || "82"}" />
        <label>Visibilité du fond</label>
        <input type="range" id="bg-bright" min="15" max="80" value="${localStorage.getItem("lea.bgv") || "38"}" />
        <label>Fond de conversation</label>
        <div class="bg-pick">
          ${bgs.map((g) => `<img src="${g.src}" data-bg="${g.src}" class="${g.src === current ? "on" : ""}" alt="${g.title || ""}" />`).join("")}
        </div>
        <p style="margin-top:12px"><button class="cta" type="button" id="reset">Nouvelle scène</button></p>
        <p style="margin-top:8px"><button type="button" id="close-sheet">Fermer</button></p>
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
  applyChatLook();
  const ba = $("bub-alpha");
  const bb = $("bg-bright");
  if (ba) ba.oninput = () => { localStorage.setItem("lea.bub", ba.value); applyChatLook(); };
  if (bb) bb.oninput = () => { localStorage.setItem("lea.bgv", bb.value); applyChatLook(); };
  $("send").onclick = (e) => { e.preventDefault(); send(); };
  $("input").onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };
  $("back-disc").onclick = () => { show("discover"); };
  $("open-sheet").onclick = () => $("sheet").classList.toggle("hidden");
  $("close-sheet").onclick = () => $("sheet").classList.add("hidden");
  $("sheet").onclick = (e) => {
    const bg = e.target.getAttribute("data-bg");
    if (!bg) return;
    localStorage.setItem("lea.chatBg", bg);
    document.querySelectorAll(".bg-pick img").forEach((img) => img.classList.toggle("on", img.getAttribute("data-bg") === bg));
    applyChatBg();
  };
  $("reset").onclick = async () => {
    try {
      state.chat = await api("/api/chat/" + (state.current || "lea") + "/reset", { method: "POST" });
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
    box.insertAdjacentHTML("beforeend", `<div class="bubble assistant" id="pending">${character().name} réfléchit…</div>`);
    box.scrollTop = box.scrollHeight;
  }
  if ($("err")) $("err").textContent = "";
  const sendBtn = $("send");
  if (sendBtn) sendBtn.disabled = true;
  try {
    const data = await api("/api/chat/" + (state.current || "lea") + "/message", {
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
    state.chat = await api("/api/chat/" + (state.current || "lea") + "/memory", { method: "POST", body: JSON.stringify({ text, pinned: true }) });
    renderMemory();
  };
  $("view-memory").onclick = async (e) => {
    const pin = e.target.getAttribute("data-pin");
    const del = e.target.getAttribute("data-del");
    if (pin) {
      const mem = mems.find((m) => String(m.id) === pin);
      state.chat = await api(`/api/chat/${state.current || "lea"}/memory/${pin}`, { method: "PATCH", body: JSON.stringify({ pinned: !mem.pinned }) });
      renderMemory();
    }
    if (del) {
      state.chat = await api(`/api/chat/${state.current || "lea"}/memory/${del}`, { method: "DELETE" });
      renderMemory();
    }
  };
}

function renderSettings() {
  $("view-settings").innerHTML = `
    <h1>Clés Google AI Studio</h1>
    <p style="color:var(--muted);font-size:13px">Chat : clés Gemini. Images : Horde (cloud gratuit) ou Local SD 1.5 (téléphone, pack optionnel).</p>
    <label>Moteur images</label>
    <select id="imgengine">
      <option value="horde">Horde (cloud gratuit, recommandé)</option>
      <option value="local">Local SD 1.5 (téléphone, pack ~1–2 Go)</option>
    </select>
    <p style="color:var(--muted);font-size:13px">Local : meilleur contrôle hors-ligne. Qualité 512×640, chauffe possible. Le pack se télécharge à part, il n’est pas dans l’APK.</p>
    <label>Modèle Gemini (texte / chat)</label>
    <select id="gemtextmodel">
      <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite</option>
      <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
      <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
    </select>
    <label>Clés Gemini AI Studio (plusieurs, virgule ou ligne)</label>
    <textarea class="field" id="gemini" rows="3" placeholder="aq... ou AIza... une par ligne"></textarea>
    <label>Clé Grok / xAI Imagine (xai-…)</label>
    <textarea class="field" id="grok" rows="2" placeholder="xai-..."></textarea>
    <p style="color:var(--muted);font-size:13px">Grok Imagine : crée la clé sur console.x.ai (crédits API, pas l'abo SuperGrok chat).</p>
    <h3>Images</h3>
    <label>Modèle images</label>
    <select id="gemimgmodel">
      <option value="auto">Auto (Lite → 2.0 → 2.5 → NB2 → Imagen 3)</option>
      <option value="gemini-3.1-flash-lite-image">Nano Banana 2 Lite</option>
      <option value="gemini-2.0-flash-preview-image-generation">Gemini 2.0 Flash Image</option>
      <option value="gemini-2.5-flash-image">Nano Banana (2.5)</option>
      <option value="gemini-3.1-flash-image">Nano Banana 2</option>
      <option value="imagen-3.0-generate-002">Imagen 3</option>
    </select>
    <p style="color:var(--muted);font-size:13px">OpenAI n'est plus utilisé pour les images.</p>
    <label>Ton nom / persona</label>
    <input id="pname" />
    <label>Bio persona</label>
    <textarea class="field" id="pbio" rows="3"></textarea>
    <p style="margin-top:12px"><button class="cta" id="save">Enregistrer</button>
    <button class="cta" id="testimg" type="button" style="margin-left:8px;background:#3a2048">Tester clés images</button></p>
    <p id="st" class="err"></p>`;
  api("/api/status").then((s) => {
    if ($("gemtextmodel")) $("gemtextmodel").value = s.settings.geminiTextModel || "gemini-3.5-flash-lite";
    if ($("gemimgmodel")) $("gemimgmodel").value = s.settings.geminiImageModel || "auto";
    $("pname").value = s.settings.personaName || "";
    $("pbio").value = s.settings.personaBio || "";
    $("gemini").value = s.settings.geminiKeys || "";
    if ($("grok")) $("grok").value = s.settings.grokKeys || "";
    if ($("imgengine")) $("imgengine").value = s.settings.imageEngine || "horde";
    $("st").textContent = `Clés Gemini : ${s.keys.gemini}`;
    $("st").style.color = "#9dffc2";
    try {
      if (window.LeaAndroid && window.LeaAndroid.deviceInfo) {
        const d = JSON.parse(window.LeaAndroid.deviceInfo());
        $("st").textContent += " · RAM " + d.ramMb + " Mo · local " + (d.modelReady ? "pack OK" : "pack absent");
      }
    } catch (_) {}
  });
  $("save").onclick = async () => {
    const data = await api("/api/settings", {
      method: "POST",
      body: JSON.stringify({
        provider: "gemini",
        personaName: $("pname").value,
        personaBio: $("pbio").value,
        geminiKeys: $("gemini").value,
        grokKeys: $("grok") ? $("grok").value : "",
        imageProvider: "gemini",
        imageEngine: $("imgengine") ? $("imgengine").value : "horde",
        geminiImageModel: $("gemimgmodel") ? $("gemimgmodel").value : "auto",
        geminiTextModel: $("gemtextmodel") ? $("gemtextmodel").value : "gemini-3.5-flash-lite",
      }),
    });
    $("st").textContent = `OK — ${data.keys.gemini} clé(s) Gemini`;
    $("st").style.color = "#9dffc2";
  };
  $("testimg").onclick = async () => {
    $("st").textContent = "Test de chaque clé × modèles images…";
    try {
      const t = await api("/api/image-test", { method: "POST", body: "{}" });
      $("st").textContent = (t.rows || []).join("\n") || "Aucune clé";
      $("st").style.color = "#ffd3e4";
    } catch (e) {
      $("st").textContent = e.message;
    }
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

document.querySelectorAll(".nav").forEach((b) => {
  b.onclick = () => {
    show(b.dataset.view);
    if (b.dataset.view === "discover") renderDiscover();
    if (b.dataset.view === "chats") renderChats();
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
    const chat = await api("/api/chat/" + (state.current || "lea"));
    if (chat) state.chat = chat;
  } catch { /* chat vide local */ }
  if (!state.mode) state.mode = "auto";
  if (window.CAST && window.CAST.length) state.characters = window.CAST;
  renderDiscover();
})();
