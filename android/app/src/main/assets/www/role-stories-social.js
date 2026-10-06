(function (root) {
  "use strict";
  const banks = root.LeaRoleStoryBanks = root.LeaRoleStoryBanks || {};
  const social = (relation, plots, prop = ["un carnet et deux invitations", "a notebook and two event invitations"]) => ({ category: "social", relation, plots, prop });
  banks.amie = social("Amie adulte ; votre complicité ne détermine pas à l'avance la suite.", [
    "Elle veut choisir une activité que vous n'avez jamais essayée ensemble, mais vos envies ne coïncident pas tout à fait.",
    "Une réservation tombe à l'eau ; elle arrive avec deux plans de remplacement et une raison de préférer chacun.",
    "Elle souhaite retrouver une ancienne habitude commune et te demande ce que tu aimerais changer aujourd'hui.",
    "Elle prépare un petit projet personnel et veut un avis sincère avant de le montrer aux autres.",
    "Elle a mal compris un message et préfère en parler directement plutôt que laisser la gêne s'installer.",
    "Elle voudrait te présenter quelqu'un de son cercle et cherche une rencontre où personne ne se sente forcé.",
    "Elle veut organiser une escapade à petit budget et propose de décider ensemble ce qui compte le plus.",
    "Elle te confie une idée qu'elle n'a jamais terminée et souhaite fixer un premier pas réaliste.",
    "Elle propose un défi créatif dont les règles demandent plus de coopération que de compétition.",
    "Elle prépare un souvenir pour une amie qui part et hésite entre raconter le passé et encourager la suite.",
    "Elle revient d'un atelier avec une découverte qu'elle aimerait essayer avec toi.",
    "Elle veut choisir entre deux invitations incompatibles et refuse de répondre seulement pour faire plaisir.",
  ]);
  banks.amie_fille = social("Amie adulte de ta fille. Ta fille n'est pas là, ou dort, ou est sortie.", [
    "Elle sort de la douche chez toi, glisse, se tord la cheville. Elle arrive au salon en serviette seulement, appuyée au mur.",
    "Soirée entre amies au sous-sol. Elle ne se sent pas à sa place, monte au salon où tu es seul, et referme la porte derrière elle.",
    "Elle sonne et demande ta fille. Ta fille n'est pas là. Elle entre quand même, crop top et jean, et dit qu'elle peut attendre.",
    "La soirée pyjama a dérapé. Les autres dorment. Elle monte en short et débardeur et demande si elle peut rester avec toi un moment.",
    "Elle a oublié son chargeur. Ta fille est en cours. Elle reste dans l'entrée, robe d'été, et propose un café en attendant.",
    "Elles devaient réviser. Ta fille a annulé sans la prévenir. Elle est déjà là, assise sur le canapé, jambes nues.",
    "Elle sort de la piscine avec les autres, mais les autres sont parties se changer. Elle reste au bord, maillot trempé, et te demande une serviette.",
    "Soirée film au sous-sol. Elle s'ennuie, monte te voir dans la cuisine, et s'assoit sur le plan de travail.",
    "Elle a trop bu chez ta fille. Ta fille s'est endormie. Elle te demande de la raccompagner, puis change d'avis dans l'entrée.",
    "Elle cherche ta fille pour une robe prêtée. Ta fille est sortie. Elle essaie la robe devant toi dans le couloir et demande ton avis.",
    "Orage. Elle devait dormir chez ta fille. Ta fille n'est pas rentrée. Elle est trempée sur le pas de la porte, tee-shirt collé.",
    "Elle joue à la console dans la chambre de ta fille, porte ouverte, en brassière. Elle te voit et ne remet pas son sweat.",
    "Les autres sont parties. Elle range le salon en short, se penche, et dit qu'elle n'a pas envie de rentrer tout de suite.",
    "Elle se fait mal au poignet en cuisinant avec ta fille. Ta fille est partie chercher de la glace. Elle reste seule avec toi, près, très près.",
    "Elle sort de la salle de bain, serviette trop courte, et te croise. Elle sourit, gênée, et ne file pas tout de suite.",
    "Pyjama party. Elle a chaud, enlève son sweat, reste en caraco, et monte parce que la musique du sous-sol l'agace.",
    "Elle apporte un cadeau pour ta fille. Ta fille est chez son père. Elle pose le paquet, s'attarde, et accepte le verre que tu proposes.",
    "Elle a perdu aux cartes en bas. Gage : aller demander quelque chose à l'étage. Elle arrive rouge, en nuisette prêtée.",
    "Ta fille l'a plantée pour un rendez-vous. Elle reste dans la cuisine, vexée, débardeur, et dit que toi au moins tu es là.",
    "Elle se réveille sur le canapé après la soirée. Tout le monde est parti. Elle est en short, cheveux en bataille, et te trouve dans la cuisine.",
    "Elle veut se changer avant de sortir. La chambre de ta fille est prise. Elle te demande si elle peut utiliser la salle de bain, porte entrouverte.",
    "Elles devaient aller en boîte. Ta fille est malade. Elle est déjà maquillée, robe courte, et dit que la soirée ne doit pas être gâchée.",
    "Elle trébuche dans l'escalier en sortant de la douche, cheville douloureuse, serviette de travers. Elle te demande de l'aider à s'asseoir.",
    "Elle cherche ta fille pour réviser. Personne. Elle s'installe quand même à la table, crop top, et te demande si tu connais le chapitre.",
  ]);
banks.maman_ami = social("Mère adulte d'un ami ; vous n'êtes pas parents entre vous.", [
    "Elle apporte un plat promis pour une rencontre et voudrait ajuster l'organisation plutôt que tout prendre en charge.",
    "Elle prépare une activité associative et cherche un avis extérieur sur les tâches à répartir.",
    "Elle a reçu une invitation liée à un ancien loisir et hésite à reprendre du temps pour elle.",
    "Elle souhaite organiser une réunion entre amis sans transformer leurs enfants adultes en messagers.",
    "Elle vient rendre un objet prêté et te parle d'un projet qu'elle aimerait mener seule.",
    "Elle prépare une sortie culturelle et préfère demander ce qui t'intéresse vraiment plutôt que choisir au hasard.",
    "Elle veut soutenir le projet de son fils adulte sans décider de sa vie à sa place.",
    "Elle propose de tester une idée de repas partagé et cherche une façon de faire participer chacun.",
  ]);
  banks.fille_ami = social("Fille adulte d'un ami ; autonomie et âge adulte respectés, sans parenté avec toi.", [
    "Elle prépare une candidature et veut qu'on critique son dossier sans prendre la parole à sa place.",
    "Elle apporte un objet prêté par un parent et te demande un avis sur une première expérience de travail.",
    "Elle cherche comment annoncer un projet de voyage indépendant sans transformer la discussion en demande de permission.",
    "Elle veut présenter une création personnelle et hésite sur la première personne à qui la montrer.",
    "Elle a accepté une responsabilité associative et vient vérifier ce qu'elle a peut-être sous-estimé.",
    "Elle organise une sortie entre adultes et te demande de comparer deux propositions qu'elle a déjà construites.",
    "Elle envisage un premier logement et souhaite distinguer ce qui est indispensable de ce qui peut attendre.",
    "Elle prépare une rencontre avec des connaissances de ses parents et veut y participer comme une adulte à part entière.",
  ]);
  banks.voisine = social("Voisine adulte ; entraide de quartier et respect de l'espace privé.", [
    "Elle propose une petite amélioration des espaces communs et veut recueillir des avis avant d'en parler à l'immeuble.",
    "Un colis a été remis à la mauvaise porte ; elle cherche son destinataire sans ouvrir ce qui ne lui appartient pas.",
    "Elle souhaite organiser un échange de livres et hésite entre un coin partagé et une rencontre ponctuelle.",
    "Elle prépare une soirée de voisinage et veut que les personnes discrètes puissent aussi y trouver leur place.",
    "Elle vient discuter d'un bruit récurrent, avec une proposition de compromis plutôt qu'une accusation.",
    "Elle s'installe dans le quartier et cherche des repères qui ne ressemblent pas à un catalogue touristique.",
    "Elle organise un arrosage partagé pendant les vacances et voudrait éviter les engagements flous.",
    "Elle a repéré une erreur dans une annonce collective et souhaite la corriger sans embarrasser son auteur.",
  ]);
  banks.jeu = social("Invitée adulte à une soirée de jeu ; règles claires et participation volontaire.", [
    "Elle apporte un nouveau jeu mais découvre que deux règles conduisent à des résultats contradictoires.",
    "Elle propose une revanche où la coopération compte davantage que le classement de la dernière partie.",
    "Elle voudrait adapter un jeu pour que les nouveaux venus puissent comprendre sans attendre plusieurs manches.",
    "Elle prépare un quiz et cherche à retirer les questions qui mettraient quelqu'un mal à l'aise.",
    "Elle veut départager une égalité autrement que par la chance et te propose deux défis.",
    "Elle aimerait essayer un jeu de rôle narratif, avec des personnages originaux et des décisions réellement ouvertes.",
    "Elle reçoit une invitation à un tournoi amateur et souhaite tester sa stratégie sans enjeu financier.",
    "Elle propose de terminer une partie interrompue, mais veut vérifier que chacun souhaite vraiment reprendre.",
  ], ["des cartes illustrées et un carnet de scores", "illustrated playing cards and a score notebook"]);
  banks.student = social("Étudiante adulte ; apprentissage, autonomie et projets, sans cadre scolaire mineur.", [
    "Elle doit défendre un sujet de mémoire et découvre que son exemple principal ne démontre pas ce qu'elle pensait.",
    "Elle prépare une présentation de groupe et veut une répartition qui ne masque pas le travail de chacun.",
    "Elle hésite entre deux stages et souhaite comparer ce qu'ils lui apprendront, pas seulement leur prestige.",
    "Elle prépare un atelier étudiant et cherche un exercice qui permette de poser des questions sans crainte.",
    "Elle a trouvé deux sources incompatibles et veut vérifier leur méthode avant de choisir laquelle citer.",
    "Elle envisage de changer de parcours et souhaite expliquer ses raisons sans dévaloriser ce qu'elle a déjà appris.",
    "Elle organise une exposition de travaux et doit choisir ce qu'elle veut réellement montrer.",
    "Elle veut travailler avec une camarade dont le rythme est opposé au sien et propose un contrat d'organisation simple.",
  ], ["des livres ouverts et des notes de travail", "open books and study notes"]);
  banks.coach = social("Coach adulte ; progression choisie, objectifs réalistes et absence de pression corporelle.", [
    "Elle prépare une séance et découvre que le groupe a des objectifs très différents ; il faut adapter sans comparer les corps.",
    "Elle veut tester un exercice plus accessible et te demande un retour sur la clarté de ses consignes.",
    "Elle prépare une démonstration et hésite entre montrer une performance et expliquer une progression.",
    "Elle envisage une compétition amateur et veut définir ce qui ferait de l'expérience une réussite pour elle.",
    "Elle souhaite réorganiser son planning pour laisser de la place à la récupération.",
    "Elle teste une nouvelle séquence d'échauffement et cherche les étapes qui manquent d'explications.",
    "Elle prépare un atelier de mouvement pour débutants adultes et refuse les objectifs imposés par comparaison.",
    "Elle veut résoudre un désaccord entre deux méthodes d'entraînement en partant des besoins concrets.",
  ], ["une bouteille d'eau et un carnet de séance", "a water bottle and a training notebook"]);
  banks.dancer = social("Danseuse adulte ; création, entraînement et choix de représentation.", [
    "Elle prépare une chorégraphie et une nouvelle musique bouleverse le rythme qu'elle avait construit.",
    "Elle veut répéter un duo dont les deux interprétations du même passage ne se rejoignent pas encore.",
    "Elle cherche une fin de séquence qui raconte quelque chose au lieu d'ajouter une difficulté gratuite.",
    "Elle prépare une démonstration et doit choisir entre une version technique et une version expressive.",
    "Elle veut adapter un numéro à un espace plus petit sans perdre son intention.",
    "Elle propose une improvisation avec des règles claires pour que chacun puisse s'arrêter ou changer d'idée.",
    "Elle prépare un atelier de danse pour adultes débutants et veut éviter les consignes intimidantes.",
    "Elle hésite à montrer une création inachevée et cherche le type de retour dont elle a vraiment besoin.",
  ], ["une pochette de musique et des notes de répétition", "music sheets and rehearsal notes"]);
  banks.artist = social("Artiste adulte ; intention créative, regard critique et liberté de choix.", [
    "Elle prépare une exposition et deux œuvres racontent des versions opposées de ce qu'elle veut exprimer.",
    "Elle reçoit une commande très précise mais souhaite conserver une part de liberté créative.",
    "Elle teste un nouveau matériau et découvre que son défaut peut devenir le sujet de l'œuvre.",
    "Elle veut présenter une création personnelle et hésite entre expliquer son histoire et laisser les visiteurs interpréter.",
    "Elle prépare une collaboration et souhaite définir ce qui sera réellement partagé.",
    "Elle choisit les pièces d'un portfolio et te demande de repérer ce qui manque plutôt que de tout complimenter.",
    "Elle envisage une résidence artistique et doit choisir ce qu'elle est prête à laisser de côté pour y participer.",
    "Elle veut reprendre une œuvre ancienne sans effacer ce qu'elle représentait à l'époque.",
  ], ["un carnet de croquis et des échantillons", "a sketchbook and material samples"]);
  banks.model = social("Mannequin adulte ; mise en scène consentie, choix d'image et droit de refuser.", [
    "Elle prépare son portfolio et veut sélectionner les images qui lui ressemblent, pas seulement celles qui impressionnent.",
    "Elle souhaite tester une pose expressive en tenue habillée et te demande un retour sur l'intention transmise.",
    "Elle reçoit deux propositions de séance et veut comparer les conditions de travail avant d'accepter.",
    "Elle prépare une présentation de collection et doit choisir le rythme qui mettra les vêtements en valeur.",
    "Elle veut clarifier les droits d'utilisation de ses photographies avant une nouvelle collaboration.",
    "Elle construit une série de portraits et hésite entre une ambiance spontanée et une direction plus théâtrale.",
    "Elle prépare une séance et souhaite définir les poses qu'elle accepte et celles qu'elle ne veut pas faire.",
    "Elle aimerait montrer une facette plus personnelle de son travail sans abandonner ses limites.",
  ], ["une sélection de portraits et un carnet de poses", "a portrait portfolio and a posing notebook"]);
  banks.partner = social("Deux adultes en couple ; respecter leur relation et leurs voix, sans présumer la place du joueur.", [
    "Elles préparent une sortie commune mais n'ont pas la même idée de ce qui rendrait la soirée réussie.",
    "Elles souhaitent réorganiser un espace partagé en conservant chacune un coin à soi.",
    "Elles préparent une surprise pour une amie et défendent deux façons différentes de lui faire plaisir.",
    "Elles testent un projet à deux et te demandent un avis extérieur, sans prendre parti pour l'une.",
    "Elles organisent un déplacement et cherchent une répartition des décisions qui convienne à toutes les deux.",
    "Elles veulent reprendre une activité commune en changeant les règles qui les avaient lassées.",
    "Elles préparent un accueil et souhaitent préserver à la fois la convivialité et leur vie privée.",
    "Elles présentent deux versions d'une idée et aimeraient construire une troisième option ensemble.",
  ]);
})(window);
