import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { generate, keyStatus, reloadPools } from "./providers.js";
import { loadCharacters, loadSettings, saveSettings, getChat, saveChat } from "./store.js";
import { buildMemoryBlock, maybeExtractMemory, modeInstructions, recentWindow } from "./memory.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/status", (_req, res) => {
  res.json({ ok: true, keys: keyStatus(), settings: loadSettings() });
});

app.post("/api/settings", (req, res) => {
  const { provider, personaName, personaBio, openaiKeys, geminiKeys } = req.body || {};
  if (typeof openaiKeys === "string") process.env.OPENAI_API_KEYS = openaiKeys;
  if (typeof geminiKeys === "string") process.env.GEMINI_API_KEYS = geminiKeys;
  if (openaiKeys || geminiKeys) reloadPools();
  const settings = saveSettings({
    ...(provider ? { provider } : {}),
    ...(personaName != null ? { personaName } : {}),
    ...(personaBio != null ? { personaBio } : {}),
  });
  res.json({ settings, keys: keyStatus() });
});


app.post("/api/image", async (req, res) => {
  const prompt = "Photorealistic 18-year-old French woman Léa, long straight dark brown hair, " + String(req.body?.prompt || "portrait");
  const keys = String(process.env.GEMINI_API_KEYS || "").split(/[,;\n]+/).map((k) => k.trim()).filter(Boolean);
  for (const key of keys) {
    try {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=" + encodeURIComponent(key), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] }
        })
      });
      const data = await r.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const img = parts.find((x) => x.inlineData && String(x.inlineData.mimeType || "").startsWith("image/"));
      if (img) return res.json({ url: "data:" + img.inlineData.mimeType + ";base64," + img.inlineData.data });
    } catch {}
  }
  const url = "https://image.pollinations.ai/prompt/" + encodeURIComponent(prompt) + "?width=768&height=1152&nologo=true&seed=" + Date.now();
  res.json({ url });
});

app.get("/api/characters", (_req, res) => {
  res.json(loadCharacters());
});

app.get("/api/chat/:id", (req, res) => {
  res.json(getChat(req.params.id));
});

app.post("/api/chat/:id/reset", (req, res) => {
  const empty = {
    messages: [],
    memories: [],
    summaries: [],
    relationship: { closeness: 1, trust: 1, heat: 0 },
    updatedAt: Date.now(),
  };
  res.json(saveChat(req.params.id, empty));
});

app.post("/api/chat/:id/memory", (req, res) => {
  const chat = getChat(req.params.id);
  const { text, pinned } = req.body || {};
  if (!text) return res.status(400).json({ error: "texte requis" });
  chat.memories.push({
    id: Date.now(),
    text: String(text).slice(0, 250),
    pinned: Boolean(pinned),
    createdAt: Date.now(),
  });
  res.json(saveChat(req.params.id, chat));
});

app.patch("/api/chat/:id/memory/:mid", (req, res) => {
  const chat = getChat(req.params.id);
  const mem = chat.memories.find((m) => String(m.id) === String(req.params.mid));
  if (!mem) return res.status(404).json({ error: "souvenir introuvable" });
  if (req.body.text != null) mem.text = String(req.body.text).slice(0, 250);
  if (req.body.pinned != null) mem.pinned = Boolean(req.body.pinned);
  res.json(saveChat(req.params.id, chat));
});

app.delete("/api/chat/:id/memory/:mid", (req, res) => {
  const chat = getChat(req.params.id);
  chat.memories = chat.memories.filter((m) => String(m.id) !== String(req.params.mid));
  res.json(saveChat(req.params.id, chat));
});

app.post("/api/chat/:id/message", async (req, res) => {
  const character = loadCharacters().find((c) => c.id === req.params.id);
  if (!character) return res.status(404).json({ error: "personnage inconnu" });

  const { text, mode = "sfw", provider } = req.body || {};
  if (!text) return res.status(400).json({ error: "message vide" });

  const settings = loadSettings();
  const chat = getChat(character.id);
  chat.messages.push({ role: "user", content: String(text), ts: Date.now() });

  const system = [
    `Tu incarnes ${character.name}, ${character.age} ans.`,
    character.personality,
    "Apparence: " + character.appearance,
    "Scénario: " + character.scenario,
    character.system_extra,
    modeInstructions(mode),
    `Utilisateur: ${settings.personaName}. ${settings.personaBio}`,
    "Exemples:\n" + character.example_dialogue,
    buildMemoryBlock(chat),
    "Réponds uniquement in-character. 1 à 3 courts paragraphes max sauf si la scène l'exige.",
  ].join("\n\n");

  const history = recentWindow(chat.messages, 18).map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
  }));

  try {
    const reply = await generate([{ role: "system", content: system }, ...history], provider || settings.provider);
    chat.messages.push({ role: "assistant", content: reply, ts: Date.now() });
    await maybeExtractMemory(chat, provider || settings.provider);
    saveChat(character.id, chat);
    res.json({ reply, chat });
  } catch (e) {
    chat.messages.pop();
    saveChat(character.id, chat);
    res.status(502).json({ error: e.message });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Léa Studio → http://localhost:${port}`);
});
