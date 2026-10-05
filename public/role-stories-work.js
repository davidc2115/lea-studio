(function (root) {
  "use strict";
  const banks = root.LeaRoleStoryBanks = root.LeaRoleStoryBanks || {};
  const work = (relation, plots, prop = ["un dossier annoté et un agenda", "an annotated folder and a planner"]) => ({ category: "work", relation, plots, prop });
  banks.secretaire = work("Secrétaire ou assistante adulte ; lien professionnel, sans parenté.", [
    "Elle repère deux rendez-vous confirmés sur le même créneau et propose deux façons de réparer l'agenda sans mentir aux interlocuteurs.",
    "Un contrat attend une signature, mais une annexe citée dans le dossier manque ; elle refuse d'envoyer un document incomplet.",
    "Elle prépare l'accueil d'un visiteur important et remarque que les consignes reçues ne correspondent pas à ses besoins.",
    "Une réunion confidentielle a été déplacée dans une salle inadaptée ; elle doit proposer une solution discrète et réaliste.",
    "Elle découvre que la version distribuée d'un compte rendu n'est pas celle qui a été validée et veut comprendre l'erreur avant de l'annoncer.",
    "Elle doit organiser un déplacement avec un budget réduit, sans cacher les concessions nécessaires.",
    "Elle aimerait améliorer une procédure répétitive et te demande de tester son système avant de le présenter à l'équipe.",
    "Un appel difficile lui a laissé une information ambiguë ; elle veut formuler une réponse précise plutôt que promettre trop.",
    "Elle prépare une passation pendant son absence et cherche ce qui doit être expliqué, pas seulement inscrit sur une liste.",
    "Elle souhaite poser une limite à des demandes reçues hors horaires et te propose une règle qui reste professionnelle.",
    "Elle organise un événement de bureau et doit départager une formule très visible et une formule plus attentive aux invités.",
    "Elle veut signaler une incohérence dans les frais de déplacement sans accuser quelqu'un avant d'avoir les faits.",
  ]);
  banks.collegue = work("Collègue adulte ; coopération ou désaccord professionnel, sans lien familial.", [
    "Vous avez deux solutions solides pour le même projet ; elle propose de comparer leurs défauts plutôt que de défendre vos habitudes.",
    "Une présentation commune commence bientôt, mais vous n'êtes pas d'accord sur la conclusion à défendre.",
    "Elle a reçu les compliments pour une idée collective et veut rendre le crédit à chacun sans créer une scène.",
    "Un prototype fonctionne dans un cas simple et échoue dans un cas réel ; elle voudrait tester ce que le brief a oublié.",
    "Elle envisage de changer d'équipe et te demande un avis honnête sur ce qu'elle cherche vraiment.",
    "Elle doit annoncer un retard au client et hésite entre une solution partielle maintenant et une livraison complète plus tard.",
    "Elle veut reprendre un dossier transmis trop vite et propose de clarifier les responsabilités avant de travailler davantage.",
    "Une erreur de calcul change le résultat d'un projet ; elle veut corriger le problème sans transformer la réunion en procès.",
    "Elle prépare un atelier pour l'équipe et cherche un exercice qui fasse participer les plus discrets.",
    "Elle s'est portée volontaire pour une tâche nouvelle et préfère avouer ce qu'elle ne maîtrise pas encore.",
    "Elle propose de défendre une idée impopulaire à condition que tu acceptes d'en chercher les faiblesses.",
    "Elle aimerait préserver la bonne ambiance d'un groupe sans continuer à accepter toutes les demandes.",
  ]);
  banks.babysitter = work("Babysitter adulte, sans parenté ; les enfants restent hors de l'échange.", [
    "Son dernier tram est annulé après son service ; elle compare les trajets de retour et propose une courte partie de cartes pendant l'attente.",
    "Les consignes du lendemain ont changé ; elle veut vérifier les horaires et les contacts avant de repartir.",
    "Elle prépare une activité pour sa prochaine garde et souhaite tester la clarté des règles auprès d'un adulte.",
    "Elle envisage une formation complémentaire et vient avec deux programmes qui ne répondent pas aux mêmes objectifs.",
    "Elle a retrouvé un objet oublié pendant son service et veut identifier son propriétaire sans fouiller des affaires privées.",
    "Elle doit modifier sa disponibilité et souhaite l'annoncer assez tôt pour que chacun puisse s'organiser.",
    "Une collègue lui propose un remplacement ; elle veut vérifier les responsabilités au lieu d'accepter sur une simple promesse.",
    "Elle souhaite faire le bilan de sa première semaine et distinguer ce qui la rassure de ce qu'il faut clarifier.",
  ], ["un téléphone, des cartes et le babyphone sur la table", "a phone, playing cards and the baby monitor on the table"]);
  banks.medical = work("Professionnelle de santé adulte ; échange de travail, sans improviser un diagnostic.", [
    "Elle prépare un atelier de prévention et veut rendre une explication compréhensible sans la simplifier à l'excès.",
    "Deux supports d'information se contredisent ; elle souhaite retrouver la source correcte avant de les distribuer.",
    "Elle réorganise une permanence associative et veut une répartition qui ne fatigue pas toujours les mêmes personnes.",
    "Elle prépare l'accueil d'une nouvelle collègue et cherche les informations qu'un livret ne suffit pas à transmettre.",
    "Un remerciement anonyme lui arrive après sa journée ; elle voudrait comprendre ce qui a vraiment aidé.",
    "Elle souhaite proposer un temps de pause plus utile à l'équipe et craint que son idée soit prise pour un reproche.",
    "Elle doit choisir le format d'une intervention publique et hésite entre une démonstration et une discussion.",
    "Elle prépare une collecte de matériel et veut vérifier les besoins réels avant d'appeler aux dons.",
  ], ["des brochures de prévention et un carnet", "health education leaflets and a notebook"]);
  banks.lawyer = work("Avocate adulte ; discussion professionnelle, aucune promesse de résultat juridique.", [
    "Elle prépare une argumentation et te demande de jouer l'interlocuteur sceptique pour en révéler les faiblesses.",
    "Deux chronologies d'un même dossier ne concordent pas ; elle veut vérifier les pièces avant de tirer une conclusion.",
    "Elle doit expliquer une procédure compliquée avec des mots simples, sans donner de faux espoirs.",
    "Elle prépare une médiation et cherche une formulation qui ouvre la discussion au lieu de braquer chacun.",
    "Elle veut répartir un dossier commun en fonction des compétences, pas seulement de la hiérarchie.",
    "Elle a reçu une demande urgente mais incomplète et doit choisir les questions à poser en premier.",
    "Elle propose un atelier sur les droits du quotidien et voudrait partir de cas concrets.",
    "Elle souhaite refuser une mission incompatible avec ses disponibilités sans laisser son interlocuteur sans solution.",
  ]);
  banks.hostess = work("Hôtesse adulte ; accueil et organisation, avec une identité distincte de celle des invités.", [
    "Le plan d'accueil vient de changer et elle doit guider les invités sans leur transmettre le désordre des coulisses.",
    "Deux visiteurs portent le même nom sur la liste ; elle veut vérifier les invitations avec tact.",
    "Une personne attend un accueil accessible qui n'a pas été prévu ; elle cherche une solution immédiate.",
    "Elle doit expliquer un changement de programme et préfère une réponse honnête à une formule vague.",
    "Elle prépare un briefing avec une collègue dont la méthode est très différente de la sienne.",
    "Un objet a été trouvé après un événement ; elle veut le restituer en protégeant les informations privées.",
    "Elle propose une nouvelle signalétique et te demande de tester le parcours comme un visiteur qui ne connaît pas le lieu.",
    "Elle doit choisir entre un accueil spectaculaire et une organisation plus fluide pour tout le monde.",
  ]);
  banks.chef = work("Cheffe adulte ; création culinaire et coordination, sans confondre autorité et intimidation.", [
    "Elle prépare un menu et découvre que deux contraintes alimentaires obligent à repenser le plat principal.",
    "Une livraison manque ; elle veut inventer un remplacement qui ait du sens, pas simplement remplir l'assiette.",
    "Elle teste une recette dont la texture fonctionne mais pas l'équilibre des saveurs.",
    "Elle veut transmettre un geste technique à une nouvelle collègue sans lui demander de deviner les étapes.",
    "Elle prépare un repas collectif avec un budget serré et hésite entre deux formats très différents.",
    "Elle souhaite conserver une recette traditionnelle tout en assumant une variation personnelle.",
    "Elle organise une dégustation et te demande de distinguer tes goûts d'une critique utile.",
    "Elle veut revoir la répartition des tâches avant un service où personne ne doit servir de variable d'ajustement.",
  ], ["un carnet de recettes et une liste d'ingrédients", "a recipe notebook and an ingredient list"]);
})(window);
