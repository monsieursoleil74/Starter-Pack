# Prompt à envoyer à Claude Design (pour la maquette)

Copie-colle le texte ci-dessous dans ta conversation Claude Design, avec ta
maquette. Il explique les quelques conventions qui rendent une page
**remplissable** par l'éditeur local — sans rien changer à son allure.

---

## À copier-coller

Cette maquette n'est pas une page figée : elle est ensuite **remplie avec les
vrais visuels** par un éditeur local qui n'a pas accès à ton code. Il ne peut
que remplacer ce qui existe déjà dans le DOM. Merci d'appliquer les six règles
ci-dessous — elles ne changent rien au rendu, elles rendent la page
remplissable.

**1. Une entrée par visuel dans la réserve d'images, jamais de fichier
réutilisé.** Garde la réserve cachée (`#rg-assetmap`, une `<img data-k="chemin">`
par fichier) : c'est elle qui rend chaque visuel remplaçable indépendamment.
Mais chaque contenu distinct doit avoir **son propre chemin**. Aujourd'hui
`ph_decor_01.png` sert à la fois au « Décor proto 01 » et au « Décor proto 05 » :
remplacer l'un remplace l'autre. Même chose pour le portrait « PROTO
PERSONNAGE », identique pour tout le monde. Il faut :
`assets_nda/decors/decor_01.png` … `decor_06.png`,
`assets_nda/personnages/<slug>/<slug>_portrait.png` pour chaque personnage,
`assets_nda/colorscript/sq01.png` … pour chaque plan du color script. Des
fichiers qui n'existent pas encore, ce n'est pas grave — mets un placeholder
différent par entrée ; ce sont ces entrées-là qu'on remplira.

**2. Un même visuel doit venir d'une seule source.** Si la vignette d'un
carrousel et son agrandissement (la visionneuse) montrent le même plan, ils
doivent lire **la même entrée** de la réserve. Aujourd'hui l'agrandissement se
fabrique une adresse de son côté (`background-image` construite dans du style
en ligne) : remplacer la vignette n'agrandit plus la bonne image. Fais lire la
même valeur aux deux, ou mieux : que la visionneuse affiche une vraie
`<img src="…">` plutôt qu'un fond CSS.

**3. Une vraie balise plutôt qu'un décor.** Là où une vidéo doit se lire, mets
un `<video controls src="…">` (même vide, même sans fichier). Là où une image
doit s'afficher, mets une `<img>`. Un bloc décoratif qui dit « VIDÉO PROTO — … »
n'est pas un emplacement : l'éditeur doit en fabriquer un, et ça marche moins
bien.

**4. Si un emplacement est partagé, qu'il affiche un texte qui l'identifie.**
Ta fenêtre vidéo est unique et sert à tous les tutoriels (RIG, TOOLS…). C'est
très bien — à condition qu'elle affiche **le titre du tutoriel en cours**
(c'est déjà le cas : garde-le, et garde-le au même endroit dans la fenêtre).
C'est ce texte qui permet de donner une vidéo différente à chaque bouton. Idem
pour la visionneuse d'images : garde son libellé (« Décor proto 05 — rough »).
Mieux encore si tu peux : **une balise par contenu** plutôt qu'une seule
partagée.

**5. Des `alt` qui distinguent les contenus.** Deux images affichées tour à
tour dans le même cadre doivent avoir des `alt` différents et **qui suivent le
contenu** : `alt="Planche I — Pipo"`, `alt="Planche I — Bruno"`, et non
`alt="Planche proto I"` pour tout le monde. C'est le repère qui empêche une
retouche de déborder sur les autres personnages.

**6. Ne remplace pas la balise `<html>` au démarrage.** Reconstruire `<body>`
ne pose pas de problème, remplacer la racine casse tout ce qui observe la page.

Un test simple pour vérifier : **est-ce que chaque visuel de la page a une
balise à lui, atteignable, avec une adresse ou un `alt` qui n'est utilisé par
personne d'autre ?** Si oui, la page est remplissable.

---

## Pourquoi ces règles

L'éditeur applique ses retouches **par-dessus** la page, sans réécrire le code :
c'est ce qui permet de reprendre le travail et de ne rien casser. En échange,
il lui faut, pour chaque contenu, **un point d'accroche stable et unique**. Les
règles ci-dessus ne demandent rien d'autre.

## Règle 7 — retrouver un visuel par son chemin, jamais par son `src`

Un clic qui ouvre un visuel en grand (lightbox, agrandissement) ne doit pas
retrouver son contenu **en comparant le `src` affiché** à une table interne :
un `src` peut changer (édition, remplacement) et la correspondance casse.
Porte plutôt le chemin sur l'élément cliquable (`data-k="assets_nda/…"`)
et résous par ce chemin. Aucun effet sur le rendu.

## Règle 8 — un agrandissement doit permettre de parcourir la série

Quand un visuel appartient à une série (planches, concepts 2D, color script,
décors), son agrandissement doit offrir **précédent / suivant** — flèches
cliquables et touches ← →, en bouclant. Aujourd'hui l'agrandissement n'a
qu'une croix : pour voir la planche suivante il faut refermer, attendre le
fondu du carrousel, recliquer. Résous la navigation par le chemin (`data-k`)
de l'élément affiché, jamais en comparant des `src` (règle 7).

## Règle 9 — tout visuel référencé doit être embarqué (ou déclaré en réserve)

La page ne doit jamais afficher un `<img>` dont le fichier n'est ni embarqué
dans le bundle, ni déclaré dans la réserve : il apparaît cassé dès l'ouverture
(icône d'image brisée). Dernier cas constaté : `pipo_concept2d_03.png` à
`_06.png`, `cs_15.jpg` et `syncsketch_logo.png` référencés dans la page alors
que la réserve s'arrête à `pipo_concept2d_02` et `cs_14`. Si un emplacement
est prévu « à remplir plus tard », donne-lui un visuel de remplissage embarqué
et une entrée de réserve — jamais un chemin mort.

## Règle 10 — un emplacement vide porte lui aussi son chemin (`data-k`)

Un carré « à remplir » (PORTRAIT / SAM / sam_portrait.png) doit porter le
chemin de son fichier **sur l'élément lui-même** : `data-k="assets_nda/…"`.
C'est ce qui permet à une retouche de suivre SON personnage quand la grille
se reconstruit dans un autre ordre (changement de page, sélection) — sans ce
chemin, l'emplacement n'est repérable que par sa position, et le visuel posé
part chez le voisin. Aucun effet sur le rendu.
