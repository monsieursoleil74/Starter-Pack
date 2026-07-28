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
  `#wrap`, avec `.back` selon le sens. **Défaut : `none`** (net, comme un
  site) — le repli dans `go()` ET l'option sélectionnée du panneau doivent
  rester d'accord, sinon l'interface ment. Par élément : `anim` (+ `delay`)
  joue une apparition en lecture (et en aperçu via `previewing`, bouton ▶),
  `hover` ajoute un effet de survol. Tout est en CSS, aucune bibliothèque.
- **Format des pages** : le convertisseur mémorise `s.ar` (largeur/hauteur de
  chaque page, 4 décimales) ; `setFrameRatio()` l'applique au cadre AVANT que
  l'image n'arrive — sans quoi la page saute pendant une navigation. Vieux
  packs : `fitFrame()` apprend `ar` de l'image au chargement. `deckRatio()` =
  format majoritaire ; une page d'un autre format (`offFormat`) reçoit dans le
  panneau l'option `s.cover` (« recadrer au format du pack » → cadre au format
  du pack + `object-fit:cover`). Les zones issues des liens PDF d'une page
  recadrée ne sont pas remappées — cas marginal, assumé.
- **Candidats** : `s.objects` mélange les formes du .pptx (vert) et les
  lignes de texte du PDF (`kind:'ligne'`, ambre), reconstruites par
  `pageTexts()` via `getTextContent()` — boîtes au glyphe près, fusion par
  ligne de base, padding 22 %. Un candidat porte `label` (repris dans
  `el.label` à la création) et `ellipse` (prstGeom du pptx). Une zone peut
  être ronde : `el.ellipse` → `border-radius:50%`, le `backdrop-filter` du
  survol épouse le rond.
- **Édition lisible** : les zones `look:'hover'` sont teintées de bleu en
  édition et chaque zone porte une étiquette `.ztag` (`actionLabel()`) qui
  résume son action. Rien de tout ça n'existe en lecture.
- Une zone `look:'hover'` est **vraiment invisible** : pas de bordure ni de
  fond. Le halo bleu d'origine a été retiré — il peignait un rectangle par
  dessus le bouton dessiné dans Slides. Le retour visuel passe par `hover`
  `light`/`dark`, qui agissent sur ce qu'il y a DESSOUS via `backdrop-filter`
  (aucun fantôme, contrairement à un déplacement). `el.radius` sur la zone
  permet d'épouser la forme du bouton sous-jacent, sinon les angles réagissent
  hors de lui.
- **Boutons** : un bouton n'est pas le cadre dessiné, c'est son texte. Le
  libellé part dans un `<span class="btn-in bs-…">` (`makeBtn()`) qui se
  dimensionne sur son contenu ; le cadre ne fait que le placer. Six styles
  (`el.btn` : plain, link, ghost, pill, soft, bloc — repli pill pour une zone,
  plain pour un texte), disponibles sur une zone `look:'button'` comme sur tout
  texte porteur d'une action. Ce qu'il ne faut pas casser :
  - `.hug` met `pointer-events:none` sur le cadre et `auto` sur le span, en
    lecture seulement : le clic ne prend que sur le bouton visible. Le
    gestionnaire de clic reste sur le cadre (l'événement remonte), et l'effet
    `hover` va sur le span (`d.hugNode`) — d'où des sélecteurs `.hv-*` **sans**
    `.el` devant, un span n'en étant pas un.
  - `contrastOn()` choisit le texte (clair/sombre) d'après la luminance du
    fond : un bouton blanc ne doit jamais recevoir du blanc.
  - `scaleText()` calcule la police d'après la hauteur du cadre avec un
    facteur par style (les styles à fond ont leur propre marge intérieure), ou
    d'après `el.size` s'il est réglé.
  - le double-clic pour réécrire un texte est détecté **à la main**
    (`lastTap`) : `pointerdown` fait `preventDefault()` pour le glissement, ce
    qui supprime le `dblclick` du navigateur, et le premier clic redessine de
    toute façon les éléments — l'événement ne porterait plus sur le même nœud.
    `editText()` repose le texte brut le temps de la saisie, puis
    `renderElements()` refait la forme.
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
- `slides[i].name` : nom donné à une page. `slideName(i)` (nom, sinon
  « Diapo N ») et `slideOpt(i)` (+ « (cachée) ») sont les SEULS endroits où se
  fabrique un libellé de page — listes déroulantes, vignettes, sommaire,
  audit. Toute nouvelle liste doit passer par eux, sinon elle réaffiche des
  numéros au milieu des noms. Le champ met à jour le titre du panneau à la
  main : un `renderProps()` par caractère ferait perdre le focus.
- **Gabarit** : `meta.master` = éléments présents sur toutes les pages, rendus
  APRÈS ceux de la page donc au-dessus. `allEls()` = page + master, et c'est
  cet index concaténé qui sert à la sélection et au rendu (`sel`, `drag.i`,
  `nodes()` sont alignés dessus) ; `ownerOf(i)` dit dans quelle liste écrire.
  Toute opération de mutation (supprimer, dupliquer, ordre) doit passer par
  `ownerOf`, jamais par `els()` directement.
  `el.pages` (liste d'index) restreint un élément commun à certaines pages ;
  absent = partout, ce qui garde les packs déjà faits inchangés. **Il n'est
  jamais retiré de `allEls()`** — cela décalerait toute l'indexation ci-dessus.
  `renderElements()` lui pose la classe `.offpage` : `visibility:hidden` en
  lecture (donc ni vu, ni cliquable, mais la mise en page reste mesurable par
  `scaleText`), fantôme grisé en édition pour qu'il reste sélectionnable — sans
  quoi un élément décoché partout deviendrait inatteignable. L'audit compte les
  sorties d'un élément commun page par page (`masterExit`), et `mergeDeck()`
  filtre les index devenus hors bornes (liste vide → `pages` supprimé).
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
- Action `overlay` : `openSlideOverlay(seq, pos)` réutilise `#lightbox` avec la
  classe `slideov`, l'`aspect-ratio` recalculé sur l'image, et les éléments de
  la diapo rendus à `depth 1` (donc cliquables). La séquence vient de
  `overlaySeq()` = `el.slide` puis `el.list` — même champ `list` que la galerie
  des panneaux, donc le nettoyage de `mergeDeck` et l'audit la couvrent déjà.
  `slide === -2` = l'image de l'élément lui-même. Quand la fenêtre est ouverte,
  le gestionnaire clavier lui donne la priorité : les flèches feuillettent et
  la page dessous ne bouge pas. `closeLightbox()` remet `ovState` à null et
  rappelle `renderElements()` pour que les nœuds sortent de `scalables`.
- Action `copy` : `copyText()` avec repli `execCommand` (l'API presse-papiers
  n'est pas garantie en `file://`).
- **Trois modes.** `readerLock()` = `meta.locked || testMode` commande TOUT le
  comportement « version animateur » : ni vignettes ni notes (et `T`/`N`
  inertes), ni zones de clic sur les bords, ni clavier, ni swipe — `freeNav()`
  et `applyViewChrome()` en dépendent. `meta.locked` ne fait donc plus
  seulement disparaître le crayon : il retire le diaporama. `testMode` simule
  la même chose depuis l'éditeur sans produire de fichier (bouton `#tTest`,
  `Échap` pour sortir).
- **Ne jamais appeler `confirm()` avant un téléchargement** : la boîte de
  dialogue fait perdre l'activation utilisateur et Chrome ignore alors
  l'attribut `download` — le fichier arrivait nommé « download ». L'export
  animateur passe par la vérification (`auditMode === 'export'`), qui sert
  d'avertissement et porte le bouton « exporter quand même ».
- `auditDeck(forExport)` : à l'export, la règle « aucune sortie sur cette
  page » s'applique toujours, puisque la version animateur n'a jamais de
  navigation libre.

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
   changer de page, remise à zéro à l'aller-retour, fil de lecture intact ;
7. boutons : la forme reste plus étroite que le cadre, chaque style rend ce
   qu'il annonce, texte sombre sur pastille claire, le cadre laisse passer la
   souris à côté du bouton, un texte à qui on donne une action devient un
   bouton typographique, et le double-clic le réécrit toujours ;
8. élément commun : toutes les pages par défaut, liste de cases quand on
   choisit, page décochée = fantôme en édition et rien du tout en lecture
   (pas même un clic), choix conservé à l'enregistrement et à la relecture ;
9. PDF aux formats mélangés : `ar` mémorisé par page, cadre appliqué avant
   l'image, alerte à la conversion, option « recadrer au format du pack » sur
   les seules pages hors format ; transition « aucune » par défaut ; lignes de
   texte du PDF en candidats ambre à la boîte exacte (libellé repris) ; zone
   ronde depuis une ellipse du pptx comme à la main ; zones teintées +
   étiquettes d'action en édition, invisibles en lecture.
Dans les deux cas : zéro erreur JS. Attention en écrivant des tests : la
balise `#cfg` du document garde la config d'ORIGINE, l'état vivant est dans
la fermeture JS — vérifier via le DOM, ou après un enregistrement.

## Pistes suivantes
- Reporter les réglages d'un HTML édité sur une reconversion du même deck
  (aujourd'hui la reconversion repart d'une page vierge)
- Sommaire auto généré à partir des titres de diapos
- Sélection multiple et alignement de plusieurs éléments d'un coup
