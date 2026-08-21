/* Renommer Otto en « Bill » alors qu'un personnage Bill existe déjà : la
   remise à l'original prenait le « Bill » NATUREL de la fiche du vrai Bill
   pour un reste de notre retouche, et écrivait « Otto » dessus — en boucle.
   Seul un texte signé par nous peut être restauré.
   Usage : node e2e67.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_ottobill.html');
const OUT = path.resolve(__dirname, 'ottobill_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

// le bandeau d'équipe (interpolé, plus gros que le nom) sert de témoin au
// nom ; les onglets d'équipes restent toujours à l'écran
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Persos</title>
<style>body{font-family:sans-serif;padding:24px;background:#eee}
.tabE{padding:6px 14px}.equipe{font-size:44px;font-weight:800;display:block}
.nom{font-size:34px;font-weight:700;display:block}
.val{font-size:15px;display:block}</style></head><body>
<nav>
  <button class="tabE" id="eCamp">Le Camp</button>
  <button class="tabE" id="eFam">Famille</button>
</nav>
<button id="bOtto">O.</button><button id="bBill">B.</button><button id="bMomo">M.</button>
<div id="fiche">
  <span class="equipe sc-interp" id="equipe">Le Camp</span>
  <span class="nom sc-interp" id="nom">Otto</span>
  <span class="val sc-interp" id="role">Rôle à écrire.</span>
</div>
<script>
var fiches = {
  Otto: { equipe: 'Le Camp', role: 'Rôle à écrire.' },
  Bill: { equipe: 'Famille', role: 'Rôle à écrire.' },
  Momo: { equipe: 'Le Camp', role: 'Rôle à écrire.' }
};
var courant = 'Otto';
function montre(qui) {
  // comme le vrai framework : diff de MODÈLE à modèle (pas modèle-DOM)
  if (courant !== qui)
    document.getElementById('nom').textContent = qui;
  if (fiches[courant].equipe !== fiches[qui].equipe)
    document.getElementById('equipe').textContent = fiches[qui].equipe;
  if (fiches[courant].role !== fiches[qui].role)
    document.getElementById('role').textContent = fiches[qui].role;
  courant = qui;
}
document.getElementById('bOtto').addEventListener('click', function () { montre('Otto'); });
document.getElementById('bBill').addEventListener('click', function () { montre('Bill'); });
document.getElementById('bMomo').addEventListener('click', function () { montre('Momo'); });
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

  // ---------- 1. renommer Otto en « Bill » (un Bill existe déjà) ----------
  await p.click('#mText');
  await p.waitForTimeout(300);
  await fr.locator('#nom').click();
  await p.waitForTimeout(300);
  await p.keyboard.press('ControlOrMeta+a');
  await p.keyboard.type('Bill');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(700);
  if ((await nom()).trim() !== 'Bill') fail('le renommage ne prend pas : ' + (await nom()));
  ok('Otto renommé en « Bill » sur sa fiche');

  // ---------- 2. la fiche du VRAI Bill ne se fait jamais réécrire ----------
  await voir('Bill');
  await p.waitForTimeout(1500);
  if ((await nom()).trim() === 'Otto')
    fail('le bug signalé : « Otto » a été écrit sur la fiche du vrai Bill');
  if ((await nom()).trim() !== 'Bill') fail('fiche du vrai Bill : ' + (await nom()));
  ok('le vrai Bill garde son nom — sa valeur naturelle n’est pas prise pour un reste');

  // ---------- 3. les allers-retours tiennent ----------
  await voir('Momo');
  if ((await nom()).trim() !== 'Momo') fail('Momo : ' + (await nom()));
  await voir('Otto');
  if ((await nom()).trim() !== 'Bill') fail('retour Otto : ' + (await nom()) + ' — le renommage est perdu');
  await voir('Bill');
  if ((await nom()).trim() !== 'Bill') fail('re-retour Bill : ' + (await nom()));
  ok('navigation : Otto→« Bill » tient, le vrai Bill reste Bill, Momo reste Momo');

  // ---------- 4. export ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1500);
  const nomV = () => v.locator('#nom').textContent();
  const voirV = async (qui) => { await v.click('#b' + qui); await v.waitForTimeout(1300); };
  if ((await nomV()).trim() !== 'Bill') fail('export, Otto (départ) : ' + (await nomV()));
  await voirV('Bill');
  await v.waitForTimeout(1200);
  if ((await nomV()).trim() !== 'Bill') fail('export, vrai Bill : ' + (await nomV()));
  await voirV('Momo');
  if ((await nomV()).trim() !== 'Momo') fail('export, Momo : ' + (await nomV()));
  await voirV('Otto');
  if ((await nomV()).trim() !== 'Bill') fail('export, retour Otto : ' + (await nomV()));
  ok('export : le renommage tient, le vrai Bill n’est jamais réécrit');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
