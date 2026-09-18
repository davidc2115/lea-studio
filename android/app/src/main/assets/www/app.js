const state = { characters: [], chat: null, current: "lea", mode: "sfw", view: "discover" };

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

function renderDiscover() {
  const c = state.characters[0];
  $("view-discover").innerHTML = `
    <h1>Découvrir</h1>
    <div class="grid">
      <article class="card">
        <div class="cover">Léa</div>
        <div class="body">
          <strong>${c.name}</strong>
          <div style="color:var(--muted);font-size:13px">${c.title}</div>
          <div class="tags">${c.tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>
          <p style="color:#d7c8dc;font-size:14px">${c.scenario}</p>
          <button class="cta" id="start-lea">Discuter</button>
        </div>
      </article>
    </div>`;
  $("start-lea").onclick = () => {
    show("chat");
    renderChat();
  };
}

function renderChat() {
  const c = state.characters[0];
  const msgs = state.chat?.messages || [];
  $("view-chat").innerHTML = `
    <div class="chat-wrap">
      <div class="thread">
        <div style="padding:12px 16px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center">
          <div><strong>${c.name}</strong><div style="font-size:12px;color:var(--muted)">${c.title}</div></div>
          <button class="cta" id="reset">Nouvelle scène</button>
        </div>
        <div class="msgs" id="msgs"></div>
        <div class="composer">
          <textarea id="input" placeholder="Écris à Léa…"></textarea>
          <button class="cta" id="send">Envoyer</button>
        </div>
      </div>
      <aside class="side">
        <label>Mode</label>
        <select id="mode">
          <option value="sfw" ${state.mode === "sfw" ? "selected" : ""}>SFW</option>
          <option value="nsfw" ${state.mode === "nsfw" ? "selected" : ""}>NSFW 18+</option>
        </select>
        <p style="font-size:13px;color:var(--muted);white-space:pre-wrap">${c.greeting}</p>
        <div id="rel"></div>
        <p class="err" id="err"></p>
      </aside>
    </div>`;
  const box = $("msgs");
  if (!msgs.length) {
    box.innerHTML = `<div class="bubble assistant">${c.greeting}</div>`;
  } else {
    box.innerHTML = msgs.map((m) => `<div class="bubble ${m.role}">${escapeHtml(m.content)}</div>`).join("");
  }
  box.scrollTop = box.scrollHeight;
  const rel = state.chat?.relationship || {};
  $("rel").innerHTML = `<p style="font-size:13px;color:var(--rose)">Proximité ${rel.closeness || 1}/10 · Confiance ${rel.trust || 1}/10 · Tension ${rel.heat || 0}/10</p>`;
  $("mode").onchange = (e) => (state.mode = e.target.value);
  $("send").onclick = send;
  $("input").onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };
  $("reset").onclick = async () => {
    state.chat = await api("/api/chat/lea/reset", { method: "POST" });
    renderChat();
  };
}

async function send() {
  const input = $("input");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  $("err").textContent = "";
  try {
    const data = await api("/api/chat/lea/message", {
      method: "POST",
      body: JSON.stringify({ text, mode: state.mode }),
    });
    state.chat = data.chat;
    renderChat();
  } catch (e) {
    $("err").textContent = e.message;
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
    <label>Clés Gemini (plusieurs, séparées par virgule)</label>
    <textarea class="field" id="gemini" rows="3" placeholder="AIza...,AIza..."></textarea>
    <label>Clés OpenAI (plusieurs, séparées par virgule)</label>
    <textarea class="field" id="openai" rows="3" placeholder="sk-...,sk-..."></textarea>
    <label>Ton nom / persona</label>
    <input id="pname" />
    <label>Bio persona</label>
    <textarea class="field" id="pbio" rows="3"></textarea>
    <p style="margin-top:12px"><button class="cta" id="save">Enregistrer</button></p>
    <p id="st" class="err"></p>`;
  api("/api/status").then((s) => {
    $("provider").value = s.settings.provider || "gemini";
    $("pname").value = s.settings.personaName || "";
    $("pbio").value = s.settings.personaBio || "";
    $("st").textContent = `Clés actives — Gemini: ${s.keys.gemini} | OpenAI: ${s.keys.openai}`;
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
      }),
    });
    $("st").textContent = `OK — Gemini ${data.keys.gemini} / OpenAI ${data.keys.openai}`;
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
    if (b.dataset.view === "chat") renderChat();
    if (b.dataset.view === "memory") renderMemory();
    if (b.dataset.view === "settings") renderSettings();
  };
});

(async function init() {
  state.characters = await api("/api/characters");
  state.chat = await api("/api/chat/lea");
  renderDiscover();
})();
