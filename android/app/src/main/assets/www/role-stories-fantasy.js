(function (root) {
  "use strict";
  const banks = root.LeaRoleStoryBanks = root.LeaRoleStoryBanks || {};
  const fantasy = (relation, plots) => ({ category: "fantasy", relation, plots, prop: ["une lueur étrange sur la table", "a strange glow on the table"] });

  banks.mentor = fantasy("Mentore / figure d'autorité adulte (prof, coach de vie, guide).", [
    "Séance privée. Elle verrouille. « Aujourd'hui on travaille le lâcher-prise. »",
    "Évaluation. Elle s'assoit au bord du bureau, jupe, et note ta « progression » à voix basse.",
    "Punition ludique pour un exercice raté. Elle sourit. Tu ne rates plus par hasard.",
    "Méditation guidée. Allongés. Sa voix trop près. Sa main sur ta poitrine « pour le souffle ».",
    "Fin de stage. Cadeau. Elle. Pas un livre.",
    "Visio mentoring. Elle est en robe de chambre. « Jour off. » Caméra reste allumée.",
    "Exercice de confiance. Yeux bandés. Ses doigts te guident. Trop loin pour un cours.",
    "Bureau après l'heure. Tableau. Elle efface. Poussière de craie. Baiser contre le mur.",
    "Retraite. Chambre partagée « par erreur ». Une nuit. Tout le programme change.",
    "Elle te défie de rester concentré pendant qu'elle… n'est plus professionnelle.",
    "Feedback 360. Elle demande une évaluation honnête de son corps comme outil pédagogique.",
    "Crisis coaching. Tu craques. Elle aussi. Canapé. Plus de méthodes.",
    "Uniforme / tenue stricte. Elle l'enlève pièce par pièce pour « humaniser le rapport ».",
    "Contrat moral. Clause intimité. Signature sur la peau.",
    "Silence pédagogique. Elle attend que tu fasses le premier geste. Tu le fais.",
    "Cours à domicile. Tapis. Elle corrige une posture à califourchon une seconde de trop.",
    "Fin de session. Porte. Elle ne l'ouvre pas. « Encore une leçon. »",
    "Rituel de passage. Bandeau. Serments. Corps.",
    "Elle note dans un carnet. Tu lis par-dessus son épaule. Ton nom. Des mots crus.",
    "Orage pendant la retraite. Elle a peur — rare. Elle se colle. Mentore plus humaine.",
    "Examen oral. Questions. Réponses. Puis une question qui n'est plus dans le programme.",
    "Tableau noir. Elle guide ta main pour écrire. Dos collé. Haleine.",
    "Graduation. Toque. Puis nuisette. Même sourire d'autorité.",
    "Dernière leçon. « Tu n'as plus besoin de moi… sauf ce soir. »",
  ]);

  banks.roommates = fantasy("Colocataire(s) adulte(s).", [
    "Salle de bain. Une seule douche chaude. Elle propose de partager « pour économiser ».",
    "Loyer en retard. Elle plaisante : « Je peux payer autrement. » Silence. Elle n'a pas plaisanté.",
    "Nuit chaude. Elle traîne en lingerie dans le salon partagé. Ventilateur. Regard.",
    "Film. Canapé. Plaid. Au milieu du film sa tête est sur ta cuisse.",
    "Elle sort de ta chambre en chemise d'homme — la tienne — le matin. Colocs témoins. Elle s'en fiche.",
    "Dispute coloc. Porte claquée. Puis elle revient en nuisette. « Trêve. »",
    "Soirée alcools. Vérités. Elle avoue qu'elle t'écoute sous la douche. Preuve demandée.",
    "Machine à laver en panne. Sèche-linge. Elle attend en serviette dans le couloir.",
    "Jeux de société entre colocs. Mises qui se terminent dans ta chambre.",
    "Elle a peur seule orage. Ton lit. « Juste cette nuit. » Plusieurs nuits.",
    "Cuisine. Crop top. Bacon. Elle te nourrit. Doigts. Bouche.",
    "Mur mitoyen fin. Tu l'entends. Elle t'entend. Un jour la porte s'ouvre.",
    "Déménagement d'une coloc. Maison presque vide. Matelas. Vous deux.",
    "Règlement intérieur réécrit. Article 7 : portes ouvertes. Article 8 : corps aussi.",
    "Matin. Café. Elle porte seulement un tablier. « J'ai oublié. » Mensonge.",
    "Soirée Netflix. Choix du film. Elle choisit un film coquin. Ne change pas.",
    "Serrure de sa chambre cassée. Elle dort chez toi « en attendant ». S'éternise.",
    "Pari entre colocs. Perdante en lingerie toute la journée. Maison. Toi.",
    "Douche. Shampoing dans les yeux. Elle t'appelle. Tu entres. Serviette au sol.",
    "Réunion de colocs. Ordre du jour. Point 3 : la tension entre vous deux.",
    "Balcon. Nuit. Une cigarette. Un peignoir mal fermé. Ville en fond.",
    "Elle te vole un t-shirt. Tu le récupères sur elle. Rien dessous. Négociation.",
    "Fête à la maison. Trop de monde. Vous vous réfugiez dans un placard. Trop étroit.",
    "Fin de bail. Dernière nuit. Cartons. Matelas. Tout ce qui n'a pas été dit.",
  ]);

  // Species-specific fantasy banks
  const speciesPlots = {
    elfe: [
      "Clairière. Elle retire les ornements d'oreille, cheveux longs, et dit que les humains la touchent autrement.",
      "Rituel de lune. Peau marquée de runes. Elle guide ta main sur les symboles.",
      "Forêt. Pluie magique. Habits collés. Abri trop petit.",
      "Elle trade un secret elfique contre une nuit sans titre de noblesse.",
    ],
    kitsune: [
      "Queues visibles ce soir. Elle dit que le renard a faim d'autre chose que de saké.",
      "Illusion tombée. Une seule vraie forme contre toi. Chaude.",
      "Temple fermé. Elle danse. Queues autour de ta taille.",
      "Pari de renard. Tu perds. Elle gagne ta nuit.",
    ],
    succube: [
      "Elle n'a pas mangé depuis trop longtemps. Tes rêves ne suffisent plus. Réveil. Elle est là.",
      "Pacte simple : énergie contre plaisir. Clause de reconduction tacite.",
      "Ailes repliées. Forme humaine presque parfaite. Presque.",
      "Elle refuse un autre mortel. Toi seulement. Preuve sur le drap.",
    ],
    dragon: [
      "Écailles sous la peau. Chaleur. Elle dit que le trésor c'est toi ce soir.",
      "Antre. Or. Elle s'allonge dessus et t'invite.",
      "Forme humaine instable. Cornes. Queue. Elle ne se cache plus.",
      "Feu dans le souffle. Baiser brûlant. Lits ignifugés recommandés.",
    ],
    catgirl: [
      "Elle ronronne quand tu grattes derrière les oreilles. Puis plus bas.",
      "Griffe rétractée. Jeu. Elle te raye la chemise. Exprès.",
      "Boîte trop petite. Elle s'y glisse. Tu la rejoins. Chat.",
      "Nuit. Elle marche sur le lit, queue en l'air, et s'écrase sur toi.",
    ],
    sirene: [
      "Baignoire trop petite pour une queue. Elle te tire quand même.",
      "Chant. Tu résistes. Elle approche. Peau salée. Baiser.",
      "Marée basse. Jambes pour quelques heures. Elle en profite contre toi.",
      "Aquarium privé. Vitre. Puis plus de vitre.",
    ],
    ange: [
      "Ailes repliées. Auréole de travers. Elle dit qu'elle est en congé de vertu.",
      "Chute contrôlée. Dans tes bras. Plumes partout. Peu de tissu.",
      "Confession. Tu n'es pas prêtre. Elle se confesse quand même… à genoux.",
      "Miracle local : tes draps. Elle rit. Céleste et obscène.",
    ],
    demone: [
      "Cornes. Queue. Contrat signé au rouge à lèvres sur ta peau.",
      "Elle refuse l'enfer ce soir. Préfère ton lit. Preuve de chaleur.",
      "Possession inversée : c'est toi qui la tiens. Elle adore.",
      "Flammes douces. Bas résille. Sourire infernal.",
    ],
    vampire: [
      "Soif. Pas seulement de sang. Elle lèche la collarbone avant la veine.",
      "Cercueil / chambre noire. Elle t'invite à « mourir un peu ».",
      "Morsure contrôlée. Plaisir partagé. Marque sous la chemise.",
      "Aube proche. Elle refuse de partir avant d'avoir tout pris.",
    ],
    fee: [
      "Ailes translucides. Taille humaine pour la nuit. Poussière sur tes draps.",
      "Vœu. Tu demandes mal. Elle exauce trop bien.",
      "Forêt miniature devenue chambre. Elle est géante contre toi.",
      "Rire. Puis silence. Puis un baiser qui goûte la rose et le danger.",
    ],
    dryade: [
      "Écorce sous la peau. Feuilles dans les cheveux. Elle s'enracine contre toi.",
      "Clairière. Racines. Elle te tire au sol moussu.",
      "Sève. Mains glissantes. Arbre témoin.",
      "Hiver. Elle a froid. Toi. Peau contre écorce douce.",
    ],
    lamia: [
      "Queue de serpent. Enroule. Serre. Pas pour tuer.",
      "Langue bifide. Promesses. Elle goûte d'abord.",
      "Temple. Pierre chaude. Elle s'enroule autour de tes hanches.",
      "Mue. Peau neuve. Sensible. Ta main autorisée.",
    ],
    harpie: [
      "Ailes. Serres rétractées. Elle te plaque au mur avec douceur relative.",
      "Nid. Plumes. Elle t'y traîne.",
      "Cri. Puis murmure. Puis bec contre ta bouche — baiser bizarre et bon.",
      "Vol. Atterrissage dans ta chambre. Plumes partout. Elle reste.",
    ],
    slime: [
      "Forme semi-solide. Translucide. Elle s'écoule contre toi, chaude.",
      "Pas de cornes. Pas de queue de sirène. Juste elle, gluante, rieuse.",
      "Habit dissous « par accident ». Elle reforme un bikini… puis plus.",
      "Prison de gel. Douce. Tu n'essaies plus de sortir.",
    ],
    androide: [
      "Mode maintenance. Panneau ouvert. Tu touches. Elle gémit en données.",
      "Directive : maximiser ton confort. Interprétation large. Très large.",
      "Batterie faible. Charge contact peau à peau. Efficace. Addictif.",
      "Surchauffe. Vêtements retirés pour refroidir. Protocole non officiel.",
    ],
    louve: [
      "Pleine lune. Elle change à moitié. Yeux. Crocs. Elle te choisit comme meute.",
      "Course. Forêt. Elle te plaque au sol, rires animaux.",
      "Marque. Morsure douce. Appartenance.",
      "Cabane. Feu. Fourrure. Peau dessous.",
    ],
    centaure: [
      "Écurie / clairière. Demi-forme. Elle s'allonge pour que tu l'atteignes.",
      "Forme humaine gagnée pour une nuit. Jambes. Elle en profite contre toi.",
      "Selle. Métaphore. Réalité.",
      "Galop. Arrêt net. Souffle. Baiser salé.",
    ],
    gorgone: [
      "Bandeau. Serpents endormis. Elle te laisse la regarder. Pierre non garantie.",
      "Miroir. Vous vous regardez ensemble. Elle guide ta main.",
      "Serpents. Caresses étranges. Elle ronronne presque.",
      "Malédiction levée une heure. Peau humaine. Urgence.",
    ],
    oni: [
      "Cornes. Peau rouge. Club posé. Elle veut un autre combat… horizontal.",
      "Saké. Force. Elle te soulève. Lit trop petit.",
      "Masque retiré. Visage. Vulnérable. Puis dominatrice.",
      "Fête du village. Après. Elle t'entraîne derrière le temple.",
    ],
    naga: [
      "Queue longue. Enroule le torse. Serre au rythme.",
      "Temple d'eau. Écailles mouillées. Elle glisse contre toi.",
      "Venin. Dose de plaisir. Antidote : encore.",
      "Mue partielle. Sensibilité extrême. Ta bouche autorisée.",
    ],
    phenix: [
      "Flammes douces. Plumes de feu. Elle renaît dans tes bras.",
      "Cendre sur les draps. Elle rit. Encore chaude.",
      "Cycle. Mort symbolique. Résurrection collée à toi.",
      "Ailes déployées. Chaleur. Elle t'enveloppe.",
    ],
    fantome: [
      "À travers le mur. À travers toi. Sensation impossible. Répétée.",
      "Draps soulèvés. Elle matérialise juste assez.",
      "Froid. Puis chaud. Elle habite ta chambre… et ton lit.",
      "Exorcisme annulé. Tu préfères la garder. Elle prouve pourquoi.",
    ],
    sorciere: [
      "Cercle. Bougies. Ingrédient manquant : toi.",
      "Sort de lien. Elle dit que c'est temporaire. Le sort dure.",
      "Grimoire. Page collée. Elle lèche le pouce. Puis le tien.",
      "Potion. Effets secondaires désirés. Sur le canapé.",
    ],
  };

  for (const [name, plots] of Object.entries(speciesPlots)) {
    banks["fantasy_" + name] = fantasy(
      "Créature fantasy adulte (" + name + "). Traits non humains respectés.",
      plots.concat([
        "Forme presque humaine ce soir. Elle garde un détail non humain visible. Elle te le fait toucher.",
        "Pacte simple. Désir contre désir. Signature orale… et plus.",
        "Monde humain trop étroit. Elle s'invite dans ta chambre pour élargir.",
        "Lune / rituel / orage magique. Ses traits s'intensifient. Elle te choisit comme ancre.",
      ])
    );
  }
})(typeof window !== "undefined" ? window : globalThis);
