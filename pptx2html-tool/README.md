# PPTX → HTML interactif

Convertit une présentation PowerPoint (ou un export Google Slides) en
**visionneuse HTML autonome** : navigation clavier/clic/swipe, vignettes,
plein écran, notes du présentateur, et **liens interactifs** (les liens posés
dans Slides vers d'autres diapos ou des URLs deviennent des zones cliquables).

Fonctionne **100 % hors ligne** — aucun contenu ne quitte la machine.

## Windows : prêt à l'emploi (recommandé)

**[Page de téléchargement](https://github.com/monsieursoleil74/Starter-Pack/releases/tag/exe-latest)** — deux zips au choix :

- **`PPTX2HTML-Windows.zip`** : ouvrir `PPTX2HTML.exe`, **déposer le `.pptx`**
  dans la fenêtre (ou sur l'icône de l'exe) : la conversion démarre toute
  seule. SmartScreen au premier lancement : *Informations complémentaires →
  Exécuter quand même*.
- **`PPTX2HTML-Windows-SansExe.zip`** : pour les PC où **Smart App Control**
  bloque les exe et les `.bat` non signés (aucune exception possible).
  Aucun des deux dedans : installer Python (Microsoft Store, signé) +
  LibreOffice, puis double-clic sur `PPTX2HTML.pyw` — il installe ses
  composants tout seul au premier lancement. Même glisser-déposer.

Seul prérequis dans les deux cas : [LibreOffice](https://fr.libreoffice.org)
(installation unique — un bouton dans l'app t'y amène s'il manque).

Les zips sont reconstruits automatiquement par GitHub Actions
(`.github/workflows/build-windows.yml`) à chaque mise à jour de l'outil.

## Installation depuis les sources (Windows)

1. [Python 3](https://python.org) (ou Microsoft Store) — cocher *Add Python to PATH*
2. [LibreOffice](https://libreoffice.org)
3. Double-clic sur `1_INSTALLER.bat` (installe python-pptx, tkinterdnd2, pymupdf)

Mac/Linux : `brew install libreoffice` puis `pip install python-pptx tkinterdnd2 pymupdf`.

## Utilisation

Double-clic sur `2_LANCER_TOOL.bat` (ou `python PPTX2HTML_Tool.py`) :
déposer le `.pptx` dans la fenêtre (plusieurs fichiers acceptés, conversion
automatique) ou cliquer pour parcourir. Le dossier de sortie s'ouvre seul.

En ligne de commande : `python PPTX2HTML_Tool.py deck.pptx [--assets] [--dpi 150]`

L'option **assets séparés** écrit les images dans un dossier à côté du HTML :
le fichier ne fonctionne plus s'il est copié seul (usage interne serveur).

## Pipeline

pptx → PDF (LibreOffice) → images JPEG (PyMuPDF, ou Poppler en repli) →
HTML unique (python-pptx extrait notes + zones cliquables avec leurs
positions).
