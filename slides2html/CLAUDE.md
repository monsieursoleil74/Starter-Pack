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
- Modèle de données : `SLIDES[i] = {img, notes, hidden, zones[], videos[]}` ;
  `img` est un **index** dans `ASSETS.images`. Zone =
  `{x,y,w,h, action, look, label?, color?, slide?|url?|video?}`, coordonnées
  en % de la diapo. `look` ∈ hover | outline | button.
- `hidden` retire la diapo du fil (`linNext`/`linPrev`, compteur
  `visPos`/`visCount`) ; la pile `hist` alimente l'action `back` et le bouton
  ↩ Retour automatique.
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
vérifié manuellement à chaque changement, sur Chromium en `file://` :
convertisseur ouvert sans serveur → dépôt PDF + pptx → liens internes et
YouTube convertis → notes récupérées → HTML téléchargé → diapo cachée +
bouton dessiné → 💾 → relecture de la copie (diapo hors du fil, bouton qui y
mène, retour qui ramène) → export verrouillé → zéro erreur JS.

## Pistes suivantes
- Reporter les réglages d'un HTML édité sur une reconversion du même deck
  (aujourd'hui la reconversion repart d'une page vierge)
- Zones de texte / images ajoutées par-dessus une diapo
- Sommaire auto généré à partir des titres
