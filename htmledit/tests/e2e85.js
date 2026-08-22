/* Une planche porte plusieurs images superposées : cliquer dessus ouvre la
   fenêtre de choix. Avant, chaque vignette n'offrait qu'une chose — ouvrir
   l'explorateur de fichiers — alors qu'on veut souvent juste recentrer une
   image déjà en place. Chaque vignette porte maintenant « Cadrer » et
   « Remplacer » ; le cadrage efface la fenêtre le temps du réglage puis la
   rend, pour enchaîner sur les autres images de la pile.
   Usage : node e2e85.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_planche.html');
const PNG = path.resolve(__dirname, 'alt_a.png');
const OUT = path.resolve(__dirname, 'planche_export.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }
if (!fs.existsSync(PNG)) { console.error('lance fixtures.js d’abord'); process.exit(1); }

const px = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Planches</title>
<style>body{font-family:sans-serif;padding:30px;background:#181c22;color:#eee}
.planche{position:relative;width:520px;height:340px;margin-top:16px}
.planche img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
</style></head><body>
<h1>Planches</h1>
<div class="planche">
  <img id="fond" src="${px}" alt="Planche fond">
  <img id="dessus" src="${px}" alt="Planche dessus">
</div>
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1300, height: 800 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => { if (!/Clipboard|writeText/.test(e.message)) errs.push(e.message); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1200);
  await p.click('#mImg');
  await p.waitForTimeout(400);

  // ---------- 1. cliquer la planche ouvre la fenêtre de choix ----------
  const centre = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const r = d.querySelector('.planche').getBoundingClientRect();
    const f = document.getElementById('frame').getBoundingClientRect();
    return { x: f.left + r.left + r.width / 2, y: f.top + r.top + r.height / 2 };
  });
  await p.mouse.click(centre.x, centre.y);
  await p.waitForTimeout(500);
  if (await p.$eval('#askg', (e) => e.classList.contains('hidden')))
    fail('la fenêtre de choix ne s’ouvre pas sur une planche à images superposées');
  const tuiles = await p.$$eval('#askgGrid .gi:not(.zone)', (l) => l.map((t) => ({
    boutons: [...t.querySelectorAll('.act button')].map((b) => b.textContent.trim()),
    grises: [...t.querySelectorAll('.act button')].map((b) => b.disabled),
  })));
  if (tuiles.length < 2) fail('la fenêtre ne liste pas les deux images : ' + tuiles.length);
  for (const t of tuiles) {
    if (t.boutons.join('/') !== 'Cadrer/Remplacer')
      fail('une vignette n’offre pas les deux gestes : ' + JSON.stringify(t.boutons));
    if (t.grises[0]) fail('« Cadrer » est grisé sur une image bien affichée');
  }
  ok('la fenêtre s’ouvre et chaque vignette porte « Cadrer » et « Remplacer »');

  // ---------- 2. « Cadrer » ouvre le cadrage, la fenêtre s'efface ----------
  await p.click('#askgGrid .gi:not(.zone) .act button:first-child');
  await p.waitForTimeout(600);
  if (await p.$eval('#crop', (e) => e.classList.contains('hidden')))
    fail('« Cadrer » n’ouvre pas le panneau de cadrage');
  if (!(await p.$eval('#askg', (e) => e.classList.contains('hidden'))))
    fail('la fenêtre de choix reste par-dessus : impossible de déplacer l’image');
  if (await p.$eval('#pickImg', () => false).catch(() => false)) fail('?');
  ok('« Cadrer » ouvre le cadrage et efface la fenêtre le temps du réglage');

  // aucune retouche pour l'instant : le cadrage est provisoire
  if ((await p.$$eval('#list .it', (l) => l.length)) !== 0)
    fail('le seul fait d’ouvrir le cadrage a déjà créé une retouche');

  // ---------- 3. déplacer l'image : la retouche naît ----------
  const img = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const r = d.getElementById('dessus').getBoundingClientRect();
    const f = document.getElementById('frame').getBoundingClientRect();
    return { x: f.left + r.left + r.width / 2, y: f.top + r.top + r.height / 2 };
  });
  await p.mouse.move(img.x, img.y);
  await p.mouse.down();
  await p.mouse.move(img.x - 40, img.y - 25, { steps: 10 });
  await p.mouse.up();
  await p.waitForTimeout(500);

  // ---------- 4. « Terminé » rend la fenêtre de choix ----------
  await p.click('#cropOk');
  await p.waitForTimeout(700);
  if (await p.$eval('#askg', (e) => e.classList.contains('hidden')))
    fail('après le cadrage, la fenêtre de choix ne revient pas — il faut re-viser la planche');
  if (!(await p.$eval('#crop', (e) => e.classList.contains('hidden'))))
    fail('le panneau de cadrage est resté ouvert');
  const n1 = await p.$$eval('#list .it', (l) => l.length);
  if (n1 !== 1) fail('le déplacement n’a pas créé UNE retouche (' + n1 + ')');
  ok('le déplacement devient une retouche, et la fenêtre de choix revient');

  // ---------- 5. « Remplacer » sur l'autre vignette ouvre bien l'explorateur ----------
  const [ch] = await Promise.all([
    p.waitForEvent('filechooser'),
    p.click('#askgGrid .gi:not(.zone):nth-of-type(2) .act button:last-child'),
  ]);
  await ch.setFiles(PNG);
  await p.waitForTimeout(1200);
  const n2 = await p.$$eval('#list .it', (l) => l.length);
  if (n2 !== 2) fail('« Remplacer » n’a pas posé la seconde retouche (' + n2 + ')');
  ok('« Remplacer » ouvre l’explorateur et pose l’image sur l’autre vignette');

  // ---------- 6. l'export porte les deux ----------
  await p.click('#askgNo');
  await p.waitForTimeout(400);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const dd = JSON.parse(fs.readFileSync(OUT, 'utf8')
    .match(/<script id="pack-edit-data"[^>]*>([\s\S]*?)<\/script>/)[1].replace(/<\\\//g, '</'));
  if (dd.some((x) => x.prov)) fail('une retouche provisoire s’est glissée dans l’export');
  const cadree = dd.find((x) => x.fit && (x.fit.x !== 50 || x.fit.y !== 50));
  if (!cadree) fail('l’export ne garde pas le cadrage réglé à la souris');
  const posee = dd.find((x) => /^data:image\/png/.test(x.after || ''));
  if (!posee) fail('l’export ne garde pas l’image remplacée');
  ok('l’export porte le cadrage ET le remplacement');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
