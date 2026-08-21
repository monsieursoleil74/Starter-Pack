/* Les cartes « chemin » (animatique, rigs…) affichent un chemin réseau et un
   bouton Copier dont la valeur est CODÉE EN DUR dans la maquette. Éditer le
   chemin en mode Textes doit suffire : le bouton copie ce qui est affiché —
   en Aperçu et dans l'export. La carte non retouchée garde sa valeur d'usine. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_chemins.html');
const OUT = path.resolve(__dirname, 'chemins_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Chemins</title>
<style>body{font-family:sans-serif;padding:30px;background:#eee}
.carte{background:#222;color:#eee;border-radius:12px;padding:18px;margin:12px 0;max-width:640px}
.chemin{font-family:monospace;font-size:13px}</style></head><body>
<h1>Exports</h1>
<div class="carte"><b>ANIMATIQUE</b><br>
  <span class="chemin" id="chAnim">X:\\DEMO\\ANIMATIC\\vieux.mp4</span>
  <button id="cpAnim">Copier le chemin</button></div>
<div class="carte"><b>RIGS</b><br>
  <span class="chemin" id="chRigs">X:\\DEMO\\RIGS\\pack_rigs</span>
  <button id="cpRigs">Copier le chemin</button></div>
<script>
// comme la vraie maquette : la valeur copiée est CODÉE EN DUR
document.getElementById('cpAnim').addEventListener('click', function () {
  navigator.clipboard && navigator.clipboard.writeText('X:\\\\DEMO\\\\ANIMATIC\\\\vieux.mp4');
});
document.getElementById('cpRigs').addEventListener('click', function () {
  navigator.clipboard && navigator.clipboard.writeText('X:\\\\DEMO\\\\RIGS\\\\pack_rigs');
});
<\/script>
</body></html>`);

const NOUVEAU = 'Y:\\PROD\\ANIMATIC\\V12\\montage.mp4';

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1200, height: 700 },
    permissions: ['clipboard-read', 'clipboard-write'] });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/permissions policy/i.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1400);
  const fr = p.frameLocator('#frame');

  // ---------- 1. éditer le chemin de l'animatique en mode Textes ----------
  await fr.locator('#chAnim').click();
  await p.waitForTimeout(300);
  await p.keyboard.press('ControlOrMeta+a');
  await p.keyboard.type(NOUVEAU);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);
  if ((await fr.locator('#chAnim').textContent()).trim() !== NOUVEAU)
    fail('le chemin affiché n’est pas mis à jour');
  ok('chemin de l’animatique réécrit en mode Textes');

  // ---------- 2. Aperçu : « Copier le chemin » copie l'AFFICHÉ ----------
  await p.click('#mView');
  await p.waitForTimeout(400);
  // de VRAIS clics souris : l'API presse-papiers exige un geste utilisateur
  const lire = async (page, frame, sel) => {
    await (frame ? frame.locator(sel) : page.locator(sel)).click();
    await page.waitForTimeout(400);
    return page.evaluate(async () => {
      window.focus();
      try { return await navigator.clipboard.readText(); } catch (e) { return 'ERR ' + e.message; }
    });
  };
  const c1 = await lire(p, fr, '#cpAnim');
  if (c1 !== NOUVEAU)
    fail('Aperçu : le bouton copie encore la valeur d’usine : ' + JSON.stringify(c1));
  ok('Aperçu : « Copier le chemin » copie le chemin retouché');

  // ---------- 2b. remplacer le chemin par un mot SANS barre oblique ----------
  // (le bug terrain : « test » posé sur le chemin, le bouton recopiait l'usine)
  await p.click('#mText');
  await p.waitForTimeout(300);
  await fr.locator('#chAnim').click();
  await p.waitForTimeout(300);
  await p.keyboard.press('ControlOrMeta+a');
  await p.keyboard.type('test');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);
  await p.click('#mView');
  await p.waitForTimeout(400);
  const cT = await lire(p, fr, '#cpAnim');
  if (cT !== 'test')
    fail('Aperçu : un texte sans « \\ » ne débranche plus l’usine : ' + JSON.stringify(cT));
  ok('Aperçu : même un mot simple posé sur un chemin est copié tel quel');
  // on remet le chemin pour la suite
  await p.click('#mText');
  await p.waitForTimeout(300);
  await fr.locator('#chAnim').click();
  await p.waitForTimeout(300);
  await p.keyboard.press('ControlOrMeta+a');
  await p.keyboard.type(NOUVEAU);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);
  await p.click('#mView');
  await p.waitForTimeout(400);
  // (la carte non retouchée utilise l'API moderne, qui refuse dans une iframe
  //  — son comportement d'usine se vérifie sur l'export, plus bas)

  // ---------- 3. export ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const ctx2 = await browser.newContext({ viewport: { width: 1200, height: 700 },
    permissions: ['clipboard-read', 'clipboard-write'] });
  const v = await ctx2.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1500);
  if ((await v.locator('#chAnim').textContent()).trim() !== NOUVEAU)
    fail('export : le chemin affiché n’est pas rejoué');
  const e1 = await lire(v, null, '#cpAnim');
  if (e1 !== NOUVEAU) fail('export : copie encore l’ancien chemin : ' + JSON.stringify(e1));
  ok('export : chemin affiché ET copié = le nouveau');
  const feedback = await v.locator('#cpAnim').textContent();
  if (!/Copié/.test(feedback)) fail('pas de retour visuel sur le bouton : ' + feedback);
  ok('retour visuel « Copié ✓ » sur le bouton');
  const e2 = await lire(v, null, '#cpRigs');
  if (!/RIGS/.test(e2)) fail('export : la carte non retouchée a changé : ' + JSON.stringify(e2));
  ok('export : la carte non retouchée copie toujours sa valeur d’usine');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
