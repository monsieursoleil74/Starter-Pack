# Contexte projet — slides2html

## Quoi
`Convertisseur.html` : un seul fichier HTML autonome qui transforme un export
PDF de Google Slides en page web interactive. La page produite embarque son
propre éditeur (boutons, diapos cachées, vidéos) et sait se réenregistrer.

## Pourquoi cette forme (contrainte n°1)
Jérémy (superviseur dans un studio d'animation) monte des packs d'onboarding
dans Google Slides — seul outil validé côté sécurité du studio — et les
diffuse en HTML local sur le serveur pipe. Son poste Windows est verrouillé :
**Smart App Control bloque tout exe et tout .bat non signés, sans exception
possible**, et rien ne s'installe. Une version précédente (Python + tkinter +
LibreOffice + exe PyInstaller) était donc inutilisable pour lui ; elle a été
supprimée (voir l'historique git, dossier `pptx2html-tool/`).

D'où la règle absolue ici : **aucun binaire, aucune installation, aucun
serveur**. L'outil est une page web qu'on ouvre en double-cliquant
(protocole `file://`), et tout le travail se fait dans le navigateur — ce qui
satisfait aussi la contrainte de confidentialité : aucun contenu ne sort de
la machine.

## Pourquoi le PDF et pas le .pptx
Rendre fidèlement un .pptx en JavaScript est hors de portée ; le PDF est rendu
par pdf.js et, en prime, c'est **Google** qui l'a produit — le rendu est plus
fidèle que ce que faisait LibreOffice. Les hyperliens survivent dans le PDF
sous forme d'annotations `Link` (destination interne = saut de diapo, URI =
lien ou YouTube). Seules les **notes du présentateur** manquent au PDF : d'où
le dépôt facultatif du .pptx, lu avec fflate uniquement pour les notes.

## Structure
```
Convertisseur.html   artefact assemblé et versionné (~1,6 Mo) — c'est CE fichier
                     que l'utilisateur télécharge ; ne jamais l'éditer à la main
build.py             remplace les marqueurs /*@@NOM@@*/ de src/converter.html
                     par le contenu des sources ; --check pour la CI
src/converter.html   interface du convertisseur (dépôt, options, journal)
src/converter.js     pdf.js → JPEG base64 + annotations → zones ; notes .pptx ;
                     fabrication du HTML de sortie
src/viewer.js        l'application du HTML produit : visionneuse + éditeur
vendor/              pdf.min.js + pdf.worker.min.js (pdf.js 3.11, Apache-2.0),
                     fflate (MIT) et leurs licences
```

## Points techniques à ne pas casser
- **Worker pdf.js** : servi depuis un `Blob` construit à partir du
  `<script id="pdf-worker" type="text/plain">`. En `file://`, charger un
  fichier worker externe est impossible et `fetch` est bloqué par CORS — c'est
  pour ça que tout est inline et que le PDF arrive par un objet `File`.
- **pdf.js 3.x (legacy UMD)** volontairement, pas la 4.x qui est ESM-only :
  un `<script>` classique inline est plus sûr en `file://`.
- Aucun fichier embarqué ne doit contenir la séquence `</script` ;
  `build.py` échoue si c'est le cas.
- **Le HTML produit ne contient que 3 balises** : `<script id="cfg">` (JSON),
  `<script id="assets">` (images base64 + médias), `<script id="app-src">`
  (viewer.js). `serialize()` dans viewer.js régénère le fichier à partir de
  ces trois-là : viewer.js construit donc tout son DOM par
  `insertAdjacentHTML('beforeend')` et **ne doit jamais écraser le body**.
- Modèle de données : `SLIDES[i] = {img, notes, hidden, elements[]}` ; `img`
  est un **index** dans `ASSETS.images`. Un élément =
  `{type, x, y, w, h, opacity?, action?, …}`, coordonnées en % de la diapo,
  `type` ∈ zone | image | text | shape | video | panel. L'ordre du tableau EST l'ordre
  d'empilement. `action` est optionnel sur **tous** les types (pas seulement
  `zone`) : c'est ce qui permet de rendre une image ou un texte cliquable.
  Les fichiers produits avant la v4 (`zones[]` + `videos[]`) sont convertis au
  chargement par la migration en tête de viewer.js — ne pas la retirer.
- **Panneaux** (`type:'panel'`) : affichent une AUTRE diapo dans un cadre de
  la diapo courante — image + éléments de la diapo cible, **une seule
  imbrication** (un panneau dans un panneau n'est pas redessiné). Ciblés par
  leur `name` ; l'action `{action:'panel', panelName, slide}` écrit dans
  `panelState`, un état de visite remis à zéro à chaque changement de diapo et
  jamais enregistré (`el.slide` du panneau = contenu de départ). Sans
  `panelName`, l'action vise le premier panneau de la diapo.
- `nodes()` ne renvoie que les éléments de **premier niveau**
  (`:scope > .el`) : ceux imbriqués dans un panneau portent la même classe et
  décaleraient l'indexation pendant un déplacement.
- `scalables` est reconstruit à chaque rendu : il porte, pour chaque texte ou
  bouton, son conteneur (la diapo ou le panneau). C'est ce qui permet à un
  texte de se réduire dans un panneau. La hauteur automatique n'est réécrite
  dans le modèle que pour les éléments de premier niveau (`top`).
- Les textes ont une **hauteur automatique** : `scaleText()` mesure le contenu
  et réécrit `el.h`. Le redimensionnement d'un texte ne touche donc que sa
  largeur. Taille de police et boutons sont exprimés en % de la hauteur de la
  diapo, pour être indépendants de la taille de la fenêtre.
- L'historique (`undoStack`) stocke des instantanés JSON de `SLIDES`. Les
  médias ajoutés ne sont pas annulés : `gcMedia()` purge les orphelins à
  l'enregistrement.
- `hidden` retire la diapo du fil (`linNext`/`linPrev`, compteur
  `visPos`/`visCount`) ; la pile `hist` alimente l'action `back` et le bouton
  ↩ Retour automatique.
- **Format des pages** : `#wrap` porte un `aspect-ratio` posé en JS depuis
  `naturalWidth/naturalHeight` de l'image (`fitFrame` sur l'événement `load`),
  et `#slide` fait 100 % × 100 %. Ne JAMAIS repasser `#wrap` en `display:flex`
  avec une image en `max-width/max-height` : c'est ce qui étirait les PDF non
  16/9 (une page A4 s'affichait en 1.688 au lieu de 0.707).
- `meta.view` = `{arrows, counter, progress, thumbs, header, full}`. **Une
  conversion neuve écrit le profil « site »** : tout à false SAUF `arrows` et
  `full`. C'est délibéré — la lecture par défaut ne doit pas ressembler à un
  visionneur PDF, mais le clavier reste actif pour ne bloquer personne tant
  qu'aucun bouton n'a été posé. Les clés absentes valent `true` (`full` vaut
  `false`) : les packs montés avant ce choix gardent leur allure.
  `applyViewChrome()` n'agit qu'en lecture ; `freeNav()` garde clavier et
  swipe. Trois profils dans l'éditeur : `#vSite`, `#vSlideshow`, `#vImmersive`
  (kiosque, seul à couper `arrows`).
- Pas d'infobulle `title` sur les éléments cliquables en lecture : le lecteur
  n'a pas à voir « Aller à la diapo 6 ».
- `slides[i].objects` : formes relevées dans le .pptx (position seule), TOUJOURS
  des candidats — jamais rendues au lecteur. Le bouton `⌖ Objets` les affiche
  en édition et un clic crée une zone à leur place. Extraction dans
  `slideObjects()` : formes de premier niveau ayant leur propre `a:xfrm`
  (placeholders hérités ignorés, groupe = un seul objet).
- **Mouvement** : `meta.transition` (none|fade|slide|zoom|up) pilote la
  transition entre pages — `go()` pose `data-tr` + `.tr-out`/`.tr-in` sur
  `#wrap`, avec `.back` selon le sens. Par élément : `anim` (+ `delay`) joue
  une apparition en lecture (et en aperçu via `previewing`, bouton ▶), `hover`
  ajoute un effet de survol. Tout est en CSS, aucune bibliothèque.
- Une zone `look:'hover'` est **vraiment invisible** : pas de bordure ni de
  fond. Le halo bleu d'origine a été retiré — il peignait un rectangle par
  dessus le bouton dessiné dans Slides. Le retour visuel passe par `hover`
  `light`/`dark`, qui agissent sur ce qu'il y a DESSOUS via `backdrop-filter`
  (aucun fantôme, contrairement à un déplacement). `el.radius` sur la zone
  permet d'épouser la forme du bouton sous-jacent, sinon les angles réagissent
  hors de lui.
- **Audit** (`auditDeck()`) : ne signale que ce qui piège le lecteur — page
  sans issue en mode immersif, renvoi hors bornes, page cachée non atteinte,
  bouton sans destination, panneau jamais alimenté, média perdu, élément hors
  cadre. Un élément commun qui navigue, ou un sommaire, valent issue pour
  toutes les pages : ne pas signaler dans ce cas, sinon l'alerte devient du
  bruit et on cesse de la lire.
- **Interface** : barre du haut en icônes seules (classe `.tool`), gestes
  fréquents (dupliquer / empiler / supprimer) dans `#floatbar`, une barre
  flottante posée au-dessus de la sélection et masquée pendant un glissement.
  La section « Mouvement » du panneau est repliée par défaut (`advOpen`).
  Le panneau ne doit pas redevenir un mur de champs : tout nouveau réglage
  peu fréquent va dans le repli.
- **Gabarit** : `meta.master` = éléments présents sur toutes les pages, rendus
  APRÈS ceux de la page donc au-dessus. `allEls()` = page + master, et c'est
  cet index concaténé qui sert à la sélection et au rendu (`sel`, `drag.i`,
  `nodes()` sont alignés dessus) ; `ownerOf(i)` dit dans quelle liste écrire.
  Toute opération de mutation (supprimer, dupliquer, ordre) doit passer par
  `ownerOf`, jamais par `els()` directement.
- **Reprise d'un pack édité** : le convertisseur accepte un `.html` déjà monté
  en 3ᵉ fichier. `readDeck()` relit ses balises JSON (le `<\/` du JSON est un
  échappement valide, `JSON.parse` le gère), `mergeDeck()` transplante
  `meta` + `elements`/`hidden`/`notes` page par page **par index**, et nettoie
  les renvois hors bornes (`goto`/`panel`/`overlay`, `list` de galerie,
  `meta.nav`) en comptant les corrections. Les liens du nouveau PDF ne sont
  posés que sur les pages où l'ancien n'avait aucun élément.
- `el.on` : un élément dont l'action `panel` pointe sur ce que le panneau
  affiche en ce moment est marqué actif — c'est ce qui donne le comportement
  « onglet sélectionné » d'un vrai site.
- `meta.nav` = `[{label, slide}]` → barre `#nav` rendue en lecture, partie
  courante = la dernière entrée dont `slide <= cur`. Indépendante de
  `meta.view.header` : elle reste visible en mode immersif, c'est la
  navigation.
- **Galerie** : un panneau avec `list` (indices de diapos) affiche flèches +
  compteur ; `galleryStep()` déplace `panelState[nom]` dans la liste.
  `el.auto` (secondes) enclenche un `setInterval` gardé dans `galleryTimers`,
  purgé au début de chaque `renderElements()` — sans quoi les minuteries
  s'empilent à chaque rendu.
- Action `overlay` : `openSlideOverlay()` réutilise `#lightbox` avec la classe
  `slideov`, l'`aspect-ratio` recalculé sur l'image, et les éléments de la
  diapo cible rendus à `depth 1` (donc cliquables). `slide === -2` = l'image de
  l'élément lui-même. `closeLightbox()` rappelle `renderElements()` pour que
  les nœuds de l'overlay sortent de `scalables`.
- Action `copy` : `copyText()` avec repli `execCommand` (l'API presse-papiers
  n'est pas garantie en `file://`).
- `meta.locked` : export « final » — le bouton ✏️ n'est pas rendu et
  `setEdit()` sort immédiatement.

## Conventions
- Interface et messages en français, tutoiement.
- JS sans dépendance ni build (pas de bundler) : `var`, fonctions classiques,
  pas de JSX. `build.py` n'utilise que la bibliothèque standard.
- Toujours relancer `python3 build.py` après avoir touché `src/` ; la CI
  (`.github/workflows/check-build.yml`) refuse un artefact désynchronisé.
- Ne jamais committer de PDF, .pptx ou HTML produit (voir .gitignore).

## Tests
Pas de suite au dépôt (elle demanderait Playwright + Chromium). Scénario
vérifié manuellement à chaque changement, sur Chromium en `file://`, en deux
scénarios :
1. convertisseur ouvert sans serveur → dépôt PDF + pptx → liens internes et
   YouTube convertis → notes récupérées → HTML téléchargé → diapo cachée +
   bouton dessiné → 💾 → relecture de la copie (diapo hors du fil, bouton qui
   y mène, retour qui ramène) → export verrouillé ;
2. éditeur : image importée (centrée, ratio conservé, embarquée en base64),
   texte (rendu + taille), forme (ellipse), duplication, ordre d'empilement,
   Ctrl+Z / Ctrl+Y, flèches, enregistrement puis relecture (éléments
   conservés, image cliquable opérante, élément sans action non cliquable) ;
3. mode immersif + format : page A4 non étirée (avant/après ajout d'un
   bouton), bascule immersive, relecture sans barre / compteur / progression /
   vignettes / flèches, clavier neutralisé, bouton toujours opérant et sans
   infobulle, `E` qui ramène l'édition ; objets du .pptx détectés et
   transformés en zone d'un clic ;
4. galerie dans un panneau (défilement avant/arrière, compteur), ouverture
   d'une diapo en grand (Échap et clic à côté referment, page intacte),
   vidéo locale importée depuis l'action « lire en grand » ;
5. gabarit + mise à jour : élément commun présent une fois par page et
   modifiable depuis n'importe laquelle, puis reconversion avec un nouveau PDF
   qui reprend commun, transition, sommaire, page cachée et boutons de page,
   tout en remplaçant réellement les images ;
6. panneaux : écran de sélection complet — diapos cachées servant de contenu,
   panneau vide au départ, deux boutons qui le remplissent tour à tour sans
   changer de page, remise à zéro à l'aller-retour, fil de lecture intact.
Dans les deux cas : zéro erreur JS. Attention en écrivant des tests : la
balise `#cfg` du document garde la config d'ORIGINE, l'état vivant est dans
la fermeture JS — vérifier via le DOM, ou après un enregistrement.

## Pistes suivantes
- Reporter les réglages d'un HTML édité sur une reconversion du même deck
  (aujourd'hui la reconversion repart d'une page vierge)
- Sommaire auto généré à partir des titres de diapos
- Sélection multiple et alignement de plusieurs éléments d'un coup
