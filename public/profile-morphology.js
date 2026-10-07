(function (root) {
  "use strict";

  function explicitCup(card) {
    const appearance = String((card && card.appearance) || "");
    const line = (appearance.match(/(?:^|\n)\s*Poitrine\s*:\s*([^\n]+)/i) || [])[1] || "";
    const match =
      line.match(/\bbonnet\s*([A-J])\b/i) ||
      line.match(/\b\d{2,3}\s*([A-J])\b/i) ||
      line.match(/\b([A-J])\s*-?\s*cup\b/i);
    return match ? String(match[1] || match[2]).toUpperCase() : "";
  }

  function explicitShape(card) {
    const appearance = String((card && card.appearance) || "");
    const start = appearance.match(/(?:^|\n)\s*Corps et silhouette\s*:\s*/i);
    if (!start) return "";
    const from = start.index + start[0].length;
    const rest = appearance.slice(from);
    const next = rest.search(/\n\s*(?:Poitrine|Peau|Origine|Fiche\s+body)\s*:/i);
    return rest.slice(0, next < 0 ? undefined : next).replace(/\s+/g, " ").trim().replace(/[.;]+$/, "");
  }

  function roundnessKind(card, shape) {
    const tags = Array.isArray(card && card.tags)
      ? card.tags.map((tag) => String(tag || "").toLowerCase())
      : [];
    const shapeText = String(shape || "").toLowerCase();
    const bodyText = [card && card.body, card && card.morphology_en]
      .filter(Boolean).join(" ").toLowerCase();
    const looksText = String((card && card.looks_en) || "").toLowerCase();
    const taggedVery = tags.some((tag) => /\btr[eè]s\s+ronde?\b/.test(tag));
    const taggedRound = tags.some((tag) => /\bron(de|d)\b/.test(tag));
    const shapeVery = /\btr[eè]s\s+ronde?\b/.test(shapeText);
    const shapeRound = /\b(?:ronde?|plus[\s-]?size|chubby|plump|corpulent)\b/.test(shapeText);
    const veryBody = /\b(?:very|extremely)\s+(?:plus[\s-]?size|chubby|plump|full[- ]figured|full[- ]bodied)\b/.test(bodyText);
    const roundBody = /\b(?:plus[\s-]?size|chubby|plump|corpulent|full[- ]figured|full[- ]bodied)\s+(?:soft\s+|rounded\s+)?(?:body|figure|physique|frame|woman|silhouette)\b|\bsoft belly\b/.test(bodyText);
    const veryLooks = /\b(?:very|extremely)\s+(?:plus[\s-]?size|chubby|plump|full[- ]figured|full[- ]bodied)\b[^,;]{0,30}\b(?:body|figure|physique|frame|woman|silhouette)\b/.test(looksText);
    const roundLooks = /\b(?:plus[\s-]?size|chubby|plump|corpulent|full[- ]figured|full[- ]bodied)\b[^,;]{0,30}\b(?:body|figure|physique|frame|woman|silhouette)\b|\bsoft belly\b/.test(looksText);

    if (taggedVery || shapeVery || veryBody || veryLooks) {
      return "very";
    }
    if (taggedRound || shapeRound || roundBody || roundLooks) {
      return "round";
    }
    return "";
  }

  function roundnessShapeText(kind) {
    return kind === "very"
      ? "silhouette très ronde, corps très généreux, ventre souple et arrondi, bras, hanches et cuisses très pleins"
      : "silhouette ronde, formes pleines et douces, ventre arrondi, hanches et cuisses généreuses";
  }

  function translateShape(value) {
    const text = String(value || "").toLowerCase();
    if (
      /\btr[eè]s\s+ronde?\b/.test(text) ||
      /\b(?:very|extremely)\s+(?:plus[\s-]?size|chubby|plump|full[- ]figured)\b/.test(text)
    ) {
      return "very full-bodied plus-size figure with a prominent soft rounded abdomen, full upper arms, broad hips and thick thighs";
    }
    if (/\b(?:ronde?|plus[\s-]?size|chubby|plump|corpulent)\b/.test(text) || /\bsoft belly\b/.test(text)) {
      return "full-figured softly rounded body with a rounded abdomen, full hips and thick thighs";
    }
    if (/sablier|hourglass/.test(text)) {
      return "curvy hourglass figure with a defined waist, full hips and rounded curves";
    }
    if (/athl[eé]t|athletic|tonique|toned/.test(text)) {
      return "athletic, toned figure with defined muscles and fit legs";
    }
    if (/mince|slim|longiligne|élanc[eé]e|lean/.test(text)) {
      return "slim, slender figure with a narrow waist and long lines";
    }
    if (/pulpeuse|voluptuous|voluptueuse/.test(text)) {
      return "curvy, full-figured body with naturally rounded hips";
    }
    if (/harmonieuse|harmonieux|proportions naturelles|balanced|natural proportions/.test(text)) {
      return "balanced feminine figure with natural proportions";
    }
    if (/fine|finement|d[eé]licate|petite/.test(text)) {
      return "delicate, petite figure with natural proportions";
    }
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function legacyShape(value) {
    return String(value || "")
      .split(/[.;,\n]+/)
      .map((part) => part.replace(/\s+/g, " ").trim())
      .filter((part) => part && !/(?:bonnet\s*[A-J]|\b[A-J]\s*-?\s*cup|\b\d{2,3}\s*[A-J]\b|breasts?|boobs?|chest|bust|cleavage|poitrine|seins?)/i.test(part))
      .join(", ");
  }

  function cupDescription(cup) {
    if (!cup) return "";
    return cup + "-cup breasts, matching the explicit character description";
  }

  function shapeTag(shape) {
    const text = String(shape || "").toLowerCase();
    if (/tr[eè]s\s+ronde?/.test(text) || /\bvery\s+plus[\s-]?size\b/.test(text)) return "très ronde";
    if (/sablier|hourglass/.test(text)) return "silhouette sablier";
    if (/athl[eé]t|athletic|tonique|toned/.test(text)) return "athlétique";
    if (/mince|slim|longiligne|élanc[eé]e|lean/.test(text)) return "mince";
    if (/\b(?:ronde?|plus[\s-]?size|chubby|plump|corpulent)\b/.test(text) || /\bsoft belly\b/.test(text)) return "ronde";
    if (/pulpeuse|voluptuous|voluptueuse/.test(text)) return "pulpeuse";
    if (/harmonieuse|harmonieux|balanced|proportions naturelles/.test(text)) return "proportions naturelles";
    if (/fine|finement|d[eé]licate|petite/.test(text)) return "petite";
    return "";
  }

  function isDuo(card) {
    return Boolean(
      card &&
      (card.is_duo === true ||
        Array.isArray(card.people) ||
        /^duo[_-]/i.test(String(card.id || "")))
    );
  }

  function normalizeCard(card) {
    if (!card || typeof card !== "object" || isDuo(card)) return card;

    const cup = explicitCup(card);
    const shapeFr = explicitShape(card);
    const roundness = roundnessKind(card, shapeFr);
    if (!cup && !shapeFr && !roundness) return card;

    const shapeText = roundness
      ? roundnessShapeText(roundness)
      : (shapeFr || card.morphology_fr || legacyShape(card.body));
    const shapeEn = translateShape(shapeText);
    const cupEn = cupDescription(cup);
    const morphology = [shapeEn, cupEn].filter(Boolean).join(", ");
    card.morphology_fr = shapeText || "";
    card.morphology_en = morphology || card.morphology_en || "";

    if (roundness) {
      const appearance = String(card.appearance || "");
      const shapeLine = /((?:^|\n)\s*(?:Corps et silhouette|Silhouette)\s*:\s*)[^\n]*/i;
      if (shapeLine.test(appearance)) {
        card.appearance = appearance.replace(shapeLine, "$1" + shapeText + ".");
      } else {
        const nextField = /(^|\n)(\s*(?:Poitrine|Peau|Origine|Fiche\s+body)\s*:)/i;
        card.appearance = nextField.test(appearance)
          ? appearance.replace(nextField, "$1Corps et silhouette : " + shapeText + ".\n$2")
          : [appearance.trim(), "Corps et silhouette : " + shapeText + "."].filter(Boolean).join("\n");
      }
    }

    if (cup) {
      card.appearance = String(card.appearance || "")
        .replace(/((?:^|\n)\s*Poitrine\s*:\s*)[^\n]*/i, "$1bonnet " + cup + ".");
      card.title = String(card.title || "").replace(/bonnet\s*[A-J]\b/gi, "bonnet " + cup);
      card.title = card.title.replace(/\b\d{2,3}\s*[A-J]\b/gi, cup + "-cup");
    }

    card.appearance = String(card.appearance || "").replace(
      /(\bFiche\s+body\s*:\s*)[^\n]*/i,
      "$1" + morphology
    );
    card.body = morphology || String(card.body || "").trim();

    if (Array.isArray(card.tags)) {
      const bodyTag = /bonnet\s*[A-J]|\b[A-J]\s*-?\s*cup\b|seins?|poitrine|breast|chest|bust|ronde|pulpeuse|mince|slim|\bthin\b|slender|lean|athl[eé]t|athletic|sablier|hourglass|curvy|chubby|plus[\s-]?size|plump|corpulent|toned|skinny|voluptuous|thick/i;
      const kept = card.tags.filter((tag) => !bodyTag.test(String(tag)));
      if (cup) kept.push("bonnet " + cup);
      const translatedTag = shapeTag(shapeText);
      if (translatedTag) kept.push(translatedTag);
      card.tags = [...new Set(kept)];
    }

    if (card.looks_en) {
      const bodyPhrase = /\b(?:[A-J]\s*-?\s*cup|(?:\d{2,3}\s*)[A-J])\b|breasts?|boobs?|chest|bust|cleavage|slim|slender|lean|\bthin\b|athletic|toned|hourglass|curvy|chubby|plus[\s-]?size|plump|voluptuous|skinny|thick|wide hips|full hips|narrow frame|soft belly|round butt|petite frame|body type|figure|physique|long legs/i;
      const identityTraits = String(card.looks_en)
        .split(/[,;]+/)
        .map((part) => part.replace(/[()]/g, "").replace(/:\d+(?:\.\d+)?/g, "").trim())
        .filter((part) => part && !bodyPhrase.test(part));
      card.looks_en = [...identityTraits, shapeEn, cupEn].filter(Boolean).join(", ");
    }

    return card;
  }

  function normalizeAll() {
    for (const key of Object.keys(root)) {
      if (!/^LEA_CAST_/.test(key) || !Array.isArray(root[key])) continue;
      root[key].forEach(normalizeCard);
    }
  }

  normalizeAll();
  root.LeaProfileMorphology = {
    explicitCup,
    explicitShape,
    normalizeCard,
    normalizeAll,
    translateShape,
  };
})(window);
