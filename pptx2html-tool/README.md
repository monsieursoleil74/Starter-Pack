# PPTX → HTML interactif

Convertit une présentation PowerPoint (ou un export Google Slides) en
**visionneuse HTML autonome** : navigation clavier/clic/swipe, vignettes,
plein écran, notes du présentateur, et **liens interactifs** (les liens posés
dans Slides vers d'autres diapos ou des URLs deviennent des zones cliquables).

Fonctionne **100 % hors ligne** — aucun contenu ne quitte la machine.

## Installation (Windows)

1. [Python 3](https://python.org) — cocher *Add Python to PATH*
2. [LibreOffice](https://libreoffice.org)
3. [Poppler](https://github.com/oschwartz10612/poppler-windows/releases) — dézipper dans `C:\poppler`
4. Double-clic sur `1_INSTALLER.bat`

Mac/Linux : `brew install libreoffice poppler` puis `pip install python-pptx`.

## Utilisation

Double-clic sur `2_LANCER_TOOL.bat` (ou `python PPTX2HTML_Tool.py`) :
choisir le `.pptx`, options, Convertir. Le dossier de sortie s'ouvre seul.

En ligne de commande : `python PPTX2HTML_Tool.py deck.pptx [--assets] [--dpi 150]`

L'option **assets séparés** écrit les images dans un dossier à côté du HTML :
le fichier ne fonctionne plus s'il est copié seul (usage interne serveur).

## Pipeline

pptx → PDF (LibreOffice) → images JPEG (Poppler) → HTML unique
(python-pptx extrait notes + zones cliquables avec leurs positions).
