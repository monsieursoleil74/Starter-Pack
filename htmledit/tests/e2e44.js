/* Le mémo intégré, les raccourcis clavier, l'état vide et le poids estimé. */
const { chromium } = require('playwright-core');
const path = require('path');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_simple.html');
const PNG = path.resolve(__dirname, 'large.png');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 900 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1500);

  // ---------- 1. l'état vide dit quoi faire ----------
  const vide = await p.$eval('#vide', e => e.classList.contains('hidden') ? '' : e.textContent);
  if (!/Clique un texte/.test(vide)) fail('pas d’état vide utile : ' + JSON.stringify(vide));
  ok('liste vide → « ' + vide.slice(0, 58) + '… »');

  // ---------- 2. le poids estimé ----------
  const p0 = await p.$eval('#poids', e => e.textContent.trim());
  if (!/≈/.test(p0)) fail('pas de poids estimé : ' + JSON.stringify(p0));
  await p.click('#mImg');
  await p.waitForTimeout(400);
  await p.frameLocator('#frame').locator('#logo').click();
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', PNG);
  await p.waitForTimeout(1200);
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden')))) await p.click('#cropOk');
  const p1 = await p.$eval('#poids', e => e.textContent.trim());
  if (p1 === p0) fail('le poids n’a pas bougé après une image : ' + p1);
  ok('poids estimé affiché et mis à jour : ' + p0 + ' → ' + p1);

  // ---------- 3. les raccourcis de mode ----------
  await p.keyboard.press('3');
  await p.waitForTimeout(400);
  if (!(await p.$eval('#mVid', e => e.classList.contains('on')))) fail('la touche 3 ne passe pas en Vidéos');
  await p.keyboard.press('1');
  await p.waitForTimeout(400);
  if (!(await p.$eval('#mText', e => e.classList.contains('on')))) fail('la touche 1 ne passe pas en Textes');
  ok('les touches 1 à 5 changent de mode');

  // ---------- 4. un raccourci ne doit pas gêner la saisie ----------
  const fr = p.frameLocator('#frame');
  await fr.locator('h1').click();
  await p.waitForTimeout(400);
  await p.keyboard.press('Control+a');
  await p.keyboard.type('Titre 3 étoiles');
  await fr.locator('p.intro').click();
  await p.waitForTimeout(500);
  const t = await fr.locator('h1').textContent();
  if (t !== 'Titre 3 étoiles') fail('la frappe a été détournée : ' + t);
  if (!(await p.$eval('#mText', e => e.classList.contains('on')))) fail('le mode a changé pendant la saisie');
  ok('taper « 3 » dans un texte écrit un 3, ça ne change pas de mode');
  await p.keyboard.press('Escape');

  // ---------- 5. le mémo ----------
  await p.keyboard.press('?');
  await p.waitForTimeout(500);
  if (await p.$eval('#aideBoite', e => e.classList.contains('hidden'))) fail('la touche ? n’ouvre pas le mémo');
  const modes = await p.$$eval('#aideCorps .li b', ns => ns.map(n => n.textContent));
  const touches = await p.$$eval('#aideCorps .tou kbd', ns => ns.map(n => n.textContent));
  if (modes.length < 8) fail('mémo incomplet : ' + JSON.stringify(modes));
  if (!touches.length) fail('pas de raccourcis listés');
  ok('mémo : ' + modes.join(' · '));
  ok('raccourcis listés : ' + touches.join(' '));
  const lien = await p.$eval('#aideCorps a', e => e.getAttribute('href'));
  if (!/README/.test(lien)) fail('pas de lien vers le manuel : ' + lien);
  ok('renvoi vers le manuel complet');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  if (!(await p.$eval('#aideBoite', e => e.classList.contains('hidden')))) fail('Échap ne referme pas le mémo');
  await p.click('#aide');
  await p.waitForTimeout(400);
  if (await p.$eval('#aideBoite', e => e.classList.contains('hidden'))) fail('le bouton d’aide n’ouvre pas le mémo');
  await p.click('#aideNon');
  ok('le mémo s’ouvre au bouton comme à la touche, et se referme');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
