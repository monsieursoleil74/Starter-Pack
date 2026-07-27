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

## Le mode édition (touche `E` dans le HTML produit)

C'est un petit outil de mise en page : tu ajoutes des éléments **par-dessus**
la diapo et tu les places à la souris. La diapo d'origine n'est jamais modifiée.

| Outil | Effet |
|---|---|
| **➕ Zone** | Zone cliquable dessinée à la souris. *Invisible* (rien ne s'affiche — pour rendre cliquable un bouton que tu as déjà dessiné dans Slides), *Contour visible*, ou *Bouton plein* (pastille colorée, texte + icône). Arrondi des coins réglable. |
| **🖼 Image** | Ajoute une image par-dessus la diapo : logo, capture, photo. Cadrage, coins arrondis, ombre, opacité. Tu peux aussi la **déposer directement sur la diapo** ou la **coller** (`Ctrl+V`). |
| **T Texte** | Bloc de texte : couleur, taille, graisse, alignement, ombre, fond coloré. Le cadre suit le texte automatiquement ; **double-clic** pour le réécrire sur la diapo. |
| **▭ Forme** | Rectangle ou ellipse, couleur et opacité réglables : masquer une zone, surligner, poser un fond derrière du texte. |
| **🗔 Panneau** | Une fenêtre qui affiche **une autre diapo à l'intérieur** de celle-ci. Les boutons de la page restent à l'écran, seul le contenu du panneau change — on ne quitte pas la page. |
| **🎬 Vidéo** | Fichier local (embarqué, lecture hors ligne) ou lien YouTube. |
| **👁 sur une vignette** | Cache la diapo : elle sort du fil de lecture (flèches, swipe, compteur) et n'est plus accessible **que** par un bouton qui pointe dessus. C'est ce qui casse le côté linéaire. |

**N'importe quel élément peut devenir cliquable** — pas seulement les zones.
Le menu *Au clic* est disponible sur une image, un texte ou une forme : aller à
une diapo précise, suivante / précédente, **retour** (revient d'où venait le
visiteur), ouvrir un lien, ou lire une vidéo en plein écran. Une image fait
souvent un meilleur bouton qu'une pastille.

Sur une diapo cachée, un bouton **↩ Retour** apparaît tout seul.

### Un élément sur toutes les pages (logo, bouton d'accueil)

Sélectionne un élément et coche **Sur toutes les pages**. Il apparaît partout,
et surtout : **tu ne le modifies qu'une fois**. Change son texte ou sa position
depuis n'importe quelle page, ça suit sur toutes les autres.

En édition, ces éléments ont un contour vert pour les distinguer de ceux qui
appartiennent à la page. Décoche la case pour en refaire un élément local.

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

### Vidéo : fichier local aussi bien que YouTube

Action **Lire une vidéo en grand** → bouton **📁 Choisir un fichier vidéo
local**. La vidéo est embarquée dans le HTML et se lit **hors ligne**, sans
rien demander à YouTube. Le lien YouTube reste disponible pour ce qui est déjà
en ligne.

### Donner vie à la page

Ces réglages transforment un enchaînement de pages en une vraie expérience.

| Où | Réglage | Effet |
|---|---|---|
| Panneau de droite, rien de sélectionné | **Transition entre les pages** | Fondu, glissement, zoom ou vers le haut, au lieu de la coupe franche. Le glissement suit le sens de lecture. |
| Sur un élément, section **Mouvement** | **Apparition** | L'élément entre en scène : fondu, monte, descend, vient de la gauche/droite, zoom. |
| idem | **Retard** | De 0 à 1,5 s. En échelonnant les retards, tes boutons arrivent l'un après l'autre. |
| idem | **Au survol** | *Éclaircit* / *Assombrit* agissent sur ce qu'il y a **dessous** — c'est le bouton que tu as dessiné dans Slides qui réagit, rien n'est peint par-dessus. *Se soulève*, *grossit*, *s'illumine* conviennent aux éléments qui ont un visuel propre (image, texte, bouton plein). |

Pour une zone **invisible**, règle l'**arrondi des coins** afin d'épouser la
forme du bouton dessiné en dessous : sinon les angles de la zone réagissent en
dehors de lui.

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

### Mode immersif (expérience de lecture)

Par défaut la page se lit comme un diaporama : flèches, compteur, barre de
progression, vignettes. Pour un vrai petit site où **on ne navigue qu'avec tes
boutons**, décoche ce que tu veux dans le panneau de droite, section
**« Ce que voit le lecteur »** (clique dans le vide pour ne rien avoir de
sélectionné) — ou clique **🎬 Mode immersif** pour tout masquer d'un coup :

| Réglage | Ce qu'il enlève |
|---|---|
| Navigation libre | les flèches latérales, les flèches du clavier et le swipe |
| Compteur de diapos | le « 3 / 12 » en haut |
| Barre de progression | le trait bleu en bas |
| Bandeau de vignettes | la colonne de miniatures |
| Barre du haut | toute l'entête (un bouton plein écran discret reste en haut à droite) |

⚠️ Sans navigation libre, le lecteur ne peut avancer **que** par les boutons
que tu poses : vérifie que chaque page en a au moins un. La touche `E` reste
ton accès à l'édition, même quand tout est masqué.

### Transformer les objets de ton .pptx en boutons

Si tu déposes le `.pptx` en même temps que le PDF, l'outil relève la position
de **chaque forme, texte et image** de tes diapos. Dans l'éditeur, le bouton
**⌖ Objets** les fait apparaître en vert : **un clic sur l'un d'eux crée une
zone cliquable exactement à sa place**, tu n'as plus qu'à choisir sa
destination.

C'est la façon la plus rapide de travailler : tu dessines tes boutons dans
Google Slides, avec ta charte et tes polices, et tu les rends cliquables ici
sans rien redessiner ni aligner.

Deux limites : une forme dont la position vient du **modèle de diapo** (un
placeholder de titre non déplacé) n'est pas détectée, et un **groupe** est
proposé d'un bloc, pas élément par élément.

### Manipulations

| | |
|---|---|
| Déplacer | glisser — ça s'aimante aux bords et au centre (`Alt` pour l'ignorer) |
| Redimensionner | poignées orange (coin haut-gauche et bas-droit) |
| Ajuster finement | flèches du clavier (`Maj` = pas plus grand) |
| Annuler / rétablir | `Ctrl+Z` / `Ctrl+Y` |
| Dupliquer, copier, coller | `Ctrl+D`, `Ctrl+C`, `Ctrl+V` |
| Empiler | boutons *Devant* / *Derrière* |
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
