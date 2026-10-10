import { generate } from "./providers.js";

const EXTRACT_PROMPT = `Tu extraies et mets à jour la mémoire long terme d'un roleplay.
Réponds UNIQUEMENT en JSON valide:
{"facts":["fait court 1","fait 2"],"relationship":"une phrase sur la relation","wardrobe":"état actuel complet des tenues et vêtements","mood":"humeur actuelle du perso"}
Règles: faits concrets (préférences, événements, promesses, corps, lieux, limites). Pour wardrobe, ne retourne une valeur que si le transcript change réellement une tenue ou l'état/l'emplacement d'un vêtement. Cette valeur remplace l'ancien état: indique ce que le personnage porte, et où se trouvent les vêtements retirés, leur état humide/sec/en train de sécher. Un vêtement déplacé vers la salle de bain n'est plus au sol; ne le remets pas à son ancien emplacement sans action explicite. Si wardrobe ne change pas, omets la clé. Max 6 faits. Pas de prose hors JSON.`;

export function recentWindow(messages, n = 16) {
  return messages.slice(-n);
}

export function buildMemoryBlock(chat) {
  const pinned = chat.memories.filter((m) => m.pinned).map((m) => `- [PIN] ${m.text}`);
  const facts = chat.memories.filter((m) => !m.pinned).slice(-18).map((m) => `- ${m.text}`);
  const summaries = chat.summaries.slice(-4).map((s) => s.text);
  const rel = chat.relationship || {};
  return [
    "=== MÉMOIRE LONG TERME ===",
    `Relation: proximité ${rel.closeness ?? 1}/10, confiance ${rel.trust ?? 1}/10, tension ${rel.heat ?? 0}/10`,
    "Continuité des vêtements: l'état mémorisé le plus récent est la référence actuelle. Ne réutilise jamais un ancien emplacement après un déplacement explicite; un vêtement mis à sécher y reste jusqu'à une nouvelle action établie.",
    pinned.length ? "Souvenirs épinglés:\n" + pinned.join("\n") : "",
    facts.length ? "Faits:\n" + facts.join("\n") : "",
    chat.wardrobe ? "Tenue actuelle et état des vêtements (état le plus récent, remplace tout ancien emplacement) :\n" + chat.wardrobe : "",
    summaries.length ? "Résumés de scènes:\n" + summaries.join("\n") : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function maybeExtractMemory(chat, provider) {
  if (chat.messages.length < 4) return chat;
  if (chat.messages.length % 6 !== 0) return chat;

  const slice = chat.messages.slice(-10);
  const transcript = slice
    .map((m) => `${m.role === "user" ? "USER" : "CHAR"}: ${m.content}`)
    .join("\n");
    const extractionContext = [
      chat.wardrobe ? "ÉTAT DES VÊTEMENTS DÉJÀ MÉMORISÉ (à remplacer si le transcript contient un changement explicite): " + chat.wardrobe : "",
      "TRANSCRIPT RÉCENT :\n" + transcript,
    ].filter(Boolean).join("\n\n");

  try {
    const raw = await generate(
      [
        { role: "system", content: EXTRACT_PROMPT },
        { role: "user", content: extractionContext },
      ],
      provider
    );
    const json = JSON.parse(raw.replace(/```json|```/g, "").trim());
    const facts = Array.isArray(json.facts) ? json.facts : [];
    for (const text of facts) {
      const clean = String(text).slice(0, 220).trim();
      if (!clean) continue;
      const exists = chat.memories.some((m) => m.text.toLowerCase() === clean.toLowerCase());
      if (!exists) {
        chat.memories.push({
          id: Date.now() + Math.random(),
          text: clean,
          pinned: false,
          createdAt: Date.now(),
        });
      }
    }
    if (json.relationship) {
      chat.summaries.push({
        text: String(json.relationship).slice(0, 300),
        createdAt: Date.now(),
      });
    }
    if (typeof json.wardrobe === "string" && json.wardrobe.trim()) {
      chat.wardrobe = json.wardrobe.trim().slice(0, 800);
    }
    if (json.mood && /complic|proche|confian|intim|désir|hot|nsfw/i.test(json.mood + json.relationship)) {
      chat.relationship.heat = Math.min(10, (chat.relationship.heat || 0) + 1);
      chat.relationship.closeness = Math.min(10, (chat.relationship.closeness || 1) + 1);
    } else {
      chat.relationship.trust = Math.min(10, (chat.relationship.trust || 1) + 1);
    }
    if (chat.memories.length > 40) chat.memories = chat.memories.filter((m) => m.pinned).concat(chat.memories.filter((m) => !m.pinned).slice(-30));
    if (chat.summaries.length > 12) chat.summaries = chat.summaries.slice(-12);
  } catch {
    // extraction best-effort
  }
  return chat;
}

export function modeInstructions(mode) {
  if (mode === "nsfw") {
    return `MODE NSFW autorisé (adultes 18+ consentants).
Tu peux être sensuelle, explicite si l'utilisateur oriente ainsi.
Léa reste d'abord timide : elle n'enchaîne pas immédiatement sur du hardcore.
Elle rougit, hésite, puis peut céder progressivement.
Respecte un non, un stop, un recul.`;
  }
  return `MODE SFW.
Reste tendre, gênée, romantique ou amicale.
Pas de descriptions sexuelles explicites.
Une tension légère / sous-entendus discrets sont OK si l'utilisateur flirt.`;
}
