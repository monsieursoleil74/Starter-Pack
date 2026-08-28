/* Les vidéos « chara lead » : une par personnage, dans la MÊME fenêtre que les
   tutos. Poser celle de Pipo ne doit pas toucher celle de Bruno. */
const { chromium } = require('playwright-core');
const path = require('path');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = '/root/.claude/uploads/9b61ac52-1242-5681-b4f1-1a84f74cc71a/24ff5115-Pack_NDA__Version_demo__horsligne_1.html';
if (!require('fs').existsSync(MAQ)) {
  console.log('SAUTÉ : ce test rejoue un vrai pack déposé dans la session, qui n’est pas versionné.');
  process.exit(0);
}

const V1 = path.resolve(__dirname, 'vraie.webm');
const V2 = path.resolve(__dirname, 'seconde.webm');
const OUT = path.resolve(__dirname, 'maq12_modifiee.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

const reserve = () => {
  const d = document.getElementById('frame') ? document.getElementById('frame').contentDocument : document;
  const m = {};
  d.querySelectorAll('#rg-assetmap video[data-k]').forEach(n => { m[n.getAttribute('data-k')] = n.getAttribute('src') || ''; });
  return m;
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1500, height: 900 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load|DEMUXER|Media resource|MEDIA_ELEMENT/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(10000);
  const fr = p.frameLocator('#frame');

  const av = await p.evaluate(reserve);
  const chara = Object.keys(av).filter(k => /charalead/.test(k));
  if (chara.length < 20) fail('réserve : ' + chara.length + ' charalead');
  ok(chara.length + ' vidéos « chara lead » dans la réserve, une par personnage');

  // choisir un personnage dans la liste, puis ouvrir sa vidéo chara lead
  const choisirPerso = async nom => {
    await p.click('#mView');                       // en aperçu, on navigue normalement
    await p.waitForTimeout(400);
    const t = fr.getByText(nom, { exact: true }).first();
    await t.scrollIntoViewIfNeeded();
    await t.click({ force: true });
    await p.waitForTimeout(1200);
    return p.evaluate(() => {
      const d = document.getElementById('frame').contentDocument;
      const h = [...d.querySelectorAll('div')].find(n => getComputedStyle(n).fontSize === '40px');
      return h ? h.textContent.trim() : '';
    });
  };
  const poserVideo = async fichier => {
    await p.click('#mVid');
    await p.waitForTimeout(600);
    const bt = fr.locator('button', { hasText: 'Sa présentation' }).first();
    await bt.scrollIntoViewIfNeeded();
    await p.waitForTimeout(300);
    await bt.click({ force: true });
    await p.waitForTimeout(1800);
    if (await p.$eval('#askv', e => e.classList.contains('hidden')))
      fail('la fenêtre chara lead n’est pas visée');
    await p.click('#askvFile');
    await p.waitForTimeout(300);
    await p.setInputFiles('#pickVid', fichier);
    await p.waitForTimeout(1800);
    const x = fr.locator('button[aria-label="Fermer"]').first();
    if (await x.count()) await x.click({ force: true });
    await p.waitForTimeout(900);
  };

  // ---------- 1. le personnage affiché par défaut ----------
  await poserVideo(V1);
  let ap = await p.evaluate(reserve);
  let faits = Object.keys(ap).filter(k => ap[k] !== av[k]);
  if (faits.length !== 1) fail('entrées touchées : ' + JSON.stringify(faits));
  if (!/charalead/.test(faits[0])) fail('ce n’est pas une chara lead : ' + faits[0]);
  ok('1re vidéo → ' + faits[0] + ', elle seule');
  const premier = faits[0];
  const rappel1 = await p.$eval('#besoins', e => e.textContent.replace(/\s+/g, ' '));
  if (rappel1.indexOf(premier) < 0) fail('le fichier attendu n’est pas annoncé : ' + rappel1);
  ok('chemin annoncé : ' + premier);

  // ---------- 2. un autre personnage ----------
  const nomB = await choisirPerso('Bruno');
  if (!/Bruno/i.test(nomB)) fail('le personnage affiché n’est pas Bruno : ' + nomB);
  await poserVideo(V2);
  ap = await p.evaluate(reserve);
  faits = Object.keys(ap).filter(k => ap[k] !== av[k]);
  if (faits.length !== 2) fail('après le 2e : ' + JSON.stringify(faits));
  const bruno = faits.find(k => /bruno/.test(k));
  if (!bruno) fail('la chara lead de Bruno n’a pas été touchée : ' + JSON.stringify(faits));
  ok('2e vidéo → ' + bruno + ' ; la première est intacte');

  const n = await p.$$eval('#list .it span', ns => ns.map(e => e.textContent.trim()));
  if (n.length !== 2) fail('retouches : ' + JSON.stringify(n));
  ok('deux retouches distinctes : ' + JSON.stringify(n));

  // ---------- 3. export : chacun garde la sienne ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(10000);
  const fin = await v.evaluate(reserve);
  if (fin[premier] !== premier) fail('export : ' + premier + ' → ' + fin[premier]);
  if (fin[bruno] !== bruno) fail('export : ' + bruno + ' → ' + fin[bruno]);
  const autres = Object.keys(fin).filter(k => /charalead/.test(k) && fin[k] !== k);
  if (autres.length) fail('export : des chemins ont été modifiés → ' + JSON.stringify(autres));
  ok('export : chaque personnage garde son chemin de vidéo, rien n’est mélangé');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
