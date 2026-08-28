/* Un visuel posé voyage à sa taille d'origine : une planche de 2400 px dans
   un cadre de 180 px, et le pack pèse des dizaines de mégaoctets. « Export
   léger » ré-encode chaque visuel à la taille où il s'affiche vraiment, en
   WebP. Les retouches, elles, gardent l'original : l'éditeur ne perd rien et
   un export complet reste possible juste après.
   Usage : node e2e88.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_leger.html');
const GROS = path.resolve(__dirname, 'e2e88_planche.png');
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
<h1>Planches</h1>
<div class="carte" data-p="tito">
  <div class="slot" data-k="assets/tito_portrait.png">PORTRAIT</div>
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
  ok('planche d’essai fabriquée : 2400×1800, ' + mo(GROS));

  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => { if (!/Clipboard|writeText/.test(e.message)) errs.push(e.message); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1300);
  await p.click('#mImg');
  await p.waitForTimeout(400);

  // ---------- poser la planche dans le petit cadre ----------
  const c = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const n = d.querySelector('.slot');
    n.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = n.getBoundingClientRect();
    const f = document.getElementById('frame').getBoundingClientRect();
    return { x: f.left + r.left + r.width / 2, y: f.top + r.top + r.height / 2 };
  });
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(700);
  const [ch] = await Promise.all([p.waitForEvent('filechooser'), p.click('#askCover')]);
  await ch.setFiles(GROS);
  await p.waitForTimeout(2500);
  await p.evaluate(() => ['ask', 'askv', 'askl', 'askg', 'askm', 'crop'].forEach((i) => {
    const e = document.getElementById(i); if (e) e.classList.add('hidden'); }));
  await p.waitForTimeout(400);

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
  if (leger > plein / 3)
    fail('l’export léger n’allège pas assez : ' + mo(LEGER) + ' contre ' + mo(PLEIN));
  ok('le fichier est ' + (plein / leger).toFixed(1) + '× plus léger');

  // ---------- le pack allégé montre bien la planche ----------
  const v = await ctx.newPage();
  v.on('pageerror', (e) => errs.push('[allégé] ' + e.message));
  await v.goto('file://' + LEGER);
  await v.waitForTimeout(2500);
  const vu = await v.evaluate(() => {
    const s = document.querySelector('.slot');
    const st = getComputedStyle(s);
    return { fond: (st.backgroundImage || '').slice(0, 16), taille: st.backgroundSize };
  });
  if (!/^url\(/.test(vu.fond)) fail('le pack allégé n’affiche pas la planche : ' + JSON.stringify(vu));
  ok('le pack allégé affiche bien la planche (' + vu.taille + ')');

  // le visuel embarqué est bien ré-encodé, et petit
  const dd = JSON.parse(fs.readFileSync(LEGER, 'utf8')
    .match(/<script id="pack-edit-data"[^>]*>([\s\S]*?)<\/script>/)[1].replace(/<\\\//g, '</'));
  const pl = dd.find((x) => /^data:image\//.test(x.after || ''));
  if (!pl) fail('le pack allégé ne porte plus de visuel');
  if (pl.after.length > plein / 4)
    fail('le visuel du pack allégé pèse encore ' + Math.round(pl.after.length / 1024) + ' Ko');
  if (dd.some((x) => x.leger)) fail('la version allégée ne doit pas voyager à côté de l’originale');
  ok('visuel ré-encodé à ' + Math.round(pl.after.length / 1024) + ' Ko, rien en double dans le bloc');

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
