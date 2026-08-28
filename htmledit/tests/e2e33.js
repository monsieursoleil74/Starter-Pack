/* Maquette « à jour » : une entrée de réserve par contenu (portrait par
   personnage, 14 plans de color script, une vidéo par tuto). Chaque
   remplacement doit être isolé, suivre partout, et tenir à l'export. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = '/root/.claude/uploads/9b61ac52-1242-5681-b4f1-1a84f74cc71a/24ff5115-Pack_NDA__Version_demo__horsligne_1.html';
if (!require('fs').existsSync(MAQ)) {
  console.log('SAUTÉ : ce test rejoue un vrai pack déposé dans la session, qui n’est pas versionné.');
  process.exit(0);
}

const PNG = path.resolve(__dirname, 'remplacement.png');
const VID = path.resolve(__dirname, 'vraie.webm');
const OUT = path.resolve(__dirname, 'maq6_modifiee.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

const reserve = () => {
  const d = document.getElementById('frame') ? document.getElementById('frame').contentDocument : document;
  const m = {};
  d.querySelectorAll('#rg-assetmap [data-k]').forEach(n => { m[n.getAttribute('data-k')] = (n.getAttribute('src') || '').slice(0, 22); });
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
  const fr = p.frameLocator('#frame');

  const av = await p.evaluate(reserve);
  const nb = Object.keys(av).length;
  if (nb < 100) fail('réserve incomplète : ' + nb + ' entrées');
  ok('réserve lue : ' + nb + ' entrées distinctes (portraits, planches, color script, vidéos)');

  // ---------- 1. le portrait de Pipo : un par personnage désormais ----------
  await p.click('#mImg');
  await p.waitForTimeout(1200);
  const port = fr.locator('img[src]').filter({ hasNot: p.locator('nothing') });
  const cible = fr.locator('#rg-assetmap').first();      // référence pour le diff
  const portraitPipo = 'assets_nda/personnages/pipo/pipo_portrait.png';
  const portraitBruno = 'assets_nda/personnages/bruno/bruno_portrait.png';
  // on passe par la galerie : la vignette qui porte ce fichier
  // les familles sont repliées : on compte les en-têtes, pas les tuiles
  const idx = await p.evaluate(() => document.querySelectorAll('#gal .hd,#gal .g').length);
  if (!idx) fail('galerie vide');
  // clic direct sur le grand portrait affiché
  const grand = fr.locator('img').filter({ hasText: '' });
  const boite = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const im = [...d.querySelectorAll('img')]
      .map(n => ({ n, r: n.getBoundingClientRect() }))
      .filter(o => o.r.width > 180 && o.r.height > 180)
      .sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height)[0];
    if (!im) return null;
    im.n.scrollIntoView({ block: 'center' });
    const r = im.n.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, alt: im.n.getAttribute('alt') };
  });
  if (!boite) fail('aucun grand visuel trouvé');
  await p.waitForTimeout(600);
  const fb = await p.locator('#frame').boundingBox();
  await p.mouse.click(fb.x + boite.x, fb.y + boite.y);
  await p.waitForTimeout(700);
  if (!(await p.$eval('#askg', e => e.classList.contains('hidden')))) {
    await p.locator('#askgGrid .gi').first().click();
  }
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', PNG);
  await p.waitForTimeout(1200);
  const ap1 = await p.evaluate(reserve);
  const changes = Object.keys(ap1).filter(k => ap1[k] !== av[k]);
  if (!changes.length) fail('aucune entrée de réserve modifiée (visuel : ' + boite.alt + ')');
  if (changes.length > 1) fail('plusieurs entrées touchées d’un coup : ' + JSON.stringify(changes));
  ok('un seul contenu touché : ' + changes[0]);
  if (!(await p.$eval('#askg', e => e.classList.contains('hidden')))) await p.click('#askgNo');

  // ---------- 2. une vidéo de tuto : la maquette annonce son chemin ----------
  await p.click('#mVid');
  await p.waitForTimeout(700);
  const btn = fr.locator('button', { hasText: 'rig' }).first();
  await btn.scrollIntoViewIfNeeded();
  await p.waitForTimeout(400);
  await btn.click({ force: true });
  await p.waitForTimeout(1800);
  if (await p.$eval('#askv', e => e.classList.contains('hidden'))) fail('aucun lecteur visé pour le tuto RIG');
  const quoi = await p.$eval('#askvWhat', e => e.textContent);
  if (!/déjà présent/.test(quoi)) fail('la maquette a pourtant un vrai lecteur : ' + quoi);
  ok('lecteur réel reconnu dans la fenêtre : ' + quoi.trim().slice(0, 60));
  await p.click('#askvFile');
  await p.waitForTimeout(300);
  await p.setInputFiles('#pickVid', VID);
  await p.waitForTimeout(1500);
  const rappel = await p.$eval('#besoins', e => e.classList.contains('hidden') ? '' : e.textContent);
  if (!/assets_nda\/tutos\//.test(rappel))
    fail('l’outil n’a pas repris le chemin attendu par la maquette : ' + rappel.replace(/\s+/g, ' ').slice(0, 90));
  ok('chemin de la maquette respecté → ' + rappel.replace(/\s+/g, ' ').trim().slice(0, 70));
  const litIci = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const v = [...d.querySelectorAll('video')].filter(n => n.getBoundingClientRect().width > 200)[0];
    return v ? v.getAttribute('src').slice(0, 5) : null;
  });
  if (litIci !== 'blob:') fail('la vidéo choisie ne se lit pas dans l’aperçu (' + litIci + ')');
  ok('et la vidéo se lit tout de suite dans l’éditeur, avant même d’être copiée');

  // ---------- 3. export ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const txt = fs.readFileSync(OUT, 'utf8');
  if (txt.indexOf('blob:') >= 0 && /"after":"blob:/.test(txt)) fail('export : une adresse temporaire s’est glissée dedans');
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(10000);
  // les adresses temporaires sont refaites à chaque ouverture : on juge sur le fond
  const fin = await v.evaluate(reserve);
  const posees = Object.keys(fin).filter(k => fin[k].indexOf('data:image') === 0);
  if (posees.length !== 1 || posees[0] !== changes[0])
    fail('export : images posées = ' + JSON.stringify(posees) + ' (une seule attendue : ' + changes[0] + ')');
  ok('export : une seule image posée, la bonne (' + posees[0] + ')');
  if (fin['assets_nda/tutos/rig.mp4'].indexOf('assets_nda/tutos/') !== 0)
    fail('export : la vidéo du tuto ne garde pas le chemin de la maquette (' + fin['assets_nda/tutos/rig.mp4'] + ')');
  ok('export : la vidéo garde le chemin attendu par la maquette, rien n’est embarqué');
  const litLa = await v.evaluate(() => {
    const n = document.querySelector('#rg-assetmap video[data-k$="rig.mp4"]');
    return n ? n.getAttribute('src') : null;
  });
  if (litLa !== 'assets_nda/tutos/rig.mp4') fail('export : source de la vidéo = ' + litLa);
  ok('export : ' + litLa);
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
