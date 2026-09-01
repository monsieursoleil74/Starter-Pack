/* Un visuel posé voyage à sa taille d'origine : un décor de 2400 px dans un
   cadre de 180 px, et le pack pèse des dizaines de mégaoctets. « Export
   léger » ré-encode chaque visuel à la taille où il s'affiche vraiment, en
   WebP — SAUF les planches, les concepts 2D et les visuels des personnages
   (portraits compris), qui sont le travail lui-même et voyagent toujours en
   pleine qualité. Les visuels allégés restent fins (au moins 1200 px de
   grand côté). Les retouches gardent l'original :
   l'éditeur ne perd rien et un export complet reste possible juste après.
   Usage : node e2e88.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_leger.html');
// attention au nom : le critère « pleine qualité » regarde aussi le nom
// du fichier posé — un visuel d'essai nommé « planche » fausserait tout
const GROS = path.resolve(__dirname, 'e2e88_visuel.png');
const PLEIN = path.resolve(__dirname, 'leger_complet.html');
const LEGER = path.resolve(__dirname, 'leger_allege.html');
const PLEIN2 = path.resolve(__dirname, 'leger_complet2.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }
const mo = (f) => (fs.statSync(f).size / 1048576).toFixed(2) + ' Mo';

fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Planches</title>
<style>body{font-family:sans-serif;background:#1d241d;color:#dfe7df;padding:24px;margin:0}
.carte{width:210px;border:3px solid #6f8f6f;border-radius:20px;padding:12px;text-align:center;
  background:#2a332a}
.slot{width:180px;height:180px;border-radius:14px;background:#232c23;display:flex;
  align-items:center;justify-content:center;overflow:hidden;font-size:11px;opacity:.6}
</style></head><body>
<h1>Fiche de Tito</h1>
<div class="carte" data-p="tito">
  <div class="slot" data-k="assets_nda/personnages/tito/tito_portrait.png">PORTRAIT</div>
  <div class="slot" data-k="assets_nda/personnages/tito/tito_planche_01.png">PLANCHE</div>
  <div class="slot" data-k="assets_nda/decors/decor_01.png">DÉCOR</div>
  <b>Tito</b>
</div>
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1300, height: 850 } });

  // ---------- une grosse planche, comme celles qu'il pose vraiment ----------
  const gen = await ctx.newPage();
  await gen.goto('about:blank');
  const b64 = await gen.evaluate(() => {
    const cv = document.createElement('canvas');
    cv.width = 2400; cv.height = 1800;
    const g = cv.getContext('2d');
    const d = g.createImageData(2400, 1800);
    // du bruit doux : ça pèse comme une vraie image, ça ne se compresse pas à rien
    for (let i = 0; i < d.data.length; i += 4) {
      const x = (i / 4) % 2400, y = Math.floor(i / 4 / 2400);
      d.data[i] = (x / 9 + Math.random() * 40) & 255;
      d.data[i + 1] = (y / 7 + Math.random() * 40) & 255;
      d.data[i + 2] = ((x + y) / 12 + Math.random() * 40) & 255;
      d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    return cv.toDataURL('image/png').split(',')[1];
  });
  fs.writeFileSync(GROS, Buffer.from(b64, 'base64'));
  await gen.close();
  ok('visuel d’essai fabriqué : 2400×1800, ' + mo(GROS));

  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => { if (!/Clipboard|writeText/.test(e.message)) errs.push(e.message); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1300);
  await p.click('#mImg');
  await p.waitForTimeout(400);

  // ---------- poser la MÊME grosse image dans les trois cadres ----------
  for (let iS = 0; iS < 3; iS++) {
    const c = await p.evaluate((j) => {
      const d = document.getElementById('frame').contentDocument;
      const n = d.querySelectorAll('.slot')[j];
      n.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = n.getBoundingClientRect();
      const f = document.getElementById('frame').getBoundingClientRect();
      return { x: f.left + r.left + r.width / 2, y: f.top + r.top + r.height / 2 };
    }, iS);
    await p.mouse.click(c.x, c.y);
    await p.waitForTimeout(700);
    const [ch] = await Promise.all([p.waitForEvent('filechooser'), p.click('#askCover')]);
    await ch.setFiles(GROS);
    await p.waitForTimeout(2500);
    await p.evaluate(() => ['ask', 'askv', 'askl', 'askg', 'askm', 'crop'].forEach((i) => {
      const e = document.getElementById(i); if (e) e.classList.add('hidden'); }));
    await p.waitForTimeout(400);
  }
  if ((await p.$$eval('#list .it', (l) => l.length)) !== 3)
    fail('les trois emplacements n’ont pas chacun leur retouche');

  // ---------- export complet ----------
  const [d1] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await d1.saveAs(PLEIN);
  ok('export complet : ' + mo(PLEIN));

  // ---------- export léger ----------
  if (!(await p.$('#saveLite'))) fail('pas de bouton « Export léger »');
  const [d2] = await Promise.all([
    p.waitForEvent('download', { timeout: 90000 }),
    p.click('#saveLite'),
  ]);
  await d2.saveAs(LEGER);
  ok('export léger  : ' + mo(LEGER));

  const plein = fs.statSync(PLEIN).size, leger = fs.statSync(LEGER).size;
  // seul le DÉCOR s'allège : le portrait et la planche restent entiers
  if (leger > plein * 0.8)
    fail('l’export léger n’allège pas : ' + mo(LEGER) + ' contre ' + mo(PLEIN));
  ok('le fichier est ' + (plein / leger).toFixed(2) + '× plus léger');

  // ---------- le pack allégé montre bien la planche ----------
  const v = await ctx.newPage();
  v.on('pageerror', (e) => errs.push('[allégé] ' + e.message));
  await v.goto('file://' + LEGER);
  await v.waitForTimeout(2500);
  const vu = await v.evaluate(() =>
    [...document.querySelectorAll('.slot')].map((s) =>
      /^url\(/.test(getComputedStyle(s).backgroundImage || '')));
  if (vu.length !== 3 || vu.some((x) => !x))
    fail('le pack allégé n’affiche pas les trois visuels : ' + JSON.stringify(vu));
  ok('le pack allégé affiche les trois visuels');

  // le décor est ré-encodé (mais FIN) ; le portrait et la planche, INTACTS
  const tailleOrig = 'data:image/png;base64,'.length +
    Math.ceil(fs.statSync(GROS).size / 3) * 4;
  const dd = JSON.parse(fs.readFileSync(LEGER, 'utf8')
    .match(/<script id="pack-edit-data"[^>]*>([\s\S]*?)<\/script>/)[1].replace(/<\\\//g, '</'));
  const entree = (mot) => dd.find((x) => (x.k || '').indexOf(mot) >= 0);
  const pPor = entree('portrait'), pPla = entree('planche'), pDec = entree('decor');
  if (!pPor || !pPla || !pDec) fail('une des trois retouches manque dans le pack allégé');
  if (pDec.after.length > 1.6e6)
    fail('le décor du pack allégé pèse encore ' + Math.round(pDec.after.length / 1024) + ' Ko');
  if (pPor.after.length < tailleOrig * 0.95)
    fail('le PORTRAIT (personnage) a été allégé (' + Math.round(pPor.after.length / 1024) +
         ' Ko) — il doit rester en pleine qualité');
  if (pPla.after.length < tailleOrig * 0.95)
    fail('la PLANCHE a été allégée (' + Math.round(pPla.after.length / 1024) + ' Ko) — elle doit rester en pleine qualité');
  if (dd.some((x) => x.leger)) fail('la version allégée ne doit pas voyager à côté de l’originale');
  // et le décor allégé reste FIN : au moins 1200 px de grand côté
  const dim = await v.evaluate((uri) => new Promise((res) => {
    const im = new Image();
    im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => res(null);
    im.src = uri;
  }), pDec.after);
  if (!dim) fail('le décor allégé ne se décode pas');
  if (Math.max(dim.w, dim.h) < 1200)
    fail('le décor allégé est trop pixelisé : ' + dim.w + '×' + dim.h + ' (grand côté < 1200 px)');
  ok('décor ré-encodé à ' + Math.round(pDec.after.length / 1024) + ' Ko en ' + dim.w + '×' + dim.h +
     ' ; portrait et planche intacts (' + Math.round(pPla.after.length / 1024) + ' Ko chacun)');

  // ---------- l'éditeur garde l'original en pleine qualité ----------
  const [d3] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await d3.saveAs(PLEIN2);
  if (Math.abs(fs.statSync(PLEIN2).size - plein) > plein * 0.02)
    fail('après l’export léger, l’export complet a changé de poids : ' + mo(PLEIN2) +
      ' au lieu de ' + mo(PLEIN) + ' — l’original a été abîmé');
  ok('l’éditeur garde l’original : l’export complet refait le même poids (' + mo(PLEIN2) + ')');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
