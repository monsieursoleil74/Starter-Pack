/* Le nom du personnage vit AUSSI dans les onglets, toujours à l'écran. Quand
   le bandeau du nom et la grille de champs sont dans des sections distinctes,
   la descente depuis l'onglet « Karl » retombe sur le vrai champ description :
   éditer la description de Karl écrasait celle de TOUS les personnages (leurs
   placeholders sont identiques). La vérification inverse du témoin l'interdit.
   Usage : node e2e65.js [chemin-outil]  (pour prouver l'échec de l'ancien). */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_desc.html');
const OUT = path.resolve(__dirname, 'desc_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

// bandeau du nom et grille de champs dans des sections distinctes, onglets
// profonds : la géométrie où la descente depuis l'onglet retombe sur le champ
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Persos</title>
<style>body{font-family:sans-serif;padding:24px;background:#eee}
.tab{padding:8px 16px}.nom{font-size:34px;font-weight:700}
.etq{font-size:11px;text-transform:uppercase;color:#888;display:block;margin-top:12px}
.val{font-size:15px}</style></head><body>
<main>
  <nav><div>
    <button class="tab" id="tPipo">Pipo</button>
    <button class="tab" id="tKarl">Karl</button>
    <button class="tab" id="tRex">Rex</button>
  </div></nav>
  <section><div><span class="nom sc-interp" id="nom">Pipo</span></div></section>
  <section><div><span class="val sc-interp" id="desc">Description à écrire.</span></div>
    <div><span class="etq">Arc</span><span class="val sc-interp" id="arc">Arc à écrire.</span></div></section>
</main>
<script>
var fiches = {
  Pipo: { desc: 'Description à écrire.', arc: 'Arc à écrire.' },
  Karl: { desc: 'Description à écrire.', arc: 'Arc à écrire.' },
  Rex:  { desc: 'Description à écrire.', arc: 'Arc à écrire.' }
};
var courant = 'Pipo';
function montre(qui) {
  if (document.getElementById('nom').textContent !== qui)
    document.getElementById('nom').textContent = qui;
  if (fiches[courant].desc !== fiches[qui].desc)
    document.getElementById('desc').textContent = fiches[qui].desc;
  if (fiches[courant].arc !== fiches[qui].arc)
    document.getElementById('arc').textContent = fiches[qui].arc;
  courant = qui;
}
['Pipo', 'Karl', 'Rex'].forEach(function (q) {
  document.getElementById('t' + q).addEventListener('click', function () { montre(q); });
});
<\/script>
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1200, height: 700 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1200);
  const fr = p.frameLocator('#frame');
  const desc = () => fr.locator('#desc').textContent();
  const voir = async (qui) => {
    await p.click('#mView');
    await p.waitForTimeout(250);
    await fr.locator('#t' + qui).click();
    await p.waitForTimeout(1000);
  };

  // ---------- 1. la description de Karl, et de lui seul ----------
  await voir('Karl');
  await p.click('#mText');
  await p.waitForTimeout(300);
  await fr.locator('#desc').click();
  await p.waitForTimeout(300);
  await p.keyboard.press('ControlOrMeta+a');
  await p.keyboard.type('Le molosse du groupe, fidèle et bourru.');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(600);
  if (!/molosse/.test(await desc())) fail('la description de Karl n’est pas posée');
  ok('description de Karl remplacée');

  // ---------- 2. les autres gardent la leur (le bug : ils prenaient celle de Karl) ----------
  await voir('Pipo');
  if (/molosse/.test(await desc()))
    fail('le bug signalé : la description de Karl a écrasé celle de Pipo');
  ok('Pipo garde sa description');
  await voir('Rex');
  if (/molosse/.test(await desc())) fail('Rex a pris la description de Karl');
  ok('Rex garde la sienne');
  await voir('Karl');
  if (!/molosse/.test(await desc())) fail('retour Karl : ' + (await desc()));
  ok('Karl retrouve la sienne en revenant');

  // ---------- 3. export : pareil ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1500);
  const descV = () => v.locator('#desc').textContent();
  const voirV = async (qui) => { await v.click('#t' + qui); await v.waitForTimeout(1300); };
  if (/molosse/.test(await descV())) fail('export : Pipo (départ) a la description de Karl');
  await voirV('Karl');
  if (!/molosse/.test(await descV())) fail('export : Karl n’a pas la sienne');
  await voirV('Rex');
  if (/molosse/.test(await descV())) fail('export : Rex a pris celle de Karl');
  ok('export : la description de Karl reste à Karl');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
