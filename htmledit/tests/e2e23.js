/* Éditeur HTML : remplacer textes et images d'une maquette, exporter,
   redéposer l'export pour continuer. Testé sur une maquette simple ET sur la
   vraie maquette « bundlée » (DOM construit par script au chargement). */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_simple.html');
const PNG = path.resolve(__dirname, 'remplacement.png');
const BUNDLE = '/root/.claude/uploads/9b61ac52-1242-5681-b4f1-1a84f74cc71a/2c26c800-Pack_NDA__Version_demo__horsligne.html';

const OUT = path.resolve(__dirname, 'maq_modifiee.html');
const OUT2 = path.resolve(__dirname, 'maq_modifiee2.html');
const OUTB = path.resolve(__dirname, 'bundle_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

// une maquette qui construit une partie de son DOM par script, comme une vraie
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ma maquette</title>
<style>body{font-family:sans-serif;padding:30px}h1{color:#b33}
.hero{width:320px;height:120px;background-image:url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=");background-color:#eee}</style>
</head><body>
<h1>Titre original</h1>
<p class="intro">Texte d'introduction original.</p>
<img id="logo" alt="logo" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" width="80" height="60">
<div class="hero"></div>
<script>
  var d = document.createElement('p');
  d.id = 'dyn';
  d.textContent = 'Bloc ajouté par script';
  document.body.appendChild(d);
</script>
</body></html>`);

// une image de remplacement reconnaissable
fs.writeFileSync(PNG, Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII=',
  'base64'));

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 850 } });
  const errs = [];
  const watch = (p, t) => {
    p.on('pageerror', e => errs.push(t + ' ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(t + ' ' + m.text()); });
  };

  const p = await ctx.newPage();
  watch(p, '[outil]');
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1500);
  const fr = p.frameLocator('#frame');

  // ---------- 1. réécrire un texte ----------
  if (await p.$eval('#mText', e => !e.classList.contains('on'))) fail('le mode Textes n’est pas actif au départ');
  await fr.locator('h1').click();
  await p.waitForTimeout(300);
  await p.keyboard.press('Control+a');
  await p.keyboard.type('Starter Pack Ringo');
  await fr.locator('p.intro').click();     // clic ailleurs = validation
  await p.waitForTimeout(400);
  const h1 = await fr.locator('h1').textContent();
  if (h1 !== 'Starter Pack Ringo') fail('titre non réécrit : ' + h1);
  const n1 = await p.$$eval('#list .it', ns => ns.length);
  if (n1 !== 1) fail('retouches listées : ' + n1);
  ok('texte réécrit dans la page et listé dans les retouches');

  // un texte construit par script est éditable aussi
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  await fr.locator('#dyn').click();
  await p.waitForTimeout(300);
  await p.keyboard.press('Control+a');
  await p.keyboard.type('Bloc réécrit');
  await fr.locator('h1').click();
  await p.waitForTimeout(400);
  if (await fr.locator('#dyn').textContent() !== 'Bloc réécrit') fail('le bloc dynamique n’a pas été réécrit');
  ok('même un bloc créé par script se réécrit');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // ---------- 2. remplacer une image ----------
  await p.click('#mImg');
  await p.waitForTimeout(300);
  const avant = await fr.locator('#logo').getAttribute('src');
  await Promise.all([
    p.waitForTimeout(200),
    fr.locator('#logo').click()
  ]);
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', PNG);
  await p.waitForTimeout(600);
  const apres = await fr.locator('#logo').getAttribute('src');
  if (apres === avant) fail('l’image n’a pas changé');
  if (apres.indexOf('data:image/png') !== 0) fail('src inattendu : ' + apres.slice(0, 30));
  ok('image remplacée par un fichier du disque (embarqué dans la page)');

  // ---------- 3. export ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const nom = dl.suggestedFilename();
  if (!/modifie\.html$/.test(nom)) fail('nom du fichier exporté : ' + nom);
  const outTxt = fs.readFileSync(OUT, 'utf8');
  if (outTxt.indexOf('Titre original') < 0) fail('le fichier exporté ne contient plus la page d’origine');
  if (outTxt.indexOf('pack-edit-data') < 0) fail('pas de correctif dans l’export');
  ok('export : page d’origine intacte + correctif ajouté (' + nom + ')');

  // ---------- 4. le fichier exporté s'ouvre déjà modifié ----------
  const v = await ctx.newPage();
  watch(v, '[export]');
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1200);
  const vu = await v.evaluate(() => ({
    h1: document.querySelector('h1').textContent,
    dyn: document.getElementById('dyn') ? document.getElementById('dyn').textContent : null,
    img: document.getElementById('logo').src.slice(0, 14)
  }));
  if (vu.h1 !== 'Starter Pack Ringo') fail('titre pas rejoué : ' + vu.h1);
  if (vu.dyn !== 'Bloc réécrit') fail('bloc dynamique pas rejoué : ' + vu.dyn);
  if (vu.img !== 'data:image/png') fail('image pas rejouée : ' + vu.img);
  ok('le fichier exporté s’ouvre avec toutes les retouches, y compris sur le contenu dynamique');
  await v.close();

  // ---------- 5. redéposer l'export pour continuer ----------
  const p2 = await ctx.newPage();
  watch(p2, '[reprise]');
  await p2.goto('file://' + TOOL);
  await p2.setInputFiles('#pick', OUT);
  await p2.waitForSelector('#main:not(.hidden)');
  await p2.waitForTimeout(1500);
  const reprises = await p2.$$eval('#list .it', ns => ns.length);
  if (reprises !== 3) fail('retouches reprises : ' + reprises + ' (3 attendues)');
  const fr2 = p2.frameLocator('#frame');
  if (await fr2.locator('h1').textContent() !== 'Starter Pack Ringo') fail('la reprise n’affiche pas les retouches');
  ok('le fichier exporté se redépose : ' + reprises + ' retouches retrouvées');

  // une retouche de plus, puis ré-export : pas d'empilement de correctifs
  await fr2.locator('p.intro').click();
  await p2.waitForTimeout(300);
  await p2.keyboard.press('Control+a');
  await p2.keyboard.type('Nouvelle intro');
  await fr2.locator('h1').click();
  await p2.waitForTimeout(400);
  const [dl2] = await Promise.all([p2.waitForEvent('download'), p2.click('#save')]);
  await dl2.saveAs(OUT2);
  const t2 = fs.readFileSync(OUT2, 'utf8');
  const nbBlocs = (t2.match(/<!--pack-edit-->/g) || []).length;
  if (nbBlocs !== 1) fail('correctifs empilés : ' + nbBlocs);
  if ((t2.match(/id="pack-edit-data"/g) || []).length !== 1) fail('plusieurs balises de données');
  const v2 = await ctx.newPage();
  watch(v2, '[export2]');
  await v2.goto('file://' + OUT2);
  await v2.waitForTimeout(1200);
  const t2vu = await v2.evaluate(() => document.querySelector('p.intro').textContent);
  if (t2vu !== 'Nouvelle intro') fail('2e passe non appliquée : ' + t2vu);
  ok('2e passe : un seul correctif dans le fichier, tout est appliqué');
  await v2.close();

  // ---------- 6. la vraie maquette bundlée ----------
  if (fs.existsSync(BUNDLE)) {
    const p3 = await ctx.newPage();
    watch(p3, '[bundle]');
    await p3.goto('file://' + TOOL);
    await p3.setInputFiles('#pick', BUNDLE);
    await p3.waitForSelector('#main:not(.hidden)');
    await p3.waitForTimeout(6000);
    const fr3 = p3.frameLocator('#frame');
    const h2 = fr3.locator('h2').first();
    const avantTxt = (await h2.textContent()).trim();
    await h2.click();
    await p3.waitForTimeout(400);
    await p3.keyboard.press('Control+a');
    await p3.keyboard.type('Titre remplacé');
    await fr3.locator('body').click({ position: { x: 5, y: 5 } });
    await p3.waitForTimeout(500);
    const apresTxt = (await h2.textContent()).trim();
    if (apresTxt !== 'Titre remplacé') fail('maquette bundlée : titre non réécrit (' + avantTxt + ' → ' + apresTxt + ')');
    const [dl3] = await Promise.all([p3.waitForEvent('download'), p3.click('#save')]);
    await dl3.saveAs(OUTB);
    const v3 = await ctx.newPage();
    watch(v3, '[bundle-export]');
    await v3.goto('file://' + OUTB);
    await v3.waitForTimeout(7000);
    const vuB = await v3.evaluate(() => {
      const h = document.querySelector('h2');
      return h ? h.textContent.trim() : null;
    });
    if (vuB !== 'Titre remplacé') fail('maquette bundlée exportée : retouche absente (' + vuB + ')');
    ok('maquette réelle (page reconstruite par script) : retouche appliquée et rejouée à l’export');
    await v3.close();
  } else {
    console.log('   (maquette réelle absente, étape sautée)');
  }

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
