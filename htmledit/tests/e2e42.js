/* Sauvegarde de secours : si le navigateur ferme en cours de travail, on doit
   pouvoir reprendre — page d'origine ET retouches, sans redéposer le fichier. */
const { chromium } = require('playwright-core');
const path = require('path');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_simple.html');
const PNG = path.resolve(__dirname, 'remplacement.png');
const OUT = path.resolve(__dirname, 'secours_modifie.html');

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
  const fr = p.frameLocator('#frame');

  // ---------- 1. du travail : un texte et une image ----------
  await fr.locator('h1').click();
  await p.waitForTimeout(300);
  await p.keyboard.press('Control+a');
  await p.keyboard.type('Titre du pack');
  await fr.locator('p.intro').click();
  await p.waitForTimeout(400);
  await p.keyboard.press('Escape');
  await p.click('#mImg');
  await p.waitForTimeout(400);
  await fr.locator('#logo').click();
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', PNG);
  await p.waitForTimeout(1200);
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden')))) await p.click('#cropOk');
  const n0 = await p.$$eval('#list .it', ns => ns.length);
  if (n0 < 2) fail('retouches faites : ' + n0);
  await p.waitForTimeout(1800);         // le temps que la sauvegarde parte
  const etat = await p.$eval('#etat', e => e.textContent.trim());
  if (!/sauvegard/.test(etat)) fail('rien n’indique la sauvegarde : « ' + etat + ' »');
  ok(n0 + ' retouches, et l’outil affiche « ' + etat + ' »');

  // ---------- 2. le navigateur ferme brutalement : nouvel onglet ----------
  await p.close();
  const p2 = await ctx.newPage();
  p2.on('pageerror', e => errs.push('[reprise] ' + e.message));
  await p2.goto('file://' + TOOL);
  await p2.waitForTimeout(1500);
  if (await p2.$eval('#reprise', e => e.classList.contains('hidden')))
    fail('aucune proposition de reprise après réouverture');
  const quoi = await p2.$eval('#repriseQuoi', e => e.textContent);
  const quand = await p2.$eval('#repriseQuand', e => e.textContent);
  if (!/maq_simple/.test(quoi)) fail('mauvais fichier proposé : ' + quoi);
  if (!/retouche/.test(quand)) fail('pas de détail : ' + quand);
  ok('à la réouverture : « ' + quoi + ' — ' + quand + ' »');

  // ---------- 3. reprendre : tout revient, sans redéposer le fichier ----------
  await p2.click('#repriseOui');
  await p2.waitForSelector('#main:not(.hidden)');
  await p2.waitForTimeout(2000);
  const n1 = await p2.$$eval('#list .it', ns => ns.length);
  if (n1 !== n0) fail('retouches reprises : ' + n1 + ' au lieu de ' + n0);
  const fr2 = p2.frameLocator('#frame');
  const titre = await fr2.locator('h1').textContent();
  if (titre !== 'Titre du pack') fail('la page reprise n’a pas la retouche : ' + titre);
  const img = await fr2.locator('#logo').getAttribute('src');
  if (img.indexOf('data:image/png') !== 0) fail('image reprise : ' + img.slice(0, 24));
  ok('travail repris : ' + n1 + ' retouches, page d’origine et images comprises');

  // ---------- 4. et l'export marche depuis la reprise ----------
  const [dl] = await Promise.all([p2.waitForEvent('download'), p2.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1200);
  const fin = await v.evaluate(() => ({
    h1: document.querySelector('h1').textContent,
    img: document.getElementById('logo').getAttribute('src').slice(0, 14)
  }));
  if (fin.h1 !== 'Titre du pack' || fin.img !== 'data:image/png')
    fail('export depuis la reprise : ' + JSON.stringify(fin));
  ok('export depuis le travail repris : identique');
  await v.close();

  // ---------- 5. « Oublier » efface la sauvegarde ----------
  const p3 = await ctx.newPage();
  await p3.goto('file://' + TOOL);
  await p3.waitForTimeout(1500);
  if (await p3.$eval('#reprise', e => e.classList.contains('hidden'))) fail('la reprise a disparu trop tôt');
  await p3.click('#repriseNon');
  await p3.waitForTimeout(800);
  const p4 = await ctx.newPage();
  await p4.goto('file://' + TOOL);
  await p4.waitForTimeout(1500);
  if (!(await p4.$eval('#reprise', e => e.classList.contains('hidden'))))
    fail('« Oublier » n’a pas effacé la sauvegarde');
  ok('« Oublier » efface la sauvegarde pour de bon');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
