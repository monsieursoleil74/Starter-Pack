/* Le scénario du terrain, de bout en bout : renommer Otto en « Bill » (un
   Bill existe), puis renommer la fiche du vrai Bill en « tesst ». Chaque
   fiche doit rester indépendante — pas de cascade Otto→Bill→tesst, pas de
   « connecté aux deux ». La maquette repeint en MUTANT ses nœuds de texte
   (comme le framework réel), ce qui invalide nos signatures. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_cascade.html');
const OUT = path.resolve(__dirname, 'cascade_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Persos</title>
<style>body{font-family:sans-serif;padding:24px;background:#eee}
.nom{font-size:34px;font-weight:700;display:block}
.val{font-size:15px;display:block}</style></head><body>
<h2>Personnages</h2>
<button id="bOtto">O.</button><button id="bBill">B.</button><button id="bMomo">M.</button>
<div id="fiche">
  <span class="nom sc-interp" id="nom">Otto</span>
  <span class="val sc-interp" id="role">Rôle à écrire.</span>
</div>
<script>
var fiches = {
  Otto: { role: 'Rôle à écrire.' }, Bill: { role: 'Rôle à écrire.' },
  Momo: { role: 'Rôle à écrire.' }
};
var courant = 'Otto';
// comme le vrai framework : diff modèle-à-modèle, écriture par MUTATION du
// nœud de texte existant (jamais de remplacement)
function ecrit(id, v) {
  var n = document.getElementById(id);
  if (n.firstChild && n.firstChild.nodeType === 3 && n.childNodes.length === 1)
    n.firstChild.nodeValue = v;
  else n.textContent = v;
}
function montre(qui) {
  if (courant !== qui) ecrit('nom', qui);
  if (fiches[courant].role !== fiches[qui].role) ecrit('role', fiches[qui].role);
  courant = qui;
}
['Otto', 'Bill', 'Momo'].forEach(function (q) {
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
  const nom = () => fr.locator('#nom').textContent();
  const voir = async (qui) => {
    await p.click('#mView');
    await p.waitForTimeout(250);
    await fr.locator('#b' + qui).click();
    await p.waitForTimeout(1100);
  };
  const editeNom = async (texte) => {
    await p.click('#mText');
    await p.waitForTimeout(300);
    await fr.locator('#nom').click();
    await p.waitForTimeout(300);
    await p.keyboard.press('ControlOrMeta+a');
    await p.keyboard.type(texte);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(700);
  };

  // ---------- 1. Otto -> « Bill », puis la fiche du vrai Bill -> « tesst » ----------
  await editeNom('Bill');
  if ((await nom()).trim() !== 'Bill') fail('renommage d’Otto : ' + (await nom()));
  await voir('Bill');
  if ((await nom()).trim() !== 'Bill') fail('fiche du vrai Bill au départ : ' + (await nom()));
  await editeNom('tesst');
  if ((await nom()).trim() !== 'tesst') fail('renommage du vrai Bill : ' + (await nom()));
  ok('Otto → « Bill », vrai Bill → « tesst »');

  // ---------- 2. chaque fiche la sienne, pas de cascade ----------
  await voir('Otto');
  if ((await nom()).trim() === 'tesst')
    fail('le bug signalé : la cascade Otto→Bill→tesst est revenue');
  if ((await nom()).trim() !== 'Bill') fail('fiche d’Otto : ' + (await nom()));
  await voir('Bill');
  if ((await nom()).trim() !== 'tesst') fail('fiche du vrai Bill : ' + (await nom()));
  await voir('Momo');
  if ((await nom()).trim() !== 'Momo') fail('Momo : ' + (await nom()));
  ok('pas de cascade : Otto=« Bill », vrai Bill=« tesst », Momo intact');

  // ---------- 3. rééditer Otto ne touche que lui ----------
  await voir('Otto');
  await editeNom('Ricky');
  await voir('Bill');
  if ((await nom()).trim() !== 'tesst') fail('rééditer Otto a touché le vrai Bill : ' + (await nom()));
  await voir('Otto');
  if ((await nom()).trim() !== 'Ricky') fail('la réédition d’Otto est perdue : ' + (await nom()));
  ok('réédition d’Otto : lui seul change');

  // ---------- 4. export ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1500);
  const nomV = () => v.locator('#nom').textContent();
  const voirV = async (qui) => { await v.click('#b' + qui); await v.waitForTimeout(1300); };
  if ((await nomV()).trim() !== 'Ricky') fail('export, Otto : ' + (await nomV()));
  await voirV('Bill');
  if ((await nomV()).trim() !== 'tesst') fail('export, vrai Bill : ' + (await nomV()));
  await voirV('Momo');
  if ((await nomV()).trim() !== 'Momo') fail('export, Momo : ' + (await nomV()));
  await voirV('Otto');
  if ((await nomV()).trim() !== 'Ricky') fail('export, retour Otto : ' + (await nomV()));
  ok('export : chacun garde le sien, navigation comprise');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
