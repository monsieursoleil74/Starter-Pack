# Tests de non-régression de l'éditeur

Chaque fichier `e2eNN.js` rejoue un vrai geste dans un navigateur (Playwright)
et vérifie le résultat, dans l'éditeur **et** dans le fichier exporté. La
plupart sont nés d'un bug remonté par l'usage : le test échoue sur la version
qui avait le défaut, et passe sur la version corrigée.

## Lancer

```
node e2e75.js                     # un test
node e2e75.js /chemin/vers/Editeur-HTML.html   # sur une autre version
./run_suite.sh resultat.log e2e23.js e2e24.js …   # une série
```

Les audits `audit_*.js` demandent de gros fichiers réels (packs de plusieurs
dizaines de Mo) qui ne sont pas versionnés ici : place-les à côté des tests
sous les noms attendus, ou saute-les.

Playwright doit être disponible (`playwright-core` + un Chromium).
