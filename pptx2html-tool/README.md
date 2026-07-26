# PPTX → HTML interactif

Convertit une présentation PowerPoint (ou un export Google Slides) en **page
HTML unique qui se comporte comme un mini-site** — et qui embarque son propre
**éditeur interactif** : plus besoin de repasser par Slides pour poser un
bouton, cacher une diapo ou incruster une vidéo.

Fonctionne **100 % hors ligne** — aucun contenu ne quitte la machine.

## Le principe

1. Tu crées ton contenu dans Google Slides comme d'habitude.
2. `Fichier → Télécharger → Microsoft PowerPoint (.pptx)`.
3. Tu déposes le `.pptx` dans l'outil → un `.html` apparaît à côté.
4. Tu ouvres ce `.html` dans ton navigateur, tu cliques **✏️** : tu dessines
   des boutons, tu caches des diapos, tu poses des vidéos — directement sur
   les diapos, à la souris.
5. **💾 Enregistrer** re-télécharge le fichier HTML à jour. Tu remplaces
   l'ancien par celui-ci : tes réglages sont dedans, il n'y a pas de projet
   séparé à gérer.
6. **🔒 Export final** produit une copie verrouillée (sans mode édition) à
   diffuser sur le serveur.

Aucun serveur, aucun compte, aucune connexion : l'éditeur tourne dans le
fichier HTML lui-même.

## Ce qu'on peut faire en mode édition

| Outil | Effet |
|---|---|
| **➕ Zone** | Dessine une zone cliquable sur la diapo. Action au choix : aller à une diapo précise, suivante / précédente, **retour** (revient d'où on venait), ouvrir un lien, ou lire une vidéo en plein écran. |
| **Apparence d'une zone** | *Invisible* (halo au survol — pour rendre cliquable un bouton déjà dessiné dans Slides), *Contour visible*, ou *Bouton* (pastille colorée avec texte, couleur libre). |
| **👁 sur une vignette** | Cache la diapo : elle sort du fil de lecture (flèches, swipe, compteur) et n'est plus accessible **que** via un bouton qui pointe dessus. C'est ce qui casse le côté linéaire du diaporama. |
| **🎬 Vidéo** | Incruste un fichier vidéo local (embarqué dans le HTML, lecture hors ligne) ou un lien YouTube, positionné et redimensionné à la souris. |
| **Déplacer / redimensionner** | Glisse une zone ou une vidéo, poignée orange en bas à droite pour la taille, **Suppr** pour l'effacer. |

Sur la diapo cachée, un bouton **↩ Retour** apparaît automatiquement : le
visiteur revient à la diapo d'où il est parti (comme un bouton « retour » de
navigateur).

## Ce qui est repris automatiquement du .pptx

- Les **liens vers d'autres diapos** posés dans Slides / PowerPoint → zones
  cliquables déjà positionnées.
- Les **liens URL** (sur une forme ou sur du texte) → zones « ouvrir un lien ».
- Les **liens YouTube** (c'est sous cette forme que Slides exporte une vidéo
  insérée) → zones « lire la vidéo » en plein écran.
- Les **vidéos mp4/webm embarquées** dans le pptx → extraites et posées sur
  la diapo, à leur position d'origine.
- Les **notes du présentateur** (touche `N`).

## Raccourcis de la visionneuse

`← →` naviguer · `F` plein écran · `N` notes · `T` vignettes · `E` mode
édition · `Suppr` supprimer l'élément sélectionné · `Échap` annuler /
fermer. Clic sur les bords, swipe tactile, et `#3` dans l'URL pour ouvrir
directement une diapo.

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

L'option **assets séparés** écrit les images (et les vidéos) dans un dossier à
côté du HTML : le fichier ne fonctionne plus s'il est copié seul (usage interne
serveur).

## Pipeline

pptx → PDF (LibreOffice) → images JPEG (PyMuPDF, ou Poppler en repli) →
HTML unique. python-pptx en extrait les notes, les liens (convertis en zones
interactives) et les vidéos embarquées. Le HTML contient trois blocs : la
configuration (JSON), les images/vidéos (JSON), l'application (JS) — c'est en
réécrivant ces trois blocs que le bouton 💾 régénère le fichier lui-même.

## Refaire une conversion après avoir modifié les diapos

Repasser le `.pptx` dans l'outil **écrase** le HTML et donc les réglages
d'interactivité. Renomme ton HTML édité (ou convertis vers un autre nom) si tu
veux garder les deux.
