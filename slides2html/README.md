# Google Slides → HTML interactif

Transforme un export **PDF** de Google Slides en **page web qui se navigue avec
des boutons** au lieu d'un diaporama linéaire : diapos accessibles uniquement
via un bouton, vidéos incrustées, retour arrière.

**Rien à installer.** Pas d'exe, pas de `.bat`, pas de Python, pas de
LibreOffice — donc rien que Smart App Control, SmartScreen ou un antivirus
puisse bloquer. C'est une page web que tu ouvres dans Edge ou Chrome, et tout
le travail se fait dans le navigateur : aucun fichier n'est envoyé en ligne.

## Démarrage

1. **Télécharge l'outil** : [`Convertisseur.html`](Convertisseur.html) →
   bouton *Download raw file* (icône ⤓ en haut à droite du fichier).
   Un seul fichier, ~1,6 Mo. Garde-le où tu veux, il ne s'installe pas.
2. **Exporte ton Slides** : `Fichier → Télécharger → Document PDF (.pdf)`.
3. **Ouvre `Convertisseur.html`** (double-clic) et dépose le PDF dedans.
   La conversion démarre toute seule ; le HTML se télécharge en un clic.
4. **Ouvre le HTML obtenu** et appuie sur `E` pour le rendre interactif.

Facultatif : dépose aussi le `.pptx` (`Fichier → Télécharger → Microsoft
PowerPoint`) en même temps que le PDF pour récupérer les **notes du
présentateur** — le PDF ne les contient pas.

## Ce qui est repris automatiquement du PDF

- Les **liens vers d'autres diapos** posés dans Slides → zones cliquables déjà
  positionnées au bon endroit.
- Les **liens URL** → zones qui ouvrent le lien.
- Les **liens YouTube** (la forme sous laquelle Slides exporte une vidéo
  insérée) → zones qui lancent la vidéo en plein écran.
- Chaque **ligne de texte**, avec sa boîte **exacte** (lue au glyphe près dans
  le PDF) : dans l'éditeur, le bouton **⌖ Objets** les affiche en ambre, un
  clic en fait un bouton qui épouse le texte lui-même — pas la grande boîte de
  texte qui l'entoure. Avec le `.pptx`, les formes et images s'ajoutent en
  vert, et une forme **ronde** donne une zone **ronde**.
- Le **format de chaque page**. Des pages de formats différents dans le même
  PDF ? L'outil te prévient, et l'éditeur propose sur ces pages **« la
  recadrer au format du pack »** pour qu'elles s'affichent à la même taille
  que les autres (sinon elles sont montrées entières, donc plus petites).
  Le mieux reste de garder la même taille de page dans Slides
  (*Fichier → Mise en page*).

La page occupe **toujours tout l'écran** (le plus grand rectangle possible à
son format), même si l'image a été convertie en qualité *Légère* : elle est
agrandie au besoin. Pour un pack lu en plein écran sur de grands moniteurs,
convertis en *Standard* ou *Haute* pour rester net.

Les images des pages sont encodées en **WebP** (même qualité, fichier
nettement plus léger — souvent 30 à 60 % de gain) ; les images que tu ajoutes
par-dessus sont allégées de la même façon quand ça vaut le coup. Tout est
encodé **par ton navigateur, en local** — rien ne sort de ta machine, comme
pour le reste de l'outil. Si le navigateur ne sait pas écrire le WebP, le
convertisseur repasse en JPEG tout seul, et les packs déjà produits en JPEG
se lisent comme avant.

## Le mode édition (touche `E` dans le HTML produit)

C'est un petit outil de mise en page : tu ajoutes des éléments **par-dessus**
la diapo et tu les places à la souris. La diapo d'origine n'est jamais modifiée.

| Outil | Effet |
|---|---|
| **➕ Zone** | Zone cliquable dessinée à la souris. *Invisible* (rien ne s'affiche — pour rendre cliquable un bouton que tu as déjà dessiné dans Slides), *Contour visible*, ou *Bouton avec un texte* (voir [les six styles](#les-boutons-cest-le-texte-qui-fait-la-forme)). |
| **🖼 Image** | Ajoute une image par-dessus la diapo : logo, capture, photo. Cadrage, coins arrondis, ombre, opacité. Tu peux aussi la **déposer directement sur la diapo** ou la **coller** (`Ctrl+V`). |
| **T Texte** | Bloc de texte : couleur, taille, graisse, alignement, ombre, fond coloré. Le cadre suit le texte automatiquement ; **double-clic** pour le réécrire sur la diapo. |
| **▭ Forme** | Rectangle ou ellipse, couleur et opacité réglables : masquer une zone, surligner, poser un fond derrière du texte. |
| **🗔 Panneau** | Une fenêtre qui affiche **une autre diapo à l'intérieur** de celle-ci. Les boutons de la page restent à l'écran, seul le contenu du panneau change — on ne quitte pas la page. |
| **🎬 Vidéo** | Fichier local (embarqué, lecture hors ligne) ou lien YouTube. |
| **👁 sur une vignette** | Cache la diapo : elle sort du fil de lecture (flèches, swipe, compteur) et n'est plus accessible **que** par un bouton qui pointe dessus. C'est ce qui casse le côté linéaire. |

### Éditer comme sur un tableau blanc

- **Double-clic** (ou **clic droit**) sur un endroit vide de la page : une
  petite palette crée un bouton, un texte, une forme ou un panneau **à cet
  endroit**.
- **Clic droit sur un élément** : dupliquer, copier, mettre devant/derrière,
  le partager sur plusieurs pages, supprimer.
- **Glisse une vignette sur la page** : un bouton vers cette diapo est créé,
  libellé déjà rempli.
- Sur un bouton, **🎯 « clique sur une vignette pour choisir »** règle la
  diapo cible en la visant directement — plus rapide qu'une liste déroulante
  à quarante pages. `Échap` annule.
- Le panneau de droite liste **« Sur cette page »** tous les éléments posés :
  un clic sélectionne, même un élément enfoui sous un autre.

**N'importe quel élément peut devenir cliquable** — pas seulement les zones.
Le menu *Au clic* est disponible sur une image, un texte ou une forme : aller à
une diapo précise, suivante / précédente, **retour** (revient d'où venait le
visiteur), ouvrir un lien, ou lire une vidéo en plein écran. Une image fait
souvent un meilleur bouton qu'une pastille.

Sur une diapo cachée, un bouton **↩ Retour** apparaît tout seul.

En édition, les zones invisibles sont **teintées de bleu** et portent une
**étiquette** qui dit ce qu'elles font (`→ Fiche Rig`, `🔗 lien`, `▶ vidéo`…) :
tu retrouves d'un coup d'œil ce que tu as déjà posé. Tout ça disparaît en
lecture, évidemment.

### Les boutons : c'est le texte qui fait la forme

Un bouton n'est **pas** un rectangle posé par-dessus la diapo. Le cadre que tu
dessines ne sert qu'à le **placer** : la forme, elle, se colle au texte, comme
sur un site. Un libellé court donne un bouton court.

Le menu **Style du bouton** apparaît dès qu'une zone est en *Bouton avec un
texte*, et sur **n'importe quel texte** à qui tu donnes une action :

| Style | À quoi ça ressemble |
|---|---|
| **Texte seul** | Aucune boîte : le texte est le bouton. Il se soulève et s'éclaircit au survol. *(défaut pour un texte cliquable)* |
| **Lien souligné** | Le soulignement se déploie de gauche à droite au survol — le lien de site classique. |
| **Contour fin** | Un filet autour du texte, qui se **remplit** au survol. |
| **Pastille pleine** | Fond plein, coins ronds, léger relief au survol. *(défaut pour une zone)* |
| **Verre dépoli** | Fond translucide et flouté, qui laisse voir la diapo au travers. |
| **Bandeau** | Le seul qui remplit tout le cadre dessiné : pour une barre pleine largeur. |

Deux détails qui font la différence avec un PDF :

- **la couleur du texte s'adapte toute seule** au fond du bouton (un bouton
  blanc reçoit du texte sombre, jamais du blanc sur blanc) ;
- **seul le bouton visible est cliquable.** Le cadre autour de lui laisse
  passer la souris : plus de clic fantôme à côté du bouton.

**Taille du texte** est libre sur une zone (*auto* = calée sur la hauteur du
cadre) : tu peux garder un grand cadre et un petit bouton dedans.

### Les trois modes

| Mode | Comment | Ce que c'est |
|---|---|---|
| **✏️ Édition** | touche `E` | Tu montes le pack : outils, panneau de réglages, vignettes. |
| **👁 Test** | bouton *Test* | Exactement ce que verra l'animateur, **sans produire de fichier**. `Échap` te ramène à l'édition. C'est là que tu essaies tes boutons. |
| **🔒 Animateur** | bouton *Animateur* | Le fichier que tu diffuses. **Plus aucun comportement de diaporama** : pas de vignettes, pas de touche `T` ni `N`, pas de clic sur les bords, pas de flèches au clavier, pas de swipe, pas d'accès à l'édition. Seuls tes boutons, ton sommaire et tes panneaux fonctionnent. |

L'export lance la **vérification** avant d'écrire le fichier : s'il reste une
page sans issue ou un renvoi cassé, la liste s'affiche et tu peux corriger — ou
exporter quand même en connaissance de cause.

Garde toujours ton fichier de travail à côté : la version animateur ne se
modifie plus.

### Nommer tes pages

Sélectionne une page (clique dans le vide pour n'avoir aucun élément
sélectionné) → champ **Nom de la page**. Le nom apparaît alors **partout** :
sur les vignettes, dans toutes les listes de destination (« Aller à →
*Fiche Pipo* » au lieu de « Diapo 6 »), dans les galeries, dans le sommaire et
dans les messages de **✓ Vérifier**.

À partir d'une vingtaine de pages, c'est ce qui fait la différence entre s'y
retrouver et compter les numéros. Les pages sans nom gardent le leur.

### Un élément partagé par plusieurs pages (logo, bouton d'accueil)

Sélectionne un élément et coche **Le même sur plusieurs pages**. Il n'existe
alors **qu'en un seul exemplaire** : change son texte, son style ou sa position
depuis n'importe quelle page, ça suit sur toutes les autres.

Juste en dessous, **Sur quelles pages** :

- **Toutes les pages** — le comportement par défaut (logo, bouton d'accueil) ;
- **Les pages que je choisis** — une liste de cases à cocher, une par page,
  avec ses noms. Trois raccourcis : *Tout cocher*, *Tout décocher*, *Cette page
  seule*. Pratique pour un bouton qui ne concerne qu'un chapitre : le retour au
  sommaire d'une partie, un « Suivant » sur les pages d'une même série…

En édition, ces éléments ont un contour vert. Sur une page qu'ils ne
concernent pas, ils restent visibles **en transparence** — tu vois qu'ils
existent et tu peux les rouvrir pour recocher la page ; en lecture ils sont
totalement absents. Décoche la case du haut pour en refaire un élément local.

### Recette : un écran de sélection (personnages, rigs, départements…)

Le cas typique : une page de sélection où l'on clique sur un personnage et où
sa fiche s'affiche **en dessous**, sans quitter la page — la liste des
personnages reste visible pour en choisir un autre.

1. Dans Slides, fais **une page « sélection »** (avec tes vignettes de
   personnages) et **une page par personnage**. Convertis le tout.
2. Dans l'éditeur, **cache** les pages personnages (👁 sur leur vignette) :
   elles ne serviront que de contenu.
3. Sur la page sélection, outil **🗔 Panneau** : dessine la fenêtre à l'endroit
   où la fiche doit apparaître. Laisse *Contenu au départ* sur « — vide — ».
4. Pose une **➕ Zone** sur chaque personnage, puis
   *Au clic → Afficher une diapo dans le panneau → sa fiche*.

Et voilà : un clic remplit le panneau, un autre clic le remplace. Le panneau
se remet à son état de départ quand on quitte la page et qu'on y revient.

La diapo affichée dans un panneau garde **ses propres éléments** : sa fiche
peut donc contenir ses propres boutons, une vidéo, etc.

### Une galerie qui défile dans un panneau

Sélectionne un panneau → section **Galerie** → *Ajouter au défilement*, autant
de diapos que tu veux. Des **flèches** et un **compteur** (« 2 / 6 »)
apparaissent dans le panneau, et on fait défiler sans quitter la page. Un
curseur **Défilement auto** enchaîne tout seul, de 1 à 15 secondes.

C'est la façon de remettre tes séries de planches ou de décors.

### Ouvrir une diapo (ou une image) en grand, par-dessus la page

Action **Ouvrir en grand par-dessus la page** : le lecteur clique sur une
planche, elle s'ouvre en grand au-dessus de la page — **Échap** ou un clic à
côté referme, et il se retrouve exactement là où il était, page intacte.

La cible est au choix une diapo (avec ses propres boutons, qui restent
cliquables en grand) ou, sur un élément image, **l'image elle-même**.

**Plusieurs diapos d'un coup** : sous *Ce qui s'ouvre*, ajoute-en autant que tu
veux au défilement. Des flèches et un compteur apparaissent dans la fenêtre, et
le lecteur **feuillette tes planches** sans jamais quitter la page — au clic ou
aux flèches du clavier. `Échap` referme.

### Vidéo : fichier local aussi bien que YouTube

Action **Lire une vidéo en grand** → bouton **📁 Choisir un fichier vidéo
local**. La vidéo est embarquée dans le HTML et se lit **hors ligne**, sans
rien demander à YouTube. Le lien YouTube reste disponible pour ce qui est déjà
en ligne.

### Donner vie à la page

Ces réglages transforment un enchaînement de pages en une vraie expérience.

| Où | Réglage | Effet |
|---|---|---|
| Panneau de droite, rien de sélectionné | **Transition entre les pages** | **Aucune par défaut** — net, comme un site. Au choix : fondu, glissement, zoom ou vers le haut. Le glissement suit le sens de lecture. |
| Sur un élément, section **Mouvement** | **Apparition** | L'élément entre en scène : fondu, monte, descend, vient de la gauche/droite, zoom. |
| idem | **Retard** | De 0 à 1,5 s. En échelonnant les retards, tes boutons arrivent l'un après l'autre. |
| idem | **Au survol** | *Éclaircit* / *Assombrit* agissent sur ce qu'il y a **dessous** — c'est le bouton que tu as dessiné dans Slides qui réagit, rien n'est peint par-dessus. *Se soulève*, *grossit*, *s'illumine* conviennent aux éléments qui ont un visuel propre (image, texte, bouton plein). |

Pour une zone **invisible**, règle l'**arrondi des coins** — ou passe
**Forme de la zone** sur **Ronde / ovale** pour un bouton rond — afin d'épouser
la forme du bouton dessiné en dessous : sinon la zone réagit en dehors de lui.

Le bouton **▶** de la barre d'outils rejoue les apparitions de la page sans
quitter l'édition.

### Sommaire : une barre toujours accessible

Panneau de droite (rien de sélectionné) → section **Sommaire** → **➕ Ajouter
la diapo au sommaire**. Une barre apparaît en haut de la page produite, avec
un bouton par partie, et **la partie où l'on se trouve reste surlignée**.

C'est ce qui supprime les allers-retours : depuis n'importe quelle page, on
saute directement à la partie voulue.

### Sélecteurs : le bouton actif reste marqué

Quand un bouton alimente un panneau, **celui qui est actuellement affiché se
marque tout seul** (halo blanc). Une rangée de personnages se comporte donc
comme les onglets d'un vrai site : on voit d'un coup d'œil lequel on regarde.

### Copier un chemin serveur

Nouvelle action **Copier un texte** : le lecteur clique, le texte part dans son
presse-papiers, un message le confirme. Parfait pour un chemin réseau
(`\\serveur\projet\rigs\pipo`) qu'on veut coller dans un explorateur ou un
logiciel, sans le retaper.

### L'expérience de lecture : un site, pas un PDF

**C'est le réglage par défaut** d'une conversion neuve : pas d'entête, pas de
compteur « 3 / 12 », pas de barre de progression, pas de bandeau de vignettes,
et la page **occupe tout le cadre** — sans marge, sans coins arrondis, sans
ombre de document posé sur un bureau. L'animateur qui ouvre le pack voit une
page, pas un lecteur de PDF.

Le clavier et les bords de l'écran restent actifs en secours, discrètement :
personne ne se retrouve coincé tant que tu n'as pas posé tes boutons.

Trois profils dans le panneau de droite (rien de sélectionné), section
**« Ce que voit le lecteur »** :

| Profil | Pour quoi |
|---|---|
| 🌐 **Site** *(par défaut)* | Rien autour de la page. On navigue par tes boutons et ton sommaire ; le clavier dépanne. |
| 📄 **Diaporama** | Compteur, progression, vignettes, entête — le comportement d'un visionneur classique, si tu le veux. |
| 🔒 **Kiosque** | Comme *Site*, mais **plus aucune navigation libre** : ni flèches, ni clavier, ni swipe. On n'avance que par tes boutons. |

Chaque repère reste réglable un par un en dessous, et **✓ Vérifier** te
signalera toute page devenue sans issue.

⚠️ En kiosque, vérifie que chaque page a au moins un bouton. La touche `E`
reste ton accès à l'édition, même quand tout est masqué.

### ✓ Vérifier avant de diffuser

Le bouton **✓ Vérifier** de la barre d'outils passe le pack en revue et liste
ce qui piégerait le lecteur. Clique une ligne pour aller directement au
problème :

- une **page sans issue** en mode immersif (plus de flèches, et aucun bouton
  pour en sortir) — le lecteur y resterait bloqué ;
- un **renvoi vers une page qui n'existe plus** (bouton, galerie ou sommaire) ;
- une **page cachée que rien n'atteint**, donc invisible pour toujours ;
- un **bouton sans destination** : lien vide, texte à copier vide, vidéo non
  choisie ;
- un **panneau qui restera vide**, qu'aucun bouton ne remplit ;
- un **média perdu** ou un élément **hors du cadre**.

Un élément commun qui navigue (bouton d'accueil sur toutes les pages) ou un
sommaire suffisent à donner une issue partout : la vérification en tient compte.

### Manipulations

| | |
|---|---|
| Déplacer | glisser — ça s'aimante aux bords et au centre (`Alt` pour l'ignorer) |
| Redimensionner | poignées orange (coin haut-gauche et bas-droit) |
| Ajuster finement | flèches du clavier (`Maj` = pas plus grand) |
| Annuler / rétablir | `Ctrl+Z` / `Ctrl+Y` |
| Dupliquer, copier, coller | `Ctrl+D`, `Ctrl+C`, `Ctrl+V` |
| Dupliquer, empiler, supprimer | la petite barre qui apparaît au-dessus de l'élément sélectionné |
| Supprimer | `Suppr` |
| Enregistrer | `Ctrl+S` |

**💾 Enregistrer** retélécharge le HTML à jour : tu remplaces l'ancien fichier
par celui-ci, tes réglages sont dedans. Il n'y a pas de fichier de projet à
gérer à côté — la page se réécrit elle-même.

**🔒 Export final** produit une copie sans mode édition, à diffuser.

## Raccourcis de la page produite

`← →` naviguer · `F` plein écran · `N` notes · `T` vignettes · `E` édition ·
`Suppr` supprimer la sélection · `Échap` annuler. Clic sur les bords, swipe
tactile, et `#3` à la fin de l'URL pour ouvrir directement une diapo.

## Mettre à jour un pack déjà monté

Tu as corrigé une coquille dans Slides, ajouté un personnage, remplacé une
planche ? **Tu ne perds pas ton travail d'interactivité.**

Réexporte le PDF, puis dépose dans le convertisseur **le nouveau PDF *et* ton
`.html` précédent**. Les images sont refaites à neuf ; boutons, panneaux,
galeries, diapos cachées, sommaire, éléments communs, transitions et réglages
de lecture sont transplantés sur les nouvelles pages.

La correspondance se fait **page par page, dans l'ordre** : la page 3 reprend
ce qui était sur la page 3. Donc :

- ajouter des pages **à la fin** ne dérange rien ;
- insérer ou supprimer une page **au milieu** décale tout ce qui suit — il
  faudra reprendre les pages décalées ;
- si le nouveau deck est plus court, le travail des pages en trop est perdu, et
  le journal te le dit.

Les renvois devenus impossibles (un bouton qui pointait vers une page
disparue) sont corrigés automatiquement, et le journal indique combien — pense
à les vérifier.

## Pour bidouiller le code

`Convertisseur.html` est **assemblé** à partir de `src/` et `vendor/` :

```
src/converter.html   interface du convertisseur
src/converter.js     PDF → images + liens → fichier HTML de sortie
src/viewer.js        l'application embarquée dans le HTML produit (visionneuse + éditeur)
vendor/              pdf.js (Mozilla, Apache-2.0) et fflate (MIT)
build.py             python3 build.py  → régénère Convertisseur.html
```

Après toute modification de `src/`, relancer `python3 build.py` — un job
GitHub Actions vérifie que le fichier livré correspond bien à ses sources.
