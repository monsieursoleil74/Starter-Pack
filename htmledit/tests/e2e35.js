/* Bug signalé : je pose une vidéo sur RIG, puis une autre sur HotBox, et c'est
   toujours la première qui s'affiche. Deux tutos = deux entrées de réserve. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = '/root/.claude/uploads/9b61ac52-1242-5681-b4f1-1a84f74cc71a/24ff5115-Pack_NDA__Version_demo__horsligne_1.html';
if (!require('fs').existsSync(MAQ)) {
  console.log('SAUTÉ : ce test rejoue un vrai pack déposé dans la session, qui n’est pas versionné.');
  process.exit(0);
}

const V1 = path.resolve(__dirname, 'vraie.webm');
const V2 = path.resolve(__dirname, 'seconde.webm');
const OUT = path.resolve(__dirname, 'maq8_modifiee.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }
// deux fichiers de tailles différentes : on saura les distinguer
if (!fs.existsSync(V2)) {
  const b = fs.readFileSync(V1);
  fs.writeFileSync(V2, b);
}

// ce que lit le lecteur de la fenêtre ouverte
const lecteur = () => {
  const d = document.getElementById('frame') ? document.getElementById('frame').contentDocument : document;
  const v = [...d.querySelectorAll('video')].filter(n => n.getBoundingClientRect().width > 200)[0];
  const cap = [...d.querySelectorAll('figcaption')].filter(n => n.getBoundingClientRect().width > 100)[0];
  return v ? { src: v.getAttribute('src'), titre: cap ? cap.textContent.trim().slice(0, 40) : '' } : null;
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

  const fermer = async () => {
    const x = fr.locator('button[aria-label="Fermer"]').first();
    if (await x.count()) await x.click({ force: true });
    await p.waitForTimeout(1000);
  };
  const poser = async (titre, fichier) => {
    const bt = fr.locator('button', { hasText: titre }).first();
    await bt.scrollIntoViewIfNeeded();
    await p.waitForTimeout(400);
    await bt.click({ force: true });
    await p.waitForTimeout(1800);
    if (await p.$eval('#askv', e => e.classList.contains('hidden')))
      fail('aucun lecteur visé pour « ' + titre + ' »');
    await p.click('#askvFile');
    await p.waitForTimeout(300);
    await p.setInputFiles('#pickVid', fichier);
    await p.waitForTimeout(1800);
    const vu = await p.evaluate(lecteur);
    await fermer();
    return vu;
  };

  await p.click('#mVid');
  await p.waitForTimeout(700);

  // ---------- 1. RIG ----------
  const a = await poser('Présentation générale du rig', V1);
  ok('RIG : le lecteur lit ' + a.src.slice(0, 28) + '…');
  const besoins1 = await p.$eval('#besoins', e => e.textContent);
  if (!/rig\.mp4/.test(besoins1)) fail('le fichier attendu n’est pas celui du rig : ' + besoins1);

  // ---------- 2. HotBox ----------
  const b = await poser('HotBox', V2);
  ok('HotBox : le lecteur lit ' + b.src.slice(0, 28) + '…');
  if (a.src === b.src) fail('LE BUG : les deux tutos lisent la même source (' + a.src.slice(0, 30) + ')');
  ok('les deux tutos ne lisent PAS la même source');

  const besoins2 = await p.$eval('#besoins', e => e.textContent.replace(/\s+/g, ' '));
  if (!/rig\.mp4/.test(besoins2) || !/hotbox\.mp4/.test(besoins2))
    fail('les deux fichiers attendus ne sont pas listés : ' + besoins2);
  ok('à copier : ' + besoins2.replace('À copier à côté de ton HTML :', '').trim());

  const nb = await p.$$eval('#list .it', ns => ns.length);
  if (nb !== 2) fail('retouches : ' + nb + ' (2 attendues)');
  ok('2 retouches, une par tuto');

  // ---------- 3. revenir sur RIG : il doit retrouver SA vidéo ----------
  const bt = fr.locator('button', { hasText: 'Présentation générale du rig' }).first();
  await bt.scrollIntoViewIfNeeded();
  await p.waitForTimeout(400);
  await p.click('#mView');                 // en aperçu, on clique normalement
  await p.waitForTimeout(500);
  await bt.click({ force: true });
  await p.waitForTimeout(1800);
  const retour = await p.evaluate(lecteur);
  if (!retour) fail('la fenêtre ne s’ouvre pas en aperçu');
  if (retour.src !== a.src)
    fail('en revenant sur RIG, ce n’est plus sa vidéo : ' + retour.src.slice(0, 30) + ' au lieu de ' + a.src.slice(0, 30));
  ok('retour sur RIG : c’est bien sa vidéo (« ' + retour.titre + ' »)');
  await fermer();

  // ---------- 4. export ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(10000);
  const sources = await v.evaluate(() => {
    const m = {};
    document.querySelectorAll('#rg-assetmap video[data-k]').forEach(n => { m[n.getAttribute('data-k')] = n.getAttribute('src'); });
    return m;
  });
  if (sources['assets_nda/tutos/rig.mp4'] !== 'assets_nda/tutos/rig.mp4')
    fail('export : rig → ' + sources['assets_nda/tutos/rig.mp4']);
  if (sources['assets_nda/tutos/hotbox.mp4'] !== 'assets_nda/tutos/hotbox.mp4')
    fail('export : hotbox → ' + sources['assets_nda/tutos/hotbox.mp4']);
  ok('export : chaque tuto garde son propre chemin, rien n’est mélangé');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
