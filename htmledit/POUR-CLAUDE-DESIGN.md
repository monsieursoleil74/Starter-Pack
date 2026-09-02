# Prompt à envoyer à Claude Design (pour la maquette)

Copie-colle le bloc « CONTRAT v2 » ci-dessous dans ta conversation Claude
Design, avec ta maquette. Il remplace les dix règles d'avant par UN principe
vérifiable : chaque contenu remplaçable porte une étiquette `data-slot`.
Avec ça, l'éditeur local n'a plus rien à deviner — il remplace ce que
l'étiquette désigne, point. Aucun effet sur le rendu.

---

## CONTRAT v2 — à copier-coller

Cette maquette n'est pas une page figée : un éditeur local la **remplit**
ensuite avec les vrais visuels, vidéos et textes, sans accès à ton code.
Applique le contrat suivant — il ne change rien au rendu, il rend chaque
contenu remplaçable de façon fiable.

**Le principe unique : chaque contenu remplaçable porte une étiquette
`data-slot`, unique et stable.**

1. **Sur la balise du contenu lui-même.**
   - Une image : `<img data-slot="personnages/tito/portrait" src="…" alt="Portrait Tito">`
   - Un fond : `<div data-slot="decors/01" style="background-image:…">`
   - Une vidéo : `<video data-slot="tutos/manuel/video" controls src="…">`
   - Un texte éditable (nom, rôle, description…) :
     `<span data-slot-texte="personnages/tito/nom">TITO</span>` — l'attribut
     est sur le porteur direct du texte.

2. **Un slot = un contenu.** Deux contenus différents n'ont jamais la même
   étiquette. Nomme par le sens : `personnages/<slug>/portrait`,
   `personnages/<slug>/planche-01`, `decors/03`, `colorscript/sq01`,
   `tutos/<slug>/video`, `equipe/<slug>/nom`.

3. **Balise partagée entre plusieurs contenus** (une même fenêtre vidéo pour
   tous les tutoriels, une même fiche pour tous les personnages) : la
   maquette **met à jour le `data-slot` en même temps que le contenu**.
   Quand la fenêtre passe au tutoriel Rig, son `<video>` porte
   `data-slot="tutos/rig/video"` ; quand la fiche affiche Bruno, ses champs
   portent les slots de Bruno. C'est LA règle qui remplace tous les anciens
   mécanismes de repérage.

4. **Un emplacement encore vide porte déjà son étiquette**, sur une vraie
   balise du bon type : `<img data-slot="…">` même sans fichier,
   `<video data-slot="…" controls>` même sans vidéo. Jamais un simple bloc
   décoratif « VIDÉO — bientôt » sans balise.

5. **Toutes les vues d'un même contenu portent le même slot** : la vignette
   du carrousel ET son agrandissement dans la visionneuse. Remplacer l'un
   remplace l'autre, automatiquement.

6. **La page peut se reconstruire librement** (changement d'onglet, grille
   réordonnée, `innerHTML`) : les étiquettes reviennent avec le contenu.
   Seule interdiction : ne jamais remplacer la balise `<html>` elle-même.

7. **Aucun chemin mort** : tout visuel affiché est embarqué dans le fichier
   (ou remplacé par un visuel de remplissage embarqué, avec son slot).

Auto-vérification avant de livrer : **chaque image, vidéo, fond et texte
destiné à être remplacé a-t-il son `data-slot`/`data-slot-texte`, unique,
maintenu à jour quand la page change de contenu ?** Si oui, la maquette est
remplissable. L'éditeur affiche au chargement le nombre d'emplacements
reconnus : c'est le test de réception.

---

## Pourquoi ce contrat

L'éditeur applique ses retouches **par-dessus** la page, sans réécrire le
code. Avant, il devait deviner à quoi s'accrocher (position dans la page,
chemins de fichiers, textes témoins) — chaque nouvelle forme de maquette
cassait une devinette. Avec `data-slot`, il n'y a plus rien à deviner.

## Annexe — anciennes maquettes (contrat v1)

Les maquettes sans `data-slot` restent prises en charge par l'éditeur avec
les mécanismes historiques (réserve `#rg-assetmap` + `data-k`, alt
distincts, témoins de fenêtres partagées, une entrée par visuel, pas de
`src` comparés, visionneuse avec précédent/suivant…). Pour une NOUVELLE
maquette, applique le contrat v2 — il rend tout ça inutile.
