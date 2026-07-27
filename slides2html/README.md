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
| **➕ Zone** | Zone cliquable dessinée à la souris. *Invisible* (halo au survol — pour rendre cliquable un bouton que tu as déjà dessiné dans Slides), *Contour visible*, ou *Bouton plein* (pastille colorée, texte + icône). |
| **🖼 Image** | Ajoute une image par-dessus la diapo : logo, capture, photo. Cadrage, coins arrondis, ombre, opacité. Tu peux aussi la **déposer directement sur la diapo** ou la **coller** (`Ctrl+V`). |
| **T Texte** | Bloc de texte : couleur, taille, graisse, alignement, ombre, fond coloré. Le cadre suit le texte automatiquement ; **double-clic** pour le réécrire sur la diapo. |
| **▭ Forme** | Rectangle ou ellipse, couleur et opacité réglables : masquer une zone, surligner, poser un fond derrière du texte. |
| **🎬 Vidéo** | Fichier local (embarqué, lecture hors ligne) ou lien YouTube. |
| **👁 sur une vignette** | Cache la diapo : elle sort du fil de lecture (flèches, swipe, compteur) et n'est plus accessible **que** par un bouton qui pointe dessus. C'est ce qui casse le côté linéaire. |

**N'importe quel élément peut devenir cliquable** — pas seulement les zones.
Le menu *Au clic* est disponible sur une image, un texte ou une forme : aller à
une diapo précise, suivante / précédente, **retour** (revient d'où venait le
visiteur), ouvrir un lien, ou lire une vidéo en plein écran. Une image fait
souvent un meilleur bouton qu'une pastille.

Sur une diapo cachée, un bouton **↩ Retour** apparaît tout seul.

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

## Refaire une conversion après avoir modifié les diapos

Reconvertir repart d'une page vierge : les boutons et diapos cachées de la
version précédente ne sont pas repris. Garde ton HTML édité de côté (ou
renomme-le) avant de reconvertir.

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
