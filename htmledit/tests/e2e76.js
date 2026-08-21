/* « Reprendre d'un autre fichier » : les images de la RÉSERVE reprises
   doivent s'afficher tout de suite. Avant, la reprise faisait une simple
   passe : une maquette qui lit sa réserve au démarrage avait déjà lu les
   anciens visuels — les images reprises restaient invisibles jusqu'au
   prochain rechargement (supprimer une retouche, par exemple).
   Usage : node e2e76.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_reserve.html');
const DONOR = path.resolve(__dirname, 'donor_reserve.html');
const PNG = path.resolve(__dirname, 'alt_a.png');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

// la maquette : sa réserve est lue au DÉMARRAGE (différé), puis peinte en
// canvas — impossible à corriger après coup, seul un vrai rechargement
// (retouches posées AVANT la lecture) montre le bon visuel
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Réserve</title></head>
<body style="font-family:sans-serif;padding:30px">
<h1>Concepts et planches</h1>
<div id="rg-assetmap" style="display:none"><img data-k="assets/planche01.png" src="assets/planche01.png"></div>
<canvas id="planche" width="80" height="60" style="border:1px solid #999"></canvas>
<p>La planche du personnage.</p>
<script>
  setTimeout(function () {
    var src = document.querySelector('#rg-assetmap img').getAttribute('src');
    var im = new Image();
    im.onload = function () {
      document.getElementById('planche').getContext('2d').drawImage(im, 0, 0, 80, 60);
    };
    im.src = src;
  }, 400);
</script>
</body></html>`);

// le fichier « donneur » : un export précédent qui contient la retouche de
// réserve (l'image remplacée, embarquée)
const dataUri = 'data:image/png;base64,' + fs.readFileSync(PNG).toString('base64');
const patchs = [{ id: 'pdon1', kind: 'img', src: 'reserve', k: 'assets/planche01.png',
  sel: 'body:nth-of-type(1)>div:nth-of-type(1)>img:nth-of-type(1)',
  before: 'assets/planche01.png', after: dataUri, label: 'planche01 reprise' }];
fs.writeFileSync(DONOR, `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>ancien export
<!--pack-edit-->
<script id="pack-edit-data" type="application/json">${JSON.stringify(patchs)}</script>
<!--/pack-edit-->
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => { if (!/Clipboard|writeText/.test(e.message)) errs.push(e.message); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1500);

  const pixels = () => p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const cv = d.getElementById('planche');
    const px = cv.getContext('2d').getImageData(0, 0, 80, 60).data;
    let n = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] > 0) n++;
    return n;
  });

  if ((await pixels()) !== 0) fail('le canvas devrait être vide avant la reprise (asset introuvable)');
  ok('avant la reprise : la planche est vide (son fichier n’existe pas sur ce disque)');

  // ---------- reprise depuis l'ancien export ----------
  await p.setInputFiles('#pickImp', DONOR);
  await p.waitForTimeout(2500);

  const n = await pixels();
  if (n === 0) fail('après la reprise, la planche reste INVISIBLE — il faut encore ' +
    'supprimer une retouche pour forcer le rafraîchissement');
  ok('après la reprise, la planche reprise s’affiche immédiatement (' + n + ' pixels peints)');

  // la retouche est bien dans la liste
  const liste = await p.evaluate(() => document.getElementById('list').textContent);
  if (!/planche01 reprise/.test(liste)) fail('la retouche reprise n’est pas dans la liste');
  ok('la retouche reprise est dans la liste');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
