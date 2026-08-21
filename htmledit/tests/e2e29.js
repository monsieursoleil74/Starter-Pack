/* La vidéo se lit vraiment : dans l'aperçu (même « posée à côté ») et dans le
   fichier exporté une fois le fichier copié. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const CLIP = path.resolve(__dirname, 'vraie.webm');
const DIR = path.resolve(__dirname, 'lecture');
const MAQ = path.join(DIR, 'maq.html');
const OUT = path.join(DIR, 'maq_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tuto</title>
<style>body{font-family:sans-serif;padding:20px;background:#222;color:#eee}
.slot{width:480px;height:270px;background:#3a4a3a;display:flex;align-items:center;
justify-content:center;font-weight:700;color:#9b9}</style></head><body>
<div class="slot" id="slot">VIDÉO PROTO</div></body></html>`);

const lisible = async (page, sel) => page.evaluate(async (s) => {
  const doc = document.querySelector('#frame')
    ? document.querySelector('#frame').contentDocument : document;
  const v = doc.querySelector(s);
  if (!v) return 'pas de lecteur';
  if (v.readyState >= 2) return 'prête (' + Math.round(v.duration * 10) / 10 + ' s)';
  return await new Promise(res => {
    const fini = () => res('prête (' + Math.round(v.duration * 10) / 10 + ' s)');
    v.addEventListener('loadeddata', fini, { once: true });
    v.addEventListener('error', () => res('ERREUR de lecture'), { once: true });
    setTimeout(() => res(v.readyState >= 2 ? fini() : 'rien chargé (readyState ' + v.readyState + ')'), 4000);
  });
}, sel);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 850 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1200);
  const fr = p.frameLocator('#frame');

  // ---------- 1. « posée à côté » : lisible dans l'aperçu ----------
  await p.click('#mVid');
  await p.waitForTimeout(400);
  await fr.locator('#slot').click();
  await p.waitForTimeout(400);
  await p.click('#askvFile');
  await p.waitForTimeout(300);
  await p.setInputFiles('#pickVid', CLIP);
  await p.waitForTimeout(1500);
  const etat1 = await lisible(p, 'video.pk-vid');
  if (!/prête/.test(etat1)) fail('aperçu (posée à côté) : ' + etat1);
  ok('aperçu : la vidéo se lit malgré le chemin relatif — ' + etat1);

  // le patch, lui, garde bien le chemin relatif
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const txt = fs.readFileSync(OUT, 'utf8');
  if (!/videos\/vraie\.webm/.test(txt)) fail('le fichier exporté ne pointe pas vers videos/vraie.mp4');
  if (/blob:/.test(txt.split('pack-edit-data')[1].slice(0, 4000))) fail('un blob d’aperçu a fini dans le fichier');
  ok('fichier exporté : chemin relatif propre, aucun aperçu temporaire embarqué');

  // ---------- 2. le fichier exporté lit la vidéo une fois copiée ----------
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1200);
  const sansFichier = await lisible(v, 'video.pk-vid');
  if (/prête/.test(sansFichier)) fail('la vidéo se lit alors qu’elle n’est pas copiée ?');
  ok('sans le fichier copié : le lecteur ne trouve rien (' + sansFichier + ') — attendu');

  fs.mkdirSync(path.join(DIR, 'videos'), { recursive: true });
  fs.copyFileSync(CLIP, path.join(DIR, 'videos', 'vraie.webm'));
  await v.reload();
  await v.waitForTimeout(1500);
  const avecFichier = await lisible(v, 'video.pk-vid');
  if (!/prête/.test(avecFichier)) fail('fichier copié, mais lecture impossible : ' + avecFichier);
  ok('fichier copié dans videos/ : la vidéo se lit — ' + avecFichier);

  // ---------- 3. la vidéo embarquée se lit aussi ----------
  const p3 = await ctx.newPage();
  p3.on('pageerror', e => errs.push('[embed] ' + e.message));
  await p3.goto('file://' + TOOL);
  await p3.setInputFiles('#pick', MAQ);
  await p3.waitForSelector('#main:not(.hidden)');
  await p3.waitForTimeout(1200);
  await p3.click('#mVid');
  await p3.waitForTimeout(400);
  await p3.frameLocator('#frame').locator('#slot').click();
  await p3.waitForTimeout(400);
  await p3.click('#askvEmbed');
  await p3.waitForTimeout(300);
  await p3.setInputFiles('#pickVid', CLIP);
  await p3.waitForTimeout(2000);
  const etat3 = await lisible(p3, 'video.pk-vid');
  if (!/prête/.test(etat3)) fail('vidéo embarquée illisible : ' + etat3);
  ok('vidéo embarquée : lecture immédiate, sans rien copier — ' + etat3);

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
