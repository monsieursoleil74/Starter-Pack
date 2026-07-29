# Éditeur HTML local

Tu as une **maquette HTML** qui te plaît (faite à la main, générée, exportée
d'un outil…) et tu veux juste **remplacer ses textes et ses images** sans
toucher au code ? C'est cet outil.

**Rien à installer**, comme le convertisseur : `Editeur-HTML.html` est une page
web que tu ouvres en double-cliquant. Tout se passe dans ton navigateur, aucun
fichier n'est envoyé en ligne.

## Utilisation

1. **Ouvre `Editeur-HTML.html`** (double-clic) et **dépose ta maquette `.html`**
   dedans.
2. **✏️ Textes** : clique n'importe quel texte de la page et réécris-le. Un clic
   ailleurs (ou `Échap`) valide.
3. **🖼 Images** : clique une image pour la remplacer par un fichier de ton
   disque. Les fonds en image se remplacent aussi.
4. **👁 Aperçu** : la page redevient normale, tu peux cliquer ses boutons et
   vérifier ton travail.
5. **💾 Exporter** : tu récupères `ta-maquette - modifie.html`, prêt à diffuser.

## Le principe : on n'écrase jamais ta maquette

Ta page est ouverte **telle quelle**, avec ses scripts, ses polices et ses
animations. Tes retouches ne réécrivent pas le code : elles sont enregistrées
**par-dessus**, et le fichier exporté est ton original **plus un petit
correctif** qui rejoue les remplacements à l'ouverture.

Ce choix a trois conséquences très pratiques :

- **Rien ne casse.** Même une page dont le contenu est construit par du
  JavaScript au chargement (maquette exportée d'un outil, page « bundlée »)
  fonctionne : le correctif attend que la page soit construite, et se
  réapplique si elle se reconstruit (changement d'onglet, filtre…).
- **C'est réversible.** Chaque retouche est listée dans le panneau de droite
  avec un ✕ pour l'annuler. `Ctrl+Z` annule la dernière.
- **C'est reprenable.** Redépose le fichier exporté dans l'outil : tes
  retouches sont retrouvées et tu continues. Pas d'empilement : le correctif
  est régénéré à chaque export.

Une retouche de texte ne s'applique que si le texte d'origine est encore là :
si tu remplaces la maquette par une nouvelle version où ce texte a changé, la
retouche est simplement ignorée au lieu d'écraser le nouveau contenu.

## Bon à savoir

- Les images que tu déposes sont **embarquées dans le fichier** (en base64) :
  le HTML exporté reste autonome, lisible hors ligne, sans dossier d'images à
  côté.
- L'outil retouche **textes et images**. Il ne déplace pas les blocs et ne
  change pas la mise en page — c'est un remplaçeur de contenu, pas un
  constructeur de site.
- Pour un pack monté à partir de Google Slides, c'est l'autre outil qu'il te
  faut : [`slides2html`](../slides2html/README.md).

## Fichiers

```
Editeur-HTML.html   l'outil, autonome et sans dépendance — c'est CE fichier
                    que tu télécharges et ouvres
```
