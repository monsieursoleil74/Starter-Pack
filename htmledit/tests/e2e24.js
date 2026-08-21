/* Carrousel : les images empilées au même endroit doivent toutes être
   remplaçables, via la liste des images de la page. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_carousel.html');
const IMG1 = path.resolve(__dirname, 'rempl1.png');
const IMG2 = path.resolve(__dirname, 'rempl2.png');
const OUT = path.resolve(__dirname, 'carousel_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

// carrousel : 3 images superposées, une seule visible (comme la vraie maquette)
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Carrousel</title>
<style>body{font-family:sans-serif;padding:20px}
.car{position:relative;width:420px;height:240px;background:#ddd}
.car img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:.2s}
.car img.on{opacity:1}</style></head><body>
<h1>Planches</h1>
<div class="car">
  <img alt="Planche 1" src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==">
  <img alt="Planche 2" src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==">
  <img alt="Planche 3" class="on" src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==">
</div></body></html>`);
const png = n => Buffer.from(n === 1
  ? 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII='
  : 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEUAAP//AAD/DjBBAAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII=', 'base64');
fs.writeFileSync(IMG1, png(1));
fs.writeFileSync(IMG2, png(2));

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

  // ---------- 1. la liste montre les 3 images empilées ----------
  await p.click('#mImg');
  await p.waitForTimeout(700);
  // l'infobulle porte aussi le chemin et le rappel du glisser-déposer :
  // le libellé, c'est la première ligne
  const tiles = await p.$$eval('#gal .g', ns => ns.map(n => n.title.split('\n')[0]));
  if (tiles.length !== 3) fail('images listées : ' + tiles.length + ' (' + tiles.join(', ') + ')');
  if (tiles.join('|') !== 'Planche 1|Planche 2|Planche 3') fail('libellés : ' + tiles.join('|'));
  ok('la liste montre les 3 images du carrousel : ' + tiles.join(', '));

  // ---------- 2. remplacer une image cachée sous la pile ----------
  const avant = await fr.locator('.car img').nth(0).getAttribute('src');
  await p.locator('#gal .g').nth(0).click();
  await p.waitForTimeout(400);
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', IMG1);
  await p.waitForTimeout(700);
  const apres = await fr.locator('.car img').nth(0).getAttribute('src');
  if (apres === avant) fail('l’image 1 (cachée) n’a pas changé');
  if (apres.indexOf('data:image/png') !== 0) fail('src inattendu : ' + apres.slice(0, 24));
  ok('image cachée sous la pile : remplacée');

  // ---------- 3. une deuxième, distincte ----------
  await p.locator('#gal .g').nth(1).click();
  await p.waitForTimeout(400);
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', IMG2);
  await p.waitForTimeout(700);
  const srcs = await fr.locator('.car img').evaluateAll(ns => ns.map(n => n.getAttribute('src')));
  if (srcs[0] === srcs[1]) fail('les deux remplacements ont donné la même image');
  if (srcs[2] === srcs[0] || srcs[2] === srcs[1]) fail('la 3e image a été touchée par erreur');
  ok('chaque image de la pile garde son propre remplacement');
  const done = await p.$$eval('#gal .g.done', ns => ns.length);
  if (done !== 2) fail('vignettes marquées ✓ : ' + done);
  ok('la liste marque les images déjà remplacées (' + done + ')');

  // ---------- 4. l'export rejoue les deux ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1200);
  const fin = await v.evaluate(() => [].slice.call(document.querySelectorAll('.car img'))
    .map(n => n.getAttribute('src')));
  if (fin[0].indexOf('data:image/png') !== 0 || fin[1].indexOf('data:image/png') !== 0)
    fail('export : remplacements absents ' + JSON.stringify(fin));
  if (fin[0] === fin[1]) fail('export : les deux images sont devenues identiques');
  ok('fichier exporté : les deux images du carrousel sont bien distinctes');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
