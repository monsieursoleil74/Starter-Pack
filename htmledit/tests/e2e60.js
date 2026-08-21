/* Une carte tutoriel ouvre sa vidéo au clic. En mode Textes, éditer son titre
   demande plusieurs clics (poser le curseur, valider à côté) : AUCUN ne doit
   ouvrir la vidéo. En Aperçu et dans l'export, la carte marche comme avant. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_tuto.html');
const OUT = path.resolve(__dirname, 'tuto_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tutos</title>
<style>body{font-family:sans-serif;padding:30px;background:#eee}
button.tuto{display:block;width:340px;text-align:left;padding:18px;background:#fff;
  border:1px solid #ccc;border-radius:12px;cursor:pointer}
#voile{position:fixed;inset:0;background:rgba(0,0,0,.8);color:#fff;display:none;
  align-items:center;justify-content:center}
#voile.on{display:flex}</style></head><body>
<h1>Tutoriels</h1>
<button class="tuto" id="carte">
  <span id="titreTuto">Exporter une playblast depuis Maya</span><br>
  <small>4 min — vidéo interne</small>
</button>
<div id="voile">La vidéo joue…</div>
<script>
window.ouvertures = 0;
document.getElementById('carte').addEventListener('click', function () {
  window.ouvertures++;
  document.getElementById('voile').classList.add('on');
});
document.getElementById('voile').addEventListener('click', function () {
  this.classList.remove('on');
});
<\/script>
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1200, height: 700 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1200);
  const fr = p.frameLocator('#frame');
  const ouvertures = () => p.evaluate(() => {
    const w = document.getElementById('frame').contentWindow;
    return { n: w.ouvertures, voile: w.document.getElementById('voile').classList.contains('on') };
  });

  // ---------- 1. premier clic : l'édition démarre, pas la vidéo ----------
  await p.click('#mText');
  await p.waitForTimeout(300);
  await fr.locator('#titreTuto').click();
  await p.waitForTimeout(400);
  let o = await ouvertures();
  if (o.n || o.voile) fail('cliquer le titre en mode Textes ouvre la vidéo (' + JSON.stringify(o) + ')');
  if (!(await p.evaluate(() => !!document.getElementById('frame').contentDocument.querySelector('[contenteditable="true"]'))))
    fail('l’édition ne démarre pas');
  ok('premier clic : édition ouverte, vidéo fermée');

  // ---------- 2. re-cliquer pour déplacer le curseur : toujours pas ----------
  await fr.locator('#titreTuto').click({ position: { x: 10, y: 5 } });
  await p.waitForTimeout(600);
  o = await ouvertures();
  if (o.n || o.voile) fail('déplacer le curseur d’un clic ouvre la vidéo — le bug signalé');
  ok('déplacer le curseur dans le texte n’ouvre pas la vidéo');

  // ---------- 3. corriger, puis VALIDER d'un clic à côté ----------
  await p.keyboard.press('ControlOrMeta+a');
  await p.keyboard.type('Exporter une playblast (v2)');
  await fr.locator('h1').click();       // valider en cliquant ailleurs
  await p.waitForTimeout(600);
  o = await ouvertures();
  if (o.n || o.voile) fail('le clic qui valide l’édition ouvre la vidéo');
  if ((await fr.locator('#carte').textContent()).indexOf('(v2)') < 0)
    fail('le texte n’est pas validé');
  ok('le clic de validation n’ouvre pas la vidéo, le texte est retenu');

  // ---------- 4. en Aperçu, la carte marche comme la maquette le veut ----------
  await p.click('#mView');
  await p.waitForTimeout(300);
  await fr.locator('#carte').click();
  await p.waitForTimeout(400);
  o = await ouvertures();
  if (o.n !== 1 || !o.voile) fail('en Aperçu, la carte n’ouvre plus sa vidéo (' + JSON.stringify(o) + ')');
  ok('en Aperçu, la carte ouvre sa vidéo normalement');
  await fr.locator('#voile').click();
  await p.waitForTimeout(300);

  // ---------- 5. export : texte rejoué, carte intacte ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1200);
  if ((await v.locator('#carte').textContent()).indexOf('(v2)') < 0)
    fail('export : le titre corrigé n’est pas rejoué');
  await v.locator('#carte').click();
  await v.waitForTimeout(400);
  const oe = await v.evaluate(() => ({ n: window.ouvertures,
    voile: document.getElementById('voile').classList.contains('on') }));
  if (oe.n !== 1 || !oe.voile) fail('export : la carte n’ouvre plus sa vidéo');
  ok('export : titre corrigé, la carte ouvre toujours sa vidéo');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
