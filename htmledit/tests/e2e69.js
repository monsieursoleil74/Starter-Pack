/* Les pastilles rondes (réf. animation : img 44×44, border-radius 50%) : y
   poser une image puis zoomer ne doit JAMAIS changer la taille du rond — le
   zoom passe par object-view-box, pas par transform:scale. Les images
   ordinaires gardent leur zoom habituel. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_rond.html');
const OUT = path.resolve(__dirname, 'rond_modifie.html');
const PNG = path.resolve(__dirname, 'alt_a.png');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rond</title></head>
<body style="font-family:sans-serif;padding:30px">
<h1>Réf. animation</h1>
<span style="display:inline-flex;align-items:center;gap:9px">
  <img id="rond" src="${GIF}" alt="Référence animation 01"
    style="flex:none;width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid #E7B877">
  <span>Référence 01 · À définir</span>
</span>
<div style="margin-top:30px"><img id="grande" src="${GIF}" alt="Planche"
  style="width:320px;height:200px;object-fit:cover"></div>
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
  const mesure = (sel) => p.evaluate((s) => {
    const d = document.getElementById('frame').contentDocument;
    const n = d.querySelector(s);
    const r = n.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height),
      tr: d.defaultView.getComputedStyle(n).transform, ovb: n.style.objectViewBox || '' };
  }, sel);

  const avant = await mesure('#rond');
  // ---------- 1. poser une image dans le rond, zoomer : le rond ne bouge pas ----------
  await p.click('#mImg');
  await p.waitForTimeout(400);
  await fr.locator('#rond').click();
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', PNG);
  await p.waitForTimeout(900);
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropOk');
  await p.locator('#list .it button[title^="Recadrer"]').first().click();
  await p.waitForTimeout(500);
  await p.locator('#cropZ').fill('160');
  await p.locator('#cropZ').dispatchEvent('input');
  await p.waitForTimeout(400);
  await p.click('#cropOk');
  await p.waitForTimeout(500);
  const m1 = await mesure('#rond');
  if (m1.w !== avant.w || m1.h !== avant.h)
    fail('le rond a changé de taille : ' + JSON.stringify(m1) + ' vs ' + JSON.stringify(avant));
  if (m1.tr !== 'none') fail('le rond porte un transform:scale : ' + m1.tr);
  if (!/inset/.test(m1.ovb)) fail('le zoom (object-view-box) n’est pas posé : ' + JSON.stringify(m1));
  ok('rond : taille conservée (' + m1.w + '×' + m1.h + '), zoom par object-view-box, pas de transform');

  // ---------- 2. une image ordinaire garde son zoom habituel ----------
  await p.click('#mImg');
  await p.waitForTimeout(300);
  await fr.locator('#grande').click();
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', PNG);
  await p.waitForTimeout(900);
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropOk');
  await p.locator('#list .it button[title^="Recadrer"]').last().click();
  await p.waitForTimeout(500);
  await p.locator('#cropZ').fill('150');
  await p.locator('#cropZ').dispatchEvent('input');
  await p.waitForTimeout(400);
  await p.click('#cropOk');
  await p.waitForTimeout(500);
  const m2 = await mesure('#grande');
  if (!/matrix/.test(m2.tr) && !/inset/.test(m2.ovb))
    fail('l’image ordinaire ne zoome plus du tout : ' + JSON.stringify(m2));
  ok('l’image ordinaire zoome toujours (' + (/matrix/.test(m2.tr) ? 'transform' : 'view-box') + ')');

  // ---------- 3. export : le rond reste rond, zoom compris ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1500);
  const fin = await v.evaluate(() => {
    const n = document.getElementById('rond');
    const r = n.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height),
      tr: getComputedStyle(n).transform, ovb: n.style.objectViewBox || '',
      src: (n.getAttribute('src') || '').slice(0, 10) };
  });
  if (fin.src !== 'data:image') fail('export : l’image du rond n’est pas rejouée');
  if (fin.w !== avant.w || fin.h !== avant.h || fin.tr !== 'none')
    fail('export : le rond a bougé : ' + JSON.stringify(fin) + ' vs ' + JSON.stringify(avant));
  if (!/inset/.test(fin.ovb)) fail('export : le zoom du rond est perdu : ' + JSON.stringify(fin));
  ok('export : taille du rond conservée, zoom conservé, pas de transform');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
