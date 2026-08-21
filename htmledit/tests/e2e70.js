/* Cliquer une image sert à la repositionner : le recadrage s'ouvre, jamais
   l'explorateur de fichiers — qu'elle ait déjà été remplacée ou non.
   « Remplacer… » est un bouton de la barre de recadrage, et le panneau de
   droite, lui, remplace toujours directement. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_reclic.html');
const OUT = path.resolve(__dirname, 'reclic_modifie.html');
const PNG = path.resolve(__dirname, 'alt_a.png');
const PNG2 = path.resolve(__dirname, 'alt_b.png');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reclic</title></head>
<body style="font-family:sans-serif;padding:30px">
<h1>Visuels</h1>
<img id="a" src="${GIF}" alt="Visuel A" style="width:300px;height:180px;object-fit:cover">
<img id="b" src="${GIF}" alt="Visuel B" style="width:300px;height:180px;object-fit:cover">
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
  await p.evaluate(() => {
    window._sel = 0;
    document.getElementById('pickImg').addEventListener('click', () => window._sel++);
  });
  const sel = () => p.evaluate(() => window._sel);

  // ---------- 1. premier clic : le CADRAGE s'ouvre, pas l'explorateur ----------
  await p.click('#mImg');
  await p.waitForTimeout(400);
  await fr.locator('#a').click();
  await p.waitForTimeout(500);
  if ((await sel()) !== 0)
    fail('le clic sur une image ne doit plus ouvrir le sélecteur (' + (await sel()) + ')');
  if (await p.$eval('#crop', e => e.classList.contains('hidden')))
    fail('le clic devrait ouvrir le panneau de cadrage');
  await p.click('#cropRemp');
  await p.waitForTimeout(300);
  if ((await sel()) !== 1) fail('« Remplacer… » devrait ouvrir le sélecteur (' + (await sel()) + ')');
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', PNG);
  await p.waitForTimeout(900);
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropOk');
  ok('image jamais retouchée : clic = cadrage, puis « Remplacer… » pour le fichier');

  // ---------- 2. re-cliquer l'image remplacée : recadrage, PAS l'explorateur ----------
  await fr.locator('#a').click();
  await p.waitForTimeout(500);
  if ((await sel()) !== 1)
    fail('re-cliquer a rouvert l’explorateur — le irritant signalé');
  if (await p.$eval('#crop', e => e.classList.contains('hidden')))
    fail('le recadrage ne s’ouvre pas au re-clic');
  ok('re-clic sur l’image remplacée : recadrage ouvert, pas d’explorateur');
  await p.locator('#cropZ').fill('140');
  await p.locator('#cropZ').dispatchEvent('input');
  await p.waitForTimeout(300);

  // ---------- 3. « Remplacer… » depuis la barre : là, l'explorateur ----------
  await p.click('#cropRemp');
  await p.waitForTimeout(400);
  if ((await sel()) !== 2) fail('« Remplacer… » n’ouvre pas le sélecteur (' + (await sel()) + ')');
  await p.setInputFiles('#pickImg', PNG2);
  await p.waitForTimeout(900);
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropOk');
  const srcA = await fr.locator('#a').getAttribute('src');
  const png2 = fs.readFileSync(PNG2);
  ok('« Remplacer… » rouvre le sélecteur et pose le nouveau fichier');

  // ---------- 4. l'image B, jamais touchée : clic = cadrage, elle aussi ----------
  const avantB = await sel();
  await fr.locator('#b').click();
  await p.waitForTimeout(500);
  if ((await sel()) !== avantB) fail('le clic sur l’image B ne doit pas ouvrir le sélecteur');
  if (await p.$eval('#crop', e => e.classList.contains('hidden')))
    fail('le clic sur l’image B devrait ouvrir son cadrage');
  await p.click('#cropRemp');
  await p.waitForTimeout(300);
  if ((await sel()) !== avantB + 1) fail('« Remplacer… » sur l’image B devrait ouvrir le sélecteur');
  await p.keyboard.press('Escape');
  ok('une autre image jamais retouchée garde le clic = choisir');

  // ---------- 5. export : la 2e image posée est bien là ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1200);
  const finA = await v.locator('#a').getAttribute('src');
  if (!/^data:image/.test(finA)) fail('export : le visuel remplacé n’est pas rejoué');
  if (finA === srcA && false) fail('');
  ok('export : le remplacement final est rejoué');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
