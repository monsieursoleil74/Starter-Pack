/* Changer de personnage TRÈS vite faisait flasher le placeholder (« Espèce
   fictive… ») par-dessus le texte choisi : la 2e vague de repeint, arrivée
   moins de 30 ms après la 1re, était différée de 90 ms — le temps d'un rendu.
   Les mutations arrivent AVANT le rendu : une vague de texte se rejoue
   immédiatement, le placeholder n'est jamais peint.
   Usage : node e2e71.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_flash.html');
const OUT = path.resolve(__dirname, 'flash_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Flash</title>
<style>.nom{font-size:34px;font-weight:700;display:block}.val{font-size:15px;display:block}</style>
</head><body style="font-family:sans-serif;padding:30px">
<button id="bA">A.</button><button id="bB">B.</button>
<div id="fiche"><span class="nom sc-interp" id="nom">Aldo</span>
<span class="val sc-interp" id="espece">Espèce fictive · agile</span></div>
<script>
var fiches = { Aldo: { espece: 'Espèce fictive · agile' }, Berta: { espece: 'Espèce fictive · discrète' } };
var courant = 'Aldo';
function montre(qui) {
  if (courant === qui) return;
  document.getElementById('nom').textContent = qui;
  document.getElementById('espece').textContent = fiches[qui].espece;
  courant = qui;
}
document.getElementById('bA').addEventListener('click', function () { montre('Aldo'); });
document.getElementById('bB').addEventListener('click', function () { montre('Berta'); });
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

  // ---------- 1. remplacer l'espèce d'Aldo ----------
  await p.click('#mText');
  await p.waitForTimeout(300);
  await fr.locator('#espece').click();
  await p.waitForTimeout(300);
  await p.keyboard.press('ControlOrMeta+a');
  await p.keyboard.type('Teckel royal');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(600);
  await p.click('#mView');
  await p.waitForTimeout(400);

  // ---------- 2. aller-retour ULTRA rapide : jamais de placeholder peint ----------
  const flash = await p.evaluate(async () => {
    const d = document.getElementById('frame').contentDocument;
    const lit = () => d.getElementById('espece').textContent.trim();
    const vus = [];
    for (let i = 0; i < 6; i++) {
      d.getElementById('bB').click();          // vague 1 : passe immédiate
      await new Promise(r => setTimeout(r, 5)); // nouvelle tâche, < 30 ms après
      d.getElementById('bA').click();          // vague 2 : le créneau du flash
      await Promise.resolve();                 // microtâches (l'outil) passent
      vus.push(lit());                         // AVANT tout rendu possible
      await new Promise(r => setTimeout(r, 150));
    }
    return vus;
  });
  if (flash.some(v => /Espèce fictive/.test(v)))
    fail('le placeholder aurait été peint : ' + JSON.stringify(flash));
  if (!flash.every(v => v === 'Teckel royal'))
    fail('le texte choisi n’est pas rétabli : ' + JSON.stringify(flash));
  ok('aller-retours rapides : le texte choisi tient, le placeholder n’est jamais peint');
  await fr.locator('#bB').click();
  await p.waitForTimeout(600);
  if ((await fr.locator('#espece').textContent()).trim() !== 'Espèce fictive · discrète')
    fail('Berta n’a plus sa propre espèce');
  ok('l’autre personnage garde bien sa valeur d’origine');

  // ---------- 3. export : même exigence ----------
  await fr.locator('#bA').click();
  await p.waitForTimeout(600);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1500);
  const flashV = await v.evaluate(async () => {
    const lit = () => document.getElementById('espece').textContent.trim();
    const vus = [];
    for (let i = 0; i < 6; i++) {
      document.getElementById('bB').click();
      await new Promise(r => setTimeout(r, 5));
      document.getElementById('bA').click();
      await Promise.resolve();
      vus.push(lit());
      await new Promise(r => setTimeout(r, 150));
    }
    return vus;
  });
  if (flashV.some(x => /Espèce fictive/.test(x)))
    fail('export : le placeholder aurait été peint : ' + JSON.stringify(flashV));
  ok('export : pas de flash non plus dans le fichier livré');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
