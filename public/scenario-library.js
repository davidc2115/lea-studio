(function (root) {
  "use strict";
  // Original story ingredients, informed by interactive-fiction structures.
  // No external character cards or story text are copied.
  const groups = ["CAST", "EXTRA_CAST", "LEA_CAST_NEW", "LEA_CAST_SPECIAL", "LEA_CAST_DIRECT", "LEA_CAST_CUPS", "LEA_CAST_COLLEGUES", "LEA_CAST_TAQUIN", "LEA_CAST_EXTRA"];
  const goals = [
    ["retrouver le propriétaire d'un souvenir oublié", "demander autour de vous ou suivre l'indice ensemble", "On mène l'enquête, ou on remet ça à demain ?"],
    ["préparer une surprise sans révéler son destinataire", "choisir la discrétion ou demander une explication", "Je te montre mon idée, mais tu promets de garder le secret ?"],
    ["tenir une promesse avant la fin de la soirée", "l'aider maintenant ou proposer une autre solution", "J'ai besoin d'un avis honnête, pas d'une réponse polie."],
    ["trancher entre deux projets auxquels elle tient", "défendre ton favori ou lui laisser inventer un compromis", "Tu prendrais le risque, toi ?"],
    ["réparer un malentendu avant qu'il ne s'aggrave", "écouter sa version ou proposer une rencontre", "Attends, ce n'est pas du tout ce que j'ai voulu dire."],
    ["terminer un défi qu'elle s'est lancé", "devenir son partenaire ou son arbitre", "Pas de raccourci : si tu m'aides, on respecte les règles."],
    ["transformer un contretemps en bonne soirée", "improviser avec elle ou remettre le programme à plat", "On peut râler, ou inventer un meilleur plan."],
    ["prendre une décision qu'elle reporte depuis des semaines", "poser une question directe ou l'aider à comparer", "D'accord, cette fois je décide. Mais reste deux minutes."],
    ["retrouver l'origine d'un message énigmatique", "examiner le message ou contacter son expéditeur", "Tu trouves ça bizarre aussi, ou je me fais un film ?"],
    ["tester une idée avant de la présenter aux autres", "essayer avec elle ou jouer l'avocat du diable", "Tu peux être mon premier test, mais pas me ménager."],
    ["faire revivre une tradition qu'elle croyait oubliée", "suivre le rituel ou en inventer une version nouvelle", "On le faisait autrement, mais j'aime bien ton idée."],
    ["relever un défi sans laisser les autres choisir à sa place", "l'encourager ou remettre le défi en question", "Je veux le faire pour moi, pas pour leur donner raison."],
  ];
  const details = [
    ["un carnet couvert de croquis", "a sketchbook with handwritten notes", "avant l'ouverture du lieu demain matin"],
    ["une enveloppe bleu nuit", "a dark blue envelope on the table", "avant le dernier départ de la soirée"],
    ["une petite boîte en bois", "a small wooden box beside her", "avant l'arrivée d'une invitée demain"],
    ["un plan annoté au crayon", "an annotated paper map", "avant que le programme ne soit confirmé"],
    ["une photographie ancienne", "an old photograph on the table", "avant le rendez-vous prévu ce week-end"],
    ["un jeu de cartes illustrées", "illustrated playing cards", "avant que sa partenaire ne rentre"],
    ["deux billets pliés", "two folded event tickets", "avant la fermeture de la billetterie"],
    ["un foulard noué à un dossier", "a scarf tied to a folder", "avant la réunion du lendemain"],
    ["une clé sans étiquette", "an unlabeled key on a tray", "avant que le propriétaire ne rappelle"],
    ["un enregistrement sur son téléphone", "a phone showing an audio recording", "avant la répétition générale"],
    ["une liste barrée à moitié", "a half-completed checklist", "avant la fin du créneau réservé"],
    ["un bracelet rapporté d'un voyage", "a travel bracelet beside a notebook", "avant le prochain appel de son amie"],
    ["une carte postale jamais envoyée", "an unsent postcard", "avant l'ouverture de la poste demain"],
    ["un petit trophée de compétition", "a small competition trophy", "avant la remise des récompenses"],
    ["une pochette de partitions", "a folder of music sheets", "avant la dernière séance de répétition"],
    ["un bouquet encore emballé", "a wrapped bouquet on the table", "avant que les fleurs ne soient récupérées"],
  ];
  // Each bank changes the event, social context, wardrobe and visible setting.
  const banks = {
    friend: {
      events: [
        "Une réservation a été annulée et elle arrive avec un programme de remplacement.",
        "Une playlist lancée par hasard réveille un souvenir que vous ne racontez pas de la même façon.",
        "Elle te rejoint après un atelier et découvre que son sac a été échangé.",
        "La soirée jeux commence plus tôt que prévu et elle refuse de choisir une équipe au hasard.",
        "Une annonce du quartier lui donne envie de participer à un projet inattendu.",
        "Elle arrive avec une invitation dont le destinataire n'est pas celui qu'elle pensait.",
      ],
      places: ["a cozy living room with a coffee table and warm lamp", "a cafe booth with a table and evening windows", "an apartment balcony with two chairs and city lights"],
      outfits: ["fitted opaque blouse and jeans", "a tailored casual jacket over a cotton top and trousers", "an opaque knit dress with ankle boots"],
    },
    visitor: {
      events: [
        "Une invitée a laissé une consigne étrange en partant et elle te demande ce que tu en penses.",
        "Elle repère un objet qui n'aurait pas dû se trouver parmi les affaires de la soirée.",
        "Un changement d'horaire vous laisse une heure libre que personne n'avait prévue.",
        "Le jeu de la soirée a été interrompu juste avant de départager les deux derniers participants.",
        "Elle a promis un coup de main pour le lendemain mais découvre que le projet a changé.",
        "La musique s'arrête et une conversation jusque-là évitée peut enfin commencer.",
      ],
      places: ["a living room after a gathering, cushions and game cards on a table", "a dining area with empty cups and a folded tablecloth", "an apartment lounge beside a warm floor lamp"],
      outfits: ["a fitted opaque evening top and tailored trousers", "an opaque casual dress and cardigan", "a satin blouse with closed buttons and dark jeans"],
    },
    office: {
      events: [
        "Deux versions du même dossier donnent des chiffres incompatibles et elle refuse de signer à l'aveugle.",
        "Un rendez-vous a été déplacé sans prévenir et elle doit inventer une présentation plus courte.",
        "Un prototype vient d'arriver avec une note qui contredit le brief officiel.",
        "Une proposition anonyme a été déposée dans la boîte à idées et elle y reconnaît un détail important.",
        "La salle de réunion a été réservée deux fois et elle propose de résoudre le problème autour d'un tableau.",
        "Un message de remerciement a été envoyé à la mauvaise personne et elle veut comprendre pourquoi.",
      ],
      places: ["an office desk with folders, a notebook and a warm desk lamp", "a meeting room with a whiteboard and conference table", "an office lounge with a coffee table and city windows"],
      outfits: ["a fitted opaque office blouse and tailored pencil skirt", "a fitted blazer, cotton top and tailored trousers", "an opaque knit office dress with classic shoes"],
    },
    student: {
      events: [
        "Un atelier pour adultes lui demande de défendre une idée à laquelle elle ne croit pas encore.",
        "Elle découvre qu'un passage de ses notes a été remplacé par une question sans signature.",
        "Le club culturel lui confie une présentation avec deux consignes contradictoires.",
        "Une inscription au concours a disparu et elle veut retrouver la preuve de son envoi.",
        "Elle te propose de tester un jeu de logique avant de l'apporter à son groupe.",
        "Une bibliothécaire lui remet une réservation qui porte le bon nom mais le mauvais titre.",
      ],
      places: ["an adult university reading room with books and a work table", "a study cafe with notebooks and a window", "a home desk with open books and a reading lamp"],
      outfits: ["a fitted opaque knit top and jeans", "a casual cotton blouse and corduroy trousers", "a cardigan over an opaque dress"],
    },
    family: {
      events: [
        "Un ancien album familial révèle une date qui ne correspond pas aux souvenirs de chacun.",
        "Une recette transmise par un proche contient une étape que personne ne sait expliquer.",
        "Le programme d'une réunion familiale vient de changer et elle souhaite entendre ton avis.",
        "Une boîte de souvenirs doit être rendue à son propriétaire et elle hésite sur la meilleure façon.",
        "Un proche prépare une surprise et elle a besoin d'un complice pour organiser les détails.",
        "Une réparation imprévue interrompt votre visite et elle veut répartir les tâches équitablement.",
      ],
      places: ["a family kitchen with a wooden table and recipe notebook", "a living room with family albums and a warm lamp", "a dining room with a sideboard and framed photos"],
      outfits: ["a casual opaque blouse and trousers", "a cotton top, cardigan and jeans", "an opaque everyday dress with flat shoes"],
    },
    babysitter: {
      events: [
        "Son dernier transport est annulé après son service ; elle organise son retour au lieu d'attendre sans rien dire.",
        "Le programme du lendemain a changé et elle souhaite vérifier les consignes avant de repartir.",
        "Une amie lui propose un atelier ; elle voudrait tester son idée avec toi pendant quelques minutes.",
        "Elle retrouve un carnet qui n'appartient à personne dans la maison et cherche à le rendre.",
        "Elle a promis d'organiser une activité associative et te demande de départager deux propositions.",
        "Elle termine sa journée avec un message inattendu et préfère demander un avis avant de répondre.",
      ],
      places: ["a dim living room, baby monitor on coffee table, sofa and warm lamp visible", "a living room beside a bookcase, baby monitor on a side table", "a living room with an armchair, baby monitor and a warm floor lamp"],
      outfits: ["a fitted opaque casual blouse and jeans", "a soft cardigan over a fitted cotton top and trousers", "an opaque fitted knit top and dark jeans"],
    },
    sport: {
      events: [
        "Le studio s'est trompé de créneau et elle doit adapter son entraînement à un espace plus petit.",
        "Elle a été invitée à une démonstration et veut essayer une séquence sans public.",
        "Une musique inconnue bouleverse la chorégraphie qu'elle avait préparée.",
        "Un accessoire d'entraînement a été échangé et elle repère une note dans la housse.",
        "Son équipe hésite entre deux programmes et elle souhaite les comparer sur des critères précis.",
        "Une inscription à un défi local se termine ce soir et elle ne veut pas décider sur un coup de tête.",
      ],
      places: ["a dance studio with mirrors, a barre and a sports bag", "a practice room with an exercise mat and a water bottle", "a gym lounge beside lockers and a wooden bench"],
      outfits: ["an opaque fitted sports top and full-length leggings", "a cotton training shirt and fitted exercise trousers", "an opaque dance top and full-length practice leggings"],
    },
    medical: {
      events: [
        "La préparation d'un atelier de prévention a pris du retard et elle demande un avis sur sa présentation.",
        "Un objet a été oublié dans la salle de pause et elle essaie d'en retrouver le propriétaire.",
        "Elle reçoit un remerciement anonyme après sa journée et cherche à comprendre le message.",
        "Une association lui propose une intervention bénévole dont le format reste à définir.",
        "Deux affiches destinées au public donnent des informations contradictoires et elle veut les corriger.",
        "Une collègue a laissé un défi dans son carnet pour égayer la prochaine pause.",
      ],
      places: ["a clinic staff lounge with chairs, a table and a noticeboard", "a health education room with leaflets and a presentation board", "a hospital staff office with a desk and a coat hook"],
      outfits: ["a clean opaque medical tunic and trousers", "a cardigan over a medical uniform", "an opaque work blouse and tailored trousers"],
    },
    fantasy: {
      events: [
        "Une carte se modifie au contact d'un objet familier et elle veut comprendre son premier indice.",
        "Une porte qui devrait rester fermée s'ouvre sur un lieu que personne ne reconnaît.",
        "Un messager lui remet une invitation portant le sceau d'une alliance oubliée.",
        "Un rituel de bienvenue échoue sans danger mais laisse une énigme à résoudre.",
        "Un marché itinérant annonce une vente inhabituelle et elle soupçonne un échange caché.",
        "Une mélodie revient chaque soir au même endroit et elle cherche quelqu'un pour l'écouter avec elle.",
      ],
      places: ["a fantasy chamber with a carved table, lanterns and scrolls", "a moonlit courtyard with a stone bench and an old map", "an enchanted library with shelves and a glowing reading lamp"],
      outfits: ["a fitted opaque fantasy tunic, belt and trousers", "an opaque embroidered fantasy dress and boots", "a tailored fantasy coat over an opaque costume"],
    },
    creative: {
      events: [
        "Une commande artistique impose deux styles opposés et elle veut défendre son interprétation.",
        "Un carton d'accessoires arrive avec une pièce qui ne figure sur aucune liste.",
        "Une répétition est interrompue par une suggestion inattendue du régisseur.",
        "Un carnet a été laissé sur scène et elle en reconnaît une page.",
        "La dernière séance avant une exposition vient d'être avancée et elle doit choisir une œuvre.",
        "Une proposition de collaboration lui plaît mais elle refuse de perdre sa liberté créative.",
      ],
      places: ["an art studio with sketches, a work table and lamps", "a rehearsal room with music sheets and chairs", "a small gallery with framed artwork and a wooden bench"],
      outfits: ["an opaque fitted blouse and casual trousers", "a cotton top under a tailored jacket and jeans", "an opaque simple dress and ankle boots"],
    },
  };
  const poses = [
    "seated diagonally on a chair, legs crossed, torso turned three quarters, face toward camera",
    "standing with weight on one leg, one hand resting on nearby furniture, shoulders angled, face toward camera",
    "leaning sideways against a table, one knee relaxed, confident posture, face toward camera",
    "standing beside a chair, one hand on its back, hips and shoulders turned, face toward camera",
    "sitting on the front edge of a sofa, legs crossed at ankles, one elbow on its arm, face toward camera",
    "pausing beside a table while holding the scenario prop, body at a diagonal, face toward camera",
  ];
  function roleBank(c) {
    const text = [c.id, c.title, ...(c.tags || [])].join(" ").toLowerCase();
    if (/babysitter|baby.?sitter/.test(text)) return "babysitter";
    if (/belle.?m[eè]re|belle.?s[oœ]ur|belle.?fille|ni[eè]ce|tante|cousine|sœur|soeur|maman|m[eè]re|daughter|sister|mother/.test(text)) return "family";
    if (/infirm|nurse|m[eé]dec|medical|h[oô]pital/.test(text)) return "medical";
    if (/secr[eé]t|coll[eè]gue|office|boss|patron|bureau/.test(text)) return "office";
    if (/[eé]tudian|student|intello|universit/.test(text)) return "student";
    if (/sport|athl|dance|danse|yoga|fitness/.test(text)) return "sport";
    if (/elf|kitsune|vampir|dragon|succub|sir[eè]ne|catgirl|fantasy|ange|d[eé]mon/.test(text)) return "fantasy";
    if (/artiste|music|actrice|chanteuse|photograph|mod[eè]le/.test(text)) return "creative";
    if (/soir[eé]e|pyjama|invit[eé]e|voisine/.test(text)) return "visitor";
    return "friend";
  }
  const counters = {};
  const seen = new Set();
  for (const key of groups) {
    for (const c of root[key] || []) {
      if (!c || !c.id || seen.has(c.id)) continue;
      seen.add(c.id);
       const role = roleBank(c), n = counters[role] || 0;
       const mermaid = /mermaid|sir[eè]ne/i.test([c.id, c.title, c.body, ...(c.tags || [])].join(" "));
       const bank = mermaid ? {
         ...banks[role],
         places: ["a moonlit lagoon beside a flat rock ledge and floating lanterns", "a sea grotto with a smooth rock seat and warm lanterns", "a sheltered shore with a stone ledge and a carved chest"],
         outfits: ["an opaque fitted fantasy bodice above a visible scaled mermaid tail", "an opaque embroidered fantasy top above a visible scaled mermaid tail", "an opaque fitted fantasy tunic above a visible scaled mermaid tail"],
       } : banks[role];
      counters[role] = n + 1;
      const goal = goals[n % goals.length], detail = details[Math.floor(n / goals.length) % details.length];
      const event = bank.events[(n + Math.floor(n / goals.length) + Math.floor(n / (goals.length * details.length))) % bank.events.length];
      // Preserve character-defining role and age, not the obsolete shared plot.
      const relation = c.name + ", " + c.age + " ans. Rôle : " + c.title + ".";
      const duo = /^duo_/i.test(c.id) || String(c.name).includes("&");
      const day = ["ce soir", "un samedi en fin de journée", "le lendemain d'un événement local"][Math.floor(n / 4) % 3];
      const sceneNumber = Math.floor(n / goals.length);
      const index = sceneNumber % bank.places.length;
       const locationFr = mermaid ? ["la lagune éclairée par la lune", "la grotte marine", "le rivage abrité"][index] : {
        office: ["le bureau", "la salle de réunion", "l'espace de pause"],
        babysitter: ["le salon", "le salon près de la bibliothèque", "le salon près du fauteuil"],
        sport: ["le studio de danse", "la salle d'entraînement", "l'espace de pause du gymnase"],
        medical: ["la salle de pause", "la salle de prévention", "le bureau du personnel"],
        fantasy: ["la chambre des archives", "la cour éclairée par la lune", "la bibliothèque enchantée"],
        student: ["la salle de lecture universitaire", "le café près du campus", "le bureau de travail"],
        family: ["la cuisine familiale", "le salon", "la salle à manger"],
        visitor: ["le salon après la réception", "la salle à manger", "le coin lecture"],
        creative: ["l'atelier", "la salle de répétition", "la galerie"],
        friend: ["le salon", "le café", "le balcon"],
      }[role][index];
      if (typeof c.scenario_legacy === "undefined") c.scenario_legacy = c.scenario;
      if (typeof c.greeting_legacy === "undefined") c.greeting_legacy = c.greeting;
      const babysitting = role === "babysitter" ? " Les enfants dorment hors de la scène ; le babyphone reste posé sur la table. La conversation ne les implique pas." : "";
      const autonomy = role === "family"
        ? " Les échanges restent familiaux, sans dimension romantique."
        : " Elle garde ses propres intentions ; rien n'impose une relation ou une réponse au joueur.";
      const pair = duo ? " Les deux personnages participent ; chacun peut donner son propre avis, sans fusion de leurs identités." : "";
      c.scenario = relation + " Lieu : " + locationFr + ", " + day + ". " + event + babysitting +
        " Avec " + detail[0] + " comme point de départ, elle souhaite " + goal[0] + " " + detail[2] + "." +
        " Ton choix : " + goal[1] + ". La réponse modifie la prochaine action, pas seulement le ton du dialogue." + autonomy + pair;
      c.greeting = "*" + c.name + (duo ? " posent " : " pose ") + detail[0] + " à portée de vue dans " + locationFr + ". " + event + "*\n" +
        goal[2] + "\n" + (duo ? "Nous avons deux idées différentes. Tu veux les entendre avant de décider ?" : "Tu préfères " + goal[1] + " ?");
      c.scenario_version = "distinct-interactive";
    }
  }
  const kenza = (root.LEA_CAST_CUPS || []).find(c => c.id === "cup_babysitter_07");
  if (kenza) {
    kenza.scenario = "Kenza Cisse, 25 ans, la babysitter. Lieu : le salon, après la fin de son service. Les enfants dorment à l'étage, hors de la scène ; le babyphone est sur la table basse. Son dernier tram vient d'être annulé et elle vérifie le prochain départ avant d'appeler un taxi. Elle a promis à sa colocataire de rentrer, mais tient aussi à finir le petit défi de cartes commencé plus tôt. Elle dispose les cartes et te propose de choisir : faire une manche rapide, comparer les solutions de transport ou lui demander ce qui l'a fait rire dans le message reçu. Elle organise elle-même son retour ; ni sa présence ni un éventuel rapprochement ne sont imposés.";
    kenza.greeting = "*Kenza pose son téléphone près du babyphone, puis étale quelques cartes sur la table basse.*\nMon tram vient de disparaître du tableau. J'ai encore deux options pour rentrer… et une revanche à prendre. Tu m'aides à choisir le trajet, ou tu acceptes une dernière manche ?";
  }
  root.LeaScenarioLibrary = { count: seen.size, roleBank, banks };
})(window);
