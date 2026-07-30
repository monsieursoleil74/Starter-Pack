# Éditeur HTML local

Tu as une **maquette HTML** qui te plaît (faite à la main, générée, exportée
d'un outil…) et tu veux juste **remplacer ses textes et ses images** sans
toucher au code ? C'est cet outil.

**Rien à installer**, comme le convertisseur : `Editeur-HTML.html` est une page
web que tu ouvres en double-cliquant. Tout se passe dans ton navigateur, aucun
fichier n'est envoyé en ligne.

## Quelle version ai-je ?

Le numéro est affiché **à côté du titre**, sur l'écran d'accueil de l'outil
(`version 2026-07-30b`). Si un comportement ne correspond pas à ce mode
d'emploi, commence par retélécharger : le lien pointe toujours vers la
dernière version.

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

## Carrousels et images empilées

Dans un carrousel, les images sont **superposées au même endroit** et une seule
est visible : un clic n'atteint normalement que celle du dessus.

**Clique simplement le carrousel.** L'outil regarde toute la pile sous ton
curseur et t'ouvre **la liste de SES images** — pas celles de la page entière.
Tu choisis celle que tu veux remplacer, et le panneau **reste ouvert** : tu
enchaînes la deuxième, la troisième, sans re-viser la zone. Chacune est marquée
✓ dès qu'elle est faite.

Le survol te dit à l'avance ce qu'un clic va faire : *« 3 images ici — clique
pour choisir »*, *« Remplacer cette image »* ou *« Poser une image ici »*.

Chaque image de la liste indique si elle est **affichée** ou **pas affichée en
ce moment** — dans un carrousel, celle que tu remplaces n'est pas forcément
celle que tu vois ; elle apparaîtra quand le carrousel la fera défiler.

Le panneau de droite, lui, garde la vue d'ensemble : **toutes les images de la
page**, désormais **groupées par bloc** (« Planche proto — 2 images au même
endroit »), y compris celles qui sont hors écran ou pas encore chargées.

### Un visuel caché sous un texte ou un dégradé

Même mécanisme pour une carte dont l'image sert de fond, posée sous un dégradé
et sous son texte (le bloc « Ton & intentions », par exemple) : le clic tombait
sur le dégradé, jamais sur l'image. Maintenant l'outil voit ce qu'il y a
**dessous** et te la propose directement.

## Poser une image là où il n'y en a pas

Certaines zones n'ont **aucune image à remplacer** : une pastille de personnage,
c'est souvent juste une lettre sur un fond de couleur. En mode **🖼 Images**, la
surbrillance te dit ce que tu vises :

- **cadre vert plein** → une image : clic = la remplacer ;
- **cadre orange pointillé** → une zone sans image (pastille, bloc, bandeau) :
  clic = **y poser une image**, avec deux façons au choix :
  - **à la place du contenu** — l'image remplit la zone et ce qu'il y avait
    dedans (la lettre « P ») est masqué. C'est le choix pour transformer une
    pastille en portrait ;
  - **en fond** — l'image se place derrière, le texte reste lisible par-dessus.
    Pratique pour un bandeau ou une carte.

L'image est cadrée en *cover* (elle remplit sans se déformer, quitte à rogner).

**Exemple concret — mettre les portraits dans les pastilles de personnages :**
mode **🖼 Images** → clique la pastille (elle se cadre en orange pointillé) →
**« à la place du contenu »** → choisis le portrait. La lettre disparaît sous
l'image, et le nom écrit *sous* la pastille reste en place. À refaire pour
chaque personnage.

## 🔗 Brancher les liens

Les boutons d'une maquette pointent souvent vers `#` — nulle part. Le mode
**🔗 Liens** liste **tous les liens de la page** avec leur destination
actuelle, et **signale en orange ceux qui n'ont pas d'adresse**. Clique une
ligne (ou le bouton dans la page), tape l'adresse, valide.

- Le champ est pré-rempli avec l'adresse actuelle : tu peux corriger au lieu
  de retaper.
- Case **« Ouvrir dans un nouvel onglet »**, cochée par défaut — décoche-la
  pour un lien interne à la page.
- Sur un **bouton qui n'est pas un vrai lien**, l'outil pose un clic qui ouvre
  l'adresse. Ça marche pareil à l'arrivée.

**Chemins réseau** (`\\serveur\projet\…`) : tu peux les saisir, mais sache que
les navigateurs refusent le plus souvent de les ouvrir depuis une page web,
par sécurité. L'outil te prévient. Si le pack est lu depuis le même partage,
un chemin **relatif** (`../rigs/pipo/`) est bien plus fiable.

## 🎬 Brancher les vidéos

Beaucoup de maquettes ont un encadré « VIDÉO » qui ne contient **aucun
lecteur** — c'est un décor. Le mode **🎬 Vidéos** en pose un vrai.

Si la vidéo s'ouvre **dans une fenêtre** (clic sur un bouton *RIG*, *TOOLS*…),
**clique simplement ce bouton** en mode 🎬 Vidéos : l'outil ouvre la fenêtre
pour toi et vise l'emplacement du lecteur à l'intérieur — pas le bouton. Il
te reste à choisir comment brancher la vidéo.

Tu peux aussi cliquer directement un encadré ou un lecteur déjà visible.

Deux façons, et le choix compte :

| | Le fichier HTML | La vidéo |
|---|---|---|
| **Posée à côté** *(recommandé)* | reste léger | à copier dans un dossier `videos/` à côté du HTML |
| **Embarquée** | grossit d'environ 1,4 × le poids de la vidéo | dans le fichier, rien à copier |

Pour un pack diffusé sur le serveur du studio, **« posée à côté »** est
presque toujours le bon choix : le HTML reste maniable et tu remplaces une
vidéo sans refaire la page. L'outil te rappelle en clair, dans le panneau de
droite, la liste des fichiers à copier et sous quel nom.

L'embarqué est parfait pour un clip court qu'on veut pouvoir envoyer seul.

Un lecteur **déjà présent** dans la maquette se traite pareil : clique-le, et
tu changes juste la vidéo qu'il lit.

**Si la maquette range ses vidéos dans une réserve** (une balise par fichier,
avec son chemin), c'est là que l'outil branche la tienne : chaque tuto, chaque
personnage garde la sienne, et elle suit partout où ce fichier sert. Mieux : en
« posée à côté », l'outil **reprend le chemin que la maquette attend** — le
panneau de droite t'indique alors le nom exact à donner à ta vidéo
(`ma-video.mp4 → assets_nda/tutos/rig.mp4`). Tu déposes le fichier au bon
endroit, et le pack est complet.

**Une seule fenêtre, plusieurs boutons.** La plupart des maquettes n'ont qu'UNE
fenêtre vidéo, remplie au clic selon le bouton : RIG, TOOLS et les autres
partagent le même emplacement. Sans repère, la deuxième vidéo écraserait la
première. L'outil retient donc **le titre que la fenêtre affiche** quand tu
poses la vidéo, et te le dit : *« la vidéo ne sera montrée que pour
« Présentation générale du rig » »*. Chaque bouton garde ainsi la sienne, dans
l'éditeur comme dans le fichier exporté.

**Tu la vois tout de suite.** Même en « posée à côté » — où le fichier n'est
pas encore dans `videos/` — le lecteur lit ta vidéo depuis ton disque pendant
que tu travailles. Le HTML exporté, lui, garde bien le chemin propre
`videos/ta-video.mp4`.

**Si le lecteur reste noir**, c'est presque toujours le format : un navigateur
lit le **MP4 (H.264)** et le **WebM**. Un ProRes, un HEVC, un `.mkv` ou un
`.avi` ne se liront pas, même s'ils s'ouvrent très bien dans QuickTime ou VLC.
L'outil te le dit et te propose la conversion à faire.

## Un même emplacement, plusieurs contenus (fiches par personnage)

Une maquette réutilise souvent **la même balise image** pour afficher tour à
tour plusieurs contenus : la fiche de Pipo, puis celle de Bruno, dans le même
cadre. Sans précaution, remplacer l'une remplacerait les autres.

L'outil s'appuie donc sur la **description de l'image** (son `alt`, que la
maquette met à jour quand tu changes de personnage) : ta retouche est liée à
ce contenu-là, et la retouche l'affiche dans la liste (`portrait.png — Pipo`).
Quand tu passes à un autre personnage, **son visuel d'origine revient**. Tu
peux donc donner une image différente à chacun, en les faisant défiler.

Ça vaut aussi dans l'éditeur : la page s'y comporte comme le fichier final,
onglets et sélecteurs compris.

### La réserve d'images : un visuel par personnage

Une maquette bien faite range ses visuels dans une **réserve cachée** — une
balise par fichier, avec son chemin (`personnages/pipo/pipo_planche_01.png`) —
et les cadres viennent y piocher selon le personnage affiché.

Quand c'est le cas, l'outil le voit et **retouche l'entrée de la réserve**, pas
l'image affichée. Concrètement : tu cliques la planche de Pipo, tu la
remplaces, et **seul Pipo change** — Bruno garde la sienne. Le nouveau visuel
suit partout où ce fichier servait (le carrousel, la visionneuse en grand). La
retouche est nommée d'après le fichier concerné :
`planche_pipo.png → pipo_planche_01.png`.

**La limite à connaître :** si la maquette affiche *littéralement* la même
image pour tout le monde, sans réserve ni `alt` distinct, il n'y a **qu'un seul
emplacement** et l'outil ne peut pas en inventer d'autres. Là, c'est la
maquette qu'il faut faire évoluer ; l'éditeur ne peut que remplir ce qui
existe.

## Le texte collé prend le style du site

Coller depuis Word, Google Docs ou une page web apporte normalement toute la
mise en forme d'origine (police énorme, couleurs, interlignes). L'outil ne
garde **que le texte** : il prend automatiquement la police et la taille de ta
maquette. Rien à nettoyer.

## Où vont les images ? (et le poids du fichier)

Chaque image que tu déposes est **encodée dans le HTML lui-même**, en base64 :
pas de dossier d'images à côté, le fichier exporté se suffit à lui-même. Tu le
copies sur le serveur, tu l'envoies par mail, tu le lis hors ligne — il marche
tout seul.

Conséquence à connaître : **le fichier grossit d'environ 1,37 × le poids de tes
images**. Dix visuels de 500 Ko, c'est ~7 Mo de HTML. Deux conseils :

- réduis tes planches avant de les déposer (1600 px de large suffisent
  largement pour un écran) ;
- si ta maquette d'origine chargeait ses images depuis un dossier voisin
  (`assets/…`), les images que tu remplaces deviennent **embarquées**, donc
  autonomes — c'est un gain, mais le fichier s'alourdit d'autant.

Les images que tu **ne touches pas** restent exactement comme elles étaient
dans ta maquette : embarquées si elles l'étaient, dans leur dossier si elles
l'étaient. L'outil n'y touche pas.

## Ce que l'aperçu sait faire (et ce qu'il ne fait pas)

En **👁 Aperçu**, ta page se comporte normalement : boutons, onglets,
carrousels, fenêtres. Deux exceptions, parce que la page est affichée dans un
cadre et n'a pas encore d'adresse à elle :

- un lien de menu (`#tutoriels`) **fait défiler** jusqu'à la section, comme il
  le fera dans le fichier final ;
- un lien vers l'extérieur **s'ouvre dans un onglet**, et un lien vers un autre
  fichier est seulement annoncé — l'aperçu ne le suit pas, pour ne pas perdre
  ton travail en cours.

## Quand c'est la maquette qui coince

L'éditeur remplit ce qui existe : il ne peut pas inventer un emplacement qui
n'est pas dans la page. Si un visuel est **le même fichier pour deux contenus**,
si un agrandissement se fabrique son image de son côté, ou si un encadré vidéo
n'est qu'un décor sans lecteur, aucun outil ne pourra les distinguer.

Dans ce cas, c'est la maquette qu'il faut faire évoluer — et
[`POUR-CLAUDE-DESIGN.md`](POUR-CLAUDE-DESIGN.md) contient un texte prêt à
copier-coller à l'outil qui l'a fabriquée : six règles simples, sans effet sur
le rendu, qui rendent une page remplissable.

## Bon à savoir

- Les images que tu déposes sont **embarquées dans le fichier** (en base64) :
  le HTML exporté reste autonome, lisible hors ligne, sans dossier d'images à
  côté.
- L'outil retouche **textes, images, vidéos et liens**. Il ne déplace pas les
  blocs et ne change pas la mise en page — c'est un remplaçeur de contenu, pas
  un constructeur de site.

## Fichiers

```
Editeur-HTML.html   l'outil, autonome et sans dépendance — c'est CE fichier
                    que tu télécharges et ouvres
```
