/* Le MÊME charalead (« Lucas ») posé sur deux personnages d'une fiche
   partagée : chacun doit le garder. Le bug terrain : poser « Lucas » sur Rex
   remettait celui de Pipo à « Prénom Nom » — la remise à l'original prenait
   le « Lucas » de Pipo pour un reste de celui de Rex. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_memenom.html');
const OUT = path.resolve(__dirname, 'memenom_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fiches</title>
<style>body{font-family:sans-serif;padding:30px;background:#eee}
.nom{font-size:34px;font-weight:700;display:block}
.etq{font-size:11px;text-transform:uppercase;color:#888;display:block;margin-top:14px}
.val{font-size:15px;display:block}</style></head><body>
<h1>Personnages</h1>
<button id="bPipo">Pipo</button><button id="bRex">Rex</button><button id="bMomo">Momo</button>
<div id="fiche">
  <span class="nom sc-interp" id="nom">Pipo</span>
  <span class="etq">Réf. CharaLead</span>
  <span class="val" id="lead">Prénom Nom</span>
</div>
<script>
var fiches = { Pipo: { lead: 'Prénom Nom' }, Rex: { lead: 'Prénom Nom' }, Momo: { lead: 'Prénom Nom' } };
var courant = 'Pipo';
function montre(qui) {
  // repeint différentiel, comme la vraie maquette
  if (document.getElementById('nom').textContent !== qui)
    document.getElementById('nom').textContent = qui;
  if (fiches[courant].lead !== fiches[qui].lead)
    document.getElementById('lead').textContent = fiches[qui].lead;
  courant = qui;
}
['Pipo', 'Rex', 'Momo'].forEach(function (q) {
  document.getElementById('b' + q).addEventListener('click', function () { montre(q); });
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
  const lead = () => fr.locator('#lead').textContent();
  const editer = async (texte) => {
    await p.click('#mText');
    await p.waitForTimeout(300);
    await fr.locator('#lead').click();
    await p.waitForTimeout(300);
    await p.keyboard.press('ControlOrMeta+a');
    await p.keyboard.type(texte);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(500);
  };
  const voir = async (qui) => {
    await p.click('#mView');
    await p.waitForTimeout(250);
    await fr.locator('#b' + qui).click();
    await p.waitForTimeout(1000);
  };

  // ---------- 1. « Lucas » sur Pipo, puis « Lucas » sur Rex ----------
  await editer('Lucas');
  await voir('Rex');
  await editer('Lucas');
  ok('« Lucas » posé sur Pipo puis sur Rex');

  // ---------- 2. retour sur Pipo : il garde SON « Lucas » ----------
  await voir('Pipo');
  if ((await lead()) !== 'Lucas')
    fail('le bug signalé : Pipo est retombé à « ' + (await lead()) + ' »');
  ok('Pipo garde son « Lucas » — le même charalead peut servir deux fois');
  await voir('Momo');
  if ((await lead()) !== 'Prénom Nom')
    fail('Momo, jamais retouché, montre « ' + (await lead()) + ' »');
  ok('Momo, non retouché, garde son placeholder');
  await voir('Rex');
  if ((await lead()) !== 'Lucas') fail('Rex : ' + (await lead()));
  await voir('Pipo');
  if ((await lead()) !== 'Lucas') fail('re-retour Pipo : ' + (await lead()));
  ok('les allers-retours ne cassent rien');

  // ---------- 3. export : pareil ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1500);
  const leadV = () => v.locator('#lead').textContent();
  const voirV = async (qui) => { await v.click('#b' + qui); await v.waitForTimeout(1300); };
  if ((await leadV()) !== 'Lucas') fail('export, Pipo : ' + (await leadV()));
  await voirV('Rex');
  if ((await leadV()) !== 'Lucas') fail('export, Rex : ' + (await leadV()));
  await voirV('Momo');
  if ((await leadV()) !== 'Prénom Nom') fail('export, Momo : ' + (await leadV()));
  await voirV('Pipo');
  if ((await leadV()) !== 'Lucas') fail('export, retour Pipo : ' + (await leadV()));
  ok('export : les deux « Lucas » tiennent, Momo reste vierge');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
