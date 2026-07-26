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
- `convert()` : pptx → PDF (LibreOffice headless) → JPEG (pdftoppm) → HTML
- `extract_notes()` / `extract_links()` : python-pptx ; les hyperliens
  (sauts de slide, URLs, actions next/prev/first/last) deviennent des
  hotspots positionnés en % sur la slide
- `write_html()` : visionneuse (thème sombre, clavier/swipe, vignettes,
  plein écran F, notes N, barre de progression, hash #N dans l'URL)
- `launch_gui()` : tkinter, conversion dans un thread, log en direct
- Détection OS de soffice/pdftoppm (`find_soffice`, `find_pdftoppm`)

## Conventions
- Un seul fichier Python, zéro dépendance hors python-pptx + binaires
  LibreOffice/Poppler. Interface et messages en français.
- Ne jamais committer de .pptx ou de HTML générés (voir .gitignore).

## Pistes suivantes (déjà discutées)
- Support vidéo : YouTube/Drive dans les exports Google Slides = image +
  lien → incruster un iframe ; mp4 embarqué dans le pptx → extraire et
  poser un <video> positionné
- Éventuel packaging .exe (PyInstaller) pour éviter l'installation Python
