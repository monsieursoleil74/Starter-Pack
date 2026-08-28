/* La liste des images doit être RANGÉE : les visuels d'un personnage ensemble
   sous son nom, les sections sous le leur — et cliquer une tuile doit retoucher
   le bon contenu, lui seul. */
const { chromium } = require('playwright-core');
const path = require('path');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = '/root/.claude/uploads/9b61ac52-1242-5681-b4f1-1a84f74cc71a/24ff5115-Pack_NDA__Version_demo__horsligne_1.html';
if (!require('fs').existsSync(MAQ)) {
  console.log('SAUTÉ : ce test rejoue un vrai pack déposé dans la session, qui n’est pas versionné.');
  process.exit(0);
}

const PNG = path.resolve(__dirname, 'remplacement.png');
const OUT = path.resolve(__dirname, 'maq11_modifiee.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

const res = () => {
  const d = document.getElementById('frame') ? document.getElementById('frame').contentDocument : document;
  const m = {};
  d.querySelectorAll('#rg-assetmap [data-k]').forEach(n => { m[n.getAttribute('data-k')] = n.getAttribute('src') || ''; });
  return m;
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1500, height: 900 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load|DEMUXER|Media resource/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(10000);
  await p.click('#mImg');
  await p.waitForTimeout(2500);

  // ---------- 0. tout est replié : la liste tient à l'écran ----------
  const depart = await p.evaluate(() => ({
    entetes: document.querySelectorAll('#gal .hd').length,
    tuiles: document.querySelectorAll('#gal .g').length,
    recherche: !document.getElementById('galQ').classList.contains('hidden')
  }));
  if (depart.entetes < 20) fail('familles affichées : ' + depart.entetes);
  if (depart.tuiles) fail('les familles devraient être repliées au départ (' + depart.tuiles + ' tuiles)');
  if (!depart.recherche) fail('pas de champ de recherche');
  ok('à l’ouverture : ' + depart.entetes + ' familles repliées, un champ de recherche');

  // dérouler Rex
  await p.locator('#gal .hd', { hasText: 'Rex' }).first().click();
  await p.waitForTimeout(700);
  const ouvert = await p.evaluate(() => document.querySelectorAll('#gal .g').length);
  if (ouvert !== 5) fail('Rex déplié : ' + ouvert + ' tuiles (5 attendues)');
  ok('un clic sur « Rex » déplie ses 5 visuels, les autres restent rangés');

  // la recherche va droit au but
  await p.fill('#galQi', 'color script');
  await p.waitForTimeout(600);
  const cherche = await p.evaluate(() => ({
    fams: [...document.querySelectorAll('#gal .hd')].map(n => n.textContent.replace(/\s+/g, ' ').trim()),
    tuiles: document.querySelectorAll('#gal .g').length
  }));
  if (cherche.fams.length !== 1 || cherche.tuiles !== 14)
    fail('recherche « color script » : ' + JSON.stringify(cherche));
  ok('recherche « color script » → 1 famille, ses 14 plans dépliés');

  await p.fill('#galQi', 'zzzz');
  await p.waitForTimeout(500);
  const rien = await p.$eval('#galVide', e => e.classList.contains('hidden') ? '' : e.textContent);
  if (!/Rien qui corresponde/.test(rien)) fail('recherche sans résultat : ' + JSON.stringify(rien));
  ok('recherche sans résultat : « ' + rien + ' »');
  await p.click('#galQx');
  await p.waitForTimeout(600);

  // ---------- 1. tout est rangé, plus rien « en vrac » ----------
  const vue = await p.evaluate(() => {
    const g = [...document.querySelectorAll('#gal > *')];
    const groupes = [];
    let cur = null;
    g.forEach(n => {
      if (n.classList.contains('hd')) { cur = { titre: n.textContent, tuiles: [] }; groupes.push(cur); }
      else if (cur) cur.tuiles.push({ nom: n.querySelector('.nm').textContent, fichier: (n.title.split('\n')[1] || '') });
      else groupes.push({ titre: '(SANS GROUPE)', tuiles: [{ nom: n.querySelector('.nm').textContent, fichier: '' }] });
    });
    return { info: document.getElementById('galInfo').textContent, groupes };
  });
  const orphelins = vue.groupes.filter(g => g.titre === '(SANS GROUPE)');
  if (orphelins.length) fail(orphelins.length + ' vignette(s) hors de tout groupe');
  ok('aucune image en vrac : ' + vue.groupes.length + ' familles');

  // ---------- 2. un personnage = ses 5 visuels sous son nom ----------
  const rex = vue.groupes.find(g => /^Rex/.test(g.titre));
  if (!rex) fail('pas de famille « Rex » : ' + JSON.stringify(vue.groupes.map(g => g.titre)));
  if (rex.tuiles.length !== 5) fail('Rex : ' + rex.tuiles.length + ' visuels (déplié attendu)');
  if (!rex.tuiles.every(t => /personnages\/rex\//.test(t.fichier)))
    fail('des visuels étrangers chez Rex : ' + JSON.stringify(rex.tuiles));
  ok(rex.titre + ' → ' + rex.tuiles.map(t => t.nom).join(', '));

  // ---------- 3. les sections aussi ----------
  // (Rex a été déplié plus haut, ses tuiles sont donc listées)
  const attendus = ['Color script', 'Décors', 'Logos', 'Bannière'];
  const manque = attendus.filter(a => !vue.groupes.some(g => g.titre.indexOf(a) === 0));
  if (manque.length) fail('sections manquantes : ' + JSON.stringify(manque) + ' — vu : ' + JSON.stringify(vue.groupes.map(g => g.titre)));
  ok('sections rangées : ' + vue.groupes.filter(g => attendus.some(a => g.titre.indexOf(a) === 0)).map(g => g.titre).join(' · '));

  // ---------- 4. cliquer la tuile « Planche 01 » de Rex retouche CE fichier ----------
  let idx = await p.evaluate(() => {
    const tuiles = [...document.querySelectorAll('#gal .g')];
    return tuiles.findIndex(t => (t.title || '').indexOf('personnages/rex/rex_planche_01') > 0);
  });
  if (idx < 0) {
    await p.locator('#gal .hd', { hasText: 'Rex' }).first().click();
    await p.waitForTimeout(700);
    idx = await p.evaluate(() => {
      const tuiles = [...document.querySelectorAll('#gal .g')];
      return tuiles.findIndex(t => (t.title || '').indexOf('personnages/rex/rex_planche_01') > 0);
    });
  }
  if (idx < 0) fail('tuile « Rex / Planche 01 » introuvable');
  await p.locator('#gal .g').nth(idx).click();
  await p.waitForTimeout(600);
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', PNG);
  await p.waitForTimeout(1800);
  const ap = await p.evaluate(res);
  const faits = Object.keys(ap).filter(k => ap[k].indexOf('data:image') === 0);
  if (faits.length !== 1) fail('contenus touchés : ' + JSON.stringify(faits));
  if (faits[0] !== 'assets_nda/personnages/rex/rex_planche_01.jpg') fail('mauvais contenu : ' + faits[0]);
  ok('clic sur la tuile → ' + faits[0] + ' remplacé, lui seul');

  const lab = await p.$eval('#list', e => e.textContent);
  if (!/rex_planche_01/.test(lab)) fail('la retouche ne nomme pas le fichier : ' + lab.trim());
  ok('retouche nommée : ' + lab.replace(/\s+/g, ' ').trim().slice(0, 56));

  // ---------- 5. export ----------
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden')))) await p.click('#cropOk');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(10000);
  const fin = await v.evaluate(res);
  const posees = Object.keys(fin).filter(k => fin[k].indexOf('data:image') === 0);
  if (posees.length !== 1 || posees[0] !== 'assets_nda/personnages/rex/rex_planche_01.jpg')
    fail('export : ' + JSON.stringify(posees));
  ok('export : seule la planche 01 de Rex est remplacée');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
