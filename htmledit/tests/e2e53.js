/* La même fiche affiche l'arc de chaque personnage tour à tour. Éditer l'arc
   de Pipo PUIS celui de Bruno doit donner deux retouches, chacune ne
   s'appliquant que quand SON personnage est affiché — dans l'éditeur comme
   dans le fichier exporté. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_arc.html');
const OUT = path.resolve(__dirname, 'arc_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

const ARCS = { Pipo: 'Pipo apprend à voler de ses propres ailes.',
               Bruno: 'Bruno découvre que la force ne suffit pas.' };
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Arcs</title>
<style>body{font-family:sans-serif;padding:30px;background:#eee}#arc{max-width:400px}</style>
</head><body>
<h1>Fiches personnages</h1>
<button id="bPipo">Pipo</button>
<button id="bBruno">Bruno</button>
<h2 id="nom">Pipo</h2>
<p id="arc">${ARCS.Pipo}</p>
<script>
var arcs = ${JSON.stringify(ARCS)};
function montre(qui) {
  document.getElementById('nom').textContent = qui;
  document.getElementById('arc').textContent = arcs[qui];
}
document.getElementById('bPipo').addEventListener('click', function () { montre('Pipo'); });
document.getElementById('bBruno').addEventListener('click', function () { montre('Bruno'); });
<\/script>
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1200, height: 700 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1200);
  const fr = p.frameLocator('#frame');
  const arc = () => fr.locator('#arc').textContent();

  // ---------- 1. éditer l'arc de Pipo ----------
  await fr.locator('#arc').click();
  await p.waitForTimeout(300);
  await p.keyboard.press('ControlOrMeta+a');
  await p.keyboard.type('Pipo voit trop grand, et grandit.');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);
  if ((await arc()) !== 'Pipo voit trop grand, et grandit.') fail('l’arc de Pipo n’est pas réécrit');
  ok('arc de Pipo réécrit');

  // ---------- 2. passer à Bruno (Aperçu) : SON arc doit rester le sien ----------
  await p.click('#mView');
  await p.waitForTimeout(300);
  await fr.locator('#bBruno').click();
  await p.waitForTimeout(800);
  const arcBruno = await arc();
  if (arcBruno !== ARCS.Bruno)
    fail('l’arc de Pipo a écrasé celui de Bruno : « ' + arcBruno + ' »');
  ok('la fiche de Bruno garde SON arc d’origine');

  // ---------- 3. éditer l'arc de Bruno : deux retouches distinctes ----------
  await p.click('#mText');
  await p.waitForTimeout(300);
  await fr.locator('#arc').click();
  await p.waitForTimeout(300);
  await p.keyboard.press('ControlOrMeta+a');
  await p.keyboard.type('Bruno apprend la douceur.');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);
  const n = await p.$$eval('#list .it span', ns => ns.map(x => x.textContent.trim()));
  if (n.length !== 2)
    fail('l’arc de Bruno a écrasé la retouche de Pipo — ' + n.length + ' retouche(s) : ' + JSON.stringify(n));
  ok('deux retouches distinctes : ' + JSON.stringify(n));

  // ---------- 4. dans l'éditeur, chaque personnage montre le sien ----------
  await p.click('#mView');
  await p.waitForTimeout(300);
  await fr.locator('#bPipo').click();
  await p.waitForTimeout(900);
  if ((await arc()) !== 'Pipo voit trop grand, et grandit.')
    fail('retour sur Pipo : son arc réécrit est perdu (« ' + (await arc()) + ' »)');
  await fr.locator('#bBruno').click();
  await p.waitForTimeout(900);
  if ((await arc()) !== 'Bruno apprend la douceur.')
    fail('Bruno n’a pas son arc réécrit (« ' + (await arc()) + ' »)');
  ok('chaque personnage montre SON arc réécrit, en direct dans l’éditeur');

  // re-éditer l'arc de Pipo ne crée pas de 3e retouche
  await fr.locator('#bPipo').click();
  await p.waitForTimeout(700);
  await p.click('#mText');
  await p.waitForTimeout(300);
  await fr.locator('#arc').click();
  await p.waitForTimeout(300);
  await p.keyboard.press('ControlOrMeta+a');
  await p.keyboard.type('Pipo, version finale.');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);
  const n2 = await p.$$eval('#list .it', ns => ns.length);
  if (n2 !== 2) fail('rééditer Pipo aurait dû remplacer sa retouche, pas en créer (' + n2 + ')');
  ok('rééditer l’arc de Pipo remplace sa retouche, sans doublon');

  // ---------- 5. export : chacun garde le sien, en naviguant ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1500);
  const lire = () => v.evaluate(() => document.getElementById('arc').textContent);
  if ((await lire()) !== 'Pipo, version finale.')
    fail('export : l’arc de Pipo au départ = « ' + (await lire()) + ' »');
  await v.click('#bBruno');
  await v.waitForTimeout(1400);
  if ((await lire()) !== 'Bruno apprend la douceur.')
    fail('export : l’arc de Bruno = « ' + (await lire()) + ' »');
  await v.click('#bPipo');
  await v.waitForTimeout(1400);
  if ((await lire()) !== 'Pipo, version finale.')
    fail('export : au retour sur Pipo = « ' + (await lire()) + ' »');
  ok('export : chaque personnage garde son arc réécrit en naviguant');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
