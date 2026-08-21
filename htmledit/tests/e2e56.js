/* Frictions carrousel : 1) un recadrage fait sur la vignette ne doit PAS
   suivre dans l'agrandissement ; 2) re-remplacer la même planche depuis le
   panneau ne doit pas faire retomber l'affichage sur le proto. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_frictions.html');
const OUT = path.resolve(__dirname, 'frictions_modifie.html');
const LARGE = path.resolve(__dirname, 'large.png');
const A = path.resolve(__dirname, 'fr_a.png');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

let TAB = null;
function crc32(buf) {
  if (!TAB) { TAB = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; TAB[n] = c >>> 0; } }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = TAB[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function png(r, g, b) {
  const W = 8, H = 8;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) { raw[y * (1 + W * 3)] = 0;
    for (let x = 0; x < W; x++) { const o = y * (1 + W * 3) + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; } }
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t, 'ascii'), d]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
fs.writeFileSync(A, png(20, 160, 220));
const b64A = fs.readFileSync(A).toString('base64');

const VIDE = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Frictions</title>
<style>body{font-family:sans-serif;padding:20px;background:#eee}
#rg-assetmap{display:none}
.mini{width:180px;height:120px;object-fit:cover;background:#ccd;margin:4px}
#lb{position:fixed;inset:0;background:rgba(0,0,0,.85);display:none;align-items:center;justify-content:center}
#lb.on{display:flex}#lb img{max-width:80vw;max-height:80vh}</style></head><body>
<h1>Planches Bruno</h1>
<div id="rg-assetmap">
<img data-k="assets_nda/personnages/bruno/bruno_planche_01.png" src="${VIDE}#b1">
<img data-k="assets_nda/personnages/bruno/bruno_planche_02.png" src="${VIDE}#b2">
<img data-k="assets_nda/personnages/pipo/pipo_planche_01.png" src="${VIDE}#p1">
</div>
<div id="planches"></div>
<div id="lb"><img alt="" src=""></div>
<script>
var table = {};
document.querySelectorAll('#rg-assetmap [data-k]').forEach(function (n) {
  table[n.getAttribute('src')] = n.getAttribute('data-k');
});
var pl = document.getElementById('planches');
Object.keys(table).forEach(function (s) {
  var im = document.createElement('img');
  im.className = 'mini'; im.src = s; im.alt = table[s].split('/').pop();
  pl.appendChild(im);
});
pl.addEventListener('click', function (e) {
  if (e.target.tagName !== 'IMG') return;
  var quoi = table[e.target.getAttribute('src')];
  var lb = document.getElementById('lb');
  lb.querySelector('img').src = e.target.getAttribute('src');
  lb.querySelector('img').alt = quoi || 'INCONNU';
  lb.classList.add('on');
});
document.getElementById('lb').addEventListener('click', function () { this.classList.remove('on'); });
<\/script>
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1300, height: 800 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1800);
  const fr = p.frameLocator('#frame');
  await p.click('#mImg');
  await p.waitForTimeout(1200);

  // ---------- 1. remplacer la planche 01 (image LARGE) et la recadrer/zoomer ----------
  const tuile = () => p.evaluate(() => {
    const t = [...document.querySelectorAll('#gal .g')]
      .find(n => (n.dataset.k || '').indexOf('bruno_planche_01') >= 0);
    if (t) t.id = 'tuile01';
    return !!t;
  });
  if (!(await tuile())) fail('tuile bruno_planche_01 introuvable');
  await p.click('#tuile01');
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', LARGE);
  await p.waitForTimeout(1400);
  if (await p.$eval('#crop', e => e.classList.contains('hidden')))
    fail('le recadrage ne s’ouvre pas (image large dans un cadre 3:2)');
  await p.locator('#cropZ').fill('180');
  await p.locator('#cropZ').dispatchEvent('input');
  await p.waitForTimeout(300);
  await p.click('#cropOk');
  await p.waitForTimeout(400);
  const mini = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const m = [...d.querySelectorAll('#planches img')].find(n => /planche_01/.test(n.alt));
    return { tr: m.style.transform, vue: /url\("data:image\/png/.test(d.defaultView.getComputedStyle(m).content) };
  });
  if (!mini.vue) fail('la vignette ne montre pas le remplacement');
  if (!/scale\(1\.8\)/.test(mini.tr)) fail('le zoom n’est pas appliqué à la vignette : ' + mini.tr);
  ok('planche remplacée et zoomée à 180 % dans sa vignette');

  // ---------- 2. l'agrandissement montre l'image ENTIÈRE, pas zoomée ----------
  await p.click('#mView');
  await p.waitForTimeout(400);
  await fr.locator('#planches img').first().click();
  await p.waitForTimeout(700);
  const lb = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const l = d.getElementById('lb');
    const im = l.querySelector('img');
    return { on: l.classList.contains('on'), alt: im.alt,
             tr: im.style.transform || '', pos: im.style.objectPosition || '',
             vue: /url\("data:image\/png/.test(d.defaultView.getComputedStyle(im).content) };
  });
  if (!lb.on) fail('le lightbox ne s’ouvre pas');
  if (!/planche_01/.test(lb.alt)) fail('le lightbox ouvre la mauvaise planche : ' + lb.alt);
  if (!lb.vue) fail('le lightbox ne montre pas le remplacement');
  if (/scale/.test(lb.tr) || lb.pos)
    fail('LE BUG : le zoom de la vignette a suivi dans l’agrandissement (' + lb.tr + ' / ' + lb.pos + ')');
  ok('l’agrandissement montre l’image entière — le zoom de la vignette ne le pollue pas');
  await fr.locator('#lb').click();
  await p.waitForTimeout(300);

  // ---------- 3. RE-remplacer la même planche depuis le panneau ----------
  await p.click('#mImg');
  await p.waitForTimeout(700);
  if (!(await tuile())) fail('tuile bruno_planche_01 introuvable au 2e passage');
  await p.click('#tuile01');
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', A);
  await p.waitForTimeout(1400);
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden')))) await p.click('#cropOk');
  const re = await p.evaluate((b64A) => {
    const d = document.getElementById('frame').contentDocument;
    const m = [...d.querySelectorAll('#planches img')].find(n => /planche_01/.test(n.alt));
    const c = d.defaultView.getComputedStyle(m).content;
    return { proto: m.getAttribute('src').indexOf('data:image/gif') === 0 && c === 'normal',
             nouvelle: c.indexOf(b64A.slice(0, 40)) >= 0,
             src: m.getAttribute('src').slice(0, 22) };
  }, b64A);
  if (re.proto) fail('LE BUG : le re-remplacement fait retomber la vignette sur le proto');
  if (!re.nouvelle) fail('la vignette ne montre pas la NOUVELLE image : ' + JSON.stringify(re));
  ok('re-remplacer depuis le panneau : la vignette passe à la nouvelle image, pas de retour proto');
  const nb = await p.$$eval('#list .it', ns => ns.length);
  if (nb !== 1) fail('le re-remplacement a créé ' + nb + ' retouches au lieu de remplacer');
  ok('une seule retouche : le re-remplacement a remplacé la précédente');

  // ---------- 4. export : nouvelle image, lightbox sain ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1800);
  const fin = await v.evaluate((b64A) => {
    const m = [...document.querySelectorAll('#planches img')].find(n => /planche_01/.test(n.alt));
    m.click();
    const im = document.getElementById('lb').querySelector('img');
    return {
      vignette: getComputedStyle(m).content.indexOf(b64A.slice(0, 40)) >= 0,
      lbAlt: im.alt,
      lbVue: getComputedStyle(im).content.indexOf(b64A.slice(0, 40)) >= 0,
      lbTr: im.style.transform || ''
    };
  }, b64A);
  if (!fin.vignette) fail('export : la vignette ne montre pas la dernière image');
  if (!/planche_01/.test(fin.lbAlt)) fail('export : lightbox sur la mauvaise planche (' + fin.lbAlt + ')');
  if (!fin.lbVue) fail('export : le lightbox ne montre pas la dernière image');
  if (/scale/.test(fin.lbTr)) fail('export : le zoom a fui dans le lightbox');
  ok('export : dernière image partout, lightbox juste et non zoomé');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
