# Tests de non-régression de l'éditeur

Chaque fichier `e2eNN.js` rejoue un vrai geste dans un navigateur (Playwright)
et vérifie le résultat, dans l'éditeur **et** dans le fichier exporté. La
plupart sont nés d'un bug remonté par l'usage : le test échoue sur la version
qui avait le défaut, et passe sur la version corrigée.

## Lancer

```
node fixtures.js                  # une fois : refait les images/vidéos d'appui
node e2e75.js                     # un test
node e2e75.js /chemin/vers/Editeur-HTML.html   # sur une autre version
./run_suite.sh resultat.log e2e23.js e2e24.js …   # une série
```

`fixtures.js` refabrique les petits fichiers partagés (`vraie.webm`,
`large.png`, `pipo_portrait.png`…) que plusieurs tests réutilisent : ils ne
sont pas versionnés, tout le reste est jetable et ignoré par git.

Lance-les **dans l'ordre des numéros** : quelques tests réutilisent la maquette
écrite par un test précédent (`e2e79` reprend celle d'`e2e76`, les audits
reprennent `maq_ronds.html`). Les audits `audit_*.js` passent donc en dernier,
et certains demandent de gros fichiers réels (packs de plusieurs dizaines de
Mo) qui ne sont pas versionnés ici : place-les à côté des tests sous les noms
attendus, ou saute-les.

Playwright doit être disponible (`playwright-core` + un Chromium).
