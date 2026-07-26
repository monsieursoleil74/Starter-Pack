# Contexte projet — pptx2html-tool

## Quoi
Outil local (Python, un seul fichier `PPTX2HTML_Tool.py`) qui convertit un
.pptx en visionneuse HTML interactive autonome. GUI tkinter + mode CLI.

## Pourquoi
Jérémy (superviseur dans un studio d'animation) construit des packs internes
(onboarding animateurs) dans Google Slides — outil validé côté sécurité du
studio — puis les compile en HTML local pour diffusion sur le serveur pipe.
Contrainte clé : **aucun contenu confidentiel ne doit transiter par un
service tiers**. D'où : conversion 100 % locale, et mode `--assets`
(images dans un dossier séparé → le HTML copié seul ne fonctionne pas).

## Architecture
- `convert()` : pptx → PDF (LibreOffice headless) → JPEG (PyMuPDF via
  `get_pymupdf()`, repli pdftoppm) → HTML
- `extract_notes()` / `extract_links()` : python-pptx ; les hyperliens
  (sauts de slide, URLs, actions next/prev/first/last) deviennent des
  hotspots positionnés en % sur la slide
- `write_html()` : visionneuse (thème sombre, clavier/swipe, vignettes,
  plein écran F, notes N, barre de progression, hash #N dans l'URL)
- `launch_gui()` : tkinter + tkinterdnd2 (glisser-déposer, optionnel avec
  repli sans DnD), conversion dans un thread, log en direct, file de
  fichiers (batch), conversion auto au drop, check dépendances au démarrage
- Détection OS de soffice/pdftoppm (`find_soffice`, `find_pdftoppm`) ;
  Poppler embarqué cherché d'abord dans `<dossier exe>/poppler/`
- Fichier passé en argv à l'exe gelé (drop sur l'icône) → GUI préchargée

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
- Ne jamais committer de .pptx ou de HTML générés (voir .gitignore).

## Pistes suivantes (déjà discutées)
- Support vidéo : YouTube/Drive dans les exports Google Slides = image +
  lien → incruster un iframe ; mp4 embarqué dans le pptx → extraire et
  poser un <video> positionné
