/* Fenêtre de tutoriel SANS lecteur (un encadré vide) partagée entre MANUEL,
   RIG, PICKER — Manuel posé par FICHIER, Rig par CHEMIN tapé. L'aperçu local
   était indexé par l'emplacement seul, partagé : le player du Rig lisait la
   vidéo de Manuel dans l'éditeur. Et le témoin ne doit jamais être le bouton
   lui-même (toujours affiché) : les vidéos se disputeraient la fenêtre à
   chaque passe (lecteur qui clignote, lecture impossible).
   Usage : node e2e93.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const DIR = path.resolve(__dirname, 'e2e93');
const MAQ = path.join(DIR, 'maq.html');
const OUT = path.join(DIR, 'pack.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }
fs.mkdirSync(path.join(DIR, 'videos'), { recursive: true });

const TUTOS = ['MANUEL', 'PRESENTATION RIG', 'PICKER'];
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tutos</title>
<style>body{font-family:sans-serif;background:#1d241d;color:#dfe7df;padding:24px;margin:0}
.tuto{display:block;margin:10px 0;padding:14px 22px;border:1px solid #6f8f6f;border-radius:10px;
  background:#2a332a;color:#dfe7df;font-size:15px;cursor:pointer}
#fen{position:fixed;inset:6% 12%;background:#0b0e0b;border-radius:14px;display:none;
  flex-direction:column;align-items:center;gap:10px;padding:18px;z-index:50}
#fen .encadre{width:82%;height:64%;background:#16301f;display:flex;align-items:center;
  justify-content:center;font-size:20px;font-weight:700;color:#9b9;position:relative}
</style></head><body>
<h1>Tutoriels</h1>
${TUTOS.map((t) => `<button class="tuto" data-t="${t}">${t}</button>`).join('\n')}
<div id="fen">
  <h3 id="fenTitre" style="margin:0"></h3>
  <div class="encadre" id="fenCadre">VIDÉO — bientôt</div>
  <button id="fenX">Fermer</button>
</div>
</body>
<script>
  [].forEach.call(document.querySelectorAll('.tuto'), function (b) {
    b.addEventListener('click', function () {
      document.getElementById('fenTitre').textContent = 'Tutoriel ' + b.dataset.t;
      document.getElementById('fen').style.display = 'flex';
    });
  });
  document.getElementById('fenX').addEventListener('click', function () {
    document.getElementById('fen').style.display = 'none';
  });
</script></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1300, height: 850 } });

  // deux vraies petites webm, rangées dans videos/ à côté du pack
  const gen = await ctx.newPage();
  await gen.goto('about:blank');
  for (const [nom, n] of [['manuel.webm', 7], ['rig.webm', 11]]) {
    const b64 = await gen.evaluate((k) => new Promise((res, rej) => {
      const cv = document.createElement('canvas');
      cv.width = 64; cv.height = 48;
      const g = cv.getContext('2d');
      const rec = new MediaRecorder(cv.captureStream(10), { mimeType: 'video/webm' });
      const parts = [];
      rec.ondataavailable = (e) => parts.push(e.data);
      rec.onstop = () => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result.split(',')[1]);
        fr.onerror = rej;
        fr.readAsDataURL(new Blob(parts, { type: 'video/webm' }));
      };
      let t = 0;
      const it = setInterval(() => {
        g.fillStyle = t % 2 ? '#c00' : '#06c';
        g.fillRect(0, 0, 64, 48);
        if (++t > k) { clearInterval(it); rec.stop(); }
      }, 80);
      rec.start();
    }), n);
    fs.writeFileSync(path.join(DIR, 'videos', nom), Buffer.from(b64, 'base64'));
  }
  await gen.close();

  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => { if (!/Clipboard|writeText/.test(e.message)) errs.push(e.message); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1300);

  const cible = (lbl, sel) => p.evaluate(([q, s]) => {
    const d = document.getElementById('frame').contentDocument;
    const n = s ? d.querySelector(s)
      : [...d.querySelectorAll('.tuto')].find((x) => (x.textContent || '').trim() === q);
    n.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = n.getBoundingClientRect();
    const f = document.getElementById('frame').getBoundingClientRect();
    return { x: f.left + r.left + r.width / 2, y: f.top + r.top + r.height / 2 };
  }, [lbl, sel]);
  const fermerFen = async () => {
    await p.click('#mView');
    await p.waitForTimeout(300);
    const x = await cible(null, '#fenX');
    await p.mouse.click(x.x, x.y);
    await p.waitForTimeout(400);
  };
  const lecteurEditeur = () => p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const v = d.querySelector('#fenCadre video.pk-vid');
    return v ? (v.getAttribute('src') || '') : '(pas de lecteur)';
  });

  // ---------- MANUEL par FICHIER, dans l'encadré vide ----------
  await p.click('#mVid');
  await p.waitForTimeout(400);
  let c = await cible('MANUEL');
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(1400);
  if (await p.$eval('#askv', (e) => e.classList.contains('hidden')))
    fail('l’encadré vide n’a pas été proposé pour MANUEL');
  const [ch] = await Promise.all([p.waitForEvent('filechooser'), p.click('#askvFile')]);
  await ch.setFiles(path.join(DIR, 'videos', 'manuel.webm'));
  await p.waitForTimeout(1000);
  if (!/^blob:/.test(await lecteurEditeur()))
    fail('MANUEL posé par fichier : l’aperçu ne lit pas le fichier choisi (' + (await lecteurEditeur()) + ')');
  await fermerFen();

  // ---------- RIG par CHEMIN tapé ----------
  await p.click('#mVid');
  await p.waitForTimeout(400);
  c = await cible('PRESENTATION RIG');
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(1400);
  if (await p.$eval('#askv', (e) => e.classList.contains('hidden')))
    fail('l’encadré vide n’a pas été proposé pour RIG');
  p.once('dialog', (d) => d.accept('videos/rig.webm'));
  await p.click('#askvLien');
  await p.waitForTimeout(1200);
  const srcRigEd = await lecteurEditeur();
  if (/^blob:/.test(srcRigEd))
    fail('éditeur : le player du RIG lit la vidéo de MANUEL (aperçu partagé) — ' + srcRigEd);
  if (srcRigEd.indexOf('videos/rig.webm') < 0)
    fail('éditeur : le player du RIG devrait viser videos/rig.webm : ' + srcRigEd);
  ok('éditeur : le player du RIG vise SA vidéo, pas celle de MANUEL');
  const nb = await p.$$eval('#list .it', (l) => l.length);
  if (nb !== 2) fail(nb + ' retouche(s) au lieu de 2');
  ok('deux retouches distinctes');
  await fermerFen();

  // ---------- le pack : chaque tutoriel lit la sienne, sans clignoter ----------
  await p.evaluate(() => ['ask', 'askv', 'askl', 'askg', 'askm'].forEach((i) => {
    const e = document.getElementById(i); if (e) e.classList.add('hidden'); }));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', (e) => errs.push('[pack] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1800);

  const ouvrirEtLire = async (tuto, attendu) => {
    await v.evaluate((q) => {
      [...document.querySelectorAll('.tuto')].find((x) => (x.textContent || '').trim() === q).click();
    }, tuto);
    await v.waitForTimeout(2200);
    const r = await v.evaluate(async () => {
      const vid = document.querySelector('#fenCadre video.pk-vid');
      if (!vid) return { absent: true };
      // le src doit rester STABLE : on le surveille pendant 3 s
      const s0 = vid.getAttribute('src');
      window.__chg = 0;
      const mo = new MutationObserver(() => { window.__chg++; });
      mo.observe(vid, { attributes: true, attributeFilter: ['src'] });
      let lecture = 'échec';
      try {
        await vid.play();
        await new Promise((r2) => setTimeout(r2, 3000));
        lecture = vid.currentTime > 0.15 ? 'OK' : 'figée à ' + vid.currentTime.toFixed(2);
      } catch (e) { lecture = 'play() rejeté : ' + e.name; }
      mo.disconnect();
      return { src: s0 || '', lecture, reecrit: window.__chg };
    });
    if (r.absent) fail('pack, ' + tuto + ' : aucun lecteur dans l’encadré');
    if (r.src.indexOf(attendu) < 0)
      fail('pack, ' + tuto + ' : le lecteur vise ' + JSON.stringify(r.src) + ' au lieu de ' + attendu);
    if (r.reecrit > 0)
      fail('pack, ' + tuto + ' : le lecteur CLIGNOTE — src réécrit ' + r.reecrit + ' fois en 3 s');
    if (r.lecture !== 'OK')
      fail('pack, ' + tuto + ' : la vidéo ne se lance pas (' + r.lecture + ')');
    await v.evaluate(() => document.getElementById('fenX').click());
    await v.waitForTimeout(400);
  };
  await ouvrirEtLire('PRESENTATION RIG', 'videos/rig.webm');
  await ouvrirEtLire('MANUEL', 'videos/manuel.webm');
  await ouvrirEtLire('PRESENTATION RIG', 'videos/rig.webm');
  ok('pack : chaque tutoriel lit SA vidéo, lecture fluide, aucun clignotement');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
