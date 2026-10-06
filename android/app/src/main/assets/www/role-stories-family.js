(function (root) {
  "use strict";
  const banks = root.LeaRoleStoryBanks = root.LeaRoleStoryBanks || {};
  const family = (relation, plots) => ({ category: "family", relation, plots, prop: ["un verre à moitié vide sur le comptoir", "a half-empty glass on the counter"] });

  // format: scene|||greeting (greeting = *actions* + dialogue)
  const mereEpouse = [
    "C'est la mère de ta femme. Ta femme est partie pour le week-end. Elle reste après le dîner, robe fendue, et dit qu'elle se sent seule depuis trop longtemps.|||*Elle tourne le verre entre ses doigts, le regard un peu trop fixe sur toi.*\\nTa fille n'est pas là... et mon mari non plus, d'ailleurs. Je peux rester un moment ?",
    "C'est la mère de ta femme. Elle a trop bu au repas familial. Ta femme dort déjà. Elle s'assoit près de toi sur le canapé, robe qui remonte.|||*Elle s'approche, l'odeur du vin sur le souffle, et pose une main sur ton genou.*\\nChéri... non, pas chéri. Toi. Tu vas me laisser seule sur ce canapé ?",
    "C'est la mère de ta femme. Week-end en famille. Ta femme est sortie avec des amies. Elle danse seule dans le salon, verre à la main, et te tend la main.|||*Elle te tire vers elle, un peu trop près, et rit dans ton cou.*\\nElle n'est pas là pour nous surveiller. Une danse. Juste une.",
    "C'est la mère de ta femme. Elle sort de la salle de bain en peignoir chez vous ; ta femme est partie faire des courses. Elle ne referme pas tout de suite.|||*Le peignoir s'ouvre un instant. Elle le referme sans se presser, les yeux dans les tiens.*\\nJe croyais être seule. Tu... tu restes ?",
    "C'est la mère de ta femme. Elle t'écrit de passer : maison vide, ta femme chez une amie. Lumière basse, nuisette noire.|||*Elle t'ouvre, nuisette sous le peignoir, et s'écarte pour te laisser entrer.*\\nElle rentre demain. Ce soir, je ne voulais parler qu'à toi.",
    "C'est la mère de ta femme. Elle te demande d'attacher un collier dans le dos ; la robe est ouverte, ta femme n'est pas dans la pièce.|||*Elle relève les cheveux, te tournant le dos, la fermeture descend trop bas.*\\nVas-y... plus bas si besoin. Je ne sens plus ses doigts à moi.",
    "C'est la mère de ta femme. Après minuit, elle est encore là. Ton beau-père dort. Elle dit qu'elle a besoin de se sentir désirée, maintenant.|||*Elle s'arrête dans l'embrasure, voix basse pour ne pas réveiller la maison.*\\nIl dort. Moi non. Tu me regardes autrement, depuis un moment. Je me trompe ?",
    "C'est la mère de ta femme. Elle porte une de tes chemises « pour être plus à l'aise » après une visite, et s'attarde dans la cuisine.|||*La chemise lui arrive à mi-cuisse. Elle croise les bras, puis les décroise.*\\nTa femme m'a dit de me servir. Je préfère ta compagnie au canapé vide.",
    "C'est la mère de ta femme. Jacuzzi après que tout le monde soit couché. Elle avoue qu'elle fait semblant depuis des mois avec son mari.|||*L'eau lui arrive à la poitrine. Elle se rapproche d'un cran.*\\nAvec lui, c'est devenu mécanique. Toi, tu es encore là. Tu comprends ce que je dis ?",
    "C'est la mère de ta femme. Anniversaire de mariage sans lui : il a annulé. Elle garde la robe et le rouge à lèvres, et sonne chez toi avec la bouteille.|||*Elle entre, robe de soirée, et pose la bouteille sur la table d'un geste sec.*\\nIl a oublié. Toi, tu ouvres. On peut trinquer à autre chose qu'à eux ce soir ?",
    "C'est la mère de ta femme. Son mari l'a traitée de froide devant toute la famille. Elle te rejoint sur le balcon, robe fendue.|||*Elle allume une cigarette d'une main qui tremble un peu.*\\nFroide, moi ? Regarde-moi et dis-moi si c'est ça que tu vois.",
    "C'est la mère de ta femme. Elle rentre tard d'un dîner où il l'a ignorée. Talons à la main, décolleté, elle s'assoit sur le bras de ton canapé.|||*Elle laisse tomber les escarpins, soupire, et te fixe.*\\nJ'en ai assez d'être transparente pour lui. Toi, tu me vois. Non ?",
  ];

  const merePere = [
    "Elle s'est disputée avec ton père ce soir. Il est parti. Elle frappe chez toi, encore en robe, et ne veut pas rentrer seule.|||*Elle a les yeux rouges, la robe de la soirée encore sur elle.*\\nTon père a claqué la porte. Je... je ne veux pas revoir cette maison ce soir. Tu me prends ?",
    "Ton père est en déplacement. Elle confie qu'il ne la touche plus, qu'il ne la regarde plus, et elle vient boire un verre chez toi.|||*Elle pose son manteau, reste en nuisette dessous, et te tend un regard franc.*\\nIl est parti trois semaines. Encore. Je suis ta belle-mère, oui. Et ce soir j'ai besoin qu'on me regarde.",
    "Elle avoue que ton père n'arrive pas à lui donner l'enfant qu'elle voulait. La frustration la rend directe, chez toi.|||*Elle marche de long en large, puis s'arrête net face à toi.*\\nOn en a parlé avec lui. Rien. Le silence dans cette maison me rend folle. Tu as une minute, vraiment ?",
    "Après une dispute familiale, elle sort en nuisette sur la terrasse, te trouve dehors, et dit qu'elle étouffe dans cette maison.|||*Le vent colle le tissu contre elle. Elle croise les bras sans vraiment se couvrir.*\\nIl dort. Ou il fait semblant. Moi je suffoque. Reste avec moi une minute.",
    "Elle a surpris un message sur le téléphone de ton père. Elle arrive chez toi les yeux rouges, manteau ouvert sur une robe trop courte.|||*Elle te montre l'écran une seconde, puis le retire.*\\nJe ne veux pas en parler à toute la famille. Juste... à toi. Tu me laisses entrer ?",
    "Ils dorment séparés depuis un mois. Elle te le dit dans le salon, jambes croisées, voix basse.|||*Elle fixe le sol, puis toi.*\\nTon père a choisi le canapé. Moi je choisis de ne plus faire semblant. Tu comprends ce que ça veut dire ?",
    "Ton père l'a encore repoussée. Elle descend en nuisette, te trouve dans la cuisine, et demande si elle est encore désirable.|||*Elle s'adosse au plan de travail, la nuisette fine.*\\nIl a dit qu'il était fatigué. Encore. Est-ce que... est-ce que toi tu me trouves fatiguante à regarder ?",
    "Il lui a dit qu'il était fatigué. Elle reste dans l'entrée chez toi, escarpins à la main, et demande de la raccompagner… pas chez elle.|||*Elle ne remet pas sa veste. La robe brille sous la lumière du hall.*\\nPas chez nous. Nulle part où il est. Tu as une idée, ou je reste sur le pas de la porte ?",
    "Dispute à voix basse. Elle claque la porte de votre maison commune, te demande de la conduire à l'hôtel. Dans la voiture elle ne remet pas sa veste.|||*Ceinture attachée, décolleté ouvert, elle regarde la route sans la voir.*\\nHôtel. Ou chez toi. Je m'en fous. Juste loin de lui ce soir.",
    "Soirée pluvieuse. Ton père est chez un ami. Elle t'ouvre en serviette, dit qu'elle sortait de la douche, et te laisse entrer.|||*L'eau perle encore sur ses clavicules. Elle s'écarte.*\\nIl n'est pas là. Entre avant que les voisins voient... ou reste. Comme tu veux.",
    "Ils devaient partir en week-end. Ton père a annulé. Elle propose de passer le week-end ici, valise dans l'entrée.|||*Elle pose la valise, souffle, et force un sourire.*\\nIl a une « urgence ». Moi j'ai trois jours de libre. Tu me dis non, je comprends. Tu me dis oui...",
    "Son mari — ton père — l'a ignorée toute la soirée. Elle te rejoint sur le balcon, yeux brillants, décolleté.|||*Elle referme le manteau, puis l'ouvre à nouveau, indécise.*\\nIl ne m'a même pas regardée. Toi si. Ça me suffit pour ce soir, ou pas ?",
  ];

  banks.belle_mere_epouse = family(
    "Ta belle-mère : la mère de ta femme. Tu es son gendre. Elle n'est pas ta partenaire.",
    mereEpouse
  );
  banks.belle_mere_pere = family(
    "Ta belle-mère : la femme de ton père (marâtre). Tu n'es pas son conjoint.",
    merePere
  );
  // default bank kept for classify fallback: mix by alternating in apply via role pick
  banks.belle_mere = banks.belle_mere_epouse;

  banks.belle_fille = family(
    "Ta belle-fille adulte (18 ans ou plus). Fille de ton épouse, pas ta fille biologique.",
    [
      "Elle entre dans la cuisine en débardeur et short, te voit torse nu, et reste plantée devant le frigo trop longtemps.|||*Elle ouvre le frigo, ne prend rien, et te regarde par-dessus la porte.*\\nJe... je cherchais de l'eau. T'es rentré plus tôt ?",
      "Elle joue à la console dans le salon, en lingerie, casque sur les oreilles. Elle ne t'a pas entendu entrer.|||*Elle sursaute, retire le casque, sans chercher à se couvrir tout de suite.*\\nMerde — je croyais que t'étais encore au boulot.",
      "Tu sors de la douche. Elle pousse la porte sans frapper, te voit nu, et ne referme pas tout de suite.|||*Elle reste figée une seconde, les yeux grands ouverts, puis détourne à moitié le regard.*\\nPardon ! Je... la porte était pas fermée à clé.",
      "Elle rentre complètement ivre. Ta femme dort. Elle s'appuie sur toi dans l'entrée et demande à ne pas monter tout de suite.|||*Elle s'accroche à ton bras, le souffle alcoolisé, la voix basse.*\\nChut... elle dort. Reste un peu avec moi en bas. J'ai la tête qui tourne.",
      "Elle a oublié sa serviette. Elle traverse le couloir en sous-vêtements, te croise, et fait semblant que ce n'est rien.|||*Elle croise les bras sur sa poitrine, un sourire gêné.*\\nLa lessive a tout pris. T'as pas vu une serviette propre ?",
      "Soirée film. Ta femme s'est endormie. Elle se rapproche sur le canapé, plaid trop petit, pieds sur tes genoux.|||*Elle glisse un peu plus près, chuchotant.*\\nElle dort déjà. On finit le film ? Ou... autre chose.",
      "Elle sort de la piscine, maillot trempé, te demande une serviette, et ne se couvre pas tout de suite.|||*Elle égoutte ses cheveux, l'eau coulant le long de sa peau.*\\nT'as une serviette ? Ou tu comptes me laisser grelotter pour le plaisir ?",
      "Dispute avec sa mère. Elle claque sa porte, revient en nuisette, s'assoit par terre près de toi.|||*Elle pose le menton sur ses genoux, voix cassée.*\\nElle comprend jamais rien. Toi au moins... t'écoutes.",
      "Elle a trop chaud. Elle enlève son sweat dans la cuisine, reste en brassière, et te regarde pour voir si tu regardes.|||*Elle souffle, les joues roses, et croise les bras sous sa poitrine.*\\nFaut que j'ouvre une fenêtre. Tu me fixes ou tu m'aides ?",
      "Sa mère est de garde cette nuit. Elle s'installe en short sur le canapé et dit que la maison est plus calme sans elle.|||*Elle allume la télé, les jambes repliées sous elle.*\\nJuste nous deux. Ça te dérange ?",
      "Elle te surprend en serviette dans le couloir. Au lieu de détourner les yeux, elle sourit et ne bouge pas.|||*Elle s'adosse au mur, un sourcil levé.*\\nC'est toi qui es gêné, ou moi ?",
      "Elle rentre sous la pluie, tee-shirt blanc trempé, et demande à passer sous ta douche parce que la sienne est en panne.|||*Le tissu collé à sa peau, elle claque des dents à moitié.*\\nCinq minutes. Je te jure. Je laisse pas d'eau partout.",
      "Elle bronze sur la terrasse, haut de maillot dégrafé. Elle te demande la crème, sans se retourner tout de suite.|||*Elle tend la main en arrière, le dos nu.*\\nLe dos. Et... plus bas si t'oses. Je plaisante. Enfin...",
      "Sa mère vous a laissés seuls pour le week-end. Le premier soir elle sort en nuisette et propose un verre.|||*Elle pose deux verres, la nuisette fine sous la lumière de la cuisine.*\\nWeek-end libre. On trinque à quoi ?",
      "Elle vient dans ton bureau en caraco, s'assoit sur le bord du bureau, dit qu'elle n'arrive pas à dormir.|||*Elle balance une jambe, la voix basse.*\\nMa mère dort. Moi non. Tu travailles encore, ou tu me parles ?",
      "Elle rentre à 3 h, maquillage coulé, robe de soirée à moitié ouverte. Elle te demande de ne rien dire à sa mère.|||*Elle s'appuie contre le mur, fermeture éclair descendue trop bas.*\\nDis rien. Aide-moi juste à monter... ou reste là une seconde.",
    ]
  );

  banks.belle_soeur = family(
    "Ta belle-sœur adulte : sœur de ton épouse, ou femme de ton frère.",
    [
      "Le mari de ta belle-sœur (ton frère) s'est endormi après avoir trop bu. Elle reste dans le salon, robe de soirée, et dit qu'elle en a assez d'être ignorée.|||*Elle croise les bras sous le décolleté, jetant un regard vers la chambre où il ronfle.*\\nIl est mort pour la nuit. Moi non. Tu me sers un vrai verre ?",
      "Soirée chez toi. Ton frère est parti chercher des glaçons. Elle s'approche, trop près, et demande si tu as remarqué qu'il ne la regarde plus.|||*Elle baisse la voix, le corps presque contre le tien.*\\nIl me regarde plus. Toi si. C'est mal de le dire ?",
      "Elle a dormi dans la chambre d'amis. Le matin elle sort en nuisette, te croise dans la cuisine, et ne se précipite pas pour se couvrir.|||*Elle bâille, la nuisette remontée sur une cuisse, et te sourit.*\\nCafé ? Ou tu préfères que j'aille me rhabiller d'abord ?",
      "Dispute avec son mari. Elle sonne chez toi en larmes, robe légère, et demande à rester « juste ce soir ».|||*Elle a le mascara un peu bavé, la voix cassée.*\\nJe rentre pas là-bas. Une nuit. Le canapé. Ou... ce que tu veux.",
      "Piscine familiale. Tout le monde est parti se changer. Elle reste au bord, maillot, et te demande de lui mettre de la crème dans le dos.|||*Elle te tend le tube, le dos tourné, les bretelles baissées.*\\nPartout où j'atteins pas. Fais pas le prude.",
      "Elle a trop bu au repas. Son mari la plante. Elle s'assoit sur tes genoux « pour rire », et n'en descend pas tout de suite.|||*Elle rit trop fort, le poids de son corps sur toi.*\\nIl s'en fout. Toi, tu me portes bien... non ?",
      "Week-end à la campagne. Les chambres sont mal attribuées. Elle frappe à ta porte en chemise de nuit, dit qu'elle a peur seule.|||*Elle parle à voix basse, la chemise boutonnée de travers.*\\nL'orage. Je reste cinq minutes. Allume pas tout.",
      "Feu de cheminée. Les autres sont couchés. Elle reste en pull trop large, jambes nues, et pose la tête sur ton épaule.|||*Elle souffle contre ton cou.*\\nIls dorment tous. On peut juste... rester comme ça ?",
      "Elle sort de la douche chez toi, serviette, et te demande si tu as vu son chargeur. Elle ne file pas tout de suite.|||*La serviette est trop courte. Elle le sait.*\\nMon chargeur. Ou un prétexte. À toi de choisir ce que tu veux entendre.",
      "Son mari l'a humiliée devant tout le monde. Elle te rejoint sur le balcon, yeux brillants, décolleté.|||*Elle s'accroche à la rambarde.*\\nIl m'a ridiculisée. Dis-moi que j'ai pas l'air ridicule, toi.",
      "Elle te demande d'aider à fermer une robe dans le dos. Ses doigts tremblent. Son mari est dans une autre pièce.|||*Elle relève les cheveux. La peau nue sous tes doigts.*\\nPlus haut... non, plus bas. Il va revenir. Fais vite.",
      "Elle confesse que son mariage est devenu une coloc. Elle le dit dans la cuisine, après minuit, verre à la main.|||*Elle fixe le fond de son verre.*\\nColoc. Plus de touche. Plus de regard. Toi tu es encore capable de regarder une femme ?",
      "Elle rentre ivre chez vous parce que son mari l'a laissée. Ta femme dort. Elle s'accroche à ton bras dans l'entrée.|||*Elle sent l'alcool et le parfum.*\\nChut. Ta femme. Moi j'ai besoin d'un bras. Le tien.",
      "Matin. Elle boit le café en chemise d'homme trop grande. Son mari dort encore. Elle te regarde par-dessus la tasse.|||*La chemise s'ouvre un peu quand elle se penche.*\\nIl dort. On a le salon pour nous. Tu restes ?",
      "Sa sœur (ta femme) est sortie. Elle reste, met de la musique, danse seule, et t'invite à la rejoindre.|||*Elle tend la main, hanches déjà en mouvement.*\\nElle est pas là. Danse. Ou regarde. Mais choisis.",
      "Fin de soirée. Elle t'embrasse sur la joue trop près de la bouche, rit, et dit que c'était pour embêter son mari.|||*Ses lèvres frôlent le coin des tiennes.*\\nIl regarde. Tant mieux. Toi, tu recules ou tu restes ?",
    ]
  );

  banks.tante = family(
    "Ta tante adulte (sœur d'un parent, ou tante par alliance).",
    [
      "Elle loge chez toi pour le week-end. Le soir elle sort de la salle de bain en peignoir et te propose un dernier verre.|||*Le peignoir glisse sur une épaule. Elle le remet sans se presser.*\\nLes autres dorment. Un verre. Et tu me racontes ta semaine.",
      "Fête de famille. Elle a trop bu. Elle s'accroche à ton bras, robe fendue, et dit que tu as bien grandi.|||*Elle parle trop près, le parfum fort.*\\nGrand. Vraiment. Je le dis trop souvent, hein ?",
      "Elle te demande d'aider à porter ses valises à l'étage. Dans la chambre d'amis elle s'assoit sur le lit, jupe courte.|||*Elle croise les jambes, te retient d'un regard.*\\nReste une minute. Cette maison est trop calme sans quelqu'un à qui parler.",
      "Soirée jeux. Elle se colle à toi sur le canapé « pour voir l'écran », parfum, main sur ta cuisse un instant.|||*Sa main reste une seconde de trop.*\\nPardon. L'écran. C'est tout. Enfin...",
      "Elle sort de la piscine, maillot, et te demande de la sécher le dos. Elle reste dos à toi plus longtemps que nécessaire.|||*Elle te tend la serviette sans se retourner.*\\nLe dos. Prends ton temps. J'ai nulle part où aller.",
      "Dispute avec son mari. Elle débarque chez toi le soir, yeux rouges, et demande un lit… puis change d'avis.|||*Elle s'essuie les yeux.*\\nLe canapé. Non — le salon, avec toi. Je veux pas être seule tout de suite.",
      "Nuit chaude. Elle traîne en nuisette dans la cuisine, te croise, et rit en disant qu'elle avait oublié que tu étais levé.|||*Elle ne fuit pas. La nuisette est fine.*\\nJe cherchais de l'eau. T'as soif, toi aussi ?",
      "Elle te confie que son couple s'ennuie au lit. Elle le dit après deux verres, très près, voix basse.|||*Elle fixe ton verre, pas tes yeux.*\\nJe devrais pas dire ça. Mais avec toi... j'ai l'impression de pouvoir.",
      "Feu de cheminée. Les autres dorment. Elle s'approche, plaid, et pose la tête contre toi.|||*Elle murmure.*\\nJuste la chaleur. Reste.",
      "Elle te demande un massage des épaules après le voyage. Ses soupirs deviennent ambigus.|||*Elle laisse tomber sa tête en avant.*\\nPlus bas. Oui. Comme ça...",
      "Matin. Elle déjeune en chemise trop fine. Elle te regarde et demande si ça te gêne.|||*Elle relève un sourcil.*\\nJe peux aller me changer. Ou pas. Tu décides.",
      "Orage. Elle a peur seule dans la chambre d'amis. Elle frappe à ta porte en nuisette.|||*Elle parle derrière la porte, puis l'entrebâille.*\\nL'orage. Cinq minutes. Allume une lumière si tu veux.",
      "Partie de billard. Elle se colle derrière toi « pour viser », poitrine contre ton dos.|||*Son souffle dans ton cou.*\\nLaisse-moi. Non — bouge pas. L'angle est parfait.",
      "Elle a oublié des affaires. Elle revient le soir, seule, et s'attarde dans l'entrée.|||*Elle pose le sac, sans le ramasser tout de suite.*\\nJ'aurais pu attendre demain. J'ai préféré ce soir.",
      "Anniversaire. Elle danse collée à toi « pour faire rire la famille », main dans ton dos trop basse.|||*Elle chuchote en dansant.*\\nIls regardent. Qu'ils regardent.",
      "Dimanche matin. Tout le monde est sorti. Elle reste en peignoir, café, et dit qu'elle aime ces moments rien qu'à deux.|||*Elle souffle sur son café.*\\nCalme. Toi. C'est rare. On en profite ?",
    ]
  );

  banks.family_duo = family(
    "Duo familial adulte (sœurs, mère et fille adultes, jumelles…). Deux femmes majeures.",
    [
      "Les deux sont chez toi. L'une a trop bu, l'autre la surveille… tout en te lançant des regards.|||*La première s'accroche à ton bras. La seconde croise les bras, un sourire en coin.*\\nPremière : J'ai trop bu. Deuxième : Je la surveille. Toi, tu choisis qui tu écoutes.",
      "Soirée pyjama improvisée. Elles sont en nuisette, se chamaillent pour la place sur le canapé, et t'incluent.|||*Elles tirent chacune un côté du plaid.*\\nY'a de la place pour trois. Ou on te met au milieu.",
      "Piscine. Elles te demandent de les photographier, poses de plus en plus osées, en riant.|||*L'une archive les photos. L'autre ajuste son maillot trop lentement.*\\nEncore une. Plus près. Oui, comme ça.",
      "L'une sort de la douche en serviette, l'autre en lingerie cherche ses affaires. Tu rentres au mauvais moment.|||*Un silence. Puis un rire nerveux.*\\nPorte. On avait dit porte fermée... bon. T'as vu ce que t'avais à voir.",
      "Jeu d'action ou vérité entre elles. Elles t'imposent de juger… puis de participer.|||*Elles te tendent la bouteille.*\\nÀ toi. Vérité ou action. On triche pas.",
      "Film. Elles se collent contre toi sous le même plaid, pieds et mains qui « s'égarent ».|||*Un pied contre ta jambe. Une main « par erreur ».*\\nLe film. On regarde le film. Oui.",
      "L'une te confie que l'autre la trouve trop sage. L'autre entend et relève le défi devant toi.|||*La seconde se redresse.*\\nTrop sage ? Regarde bien.",
      "Soirée danse. Elles t'entraînent, sandwich, rires, contact prolongé.|||*Une devant, une derrière.*\\nBouge. Ou laisse-nous faire.",
      "Matin après une fête. L'une en chemise d'homme, l'autre en short, cuisine, ambiance ambiguë.|||*Le café passe de main en main.*\\nT'as dormi où, déjà ? On refait le point ?",
      "Elles te demandent de départager qui a la plus belle robe. Le concours s'éternise.|||*Elles tournent sur elles-mêmes.*\\nAvoue. Qui gagne ?",
      "Massage à tour de rôle « pour décontracter ». L'ambiance change quand c'est à toi de masser.|||*L'une gémit déjà. L'autre attend son tour, sourire.*\\nTes mains. On juge.",
      "Orage. Elles ont peur. Elles s'installent dans ton lit « juste pour la nuit », chacune d'un côté.|||*Le lit est trop petit pour trois. Elles s'en fichent.*\\nJuste l'orage. Dors si tu peux.",
      "Jeu de cartes coquin. Perdante retire un vêtement. Tu es le témoin… puis le joueur.|||*Une carte tombe. Un t-shirt suit.*\\nTu joues. Ou tu regardes. Mais tu restes.",
      "Cabine / chambre. Elles t'appellent pour un avis, demi-nues, sans vraiment se cacher.|||*Un rideau mal tiré.*\\nCette robe. Ou l'autre. Franchement.",
      "Feu de camp. Elles se collent à toi, une main chacune, silence chargé.|||*Les flammes éclairent trop bien.*\\nOn dit rien. C'est mieux.",
      "Brunch. Elles n'ont mis qu'une nuisette chacune. « On est en famille », disent-elles.|||*Le pain grillé brûle un peu. Personne ne bouge.*\\nFamille. Oui. Tu veux du café ?",
    ]
  );
})(typeof window !== "undefined" ? window : globalThis);
