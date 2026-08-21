/* La maquette évolue : je reprends le travail fait sur l'ancienne version,
   sur la nouvelle — sans que rien n'atterrisse au mauvais endroit. */
const { chromium } = require('playwright-core');
const path = require('path'), fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = '/root/.claude/uploads/9b61ac52-1242-5681-b4f1-1a84f74cc71a/24ff5115-Pack_NDA__Version_demo__horsligne_1.html';
const PNG = path.resolve(__dirname, 'remplacement.png');
const V1 = path.resolve(__dirname, 'vraie.webm');
const OUT = path.resolve(__dirname, 'v3_travail.html');
const NEUVE = path.resolve(__dirname, 'v4_maquette.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

const res = () => {
  const d = document.getElementById('frame') ? document.getElementById('frame').contentDocument : document;
  const m = {};
  d.querySelectorAll('#rg-assetmap [data-k]').forEach(n => { m[n.getAttribute('data-k')] = (n.getAttribute('src') || '').slice(0, 15); });
  return m;
};

// une « nouvelle version » : deux entrées ajoutées avant Pipo, ce qui décale tout
const src = fs.readFileSync(MAQ, 'utf8');
const ancre = '<img loading=\\"lazy\\" data-k=\\"assets_nda/personnages/pipo/pipo_portrait.png\\"';
if (src.indexOf(ancre) < 0) fail('ancre introuvable dans la maquette');
fs.writeFileSync(NEUVE, src.replace(ancre,
  '<img loading=\\"lazy\\" data-k=\\"assets_nda/personnages/zorro/zorro_portrait.png\\" src=\\"x\\" alt=\\"\\">' +
  '<img loading=\\"lazy\\" data-k=\\"assets_nda/personnages/zorro/zorro_planche_01.jpg\\" src=\\"y\\" alt=\\"\\">' + ancre));

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1500, height: 900 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load|DEMUXER|Media resource/.test(m.text())) errs.push(m.text()); });

  // ---------- 1. du travail sur la version actuelle ----------
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(10000);
  await p.click('#mImg');
  await p.waitForTimeout(2000);
  await p.fill('#galQi', 'rex');
  await p.waitForTimeout(700);
  const i = await p.evaluate(() => [...document.querySelectorAll('#gal .g')]
    .findIndex(t => (t.title || '').indexOf('rex/rex_planche_01') > 0));
  if (i < 0) fail('tuile Rex introuvable');
  await p.locator('#gal .g').nth(i).click();
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', PNG);
  await p.waitForTimeout(1800);
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden')))) await p.click('#cropOk');
  // + une icône d'onglet
  await p.click('#ongletPick');
  await p.setInputFiles('#pickIco', PNG);
  await p.waitForTimeout(900);
  await p.fill('#ongletTitre', 'Starter Pack — Pipo');
  await p.waitForTimeout(900);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const nAvant = await p.$$eval('#list .it', ns => ns.length);
  ok(nAvant + ' retouches faites sur la version actuelle, exportées');
  await p.close();

  // ---------- 2. la nouvelle maquette, vierge ----------
  const p2 = await ctx.newPage();
  p2.on('pageerror', e => errs.push('[v4] ' + e.message));
  await p2.goto('file://' + TOOL);
  await p2.setInputFiles('#pick', NEUVE);
  await p2.waitForSelector('#main:not(.hidden)');
  await p2.waitForTimeout(11000);
  // une reprise peut être proposée : on la refuse pour partir vierge
  p2.on('dialog', d => d.dismiss().catch(() => {}));
  const n0 = await p2.$$eval('#list .it', ns => ns.length);
  ok('nouvelle version ouverte : ' + n0 + ' retouche(s)');

  // ---------- 3. reprendre le travail de l'ancienne ----------
  p2.removeAllListeners('dialog');
  p2.on('dialog', d => d.accept().catch(() => {}));
  await p2.click('#importer');
  await p2.waitForTimeout(300);
  await p2.setInputFiles('#pickImp', OUT);
  await p2.waitForTimeout(2500);
  const n1 = await p2.$$eval('#list .it span', ns => ns.map(x => x.textContent.trim()));
  if (n1.length < 2) fail('retouches reprises : ' + JSON.stringify(n1));
  ok('reprises sur la nouvelle version : ' + JSON.stringify(n1));

  // ---------- 4. et surtout : au BON endroit ----------
  const etat = await p2.evaluate(res);
  const poses = Object.keys(etat).filter(k => etat[k].indexOf('data:image') === 0);
  if (poses.length !== 1) fail('contenus posés : ' + JSON.stringify(poses));
  if (poses[0] !== 'assets_nda/personnages/rex/rex_planche_01.jpg')
    fail('LA RETOUCHE A GLISSÉ : ' + poses[0]);
  ok('la planche de Rex est toujours celle de Rex, malgré les entrées ajoutées');
  const titre = await p2.evaluate(() => document.getElementById('frame').contentDocument.title);
  if (titre !== 'Starter Pack — Pipo') fail('titre d’onglet non repris : ' + titre);
  ok('l’icône et le titre d’onglet sont repris aussi');

  // ---------- 5. export de la nouvelle version ----------
  const [dl2] = await Promise.all([p2.waitForEvent('download'), p2.click('#save')]);
  const FIN = path.resolve(__dirname, 'v4_travail.html');
  await dl2.saveAs(FIN);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + FIN);
  await v.waitForTimeout(11000);
  const fin = await v.evaluate(res);
  const pf = Object.keys(fin).filter(k => fin[k].indexOf('data:image') === 0);
  if (pf.length !== 1 || pf[0] !== 'assets_nda/personnages/rex/rex_planche_01.jpg')
    fail('export de la nouvelle version : ' + JSON.stringify(pf));
  ok('export de la nouvelle version : la retouche est au bon endroit');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
