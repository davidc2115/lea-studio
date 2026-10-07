(function (root) {
  "use strict";
  const banks = root.LeaRoleStoryBanks = root.LeaRoleStoryBanks || {};
  const family = (relation, plots) => ({ category: "family", relation, plots, prop: ["un album et des notes manuscrites", "a family album and handwritten notes"] });
  banks.belle_mere = family("Ta belle-mère adulte ; votre lien reste familial.", [
    "Elle souhaite revoir l'organisation du repas familial : chacun a promis un plat, mais personne ne s'est occupé du menu commun.",
    "Elle prépare un anniversaire pour sa fille et découvre que les deux surprises prévues risquent de se contredire.",
    "Elle apporte une ancienne tradition familiale et te demande comment la transmettre sans imposer ses habitudes à votre foyer.",
    "Une invitation de dernière minute oblige à choisir qui accueillera les proches ; elle veut une répartition équitable.",
    "Elle envisage de déménager et veut distinguer une vraie envie de changement d'une décision prise sur un coup de fatigue.",
    "Elle a retrouvé des lettres familiales ; elle veut décider avec toi lesquelles partager et lesquelles laisser privées.",
    "Elle souhaite financer un projet commun, mais refuse que son aide lui donne le droit de décider à votre place.",
    "Elle t'annonce qu'elle ne pourra plus rendre le même service chaque semaine ; il faut inventer une autre organisation.",
    "Elle veut réconcilier deux branches de la famille autour d'une rencontre, sans obliger personne à pardonner.",
    "Elle te confie la préparation d'un souvenir collectif et s'aperçoit que les versions de chacun ne concordent pas.",
  ]);
  banks.belle_fille = family("Ta belle-fille adulte ; aucune confusion avec la fille d'une amie.", [
    "Elle vient discuter de son premier logement indépendant et voudrait un avis pratique, pas qu'on choisisse à sa place.",
    "Elle veut organiser sa première réception familiale et hésite entre suivre les traditions et créer les siennes.",
    "Elle a accepté une mission loin de chez elle ; elle doit annoncer ce changement sans donner l'impression de fuir la famille.",
    "Elle souhaite reprendre des études et arrive avec deux formations qui impliquent des rythmes de vie très différents.",
    "Elle propose de nouvelles règles pour les espaces partagés, après un malentendu sur les affaires de chacun.",
    "Elle a retrouvé un souvenir de son arrivée dans la famille et voudrait raconter ce qu'elle n'avait jamais osé expliquer.",
    "Elle organise un cadeau collectif et découvre que tout le monde suppose qu'elle prendra en charge les détails.",
    "Elle vient demander un conseil sur un contrat de location, mais veut conserver la responsabilité de sa décision.",
    "Elle aimerait inviter une amie à une réunion familiale et cherche une manière simple de la présenter.",
    "Elle prépare un départ en voyage et souhaite régler une petite tension domestique avant de partir.",
  ]);
  banks.belle_soeur = family("Ta belle-sœur adulte, avec ses propres projets et opinions.", [
    "Elle coordonne une sortie familiale, mais les budgets annoncés ne permettent pas le programme initial.",
    "Elle veut préparer un discours de fête qui fasse rire sans embarrasser sa sœur ni les invités.",
    "Elle t'apporte deux versions d'une histoire familiale et veut comprendre un désaccord plutôt que désigner un coupable.",
    "Elle propose une activité commune pour mieux connaître la famille, mais refuse les jeux qui mettent les gens mal à l'aise.",
    "Elle souhaite monter un petit projet avec toi et veut fixer les responsabilités avant que l'enthousiasme ne fasse tout oublier.",
    "Elle vient rendre un objet prêté, accompagné d'une question sur une promesse ancienne.",
    "Elle a reçu une invitation importante le même jour qu'une fête familiale et cherche un compromis honnête.",
    "Elle prépare une surprise pour sa sœur et doit choisir entre quelque chose de spectaculaire et quelque chose de personnel.",
  ]);
  banks.tante = family("Ta tante adulte ; échanges familiaux, entraide et désaccords possibles.", [
    "Elle veut transmettre une recette familiale, mais une étape qu'elle fait instinctivement manque dans ses notes.",
    "Elle envisage de reprendre une activité abandonnée depuis longtemps et te demande de l'aider à choisir un premier objectif.",
    "Elle trie des souvenirs de voyage et découvre qu'un objet prêté n'a jamais été rendu à la bonne personne.",
    "Elle prépare une réunion de cousins et voudrait éviter que l'organisation repose encore sur une seule personne.",
    "Elle propose de raconter une histoire de famille sous forme d'enregistrement, en respectant ceux qui ne veulent pas participer.",
    "Elle a trouvé une vieille photographie et se souvient d'une version des événements différente de celle racontée jusqu'ici.",
    "Elle souhaite donner du matériel pour un projet associatif, mais veut s'assurer qu'il servira vraiment.",
    "Elle prépare une escapade et voudrait prendre un peu de distance avec les attentes familiales sans couper les liens.",
  ]);
  banks.family_duo = family("Deux parentes adultes distinctes ; ne pas fusionner leurs voix ni leurs liens.", [
    "Elles préparent une fête familiale : l'une défend une rencontre intime, l'autre un événement ouvert à tous.",
    "Elles veulent conserver des souvenirs communs, mais ne donnent pas la même importance aux mêmes objets.",
    "Elles réorganisent un espace partagé et viennent chacune avec une priorité différente.",
    "Elles cherchent un cadeau familial : l'une privilégie l'utilité, l'autre l'histoire qu'il raconte.",
    "Elles préparent un déplacement ensemble et doivent décider comment répartir les tâches sans s'infantiliser.",
    "Elles veulent raconter un épisode familial à deux voix et découvrent qu'elles n'en gardent pas le même souvenir.",
    "Elles organisent un accueil et te demandent d'arbitrer un détail pratique, pas de prendre parti dans leur relation.",
    "Elles reviennent d'une activité commune avec une idée qu'elles aimeraient tester avant de la proposer à la famille.",
  ]);
})(window);
