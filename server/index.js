import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { generate, keyStatus, reloadPools } from "./providers.js";
import { loadCharacters, loadSettings, saveSettings, getChat, saveChat } from "./store.js";
import { buildMemoryBlock, maybeExtractMemory, modeInstructions, resolveMode, recentWindow } from "./memory.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

function splitKeys(raw) {
  return String(raw || "").split(/[,;\n]+/).map((k) => k.trim()).filter(Boolean);
}


app.get("/api/status", (_req, res) => {
  const settings = loadSettings();
  const keys = keyStatus();
  keys.image = splitKeys(settings.imageKeys || process.env.IMAGE_API_KEYS).length;
  keys.grok = splitKeys(settings.grokKeys || process.env.XAI_API_KEYS).length;
  res.json({ ok: true, keys, settings });
});

app.post("/api/settings", (req, res) => {
  const { provider, personaName, personaBio, openaiKeys, geminiKeys, grokKeys, imageKeys, imageProvider, geminiImageModel, geminiTextModel } = req.body || {};
  if (typeof openaiKeys === "string") process.env.OPENAI_API_KEYS = openaiKeys;
  if (typeof geminiKeys === "string") process.env.GEMINI_API_KEYS = geminiKeys;
  if (typeof imageKeys === "string") process.env.IMAGE_API_KEYS = imageKeys;
  if (typeof grokKeys === "string") process.env.XAI_API_KEYS = grokKeys;
  if (typeof geminiTextModel === "string" && geminiTextModel) process.env.GEMINI_MODEL = geminiTextModel;
  if (openaiKeys || geminiKeys) reloadPools();
  const settings = saveSettings({
    ...(provider ? { provider } : {}),
    ...(personaName != null ? { personaName } : {}),
    ...(personaBio != null ? { personaBio } : {}),
    ...(imageProvider ? { imageProvider } : {}),
    ...(imageKeys != null ? { imageKeys } : {}),
    ...(grokKeys != null ? { grokKeys } : {}),
    ...(geminiImageModel ? { geminiImageModel } : {}),
    ...(geminiTextModel ? { geminiTextModel } : {}),
    ...(geminiKeys != null ? { geminiKeys } : {}),
  });
  const keys = keyStatus();
  keys.image = splitKeys((loadSettings().imageKeys) || process.env.IMAGE_API_KEYS).length;
  keys.grok = splitKeys((loadSettings().grokKeys) || process.env.XAI_API_KEYS).length;
  res.json({ settings, keys });
});


app.post("/api/image", async (req, res) => {
  const prompt = String(req.body?.prompt || "Photorealistic Léa portrait");
  const s = loadSettings();
  const gemini = splitKeys(s.geminiKeys || process.env.GEMINI_API_KEYS);
  let last = "Aucune clé Gemini AI Studio";
  const prefModel = s.geminiImageModel || "auto";
  const models = prefModel === "gemini-2.5-flash-image"
    ? ["gemini-2.5-flash-image", "gemini-3.1-flash-image"]
    : prefModel === "gemini-3.1-flash-image"
      ? ["gemini-3.1-flash-image", "gemini-2.5-flash-image"]
      : ["gemini-3.1-flash-image", "gemini-2.5-flash-image"];
  for (const key of gemini) {
    for (const model of models) {
      try {
        const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(key), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              responseModalities: ["IMAGE", "TEXT"],
              imageConfig: { aspectRatio: "2:3" }
            }
          })
        });
        const data = await r.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const img = parts.find((x) => {
          const blob = x.inlineData || x.inline_data;
          return blob && String(blob.mimeType || blob.mime_type || "").startsWith("image/");
        });
        if (img) {
          const blob = img.inlineData || img.inline_data;
          return res.json({ url: "data:" + (blob.mimeType || blob.mime_type) + ";base64," + blob.data });
        }
        last = data.error?.message || (model + " vide");
      } catch (e) { last = e.message; }
    }
  }
  res.status(400).json({ error: last + " — ajoute ta clé Gemini dans Clés" });
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

  const { text, mode = "auto", provider } = req.body || {};
  if (!text) return res.status(400).json({ error: "message vide" });

  const settings = loadSettings();
  const chat = getChat(character.id);
  const resolvedMode = resolveMode(mode, text, chat);
  if (resolvedMode === "nsfw") {
    chat.relationship = chat.relationship || {};
    chat.relationship.heat = Math.min(10, Math.max(chat.relationship.heat || 0, 4));
  }
  chat.messages.push({ role: "user", content: String(text), ts: Date.now() });

  const system = [
    `Tu incarnes ${character.name}, ${character.age} ans.`,
    character.personality,
    "Apparence: " + character.appearance,
    "Scénario: " + character.scenario,
    character.system_extra,
    modeInstructions(resolvedMode, text),
    `Utilisateur: ${settings.personaName}. ${settings.personaBio}`,
    "Exemples:\n" + character.example_dialogue,
    buildMemoryBlock(chat),
    "Réponds uniquement in-character. 1 à 2 courts paragraphes, rapide.",
  ].join("\n\n");

  const history = recentWindow(chat.messages, 10).map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
  }));

  try {
    const reply = await generate([{ role: "system", content: system }, ...history], provider || settings.provider);
    chat.messages.push({ role: "assistant", content: reply, ts: Date.now() });
    saveChat(character.id, chat);
    res.json({ reply, chat });
    maybeExtractMemory(chat, provider || settings.provider).then((updated) => saveChat(character.id, updated)).catch(() => {});
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
