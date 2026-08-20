# Éditeur HTML local — le manuel

Tu as une **maquette HTML** qui te plaît. Cet outil te permet d'en **remplacer
le contenu** — textes, images, vidéos, liens — sans toucher au code, et de
récupérer un fichier prêt à diffuser.

**Rien à installer** : `Editeur-HTML.html` est une page web que tu ouvres en
double-cliquant. Tout se passe dans ton navigateur, **aucun fichier n'est
envoyé en ligne**.

[⬇ Télécharger la dernière version](https://github.com/monsieursoleil74/Starter-Pack/releases/download/outil/Editeur-HTML.html)
— le numéro de version s'affiche à côté du nom, sur l'écran d'accueil
(`2026-08-08g` au moment où ces lignes sont écrites). Si un comportement ne
correspond pas à ce manuel, commence par retélécharger.

---

## Démarrage rapide

1. Double-clic sur `Editeur-HTML.html`.
2. Dépose ta maquette `.html` dedans.
3. Choisis un mode en haut : **Textes**, **Images**, **Vidéos**, **Liens**.
4. Clique dans la page ce que tu veux changer.
5. **Exporter** → tu récupères `ta-maquette - modifie.html`.

---

## Sommaire

1. [L'interface](#1-linterface)
2. [Textes](#2-textes)
3. [Images](#3-images)
4. [Vidéos](#4-vidéos)
5. [Liens](#5-liens)
6. [L'onglet du navigateur](#6-longlet-du-navigateur)
7. [Enregistrer, reprendre, transférer](#7-enregistrer-reprendre-transférer)
8. [Poids du fichier](#8-poids-du-fichier)
9. [Dépannage](#9-dépannage)
10. [Ce que l'outil ne peut pas faire](#10-ce-que-loutil-ne-peut-pas-faire)

---

## 1. L'interface

Une **barre en haut** : la marque et le nom du fichier à gauche, les **cinq
modes** au centre, les actions à droite — annuler, recharger, **aide**,
**Exporter**.

Un **panneau à droite**, en deux zones : en haut ce que le mode en cours donne à
voir (les visuels, les liens, les réglages de l'onglet), qui défile tout seul ;
en bas **« Mes retouches »**, ancré — avec 144 visuels, ton travail ne doit pas
se retrouver trois écrans plus bas. Clique le titre pour replier la section et
rendre la place au reste.

Le reste de l'écran, c'est **ta page**, telle qu'elle sera.

| Mode | Ce qu'il fait |
|---|---|
| **Textes** | clique un texte, réécris-le |
| **Images** | remplace une image, ou pose-en une là où il n'y en a pas |
| **Vidéos** | branche une vidéo locale sur un lecteur ou un encadré |
| **Liens** | donne sa destination à chaque bouton |
| **Aperçu** | la page redevient normale : tu cliques ses boutons et tu vérifies |

**Le principe, une fois pour toutes.** Ta page est ouverte **telle quelle**,
avec ses scripts, ses polices et ses animations. Tes retouches ne réécrivent
pas le code : elles sont enregistrées **par-dessus**. Le fichier exporté est
ton original **plus un petit correctif** qui rejoue les remplacements à
l'ouverture.

Trois conséquences très pratiques :

- **Rien ne casse.** Même une page dont le contenu est construit par du
  JavaScript au chargement fonctionne : le correctif attend que la page soit
  construite, et se réapplique si elle se reconstruit (onglet, filtre…).
- **C'est réversible.** Chaque retouche est listée à droite avec une croix pour
  l'annuler. `Ctrl+Z` annule la dernière.
- **C'est reprenable.** Redépose le fichier exporté : tes retouches sont
  retrouvées. Pas d'empilement, le correctif est régénéré à chaque export.

### « Mes retouches », le journal de ton travail

Le bas du panneau liste tout ce que tu as changé, dans l'ordre.

- **Clique le nom d'une ligne** : l'outil te ramène à l'endroit dans la page et
  le fait clignoter. Si le visuel vit dans une fenêtre fermée ou dans un
  carrousel qui ne l'affiche pas, il te le dit plutôt que de ne rien faire.
- La **croix** annule cette retouche-là ; le **bouton de recadrage** rouvre le
  cadrage d'une image.
- Le **poids affiché à côté du titre** est celui du fichier que tu vas exporter,
  remis à jour à chaque retouche (voir [§ 8](#8-poids-du-fichier)).

### Aide et raccourcis

Le bouton **?** de la barre (ou la touche `?`) ouvre un mémo : ce que fait
chaque mode, les astuces, les raccourcis. Il marche aussi quand le curseur est
dans la page.

| Touche | Effet |
|---|---|
| `1` … `5` | passer d'un mode à l'autre |
| `Ctrl+Z` | annuler la dernière retouche |
| `Ctrl+S` | exporter |
| `Échap` | valider un texte · fermer une fenêtre |
| `?` | ouvrir le mémo |

Les raccourcis ne se déclenchent jamais pendant que tu écris : taper `3` dans un
texte écrit un `3`.

---

## 2. Textes

Clique un texte : **le curseur se pose à l'endroit du clic**, comme dans un
vrai éditeur. Tu sélectionnes à la souris, tu supprimes ou corriges juste ce
qui t'intéresse, tu colles au curseur. `Ctrl+A` pour tout réécrire d'un coup.
Un clic ailleurs — ou `Échap` — valide.

**Le texte collé prend le style du site.** Coller depuis Word, Google Docs,
Google Slides ou une page web apporte normalement toute la mise en forme
d'origine (police énorme, couleurs, interlignes). L'outil ne garde **que le
texte** : il prend la police et la taille de ta maquette. Rien à nettoyer —
même en copiant une zone de texte entière depuis Slides.

**Un texte découpé en morceaux s'édite en entier.** Les maquettes générées
enrobent souvent chaque phrase dans des `<span>` ou de l'italique : l'outil
édite le paragraphe complet. Sa mise en forme interne (un mot en gras au
milieu) est unifiée au style du bloc.

**La même fiche pour plusieurs personnages.** L'arc de Pipo puis celui de
Bruno passent dans le même bloc ? Chaque retouche est accrochée à **son texte
d'origine** et ne s'applique que quand il est affiché : éditer l'un ne touche
pas l'autre, et chacun garde le sien en naviguant.

**Même les placeholders identiques.** « Prénom Nom », « Réf. anim »… le même
texte de remplissage pour chaque personnage ? La retouche s'accroche en plus au
**nom affiché au-dessus** (le titre le plus proche) : celui de Pipo ne
s'applique que sur la fiche de Pipo. Et si tu renommes le personnage, ses
retouches suivent le nouveau nom.

**Une retouche de texte ne s'applique que si l'original est encore là.** Si tu
changes de version de maquette et que ce texte a changé, la retouche est
ignorée au lieu d'écraser le nouveau contenu.

---

## 3. Images

### Remplacer une image

Clique-la. Le survol te dit à l'avance ce qu'un clic va faire :

- **cadre vert plein** → une image : clic = la remplacer ;
- **cadre orange pointillé** → une zone sans image : clic = **y poser** une
  image (voir plus bas) ;
- *« 3 images ici — clique pour choisir »* → plusieurs images sont superposées.

**Une image que tu as déjà remplacée** : re-cliquer dessus ouvre directement
le **recadrage** (repositionner, zoomer) — pas l'explorateur de fichiers. Pour
changer de fichier : le bouton **« Remplacer… »** dans la barre de recadrage,
ou lâche simplement le nouveau fichier dessus.

### Glisser-déposer

Plus rapide que le sélecteur de fichier : en mode **Images**, prends ton fichier
dans l'explorateur et **lâche-le sur l'image** — c'est tout. Sur une pile
(carrousel), l'outil te demande d'abord laquelle remplacer, puis utilise le
fichier que tu viens de lâcher : il ne te le redemande pas.

Un fichier lâché ailleurs qu'en mode Images, ou qui n'est pas une image, est
refusé et l'outil te le dit — l'aperçu ne quitte jamais ta page.

### Poser toute une série d'un coup

Les cinq planches de Rex sont dans un dossier ? **Sélectionne-les toutes et
lâche-les sur la famille « Rex »** dans la liste de droite. Elles se rangent
dans ses emplacements, dans l'ordre.

- **L'ordre, c'est celui des noms de fichiers**, pas celui de ta sélection —
  l'explorateur ne le garantit pas. Les nombres sont lus comme des nombres :
  `planche_2` passe avant `planche_10`.
- **Tu relis avant que ça parte.** Une fenêtre montre l'appariement fichier par
  fichier — `rex_a_02.png → Portrait`, `rex_b_03.png → Planche 02`… Rien n'est
  posé tant que tu n'as pas confirmé.
- **Rien ne part en douce.** Un emplacement déjà retouché qui va être écrasé est
  marqué `⟳`, et les fichiers en trop sont annoncés comme *sans place* — ils ne
  sont pas posés.
- **Lâche sur une vignette plutôt que sur la famille** pour commencer à **cet**
  emplacement-là et remplir la suite. Pratique pour ne remplacer que la fin
  d'une série.

Un seul fichier lâché sur une famille ou une vignette se pose directement, sans
fenêtre. Sur la page elle-même, un emplacement ne prend qu'une image : lâcher
plusieurs fichiers dessus te renvoie vers la liste.

### Carrousels et images empilées

Dans un carrousel, les images sont **superposées** et une seule est visible :
un clic n'atteindrait que celle du dessus. **Clique simplement le carrousel** :
l'outil regarde toute la pile sous ton curseur et t'ouvre **la liste de SES
images**. Le panneau **reste ouvert** — tu enchaînes la deuxième, la troisième,
sans re-viser.

Chaque image indique si elle est **affichée** ou **pas affichée en ce
moment** : celle que tu remplaces n'est pas forcément celle que tu vois, elle
apparaîtra quand le carrousel la fera défiler.

Même mécanisme pour un visuel **caché sous un dégradé et du texte** (une carte
dont l'image sert de fond) : l'outil voit ce qu'il y a dessous.

### Le panneau te suit

Après chaque remplacement, le panneau de droite **déplie la famille concernée
et amène sa vignette en vue**, marquée un instant. Et re-remplir une longue
liste ne te renvoie plus en haut : la position de défilement est conservée.

### Savoir où tu en es

En haut de la liste : **une jauge et un compte** — *« 34 sur 144 remplacés ·
110 à faire »*. Chaque famille porte le sien (*« Rex 3/5 »*) avec une barre fine
sous son titre, et passe en vert quand elle est complète. C'est la checklist du
pack, sans rien à tenir à jour à la main.

### La liste des visuels, rangée

Si la maquette range ses visuels dans une **réserve** (une balise par fichier,
avec son chemin), l'outil s'en sert comme **table des matières** :

```
Rex — 5 visuels
  Portrait · Planche 01 · Planche 02 · Concept 2D 01 · Concept 2D 02
Color script — 14 visuels
Décors — 10 visuels
Logos — 3 visuels
```

- **Les familles sont repliées** au-delà de six : tu ouvres celle sur laquelle
  tu travailles. Une **pastille verte** marque celles déjà retouchées.
- **Le champ de recherche** filtre sur le libellé, le chemin et le nom de
  famille, ignore les accents, et **déplie ce qu'il trouve**. `Échap` efface.
- Le **chemin complet** s'affiche au survol d'une vignette.

Sans réserve, la liste reste groupée par bloc de la page.

### Un fichier générique partagé (les deux réalisateurs)

Une maquette pose parfois **le même fichier de remplissage** à deux endroits
qui sont pourtant deux contenus — la photo des deux réalisateurs, par exemple.
Quand leurs descriptions (`alt`) diffèrent, l'outil comprend et **ne change que
celui que tu as cliqué**.

### Un visuel par personnage

Une maquette réutilise souvent **la même balise** pour afficher tour à tour la
fiche de Pipo puis celle de Bruno. Deux mécanismes évitent que ta retouche
déborde :

- **la réserve** — l'outil retouche l'entrée du fichier
  (`personnages/rex/rex_planche_01.jpg`), donc seul Rex change, et le visuel
  suit partout où ce fichier sert (vignette **et** agrandissement) ;
- **la description (`alt`)** quand il n'y a pas de réserve — la retouche est
  liée à ce contenu-là, et le visuel d'origine revient pour les autres.

### Poser une image là où il n'y en a pas

Une pastille de personnage, c'est souvent juste une lettre sur un fond de
couleur. Clique-la (cadre orange pointillé), puis choisis :

- **à la place du contenu** — l'image remplit la zone, la lettre est masquée ;
- **en fond** — l'image se place derrière, le texte reste lisible par-dessus.

L'image est cadrée en *cover* : elle remplit sans se déformer, quitte à rogner.

### Montrer toute l'image

Le cadrage plein (*cover*) remplit le cadre quitte à rogner — c'est le bon choix
pour une bannière, pas toujours pour un **portrait plein pied**. Dans la barre
de recadrage, **« Toute l'image »** montre le visuel en entier : des marges
apparaissent au besoin, et tu peux glisser l'image dans ces marges. Le bouton
devient « Remplir le cadre » pour revenir en arrière.

### Recadrer

Ton visuel n'a presque jamais le format du cadre. Dès qu'une image posée
**déborde**, la barre de recadrage s'ouvre :

- **glisse l'image** pour choisir ce qu'on garde — ça marche aussi à travers
  un dégradé ou un titre posé dessus ;
- **zoome** à la molette ou au curseur, jusqu'à 4× ;
- **Recentrer** annule, **Terminé** referme.

Tu peux y revenir : chaque retouche d'image porte un bouton de recadrage dans
le panneau. Le réglage est enregistré en **pourcentages**, pas en pixels — un
écran plus large ne le décale pas — et il suit le visuel partout où il sert.

---

## 4. Vidéos

Beaucoup de maquettes ont un encadré « VIDÉO » qui ne contient **aucun
lecteur** : c'est un décor. Le mode Vidéos en pose un vrai.

Si la vidéo s'ouvre **dans une fenêtre** (bouton *RIG*, *Sa présentation*…),
**clique ce bouton** : l'outil ouvre la fenêtre et vise l'emplacement du
lecteur à l'intérieur — pas le bouton.

**Trois façons, et le choix compte :**

| | Le fichier HTML | La vidéo |
|---|---|---|
| **Posée à côté** *(recommandé)* | reste léger | dans un sous-dossier `videos/`, **avec son nom d'origine** |
| **Embarquée** | grossit d'environ 1,4 × le poids de la vidéo | dans le fichier |
| **Chemin tapé à la main** | reste léger | exactement là où tu l'as écrit |

Pour un pack diffusé sur le serveur du studio, **« posée à côté »** est presque
toujours le bon choix : tu ranges tes fichiers **tels quels** dans un
sous-dossier `videos/` à côté du HTML, sans les renommer — le pack les
retrouve tout seul (il essaie aussi `video/` et le chemin d'origine de la
maquette). Le panneau de droite te rappelle la liste des fichiers à copier.
Et si tu préfères tout contrôler, **« j'indique moi-même le chemin »** :
tu tapes `videos/ma-video.mp4` (relatif au HTML) ou une adresse `https://…`,
et c'est ce chemin-là qui est utilisé, sans aucune devinette.

**Si la maquette range ses vidéos dans une réserve**, l'outil branche la tienne
sur l'entrée du fichier : chaque tuto, chaque personnage garde la sienne — et
là aussi, ton fichier rangé dans `videos/` sous son nom d'origine suffit.

**Les identifiants d'un outil** (Login, Mot de passe) sont posés dans une
carte qui est un lien : tu les modifies comme n'importe quel texte, et dans
le pack final **un clic dessus les sélectionne et les copie** — sans ouvrir
la page. Le reste de la carte, lui, ouvre toujours son lien.

**Une seule fenêtre, plusieurs boutons.** Quand la maquette n'a qu'une fenêtre
vidéo partagée et pas de réserve, l'outil retient **le titre qu'elle affiche**
au moment où tu poses la vidéo : chaque bouton garde ainsi la sienne.

**Tu la vois tout de suite** : même en « posée à côté », le lecteur lit ta
vidéo depuis ton disque pendant que tu travailles. Le HTML exporté, lui, garde
le chemin propre.

**Si le lecteur reste noir**, c'est le format : un navigateur lit le **MP4
(H.264)** et le **WebM**. ProRes, HEVC, `.mkv`, `.avi` ne se liront pas, même
s'ils s'ouvrent dans QuickTime ou VLC. L'outil te le dit.

---

## 5. Liens

Les boutons d'une maquette pointent souvent vers `#` — nulle part. Le mode
Liens liste **tous les liens de la page** avec leur destination, et **signale
en orange ceux qui n'ont pas d'adresse**.

- Le champ est pré-rempli : tu corriges au lieu de retaper.
- **« Ouvrir dans un nouvel onglet »**, coché par défaut.
- Sur un **bouton qui n'est pas un vrai lien**, l'outil pose un clic qui ouvre
  l'adresse. Ça marche pareil à l'arrivée.

**Les cartes « chemin » (animatique, rigs…).** Le chemin affiché se corrige en
mode **Textes**, tout simplement — et le bouton **« Copier le chemin »** d'à
côté copie alors **ce qui est affiché**, plus la valeur d'usine de la maquette.
Ça vaut même si tu remplaces le chemin par un simple mot.

**Les cartes dont le chemin n'est pas affiché** (« Serveur de production »,
« Références anim »…) : la maquette copie une valeur codée en dur, invisible à
l'écran — rien à corriger en mode Textes. Passe en mode **Liens** et clique la
carte : la fenêtre montre un champ **« Chemin copié par le bouton "Copier" »**,
pré-rempli avec la valeur d'usine. Remplace-la (tu peux laisser l'adresse
vide), et le bouton de la carte copiera ton chemin — dans l'aperçu comme dans
le pack livré. Une bulle **« Copié ✓ »** confirme chaque copie.

**Chemins réseau** (`\\serveur\projet\…`) : tu peux les saisir, mais les
navigateurs refusent le plus souvent de les ouvrir depuis une page web, par
sécurité. Si le pack est lu depuis le même partage, un chemin **relatif**
(`../rigs/pipo/`) est bien plus fiable.

---

## 6. L'onglet du navigateur

Un pack diffusé s'ouvre avec **l'icône blanche par défaut** et le titre de la
maquette — souvent aucun, auquel cas l'onglet affiche le nom du fichier.

En bas du panneau de droite : **Choisir une icône** (n'importe quelle image,
ramenée à 128 px et recadrée au carré — quelques kilo-octets) et **le titre**.
Les deux partent avec le fichier exporté.

À 16 px dans un onglet, une bannière ne donne rien : prends un **logo carré**
ou un détail lisible en tout petit.

---

## 7. Enregistrer, reprendre, transférer

**Le fichier exporté EST ta sauvegarde.** Il contient ta maquette et toutes tes
retouches.

| Tu veux… | Ce que tu fais |
|---|---|
| continuer plus tard, même machine | rien : l'outil propose de reprendre |
| continuer sur **un autre ordinateur** | emporte le **fichier exporté**, dépose-le dans l'outil |
| appliquer ton travail à une **nouvelle version de la maquette** | ouvre la nouvelle, puis **« Reprendre les retouches d'un autre fichier… »** |

**La nouvelle version vient d'être régénérée** (Claude Design a bougé la
structure interne) ? Ça marche quand même : au transfert, chaque retouche est
**ré-ancrée** — un texte est retrouvé par son contenu d'origine (même enrobé
de `<span>`, même découpé autrement), une image par sa description. Ce qui
n'existe vraiment plus dans la nouvelle version est laissé de côté, et l'outil
te liste quoi précisément.

**Les textes des fiches personnages** (arc, espèce, réf…) ne sont visibles que
quand leur personnage est affiché : au transfert, ceux des autres personnages
sont gardés **en attente**, et se recalent tout seuls dès que tu ouvres leur
fiche. Avant d'exporter, **passe une fois sur chaque personnage retouché** —
tu vérifies d'un coup d'œil, et tout se recale au passage.

### Sauvegarde de secours

L'outil garde sur ta machine la page d'origine **et** tes retouches, mises à
jour à chaque changement — un « sauvegardé » discret l'indique dans la barre. À
la réouverture, une bande propose : *« Reprendre "ma-maquette.html" —
34 retouches, il y a 12 min »*. Tu reprends **sans redéposer le fichier**.

Le stockage est celui du navigateur, sur ton disque : rien ne sort de la
machine. Il est vaste mais pas infini — si le disque est plein, l'outil te
prévient au lieu de faire semblant.

### Quand la maquette change

C'est le cas délicat : la maquette a été régénérée, des sections ont bougé, des
personnages ont été ajoutés. L'outil s'accroche au **chemin du fichier**, pas à
la position dans la page : ta planche de Rex reste celle de Rex même si dix
personnages ont été insérés avant lui.

À la reprise, il ne reprend **que ce qu'il peut replacer sans doute possible** :
entrée de réserve retrouvée par son chemin, texte dont l'original est toujours
là, image accrochée à sa description, vidéo accrochée au titre de sa fenêtre.
Le reste est **laissé de côté et annoncé** — mieux vaut refaire trois retouches
que d'en poser une au mauvais endroit.

**Un conseil :** garde tes exports datés (`Pack-2026-07-31.html`). C'est ton
historique, et ça ne coûte que de l'espace disque.

---

## 8. Poids du fichier

Chaque image que tu déposes est **encodée dans le HTML**, en base64 : pas de
dossier d'images à côté, le fichier se suffit à lui-même. Il grossit donc
d'environ **1,37 × le poids de tes images**.

L'outil affiche l'**estimation en direct** à côté de « Mes retouches » : tu vois
le fichier grossir au fur et à mesure, sans avoir à exporter pour le découvrir.

Mesures faites sur un navigateur, fichiers remplis d'images incompressibles :

| Poids du HTML | Ouverture (disque local) | Mémoire |
|---|---|---|
| 16 Mo | 0,3 s | +279 Mo |
| 69 Mo | 0,9 s | +275 Mo |
| 137 Mo | 1,8 s | +287 Mo |

**Ce qu'il faut en retenir :**

- **en local, même 137 Mo passent** — le navigateur ne décode que les images
  affichées ;
- **le vrai coût est sur le réseau** : 100 Mo à travers un partage, c'est
  ~8 s à 100 Mbit/s, à chaque ouverture et par chaque personne ;
- **la limite dure, c'est l'envoi** : au-delà de ~25 Mo, plus de mail ni de
  messagerie.

**Vise 20 à 30 Mo.** Concrètement : réduis tes planches à **1600–2000 px de
large, JPEG qualité 80** avant de les déposer — 200 à 400 Ko pièce. À l'écran,
la différence avec un fichier 4000 px est invisible.

Les images que tu **ne touches pas** restent exactement comme elles étaient.
Les vidéos « posées à côté » ne pèsent rien dans le HTML.

---

## 9. Dépannage

**Le lecteur vidéo reste noir.** Format non lisible par un navigateur (ProRes,
HEVC, `.mkv`) → réexporte en MP4 H.264 ou WebM. Ou, en « posée à côté », le
fichier n'a pas encore été copié à l'endroit indiqué.

**Je ne peux pas cliquer une image.** Elle est sous une autre, ou sous un
dégradé : l'outil regarde toute la pile, mais si le survol n'annonce rien,
passe par **la liste de droite** — elle contient tout, y compris ce qui est
hors écran.

**Ma retouche a disparu après un changement de maquette.** Elle n'a pas pu être
replacée avec certitude ; l'outil te l'a annoncé à la reprise. Refais-la.

**Un lien de menu ne fait rien en Aperçu.** Il fait défiler jusqu'à la section,
comme dans le fichier final. Les liens vers l'extérieur s'ouvrent dans un
onglet ; ceux vers un autre fichier sont seulement annoncés, pour ne pas perdre
ton travail en cours.

**L'outil ne se comporte pas comme ce manuel.** Vérifie le numéro de version
sur l'écran d'accueil et retélécharge.

---

## 10. Ce que l'outil ne peut pas faire

Il **remplit ce qui existe**. Il ne déplace pas les blocs, ne change pas la
mise en page, n'ajoute pas de section — c'est un remplaçeur de contenu, pas un
constructeur de site.

Il ne peut pas non plus **inventer un emplacement** : si la maquette affiche
littéralement le même fichier pour deux contenus, ou si un agrandissement se
fabrique son image de son côté, aucun outil ne pourra les distinguer.

Dans ce cas, c'est la maquette qu'il faut faire évoluer :
[`POUR-CLAUDE-DESIGN.md`](POUR-CLAUDE-DESIGN.md) contient un texte prêt à
copier-coller à l'outil qui l'a fabriquée — six règles simples, sans effet sur
le rendu, qui rendent une page remplissable.

---

## Fichiers

```
Editeur-HTML.html      l'outil, autonome et sans dépendance
README.md              ce manuel
POUR-CLAUDE-DESIGN.md  les règles à transmettre à l'outil qui fabrique la maquette
```
