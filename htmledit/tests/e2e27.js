/* Liens : donner sa destination à un lien vide, et à un bouton qui n'est pas
   un vrai lien. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_liens.html');
const OUT = path.resolve(__dirname, 'liens_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ressources</title>
<style>body{font-family:sans-serif;padding:24px;background:#1e2a1e;color:#eee}
a,button{display:inline-block;margin:8px;padding:12px 18px;border-radius:10px;
  background:#3a4a3a;color:#dfe;text-decoration:none;border:none;font:inherit}</style></head><body>
<h1>Ressources</h1>
<a href="#" id="board">BOARD — Bible graphique</a>
<a href="https://ancien.example.com" id="review">REVIEW — Outil de review</a>
<button id="drive">DRIVE — Drive du projet</button>
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 850 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1200);
  const fr = p.frameLocator('#frame');

  if (!(await p.$('#mLink'))) fail('pas de mode Liens');
  await p.click('#mLink');
  await p.waitForTimeout(600);

  // ---------- 1. la liste montre les liens et signale ceux qui sont vides ----------
  const lignes = await p.$$eval('#lnks .lk', ns => ns.map(n => n.textContent));
  if (lignes.length !== 2) fail('liens listés : ' + lignes.length);
  const info = await p.$eval('#lnkInfo', e => e.textContent);
  if (!/1 sans adresse/.test(info)) fail('les liens vides ne sont pas comptés : ' + info);
  ok('liste des liens : ' + lignes.length + ' entrées, ' + info.replace(/\s+/g, ' ').slice(0, 46));

  // ---------- 2. donner une adresse à un lien vide ----------
  await p.click('#lnks .lk:nth-child(1)');
  await p.waitForTimeout(500);
  if (await p.$eval('#askl', e => e.classList.contains('hidden'))) fail('pas de fenêtre de saisie');
  if (await p.$eval('#asklUrl', e => e.value) !== '') fail('le champ devrait être vide');
  await p.fill('#asklUrl', 'https://drive.google.com/board');
  await p.click('#asklOk');
  await p.waitForTimeout(500);
  const h1 = await fr.locator('#board').getAttribute('href');
  const t1 = await fr.locator('#board').getAttribute('target');
  if (h1 !== 'https://drive.google.com/board') fail('href posé : ' + h1);
  if (t1 !== '_blank') fail('nouvel onglet non appliqué');
  ok('lien vide : adresse posée, ouverture dans un nouvel onglet');

  // ---------- 3. modifier un lien existant, sans nouvel onglet ----------
  await fr.locator('#review').click();
  await p.waitForTimeout(500);
  if (await p.$eval('#asklUrl', e => e.value) !== 'https://ancien.example.com')
    fail('l’adresse actuelle n’est pas reprise');
  await p.fill('#asklUrl', 'https://review.studio.fr');
  await p.uncheck('#asklBlank');
  await p.click('#asklOk');
  await p.waitForTimeout(500);
  const h2 = await fr.locator('#review').getAttribute('href');
  const t2 = await fr.locator('#review').getAttribute('target');
  if (h2 !== 'https://review.studio.fr') fail('href modifié : ' + h2);
  if (t2) fail('target aurait dû être retiré');
  ok('lien existant : adresse reprise puis modifiée, choix du nouvel onglet respecté');

  // ---------- 4. un bouton qui n'est pas un lien ----------
  await fr.locator('#drive').click();
  await p.waitForTimeout(500);
  const quoi = await p.$eval('#asklWhat', e => e.textContent);
  if (!/pas de lien d’origine/.test(quoi)) fail('message inattendu : ' + quoi);
  const CIBLE = 'file://' + MAQ;   // adresse joignable hors ligne, pour tester l'ouverture
  await p.fill('#asklUrl', CIBLE);
  await p.click('#asklOk');
  await p.waitForTimeout(500);
  const dl = await fr.locator('#drive').evaluate(n => n.dataset.pkLink);
  if (dl !== CIBLE) fail('bouton non branché : ' + dl);
  ok('bouton sans href : un clic ouvrira l’adresse');

  // ---------- 5. l'export rejoue tout, et le clic marche vraiment ----------
  const [d] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await d.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1200);
  const fin = await v.evaluate(() => ({
    board: document.getElementById('board').getAttribute('href'),
    boardT: document.getElementById('board').getAttribute('target'),
    review: document.getElementById('review').getAttribute('href'),
    drive: document.getElementById('drive').dataset.pkLink
  }));
  if (fin.board !== 'https://drive.google.com/board' || fin.boardT !== '_blank') fail('export board : ' + JSON.stringify(fin));
  if (fin.review !== 'https://review.studio.fr') fail('export review : ' + fin.review);
  if (fin.drive !== CIBLE) fail('export drive : ' + fin.drive);
  // le bouton ouvre-t-il vraiment une nouvelle fenêtre ?
  const [popup] = await Promise.all([
    v.waitForEvent('popup', { timeout: 6000 }).catch(() => null),
    v.click('#drive')
  ]);
  if (!popup) fail('le clic sur le bouton n’ouvre rien');
  if (!popup.url().endsWith('maq_liens.html')) fail('ouvre : ' + popup.url());
  await popup.close();
  ok('fichier exporté : les trois destinations en place, et le bouton ouvre bien sa cible');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
