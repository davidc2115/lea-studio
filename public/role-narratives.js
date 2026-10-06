(function (root) {
  "use strict";
  const groups = ["CAST", "EXTRA_CAST", "LEA_CAST_NEW", "LEA_CAST_SPECIAL", "LEA_CAST_DIRECT", "LEA_CAST_CUPS", "LEA_CAST_COLLEGUES", "LEA_CAST_TAQUIN", "LEA_CAST_EXTRA"];
  const banks = root.LeaRoleStoryBanks, temperaments = root.LeaRoleTemperaments;
  if (!banks || !temperaments) throw new Error("Les banques de rôles et tempéraments doivent être chargées avant role-narratives.js.");
  const normalize = value => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/œ/g, "oe");
  const species = [
    ["elfe", /elf/], ["kitsune", /kitsune/], ["succube", /succub/], ["dragon", /dragon/],
    ["catgirl", /catgirl/], ["sirene", /sirene|mermaid/], ["ange", /\bange\b|angel/],
    ["demone", /demon/], ["vampire", /vampir/], ["fee", /\bfee\b|fairy/],
    ["dryade", /dryad/], ["lamia", /lamia/], ["harpie", /harpi|harpy/], ["slime", /slime/],
    ["androide", /android/], ["louve", /louve|werewolf/], ["centaure", /centaur/],
    ["gorgone", /gorgon/], ["oni", /\boni\b/], ["naga", /\bnaga\b/],
    ["phenix", /phenix|phoenix/], ["fantome", /fantome|ghost/], ["sorciere", /sorciere|witch/],
  ];
  function classify(text) {
    if (/belle.?mere.*epouse|mere.?de.?((ta|sa).?)?femme|bm_epouse|gendre/.test(text)) return "belle_mere_epouse";
    if (/belle.?mere.*pere|femme.?de.?((ton|son).?)?pere|maratre|bm_pere|_bm\b/.test(text)) return "belle_mere_pere";
    if (/belle.?mere/.test(text)) return "belle_mere";
    if (/belle.?fille/.test(text)) return "belle_fille";
    if (/belle.?soeur/.test(text)) return "belle_soeur";
    if (/\btante\b/.test(text)) return "tante";
    if (/maman.*ami|mere.*ami/.test(text)) return "maman_ami";
    if (/fille.*ami/.test(text)) return "fille_ami";
    if (/amie.*fille/.test(text)) return "amie_fille";
    if (/mere.*fille|jumelles|soeurs|petite soeur|grande.*soeur/.test(text)) return "family_duo";
    if (/babysitter|baby.?sitter/.test(text)) return "babysitter";
    if (/secret/.test(text)) return "secretaire";
    if (/collegue/.test(text)) return "collegue";
    if (/infirm|nurse|medec|medical/.test(text)) return "medical";
    if (/avocat/.test(text)) return "lawyer";
    if (/hotesse/.test(text)) return "hostess";
    if (/cheffe|cuisin|chef\b/.test(text)) return "chef";
    if (/mentore/.test(text)) return "mentor";
    if (/couple/.test(text)) return "partner";
    if (/colocs.*etudiantes/.test(text)) return "roommates";
    for (const [name, pattern] of species) if (pattern.test(text)) return "fantasy_" + name;
    if (/soiree.*jeu|\bjeu\b/.test(text)) return "jeu";
    if (/voisin/.test(text)) return "voisine";
    if (/danse|dance/.test(text)) return "dancer";
    if (/sport|athl|yoga|fitness|crossfit|bodybuilder/.test(text)) return "coach";
    if (/etudian|student|intello|universit/.test(text)) return "student";
    if (/mannequin|modele/.test(text)) return "model";
    if (/artiste|music|actrice|chanteuse|photograph/.test(text)) return "artist";
    if (/\bamie?s?\b/.test(text)) return "amie";
    return null;
  }
  function roleOf(c) {
    // Explicit role titles outrank stale tags inherited from another character.
    return classify(normalize(c.title)) ||
      (c.id === "lea" ? "amie_fille" : classify(normalize([c.id, ...(c.tags || [])].join(" ")))) || "amie";
  }
  const complications = {
    family: [
      "Le temps disponible oblige à distinguer ce qui peut être réglé aujourd'hui de ce qui mérite une autre discussion.",
      "Un proche a déjà fait une proposition différente ; elle souhaite la considérer sans renoncer à sa propre idée.",
      "Elle découvre qu'une habitude ancienne convient aux uns mais pèse sur les autres ; elle veut entendre les deux points de vue.",
      "Une promesse faite trop vite complique le choix ; elle préfère la renégocier plutôt que la cacher.",
      "Le coût réel n'est pas celui qui avait été prévu ; elle veut modifier le programme sans faire porter la charge à quelqu'un.",
      "Il manque une information que seul un autre proche connaît ; il faut décider de l'appeler ou d'attendre.",
      "Une remarque a été mal comprise ; elle souhaite dissiper ce malentendu avant de passer au côté pratique.",
      "Elle n'a jamais formulé sa préférence clairement ; cette fois, elle aimerait l'expliquer sans imposer un vote immédiat.",
      "Deux personnes ont des besoins opposés ; elle cherche une solution qui ne transforme pas l'une en perdante.",
      "Un détail personnel ne doit pas être partagé avec tout le monde ; elle veut fixer ce qui restera privé.",
      "Le plan initial dépendait de quelqu'un qui s'est retiré ; elle propose de revoir les responsabilités.",
      "Elle aimerait tester une version modeste de son idée avant d'engager toute la famille.",
    ],
    work: [
      "Une information reçue n'est pas confirmée ; elle veut la vérifier avant d'agir.",
      "Le temps disponible s'est réduit ; elle doit choisir ce qu'il est raisonnable de traiter maintenant.",
      "Une autre personne propose une méthode opposée ; elle souhaite comparer les conséquences avant de trancher.",
      "Une responsabilité a été promise sans être définie ; elle veut clarifier qui fera quoi.",
      "Les moyens disponibles sont plus limités que prévu ; elle cherche une solution réalisable sans fausse promesse.",
      "Un accord verbal n'a pas été compris de la même façon ; elle veut reformuler les attentes.",
      "Elle préfère reconnaître une incertitude plutôt que donner une réponse rassurante mais fragile.",
      "Un changement de dernière minute oblige à vérifier une hypothèse qui paraissait acquise.",
      "Elle ne veut pas que la solution repose sur une personne toujours disponible ; elle propose de mieux répartir l'effort.",
      "Deux options sont valables mais n'ont pas le même coût ; elle veut rendre ce compromis visible.",
      "Un détail confidentiel ne peut pas circuler librement ; elle cherche comment expliquer le problème sans le dévoiler.",
      "Elle aimerait tester une solution limitée avant de l'adopter comme nouvelle règle.",
    ],
    social: [
      "Elle hésite à montrer une version encore imparfaite et cherche un avis utile, pas un compliment automatique.",
      "Deux envies s'opposent ; elle souhaite un compromis qui ne revienne pas toujours à céder.",
      "Un changement de programme remet en question le temps prévu ; elle veut savoir ce qui compte le plus.",
      "Une promesse à quelqu'un d'autre limite ses possibilités ; elle veut en parler avant de s'engager.",
      "Le budget oblige à choisir une priorité ; elle préfère décider ensemble plutôt que prétendre que tout est possible.",
      "Un message ambigu a créé une attente différente de la sienne ; elle veut clarifier sans accuser.",
      "Elle veut conserver une part privée de ce projet et choisir elle-même ce qu'elle partage.",
      "Une connaissance a déjà donné un avis très assuré ; elle voudrait entendre un autre point de vue.",
      "Elle a peur de recommencer une erreur ancienne mais ne veut pas laisser cette peur décider à sa place.",
      "Le plan initial dépend d'une disponibilité incertaine ; elle propose un essai plus simple.",
      "Elle souhaiterait sortir d'une habitude commune sans faire croire qu'elle rejette l'autre personne.",
      "Elle préfère commencer petit puis ajuster à partir d'un vrai retour plutôt que préparer indéfiniment.",
    ],
    fantasy: [
      "Deux témoignages ne concordent pas ; elle veut comprendre leurs différences avant de choisir une version.",
      "Une limite de son univers empêche la solution la plus facile ; elle cherche une autre méthode.",
      "Un ancien accord interdit de tout révéler ; elle doit expliquer ce qu'elle peut sans trahir sa parole.",
      "Un indice dépend du point de vue de celui qui l'observe ; elle propose de comparer vos interprétations.",
      "La prochaine étape ne peut pas être annulée facilement ; elle souhaite vérifier les conséquences d'abord.",
      "Une autre communauté a un usage différent ; elle veut négocier sans présenter le sien comme supérieur.",
      "Elle souhaite préserver un souvenir personnel qui n'a pas à devenir public pour résoudre le problème.",
      "Une occasion ne se présentera qu'une fois ; elle doit distinguer l'urgence réelle de la peur de manquer.",
      "Une réputation complique l'échange ; elle voudrait qu'on juge sa proposition plutôt que sa nature.",
      "Elle veut essayer une version sans danger avant de confier le projet à d'autres.",
      "Deux intérêts légitimes s'opposent ; elle refuse qu'un accord masque simplement le conflit.",
      "Un engagement ancien a perdu son sens ; elle souhaite décider ce qu'il convient encore de respecter.",
    ],
  };
  const motives = [
    "souhaite être écoutée sans qu'on décide pour elle",
    "veut tenir sa parole sans promettre l'impossible",
    "cherche une coopération où les responsabilités sont visibles",
    "préfère un retour sincère à une approbation de façade",
    "aimerait essayer une nouvelle façon de faire",
    "veut poser une limite sans couper la discussion",
    "souhaite comprendre un désaccord plutôt que gagner immédiatement",
    "veut préserver ce qui est personnel tout en avançant",
    "cherche un premier pas concret plutôt qu'un plan parfait",
    "veut assumer son choix tout en acceptant de le revoir",
    "aimerait sortir d'une habitude qui ne lui convient plus",
    "souhaite choisir le bon rythme au lieu de suivre une urgence imposée",
  ];
  const oldStyle = /^(?:timide|directe?|tactile|flirt|flirty|espi[eè]gle|taquine?s?|coquine?|provocante?|chaude|froide|distante|autoritaire|exigeante|dominante|stricte|fragile|c[aâ]line|douce|sensible|extravertie|romanti(?:que|ce)|r[eé]serv[eé]e|exhibitionniste|exhibitioniste)$/i;
  const catalog = () => [...new Map(groups.flatMap(key => root[key] || []).filter(c => c && c.id).map(c => [c.id, c])).values()];
  const roster = catalog().map(c => ({ id: c.id, role: roleOf(c) }));
  const rankById = new Map();
  for (const role of new Set(roster.map(c => c.role))) {
    roster.filter(c => c.role === role).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).forEach((c, index) => rankById.set(c.id, index));
  }
  function apply(characters = catalog()) {
    const fallbackRanks = {};
    for (const c of characters) {
      if (!c || !c.id || c.imported || String(c.id).startsWith("imp_")) continue;
      if (c.story_profile && c.story_profile.version === "role-scenes-v5") continue;
      const role = roleOf(c), bank = banks[role] || banks.belle_mere || banks.amie;
      if (!bank) throw new Error("Banque de scénarios absente : " + role);
      if (Number(c.age) < 18) throw new Error("Le catalogue de rôles nécessite des personnages adultes : " + c.id);
      const n = rankById.get(c.id) ?? (fallbackRanks[role] || 0);
      fallbackRanks[role] = (fallbackRanks[role] || 0) + 1;
      const family = bank.category === "family";
      const eligible = Object.keys(temperaments);
      const primary = eligible[n % eligible.length], temperament = temperaments[primary];
      const secondary = temperament.nuance[Math.floor(n / eligible.length) % temperament.nuance.length];
      const duo = Boolean(c.multiSpeaker || /^duo_/i.test(c.id) || String(c.name).includes("&"));
      const speakers = duo ? String(c.name).split(/\s*&\s*|\s+et\s+/i).filter(Boolean) : [];
      // Belle-mère : distinguer mère de l'épouse vs femme du père
      let effectiveRole = role;
      let effectiveBank = bank;
      if (role === "belle_mere" || role === "belle_mere_epouse" || role === "belle_mere_pere") {
        const blob = normalize([c.id, c.title, ...(c.tags || [])].join(" "));
        const forceEpouse = /epouse|mere.?de.?((ta|sa).?)?femme|gendre|bm_epouse/.test(blob);
        const forcePere = /pere|maratre|femme.?de.?((ton|son).?)?pere|bm_pere|_bm\b/.test(blob);
        if (role === "belle_mere_epouse" || forceEpouse) effectiveRole = "belle_mere_epouse";
        else if (role === "belle_mere_pere" || forcePere) effectiveRole = "belle_mere_pere";
        else effectiveRole = (n % 2 === 0) ? "belle_mere_epouse" : "belle_mere_pere";
        effectiveBank = banks[effectiveRole] || banks.belle_mere || bank;
      }
      const plots = effectiveBank.plots;
      const beat = n % plots.length;
      const rawPlot = plots[beat];
      let personalPremise, greetingExtra;
      if (typeof rawPlot === "string" && rawPlot.includes("|||")) {
        const parts = rawPlot.split("|||");
        personalPremise = parts[0].trim();
        greetingExtra = parts.slice(1).join("|||").trim().replace(/\\n/g, "\n");
      } else if (rawPlot && typeof rawPlot === "object") {
        personalPremise = rawPlot.s || rawPlot.scene || String(rawPlot);
        greetingExtra = rawPlot.g || rawPlot.greeting || "";
      } else {
        personalPremise = c.id === "cup_babysitter_07"
          ? "Son dernier tram est annulé après son service. Elle a promis à sa colocataire de rentrer et veut comparer les trajets tout en terminant la revanche de cartes commencée plus tôt."
          : String(rawPlot);
        greetingExtra = "";
      }
      const premise = duo ? personalPremise.replace(/^Elle /, "La première ") : personalPremise;
      const complication = complications[effectiveBank.category] ? complications[effectiveBank.category][Math.floor(n / plots.length) % complications[effectiveBank.category].length] : "";
      const sourceScenario = String(c.scenario || "");
      const place = (sourceScenario.match(/Lieu\s*:\s*([^,.]+)/i) || [])[1] || "le lieu de la scène";
      const picturedProp = (sourceScenario.match(/Avec (.*?) comme point de départ/i) || [])[1];
      const prop = picturedProp || (c.id === "cup_babysitter_07" ? "son téléphone près du babyphone" : (effectiveBank.prop && effectiveBank.prop[0]) || "un détail de la pièce");
      if (typeof c.personality_legacy === "undefined") c.personality_legacy = c.personality;
      if (typeof c.scenario_before_role_rewrite === "undefined") c.scenario_before_role_rewrite = c.scenario;
      if (typeof c.greeting_before_role_rewrite === "undefined") c.greeting_before_role_rewrite = c.greeting;
      c.title = String(c.title || "").split("·").map(part => part.trim().replace(/\s+taquine?s?$/i, "")).filter(part => part && !oldStyle.test(part)).join(" · ");
      c.tags = (c.tags || []).filter(tag => !oldStyle.test(String(tag).trim()) && (!classify(normalize(tag)) || classify(normalize(tag)) === role || classify(normalize(tag)) === effectiveRole));
      c.tags.unshift(temperament.label.toLowerCase(), secondary);
      if (effectiveRole === "belle_mere_epouse" && !c.tags.includes("belle-mère")) c.tags.unshift("belle-mère", "mère de ta femme");
      if (effectiveRole === "belle_mere_pere" && !c.tags.includes("belle-mère")) c.tags.unshift("belle-mère", "femme de ton père");
      const speakerProfiles = speakers.map((name, i) => {
        const key = eligible[(n + i * 3) % eligible.length], trait = temperaments[key];
        return { name: name.trim(), primary: key, line: trait.line, gesture: trait.gesture };
      });
      const limits = "Tout le monde est adulte (18+). Elle peut flirter, refuser, attendre ou aller plus loin selon son tempérament. Ne jamais inverser les rôles ni changer qui est qui.";
      // Scénario centré sur la scène (sans digressions génériques)
      c.scenario = c.name + " — " + (effectiveBank.relation || bank.relation) + "\n" +
        premise + "\n" +
        (duo ? "Deux personnages adultes." : (c.age + " ans.")) +
        " Rôle : " + c.title + ". Lieu : " + place + ".\n" +
        "Repère : " + prop + ".\n" +
        "La situation de départ ci-dessus reste la référence tant que l'historique ne l'a pas fait évoluer. " + limits;
      // Message d'accueil = scène + réplique liée (plus de phrase de tempérament hors sujet)
      if (greetingExtra) {
        c.greeting = greetingExtra;
      } else if (duo) {
        c.greeting = "*" + premise + "*\n" + speakerProfiles.map((p, i) => p.name + " : " + (i ? "Je suis là aussi." : "On est là.")).join("\n");
      } else {
        c.greeting = "*" + premise + "*\n*Elle s'arrête face à toi, encore prise dans la situation.*\n" +
          "Tu as une minute ? Il fallait que je te parle de ça.";
      }
      c.personality = temperament.label + ". " + (temperament.blurb || temperament.line || "") + " " + secondary + ". " +
        (duo ? "Duo : chaque voix garde sa personnalité." : "Une seule voix.");
      c.story_profile = {
        version: "role-scenes-v5",
        role: effectiveRole,
        relation: effectiveBank.relation || bank.relation,
        family: effectiveBank.category === "family",
        temperament: primary,
        secondary,
        speakers: speakers,
        premise: premise
      };
      c.scenario_version = "role-scenes-v5";
    }
    return characters;
  }
  function instructions(c) {
    if (!c.story_profile) return "";
    const profile = c.story_profile;
    return [
      "La fiche actuelle ci-dessous fait autorité sur les anciens exemples génériques de rôle ou de tempérament.",
      "Tu incarnes uniquement " + c.name + " ; tous les personnages sont adultes. Réponds en français naturel.",
      "Rôle et lien exacts : " + c.title + ". " + profile.relation,
      "Situation de départ : " + c.scenario,
      "Personnalité à suivre dans les paroles, actions et décisions : " + c.personality,
      "Apparence fixe : " + (c.appearance || "") + ". Morphologie fixe : " + (c.body || "") + ". Conserve tous les traits non humains éventuels.",
      "Reste dans le lieu et la situation réellement établis par l'historique ; le scénario de départ n'efface pas la progression sauvegardée.",
      "Un tempérament n'est pas une disponibilité automatique. Respecte les refus, le rythme choisi et les décisions du joueur.",
      "Cadre adulte 18+. Respecte le rôle exact (belle-mère = mère de la femme OU femme du père, jamais l'inverse des liens). Elle peut flirter ou refuser selon son tempérament. N'impose ni amour forcé ni refus systématique.",
      "Les situations de départ sont non explicites. Le goût de se montrer reste une expression choisie, sans imposer une exposition aux tiers.",
      profile.speakers.length ? "Deux voix distinctes. Préfixe chaque réplique par le nom de celle qui parle et respecte sa personnalité individuelle."
        : "Une seule voix, celle du personnage. N'écris pas les paroles, pensées ou décisions du joueur.",
      "Format : (pensée brève), *action cohérente*, puis paroles. Réponse de 3 à 7 phrases, sans notes système ni répétition du message du joueur.",
    ].join("\n\n");
  }
  root.LeaRoleNarratives = { apply, instructions, roleOf, groups, catalog, banks, temperaments };
  apply();
})(window);
