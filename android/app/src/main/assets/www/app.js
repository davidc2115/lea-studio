const FALLBACK_LEA = (window.CAST && window.CAST[0]) || { id: "lea", name: "Léa Moreau", age: 18, title: "", tags: [], greeting: "", scenario: "", personality: "", appearance: "", cover: "images/lea-portrait.jpg", gallery: [] };

const state = {
  characters: window.CAST || [FALLBACK_LEA],
  chat: { messages: [], memories: [], summaries: [], relationship: { closeness: 1, trust: 1, heat: 0 } },
  current: "lea",
  mode: localStorage.getItem("lea.mode") || "auto",
  view: "discover",
};

function customCover(id) {
  try { return localStorage.getItem("lea.cover." + (id || state.current || "lea")) || ""; } catch { return ""; }
}
function setCustomCover(id, src) {
  if (!src) localStorage.removeItem("lea.cover." + id);
  else localStorage.setItem("lea.cover." + id, src);
}

/** Cover prioritaire : 1) choisie par l'utilisateur 2) 1ère photo générée 3) cast 4) neutre (jamais le portrait Léa pour un autre perso). */
function resolvedCover(cOrId) {
  const c = typeof cOrId === "string"
    ? ((state.characters || []).find((x) => x.id === cOrId) || { id: cOrId, cover: "" })
    : (cOrId || {});
  const id = c.id || state.current || "lea";
  const custom = customCover(id);
  if (custom) {
    if (String(custom).startsWith("gallery:")) {
      const data = resolvePhotoSrc(custom);
      if (data) return data;
    } else if (custom) return custom;
  }
  // Première image générée pour CE personnage
  try {
    const extras = extraPhotos(id);
    if (extras && extras.length) {
      const src = resolvePhotoSrc(extras[0]) || extras[0];
      if (src && String(src).length > 20) return src;
    }
  } catch (_) {}
  // Cover déclarée dans characters.js (cast/…)
  if (c.cover) return c.cover;
  if (id && id !== "lea") return "images/cast/" + id + ".jpg";
  return "images/lea-portrait.jpg";
}

/** Après une génération profil réussie : définir comme cover si aucune cover custom. */
function maybeAutoCover(charId, storedSrc) {
  try {
    if (!charId || !storedSrc) return;
    if (customCover(charId)) return; // déjà choisi
    setCustomCover(charId, storedSrc);
  } catch (_) {}
}

function character() {
  const list = state.characters.length ? state.characters : window.CAST || [FALLBACK_LEA];
  const base = list.find((c) => c.id === state.current) || list[0] || FALLBACK_LEA;
  const key = customCover(base.id) || base.cover;
  const resolved = resolvedCover(base);
  return Object.assign({}, base, { cover: resolved || base.cover, coverKey: key });
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


/** Détails physiques EN forçant cheveux, yeux, freckles, peau (FR → EN prompt). */
/** Physique complet : looks_en (CAST) prioritaire, sinon appearance. */
function describeLooks(c) {
  if (!c) return "";
  if (c.looks_en && String(c.looks_en).length > 20) {
    return String(c.looks_en).replace(/\s+/g, " ").trim();
  }
  const a = String(c.appearance || "").replace(/\s+/g, " ").trim();
  const body = String(c.body || "").trim();
  return [a, body].filter(Boolean).join(", ");
}

/** Place détaillée pour arrière-plan Horde (évite fond générique). */
function describePlaceDetail(placeStr) {
  const p = String(placeStr || "").toLowerCase();
  if (/doorway|entrée|porte|hallway|seuil/.test(p))
    return "apartment interior hallway doorway at night, wooden door frame, wall, indoor ceiling light, NOT outdoor, NOT beach, NOT city skyline only";
  if (/fireplace|cheminée|feu|living room|salon|sofa|canapé/.test(p))
    return "wide living room interior, full sofa visible, coffee table, carpet, warm lamp, walls and floor in frame, indoor night";
  if (/bedroom|chambre|bed/.test(p))
    return "bedroom interior, bed with sheets, nightstand lamp, soft indoor light";
  if (/sofa|canapé|couch/.test(p))
    return "living room sofa indoor, cushions, warm lamp light at night";
  if (/kitchen|cuisine|fridge/.test(p))
    return "kitchen interior, counters, indoor lighting";
  if (/bathroom|douche|salle de bain/.test(p))
    return "bathroom interior tiles mirror steam";
  if (/rain|orage|storm|wet door/.test(p))
    return "apartment doorway during thunderstorm night, rain visible outside through door, wet floor, indoor hallway";
  if (/balcony|balcon/.test(p))
    return "apartment balcony at night, railing, city soft bokeh lights";
  if (/office|bureau|desk|textbooks/.test(p))
    return "home office or desk with books, indoor lamp, night";
  if (/window|fenêtre/.test(p))
    return "indoors by a window at night, room interior visible";
  if (p) return p + ", detailed indoor environment, coherent background";
  return "detailed apartment interior at night, coherent background";
}

/** Détails tenue scénario (couleur, troué, etc.) depuis outfits[]. */
/** Détaille la tenue du scénario pour Horde (mouillé, troué, oversized, etc.). */
function describeOutfitDetail(outfitStr, scenarioStr) {
  const raw = String(outfitStr || "").trim();
  const o = (raw + " " + String(scenarioStr || "")).toLowerCase();
  const bits = [];
  if (raw) bits.push("exactly wearing: " + raw);

  // État humidité / pluie
  if (/wet|tremp|soaked|mouill|pluie|orage|rain|dripping|moites?|sweaty|sueur/.test(o)) {
    bits.push("SOAKING WET clothes, fabric clinging to skin, visible water droplets on fabric and skin, wet hair strands");
    bits.push("NOT dry clothes, NOT dry fabric");
  }
  // Jean / bas
  if (/ripped|troué|distressed|destroyed|déchir/.test(o)) {
    bits.push("ripped jeans with large visible holes at the knees and thighs, distressed denim");
  }
  if (/skinny|moulant|tight jeans|jean moulant/.test(o)) bits.push("very tight skinny jeans hugging the legs and hips");
  if (/jean|jeans|denim/.test(o) && !/skirt|jupe/.test(o)) bits.push("blue denim jeans");
  if (/short skirt|jupe courte|mini/.test(o)) bits.push("very short mini skirt");
  if (/skirt|jupe/.test(o)) bits.push("skirt");
  if (/shorts|running shorts/.test(o)) bits.push("short shorts");
  if (/tights|collants/.test(o)) bits.push("tights on legs");
  if (/stockings|bas|sheer tights/.test(o)) bits.push("sheer stockings");
  if (/socks|chaussettes/.test(o)) bits.push("visible socks");

  // Hauts
  if (/crop|top court|tiny crop/.test(o)) bits.push("short crop top exposing the full midriff and navel");
  if (/oversized|too big|trop grand|boyfriend shirt|chemise trop|hoodie too big/.test(o)) {
    bits.push("OVERSIZED baggy top or shirt much too large for her, hanging loose, covering thighs if a shirt");
  }
  if (/boyfriend shirt|chemise|button/.test(o)) bits.push("oversized button-up shirt worn as a dress, sleeves rolled");
  if (/hoodie/.test(o)) bits.push("hoodie sweatshirt");
  if (/cardigan/.test(o)) bits.push("cardigan sweater");
  if (/tank|débardeur/.test(o)) bits.push("thin tank top");
  if (/sports bra|brassière|sport bra/.test(o)) bits.push("sports bra");
  if (/swimsuit|maillot|bikini/.test(o)) bits.push("swimsuit or bikini");
  if (/towel|serviette/.test(o)) bits.push("towel wrapped around the body");
  if (/dress|robe/.test(o)) bits.push("dress");
  if (/cocktail|moulante|tight dress|body/.test(o)) bits.push("tight form-fitting dress clinging to the body");
  if (/slipping|qui glisse|half open|ouvert/.test(o)) bits.push("garment slightly slipping or half-open");
  if (/pajama|pyjama/.test(o)) bits.push("soft pajama top");
  if (/lingerie|soutien|bra and|lace set/.test(o)) bits.push("lingerie set");
  if (/lace|dentelle/.test(o)) bits.push("delicate lace fabric");
  if (/satin/.test(o)) bits.push("shiny satin fabric");
  if (/leather|cuir/.test(o)) bits.push("leather material");
  if (/string|thong/.test(o)) bits.push("thong panties");
  if (/choker/.test(o)) bits.push("choker necklace");

  // Couleurs
  if (/white|blanc|ivoire|ivory|cream/.test(o)) bits.push("white or ivory colored fabric");
  if (/black|noir/.test(o)) bits.push("black colored garment");
  if (/red|rouge/.test(o)) bits.push("red colored garment");
  if (/pink|rose/.test(o)) bits.push("pink colored garment");
  if (/blue|bleu/.test(o) && /jean|denim|top|dress/.test(o)) bits.push("blue tones");

  // Négatifs utiles selon contexte
  if (/wet|tremp|soaked|mouill|pluie|orage/.test(o)) {
    bits.push("must look wet and soaked");
  }
  if (/oversized|too big|trop grand|boyfriend/.test(o)) {
    bits.push("must look oversized baggy not fitted");
  }
  if (/ripped|troué/.test(o)) {
    bits.push("must show ripped holes in fabric");
  }

  return bits.filter(Boolean).join(", ");
}


function buildLeaImagePrompt(extra = "") {
  const c = character();
  if (c.id === "lea") {
    // Même visage que la galerie Grok (jeune, soft, cheveux lisses, pas glamour MILF)
    const pose = pick([
      "standing in doorway looking back over shoulder at camera, wet clothes",
      "facing camera shy in the hallway doorway, soaked crop top",
      "hand on doorframe, rain-soaked, timid soft expression",
      "leaning on doorframe, wet hair sticking to skin, eyes down shy",
    ]);
    return [
      "ultra photorealistic DSLR photo of Léa, SAME face as reference gallery photos,",
      "(18-21 year old young French woman:1.35), (looks exactly 21:1.3), youthful soft face, baby face not mature,",
      "(long straight dark brown hair to lower back:1.25), NOT wavy, NOT hollywood waves,",
      "brown eyes, fair pale skin, natural soft makeup or none, natural brows,",
      "(large 95D breasts:1.2), hourglass waist,",
      "(soaked wet white short crop top:1.3), thin wet fabric clinging to breasts, water droplets on skin,",
      "(tight wet dark blue skinny jeans:1.2), wet denim,",
      "wet skin sheen, water droplets, wet hair strands on face,",
      "apartment hallway doorway at night, indoor lights,",
      pose + ",",
      "natural skin pores, soft cinematic lighting, sharp detailed young face,",
      extra || "",
      "NOT middle-aged, NOT 30 years old, NOT 35, NOT mature face, NOT glamorous heavy makeup,",
      "NOT different woman, NOT model face, NOT wavy voluminous salon hair, NOT dry clothes, NOT nude, NOT studio seamless"
    ].filter(Boolean).join(" ");
  }
  // —— PROFIL = scène du SCÉNARIO (tenue + lieu + situation) ——
  const outfits = (c.outfits && c.outfits.length) ? c.outfits : ["casual indoor clothes"];
  const places = (c.places && c.places.length) ? c.places : ["apartment interior at night"];
  // Tenue + lieu FIXES = 1er du scénario (comme les covers Grok). Seule la pose change.
  const outfit = outfits[0];
  const place = places[0];
  const scenario = String(c.scenario || c.title || "").replace(/\s+/g, " ").trim();
  const age = c.age || 21;

  // Poses cohérentes avec le scénario (pas un shooting studio générique)
  let posePool;
  if (/jade|lina|hana|mei|sasha/.test(c.id)) {
    posePool = [
      "sitting at a desk with open textbooks, studying at night",
      "standing shy near the desk, arms loosely folded, glasses on",
      "sitting on floor cushions with notebooks, looking up",
      "in the bedroom doorway holding a book, timid pose",
    ];
  } else if (/doorway|porte|entrée|hallway|clés|orage|frapp/i.test(scenario + " " + place)) {
    posePool = [
      "standing in the apartment doorway, one hand on the doorframe",
      "in the hallway at the door, looking at the viewer",
      "leaning slightly on the doorframe, night indoor light",
    ];
  } else if (/soirée|cocktail|pompette|wine|robe/i.test(scenario + " " + outfit)) {
    posePool = [
      "standing in the living room after a party, slightly tipsy smile",
      "sitting on the couch with a wine glass nearby",
      "in the doorway at night, cocktail dress, city light behind",
    ];
  } else if (/sport|run|athlétique|yoga/i.test(scenario + " " + outfit)) {
    posePool = [
      "standing in the entryway after a run, catching breath",
      "in the living room on a yoga mat",
      "bathroom doorway, sport clothes",
    ];
  } else {
    posePool = [
      "standing three-quarter view looking at camera",
      "standing, weight on one hip, looking at camera",
      "sitting in the scene, looking at camera",
      "slight over-the-shoulder look, still in the same outfit and location",
    ];
  }
  const pose = pick(posePool);

  const bodyLock = {
    ines: "medium C-cup breasts, wide hips, golden tan, athletic-curvy NOT huge chest",
    aya: "ATHLETIC lean, SMALL firm A-B breasts, sports body, NOT busty, NOT large breasts",
    sofia: "hourglass, extremely LARGE 100E breasts, TINY waist, NOT plus-size, NOT chubby belly",
    jade: "slim young student, small A-cup nearly flat chest, thin arms, freckles, round glasses, brown hair in a bun",
    myriam: "full soft figure, large D breasts, wide hips, NOT skinny",
    chloe: "slim petite, small-medium B-cup, freckles, NOT huge chest",
    nina: "TALL slim Slavic, medium C-cup, long legs, NOT plus-size",
    keisha: "dark skin, large breasts, very round butt, NOT skinny",
    lina: "petite Korean, VERY SMALL almost flat chest, slim, NOT busty",
    priya: "Indian bronze skin, large D breasts, wide hips",
    camila: "slim waist, THICK round butt, medium breasts, NOT plus-size",
    amelie: "CHUBBY plus-size, soft belly, very LARGE breasts, round face, NOT slim",
    zoe: "VERY THIN goth, small B-cup, pale, NOT busty",
    fatou: "tall, extremely LARGE heavy F breasts, powerful hips",
    hana: "petite Japanese, FLAT A-cup, short black bob, NOT busty",
    lucia: "hourglass, large D breasts, defined waist",
    marine: "athletic swimmer, medium breasts, toned, NOT chubby",
    rania: "slim elegant, medium C-cup, NOT plus-size",
    thea: "thin redhead, small B-cup, freckles, NOT busty",
    viola: "soft plump, large D breasts, NOT skinny",
    noemie: "short petite, small-medium B-cup",
    daria: "sculpted, medium C-cup, NOT chubby",
    mei: "thin Chinese woman, FLAT A-cup breasts, NOT busty, slender frame",
    aisha: "dancer, medium B-cup, toned glutes, NOT plus-size",
    bruna: "TINY waist, HUGE round Brazilian butt, medium C-cup",
    elise: "soft, very LARGE E breasts, NOT skinny",
    sasha: "androgynous slim, FLAT small A-cup, short hair, NOT busty",
    yasmine: "glamorous, large 95D breasts, NOT plus-size",
    olga: "plump Russian, heavy E breasts, full hips",
    maya: "slim waist, medium C-cup, caramel skin",
    lea: "hourglass figure, generous 95D large breasts, long straight brown hair",
  }[c.id] || (c.body || "");

  const smallChest = /jade|aya|lina|hana|mei|sasha|thea|zoe|chloe/.test(c.id);
  const anti = smallChest
    ? "NOT large breasts, NOT huge cleavage, NOT voluptuous, NOT 95D"
    : "";

  const looks = describeLooks(c);
  const body = (bodyLock || c.body || "").replace(/\s+/g, " ").trim();
  const outfitDetail = describeOutfitDetail(outfit, scenario);
  const placeDetail = describePlaceDetail(place);
  const idLock = identityLock(c);

  // Situation tirée du scénario (FR → indices EN simples)
  let situation = "in the character scenario scene";
  if (/orage|tremp|pluie|storm|wet/i.test(scenario)) situation = "caught in a thunderstorm, wet clothes, rain";
  else if (/clés|oubli/i.test(scenario)) situation = "forgot her keys, waiting at the door at night";
  else if (/révision|étudi|livre|desk|textbooks/i.test(scenario + " " + place)) situation = "study session, books and notes around";
  else if (/soirée|pompette|cocktail|party/i.test(scenario)) situation = "coming back from a party at night";
  else if (/sport|course|run/i.test(scenario)) situation = "just after exercise";
  else if (/panne|voiture/i.test(scenario)) situation = "car broke down, seeking help";
  else if (scenario) situation = scenario.slice(0, 160);

  // Physique verrouillé + tenue/lieu scénario (pose seule varie un peu)
  return [
    fixedAppearanceBlock(c) + ",",
    "Photorealistic photo,",
    "body: " + body + ",",
    "OUTFIT REQUIRED (match exactly): " + outfitDetail + ",",
    "OUTFIT REQUIRED (match exactly): " + outfitDetail + ",",
    "Location: " + placeDetail + ",",
    "scenario: " + situation + ",",
    pose + ",",
    "Natural skin pores, realistic DSLR photography, sharp detailed face matching identity, soft cinematic lighting,",
    "High-end photorealistic quality,",
    extra || "",
    anti,
    "No cartoon, no anime, no CGI, no illustration,",
    "no wrong hair color, no wrong eye color, no wrong cup size, no wrong body type,",
    "no wrong outfit, no missing wet/ripped/oversized details from the scenario outfit,",
    "NOT " + ageNegatives(c)
  ].filter(Boolean).join(" ");
}


/**
 * Analyse les messages du chat pour en extraire scène complète :
 * pièce, meuble, pose, tenue, regard, humeur.
 * Priorité : messages les plus récents (derniers écrasent les anciens).
 */
function analyzeSceneFromMessages(chat, sc0) {
  const sc = Object.assign({}, sc0 || {});
  const msgs = (chat && chat.messages) || [];
  // Normalise apostrophes / espaces pour matcher "top court", "trempé", etc.
  const norm = (s) => String(s || "")
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/\s+/g, " ");
  const texts = msgs.filter((m) => m && m.content && !m.pendingScene).map((m) => norm(m.content));
  const full = texts.join("\n");
  const recent = texts.slice(-8).join("\n");
  const last2 = texts.slice(-3).join("\n");

  // —— PIÈCE ——
  const places = [
    [/cheminée|fireplace|coin\s+du\s+feu|près\s+du\s+feu|au\s+feu/, "salon"],
    [/salon|canapé|sofa|living|dans\s+le\s+salon/, "salon"],
    [/salle\s*de\s*bain|douche|baignoire|lavabo|bathroom/, "salle de bain"],
    [/chambre|bedroom|au\s*lit|dans\s*le\s*lit/, "chambre"],
    [/cuisine|kitchen/, "cuisine"],
    [/couloir|hall|entrée|doorway|seuil|porte\s+d['']entrée/, "entrée"],
    [/balcon|terrasse/, "balcon"],
    [/voiture|car\b|siège\s+arrière/, "voiture"],
    [/bureau|office/, "bureau"],
    [/hôtel|hotel/, "hôtel"],
    [/piscine|pool/, "piscine"],
    // dehors seulement si explicitement dehors SANS salon/cheminée récents
    [/\b(jardin|dehors|à\s+l['']extérieur|dans\s+la\s+rue)\b/, "dehors"],
  ];
  for (const [re, label] of places) {
    if (re.test(last2) || re.test(recent)) {
      sc.place = label;
      break;
    }
  }
  if (!sc.place) {
    for (const [re, label] of places) {
      if (re.test(full)) { sc.place = label; break; }
    }
  }
  // Priorité absolue salon/cheminée/canapé sur "dehors" si présents dans les messages récents
  if (/cheminée|fireplace|canapé|salon|feu\s+crépite|bord\s+du\s+canapé/i.test(last2 + "\n" + recent)) {
    sc.place = "salon";
  }

  // —— MEUBLE / SUPPORT ——
  const furniture = [
    [/baignoire|bathtub/, "in the bathtub, water, tiles"],
    [/douche|shower/, "in the shower, wet tiles, glass door"],
    [/cheminée|fireplace|feu\s+crépite|près\s+du\s+feu/, "by the fireplace, warm fire light, living room"],
    [/canapé\s+(en\s+)?cuir|leather\s+sofa|sofa\s+cuir|canapé\s+profond/, "sitting deep in a dark leather sofa, living room, leather texture visible"],
    [/canapé|sofa|couch|bord\s+du\s+canapé/, "sitting on the sofa, living room cushions"],
    [/fauteuil|armchair/, "on an armchair"],
    [/chaise|chair(?!\s*e)/, "on a chair"],
    [/lit|bed\b|matelas/, "on the bed, sheets and pillows"],
    [/table|desk|bureau/, "on or against a table"],
    [/mur|wall/, "against the wall"],
    [/sol|par terre|floor|carpet|tapis/, "on the floor"],
    [/évier|sink/, "at the bathroom sink"],
    [/fenêtre|window/, "by the window"],
  ];
  sc.furniture = "";
  for (const [re, desc] of furniture) {
    if (re.test(last2) || re.test(recent)) {
      sc.furniture = desc;
      break;
    }
  }
  if (!sc.furniture) {
    for (const [re, desc] of furniture) {
      if (re.test(full)) { sc.furniture = desc; break; }
    }
  }

  // —— POSE / POSITION (dernier match dans last2 puis recent) ——
  const poses = [
    [/allong[ée]e?\s+(sur\s+)?(le\s+)?lit|sur\s+le\s+lit|lying\s+on\s+(the\s+)?bed/,
      "lying provocatively on the bed, full body, sexy pose, arched slightly"],
    [/à\s+quatre\s+pattes|on\s+all\s+fours|doggy/,
      "on all fours on the bed, arched back, looking over shoulder, full body"],
    [/genoux|à\s+genoux|on\s+her\s+knees/,
      "kneeling on the bed or floor, seductive pose, full body"],
    [/provocant|sexy\s+pose|sensuelle/,
      "sexy provocative pose, full body, seductive body language"],
    [/écarte\s+les\s+jambes|jambes\s+[eé]cart/,
      "sitting or lying with legs parted, full body, intimate"],

    [/missionnaire|missionary|sur\s+le\s+dos.{0,40}(jambes|écarte)|position\s+missionnaire/,
      "lying on her BACK in missionary position, legs open, looking up, full body"],
    [/par\s+derrière|en\s+levrette|levrette|doggy|from\s+behind|à\s+quatre\s+pattes/,
      "on all fours doggy style, arched back, looking over shoulder, full body"],
    [/califourchon|cowgirl|à\s+cheval\s+sur/,
      "straddling partner cowgirl, sitting on hips, full body"],
    [/penchée|bent\s+over|plié\s+en\s+deux/,
      "bent over furniture, hands bracing, hips raised, full body"],
    [/contre\s+le\s+mur|pinned/,
      "standing against the wall, one leg possibly raised, full body"],
    [/suce|fellation|blowjob|à\s+genoux\s+devant/,
      "kneeling for oral sex, looking up, full body"],
    [/cunnilingus|lèche.{0,15}(chatte|sexe)/,
      "reclined legs open, partner between thighs, full body"],
    [/allongée\s+sur\s+le\s+ventre|sur\s+le\s+ventre/,
      "lying face down on her stomach, full body"],
    [/allong|couchée|sur\s+le\s+lit|lying\s+down/,
      "lying down full body head to toe"],
    [/assise\s+sur\s+(tes|ses|les)\s+genoux|on\s+his\s+lap/,
      "sitting on partner's lap, full body"],
    [/assise|assis|s['']assoit|redresse/,
      "sitting, legs and feet visible, full body"],
    [/à\s+genoux|kneeling/,
      "kneeling, full body"],
    [/debout|se\s+lève|standing/,
      "standing upright, full body"],
    [/mains?.{0,20}(sous|under).{0,15}(chemise|shirt)|glisse.{0,15}(sous|main)/i,
      "sitting, hands sliding under the oversized shirt on thighs, intimate gesture, still clothed in shirt, full body"],
    [/bras\s+croisés|croise\s+les\s+bras/,
      "standing with arms crossed over chest, full body"],
    [/tend\s+(la\s+main|les\s+mains)|attrape|reaching/,
      "reaching out with hands, slight lean, full body"],
  ];
  sc.poseDetail = "";
  for (const [re, desc] of poses) {
    if (re.test(last2)) { sc.poseDetail = desc; break; }
  }
  if (!sc.poseDetail) {
    for (const [re, desc] of poses) {
      if (re.test(recent)) { sc.poseDetail = desc; break; }
    }
  }
  if (!sc.poseDetail && sc.pose) {
    sc.poseDetail = "full body, " + sc.pose;
  }
  if (!sc.poseDetail) sc.poseDetail = "natural full body pose, head to toe";

  // —— REGARD / EXPRESSION ——
  const gazes = [
    [/yeux\s+fermés|closed\s+eyes|paupières/, "eyes closed"],
    [/regarde\s+en\s+bas|regard\s+baissé|yeux\s+baissés|timide/, "looking down shyly"],
    [/regarde\s+(dans\s+les\s+yeux|vers\s+toi|vers\s+moi)|eye\s+contact/, "looking into partner's eyes"],
    [/par-dessus\s+l['']épaule|over\s+shoulder/, "looking over her shoulder"],
    [/vers\s+le\s+plafond|head\s+back|tête\s+renversée/, "head tilted back, eyes up"],
    [/désir|excit|mouill|soupir|gémiss/, "aroused expression, parted lips, desire in the eyes"],
    [/sourire|sourit/, "soft smile"],
    [/rougit|gênée|embarrass/, "blushing shy expression"],
  ];
  sc.gaze = "natural expression";
  for (const [re, desc] of gazes) {
    if (re.test(last2) || re.test(recent)) { sc.gaze = desc; break; }
  }

  // —— TENUE : compose plusieurs pièces depuis les messages (pas un seul match) ——
  const win = (last2 + "\n" + recent).toLowerCase();
  const pieces = [];
  let isNude = false;
  if (/\b(entièrement|complètement)\s+nue\b|\bsans\s+rien\b|fully\s+naked|completely\s+nude/i.test(win)) {
    isNude = true;
    pieces.push("completely nude, bare skin, no clothes");
  } else if (/topless|seins\s+nus|poitrine\s+nue/i.test(win)) {
    pieces.push("topless bare breasts");
  } else {
    // Haut
    if (/top\s*(court\s*)?(tremp|mouill)|crop\s*top.{0,20}(tremp|mouill|wet)|tremp[ée].{0,30}(top|crop)|top\s+mouill/i.test(win)
        || (/top\s+court|crop\s*top|top\s+mouill/i.test(win) && /tremp|mouill|pluie|orage|wet|averse/i.test(win))) {
      pieces.push("SOAKING WET white short crop top or lace top, thin wet fabric clinging to breasts, water droplets on skin");
    } else if (/top\s+court|crop\s*top|top\s+mouill/i.test(win)) {
      pieces.push("wearing a short crop top covering the breasts");
    } else if (/chemise\s+(trop\s+grande|oversize|oversized|ample|large)|chemise.{0,30}(cuisses|thighs)|oversized\s+shirt|shirt.{0,20}(thighs|too\s+big)/i.test(win)
        || (/chemise/i.test(win) && /(trop\s+grande|oversize|cuisses|ample)/i.test(win))) {
      pieces.push("wearing only an oversized men's shirt, shirt hem reaches mid-thighs, bare legs, NOT nude, shirt covering breasts and hips");
    } else if (/\bchemise\b/i.test(win) && !/(enl[eè]ve|retire).{0,20}chemise/i.test(win)) {
      pieces.push("wearing a shirt, clothed, NOT nude");
    } else if (/t-?shirt/i.test(win) && !/(enl[eè]ve|retire).{0,20}t-?shirt/i.test(win)) {
      pieces.push("wearing a t-shirt, clothed");
    } else if (/robe\s+courte|robe\s+moulante|petite\s+robe|d[eé]collet[ée]/i.test(win)) {
      pieces.push("wearing a short tight low-cut dress");
    } else if (/\brobe\b/i.test(win) && !/robe\s+de\s+chambre/i.test(win)) {
      pieces.push("wearing a dress");
    } else if (/nuisette|n[eé]glig[eé]/i.test(win)) {
      pieces.push("wearing a sheer sexy nightie slip");
    } else if (/porte[- ]?jarretelles|garter\s*belt|jarretelles/i.test(win)) {
      pieces.push("wearing a garter belt with stockings, sexy lingerie set");
    } else if (/bas\s+r[eé]sille|r[eé]silles|fishnet|collants?\s+r[eé]sille/i.test(win)) {
      pieces.push("wearing fishnet stockings");
    } else if (/mini[- ]?jupe|micro[- ]?jupe|jupe\s+(tr[eè]s\s+)?courte/i.test(win)) {
      pieces.push("wearing a very short mini skirt");
    } else if (/lingerie\s+(rouge|noire|sexy|fine|transparente)|soutien[- ]gorge\s+(en\s+)?dentelle/i.test(win)) {
      pieces.push("wearing sexy lace lingerie, sheer bra and matching panties");
    } else if (/lingerie|soutien[- ]gorge\s+et\s+culotte|en\s+soutien[- ]gorge/i.test(win)) {
      pieces.push("wearing only sexy bra and panties");
    } else if (/soutien[- ]gorge|\bbra\b/i.test(win) && !/(enl[eè]ve|retire).{0,25}soutien/i.test(win)) {
      pieces.push("wearing a bra");
    } else if (/d[eé]shabill|se\s+d[eé]shabille|enl[eè]ve\s+(ses\s+)?v[eê]tements/i.test(win)) {
      pieces.push("in the process of undressing, partially clothed, sexy");
    }
    // Bas
    if (/porte[- ]?jarretelles|garter/i.test(win)) {
      pieces.push("garter belt and stockings on legs");
    } else if (/bas\s+r[eé]sille|fishnet/i.test(win)) {
      pieces.push("fishnet stockings on legs");
    } else if (/jean\s+(moulant|serr[eé]|trou[eé])|ripped\s+jeans/i.test(win)) {
      pieces.push("tight blue jeans");
    } else if (/\bjean\b/i.test(win) && !/(enl[eè]ve|retire).{0,20}jean/i.test(win)) {
      pieces.push("wearing blue jeans");
    } else if (/mini[- ]?jupe|micro[- ]?jupe|jupe\s+(tr[eè]s\s+)?courte/i.test(win)) {
      pieces.push("very short mini skirt");
    } else if (/jupe/i.test(win)) {
      pieces.push("wearing a skirt");
    } else if (/short/i.test(win)) {
      pieces.push("wearing shorts");
    } else if (/string|thong/i.test(win) && !/(enl[eè]ve|retire)/i.test(win)) {
      pieces.push("wearing a thong");
    } else if (/culotte|panties/i.test(win) && !/(enl[eè]ve|retire).{0,20}culotte/i.test(win)) {
      pieces.push("wearing panties");
    }
    // Serviette : distinguer « on lui apporte » vs « habillée en serviette »
    if (/serviette|towel/i.test(win)) {
      const userGivesTowel = /(apporte|apport[ée]|donne|tend|tiens|voil[àa]|prends|prendre|passer|passe).{0,50}serviette|serviette.{0,40}(pour\s+(toi|t['']essuyer)|tiens|voil[àa])/i.test(win);
      const wearingOnlyTowel = /en\s+serviette|envelopp[ée]e?\s+(dans\s+)?(la\s+)?serviette|wrapped\s+in\s+(a\s+)?towel|seulement\s+(une\s+)?serviette|plus\s+que\s+(la\s+)?serviette/i.test(win)
        && !userGivesTowel;
      if (wearingOnlyTowel && pieces.length === 0) {
        pieces.push("wrapped only in a beige bath towel covering the body, not fully nude");
      } else if (userGivesTowel || pieces.length > 0) {
        // Garde les vêtements + tient la serviette
        pieces.push("still wearing her current clothes, holding a bath towel to dry herself, NOT dressed only in a towel");
      } else {
        pieces.push("holding a bath towel, still clothed underneath");
      }
    }
    if (/peignoir|robe\s+de\s+chambre/i.test(win) && pieces.length === 0) {
      pieces.push("wearing a bathrobe");
    }
    // Cheveux mouillés
    if (/tremp|mouill|pluie|orage|averse|wet\s+hair|cheveux.{0,20}(coll|mouill|tremp)/i.test(win)) {
      pieces.push("long hair soaking wet, water droplets on skin");
    }
  }
  if (isNude) {
    sc.outfitDetail = pieces.join(", ");
    sc.outfit = "nue";
  } else if (pieces.length) {
    sc.outfitDetail = pieces.join(", ");
    sc.outfit = pieces[0].slice(0, 40);
  } else if (sc.outfit && String(sc.outfit).length > 2 && sc.outfit !== "casual") {
    sc.outfitDetail = "wearing " + sc.outfit;
  } else {
    sc.outfitDetail = ""; // sera complété par scénario personnage dans buildSceneImagePrompt
  }

  // Acte sexuel en cours ?
  sc.explicit = /(baise|baiser|pénètr|missionnaire|levrette|doggy|orgasme|sperme|chatte|bite|fellation|suce|doigt)/i.test(last2 + " " + recent);

  // Meuble par défaut selon pièce
  if (!sc.furniture) {
    if (sc.place === "salon") sc.furniture = "in the living room near the sofa";
    else if (sc.place === "chambre") sc.furniture = "in the bedroom near the bed";
    else if (sc.place === "salle de bain") sc.furniture = "in the bathroom";
    else if (sc.place === "cuisine") sc.furniture = "in the kitchen";
    else if (sc.place === "entrée") sc.furniture = "in the hallway by the door";
  }

  return sc;
}

/** Prompt scène chat = même qualité profil + tenue/pose du dialogue. */
function buildSceneImagePrompt() {
  try {
    const stored = loadChat(state.current);
    if (stored && typeof stored === "object") state.chat = stored;
  } catch (_) {}

  const c = character();
  const chat = state.chat || {};
  const sc = chat.scene || {};
  // Appliquer dernière mémoire vault (tenue/lieu/pose) si plus récente
  try {
    const entries = (chat.vault && chat.vault.entries) || [];
    const last = (tag) => {
      for (let i = entries.length - 1; i >= 0; i--) if (entries[i].tag === tag) return entries[i];
      return null;
    };
    const lt = last("tenue");
    const ll = last("lieu");
    const lp = last("pose");
    if (lt && lt.text) {
      if (/\bnue\b|naked|sans rien/i.test(lt.text)) { sc.body = "nue"; sc.outfit = "nue"; }
      else if (/topless|seins nus/i.test(lt.text)) { sc.body = "topless"; sc.outfit = sc.outfit || "topless"; }
      else if (/lingerie|sous-vêt/i.test(lt.text)) { sc.body = "lingerie"; sc.outfit = "lingerie"; }
    }
    if (ll && ll.text && !sc.place) {
      const m = ll.text.match(/lieu:\s*([a-zàâéèêë\s]+)/i);
      if (m) sc.place = m[1].trim();
    }
    if (lp && lp.text) {
      const m = lp.text.match(/position:\s*([^—\-\(]+)/i);
      if (m) sc.pose = m[1].trim();
    }
  } catch (_) {}
  // Analyse complète des messages (pièce, meuble, pose, tenue, regard)
  const analyzed = analyzeSceneFromMessages(chat, sc);
  Object.assign(sc, analyzed);

  // Priorité tenue : 1) messages  2) vault/mémoire  3) scene.outfit déjà connu  4) scénario SEULEMENT si vide
  sc.outfitSource = sc.outfitDetail && sc.outfitDetail.length > 5 ? "messages" : "";

  if (!sc.outfitDetail || sc.outfitDetail.length < 5) {
    // 2) Vault + mémoires "tenue"
    try {
      const entries = (chat.vault && chat.vault.entries) || [];
      for (let i = entries.length - 1; i >= 0; i--) {
        const e = entries[i];
        if (!e || (e.tag !== "tenue" && e.tag !== "intime")) continue;
        const t = String(e.text || "").toLowerCase();
        if (/pièces:|snapshot:/i.test(t) && !/robe|crop|top|jean|nuisette|serviette|lingerie|nue|habill/i.test(t)) continue;
        if (/nue|sans rien|naked/i.test(t)) { sc.outfitDetail = "completely nude, bare skin"; sc.outfit = "nue"; sc.outfitSource = "vault"; break; }
        if (/robe\s*courte|robe\s*moulante|décollet/i.test(t)) { sc.outfitDetail = "wearing a short tight low-cut dress"; sc.outfit = "robe"; sc.outfitSource = "vault"; break; }
        if (/top\s*court|crop/i.test(t) && /tremp|mouill|wet/i.test(t)) {
          sc.outfitDetail = "SOAKING WET short crop top, wet fabric clinging, water droplets";
          sc.outfit = "top court trempé"; sc.outfitSource = "vault"; break;
        }
        if (/top\s*court|crop\s*top/i.test(t)) { sc.outfitDetail = "wearing a short crop top"; sc.outfit = "top court"; sc.outfitSource = "vault"; break; }
        if (/serviette|towel/i.test(t)) { sc.outfitDetail = "wrapped in a bath towel"; sc.outfit = "serviette"; sc.outfitSource = "vault"; break; }
        if (/lingerie|soutien|culotte/i.test(t)) { sc.outfitDetail = "wearing bra and panties"; sc.outfit = "lingerie"; sc.outfitSource = "vault"; break; }
        if (/nuisette/i.test(t)) { sc.outfitDetail = "wearing a nightie"; sc.outfit = "nuisette"; sc.outfitSource = "vault"; break; }
        if (/jean/i.test(t)) { sc.outfitDetail = "wearing jeans and a top"; sc.outfit = "jean"; sc.outfitSource = "vault"; break; }
        if (/habill|vêtue|vêtements/i.test(t)) { sc.outfitDetail = "fully clothed"; sc.outfit = "habillée"; sc.outfitSource = "vault"; break; }
      }
      if (!sc.outfitDetail) {
        const mems = (chat.memories || []).filter((m) => m.category === "tenue" || m.category === "intime");
        for (let i = mems.length - 1; i >= 0; i--) {
          const t = String(mems[i].text || "").toLowerCase();
          if (/robe/i.test(t)) { sc.outfitDetail = "wearing a dress"; sc.outfitSource = "memory"; break; }
          if (/top\s*court|crop/i.test(t)) { sc.outfitDetail = "wearing a short crop top"; sc.outfitSource = "memory"; break; }
          if (/serviette/i.test(t)) { sc.outfitDetail = "wrapped in a bath towel"; sc.outfitSource = "memory"; break; }
          if (/nue/i.test(t)) { sc.outfitDetail = "completely nude"; sc.outfitSource = "memory"; break; }
        }
      }
    } catch (_) {}
  }

  // 3) sc.outfit déjà posé par extractScene (sans redécrire le scénario)
  if ((!sc.outfitDetail || sc.outfitDetail.length < 5) && sc.outfit && String(sc.outfit).length > 2) {
    sc.outfitDetail = "wearing " + String(sc.outfit);
    sc.outfitSource = sc.outfitSource || "scene";
  }

  // 4) Dernier recours UNIQUEMENT : scénario / outfits[] du personnage
  if (!sc.outfitDetail || sc.outfitDetail.length < 5) {
    if (c.outfits && c.outfits[0]) {
      try {
        sc.outfitDetail = "wearing " + describeOutfitDetail(c.outfits[0], c.scenario || "");
      } catch (_) {
        sc.outfitDetail = "wearing " + c.outfits[0];
      }
      sc.outfit = c.outfits[0];
      sc.outfitSource = "scenario";
    } else {
      sc.outfitDetail = "wearing clothes as described in the roleplay";
      sc.outfitSource = "default";
    }
  }

  try {
    if (!chat.scene) chat.scene = {};
    Object.assign(chat.scene, {
      place: sc.place,
      outfit: sc.outfit,
      outfitDetail: sc.outfitDetail,
      outfitSource: sc.outfitSource,
      pose: sc.poseDetail || sc.pose,
      furniture: sc.furniture,
    });
  } catch (_) {}

  const age = c.age || 21;

  // Réutilise le même bodyLock que le profil
  const bodyLock = {
    ines: "medium C-cup breasts, wide hips, golden tan, athletic-curvy NOT huge chest",
    aya: "ATHLETIC lean, SMALL firm A-B breasts, sports body, NOT busty, NOT large breasts",
    sofia: "hourglass, extremely LARGE 100E breasts, TINY waist, NOT plus-size, NOT chubby belly",
    jade: "slim young student wearing round glasses, brown bun, freckles, small A-cup chest, thin arms",
    myriam: "full soft figure, large D breasts, wide hips, Moroccan, NOT skinny",
    chloe: "slim petite, small-medium B-cup, freckles, NOT huge chest",
    nina: "TALL slim Slavic, medium C-cup, long legs, NOT plus-size",
    keisha: "dark skin, large breasts, very round butt, NOT skinny",
    lina: "petite Korean, VERY SMALL almost flat chest, slim, NOT busty",
    priya: "Indian bronze skin, large D breasts, wide hips",
    camila: "slim waist, THICK round butt, medium breasts, NOT plus-size",
    amelie: "CHUBBY plus-size, soft belly, very LARGE breasts, round face, NOT slim",
    zoe: "VERY THIN goth, small B-cup, pale, NOT busty",
    fatou: "tall, extremely LARGE heavy F breasts, powerful hips",
    hana: "petite Japanese, FLAT A-cup, short black bob, NOT busty",
    lucia: "hourglass, large D breasts, defined waist",
    marine: "athletic swimmer, medium breasts, toned, NOT chubby",
    rania: "slim elegant, medium C-cup, NOT plus-size",
    thea: "thin redhead, small B-cup, freckles, NOT busty",
    viola: "soft plump, large D breasts, NOT skinny",
    noemie: "short petite, small-medium B-cup",
    daria: "sculpted, medium C-cup, NOT chubby",
    mei: "thin Chinese woman, FLAT A-cup breasts, NOT busty, slender frame, long dark hair often in ponytail",
    aisha: "dancer, medium B-cup, toned glutes, NOT plus-size",
    bruna: "TINY waist, HUGE round Brazilian butt, medium C-cup",
    elise: "soft, very LARGE E breasts, NOT skinny",
    sasha: "androgynous slim, FLAT small A-cup, short hair, NOT busty",
    yasmine: "glamorous, large 95D breasts, NOT plus-size",
    olga: "plump Russian, heavy E breasts, full hips",
    maya: "slim waist, medium C-cup, caramel skin",
    lea: "hourglass figure, generous 95D large breasts, long straight brown hair to lower back, brown eyes, fair French skin",
  }[c.id] || (c.body || "");

  const appearance = (c.appearance || "").replace(/\s+/g, " ").trim();
  const ethnicity = c.ethnicity || "";

  // Messages récents (priorité aux 8 derniers + mémoires tenue)
  const msgs = (chat.messages || []).slice(-14);
  const memTenue = (chat.memories || []).filter((m) => m.category === "tenue" || m.category === "intime").slice(-12).map((m) => m.text || "").join(" ");
  const blob = (msgs.map((m) => m.content || "").join("\n") + "\n" + memTenue + "\n" + JSON.stringify(sc)).toLowerCase();

  // —— TENUE pièce par pièce ——
  let outfit = "";
  let outfitNeg = "";
  let cl = (sc.clothes && typeof sc.clothes === "object") ? Object.assign({}, sc.clothes) : null;

  // Relecture du dialogue : se rhabille / rajuste soutien → forcer couverture
  if (/(rajuste|remet|enfile).{0,40}(soutien|culotte)/i.test(blob)
      || /(récup[eè]re|ramasse|reprend).{0,40}(crop|top|t-?shirt|veste)/i.test(blob)
      || /(soutien[- ]gorge).{0,40}(culotte)/i.test(blob)) {
    cl = cl || { top: false, bottom: false, bra: true, panties: true };
    if (/(soutien|bra)/i.test(blob)) cl.bra = true;
    if (/(culotte|string)/i.test(blob)) cl.panties = true;
    if (/(crop|top|t-?shirt|veste|hoodie)/i.test(blob) && /(récup|ramasse|reprend|enfile|remet)/i.test(blob)) {
      cl.top = true;
      cl.bra = true;
    }
    // si elle parle de soutien+culotte sans dire "enlève", pas nue
    if (cl.bra || cl.panties) {
      if (cl.top !== true) cl.top = false; // peut être en lingerie
    }
  }

  if (cl) {
    const top = cl.top;
    const bot = cl.bottom;
    const bra = cl.bra !== false;
    const pan = cl.panties !== false;
    const parts = [];
    const neg = [];

    if (top === "nuisette") {
      outfit = "wearing a short sheer nightie slip with panties underneath, breasts covered by fabric";
      outfitNeg = "nude, topless, bare breasts, jeans";
    } else if (top === "serviette" || bot === "serviette") {
      outfit = "wearing only a bath towel wrapped around the body, chest covered by towel";
      outfitNeg = "nude, bare breasts, street clothes";
    } else if (top === "peignoir" || bot === "peignoir") {
      outfit = "wearing a loose bathrobe, body covered";
      outfitNeg = "nude, jeans";
    } else if (!top && !bot && !bra && !pan) {
      outfit = "completely nude, fully naked, bare breasts, no bra, no panties, no clothes";
      outfitNeg = "wearing clothes, bra, panties, shirt, jeans";
    } else {
      // HAUT — forcer couverture si top ou bra
      if (top === true) {
        if (/crop\s*top|top\s+court/i.test(blob)) {
          parts.push("wearing a black crop top that fully covers her breasts, midriff may show, NOT nude, NOT topless");
        } else if (/t-?shirt|tee-shirt/i.test(blob)) {
          parts.push("wearing a t-shirt that fully covers her breasts, NOT nude");
        } else if (/hoodie|veste/i.test(blob)) {
          parts.push("wearing a top or jacket covering the chest");
        } else {
          parts.push("wearing a crop top or shirt fully covering her breasts and nipples, clothed upper body");
        }
        neg.push("nude", "topless", "bare breasts", "exposed nipples", "naked chest", "no clothes on top");
      } else if (bra) {
        parts.push("wearing a bra that covers her breasts, no outer shirt, lingerie bra visible, breasts NOT bare");
        neg.push("bare breasts", "exposed nipples", "topless without bra", "fully nude", "naked");
      } else {
        parts.push("topless with bare breasts fully exposed, no bra, no shirt");
        neg.push("wearing a bra", "wearing a shirt", "covered breasts");
      }
      // BAS
      if (bot === true) {
        if (/jean\s+troué|ripped jeans/i.test(blob)) parts.push("wearing ripped jeans");
        else if (/jean/i.test(blob)) parts.push("wearing jeans");
        else if (/jupe/i.test(blob)) parts.push("wearing a skirt");
        else if (/short/i.test(blob)) parts.push("wearing shorts");
        else parts.push("wearing pants or skirt");
        if (!pan) {
          parts.push("no panties underneath");
        }
        neg.push("fully nude lower body");
      } else if (pan) {
        parts.push("wearing panties or thong on the lower body, no pants no skirt");
        neg.push("wearing jeans", "fully nude from waist down", "no panties");
      } else {
        parts.push("nude from the waist down, no panties, no pants");
        neg.push("wearing panties", "wearing jeans");
      }
      outfit = parts.join(", ");
      outfitNeg = neg.join(", ");
    }
  } else {
    // fallback body states
    const bodyState = sc.body || "";
    if (bodyState === "nue") {
      outfit = "completely nude, fully naked";
      outfitNeg = "clothes, bra";
    } else if (bodyState === "soutien_bas") {
      outfit = "wearing a bra and pants, no shirt, breasts covered by bra only";
      outfitNeg = "bare breasts, fully nude, t-shirt";
    } else if (bodyState === "topless") {
      outfit = "topless bare breasts, still wearing bottom clothes";
      outfitNeg = "bra, shirt, fully nude";
    } else if (bodyState === "haut_culotte") {
      outfit = "wearing a top and panties only, no pants";
      outfitNeg = "fully nude, jeans";
    } else if (bodyState === "lingerie") {
      outfit = "wearing only bra and panties, no outer clothes";
      outfitNeg = "jeans, t-shirt, fully nude";
    } else if (bodyState === "habillée_sans_culotte") {
      outfit = "dressed with top and pants but no panties underneath";
      outfitNeg = "fully nude";
    } else if (c.outfits && c.outfits[0]) {
      outfit = "wearing " + describeOutfitDetail(c.outfits[0]);
      outfitNeg = "completely nude";
    } else {
      outfit = "wearing casual indoor clothes";
      outfitNeg = "completely nude, topless";
    }
  }

  // —— LIEU ——
  // —— LIEU ——
  const placeMap = {
    salon: "wide shot of living room, full sofa visible, coffee table, warm lamp, curtains, full room interior at night",
    chambre: "wide shot of bedroom, full bed visible, nightstand, lamp, room interior",
    "salle de bain": "bathroom wide view, mirror, tiles, sink visible",
    entrée: "apartment hallway doorway wide view, door frame, floor, wall",
    cuisine: "kitchen wide view, counters and floor visible",
    dehors: "outdoor night full scene, street or garden",
    balcon: "balcony full view with railing and city lights",
    voiture: "inside car showing seats and interior",
    bureau: "home office wide view with desk and chair",
    hôtel: "hotel bedroom wide shot, full bed and room",
    piscine: "poolside full scene at night",
  };
  let place = placeMap[sc.place] || "";
  if (!place) {
    if (/chambre|au lit|dans le lit|bedroom/i.test(blob)) place = placeMap.chambre;
    else if (/salon|canapé|sofa/i.test(blob)) place = placeMap.salon;
    else if (/salle de bain|douche/i.test(blob)) place = placeMap["salle de bain"];
    else if (/porte|entrée|doorway|seuil/i.test(blob)) place = placeMap.entrée;
    else if (/cuisine/i.test(blob)) place = placeMap.cuisine;
    else place = (c.places && c.places[0]) || "intimate apartment interior at night";
  }

  // —— POSE (y compris actes explicites) ——
  let pose = "full body standing, head to toe visible";
  let explicitAct = "";
  const act = (sc.activity || "") + " " + (sc.pose || "");
  const sexBlob = blob + " " + act;

  // Prise par derrière / doggy / levrette
  if (/par derrière|from behind|doggy|à quatre pattes|on all fours|en levrette|levrette/i.test(sexBlob)) {
    pose = "full body doggy style on all fours on the sofa or bed, arched back, hips back, looking over shoulder, entire body and furniture visible";
    explicitAct = "explicit penetrative sex from behind, doggy style, male partner behind her, adult uncensored intercourse";
  }
  // Penchée
  else if (/penchée|bent over|plié en deux/i.test(sexBlob)) {
    pose = "full body bent over the sofa arm or bed, hands bracing, hips raised, entire body in frame";
    explicitAct = "explicit sex from behind bent over, penetration, adult uncensored";
  }
  // Contre le mur
  else if (/contre le mur|pinned (to|against) the wall/i.test(sexBlob)) {
    pose = "full body standing sex against the wall, one leg raised, partner holding her, room visible";
    explicitAct = "explicit standing penetrative sex against wall, adult uncensored";
  }
  // Missionnaire / sur le dos / jambes
  else if (/missionnaire|missionary|sur le dos|jambes (é|e)cart|position missionnaire/i.test(sexBlob)) {
    pose = "full body lying on her BACK on the sofa in missionary position, legs open, looking up at partner, entire body and sofa visible, NOT standing, NOT arms crossed portrait";
    explicitAct = "explicit missionary sex on sofa, woman on her back, adult uncensored";
  }
  // Cowgirl
  else if (/califourchon|cowgirl|à cheval sur|straddl|monte sur (toi|moi)/i.test(sexBlob)) {
    pose = "full body cowgirl, she straddles on top facing partner, hips moving, entire bodies visible on sofa or bed";
    explicitAct = "explicit cowgirl penetrative sex, woman on top, adult uncensored";
  }
  // Fellation
  else if (/suce|fellation|blowjob|genoux devant/i.test(sexBlob)) {
    pose = "full body kneeling oral sex, looking up, partner standing or sitting, room visible";
    explicitAct = "explicit oral sex, fellatio, adult uncensored";
  }
  // Cunnilingus
  else if (/cunnilingus|lèche.{0,20}(chatte|sexe)/i.test(sexBlob)) {
    pose = "full body reclined with legs open, partner between her thighs, sofa or bed visible";
    explicitAct = "explicit cunnilingus, adult uncensored";
  }
  // Doigté
  else if (/doigt[eé]|doigts? (dans|en)/i.test(sexBlob)) {
    pose = "full body reclining, legs open, intimate hand between legs, aroused face, full body in frame";
    explicitAct = "explicit fingering, adult uncensored";
  }
  // Orgasm / pénétration / sperme / "je te prends" sans position nommée
  else if (/orgasme|jouis|sperme|remplis|chatte|pénètr|je te prend|je la prend|plus fort|plus rapidement|baise|baiser|fait l'amour|acte sexuel/i.test(sexBlob)
           || sc.activity === "acte sexuel") {
    pose = "full body during penetrative sex on the sofa or bed, legs wrapped or open, hips moving, partner engaged, entire scene and room visible, not a portrait";
    explicitAct = "explicit penetrative vaginal sex in progress, orgasm, adult uncensored intercourse, full bodies";
  }
  else if (/allong|couch[eé]|sur le lit/i.test(blob)) {
    pose = "full body lying on the bed or sofa, head to toe visible";
  } else if (/à genoux/i.test(blob)) {
    pose = "full body kneeling, head to toe visible";
  } else if (/assis|assise|canapé|sofa|redresse/i.test(blob)) {
    pose = "full body sitting on the sofa, legs and feet visible";
  } else if (/allong|allongée|sur le lit|sur le dos/i.test(blob)) {
    pose = "full body lying on the bed, head to toe visible";
  } else if (/debout|se lève|se lever/i.test(blob)) {
    pose = "full body standing, weight on one leg, natural stance";
  } else if (/bras croisé|bras croisés|croise les bras/i.test(blob)) {
    pose = "full body standing arms crossed over chest";
  } else if (/tendre|tend la main|attraper/i.test(blob)) {
    pose = "full body reaching out with hands, slight lean forward";
  } else if (/regarde|yeux|regard/i.test(blob) && /bas|sol|pieds/i.test(blob)) {
    pose = (pose || "full body") + ", gaze looking down shyly";
  }

  // sc.pose : complète si on n'a pas déjà une pose détaillée (missionnaire, doggy…)
  if (!explicitAct && sc.pose && String(sc.pose).length > 3) {
    pose = "full body, " + String(sc.pose).slice(0, 120);
  } else if (explicitAct && sc.pose) {
    // garde la pose détaillée, ajoute juste le label mémoire
    pose = pose + ", scene tag: " + String(sc.pose).slice(0, 40);
  }
  if (sc.activity && String(sc.activity).length > 3 && !explicitAct) {
    pose = pose + ", activity: " + String(sc.activity).slice(0, 80);
  }

  // Pendant un acte sexuel intense : souvent déshabillée (sauf si rhabillage récent)
  const lastMsgs = (msgs || []).slice(-4).map((m) => m.content || "").join("\n").toLowerCase();
  const midSex = !!explicitAct;
  const justDressed = /(rajuste|récup[eè]re|rhabill|remet).{0,40}(crop|top|soutien|culotte|veste)/i.test(blob);
  // Acte sexuel : pose explicite MAIS garde la tenue si encore des vêtements en mémoire
  const stillDressed = (cl && (cl.top === true || cl.bottom === true)
    || /robe|dress|jean|crop|t-shirt|habill/i.test(String(sc.outfit || "")));
  if (midSex && !justDressed && !stillDressed) {
    outfit = "completely nude during sex, bare breasts, bare hips, no clothes, skin on skin";
    outfitNeg = "fully clothed, wearing crop top covering breasts, jeans, portrait smile, standing pose";
  } else if (midSex && stillDressed) {
    // Ex: robe relevée en missionnaire — pas nue totale
    if (/robe/i.test(String(sc.outfit || "") + blob)) {
      outfit = "wearing a short tight low-cut dress pulled up around the waist, breasts still in the dress or partially exposed, missionary position on the sofa";
      outfitNeg = "completely nude standing, towel only, different face, standing portrait";
    } else {
      outfit = outfit || "partially undressed during sex, clothes still on body";
      outfitNeg = "standing fully clothed portrait, towel only";
    }
  } else if (/serviette|towel/i.test(lastMsgs) && !/robe|dress|jean|crop/i.test(lastMsgs)) {
    outfit = "holding or wrapping a beige towel, wet skin, wet hair";
    outfitNeg = "dry hair, fully nude standing, different face";
  }

  const mood = midSex
    ? "moaning expression, eyes half-closed or intense, flushed cheeks, NOT a big happy portrait smile"
    : (sc.mood === "timide" ? "shy blushing expression"
      : sc.mood === "excitée" ? "aroused expression, soft parted lips"
      : sc.mood === "enjouée" ? "playful mischievous smile"
      : "natural expression");

  const looks = describeLooks(c);
  const placeDetail = describePlaceDetail(place);
  const idLock = identityLock(c);

  // PHYSIQUE VERROUILLÉ — seuls posent/tenue/lieu changent
  const name = c.name || "the woman";
  const outfitDetail = describeOutfitDetail(outfit);
  const phys = fixedAppearanceBlock(c);

  if (midSex) {
    return [
      phys,
      "explicit NSFW sex scene, full body wide shot head to toe,",
      "NOT a close-up portrait, NOT bust crop, NOT headshot,",
      "wearing/state: " + outfit + ",",
      pose + ",",
      explicitAct + ",",
      "Location: " + placeDetail + ",",
      "furniture and room clearly visible,",
      mood + ",",
      "Natural skin pores, realistic DSLR photography, cinematic lighting, sharp focus,",
      "High-end photorealistic quality,",
      "KEEP fixed appearance identical, NOT wrong hair color, NOT wrong eye color, NOT wrong cup size, NOT wrong body type, NOT wrong age, NOT different face, NOT " + ageNegatives(c) + ",",
      "NOT smiling portrait selfie, NOT cropped at chest, NOT missing legs,",
      outfitNeg ? ("NOT " + outfitNeg) : "",
    ].filter(Boolean).join(" ");
  }

  // SCÈNE EN TÊTE — données extraites des messages
  const finalPose = (sc.poseDetail && sc.poseDetail.length > 5) ? sc.poseDetail : pose;
  // finalOutfit = déjà priorisé messages → vault → scene → scénario (voir plus haut)
  let finalOutfit = (sc.outfitDetail && sc.outfitDetail.length > 3)
    ? sc.outfitDetail
    : (outfit && !/casual indoor/i.test(String(outfit)) ? outfit : "");
  if (!finalOutfit || finalOutfit.length < 5) {
    // dernier recours scénario seulement ici aussi
    if (c.outfits && c.outfits[0]) {
      try { finalOutfit = "wearing " + describeOutfitDetail(c.outfits[0], c.scenario || ""); }
      catch (_) { finalOutfit = "wearing " + c.outfits[0]; }
      sc.outfitSource = sc.outfitSource || "scenario";
    } else {
      finalOutfit = "clothed as in the current dialogue";
    }
  }
  const clothed = /wearing|crop|top|jean|dress|robe|shirt|towel|wet fabric|clinging/i.test(finalOutfit)
    && !/completely nude|fully naked/i.test(finalOutfit);
  if (clothed) {
    outfitNeg = (outfitNeg ? outfitNeg + ", " : "") + "nude, naked, bare breasts, topless, completely nude, no clothes";
  }
  const finalPlace = [placeDetail, sc.furniture].filter(Boolean).join(", ");
  const finalGaze = sc.gaze || mood;
  const sceneLead = [
    "=== SCENE VARIABLES ONLY (may change) ===",
    "POSTURE / POSITION: " + finalPose,
    "OUTFIT RIGHT NOW: " + finalOutfit,
    "ROOM + FURNITURE: " + finalPlace,
    "EXPRESSION / GAZE: " + finalGaze,
    "full body wide shot head to toe, environment and furniture clearly visible,",
    sc.explicit ? "intimate adult moment in progress," : "",
    "=== END SCENE VARIABLES ===",
  ].filter(Boolean).join(" ");

  return [
    phys,
    sceneLead,
    "CRITICAL: keep the FIXED CHARACTER APPEARANCE identical to cover/profile — only change pose, clothes, posture, room,",
    "do NOT invent a different face, age, hair, eyes, breast size or body type,",
    "Natural skin pores, realistic DSLR photography, cinematic lighting,",
    "NOT different person, NOT different face, NOT wrong hair color, NOT wrong eye color,",
    "NOT wrong cup size, NOT wrong body type, NOT wrong age, NOT " + ageNegatives(c) + ",",
    "NOT close-up bust crop, NOT missing legs, NOT empty studio backdrop,",
    outfitNeg ? ("NOT " + outfitNeg) : "",
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

function openFull(src, opts) {
  opts = opts || {};
  const img = $("lightbox-img");
  if (img) {
    img.src = src;
    img.style.maxWidth = "100vw";
    img.style.maxHeight = "92vh";
    img.style.width = "auto";
    img.style.height = "auto";
    img.style.objectFit = "contain";
  }
  $("lightbox").classList.remove("hidden");
  const btn = $("lb-bg");
  if (btn) {
    // Section Générer / studio : pas de lien avec un personnage / chat
    if (opts.studio || state.view === "studio") {
      btn.style.display = "none";
      btn.onclick = null;
    } else {
      btn.style.display = "";
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = state.current || null;
        if (!id) {
          btn.textContent = "Ouvre un chat d'abord";
          return;
        }
        localStorage.setItem(chatBgKey(id), src);
        btn.textContent = "Fond du chat ✓";
      };
      btn.textContent = "Utiliser comme fond";
    }
  }
}

const GALLERY_MAX = 48; // max images par personnage

function diskGalleryKeys(id) {
  const k = id || state.current || "lea";
  if (!window.LeaAndroid || !window.LeaAndroid.listGalleryImages) return [];
  try {
    const raw = window.LeaAndroid.listGalleryImages(k);
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string" && x.startsWith("gallery:")) : [];
  } catch {
    return [];
  }
}

function extraPhotos(id) {
  const k = id || state.current || "lea";
  let list = [];
  try {
    const stored = JSON.parse(localStorage.getItem("lea.photos." + k) || "[]");
    if (Array.isArray(stored)) list = stored.slice();
  } catch (_) {}
  // Fusionner avec les fichiers encore sur le disque Android (récupération)
  const disk = diskGalleryKeys(k);
  for (const key of disk) {
    if (!list.includes(key)) list.push(key);
  }
  // Filtre : garder gallery: et data: valides — jamais les URL Horde http expirées
  const clean = list.filter((src) => {
    if (!src || typeof src !== "string") return false;
    if (src.startsWith("gallery:")) return true;
    if (src.startsWith("data:image")) return src.length > 200;
    if (src.startsWith("http")) return false;
    if (src.startsWith("file:")) return false;
    return false;
  });
  // Dédupliquer en gardant l'ordre
  const seen = new Set();
  const out = [];
  for (const s of clean) {
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out.slice(0, GALLERY_MAX);
}

function saveExtra(list, id) {
  const k = id || state.current || "lea";
  // Préférer les clés gallery: (légères) ; data URL en dernier recours
  const arr = (list || []).filter(Boolean);
  const keys = arr.filter((s) => String(s).startsWith("gallery:"));
  const datas = arr.filter((s) => String(s).startsWith("data:image"));
  const preferred = keys.concat(datas).slice(0, GALLERY_MAX);
  try {
    localStorage.setItem("lea.photos." + k, JSON.stringify(preferred));
  } catch (e) {
    // Quota : ne garder que les clés disque (très légères)
    try {
      localStorage.setItem("lea.photos." + k, JSON.stringify(keys.slice(0, GALLERY_MAX)));
    } catch (_) {
      try {
        localStorage.setItem("lea.photos." + k, JSON.stringify(keys.slice(0, 20)));
      } catch (__) {}
    }
  }
}

/** Compresse une image (url/data) en JPEG data URL léger pour la galerie. */
function compressToJpeg(src, maxW, quality) {
  maxW = maxW || 512;
  quality = quality || 0.72;
  return new Promise((resolve) => {
    if (!src) return resolve("");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const scale = Math.min(1, maxW / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", quality));
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

/** Persiste une image dans la galerie du personnage (disque Android si possible, sinon data URL). */
async function addToGallery(src, charId) {
  const cid = charId || state.current || "lea";
  let stored = src;
  try {
    // Toujours compresser puis écrire sur disque Android si possible (persistance)
    let dataUrl = src;
    if (!String(src).startsWith("data:image")) {
      dataUrl = await compressToJpeg(src, 768, 0.82);
    } else {
      dataUrl = await compressToJpeg(src, 768, 0.82);
    }
    if (window.LeaAndroid && window.LeaAndroid.saveGalleryImage && dataUrl && dataUrl.startsWith("data:")) {
      const key = window.LeaAndroid.saveGalleryImage(cid, dataUrl);
      if (key && key.startsWith("gallery:")) {
        stored = key;
      } else {
        stored = dataUrl; // fallback mémoire
      }
    } else if (dataUrl && dataUrl.startsWith("data:")) {
      stored = dataUrl;
    }
  } catch (e) {
    console.warn("addToGallery", e);
    stored = src;
  }
  // Ne jamais stocker une URL http Horde (expire)
  if (String(stored).startsWith("http")) {
    try {
      const dl = await compressToJpeg(stored, 768, 0.82);
      if (window.LeaAndroid && window.LeaAndroid.saveGalleryImage && dl.startsWith("data:")) {
        const key = window.LeaAndroid.saveGalleryImage(cid, dl);
        if (key && key.startsWith("gallery:")) stored = key;
        else stored = dl;
      } else if (dl.startsWith("data:")) {
        stored = dl;
      }
    } catch (_) {}
  }
  const list = extraPhotos(cid).filter((x) => x !== stored);
  list.unshift(stored);
  saveExtra(list, cid);
  // Première génération = cover auto (Découvrir / chat) si pas déjà choisie
  maybeAutoCover(cid, stored);
  return stored;
}

/** Résout une clé gallery: ou data URL pour affichage. */
function resolvePhotoSrc(src) {
  if (!src) return "";
  if (src.startsWith("gallery:") && window.LeaAndroid && window.LeaAndroid.loadGalleryImage) {
    try {
      const data = window.LeaAndroid.loadGalleryImage(src);
      return data || "";
    } catch {
      return "";
    }
  }
  return src;
}
function loadChat(id) {
  try { return JSON.parse(localStorage.getItem("lea.chat." + (id || "lea")) || "null"); } catch { return null; }
}

function chatPreview(chat) {
  const msgs = chat?.messages || [];
  if (!msgs.length) return "Nouvelle conversation";
  const last = msgs[msgs.length - 1];
  return String(last.content || "").replace(/\s+/g, " ").slice(0, 80);
}

function discoverCover(c) {
  return resolvedCover(c);
}

function shuffleList(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function filterDiscoverList(q) {
  const list = state.characters.length ? state.characters : [FALLBACK_LEA];
  const s = String(q || "").trim().toLowerCase();
  let out;
  if (!s) {
    // Affichage aléatoire à chaque ouverture / refresh Découvrir
    if (!state._discShuffle || state._discShuffle.length !== list.length) {
      state._discShuffle = shuffleList(list);
    }
    out = state._discShuffle;
  } else {
    out = list.filter((c) => {
      const blob = [
        c.name, c.title, c.body, c.ethnicity, c.appearance, c.looks_en, c.scenario, c.personality,
        ...(c.tags || []),
      ].join(" ").toLowerCase();
      const syn = (tok) => {
        const t = tok.toLowerCase();
        if (t === "blonde" || t === "blond") return /blond|platinum|cendr/.test(blob);
        if (t === "brune" || t === "brun") return /brun|châtain|chatain|brown hair|chestnut/.test(blob);
        if (t === "rousse" || t === "roux") return /roux|rousse|red hair|ginger|auburn|freckle|taches de rousseur/.test(blob);
        if (t === "cheveux noirs" || t === "noire") return /cheveux noirs|black hair/.test(blob);
        if (t === "gros seins" || t === "grosse poitrine") return /gros seins|généreuse|95d|100e|bonnet [def]|large|busty|voluptuous|heavy breast/.test(blob);
        if (t === "petits seins" || t === "petite poitrine") return /petits seins|bonnet [ab]|small breast|flat|mince.*sein|a-cup|b-cup|modest chest/.test(blob);
        if (t === "seins moyens") return /bonnet c|medium breast|seins moyens/.test(blob);
        if (t === "latine" || t === "latino") return /latin|brésil|bresil|espagnol|mexic|argentin|colomb/.test(blob);
        if (t === "voluptueuse") return /voluptueuse|curvy|sablier|généreuse|hourglass/.test(blob);
        return blob.includes(t);
      };
      return s.split(/\s+/).every((tok) => syn(tok));
    });
  }
  return out;
}

function renderDiscoverCards(list) {
  if (!list.length) {
    return `<p style="color:var(--muted);margin-top:24px;text-align:center">Aucun personnage pour « ${($("disc-search") && $("disc-search").value) || ""} ».</p>`;
  }
  return `<div class="grid">${list.map((c) => `
      <article class="card discover-card">
        <div class="cover-frame"><img class="cover-img" src="${discoverCover(c)}" alt="${c.name}" /></div>
        <div class="body">
          <strong>${c.name}</strong>
          <div style="color:var(--muted);font-size:13px">${c.age || ""} ans · ${c.title || ""}</div>
          <div class="tags">${[c.body, c.ethnicity].filter(Boolean).concat(c.tags || []).slice(0, 8).map((t) => `<span class="tag tag-filter" data-tag="${t}">${t}</span>`).join("")}</div>
          <p style="color:#d7c8dc;font-size:14px">${(c.scenario || "").slice(0, 140)}${(c.scenario || "").length > 140 ? "…" : ""}</p>
          <button class="cta start-chat" data-id="${c.id}">Discuter</button>
          <button class="cta open-profile" data-id="${c.id}" style="margin-left:8px;background:#3a2048">Profil</button>
        </div>
      </article>`).join("")}</div>`;
}

function renderDiscover() {
  const q0 = (state.discQuery || "");
  $("view-discover").innerHTML = `
    <h1>Découvrir</h1>
    <input class="field" id="disc-search" type="search" placeholder="Rechercher nom, tag, corps, ethnie…" value="${q0.replace(/"/g, "&quot;")}" style="margin:10px 0 6px;width:100%" />
    <div class="tags" id="disc-quick" style="margin-bottom:10px;flex-wrap:wrap">
      ${["aléatoire","belle-fille","belle-mère","belle-sœur","babysitter","amie","timide","nsfw",
        "blonde","brune","rousse","cheveux noirs",
        "gros seins","petits seins","seins moyens","95D",
        "mince","ronde","sablier","athlétique","voluptueuse",
        "française","maghrébine","asiatique","africaine","latine",
        "18","20","21","22"].map((t) =>
        `<span class="tag tag-filter" data-tag="${t}" style="cursor:pointer">${t}</span>`).join("")}
    </div>
    <p style="color:var(--muted);font-size:12px;margin-bottom:8px" id="disc-count"></p>
    <div id="disc-list"></div>`;
  const paint = () => {
    const q = ($("disc-search") && $("disc-search").value) || "";
    state.discQuery = q;
    const list = filterDiscoverList(q);
    if ($("disc-count")) $("disc-count").textContent = list.length + " personnage(s)";
    if ($("disc-list")) $("disc-list").innerHTML = renderDiscoverCards(list);
  };
  paint();
  if ($("disc-search")) {
    $("disc-search").oninput = paint;
    $("disc-search").focus();
  }
  $("view-discover").onclick = (e) => {
    const tag = e.target.closest(".tag-filter");
    if (tag && tag.dataset.tag) {
      if ($("disc-search")) {
        const t = tag.dataset.tag;
        if (t === "aléatoire") {
          state._discShuffle = null;
          $("disc-search").value = "";
          paint();
        } else {
          const cur = $("disc-search").value.trim();
          $("disc-search").value = cur && !cur.includes(t) ? (cur + " " + t) : t;
          paint();
        }
      }
      return;
    }
    const start = e.target.closest(".start-chat");
    const prof = e.target.closest(".open-profile");
    const card = e.target.closest(".discover-card");
    if (start) {
      state.current = start.dataset.id || "lea";
      state.chat = loadChat(state.current) || { messages: [], memories: [], summaries: [], relationship: { closeness: 1, trust: 1, heat: 0 } };
      show("chat"); renderChat();
      return;
    }
    if (prof) {
      state.current = prof.dataset.id || "lea";
      show("profile"); renderProfile();
      return;
    }
    // Clic sur la carte (photo / texte) → profil, PAS la conversation
    if (card) {
      const idBtn = card.querySelector(".open-profile, .start-chat");
      const id = (idBtn && idBtn.dataset.id) || "lea";
      state.current = id;
      show("profile");
      renderProfile();
    }
  };
}

function hasStartedChat(id) {
  const chat = loadChat(id);
  return !!(chat && Array.isArray(chat.messages) && chat.messages.length > 0);
}

function renderChats() {
  const all = state.characters.length ? state.characters : [FALLBACK_LEA];
  const list = all.filter((c) => hasStartedChat(c.id));
  $("view-chats").innerHTML = `
    <h1>Chats</h1>
    <p style="color:var(--muted);font-size:13px">Uniquement les conversations déjà commencées.</p>
    ${list.length
      ? list.map((c) => `
      <article class="card" style="margin-top:12px">
        <div class="body" style="display:flex;gap:12px;align-items:center">
          <img src="${resolvedCover(c)}" alt="" style="width:56px;height:56px;border-radius:14px;object-fit:cover;background:#1a1220" onerror="this.onerror=null;this.style.background=\'#2a1838\'" />
          <div style="flex:1;min-width:0">
            <strong>${c.name}</strong>
            <div style="color:var(--muted);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${chatPreview(loadChat(c.id))}</div>
          </div>
          <button class="cta resume-chat" data-id="${c.id}">Ouvrir</button>
        </div>
      </article>`).join("")
      : `<p style="color:var(--muted);margin-top:24px;text-align:center">Aucune conversation pour l’instant.<br/>Ouvre un personnage dans Découvrir pour commencer.</p>`}`;
  $("view-chats").onclick = (e) => {
    const b = e.target.closest(".resume-chat");
    if (!b) return;
    state.current = b.dataset.id || "lea";
    state.chat = loadChat(state.current) || { messages: [], memories: [], summaries: [], relationship: { closeness: 1, trust: 1, heat: 0 } };
    show("chat");
    renderChat();
  };
}


async function migrateGalleryToDisk(charId) {
  if (!window.LeaAndroid || !window.LeaAndroid.saveGalleryImage) return;
  const cid = charId || state.current || "lea";
  const list = extraPhotos(cid);
  let changed = false;
  const next = [];
  for (const src of list) {
    if (String(src).startsWith("data:image") && src.length > 500) {
      try {
        const key = window.LeaAndroid.saveGalleryImage(cid, src);
        if (key && key.startsWith("gallery:")) {
          next.push(key);
          changed = true;
          continue;
        }
      } catch (_) {}
    }
    next.push(src);
  }
  if (changed) saveExtra(next, cid);
}

function renderProfile() {
  const c = character();
  const extras = extraPhotos();
  const base = (c.gallery && c.gallery.length ? c.gallery : GALLERY.map((g) => g.src)).map((src, i) => ({ src, title: "Photo " + (i + 1) }));
  const genItems = extras.map((src, i) => {
    const resolved = resolvePhotoSrc(src);
    return { src: resolved || "", raw: src, title: "Générée " + (i + 1), gen: true, idx: i };
  }).filter((g) => g.src);
  const all = base.map((g) => ({ ...g, gen: false, raw: g.src })).concat(genItems);
  const hero = c.cover || (all[0] && all[0].src) || "";
  $("view-profile").innerHTML = `
    <h1>${c.name}</h1>
    <img class="profile-hero" src="${hero}" alt="${c.name}" data-full="${hero}" />
    <p style="margin:10px 0 8px">
      <button type="button" class="cta" id="prof-chat">💬 Discuter</button>
      <button type="button" class="cta" id="prof-newchat" style="margin-left:8px;background:#3a2048">🔄 Nouvelle conversation</button>
    </p>
    <p style="color:var(--muted);font-size:13px">Appuie sur ★ sous une photo pour en faire l’image de profil.</p>
    <p style="color:var(--muted)">${c.age || 18} ans · ${c.title || ""}</p>
    <div style="background:#1a1022;border-radius:12px;padding:12px;margin:10px 0;border:1px solid #3a2048">
      <div style="color:#e8b4d4;font-size:12px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Descriptif physique</div>
      <p style="margin:0 0 8px;line-height:1.45">${c.appearance || ""}</p>
      <p style="margin:0;color:#b9a8c4;font-size:13px;line-height:1.4">${c.body ? ("Morphologie : " + c.body) : ""}${c.ethnicity ? (" · " + c.ethnicity) : ""}${c.age ? (" · " + c.age + " ans") : ""}</p>
    </div>
    <p style="color:#d7c8dc;font-size:14px">${c.scenario || ""}</p>
    <p style="color:#a898b0;font-size:13px">${c.personality || ""}</p>
    <h3>Photos</h3>
    <div class="gallery">
      ${all.map((g) => {
        const key = g.raw || g.src;
        const isCover = customCover(c.id) === key || (!customCover(c.id) && g.src === c.cover);
        return `<div class="gal-item">
          <img src="${g.src}" alt="${g.title}" title="${g.title}" data-full="${g.src}" onerror="this.parentNode.style.display='none'" />
          <button type="button" class="gal-cover" data-cover="${String(key).replace(/"/g, "&quot;")}" title="Image de profil">${isCover ? "★" : "☆"}</button>
          ${g.gen ? `<button type="button" class="gal-del" data-del="${g.idx}" title="Supprimer">×</button>` : ""}
        </div>`;
      }).join("")}
    </div>
    <h3 style="margin-top:18px">Photo du scénario (tenue + lieu du personnage)</h3>
    <p style="color:var(--muted);font-size:13px">${c.id === 'lea' ? 'Toujours Léa orage : top court blanc MOUILLÉ + jean moulant + porte la nuit. Horde gratuit = visage variable. Tu peux supprimer les générées avec ×.' : ('Scénario de ' + c.name + ' · × pour supprimer une générée.')}</p>
    <textarea class="field" id="imgprompt" rows="2" placeholder="Optionnel : détail en plus (ex: elle frappe à la porte)"></textarea>
    <p id="prompt-preview" style="color:var(--muted);font-size:12px;margin-top:6px;max-height:4.5em;overflow:auto"></p>
    <label style="display:block;margin-top:10px">Moteur images</label>
    <select id="imgengine-profile">
      <option value="horde">Horde (gratuit NSFW · recommandé profil)</option>
      <option value="cloudflare">Cloudflare FLUX (gratuit ~150–230/j · SFW/léger)</option>
      <option value="sd_cpp">SD.cpp (local)</option>
    </select>
    <p style="margin-top:8px">
      <button class="cta" id="genimg">Générer (aléatoire)</button>
      <!-- Local Dream retiré à la demande utilisateur -->
      <button class="cta" id="dl-sdcpp2" type="button" style="margin-left:8px;background:#2a3a48">Pack SD.cpp</button>
    </p>
    <p class="err" id="imgerr"></p>`;
  const goChat = (reset) => {
    state.current = c.id;
    if (reset) {
      state.chat = { messages: [], memories: [], summaries: [], relationship: { closeness: 1, trust: 1, heat: 0 }, scene: {}, vault: { entries: [] } };
      try { localStorage.removeItem(chatKey(c.id)); } catch (_) {}
      saveChatLocal();
    } else {
      state.chat = loadChat(c.id) || { messages: [], memories: [], summaries: [], relationship: { closeness: 1, trust: 1, heat: 0 } };
    }
    show("chat");
    renderChat();
  };
  if ($("prof-chat")) $("prof-chat").onclick = () => goChat(false);
  if ($("prof-newchat")) $("prof-newchat").onclick = () => {
    if (confirm("Recommencer une nouvelle conversation avec " + c.name + " ? L'historique local sera effacé.")) goChat(true);
  };
  $("view-profile").onclick = (e) => {
    const del = e.target.getAttribute("data-del");
    if (del != null) {
      e.stopPropagation();
      const list = extraPhotos();
      const i = Number(del);
      if (i >= 0 && i < list.length) {
        const removed = list.splice(i, 1)[0];
        if (removed && String(removed).startsWith("gallery:") && window.LeaAndroid && window.LeaAndroid.deleteGalleryImage) {
          try { window.LeaAndroid.deleteGalleryImage(removed); } catch (_) {}
        }
        if (customCover(c.id) === removed) setCustomCover(c.id, "");
        saveExtra(list);
        renderProfile();
      }
      return;
    }
    const cov = e.target.getAttribute("data-cover");
    if (cov != null) {
      e.stopPropagation();
      setCustomCover(c.id, cov);
      setGenStatus("Image de profil mise à jour");
      renderProfile();
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
  migrateGalleryToDisk(state.current).catch(() => {});
  const refreshPreview = () => {
    if (!$("prompt-preview")) return;
    try {
      const extra = ($("imgprompt") && $("imgprompt").value || "").trim();
      const pr = buildLeaImagePrompt(extra);
      $("prompt-preview").textContent = "Prompt : " + pr.slice(0, 280) + (pr.length > 280 ? "…" : "");
    } catch (e) {
      $("prompt-preview").textContent = "";
    }
  };
  if ($("imgprompt")) $("imgprompt").oninput = refreshPreview;
  refreshPreview();

  if ($("open-ld")) $("open-ld").onclick = () => {
    if (!window.LeaAndroid || !window.LeaAndroid.openLocalDream) {
      setGenStatus("Ouvre Local Dream manuellement (Play Store : io.github.xororz.localdream).");
      return;
    }
    try {
      const r = JSON.parse(window.LeaAndroid.openLocalDream() || "{}");
      setGenStatus(r.action === "launch" ? "Local Dream ouvert" : "Installation Local Dream…");
    } catch (e) {
      setGenStatus(String(e.message || e));
    }
  };
  if ($("dl-sdcpp2")) $("dl-sdcpp2").onclick = () => {
    if (!window.LeaAndroid) {
      setGenStatus("Pas de pont natif (ouvre l'app Android, pas le navigateur).");
      return;
    }
    const dlFn = window.LeaAndroid.downloadSdCppModel || window.LeaAndroid.downloadSdModel || window.LeaAndroid.downloadPack;
    if (!dlFn) {
      setGenStatus("APK trop vieux : rebuild requis. Méthodes DL absentes du pont natif.");
      return;
    }
    try {
      const info = window.LeaAndroid.bridgeInfo ? JSON.parse(window.LeaAndroid.bridgeInfo()) : {};
      setGenStatus("Démarrage DL… modèle actuel: " + (info.sdModel || "aucun"));
    } catch (_) {}
    setGenStatus(dlFn.call(window.LeaAndroid, ""));
    const tick = setInterval(() => {
      try {
        const st = window.LeaAndroid.downloadStatus();
        setGenStatus(st || "téléchargement…");
        if (st && /Modèle OK|modèle OK|prêt/i.test(st)) {
          try { if (window.LeaAndroid.sdCppPreload) window.LeaAndroid.sdCppPreload(); } catch (_) {}
        }
      } catch (e) {
        setGenStatus("poll: " + e);
      }
    }, 800);
    setTimeout(() => clearInterval(tick), 60 * 60 * 1000);
  };
}

function setGenStatus(t) {
  if ($("imgerr")) $("imgerr").textContent = t;
}

function bodyNegatives(c) {
  const id = (c && c.id) || "";
  const blob = [
    c && c.body, c && c.appearance, c && c.looks_en, c && c.ethnicity
  ].filter(Boolean).join(" ").toLowerCase();
  const base = "child, teen, underage, middle-aged, elderly, 35 years old, 40 years old, wrong ethnicity, deformed, extra limbs, different face, different person";
  let neg = base;

  // Petite / plate poitrine
  const smallChest = /petit(s)?\s*seins|flat|a-cup|bonnet\s*a|nearly flat|très petits|petits seins|small breast|slim.*chest|not busty|poitrine\s*petite|seins\s*moyens?\s*b\b|bonnet\s*b/i.test(blob)
    || /^(jade|aya|lina|hana|mei|sasha|thea|zoe|chloe|marine|noemie)$/.test(id);
  // Grosse poitrine
  const hugeChest = /gros\s*seins|généreuse|95d|100e|bonnet\s*[def]|large\s*(full\s*)?(d|e|f)-cup|extremely large|busty|voluptuous|poitrine\s*généreuse/i.test(blob)
    || /^(sofia|amelie|fatou|elise|olga|yasmine|priya|myriam|keisha|lea|lucia)$/.test(id);
  // Gros fessier
  const bigButt = /gros(se)?\s*fess|fessier|round butt|thick\s*(round\s*)?butt|brazilian butt|huge\s*round\s*butt|fesses\s*rondes|very round butt|thick hips/i.test(blob)
    || /^(bruna|camila|keisha|fatou)$/.test(id);
  // Fine / athlétique
  const thin = /mince|slim|thin|athlétique|athletic|fine\b|élancée/i.test(blob);
  // Ronde / plus-size
  const chubby = /chubby|plus-size|ronde|pulpeuse|soft belly|gros ventre/i.test(blob)
    || /^(amelie|olga|viola)$/.test(id);

  if (smallChest) {
    neg += ", large breasts, huge breasts, heavy breasts, massive breasts, busty, voluptuous, deep cleavage, 95D, 100E, F-cup, DD-cup, curvy hourglass bust, enhanced breasts, implants";
  }
  if (hugeChest) {
    neg += ", flat chest, small breasts, A-cup, nearly flat, boyish chest, skinny torso";
  }
  if (bigButt) {
    neg += ", flat butt, skinny hips, boyish hips, no curves, thin flat backside";
  }
  if (!bigButt && thin && !hugeChest) {
    neg += ", extremely wide hips, exaggerated pear shape";
  }
  if (chubby) {
    neg += ", skinny, model thin, flat stomach athletic, underweight";
  } else if (thin) {
    neg += ", plus-size, obese, heavy belly";
  }

  if (id === "jade") {
    neg += ", no glasses, missing glasses, long loose wavy hair past shoulders, glamorous makeup, mature woman, soccer mom, C-cup, D-cup";
  }
  if (id === "chloe") {
    neg += ", mature face, wrinkles, no freckles, brown hair, black hair, MILF";
  }
  if (id === "lea") {
    neg += ", black hair, blonde hair, dry hair when wet scene, middle-aged, wrong face, mature woman, 30 year old, 35 year old, glamorous heavy makeup, smoky eyes, hollywood wavy hair, salon blowout waves, different person, celebrity lookalike, plastic surgery face";
  }
  if (id === "zoe" || id === "zoe_bs") {
    neg += ", brown hair, auburn hair, redhead, blonde, bangs fringe, large breasts, D-cup, E-cup, busty, curvy thick, tanned skin, warm skin, denim only casual, not goth";
  }
  // Cheveux noirs génériques
  if (/cheveux noirs|black hair/i.test(blob)) {
    neg += ", blonde hair, brown auburn hair, red hair, ginger";
  }
  if (/peau très pâle|very pale|porcelain/i.test(blob)) {
    neg += ", tanned skin, olive skin, dark tan, sunburned";
  }
  if (id === "mei" || id === "hana" || id === "lina") {
    neg += ", western european features only, blonde hair";
  }
  if (id === "bruna" || id === "camila") {
    neg += ", flat butt, skinny legs, no hip curve, small flat backside";
  }
  neg += ", " + ageNegatives(c);
  return neg;
}

/** Poids morphologie pour Horde (petite poitrine / gros fessier). */
function morphWeights(c) {
  if (!c) return "";
  const id = c.id || "";
  const blob = [c.body, c.appearance, c.looks_en].filter(Boolean).join(" ").toLowerCase();
  const parts = [];
  if (/petit(s)?\s*seins|flat|a-cup|bonnet\s*a|nearly flat|très petits|small breast|poitrine\s*petite/i.test(blob)
      || /^(jade|aya|lina|hana|mei|sasha|thea|zoe)$/.test(id)) {
    parts.push("(very small flat A-cup breasts:1.35)", "(petite chest:1.2)", "slim upper body");
  } else if (/bonnet\s*b|small-medium b|seins\s*moyens?\s*b|modest chest/i.test(blob)
      || /^(chloe|marine|noemie|thea)$/.test(id)) {
    parts.push("(small-medium B-cup breasts:1.25)", "modest chest, NOT large");
  }
  if (/gros(se)?\s*fess|fessier|round butt|thick\s*butt|brazilian|fesses\s*rondes|huge\s*round\s*butt/i.test(blob)
      || /^(bruna|camila|keisha|fatou)$/.test(id)) {
    parts.push("(very large round thick butt:1.4)", "(wide hips:1.25)", "emphasize rear curves");
  }
  if (/95d|100e|généreuse|gros\s*seins|bonnet\s*[def]|extremely large/i.test(blob)
      || /^(sofia|lea|fatou|amelie)$/.test(id)) {
    parts.push("(large full breasts:1.3)");
  }
  return parts.join(", ");
}

/** Traits OBLIGATOIRES par personnage (répétés dans le prompt). */
/** Apparence 100% FIXE — seul change en scène : pose / tenue / lieu. */
function fixedAppearanceBlock(c) {
  if (!c) return "";
  const age = Number(c.age) || 21;
  const name = c.name || "the woman";
  const looks = describeLooks(c);
  const body = String(c.body || "").trim();
  const eth = String(c.ethnicity || "").trim();
  return [
    "=== FIXED CHARACTER APPEARANCE (MUST NOT CHANGE) ===",
    "Person: " + name + ",",
    identityLock(c) + ",",
    looks + ",",
    morphWeights(c) + ",",
    body ? ("morphology: " + body + ",") : "",
    eth ? ("ethnicity: " + eth + ",") : "",
    "(" + age + " year old:1.45), (looks exactly " + age + ":1.4),",
    "IDENTICAL face, hair color, hair style, eye color, skin tone, breast size, body type in EVERY image,",
    "same person as cover photo and profile, consistent identity lock,",
    "=== END FIXED APPEARANCE — only pose, outfit, posture, environment may change below ===",
  ].filter(Boolean).join(" ");
}

function ageNegatives(c) {
  const age = Number(c && c.age) || 21;
  let n = "different face, different person, wrong age";
  if (age <= 22) {
    n += ", middle-aged, 30 years old, 35 years old, 40 years old, mature face, wrinkles, crow feet, heavy glamorous makeup, soccer mom, MILF face";
  } else if (age <= 35) {
    n += ", elderly, 50 years old, teenage underage look";
  } else {
    n += ", teenage, underage, child face";
  }
  return n;
}

function identityLock(c) {
  if (!c) return "";
  const age = Number(c.age) || 21;
  const name = c.name || "the woman";
  const looks = describeLooks(c);
  const mw = morphWeights(c);
  const locks = {
    jade: "MUST wear round eyeglasses, brown hair in a neat bun, freckles, very small flat A-cup, slim student",
    mei: "Chinese woman, thin, nearly flat A-cup, long dark hair ponytail, slender",
    hana: "petite Japanese, short black bob, flat A-cup, pale",
    lina: "petite Korean, very small flat chest, slim",
    aya: "athletic mixed-race, small firm A-B cup, caramel skin, pigtails or afro texture",
    chloe: "honey blonde hair, green eyes, freckles on nose and cheeks, small-medium B-cup, slim petite youthful face",
    sofia: "Italian olive skin, chestnut hair, extremely large 100E breasts, tiny waist",
    lea: "SAME face as Léa gallery refs, long STRAIGHT dark brown hair to lower back NOT wavy, brown eyes, fair pale skin, soft oval youthful face, natural light makeup, large 95D breasts hourglass",
    ines: "Algerian, golden tan, long wavy black hair, hazel eyes, medium C-cup, wide hips",
    nina: "Slavic, platinum blonde long hair, grey eyes, very pale, tall, medium C-cup",
    bruna: "Brazilian, TINY waist, HUGE round butt, medium C-cup",
    camila: "slim waist, THICK round butt, medium breasts",
    keisha: "dark skin, large breasts, very round butt",
  };
  const specific = locks[c.id] || "";
  const ageLock = [
    "(" + age + " year old woman:1.4)",
    "(looks exactly " + age + " years old:1.35)",
    "youthful face appropriate for age " + age,
    age <= 25
      ? "young soft skin, no wrinkles, not middle-aged, not 30, not 35, not mature woman"
      : age <= 35
      ? "looks " + age + " not older, not elderly"
      : "mature adult looks " + age + " not teenage",
  ].join(", ");
  return [
    "identity of " + name + ",",
    specific,
    looks,
    mw,
    ageLock,
    "SAME face every image, consistent facial features, same person as character profile and cover",
  ].filter(Boolean).join(", ");
}

async function imageToBase64(src) {
  if (!src) return null;
  const strip = (dataUrl) => {
    const s = String(dataUrl || "");
    const i = s.indexOf(",");
    return i >= 0 ? s.slice(i + 1) : s;
  };
  // Gallery key already on disk
  if (String(src).startsWith("gallery:")) {
    const data = resolvePhotoSrc(src);
    if (data && data.startsWith("data:")) return strip(data);
  }
  const candidates = [];
  candidates.push(src);
  try { candidates.push(new URL(src, location.href).href); } catch (_) {}
  if (!/^https?:|data:|file:/i.test(src)) {
    candidates.push("file:///android_asset/www/" + String(src).replace(/^\/+/, ""));
    candidates.push("https://appassets.androidplatform.net/assets/www/" + String(src).replace(/^\/+/, ""));
  }
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!blob || blob.size < 500) continue;
      const dataUrl = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result || ""));
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
      if (dataUrl && dataUrl.indexOf("base64") >= 0) return strip(dataUrl);
    } catch (_) {}
  }
  // Canvas fallback (souvent OK en WebView pour assets locaux)
  try {
    const dataUrl = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth || img.width;
          c.height = img.naturalHeight || img.height;
          if (c.width < 8 || c.height < 8) return resolve("");
          c.getContext("2d").drawImage(img, 0, 0);
          resolve(c.toDataURL("image/jpeg", 0.9));
        } catch (_) { resolve(""); }
      };
      img.onerror = () => resolve("");
      img.src = src;
    });
    if (dataUrl && dataUrl.indexOf("base64") >= 0) return strip(dataUrl);
  } catch (_) {}
  return null;
}

function sdCleanNote(note, i) {
  const n = String(note || "");
  if (!n || /hires|upscaler|custom_sigmas|model_path|denois/i.test(n)) {
    return "calcul en cours… (" + (i || "") + ")";
  }
  return n.length > 90 ? n.slice(0, 90) + "…" : n;
}

function currentImageEngine() {
  let eng = "horde";
  if ($("imgengine-profile") && $("imgengine-profile").value) {
    eng = $("imgengine-profile").value;
  } else if ($("imgengine") && $("imgengine").value) {
    eng = $("imgengine").value;
  } else {
    try {
      eng = JSON.parse(localStorage.getItem("lea.settings") || "{}").imageEngine || "horde";
    } catch {
      eng = "horde";
    }
  }
  // Local Dream désactivé à la demande — bascule Horde
  if (eng === "local_dream") eng = "horde";
  return eng || "horde";
}

/** Poll sd.cpp jusqu'à image ou erreur. */

/** Horde forcé après échec/timeout SD.cpp (même prompt profil). */
async function generatePhotoHordeFallback(prompt, c) {
  c = c || character();
  window._leaGenBusy = true;
  setGenStatus("Horde (secours) · même prompt profil…");
  try {
    const payload = { prompt, negative: bodyNegatives(c), nsfw: true };
    if (c.id === "lea") {
      payload.negative = (payload.negative || "") + ", dry clothes, dry hair, fully dry";
    }
    const start = await api("/api/image", { method: "POST", body: JSON.stringify(payload) });
    if (!start.jobId) throw new Error("Pas de job Horde");
    setGenStatus("Horde job lancé (après échec SD.cpp)…");
    pollHordeJob(start.jobId, start.host, c.id);
  } catch (e) {
    window._leaGenBusy = false;
    setGenStatus("Horde secours: " + (e.message || e));
  }
}

async function pollSdCppJob(charId) {
  const cid = charId || state.current || "lea";
  for (let i = 0; i < 480; i++) { // ~16 min
    await new Promise((r) => setTimeout(r, 2000));
    let data = {};
    try {
      data = JSON.parse((window.LeaAndroid && window.LeaAndroid.sdCppPoll && window.LeaAndroid.sdCppPoll()) || "{}");
    } catch (_) { data = {}; }
    if (data.pending) {
      const note = data.note || ("sd.cpp… " + (i + 1));
      setGenStatus(sdCleanNote(note, i + 1));
      continue;
    }
    window._leaGenBusy = false;
    if (data.error) {
      setGenStatus("SD.cpp échec → Horde auto…\n" + data.error);
      try {
        const c = (state.characters || []).find((x) => x.id === cid) || character();
        const extra = ($("imgprompt") && $("imgprompt").value || "").trim();
        const prompt = buildLeaImagePrompt(extra);
        await generatePhotoHordeFallback(prompt, c);
      } catch (e) {
        setGenStatus("Horde fallback: " + (e.message || e));
      }
      return;
    }
    if (data.url) {
      const stored = await addToGallery(data.url, cid);
      setGenStatus("Image SD.cpp ajoutée à la galerie");
      if (state.view === "profile" && state.current === cid) renderProfile();
      openFull(resolvePhotoSrc(stored) || stored);
      return;
    }
    if (data.done) {
      setGenStatus("SD.cpp terminé sans image");
      return;
    }
  }
  window._leaGenBusy = false;
  setGenStatus("SD.cpp timeout (~16 min). Le 1er chargement modèle peut dépasser 10 min — réessaie ou Horde.");
}

function selectedImageEngineRaw() {
  if ($("imgengine-profile") && $("imgengine-profile").value) return $("imgengine-profile").value;
  if ($("imgengine") && $("imgengine").value) return $("imgengine").value;
  try {
    return JSON.parse(localStorage.getItem("lea.settings") || "{}").imageEngine || "horde";
  } catch {
    return "horde";
  }
}

function showPromptStatus(label, prompt) {
  const short = String(prompt || "").replace(/\s+/g, " ").slice(0, 120);
  setGenStatus(label + (short ? "\nPrompt : " + short + (prompt.length > 120 ? "…" : "") : ""));
}

async function pollLocalDreamJob(charId, prompt) {
  const cid = charId || state.current || "lea";
  for (let i = 0; i < 150; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    let data = {};
    try {
      data = JSON.parse(window.LeaAndroid.localDreamStatus() || "{}");
    } catch {
      data = {};
    }
    if (data.pending) {
      setGenStatus(data.note || ("Local Dream… " + (i + 1)));
      continue;
    }
    window._leaGenBusy = false;
    if (data.error) {
      setGenStatus(data.error);
      if (window.LeaAndroid.copyText && prompt) {
        try { window.LeaAndroid.copyText(prompt); } catch (_) {}
      }
      return;
    }
    if (data.url) {
      const stored = await addToGallery(data.url, cid);
      setGenStatus("Image Local Dream prête");
      if (state.view === "profile" && state.current === cid) renderProfile();
      if (state.current === cid) openFull(resolvePhotoSrc(stored) || stored);
    }
    return;
  }
  window._leaGenBusy = false;
  setGenStatus("Local Dream timeout");
}


/** Génération d'aperçu de scène DANS le chat (arrière-plan, dialogue libre). */
async function generateScenePhoto() {
  try {
    if (window._leaSceneBusy) {
      const since = window._leaSceneBusySince || 0;
      if (Date.now() - since < 10 * 60 * 1000) {
        setSceneProgress("⏳ Génération déjà en cours…", 30);
        return;
      }
      window._leaSceneBusy = false;
    }
    window._leaSceneBusy = true;
    window._leaSceneBusySince = Date.now();

    const c = character();
    let prompt = "";
    try {
      prompt = buildSceneImagePrompt();
    } catch (e) {
      prompt = "photorealistic photo of " + (c.name || "woman") + ", " + describeLooks(c) + ", indoor scene";
      console.warn("buildSceneImagePrompt", e);
    }
    if (!prompt || prompt.length < 20) {
      prompt = "photorealistic photo of adult woman, " + (c.appearance || c.name || "") + ", detailed face";
    }
    console.log("[lea scene prompt]", prompt.slice(0, 300));

    const sc = (state.chat && state.chat.scene) || {};
    setSceneProgress(
      "📷 Préparation · " + (sc.place || "scène") + " · " + (sc.outfit || sc.body || "tenue") + "…",
      8
    );

    if (!state.chat) state.chat = { messages: [], memories: [], scene: {}, relationship: {} };
    if (!Array.isArray(state.chat.messages)) state.chat.messages = [];
    const pendingId = "scene-" + Date.now();
    state.chat.messages.push({
      role: "assistant",
      content: "📷 Génération de l'aperçu de la scène…",
      pendingScene: true,
      pendingId,
      ts: Date.now(),
    });
    saveChatLocal();
    paintMessages();

    // Horde scène + img2img depuis refs (même visage que les photos Grok / profil)
    const payload = {
      prompt,
      negative: bodyNegatives(c) +
        ", child, teen, underage, cartoon, anime, deformed, blurry, watermark, text, wrong body type, empty white background, different face, different person, wrong hair color, middle-aged, " +
        (String(prompt).match(/SOAKING WET|crop top|top court|wearing|jean|dress|towel|NOT nude|clinging/i)
          ? "completely nude, fully naked, bare breasts, exposed nipples, topless, no clothes, nude standing, glamorous different face"
          : ""),
      nsfw: true,
    };

    // Référence visage : Léa = photos orage/feu ; autres = cover / 1ère photo générée
    setSceneProgress("🖼 Chargement référence visage…", 10);
    try {
      let ref = null;
      if (c.id === "lea") {
        const refs = [
          "images/lea-orage.jpg",
          "images/lea-orage-timide.jpg",
          "images/lea-orage-dentelle.jpg",
          "images/lea-feu.jpg",
          "images/lea-portrait.jpg",
        ];
        for (const r of refs) {
          ref = await imageToBase64(r);
          if (ref && ref.length > 800) break;
          ref = null;
        }
      }
      if (!ref) {
        // Cover custom (étoile) ou cover cast
        const cover = resolvedCover(c);
        if (cover) {
          ref = await imageToBase64(cover);
          if (ref && ref.length < 800) ref = null;
        }
      }
      if (!ref) {
        try {
          const extras = extraPhotos(c.id);
          if (extras && extras[0]) {
            ref = await imageToBase64(extras[0]);
            if (ref && ref.length < 800) ref = null;
          }
        } catch (_) {}
      }
      if (ref) {
        payload.source_image = ref;
        payload.source_processing = "img2img";
        // Denoising HAUT pour scènes : sinon pose/tenue/lieu restent identiques à la ref
        // 0.62–0.72 = change posture + vêtements + décor, garde un air de visage
        // Tenue proche de la ref orage → denoise bas pour garder visage + top trempé
        // Denoise bas = visage/morphologie collés à la ref ; un peu plus haut seulement si scène très différente
        const bigChange = /missionnaire|doggy|nude|levrette|orgasme/i.test(prompt);
        payload.denoising = bigChange ? 0.48 : 0.38;
        payload.seed = Math.floor(Math.random() * 2_000_000_000);
        setSceneProgress("📡 Horde img2img denoise " + payload.denoising + "…", 14);
      } else {
        setSceneProgress("📡 Horde txt2img scène…", 12);
      }
    } catch (e) {
      setSceneProgress("📡 Horde (ref échouée)…", 12);
    }

    let start;
    try {
      start = await api("/api/image", { method: "POST", body: JSON.stringify(payload) });
    } catch (e) {
      throw new Error("Envoi Horde échoué : " + (e.message || e));
    }
    if (!start || !start.jobId) {
      throw new Error("Pas de job Horde — " + JSON.stringify(start || {}).slice(0, 140));
    }
    setSceneProgress("⏳ File Horde · job " + String(start.jobId).slice(0, 8) + "…", 18);

    for (let i = 0; i < 200; i++) {
      await new Promise((r) => setTimeout(r, 3500));
      let st = {};
      try {
        st = await api("/api/image-status", {
          method: "POST",
          body: JSON.stringify({ jobId: start.jobId, host: start.host }),
        });
      } catch (e) {
        setSceneProgress("⏳ Status… " + (e.message || "réseau") + " (" + (i + 1) + ")", 20 + Math.min(50, i));
        continue;
      }
      if (!st.done) {
        const q = st.queue != null ? st.queue : st.queue_position;
        const w = st.wait != null ? st.wait : st.wait_time;
        const pct = 20 + Math.min(70, i * 0.8 + (st.processing ? 10 : 0));
        setSceneProgress(
          "⏳ Horde " +
            (st.processing ? "calcul" : "file") +
            (q != null ? " · pos " + q : "") +
            (w != null ? " · ~" + w + "s" : "") +
            " (" + (i + 1) + ")",
          pct
        );
        continue;
      }
      if (st.error) throw new Error(st.error);
      if (st.url) {
        setSceneProgress("✅ Image reçue — enregistrement…", 92);
        await finishSceneImage(st.url, c.id, pendingId, "Horde");
        setSceneProgress("✅ Scène prête", 100);
        setTimeout(() => setSceneProgress("", 0), 2500);
        return;
      }
      throw new Error("Horde terminé sans image");
    }
    throw new Error("Timeout Horde (~12 min)");
  } catch (e) {
    window._leaSceneBusy = false;
    const msg = String(e && e.message ? e.message : e);
    setSceneProgress("❌ " + msg, 0);
    try {
      const msgs = (state.chat && state.chat.messages) || [];
      const pendingId = msgs.filter((m) => m.pendingScene).slice(-1)[0];
      if (pendingId && pendingId.pendingId) {
        const ix = msgs.findIndex((m) => m.pendingId === pendingId.pendingId);
        if (ix >= 0) {
          msgs[ix] = { role: "assistant", content: "Impossible de générer la scène : " + msg, ts: Date.now() };
          saveChatLocal();
          if (state.view === "chat") paintMessages();
        }
      }
    } catch (_) {}
    console.error("generateScenePhoto", e);
  }
}


async function pollSceneLocalDream(charId, pendingId, prompt) {
  for (let i = 0; i < 150; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    let data = {};
    try { data = JSON.parse(window.LeaAndroid.localDreamStatus() || "{}"); } catch (_) {}
    if (data.pending) {
      if (i % 5 === 0) toastScene("Local Dream scène… " + (data.note || i));
      continue;
    }
    if (data.url) {
      await finishSceneImage(data.url, charId, pendingId, "Local Dream");
      return;
    }
    if (data.error) throw new Error(data.error);
  }
  throw new Error("Local Dream timeout");
}

async function finishSceneImage(url, charId, pendingId, engineLabel) {
  const stored = await addToGallery(url, charId || state.current);
  const src = resolvePhotoSrc(stored) || stored || url;
  const msgs = (state.chat && state.chat.messages) || [];
  const ix = msgs.findIndex((m) => m.pendingId === pendingId);
  const sc = (state.chat && state.chat.scene) || {};
  const caption = "Aperçu scène · " + (sc.place || "lieu?") + " · " + (sc.outfitDetail || sc.outfit || "tenue?").toString().slice(0, 55) + " · [" + (sc.outfitSource || "?") + "] · " + (sc.poseDetail || sc.pose || "").toString().slice(0, 40) + " · " + (engineLabel || "");
  const msg = {
    role: "assistant",
    content: caption,
    image: stored || src,
    ts: Date.now(),
  };
  // Toujours en bas de conversation : retire le pending puis push à la fin
  if (ix >= 0) msgs.splice(ix, 1);
  msgs.push(msg);
  window._leaSceneBusy = false;
  saveChatLocal();
  toastScene("Scène prête — en bas de la conversation");
  if (state.view === "chat" && state.current === (charId || state.current)) {
    paintMessages();
    const stickBottom = () => {
      const box = $("msgs");
      if (!box) return;
      box.scrollTop = box.scrollHeight + 9999;
    };
    stickBottom();
    requestAnimationFrame(() => {
      stickBottom();
      setTimeout(stickBottom, 50);
      setTimeout(stickBottom, 200);
      setTimeout(stickBottom, 600); // après chargement image
    });
  }
}

function saveChatLocal() {
  try {
    const id = state.current || "lea";
    localStorage.setItem("lea.chat." + id, JSON.stringify(state.chat || {}));
  } catch (_) {}
}

/** Progression scène : barre fixe AU-DESSUS du composer (ne cache ni texte ni boutons). */
function setSceneProgress(msg, pct) {
  let bar = document.getElementById("scene-progress");
  if (!bar) {
    // créer si le chat n'a pas encore le slot
    const composer = document.querySelector(".composer");
    if (composer && composer.parentNode) {
      bar = document.createElement("div");
      bar.id = "scene-progress";
      bar.className = "scene-progress";
      composer.parentNode.insertBefore(bar, composer);
    }
  }
  if (!bar) return;
  const text = String(msg || "");
  if (!text) {
    bar.classList.add("hidden");
    bar.innerHTML = "";
    return;
  }
  bar.classList.remove("hidden");
  const p = Math.max(0, Math.min(100, pct == null ? 5 : pct));
  bar.innerHTML =
    '<div class="scene-progress-label">' + text.replace(/</g, "&lt;") + "</div>" +
    '<div class="scene-progress-track"><div class="scene-progress-fill" style="width:' + p + '%"></div></div>';
}

function toastScene(msg) {
  setSceneProgress(msg, null);
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
  const engine = currentImageEngine();
  // mémoriser le choix du profil
  try {
    const st = JSON.parse(localStorage.getItem("lea.settings") || "{}");
    st.imageEngine = engine;
    localStorage.setItem("lea.settings", JSON.stringify(st));
  } catch (_) {}
  showPromptStatus("Moteur : " + engine + " · préparation…", prompt);
  try {
    // —— Cloudflare Workers AI (FLUX Schnell, quota gratuit journalier) ——
    if (engine === "cloudflare") {
      setGenStatus("Cloudflare FLUX…");
      try {
        const dataUrl = await generateCloudflareImage(prompt, bodyNegatives(c), 512, 768);
        const stored = await addToGallery(dataUrl, c.id);
        setGenStatus("Image Cloudflare prête");
        window._leaGenBusy = false;
        if (state.view === "profile") renderProfile();
        // Reste sur le profil : n'ouvre PAS la conversation
        if (state.view === "profile") {
          renderProfile();
        } else if (state.view !== "chat") {
          openFull(resolvePhotoSrc(stored) || stored);
        } else {
          // déjà en chat : ne change pas de vue, juste galerie
        }
        return;
      } catch (e) {
        setGenStatus("Cloudflare: " + (e.message || e) + " → bascule Horde…");
        // continue to Horde below by forcing engine path
      }
    }
    // —— Local Dream (API 127.0.0.1:8081) ——
    if (engine === "local_dream") {
      if (!window.LeaAndroid || !window.LeaAndroid.localDreamGenerate) {
        setGenStatus("Pont natif manquant — rebuild APK.");
        window._leaGenBusy = false;
        return;
      }
      // Auto-ouvrir Local Dream si API fermée
      try {
        const probe = JSON.parse(window.LeaAndroid.localDreamProbe() || "{}");
        if (!probe.ok) {
          if (window.LeaAndroid.openLocalDream) {
            try { window.LeaAndroid.openLocalDream(); } catch (_) {}
          }
          if (window.LeaAndroid.copyText) try { window.LeaAndroid.copyText(prompt); } catch (_) {}
          setGenStatus(
            "LOCAL DREAM requis (seul vrai moteur local stable)\n" +
            "1) Installe Local Dream (bouton ou Play Store)\n" +
            "2) Ouvre-le et CHARGE un modèle SD1.5\n" +
            "3) Reste sur l'écran Générer (API :8081 active)\n" +
            "4) Reviens dans Léa Studio → Générer\n" +
            "Prompt copié. SD.cpp ne fonctionne pas sur la plupart des téléphones."
          );
          window._leaGenBusy = false;
          return;
        }
      } catch (_) {}
      const neg = bodyNegatives(c) + ", cartoon, anime, deformed, child, underage, blurry, watermark";
      const ldPayload = JSON.stringify({
        prompt: String(prompt).slice(0, 1800),
        negative: String(neg).slice(0, 500),
        charId: c.id || "lea",
        size: 512,
        steps: 20,
        cfg: 7,
      });
      showPromptStatus("Local Dream · physique + scénario…", prompt);
      const raw = window.LeaAndroid.localDreamGenerate(ldPayload);
      let data = {};
      try { data = typeof raw === "string" ? JSON.parse(raw) : (raw || {}); } catch (_) { data = { error: String(raw) }; }
      if (data && data.url) {
        const stored = await addToGallery(data.url, c.id);
        setGenStatus("Image Local Dream prête");
        window._leaGenBusy = false;
        if (state.view === "profile") renderProfile();
        // Reste sur le profil : n'ouvre PAS la conversation
        if (state.view === "profile") {
          renderProfile();
        } else if (state.view !== "chat") {
          openFull(resolvePhotoSrc(stored) || stored);
        } else {
          // déjà en chat : ne change pas de vue, juste galerie
        }
        return;
      }
      if (data && data.pending) {
        pollLocalDreamJob(c.id, prompt);
        return;
      }
      if (data && data.error) {
        setGenStatus("Local Dream : " + data.error + "\n→ Ou bascule sur Horde.");
        window._leaGenBusy = false;
        return;
      }
      setGenStatus((data && data.error) || "Local Dream indisponible");
      window._leaGenBusy = false;
      return;
    }

    // —— SD.cpp local (prompt physique + tenue scénario complets) ——
    if (engine === "sd_cpp" || selectedImageEngineRaw() === "sd_cpp") {
      if (!window.LeaAndroid || !window.LeaAndroid.sdCppGenerate) {
        setGenStatus("Pont SD.cpp manquant — rebuild APK.");
        window._leaGenBusy = false;
        return;
      }
      try {
        const st = JSON.parse(window.LeaAndroid.sdCppStatus() || "{}");
        if (!st.ready) {
          setGenStatus(
            (st.note || "SD.cpp pas prêt") +
            "\n→ Télécharge un modèle avec « Pack SD.cpp », puis réessaie."
          );
          window._leaGenBusy = false;
          return;
        }
        // Relancer preload si pas encore warm
        if (!st.warm && window.LeaAndroid.sdCppPreload) {
          try { window.LeaAndroid.sdCppPreload(); } catch (_) {}
        }
        setGenStatus(
          "SD.cpp · " + (st.model || "modèle") +
          (st.warm ? " · cache OK" : " · 1er load plus long") +
          " · lancement…"
        );
      } catch (_) {}
      // Prompt = physique détaillé + tenue scénario (buildLeaImagePrompt) + négatifs
      const neg = bodyNegatives(c) + ", cartoon, anime, deformed, child, underage, blurry, watermark, text, wrong body type";
      const payloadJson = JSON.stringify({
        prompt: String(prompt).slice(0, 1800),
        negative: String(neg).slice(0, 500),
        charId: c.id || "lea",
        steps: 8,
        cfg: 5,
        width: 320,
        height: 448,
      });
      showPromptStatus("SD.cpp (lent au 1er load · 320×448 · 8 steps)…", prompt);
      const raw = window.LeaAndroid.sdCppGenerate(payloadJson);
      let data = {};
      try { data = typeof raw === "string" ? JSON.parse(raw) : (raw || {}); } catch (_) { data = { error: String(raw) }; }
      if (data.error && !data.pending) {
        setGenStatus("SD.cpp échec → Horde auto…\n" + data.error);
        // Fallback Horde automatique
        window._leaGenBusy = false;
        await generatePhotoHordeFallback(prompt, c);
        return;
      }
      if (data.url) {
        const stored = await addToGallery(data.url, c.id);
        setGenStatus("Image SD.cpp prête");
        window._leaGenBusy = false;
        if (state.view === "profile") renderProfile();
        // Reste sur le profil : n'ouvre PAS la conversation
        if (state.view === "profile") {
          renderProfile();
        } else if (state.view !== "chat") {
          openFull(resolvePhotoSrc(stored) || stored);
        } else {
          // déjà en chat : ne change pas de vue, juste galerie
        }
        return;
      }
      pollSdCppJob(c.id);
      return;
    }

    // —— Horde ——
    const payload = { prompt, negative: bodyNegatives(c), nsfw: !/jade|lina|hana|mei|sasha/.test(c.id) };
    const small = /jade|aya|lina|hana|mei|sasha|thea|zoe/.test(c.id);
    const busty = /lea|sofia|amelie|fatou|elise|olga|yasmine|myriam|priya/.test(c.id);
    if (small) payload.negative = "large breasts, huge cleavage, 95D, voluptuous, middle-aged, 35 years old, red lipstick, office librarian, no glasses";
    if (c.id === "jade") payload.negative = (payload.negative || "") + ", middle-aged woman, glamorous makeup, large breasts, C-cup, D-cup, missing glasses, no glasses, long loose hair, wavy long hair past shoulders, fitness model, abs, mature face";
    if (c.id === "mei") payload.negative = (payload.negative || "") + ", large breasts, busty, blonde, european only features";
    if (c.id === "sofia") payload.negative = (payload.negative || "") + ", flat chest, small breasts, A-cup, skinny boyish";
    if (c.id === "chloe") payload.negative = (payload.negative || "") + ", middle-aged, 35 years old, 40 years old, mature woman, MILF, large breasts, D-cup, no freckles, brown hair";
    if (c.id === "lea") payload.negative = (payload.negative || "") + ", dry clothes, dry hair, black hair, blonde, white bra only, lingerie set, nude, seamless studio, middle-aged, 30 years old";
    if (busty) payload.negative = (payload.negative || "") + ", flat chest, small breasts, androgynous body";
    // Léa : img2img depuis photo ORAGE
    if (c.id === "lea") {
      setGenStatus("Chargement ref orage Léa…");
      const refs = [
        "images/lea-orage-timide.jpg",
        "images/lea-portrait.jpg",
        "images/lea-orage.jpg",
        "images/lea-nuisette-timide.jpg",
        "images/lea-orage-dentelle.jpg",
        "images/lea-feu.jpg",
        "images/lea-feu-genoux.jpg",
      ];
      let ref = null;
      for (const r of refs) {
        setGenStatus("Ref… " + r.split("/").pop());
        ref = await imageToBase64(r);
        if (ref && ref.length > 800) break;
        ref = null;
      }
      payload.negative = (payload.negative || "") + ", dry clothes, dry hair, dry fabric, matte dry skin, sports bra, black top, gym clothes, fully dry";
      payload.nsfw = true;
      if (ref) {
        payload.source_image = ref;
        payload.source_processing = "img2img";
        payload.denoising = 0.22;
        setGenStatus("Horde img2img orage (ref OK, vêtements trempés)…");
      } else {
        setGenStatus("Pas de ref asset — txt2img orage forcé (top+jean TREMPÉS)…");
      }
    } else {
      // Autres personnages : img2img léger depuis cover si dispo (fidélité visage)
      try {
        const cover = resolvedCover(c);
        if (cover && !String(cover).startsWith("data:") && !/placeholder|default/i.test(cover)) {
          const cref = await imageToBase64(cover);
          if (cref && cref.length > 500) {
            payload.source_image = cref;
            payload.source_processing = "img2img";
            payload.denoising = 0.55;
          }
        }
      } catch (_) {}
      setGenStatus(payload.source_image ? "Horde img2img (cover + scénario)…" : "Horde txt2img scénario…");
    }
    const start = await api("/api/image", { method: "POST", body: JSON.stringify(payload) });
    if (!start.jobId) throw new Error("Pas de job Horde");
    setGenStatus("Horde job lancé — file d’attente… (reste sur l’écran ou reviens)");
    pollHordeJob(start.jobId, start.host, c.id);
  } catch (e) {
    window._leaGenBusy = false;
    setGenStatus(String(e.message || e));
  }
}

async function pollLocalJob(charId) {
  const cid = charId || state.current || "lea";
  for (let i = 0; i < 180; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    let data = {};
    try {
      data = JSON.parse(window.LeaAndroid.localStatus() || "{}");
    } catch {
      data = {};
    }
    if (data.pending || (!data.done && !data.url && !data.error)) {
      setGenStatus("Local MNN… " + (data.note || (i + 1)));
      continue;
    }
    window._leaGenBusy = false;
    if (data.error) {
      setGenStatus(data.error);
      return;
    }
    if (data.url) {
      const stored = await addToGallery(data.url, cid);
      setGenStatus("Image locale ajoutée à la galerie");
      if (state.view === "profile" && state.current === cid) renderProfile();
      if (state.current === cid && stored) openFull(resolvePhotoSrc(stored) || stored);
    }
    return;
  }
  window._leaGenBusy = false;
  setGenStatus("Local timeout");
}

async function persistImageUrl(url) {
  if (!url) return url;
  if (String(url).startsWith("data:")) return url;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || url));
      fr.onerror = () => resolve(url);
      fr.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

async function pollHordeJob(jobId, host, charId) {
  const cid = charId || state.current || "lea";
  for (let i = 0; i < 240; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const st = await api("/api/image-status", { method: "POST", body: JSON.stringify({ jobId, host }) });
      if (!st.done) {
        const q = st.queue != null ? " · file " + st.queue : "";
        const w = st.wait != null ? " · ~" + st.wait + "s" : "";
        const p = st.processing ? " · calcul" : "";
        setGenStatus("Horde en cours" + q + w + p + " (" + (i + 1) + "/240)");
        continue;
      }
      window._leaGenBusy = false;
      if (st.error) {
        setGenStatus(st.error);
        return;
      }
      const stored = await addToGallery(st.url, cid);
      setGenStatus("Image ajoutée à la galerie");
      if (state.view === "profile" && state.current === cid) renderProfile();
      if (stored && state.current === cid) if (state.view === "profile") { renderProfile(); } else if (state.view !== "chat") { openFull(resolvePhotoSrc(stored) || stored); }
      return;
    } catch (e) {
      setGenStatus("Horde… " + (e.message || e));
    }
  }
  window._leaGenBusy = false;
  setGenStatus("Horde timeout (~12 min). Réessaie, file parfois très longue.");
}

function formatBubble(text) {
  let raw = String(text || "").replace(/\r/g, "");
  // Normalise formats cassés du modèle :
  // 1) "(pensée) texte" → "(texte)"
  // "(pensée) texte..." → "(texte...)"
  raw = raw.replace(/\(\s*pens[ée]e\s*\)\s*([^\n]+)/gi, function(_, t) {
    t = String(t).trim().replace(/^\(|\)$/g, "");
    return "(" + t + ")";
  });
  raw = raw.replace(/\(\s*thought\s*\)\s*([^\n]+)/gi, function(_, t) {
    t = String(t).trim().replace(/^\(|\)$/g, "");
    return "(" + t + ")";
  });
  // 2) action ouverte sans * initial mais fermée : "Je fais…*" → "*Je fais…*"
  raw = raw.replace(/(^|\n)([^*\n][^\n]{8,}?)\*(\s*($|\n))/g, "$1*$2*$3");
  // 3) action sur ligne entière entre * manquants : ligne narrative entre pensée et dialogue
  const parts = [];
  const re = /(\([^)]{3,}\)|~[^~]+~|\*[^*]+\*|_[^_]{3,}_)/g;
  let last = 0;
  let m;
  while ((m = re.exec(raw))) {
    if (m.index > last) parts.push({ t: "say", v: raw.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith("(") || tok.startsWith("~") || tok.startsWith("_")) {
      let v = tok.slice(1, -1).trim();
      if (/^(pens[ée]e|thought)$/i.test(v)) continue; // label seul
      parts.push({ t: "think", v });
    } else {
      parts.push({ t: "act", v: tok.replace(/^\*|\*$/g, "").trim() });
    }
    last = m.index + tok.length;
  }
  if (last < raw.length) parts.push({ t: "say", v: raw.slice(last) });
  if (!parts.length) parts.push({ t: "say", v: raw });

  // Heuristique : paragraphe "say" qui est clairement une action narrative (verbe 1re personne, pas de dialogue)
  const out = [];
  for (const p of parts) {
    if (p.t === "say") {
      const chunks = String(p.v).split(/\n+/);
      for (const ch of chunks) {
        const t = ch.trim();
        if (!t) continue;
        // Action narrative sans * : commence par Je/Elle + verbe, pas de ? final style dialogue court
        if (/^(Je|J'|Elle|Me |M')[a-zàâäéèêëïîôùûüç].{15,}/i.test(t)
            && !/[«"]/.test(t)
            && !/^(Bonjour|Bonsoir|Salut|Oui|Non|Euh|Merci)/i.test(t)) {
          out.push({ t: "act", v: t.replace(/^\*|\*$/g, "") });
        } else {
          out.push({ t: "say", v: t });
        }
      }
    } else {
      out.push(p);
    }
  }

  return out.map((p) => {
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
  const shown = msgs.length ? msgs : (c.greeting ? [{ role: "assistant", content: c.greeting }] : []);
  if (!shown.length) {
    box.innerHTML = "";
  } else {
    box.innerHTML = shown.map((m) => {
      if (m.image) {
        const src = resolvePhotoSrc(m.image) || m.image;
        return `<div class="bubble ${m.role === "user" ? "user" : "assistant"} scene-img">
          <div class="scene-caption">${formatBubble(m.content || "Aperçu de la scène")}</div>
          <img class="scene-photo" src="${src}" alt="scène" data-full="${src}" loading="lazy"
            onerror="this.style.display='none'" />
        </div>`;
      }
      return `<div class="bubble ${m.role === "user" ? "user" : "assistant"}">${formatBubble(m.content)}</div>`;
    }).join("");
  }
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  const stick = () => { box.scrollTop = box.scrollHeight + 9999; };
  stick();
  box.querySelectorAll(".scene-photo").forEach((img) => {
    img.onclick = () => openFull(img.getAttribute("data-full") || img.src);
    img.onload = () => { if (nearBottom || true) stick(); };
  });
  const rel = state.chat?.relationship || {};
  if ($("rel")) {
    $("rel").innerHTML = `<p style="font-size:13px;color:var(--rose)">Proximité ${rel.closeness || 1}/10 · Confiance ${rel.trust || 1}/10 · Tension ${rel.heat || 0}/10</p>`;
  }
  if ($("mode-now")) {
    const heat = rel.heat || 0;
    // Auto: NSFW seulement si heat élevée (≥6) ou mode forcé
    const label = state.mode === "nsfw" ? "NSFW forcé"
      : state.mode === "sfw" ? "SFW forcé"
      : (heat >= 6 ? "Auto · NSFW" : "Auto · SFW");
    $("mode-now").textContent = label + (state.mode === "auto" ? " (" + heat + "/10)" : "");
  }
}

/** Fonds autorisés = uniquement images de CE personnage (cover + galerie + générées). */
function characterBgOptions(c) {
  const char = c || character();
  const id = char.id || "lea";
  const opts = [];
  const seen = new Set();
  const push = (src, title) => {
    if (!src || seen.has(src)) return;
    seen.add(src);
    opts.push({ src, title: title || "Photo" });
  };
  push(resolvedCover(char), "Profil");
  const gal = char.gallery && char.gallery.length
    ? char.gallery
    : (id === "lea" ? GALLERY.map((g) => g.src) : []);
  (gal || []).forEach((src, i) => {
    const r = String(src).startsWith("gallery:") ? (resolvePhotoSrc(src) || "") : src;
    if (r) push(r, "Photo " + (i + 1));
  });
  extraPhotos(id).forEach((src, i) => {
    const resolved = resolvePhotoSrc(src) || src;
    if (resolved && !String(resolved).startsWith("gallery:")) push(resolved, "Générée " + (i + 1));
  });
  return opts;
}

function chatBgKey(id) {
  return "lea.chatBg." + (id || state.current || "lea");
}

function chatBg(id) {
  const cid = id || state.current || "lea";
  const c = (state.characters || []).find((x) => x.id === cid) || character();
  const opts = characterBgOptions(c);
  const allowed = new Set(opts.map((o) => o.src));
  let saved = localStorage.getItem(chatBgKey(cid));
  // Ancien fond global Léa : ne l’appliquer qu’à Léa
  if (!saved && cid === "lea") {
    const legacy = localStorage.getItem("lea.chatBg");
    if (legacy && allowed.has(legacy)) saved = legacy;
  }
  if (saved && allowed.has(saved)) return saved;
  return (opts[0] && opts[0].src) || c.cover || "images/lea-portrait.jpg";
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
  const bgs = characterBgOptions(c);
  const current = chatBg(c.id);
  $("view-chat").innerHTML = `
    <div class="chat-full">
      <div class="chat-bg" style="background-image:url('${current}')"></div>
      <div class="chat-bg-dim"></div>
      <div class="chat-head">
        <button type="button" id="back-disc">←</button>
                <img id="chat-avatar" src="${c.cover || resolvedCover(c)}" alt="" style="object-fit:cover;cursor:pointer" title="Voir le profil" onerror="this.style.opacity='0.3'" />
        <div class="grow">
          <strong>${c.name}</strong>
          <div class="mode-pill" id="mode-now">Auto · SFW</div>
        </div>
        <button type="button" id="open-sheet">⋮</button>
      </div>
      <div class="msgs" id="msgs"></div>
      <div id="scene-progress" class="scene-progress hidden" aria-live="polite"></div>
      <div class="composer">
        <textarea id="input" placeholder="Écris à ${c.name}…"></textarea>
        <div class="composer-actions">
          <button type="button" id="gen-scene" class="btn-scene" title="Générer un aperçu de la scène actuelle">📷 Scène</button>
          <button class="cta" type="button" id="send">Envoyer</button>
        </div>
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
      if (state.mode === "sfw" && state.chat && state.chat.relationship) {
        state.chat.relationship.heat = Math.max(0, (state.chat.relationship.heat || 0) - 3);
      }
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
  if ($("gen-scene")) {
    $("gen-scene").onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setSceneProgress("📷 Clic reçu — démarrage…", 3);
      Promise.resolve()
        .then(() => generateScenePhoto())
        .catch((err) => {
          setSceneProgress("❌ " + (err && err.message ? err.message : err), 0);
          window._leaSceneBusy = false;
        });
    };
  }
  $("input").onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };
  $("back-disc").onclick = () => { show("discover"); };
  if ($("chat-avatar")) $("chat-avatar").onclick = () => { show("profile"); renderProfile(); };
  $("open-sheet").onclick = () => $("sheet").classList.toggle("hidden");
  $("close-sheet").onclick = () => $("sheet").classList.add("hidden");
  $("sheet").onclick = (e) => {
    const bg = e.target.getAttribute("data-bg");
    if (!bg) return;
    localStorage.setItem(chatBgKey(c.id), bg);
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
  const greet = character().greeting;
  if (greet && !state.chat.messages.some((m) => m.role === "assistant")) {
    state.chat.messages.unshift({ role: "assistant", content: greet, ts: Date.now() - 1 });
  }
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
      const g = character().greeting;
      if (g && !(state.chat.messages || []).some((m) => m.role === "assistant" && String(m.content).slice(0, 40) === String(g).slice(0, 40))) {
        state.chat.messages.unshift({ role: "assistant", content: g, ts: Date.now() - 2 });
      }
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


/** Galerie des générations libres (prompt libre). */
function studioPhotos() {
  return extraPhotos("studio");
}

function getStudioLast() {
  try {
    return localStorage.getItem("lea.studio.last") || "";
  } catch (_) {
    return "";
  }
}

function setStudioLast(src) {
  try {
    if (src) localStorage.setItem("lea.studio.last", src);
  } catch (_) {}
}

function renderStudio() {
  const photos = studioPhotos();
  const last = getStudioLast();
  const lastSrc = last ? (resolvePhotoSrc(last) || last) : "";
  $("view-studio").innerHTML = `
    <h1>Génération libre</h1>
    <p style="color:var(--muted);font-size:13px;line-height:1.45">
      Prompt libre (personnages, scènes, art, NSFW…). Horde uncensored.
      <b>Multi-images :</b> image 1 = base (corps/scène), image 2 = visage/personne à intégrer.
      Ex. : « le visage de l'homme (img2) entre les seins (img1), il les embrasse / lèche ».
      Avec clés Gemini, les refs sont analysées pour un meilleur mix.
    </p>
    <label class="lbl">Prompt / description</label>
    <textarea class="field studio-box" id="studio-prompt" rows="5" placeholder="Ex. : circular logo for NSFW server Boys and Girls, pink and blue, clean vector…&#10;ou : photorealistic woman, red lingerie…&#10;ou : mountain landscape at sunset…"></textarea>
    <label class="lbl">Modifier la dernière image (dialogue)</label>
    <textarea class="field" id="studio-edit" rows="2" placeholder="Ex. : change colors to purple, add text, remove background…"></textarea>
    <label class="lbl">Négatif (optionnel)</label>
    <textarea class="field" id="studio-neg" rows="2">child, teen, underage, blurry, deformed, extra limbs, low quality</textarea>
    <div class="studio-row">
      <label><input type="checkbox" id="studio-nsfw" checked /> NSFW max</label>
      <label><input type="checkbox" id="studio-use-last" ${last ? "checked" : ""} ${last ? "" : "disabled"} /> Partir de la dernière</label>
      <label>Format
        <select id="studio-size">
          <option value="512x768">Portrait 512×768</option>
          <option value="768x512">Paysage 768×512</option>
          <option value="512x512">Carré 512×512</option>
          <option value="640x960">Portrait HD</option>
        </select>
      </label>
      <label>Moteur
        <select id="studio-engine">
          <option value="horde">Horde</option>
          <option value="sd_cpp">SD.cpp</option>
        </select>
      </label>
    </div>
    <div class="studio-row" style="margin-top:8px">
      <label><input type="checkbox" id="studio-gemini" /> Améliorer le prompt avec Gemini (clés dans Clés)</label>
    </div>
    <label class="lbl">Images source img2img (1 ou plusieurs, mix) — optionnel</label>
    <div style="display:flex;align-items:center;gap:10px;margin:8px 0;flex-wrap:wrap">
      <button type="button" class="cta" id="studio-pick" style="background:#2a4a6a">📁 Choisir image(s)</button>
      <input type="file" id="studio-file" accept="image/*" multiple capture="environment"
        style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;z-index:-1" />
      <span id="studio-file-label" style="color:var(--muted);font-size:13px">Aucune image</span>
    </div>
    <div id="studio-preview-wrap" style="margin:8px 0;${lastSrc ? "" : "display:none"}">
      <p style="color:var(--muted);font-size:12px;margin:0 0 6px">Sources / dernière :</p>
      <div id="studio-preview-list" style="display:flex;flex-wrap:wrap;gap:8px">
        <img id="studio-preview" src="${lastSrc}" alt="last" style="max-width:100px;border-radius:10px;border:1px solid var(--line);${lastSrc ? "" : "display:none"}" />
      </div>
    </div>
    <div style="margin-top:10px">
      <button type="button" class="cta" id="studio-gen">✦ Générer</button>
      <button type="button" class="cta" id="studio-modify" style="margin-left:8px;background:#6b3a8a">✎ Modifier dernière</button>
      <button type="button" class="cta" id="studio-clear" style="margin-left:8px;background:#3a2048">Vider</button>
    </div>
    <pre id="studio-status"></pre>
    <h3 style="margin-top:18px">Résultats (${photos.length})</h3>
    <div class="studio-grid" id="studio-grid">
      ${photos.length ? photos.map((src, i) => {
        const r = resolvePhotoSrc(src) || src;
        return '<img src="' + r + '" alt="gen ' + (i + 1) + '" data-full="' + r + '" data-raw="' + src + '" />';
      }).join("") : '<p style="color:var(--muted);font-size:13px">Aucune image pour l\'instant.</p>'}
    </div>
  `;

  try {
    const st = JSON.parse(localStorage.getItem("lea.settings") || "{}");
    if ($("studio-engine") && st.imageEngine) $("studio-engine").value = st.imageEngine;
  } catch (_) {}

  // Prévisualisation fichier uploadé
  window._studioUploadB64 = null;
  window._studioUploadList = [];
  if ($("studio-pick") && $("studio-file")) {
    $("studio-pick").onclick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      try { $("studio-file").value = ""; } catch (_) {}
      $("studio-file").click();
    };
  }
  if ($("studio-file")) {
    $("studio-file").onchange = async (e) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      if (!files.length) return;
      window._studioUploadList = [];
      const listEl = $("studio-preview-list");
      const wrap = $("studio-preview-wrap");
      if (listEl) listEl.innerHTML = "";
      try {
        for (let i = 0; i < Math.min(files.length, 4); i++) {
          const f = files[i];
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(f);
          });
          let out = dataUrl;
          try { out = await compressToJpeg(dataUrl, 768, 0.85); } catch (_) {}
          window._studioUploadList.push(out);
          if (listEl) {
            const img = document.createElement("img");
            img.src = out;
            img.style.cssText = "max-width:100px;border-radius:10px;border:1px solid var(--line)";
            listEl.appendChild(img);
          }
        }
        window._studioUploadB64 = window._studioUploadList[0] || null;
        if (wrap) wrap.style.display = "";
        if ($("studio-status")) $("studio-status").textContent =
          window._studioUploadList.length + " image(s) source chargée(s) (img2img mix max 4).";
        if ($("studio-file-label")) $("studio-file-label").textContent =
          window._studioUploadList.length + " image(s) sélectionnée(s)";
      } catch (err) {
        if ($("studio-status")) $("studio-status").textContent = "Erreur fichier: " + (err.message || err);
      }
    };
  }

  $("studio-gen").onclick = () => generateStudioImage({ mode: "gen" });
  $("studio-modify").onclick = () => generateStudioImage({ mode: "edit" });
  $("studio-clear").onclick = () => {
    saveExtra([], "studio");
    setStudioLast("");
    window._studioUploadB64 = null;
    renderStudio();
  };
  document.querySelectorAll("#studio-grid img").forEach((img) => {
    img.onclick = () => {
      openFull(img.dataset.full || img.src);
      // sélection comme base
      if (img.dataset.raw) setStudioLast(img.dataset.raw);
    };
  });
}

async function studioSourceBase64(preferLast) {
  if (window._studioUploadB64 && String(window._studioUploadB64).startsWith("data:")) {
    const s = window._studioUploadB64;
    const i = s.indexOf(",");
    return i >= 0 ? s.slice(i + 1) : s;
  }
  if (preferLast) {
    const last = getStudioLast();
    if (last) {
      const b64 = await imageToBase64(resolvePhotoSrc(last) || last);
      if (b64) return b64;
    }
    // première de la galerie studio
    const photos = studioPhotos();
    if (photos[0]) {
      const b64 = await imageToBase64(resolvePhotoSrc(photos[0]) || photos[0]);
      if (b64) return b64;
    }
  }
  return null;
}

async function generateStudioImage(opts) {
  opts = opts || { mode: "gen" };
  if (window._leaGenBusy) {
    $("studio-status").textContent = "Génération déjà en cours…";
    return;
  }
  const editTxt = ($("studio-edit") && $("studio-edit").value || "").trim();
  const rawPrompt = ($("studio-prompt") && $("studio-prompt").value || "").trim();
  const useLast = ($("studio-use-last") && $("studio-use-last").checked) || opts.mode === "edit";
  const nsfw = !($("studio-nsfw") && !$("studio-nsfw").checked);
  const size = ($("studio-size") && $("studio-size").value) || "512x768";
  const [w, h] = size.split("x").map(Number);
  const eng = ($("studio-engine") && $("studio-engine").value) || "horde";
  const negUser = ($("studio-neg") && $("studio-neg").value || "").trim();

  let prompt = "";
  if (opts.mode === "edit") {
    if (!editTxt && !rawPrompt) {
      $("studio-status").textContent = "Décris les modifications dans le champ « Modifier la dernière image ».";
      return;
    }
    prompt = [
      rawPrompt || "keep main subject from source",
      "apply these changes: " + (editTxt || rawPrompt),
      "respect the edit request precisely",
    ].join(", ");
  } else {
    prompt = rawPrompt;
    if (editTxt) prompt = (prompt ? prompt + ", " : "") + editTxt;
    if (!prompt || prompt.length < 3) {
      $("studio-status").textContent = "Écris un prompt d'abord.";
      return;
    }
  }

  // Type de demande — NE PAS forcer une photo de femme
  const isLogo = /\b(logo|ic[oô]ne|icon|badge|embl[eè]me|avatar serveur|server (icon|logo)|pictogramme)\b/i.test(prompt);
  const isGraphic = /\b(vector|flat design|illustration|cartoon|anime|manga|pixel art|infographie|affiche|poster design)\b/i.test(prompt);
  const isLandscape = /\b(landscape|paysage|mountain|sunset|forest|ocean|cityscape|skyline)\b/i.test(prompt);
  const isObject = /\b(product|object|item|voiture|car|food|meal|building|architecture)\b/i.test(prompt) && !/\b(woman|man|girl|boy|person|femme|homme)\b/i.test(prompt);
  const isPerson = /\b(woman|man|girl|boy|person|femme|homme|nude|lingerie|portrait|selfie|model)\b/i.test(prompt);

  if (isLogo) {
    prompt = [
      "professional logo design, " + prompt,
      "clean circular emblem if requested, centered composition,",
      "vector-style sharp edges, readable typography if text is requested,",
      "no photorealistic person, no nude, no random woman, graphic design only,",
      "high quality logo artwork, simple background"
    ].join(" ");
  } else if (isGraphic && !isPerson) {
    prompt = prompt + ", high quality illustration, clear composition, not a random photo of a woman";
  } else if (isLandscape || isObject) {
    if (!/photoreal|photo|illustration/i.test(prompt)) {
      prompt = "high quality image, " + prompt;
    }
  } else if (isPerson || (!isLogo && !isGraphic && !isLandscape && !isObject)) {
    // Photo / personne uniquement si demandé ou ambigu mais pas logo
    if (isPerson) {
      if (!/photoreal|photo|illustration|anime|cartoon/i.test(prompt)) {
        prompt = "photorealistic, " + prompt;
      }
      if (nsfw) {
        prompt += ", uncensored, NSFW allowed, adult content ok";
      }
    } else {
      // Prompt libre non classé : respecter le texte tel quel, léger boost qualité
      prompt = prompt + ", high quality, detailed";
      if (nsfw) prompt += ", uncensored if applicable";
    }
  }

  let negative = [
    negUser,
    "child, teen, underage, loli, shota, young child",
    nsfw ? "" : "nude, explicit genitalia",
    "blurry, deformed, extra limbs, bad anatomy, lowres, jpeg artifacts",
  ].filter(Boolean).join(", ");

  // Pour un logo : interdire femme nue / photo portrait
  if (isLogo) {
    negative += ", photorealistic nude woman, naked woman, portrait photo, realistic breasts, NSFW body, random person, stock photo model";
  }

  window._leaGenBusy = true;
  $("studio-status").textContent = "Préparation…";

  try {
    // Option : Gemini reformule le prompt (SFW/NSFW) pour Horde
    const useGemini = $("studio-gemini") && $("studio-gemini").checked;
    if (useGemini) {
      try {
        $("studio-status").textContent = "Gemini analyse le prompt…";
        const gemMsg = [
          { role: "system", content: "Tu es un expert en prompts Stable Diffusion / AI Horde. Reformule la demande utilisateur en UN prompt anglais clair, précis, fidèle à l'intention (logo, paysage, objet, personne, NSFW…). N'ajoute PAS de femme nue si ce n'est pas demandé. Si logo: précise style graphique, couleurs, texte exact, forme. Réponds UNIQUEMENT avec le prompt final, sans guillemets ni commentaire." },
          { role: "user", content: "Demande: " + prompt + (nsfw ? "\n(NSFW autorisé si pertinent)" : "\n(rester SFW)") }
        ];
        const refined = await api("/api/chat/lea/message", {
          method: "POST",
          body: JSON.stringify({ text: "[STUDIO_PROMPT] " + prompt, mode: nsfw ? "nsfw" : "sfw", _studioPrompt: true })
        });
        // Fallback: call generate via settings keys if dedicated endpoint missing
      } catch (_) {}
      try {
        const st = JSON.parse(localStorage.getItem("lea.settings") || "{}");
        const keys = String(st.geminiKeys || st.gemini || "").split(/[\n,]+/).map((k) => k.trim()).filter(Boolean);
        if (keys.length) {
          $("studio-status").textContent = "Gemini reformule le prompt…";
          const sys = "Rewrite as a single English image-generation prompt for Stable Diffusion. Be faithful to the user intent. If they ask for a logo/icon, output a GRAPHIC LOGO prompt (no nude person). If NSFW scene, keep explicit. Reply with ONLY the prompt text.";
          const body = {
            contents: [{ role: "user", parts: [{ text: sys + "\n\nUser request: " + prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 300 }
          };
          const res = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + encodeURIComponent(keys[0]),
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
          );
          const data = await res.json();
          const t = data && data.candidates && data.candidates[0] && data.candidates[0].content &&
            data.candidates[0].content.parts && data.candidates[0].content.parts.map((p) => p.text).join("");
          if (t && t.trim().length > 10) {
            prompt = t.trim().replace(/^["']|["']$/g, "");
            $("studio-status").textContent = "Prompt Gemini OK → Horde…";
          }
        }
      } catch (ge) {
        $("studio-status").textContent = "Gemini indisponible, prompt original…";
      }
    }

    let sourceB64 = null;
    const uploads = (window._studioUploadList && window._studioUploadList.length)
      ? window._studioUploadList
      : (window._studioUploadB64 ? [window._studioUploadB64] : []);
    if (useLast || opts.mode === "edit" || uploads.length) {
      $("studio-status").textContent = "Chargement image source…";
      if (uploads.length) {
        // Image 1 = base composition (corps/scène) ; image 2+ = visage / 2e sujet à intégrer
        sourceB64 = uploads[0];
        if (String(sourceB64).startsWith("data:")) {
          const comma = sourceB64.indexOf(",");
          if (comma > 0) sourceB64 = sourceB64.slice(comma + 1);
        }
        if (uploads.length > 1) {
          // Prompt de composition STRICT (Horde = 1 seule source img2img)
          const composeHint = [
            "COMPOSITION from " + uploads.length + " reference photos:",
            "reference image 1 is the BASE (body/scene/outfit must stay recognizable),",
            "reference image 2 supplies the FACE / second person identity to insert,",
            "CRITICAL placement: if user asks for face between breasts / kissing / licking cleavage — put the FACE from image 2 physically against the breasts of image 1 (mouth on breast or tongue on nipple), close-up, same photo, NOT a separate portrait, NOT a different woman,",
            "same lighting, photorealistic, coherent anatomy, no extra random people,",
            "do not ignore the face from reference 2"
          ].join(" ");
          prompt = composeHint + ". User request: " + prompt;

          // Gemini Vision : décrit les refs + reformule le prompt de mix
          try {
            const st = JSON.parse(localStorage.getItem("lea.settings") || "{}");
            const keys = String(st.geminiKeys || st.gemini || "").split(/[\n,]+/).map((k) => k.trim()).filter(Boolean);
            if (keys.length) {
              $("studio-status").textContent = "Gemini analyse les " + uploads.length + " images…";
              const parts = [{ text:
                "You build ONE English Stable Diffusion img2img prompt. " +
                "Image 1 = base (body/scene). Image 2 = face/person to insert. " +
                "User wants: " + (rawPrompt || prompt) + ". " +
                "Describe a single coherent scene that places the person from image 2 onto/into image 1 as requested " +
                "(e.g. face nestled between the breasts of image 1, kissing or licking the cleavage). " +
                "Keep photorealism, adult 18+ if NSFW. Reply with ONLY the final prompt, no quotes."
              }];
              for (let ui = 0; ui < Math.min(uploads.length, 3); ui++) {
                let u = uploads[ui];
                let mime = "image/jpeg";
                let data = u;
                if (String(u).startsWith("data:")) {
                  const m = /^data:([^;]+);base64,(.+)$/s.exec(u);
                  if (m) { mime = m[1]; data = m[2]; }
                  else {
                    const c = u.indexOf(",");
                    if (c > 0) data = u.slice(c + 1);
                  }
                }
                parts.push({ text: "Reference image " + (ui + 1) + ":" });
                parts.push({ inline_data: { mime_type: mime, data: data } });
              }
              const res = await fetch(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + encodeURIComponent(keys[0]),
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contents: [{ role: "user", parts }],
                    generationConfig: { temperature: 0.35, maxOutputTokens: 400 },
                  }),
                }
              );
              const data = await res.json().catch(() => ({}));
              const t = data && data.candidates && data.candidates[0] && data.candidates[0].content &&
                data.candidates[0].content.parts && data.candidates[0].content.parts.map((p) => p.text).filter(Boolean).join("");
              if (t && t.trim().length > 20) {
                prompt = t.trim().replace(/^["']|["']$/g, "");
                $("studio-status").textContent = "Prompt mix Gemini OK → génération…";
              }
            }
          } catch (ge) {
            $("studio-status").textContent = "Analyse Gemini skip, composition manuelle…";
          }
        }
      } else {
        sourceB64 = await studioSourceBase64(true);
      }
    }

    const payload = {
      prompt,
      negative,
      nsfw: nsfw !== false,
      censor_nsfw: false,
      width: w || (isLogo ? 512 : 512),
      height: h || (isLogo ? 512 : 768),
      steps: sourceB64 ? 28 : 32,
      engine: eng,
      charId: "studio",
    };
    // Logo → format carré conseillé
    if (isLogo && size === "512x768") {
      payload.width = 512;
      payload.height = 512;
    }
    if (sourceB64) {
      payload.source_image = sourceB64;
      payload.source_processing = "img2img";
      payload.denoising = opts.mode === "edit" ? 0.58 : (uploads.length > 1 ? 0.62 : 0.48);
    }

    if (eng === "sd_cpp" && window.LeaAndroid && window.LeaAndroid.sdCppGenerate) {
      try {
        $("studio-status").textContent = "SD.cpp…";
        const raw = window.LeaAndroid.sdCppGenerate(JSON.stringify({
          prompt, negative, width: w || 512, height: h || 768, steps: 20,
        }));
        const data = typeof raw === "string" ? JSON.parse(raw || "{}") : (raw || {});
        if (data.url || data.path) {
          const stored = await addToGallery(data.url || data.path, "studio");
          setStudioLast(stored);
          window._leaGenBusy = false;
          $("studio-status").textContent = "Image SD.cpp prête";
          renderStudio();
          if (stored) { renderStudio(); openFull(resolvePhotoSrc(stored) || stored, { studio: true }); }
          return;
        }
      } catch (e) {
        $("studio-status").textContent = "SD.cpp: " + (e.message || e) + " → Horde…";
      }
    }

    $("studio-status").textContent = sourceB64
      ? ("Horde img2img denoise " + payload.denoising + "…")
      : "Horde txt2img…";

    const start = await api("/api/image", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!start || (!start.jobId && !start.url)) {
      throw new Error((start && start.error) || "Pas de job Horde");
    }
    if (start.url) {
      const stored = await addToGallery(start.url, "studio");
      setStudioLast(stored);
      window._leaGenBusy = false;
      $("studio-status").textContent = "Image prête";
      renderStudio();
      if (stored) { renderStudio(); openFull(resolvePhotoSrc(stored) || stored, { studio: true }); }
      return;
    }
    const jobId = start.jobId;
    const host = start.host || "https://aihorde.net/api/v2";
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      let st;
      try {
        st = await api("/api/image-status", {
          method: "POST",
          body: JSON.stringify({ jobId, host }),
        });
      } catch (e) {
        $("studio-status").textContent = "Horde… " + (e.message || e);
        continue;
      }
      if (st && st.wait_time != null) {
        $("studio-status").textContent = "Horde… ~" + st.wait_time + "s (file " + (st.queue_position ?? "?") + ")";
      }
      if (st && st.error) {
        window._leaGenBusy = false;
        $("studio-status").textContent = st.error;
        return;
      }
      if (st && st.url) {
        const stored = await addToGallery(st.url, "studio");
        setStudioLast(stored);
        window._leaGenBusy = false;
        $("studio-status").textContent = sourceB64 ? "Modification appliquée" : "Image ajoutée";
        renderStudio();
        if (stored) { renderStudio(); openFull(resolvePhotoSrc(stored) || stored, { studio: true }); }
        return;
      }
    }
    window._leaGenBusy = false;
    $("studio-status").textContent = "Timeout Horde — réessaie.";
  } catch (e) {
    window._leaGenBusy = false;
    $("studio-status").textContent = "Erreur: " + (e.message || e);
  }
}

function renderSettings() {
  $("view-settings").innerHTML = `
    <h1>Clés Google AI Studio</h1>
    <p style="color:var(--muted);font-size:13px">Chat : Gemini. Images : Horde (recommandé) ou SD.cpp intégré (expérimental).</p>
    <h2 style="margin-top:22px;font-size:16px">Sauvegarde galerie (GitHub)</h2>
    <p style="color:var(--muted);font-size:12px">Les images générées sont aussi sur le téléphone (disque app). Tu peux les pousser sur un dépôt GitHub pour backup.</p>
    <label class="lbl">Token GitHub (repo scope)</label>
    <input class="field" id="gh-token" type="password" placeholder="ghp_…" autocomplete="off" />
    <label class="lbl">Dépôt (owner/repo)</label>
    <input class="field" id="gh-repo" type="text" placeholder="davidc2115/lea-studio" />
    <label class="lbl">Dossier dans le repo</label>
    <input class="field" id="gh-path" type="text" placeholder="gallery-backup" value="gallery-backup" />
    <button type="button" class="cta" id="gh-save-gallery" style="margin-top:10px">☁ Sauvegarder toute la galerie sur GitHub</button>
    <button type="button" class="cta" id="gh-save-current" style="margin-top:8px;background:#3a2048">☁ Sauvegarder le personnage actuel</button>
    <button type="button" class="cta" id="gh-restore" style="margin-top:8px;background:#2a4a38">⬇ Restaurer depuis GitHub (après réinstall)</button>
    <p style="color:var(--muted);font-size:12px">Après réinstall APK : clique Restaurer pour récupérer les images du dossier gallery-backup. Les photos assets (Léa orage, etc.) sont déjà dans l'APK.</p>
    <pre id="gh-st" style="color:var(--muted);font-size:12px;white-space:pre-wrap;margin-top:8px"></pre>

    <label>Clé AI Horde (optionnel — plus de kudos gratuits sur aihorde.net)</label>
    <input class="field" id="horde-key" type="password" placeholder="laisser vide = anonyme" autocomplete="off" />
    <p style="color:var(--muted);font-size:12px">Si erreur « kudos / heavy demand » : crée un compte sur aihorde.net et colle ta clé ici.</p>
    <label>Cloudflare Account ID (Workers AI gratuit)</label>
    <input class="field" id="cf-account" type="text" placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" autocomplete="off" />
    <label>Cloudflare API Token (Workers AI)</label>
    <input class="field" id="cf-token" type="password" placeholder="token Workers AI" autocomplete="off" />
    <p style="color:var(--muted);font-size:12px">Gratuit sans CB : ~150–230 images/jour (FLUX Schnell). Créer sur dash.cloudflare.com → Workers AI. Moins adapté au NSFW explicite que Horde.</p>
    <label>Moteur images</label>
    <select id="imgengine">
      <option value="horde">Horde (gratuit NSFW · recommandé)</option>
      <option value="sd_cpp">SD.cpp (local · lent au 1er load)</option>
    </select>
    <p style="color:var(--muted);font-size:13px">
      <b>Horde</b> : cloud gratuit, fiable.<br/>
      <b>SD.cpp</b> : modèle dans l'app (souvent trop lent sur téléphone → bascule Horde).
    </p>
    <p style="margin-top:8px">
      <button class="cta" id="open-ld-settings" type="button" style="background:#3a2048">Ouvrir / installer Local Dream</button>
      <button class="cta" id="dl-sdcpp" type="button" style="margin-left:8px;background:#2a3a48">Télécharger modèle SD.cpp (~2 Go)</button>
    </p>
    <p class="err" id="dlst"></p>
    <label>Modèle Gemini (texte / chat)</label>
    <select id="gemtextmodel">
      <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite ★ rapide / cohérent</option>
      <option value="gemini-2.0-flash">Gemini 2.0 Flash ★ stable</option>
      <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash-Lite</option>
      <option value="gemini-2.5-flash">Gemini 2.5 Flash (plus lent)</option>
      <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite (peut être lent)</option>
      <option value="gemini-3.5-flash">Gemini 3.5 Flash (lent / parfois incohérent)</option>
      <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite</option>
      <option value="gemini-flash-latest">Gemini Flash Latest</option>
    </select>
    <p style="color:var(--muted);font-size:12px;margin:4px 0 8px">Conseil : 2.5 Flash-Lite ou 2.0 Flash. Les modèles 3.5 peuvent être lents ou hors-sujet selon les clés.</p>
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
    if ($("gemtextmodel")) $("gemtextmodel").value = s.settings.geminiTextModel || "gemini-2.5-flash-lite";
    if ($("gemimgmodel")) $("gemimgmodel").value = s.settings.geminiImageModel || "auto";
    $("pname").value = s.settings.personaName || "";
    $("pbio").value = s.settings.personaBio || "";
    $("gemini").value = s.settings.geminiKeys || "";
    if ($("grok")) $("grok").value = s.settings.grokKeys || "";
    if ($("imgengine")) $("imgengine").value = s.settings.imageEngine || "horde";
    if ($("horde-key") && s.settings.hordeKey) $("horde-key").value = s.settings.hordeKey;
    $("st").textContent = `Clés Gemini : ${s.keys.gemini}`;
    $("st").style.color = "#9dffc2";
    try {
      if (window.LeaAndroid && window.LeaAndroid.deviceInfo) {
        const d = JSON.parse(window.LeaAndroid.deviceInfo());
        $("st").textContent += " · RAM " + d.ramMb + " Mo · pack " + (d.modelReady ? "OK" : "absent") + " · moteur " + (d.nativeOk ? "MNN" : "non");
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
        hordeKey: $("horde-key") ? $("horde-key").value.trim() : "",
        cfAccount: $("cf-account") ? $("cf-account").value.trim() : "",
        cfToken: $("cf-token") ? $("cf-token").value.trim() : "",
        geminiImageModel: $("gemimgmodel") ? $("gemimgmodel").value : "auto",
        geminiTextModel: $("gemtextmodel") ? $("gemtextmodel").value : "gemini-3.5-flash-lite",
      }),
    });
    $("st").textContent = `OK — ${data.keys.gemini} clé(s) Gemini`;
    $("st").style.color = "#9dffc2";
  };
  try {
    const st0 = JSON.parse(localStorage.getItem("lea.settings") || "{}");
    if ($("gh-token") && st0.githubToken) $("gh-token").value = st0.githubToken;
    if ($("gh-repo") && st0.githubRepo) $("gh-repo").value = st0.githubRepo;
    if ($("gh-path") && st0.githubPath) $("gh-path").value = st0.githubPath;
  } catch (_) {}

  
  async function restoreGalleryFromGithub() {
    const token = ($("gh-token") && $("gh-token").value || "").trim();
    const repo = ($("gh-repo") && $("gh-repo").value || "").trim();
    const basePath = ($("gh-path") && $("gh-path").value || "gallery-backup").trim().replace(/^\/+|\/+$/g, "");
    const stEl = $("gh-st");
    if (!repo || !repo.includes("/")) {
      if (stEl) stEl.textContent = "Indique dépôt owner/repo (ex. davidc2115/lea-studio).";
      return { ok: 0, fail: 0 };
    }
    try {
      const cur = JSON.parse(localStorage.getItem("lea.settings") || "{}");
      if (token) cur.githubToken = token;
      cur.githubRepo = repo; cur.githubPath = basePath;
      localStorage.setItem("lea.settings", JSON.stringify(cur));
    } catch (_) {}
    const headers = { Accept: "application/vnd.github+json" };
    if (token) headers.Authorization = "token " + token;
    if (stEl) stEl.textContent = "Listage " + basePath + "…";
    let ok = 0, fail = 0;
    try {
      // Liste dossiers personnages sous basePath
      const rootRes = await fetch("https://api.github.com/repos/" + repo + "/contents/" + basePath, { headers });
      const root = await rootRes.json();
      if (!Array.isArray(root)) {
        if (stEl) stEl.textContent = "Dossier introuvable : " + basePath + " — " + (root.message || "");
        return { ok: 0, fail: 1 };
      }
      const dirs = root.filter((x) => x.type === "dir");
      const filesRoot = root.filter((x) => x.type === "file" && /\.(jpg|jpeg|png|webp)$/i.test(x.name));
      const jobs = [];
      for (const d of dirs) {
        const lr = await fetch("https://api.github.com/repos/" + repo + "/contents/" + d.path, { headers });
        const list = await lr.json();
        if (!Array.isArray(list)) continue;
        for (const f of list) {
          if (f.type === "file" && /\.(jpg|jpeg|png|webp)$/i.test(f.name)) {
            jobs.push({ cid: d.name, file: f });
          }
        }
      }
      // fichiers à la racine → lea
      for (const f of filesRoot) jobs.push({ cid: "lea", file: f });

      for (let i = 0; i < jobs.length; i++) {
        const { cid, file } = jobs[i];
        if (stEl) stEl.textContent = "Téléchargement " + (i + 1) + "/" + jobs.length + " · " + cid + "/" + file.name;
        try {
          // download_url direct ou content API base64
          let dataUrl = null;
          if (file.download_url) {
            const imgRes = await fetch(file.download_url);
            const blob = await imgRes.blob();
            dataUrl = await new Promise((resolve, reject) => {
              const fr = new FileReader();
              fr.onload = () => resolve(fr.result);
              fr.onerror = reject;
              fr.readAsDataURL(blob);
            });
          } else {
            const cr = await fetch("https://api.github.com/repos/" + repo + "/contents/" + file.path, { headers });
            const cj = await cr.json();
            if (cj.content) {
              const b64 = String(cj.content).replace(/\n/g, "");
              const mime = /\.png$/i.test(file.name) ? "image/png" : "image/jpeg";
              dataUrl = "data:" + mime + ";base64," + b64;
            }
          }
          if (!dataUrl) { fail++; continue; }
          // compress + add to gallery
          try { dataUrl = await compressToJpeg(dataUrl, 768, 0.82); } catch (_) {}
          await addToGallery(dataUrl, cid);
          ok++;
        } catch (e) {
          fail++;
          console.warn("restore", file.path, e);
        }
      }
      if (stEl) stEl.textContent = "Restauration terminée : " + ok + " images OK, " + fail + " erreurs.";
      try { localStorage.setItem("lea.gallery.restored", "1"); } catch (_) {}
      return { ok, fail };
    } catch (e) {
      if (stEl) stEl.textContent = "Erreur restore : " + (e.message || e);
      return { ok, fail: fail + 1 };
    }
  }

async function uploadGalleryToGithub(onlyCharId) {
    const token = ($("gh-token") && $("gh-token").value || "").trim();
    const repo = ($("gh-repo") && $("gh-repo").value || "").trim();
    const basePath = ($("gh-path") && $("gh-path").value || "gallery-backup").trim().replace(/^\/+|\/+$/g, "");
    const stEl = $("gh-st");
    if (!token || !repo || !repo.includes("/")) {
      if (stEl) stEl.textContent = "Indique token GitHub (ghp_…) et dépôt owner/repo.";
      return;
    }
    try {
      const cur = JSON.parse(localStorage.getItem("lea.settings") || "{}");
      cur.githubToken = token;
      cur.githubRepo = repo;
      cur.githubPath = basePath;
      localStorage.setItem("lea.settings", JSON.stringify(cur));
    } catch (_) {}
    const cast = (window.CAST || []).map((c) => c.id);
    const ids = onlyCharId ? [onlyCharId] : (cast.length ? cast : ["lea"]);
    let ok = 0, fail = 0, skip = 0;
    if (stEl) stEl.textContent = "Préparation…";
    for (const cid of ids) {
      const photos = extraPhotos(cid);
      if (!photos.length) continue;
      for (let i = 0; i < photos.length; i++) {
        const src = photos[i];
        let dataUrl = resolvePhotoSrc(src) || src;
        if (!dataUrl || !String(dataUrl).startsWith("data:")) {
          skip++;
          continue;
        }
        const comma = dataUrl.indexOf(",");
        const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
        const name = (String(src).startsWith("gallery:") ? String(src).split("/").pop() : ("img-" + i + ".jpg"));
        const path = basePath + "/" + cid + "/" + name;
        if (stEl) stEl.textContent = "Upload " + path + " (" + ok + " ok, " + fail + " err)…";
        try {
          // Get existing sha if any
          let sha = null;
          try {
            const gr = await fetch("https://api.github.com/repos/" + repo + "/contents/" + path, {
              headers: { Authorization: "token " + token, Accept: "application/vnd.github+json" },
            });
            if (gr.ok) {
              const gj = await gr.json();
              sha = gj.sha;
            }
          } catch (_) {}
          const body = {
            message: "lea-studio gallery backup " + cid + "/" + name,
            content: b64,
            branch: "main",
          };
          if (sha) body.sha = sha;
          const put = await fetch("https://api.github.com/repos/" + repo + "/contents/" + path, {
            method: "PUT",
            headers: {
              Authorization: "token " + token,
              Accept: "application/vnd.github+json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });
          if (put.ok) ok++;
          else {
            fail++;
            const err = await put.text();
            console.warn("gh upload", path, err.slice(0, 200));
          }
        } catch (e) {
          fail++;
          console.warn(e);
        }
      }
    }
    if (stEl) stEl.textContent = "Terminé : " + ok + " image(s) sauvegardée(s), " + fail + " erreur(s), " + skip + " ignorée(s).";
  }

  if ($("gh-save-gallery")) if ($("gh-restore")) $("gh-restore").onclick = () => restoreGalleryFromGithub();
  $("gh-save-gallery").onclick = () => uploadGalleryToGithub(null);
  if ($("gh-save-current")) $("gh-save-current").onclick = () => uploadGalleryToGithub(state.current || "lea");

  if ($("dl-sdcpp")) $("dl-sdcpp").onclick = () => {
    if (!window.LeaAndroid) {
      $("dlst").textContent = "Pas de pont natif — utilise l'APK Android.";
      return;
    }
    const dlFn2 = window.LeaAndroid.downloadSdCppModel || window.LeaAndroid.downloadSdModel;
    if (!dlFn2) {
      $("dlst").textContent = "APK trop vieux (rebuild). Pont DL absent.";
      return;
    }
    $("dlst").textContent = dlFn2.call(window.LeaAndroid, "");
    const tick = setInterval(() => {
      try { $("dlst").textContent = window.LeaAndroid.downloadStatus() || "…"; } catch (e) { $("dlst").textContent = String(e); }
    }, 800);
    setTimeout(() => clearInterval(tick), 60 * 60 * 1000);
  };
  if ($("open-ld-settings")) $("open-ld-settings").onclick = () => {
    if (window.LeaAndroid && window.LeaAndroid.openLocalDream) {
      try {
        const r = JSON.parse(window.LeaAndroid.openLocalDream() || "{}");
        $("dlst").textContent = r.action === "launch" ? "Local Dream ouvert" : "Redirection installation Local Dream…";
      } catch (e) {
        $("dlst").textContent = String(e.message || e);
      }
    } else {
      $("dlst").textContent = "Play Store : Local Dream (io.github.xororz.localdream)";
    }
  };
  if ($("dlpack")) $("dlpack").onclick = () => {
    if (!window.LeaAndroid || !window.LeaAndroid.downloadPack) {
      $("dlst").textContent = "Téléchargement natif dispo seulement dans l’APK.";
      return;
    }
    $("dlst").textContent = window.LeaAndroid.downloadPack("");
    const tick = setInterval(() => {
      $("dlst").textContent = window.LeaAndroid.downloadStatus();
    }, 1000);
    setTimeout(() => clearInterval(tick), 30 * 60 * 1000);
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
    if (b.dataset.view === "studio") renderStudio();
  };
});

(async function init() {
  // 1) Afficher IMMÉDIATEMENT les profils (évite écran noir)
  try {
    if (window.CAST && window.CAST.length) state.characters = window.CAST;
  } catch (_) {}
  try {
    renderDiscover();
  } catch (e) {
    console.error("[lea] renderDiscover", e);
    try {
      const el = document.getElementById("view-discover");
      if (el) el.innerHTML = "<h1>Découvrir</h1><p style='color:#f88'>Erreur affichage. Recharge l'app.</p>";
    } catch (_) {}
  }

  // 2) API personnages (non bloquant pour l'UI)
  try {
    const chars = await api("/api/characters");
    if (Array.isArray(chars) && chars[0]) {
      state.characters = chars;
      try { renderDiscover(); } catch (_) {}
    }
  } catch { /* CAST déjà chargé */ }

  // 3) Chat
  try {
    const chat = await api("/api/chat/" + (state.current || "lea"));
    if (chat) state.chat = chat;
  } catch { /* chat vide local */ }
  if (!state.mode) state.mode = "auto";

  // 4) Précharge SD.cpp
  try {
    if (window.LeaAndroid && window.LeaAndroid.sdCppPreload) {
      window.LeaAndroid.sdCppPreload();
    }
  } catch (_) {}

  // 5) Restore galerie GitHub EN ARRIÈRE-PLAN (ne bloque plus l'écran)
  setTimeout(function () {
    try {
      const already = localStorage.getItem("lea.gallery.restored");
      const st = JSON.parse(localStorage.getItem("lea.settings") || "{}");
      const repo = (st.githubRepo || "davidc2115/lea-studio").trim();
      const basePath = (st.githubPath || "gallery-backup").replace(/^\/+|\/+$/g, "");
      const leaEmpty = !(extraPhotos("lea") || []).length;
      if (already || !leaEmpty) return;
      console.log("[lea] auto-restore gallery (bg)…", repo);
      (async function autoRestore() {
        const headers = { Accept: "application/vnd.github+json" };
        if (st.githubToken) headers.Authorization = "token " + st.githubToken;
        const rootRes = await fetch("https://api.github.com/repos/" + repo + "/contents/" + basePath, { headers });
        const root = await rootRes.json();
        if (!Array.isArray(root)) return;
        let ok = 0;
        for (const d of root.filter((x) => x.type === "dir")) {
          const lr = await fetch("https://api.github.com/repos/" + repo + "/contents/" + d.path, { headers });
          const list = await lr.json();
          if (!Array.isArray(list)) continue;
          for (const f of list) {
            if (f.type !== "file" || !/\.(jpg|jpeg|png|webp)$/i.test(f.name) || !f.download_url) continue;
            try {
              const imgRes = await fetch(f.download_url);
              const blob = await imgRes.blob();
              let dataUrl = await new Promise((resolve, reject) => {
                const fr = new FileReader();
                fr.onload = () => resolve(fr.result);
                fr.onerror = reject;
                fr.readAsDataURL(blob);
              });
              try { dataUrl = await compressToJpeg(dataUrl, 768, 0.82); } catch (_) {}
              await addToGallery(dataUrl, d.name);
              ok++;
            } catch (_) {}
          }
        }
        if (ok > 0) localStorage.setItem("lea.gallery.restored", "1");
        console.log("[lea] restored", ok, "images");
      })().catch(function (e) { console.warn("auto-restore", e); });
    } catch (e) { console.warn("auto-restore", e); }
  }, 1500);
})();
