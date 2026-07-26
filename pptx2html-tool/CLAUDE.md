# Contexte projet — pptx2html-tool

## Quoi
Outil local (Python, un seul fichier `PPTX2HTML_Tool.py`) qui convertit un
.pptx en page HTML autonome : visionneuse **+ éditeur interactif embarqué**
dans le HTML lui-même. GUI tkinter + mode CLI.

## Pourquoi
Jérémy (superviseur dans un studio d'animation) construit des packs internes
(onboarding animateurs) dans Google Slides — outil validé côté sécurité du
studio — puis les compile en HTML local pour diffusion sur le serveur pipe.
Il veut casser le côté linéaire du diaporama : boutons vers des diapos
précises, diapos accessibles seulement par bouton, vidéos. D'où l'éditeur
dans le HTML : on n'édite pas le pptx, on enrichit le HTML après coup.
Contrainte clé : **aucun contenu confidentiel ne doit transiter par un
service tiers**. D'où : conversion 100 % locale, éditeur sans serveur, et
mode `--assets` (images dans un dossier séparé → le HTML copié seul ne
fonctionne pas).

## Architecture Python
- `convert()` : pptx → PDF (LibreOffice headless) → JPEG (PyMuPDF via
  `get_pymupdf()`, repli pdftoppm) → HTML
- `extract_deck()` : une seule passe python-pptx → notes, zones (les
  hyperliens deviennent des actions `goto`/`next`/`prev`/`url`/`video`,
  positionnées en % de la slide), vidéos embarquées (mp4/webm extraites en
  base64 ; un lien YouTube — la forme sous laquelle Slides exporte une
  vidéo — devient une zone `video`)
- `write_html()` : écrit **3 balises** — `<script id="cfg">` (JSON de config),
  `<script id="assets">` (images + médias), `<script id="app-src">` (l'appli,
  constante `APP_JS`). Rien d'autre dans le `<body>`.
- `launch_gui()` : tkinter + tkinterdnd2 (glisser-déposer, optionnel avec
  repli sans DnD), conversion dans un thread, log en direct, file de
  fichiers (batch), conversion auto au drop, check dépendances au démarrage
- Détection OS de soffice/pdftoppm (`find_soffice`, `find_pdftoppm`) ;
  Poppler embarqué cherché d'abord dans `<dossier exe>/poppler/`
- Fichier .pptx passé seul en argv (drop sur l'icône exe/.pyw) → GUI
  préchargée ; `ensure_deps_gui()` auto-installe python-pptx/pymupdf/
  tkinterdnd2 via pip au 1er lancement en mode script (zip SansExe :
  un .pyw à double-cliquer, ni exe ni .bat — Smart App Control bloque
  les deux)

## Architecture du HTML généré (`APP_JS`)
- Au chargement, le JS lit `#cfg` + `#assets` et **construit tout le DOM**
  (styles + squelette) en `insertAdjacentHTML('beforeend')` — jamais en
  écrasant le body : les 3 balises script doivent survivre, c'est d'elles
  que `serialize()` régénère le fichier au clic sur 💾 (Blob + `<a download>`).
- Modèle : `SLIDES[i] = {img, notes, hidden, zones[], videos[]}`.
  Zone = `{x,y,w,h, action, look, label?, color?, slide?|url?|video?}`.
  `look` ∈ hover (invisible) / outline / button.
- Navigation : `hidden` retire la diapo du fil (`linNext`/`linPrev`,
  compteur `visPos`/`visCount`) ; pile `hist` → action `back` et bouton
  ↩ Retour automatique sur les diapos cachées.
- Édition (touche E) : dessin à la souris via pointer events sur `#wrap`,
  déplacement/redimensionnement (poignée `.hdl`), panneau `#props`
  contextuel, œil sur les vignettes pour cacher, `gcMedia()` purge les
  médias orphelins.
- `meta.locked` : export « final » où le bouton ✏️ n'est pas rendu et
  `setEdit()` sort immédiatement.
- Pas de dépendance externe, pas de fetch, tout inline : le HTML marche en
  `file://`.

## Packaging Windows
- `.github/workflows/build-windows.yml` : PyInstaller (--onefile --windowed,
  --collect-all tkinterdnd2/pymupdf) sur windows-latest. Deux zips publiés
  sur la release `exe-latest` : exe tout-en-un, et « SansExe » (script +
  .bat, compatible Smart App Control qui bloque tout exe non signé sans
  exception possible). Déclenché à chaque push touchant `pptx2html-tool/`.
- LibreOffice n'est PAS embarqué (trop lourd) : détection + bouton
  « Installer LibreOffice » dans la GUI.

## Conventions
- Un seul fichier Python, dépendances : python-pptx + pymupdf +
  tkinterdnd2 (optionnelles avec replis) + LibreOffice. Interface en français.
- `APP_JS` est une raw-string : pas de f-string, pas d'accolades à doubler ;
  la config passe par les balises JSON, jamais par interpolation Python.
- Ne jamais committer de .pptx ou de HTML générés (voir .gitignore).

## Tests
Pas de suite au repo (dépendances lourdes). Vérifié manuellement avec
Playwright/Chromium sur un deck de test : navigation, import des liens
pptx, dessin de zone, diapo cachée, save → rechargement de la copie,
export verrouillé, zéro erreur JS.

## Pistes suivantes
- Réappliquer les réglages d'un HTML édité sur une nouvelle conversion du
  même pptx (aujourd'hui la reconversion écrase tout)
- Zones de texte / images ajoutées par-dessus une diapo
- Sommaire auto généré depuis les titres de diapos
