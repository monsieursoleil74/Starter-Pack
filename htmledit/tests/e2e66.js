/* Une pastille « RÉF. CHARALEAD » contient l'étiquette ET la valeur. Cliquer
   sur le FOND de la pastille (pas pile sur le texte) prenait le conteneur
   entier : l'étiquette se faisait avaler avec la valeur à la validation.
   Le clic doit viser le texte le plus proche du point cliqué. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_pastille.html');
const OUT = path.resolve(__dirname, 'pastille_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pastille</title>
<style>body{font-family:sans-serif;padding:30px;background:#223;color:#eee}
.pill{display:inline-block;border:1px solid #cbc19b;border-radius:14px;padding:14px 22px;background:#2b2f26}
.etq{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#cbc19b}
.val{display:block;font-size:15px;margin-top:4px}</style></head><body>
<h1>Fiche</h1>
<div class="pill" id="pill">
  <span class="etq" id="etq">Réf. Charalead</span>
  <span class="val" id="val">Prénom Nom</span>
</div>
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

  // ---------- 1. clic sur le FOND de la pastille, à hauteur de la valeur ----------
  await p.click('#mText');
  await p.waitForTimeout(300);
  const b = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const rPill = d.getElementById('pill').getBoundingClientRect();
    const rVal = d.getElementById('val').getBoundingClientRect();
    const f = document.getElementById('frame').getBoundingClientRect();
    // dans la pastille, à droite de la valeur : sur le fond, pas sur le texte
    return { x: f.left + rVal.right + (rPill.right - rVal.right) / 2,
             y: f.top + rVal.top + rVal.height / 2 };
  });
  await p.mouse.click(b.x, b.y);
  await p.waitForTimeout(500);
  const surQuoi = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const e = d.querySelector('[contenteditable="true"]');
    return e ? { id: e.id, txt: e.textContent.trim() } : null;
  });
  if (!surQuoi) fail('l’édition ne démarre pas sur le fond de la pastille');
  if (surQuoi.id !== 'val')
    fail('le clic sur le fond prend « ' + surQuoi.id + ' » (' + surQuoi.txt +
      ') au lieu de la valeur seule — l’étiquette va se faire avaler');
  ok('clic sur le fond de la pastille : c’est la VALEUR seule qui s’édite');

  // ---------- 2. remplacer, valider : l'étiquette reste intacte, séparée ----------
  await p.keyboard.press('ControlOrMeta+a');
  await p.keyboard.type('Solal Smoes');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(600);
  const apres = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    return { etq: d.getElementById('etq') && d.getElementById('etq').textContent.trim(),
             val: d.getElementById('val') && d.getElementById('val').textContent.trim() };
  });
  if (apres.etq !== 'Réf. Charalead' || apres.val !== 'Solal Smoes')
    fail('la pastille est chamboulée : ' + JSON.stringify(apres));
  ok('valeur remplacée, étiquette intacte et toujours séparée');

  // ---------- 3. export ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1200);
  const fin = await v.evaluate(() => ({
    etq: document.getElementById('etq').textContent.trim(),
    val: document.getElementById('val').textContent.trim() }));
  if (fin.etq !== 'Réf. Charalead' || fin.val !== 'Solal Smoes')
    fail('export : ' + JSON.stringify(fin));
  ok('export : étiquette et valeur chacune à sa place');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
