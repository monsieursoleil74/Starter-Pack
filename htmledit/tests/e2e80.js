/* Vidéos « fichier local » : le fichier exporté les cherche au chemin
   annoncé par la maquette, PUIS dans un sous-dossier videos/ (ou video/)
   à côté du HTML — on peut donc ranger toutes les vidéos à plat dans un
   dossier videos/, même quand la maquette attend un chemin profond
   (assets_nda/…). Usage : node e2e80.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const DIR = path.resolve(__dirname, 'e2e80');
const MAQ = path.join(DIR, 'maq_video.html');
const OUT = path.join(DIR, 'pack.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

fs.mkdirSync(path.join(DIR, 'videos'), { recursive: true });
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Vidéo</title></head>
<body style="font-family:sans-serif;padding:30px">
<h1>Tutoriels</h1>
<video id="lecteur" src="assets_nda/tuto/clip.webm" controls style="width:480px;background:#000"></video>
<p>La vidéo du tutoriel.</p>
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1100, height: 700 } });

  // ---------- 0. fabriquer une VRAIE petite vidéo webm (enregistrée ici) ----------
  const gen = await ctx.newPage();
  await gen.goto('about:blank');
  const b64 = await gen.evaluate(() => new Promise((res, rej) => {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 48;
    const g = cv.getContext('2d');
    const rec = new MediaRecorder(cv.captureStream(10), { mimeType: 'video/webm' });
    const parts = [];
    rec.ondataavailable = e => parts.push(e.data);
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
      if (++t > 6) { clearInterval(it); rec.stop(); }
    }, 80);
    rec.start();
  }));
  fs.writeFileSync(path.join(DIR, 'videos', 'clip.webm'), Buffer.from(b64, 'base64'));
  await gen.close();
  ok('petite vidéo webm générée dans videos/clip.webm');

  // ---------- 1. export avec une retouche vidéo « fichier local » ----------
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => { if (!/Clipboard|writeText/.test(e.message)) errs.push(e.message); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1000);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  // la retouche vidéo (chemin PROFOND, comme une réserve de maquette) est
  // injectée dans le bloc : le chemin annoncé n'existe pas sur ce disque,
  // seule videos/clip.webm existe
  let sx = fs.readFileSync(OUT, 'utf8');
  const m = '<script id="pack-edit-data" type="application/json">';
  const i0 = sx.indexOf(m) + m.length;
  const i1 = sx.indexOf('<\/script>', i0);
  const d = JSON.parse(sx.slice(i0, i1).split('<\\/').join('</') || '[]');
  d.push({ id: 'pv80', kind: 'vsrc', sel: 'body:nth-of-type(1)>video:nth-of-type(1)',
    before: '', after: 'assets_nda/tuto/clip.webm', label: 'clip tuto' });
  sx = sx.slice(0, i0) + JSON.stringify(d).split('</').join('<\\/') + sx.slice(i1);
  fs.writeFileSync(OUT, sx);
  ok('export préparé : la vidéo est attendue à assets_nda/tuto/clip.webm (absent)');

  // ---------- 2. ouverture : la vidéo est trouvée dans videos/ ----------
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(2500);
  const etat = await v.evaluate(() => {
    const el = document.getElementById('lecteur');
    return { src: el.getAttribute('src'), pret: el.readyState, w: el.videoWidth };
  });
  if (!/videos\/clip\.webm$/.test(etat.src || ''))
    fail('la vidéo n’a pas été cherchée dans videos/ : src=' + JSON.stringify(etat.src));
  if (!(etat.pret >= 1 && etat.w > 0))
    fail('la vidéo trouvée dans videos/ ne se charge pas (readyState=' + etat.pret + ')');
  ok('vidéo introuvable au chemin annoncé → trouvée et lisible dans videos/ (' + etat.w + 'px)');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
