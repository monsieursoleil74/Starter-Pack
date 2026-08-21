/* Deux bugs signalés sur la vraie maquette :
   1. une seule fenêtre vidéo pour tous les boutons — la 2e vidéo écrasait la 1re
   2. en mode Aperçu, cliquer un lien de menu renvoyait à l'écran d'import */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = '/root/.claude/uploads/9b61ac52-1242-5681-b4f1-1a84f74cc71a/642b4870-Pack_NDA__Version_demo__horsligne_1.html';
const V1 = path.resolve(__dirname, 'vraie.webm');
const V2 = path.resolve(__dirname, 'vraie2.webm');
const OUT = path.resolve(__dirname, 'maq5_modifiee.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }
if (!fs.existsSync(V2)) fs.copyFileSync(V1, V2);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1500, height: 900 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load|DEMUXER/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(8000);
  const fr = p.frameLocator('#frame');

  // ---------- 1. mode Aperçu : un lien de menu ne doit pas quitter la page ----------
  await p.click('#mView');
  await p.waitForTimeout(400);
  await fr.getByText('Tutoriels', { exact: true }).first().click();
  await p.waitForTimeout(1500);
  const perdu = await p.evaluate(() => {
    const f = document.getElementById('frame');
    let dedans = false;
    try { dedans = !!f.contentDocument && !!f.contentDocument.querySelector('#rg-assetmap'); } catch (e) {}
    return { home: !document.getElementById('home').classList.contains('hidden'), dedans: dedans };
  });
  if (perdu.home) fail('l’outil est revenu à l’écran d’import');
  if (!perdu.dedans) fail('la maquette a disparu du cadre : le lien a fait quitter l’aperçu');
  ok('mode Aperçu : le lien de menu ne fait plus quitter la page');
  const scroll = await p.evaluate(() => {
    const f = document.getElementById('frame');
    return f.contentWindow.scrollY;
  });
  if (scroll < 200) fail('le lien n’a pas fait défiler jusqu’à la section (' + scroll + ')');
  ok('et il fait bien défiler jusqu’à la section (y=' + Math.round(scroll) + ')');

  // ---------- 2. deux vidéos sur la même fenêtre, une par bouton ----------
  await p.click('#mVid');
  await p.waitForTimeout(600);
  const poser = async (titre, fichier) => {
    const bt = fr.locator('button', { hasText: titre }).first();
    await bt.scrollIntoViewIfNeeded();
    await p.waitForTimeout(300);
    await bt.click({ force: true });
    await p.waitForTimeout(1600);           // l'outil ouvre la fenêtre puis vise
    if (await p.$eval('#askv', e => e.classList.contains('hidden')))
      fail('aucune fenêtre visée pour « ' + titre + ' »');
    const quoi = await p.$eval('#askvWhat', e => e.textContent);
    await p.click('#askvEmbed');
    await p.waitForTimeout(300);
    await p.setInputFiles('#pickVid', fichier);
    await p.waitForTimeout(1500);
    // refermer la fenêtre de la maquette (Échap irait à l'outil, pas à la page)
    await fr.locator('button[aria-label="Fermer"]').first().click({ force: true });
    await p.waitForTimeout(900);
    return quoi;
  };
  const q1 = await poser('Présentation générale du rig', V1);
  if (!/plusieurs boutons/.test(q1)) fail('l’outil ne signale pas la fenêtre partagée : ' + q1);
  ok('fenêtre partagée détectée et annoncée : ' + q1.replace(/\s+/g, ' ').slice(-70));
  await poser('Outil de contrainte', V2);
  const n = await p.$$eval('#list .it', ns => ns.length);
  if (n !== 2) fail('retouches enregistrées : ' + n + ' (2 attendues — une par bouton)');
  ok('les deux vidéos coexistent : ' + n + ' retouches');
  const labels = await p.$$eval('#list .it span', ns => ns.map(e => e.textContent.trim()));
  if (!labels.some(l => /Présentation/i.test(l)) || !labels.some(l => /contrainte/i.test(l)))
    fail('les retouches ne disent pas à quel bouton elles sont : ' + JSON.stringify(labels));
  ok('chaque retouche dit son bouton : ' + JSON.stringify(labels));

  // ---------- 3. export : chaque bouton ouvre SA vidéo ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(9000);
  const lire = async titre => {
    await v.locator('button', { hasText: titre }).first().scrollIntoViewIfNeeded();
    await v.locator('button', { hasText: titre }).first().click({ force: true });
    await v.waitForTimeout(1400);
    const r = await v.evaluate(() => {
      const vs = [...document.querySelectorAll('video.pk-vid')].filter(n => n.getBoundingClientRect().width > 50);
      return { n: vs.length, src: vs.length ? vs[0].getAttribute('src').slice(0, 40) : null };
    });
    await v.locator('button[aria-label="Fermer"]').first().click({ force: true });
    await v.waitForTimeout(800);
    return r;
  };
  const r1 = await lire('Présentation générale du rig');
  const r2 = await lire('Outil de contrainte');
  if (!r1.src) fail('export : aucune vidéo pour le 1er bouton');
  if (!r2.src) fail('export : aucune vidéo pour le 2e bouton');
  if (r1.n > 1 || r2.n > 1) fail('export : plusieurs lecteurs empilés dans la fenêtre');
  ok('export : chaque bouton ouvre un lecteur, un seul à la fois');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
