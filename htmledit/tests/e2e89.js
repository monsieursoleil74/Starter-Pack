/* Trois gênes du mode Image, corrigées ensemble :
   1. cadrage ouvert = molette confisquée PARTOUT : impossible de faire
      défiler la page pour aller retoucher un autre visuel. Désormais la
      molette ne zoome que SUR l'image cadrée ; ailleurs elle défile, et un
      clic sur un autre visuel bascule le cadrage dessus.
   2. zoom borné à 100 % : une image trop grande pour son cadre ne pouvait
      pas être dézoomée. Le zoom descend maintenant à 25 %.
   3. l'entrée en mode Image dessinait une vignette pour CHAQUE image de la
      page, d'un coup : plusieurs secondes de gel sur un vrai pack. Les
      vignettes se dessinent quand leur tuile approche de l'écran.
   Usage : node e2e89.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_molette.html');
const MAQ2 = path.resolve(__dirname, 'maq_lagimg.html');
const OUT = path.resolve(__dirname, 'molette_export.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1300, height: 850 } });

  // ---------- fichiers d'appui ----------
  const gen = await ctx.newPage();
  await gen.goto('about:blank');
  // les images vivent DANS la maquette (data URI), comme dans les vrais packs
  const uriDe = {};
  for (const [nom, coul] of [['a', '#2b6cb0'], ['b', '#b02b6c']]) {
    const b64 = await gen.evaluate((c) => {
      const cv = document.createElement('canvas');
      cv.width = 420; cv.height = 140;
      const g = cv.getContext('2d');
      g.fillStyle = c; g.fillRect(0, 0, 420, 140);
      for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(i * 14, (i * 37) % 120, 8, 8); }
      return cv.toDataURL('image/png').split(',')[1];
    }, coul);
    uriDe[nom] = 'data:image/png;base64,' + b64;
  }
  // 72 images toutes différentes : chaque vignette exige son propre décodage
  const uris = await gen.evaluate(() => {
    const out = [];
    const cv = document.createElement('canvas');
    cv.width = 1600; cv.height = 1200;
    const g = cv.getContext('2d');
    for (let k = 0; k < 72; k++) {
      g.fillStyle = 'hsl(' + (k * 5) + ',60%,40%)';
      g.fillRect(0, 0, 1600, 1200);
      for (let i = 0; i < 400; i++) {
        g.fillStyle = 'hsla(' + ((k * 7 + i * 13) % 360) + ',70%,60%,.5)';
        g.fillRect((i * 137 + k * 31) % 1500, (i * 89 + k * 17) % 1100, 90, 70);
      }
      out.push(cv.toDataURL('image/jpeg', 0.85));
    }
    return out;
  });
  await gen.close();
  let corps = '';
  for (let s = 0; s < 12; s++) {
    corps += '<section><h2>Section ' + s + '</h2>';
    for (let i = 0; i < 6; i++)
      corps += '<img src="' + uris[s * 6 + i] + '" alt="Visuel ' + s + '-' + i +
               '" style="width:160px;height:120px;object-fit:cover">';
    corps += '</section>';
  }
  fs.writeFileSync(MAQ2, '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Beaucoup</title></head>' +
    '<body style="font-family:sans-serif">' + corps + '</body></html>');

  fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Molette</title>
<style>body{font-family:sans-serif;background:#1d241d;color:#dfe7df;padding:24px;margin:0}
.cadre{width:180px;height:180px;overflow:hidden;border-radius:14px;background:#232c23}
.cadre img{width:180px;height:180px;object-fit:cover;display:block}
</style></head><body>
<h1>Planches</h1>
<div class="cadre"><img id="imgA" src="${uriDe.a}" alt="Planche A"></div>
<div style="height:1300px"></div>
<div class="cadre"><img id="imgB" src="${uriDe.b}" alt="Planche B"></div>
<div style="height:400px"></div>
</body></html>`);

  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => { if (!/Clipboard|writeText/.test(e.message)) errs.push(e.message); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1300);
  await p.click('#mImg');
  await p.waitForTimeout(400);

  const pos = (id) => p.evaluate((q) => {
    const d = document.getElementById('frame').contentDocument;
    const n = d.getElementById(q);
    const r = n.getBoundingClientRect();
    const f = document.getElementById('frame').getBoundingClientRect();
    return { x: f.left + r.left + r.width / 2, y: f.top + r.top + r.height / 2,
             visible: r.top >= 0 && r.bottom <= f.height };
  }, id);
  const cropOuvert = () => p.$eval('#crop', (e) => !e.classList.contains('hidden'));
  const quiCadre = () => p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const n = [...d.querySelectorAll('img')].find((x) => x.style.cursor === 'move');
    return n ? n.getAttribute('alt') : null;
  });
  const scrollY = () => p.evaluate(() =>
    document.getElementById('frame').contentDocument.defaultView.scrollY);
  // l'échelle effective, quelle que soit la méthode : transform (zoom > 1)
  // ou vue élargie object-view-box (dézoom < 1)
  const lireEchelle = `(function (n) {
    const t = getComputedStyle(n).transform;
    const m = t.match(/matrix\\(([-0-9.]+)/);
    if (m && Math.abs(parseFloat(m[1]) - 1) > 0.01) return parseFloat(m[1]);
    const i = (n.style.objectViewBox || '').match(/inset\\(([^)]+)\\)/);
    if (!i) return 1;
    // sérialisation raccourcie : inset(a) = 4 côtés, inset(a b) = t/b puis r/l
    let l = i[1].split(/\\s+/).map(parseFloat);
    if (l.length === 1) l = [l[0], l[0], l[0], l[0]];
    else if (l.length === 2) l = [l[0], l[1], l[0], l[1]];
    else if (l.length === 3) l = [l[0], l[1], l[2], l[1]];
    const kx = l[1] + l[3];
    const s0 = Math.max(n.clientWidth / n.naturalWidth, n.clientHeight / n.naturalHeight);
    const vw = n.naturalWidth * (1 - kx / 100);
    return n.clientWidth / (s0 * vw);
  })`;
  const echelleA = () => p.evaluate((fn) => {
    const d = document.getElementById('frame').contentDocument;
    return d.defaultView.eval(fn)(d.getElementById('imgA'));
  }, lireEchelle);

  // ---------- 1. cadrage ouvert : la molette ailleurs fait DÉFILER ----------
  let a = await pos('imgA');
  await p.mouse.click(a.x, a.y);
  await p.waitForTimeout(700);
  if (!(await cropOuvert())) fail('le clic sur l’image n’ouvre pas le cadrage');
  if ((await quiCadre()) !== 'Planche A') fail('le cadrage ne vise pas la planche A');
  await p.mouse.move(a.x, a.y + 320);              // loin de l'image cadrée
  for (let i = 0; i < 10; i++) { await p.mouse.wheel(0, 160); await p.waitForTimeout(40); }
  await p.waitForTimeout(400);
  const y1 = await scrollY();
  const z1 = await p.$eval('#cropZ', (e) => e.value);
  if (y1 < 100)
    fail('cadrage ouvert, la molette loin de l’image ne fait pas défiler la page (scroll=' + y1 + ')');
  if (z1 !== '100')
    fail('la molette loin de l’image a zoomé quand même (curseur à ' + z1 + ' %)');
  ok('cadrage ouvert : la molette ailleurs fait défiler la page, sans toucher au zoom');

  // ---------- 2. on clique un AUTRE visuel : le cadrage bascule ----------
  for (let i = 0; i < 30 && !(await pos('imgB')).visible; i++) {
    await p.mouse.wheel(0, 200); await p.waitForTimeout(60);
  }
  const b = await pos('imgB');
  if (!b.visible) fail('impossible d’amener la planche B à l’écran à la molette');
  await p.mouse.click(b.x, b.y);
  await p.waitForTimeout(800);
  if (!(await cropOuvert())) fail('cliquer la planche B pendant le cadrage de A n’ouvre rien');
  if ((await quiCadre()) !== 'Planche B')
    fail('le cadrage n’a pas basculé sur la planche B (' + (await quiCadre()) + ')');
  ok('un clic sur un autre visuel bascule le cadrage dessus — on reste en mode Image');
  await p.click('#cropOk');
  await p.waitForTimeout(400);

  // ---------- 3. DÉZOOMER sous 100 % ----------
  const zMin = await p.$eval('#cropZ', (e) => e.min);
  if (zMin !== '25') fail('le curseur de zoom devrait descendre à 25 % (min=' + zMin + ')');
  await p.evaluate(() => document.getElementById('frame').contentDocument.defaultView.scrollTo(0, 0));
  await p.waitForTimeout(300);
  a = await pos('imgA');
  await p.mouse.click(a.x, a.y);
  await p.waitForTimeout(700);
  if ((await quiCadre()) !== 'Planche A') fail('le cadrage ne revient pas sur la planche A');
  await p.mouse.move(a.x, a.y);                     // SUR l'image : la molette zoome
  for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(50); }
  await p.waitForTimeout(300);
  const e1 = await echelleA();
  if (!(e1 < 0.95)) fail('la molette vers le bas ne dézoome pas sous 100 % (échelle ' + e1 + ')');
  ok('molette sur l’image : le dézoom passe sous 100 % (échelle ' + e1.toFixed(2) + ')');
  await p.$eval('#cropZ', (e) => { e.value = 50; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.waitForTimeout(300);
  const e2 = await echelleA();
  if (Math.abs(e2 - 0.5) > 0.02) fail('le curseur à 50 % ne donne pas une échelle 0,5 (' + e2 + ')');
  ok('curseur à 50 % : l’image fait la moitié de son cadre');
  await p.click('#cropOk');
  await p.waitForTimeout(500);

  // le dézoom tient dans le fichier exporté
  await p.evaluate(() => ['ask', 'askv', 'askl', 'askg', 'askm'].forEach((i) => {
    const e = document.getElementById(i); if (e) e.classList.add('hidden'); }));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', (e) => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(2000);
  const eE = await v.evaluate((fn) => eval(fn)(document.getElementById('imgA')), lireEchelle);
  if (Math.abs(eE - 0.5) > 0.02) fail('le pack exporté a perdu le dézoom (échelle ' + eE + ')');
  ok('le pack exporté garde le dézoom à 50 %');
  await v.close();

  // ---------- 4. beaucoup d'images : le mode Image s'ouvre vite ----------
  const q = await ctx.newPage();
  q.on('pageerror', (e) => { if (!/Clipboard|writeText/.test(e.message)) errs.push('[lag] ' + e.message); });
  await q.goto('file://' + TOOL);
  await q.setInputFiles('#pick', MAQ2);
  await q.waitForSelector('#main:not(.hidden)');
  await q.waitForTimeout(2500);
  const t0 = Date.now();
  await q.click('#mImg');
  await q.waitForFunction(() => document.querySelectorAll('#gal .g, #gal .hd').length > 0);
  await q.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))));
  const dt = Date.now() - t0;
  // avant : ~2100 ms (72 vignettes décodées d'un coup) ; après : ~90 ms
  if (dt > 900) fail('72 images : le passage en mode Image gèle encore ' + dt + ' ms');
  ok('72 images différentes : le mode Image s’ouvre en ' + dt + ' ms');
  // au-delà de six familles, tout arrive replié : on compte les familles,
  // on en déplie une, et ses vignettes doivent se peindre
  const familles = await q.$$eval('#gal .hd', (l) => l.length);
  if (familles < 10) fail('la galerie ne liste que ' + familles + ' familles sur 12');
  await q.click('#gal .hd');
  await q.waitForTimeout(1500);
  const tuiles = await q.$$eval('#gal .g', (l) => l.length);
  if (tuiles < 6) fail('la famille dépliée ne montre que ' + tuiles + ' tuiles sur 6');
  const peintes = await q.$$eval('#gal .g .box', (l) =>
    l.filter((b) => /url\(/.test(b.style.backgroundImage || '')).length);
  if (peintes < 3) fail('les vignettes de la famille dépliée ne se dessinent pas (' + peintes + ')');
  ok(familles + ' familles listées ; dépliée, la première peint ses vignettes (' + peintes + '/' + tuiles + ')');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
