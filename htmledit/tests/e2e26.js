/* Vidéos : poser un lecteur dans un encadré qui n'en a pas, en fichier posé
   à côté ou embarqué, et changer la vidéo d'un lecteur existant. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_video.html');
const CLIP = path.resolve(__dirname, 'clip.mp4');
const OUT = path.resolve(__dirname, 'video_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

// une maquette avec un encadré « VIDÉO » sans lecteur + un lecteur existant
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Vidéos</title>
<style>body{font-family:sans-serif;padding:24px;background:#222;color:#eee}
.slot{width:480px;height:270px;background:#3a4a3a;display:flex;align-items:center;
      justify-content:center;font-size:22px;font-weight:700;color:#9b9}
video{width:480px;margin-top:20px;background:#000}</style></head><body>
<h1>Tutoriels</h1>
<div class="slot" id="slot">VIDÉO PROTO — présentation du rig</div>
<video id="dejala" controls src="ancienne.mp4"></video>
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 850 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1200);
  const fr = p.frameLocator('#frame');

  if (!(await p.$('#mVid'))) fail('pas de mode Vidéos');
  await p.click('#mVid');
  await p.waitForTimeout(500);

  // ---------- 1. poser une vidéo dans un encadré vide, fichier à côté ----------
  await fr.locator('#slot').hover();
  await p.waitForTimeout(400);
  if (!/pk-hi-zone/.test(await fr.locator('#slot').getAttribute('class')))
    fail('l’encadré n’est pas signalé comme zone');
  await fr.locator('#slot').click();
  await p.waitForTimeout(400);
  if (await p.$eval('#askv', e => e.classList.contains('hidden'))) fail('pas de proposition vidéo');
  await p.click('#askvFile');
  await p.waitForTimeout(300);
  await p.setInputFiles('#pickVid', CLIP);
  await p.waitForTimeout(800);
  // dans l'éditeur, le lecteur lit un aperçu local (blob) : le fichier n'est pas
  // encore copié dans videos/. Le chemin propre, lui, doit être dans la retouche.
  const v1 = await fr.locator('#slot video.pk-vid').getAttribute('src');
  if (!/^blob:/.test(v1) && v1 !== 'videos/clip.mp4') fail('source posée : ' + v1);
  const liste = await p.$eval('#list', e => e.textContent);
  if (!/videos\/clip\.mp4/.test(liste)) fail('la retouche ne porte pas le chemin propre : ' + liste.replace(/\s+/g, ' ').slice(0, 80));
  const cache = await fr.locator('#slot').evaluate(n => ({
    hide: n.hasAttribute('data-pk-hide'),
    txtVisible: getComputedStyle(n.firstChild.nodeType === 1 ? n.firstChild : n).visibility,
    lecteurVisible: getComputedStyle(n.querySelector('video')).visibility
  }));
  if (!cache.hide) fail('le placeholder n’est pas masqué');
  if (cache.lecteurVisible !== 'visible') fail('le lecteur posé est masqué lui aussi !');
  ok('lecteur posé dans l’encadré, placeholder masqué, lecteur visible');
  const rappel = await p.$eval('#besoins', e => e.classList.contains('hidden') ? '' : e.textContent);
  if (!/clip\.mp4/.test(rappel)) fail('pas de rappel du fichier à copier');
  ok('rappel affiché : ' + rappel.replace(/\s+/g, ' ').trim().slice(0, 60));

  // ---------- 2. changer la vidéo d'un lecteur existant ----------
  await fr.locator('#dejala').click();
  await p.waitForTimeout(400);
  const quoi = await p.$eval('#askvWhat', e => e.textContent);
  if (!/déjà présent/.test(quoi)) fail('mauvais message : ' + quoi);
  await p.click('#askvEmbed');
  await p.waitForTimeout(300);
  await p.setInputFiles('#pickVid', CLIP);
  await p.waitForTimeout(1000);
  const v2 = await fr.locator('#dejala').getAttribute('src');
  if (v2.indexOf('data:video/mp4') !== 0) fail('vidéo embarquée non appliquée : ' + String(v2).slice(0, 24));
  ok('lecteur existant : nouvelle vidéo embarquée dans le fichier');

  // ---------- 3. export : tout est rejoué ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1400);
  const fin = await v.evaluate(() => {
    const s = document.querySelector('#slot video.pk-vid');
    const d = document.getElementById('dejala');
    return { pose: s ? s.getAttribute('src') : null,
             poseVisible: s ? getComputedStyle(s).visibility : null,
             remplace: d ? d.getAttribute('src').slice(0, 14) : null };
  });
  // le fichier n'existe pas sur ce disque : l'export le cherche à côté puis
  // dans videos/ et video/ — le src final est l'une de ces variantes
  if (!/(^|\/)(videos?\/)?clip\.mp4$/.test(fin.pose || ''))
    fail('export : lecteur posé absent (' + fin.pose + ')');
  if (fin.poseVisible !== 'visible') fail('export : le lecteur posé est masqué');
  if (fin.remplace !== 'data:video/mp4') fail('export : vidéo embarquée absente (' + fin.remplace + ')');
  ok('fichier exporté : lecteur posé et vidéo embarquée rejoués');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
