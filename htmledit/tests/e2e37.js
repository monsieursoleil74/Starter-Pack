/* Recadrage : après avoir posé une image dans un cadre qui la rogne, on doit
   pouvoir la déplacer et zoomer — et le cadrage doit tenir à l'export. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_cadre.html');
const LARGE = path.resolve(__dirname, 'large.png');
const OUT = path.resolve(__dirname, 'cadre_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

// une maquette avec un cadre carré (l'image sera rognée) et un fond de carte
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cadres</title>
<style>body{font-family:sans-serif;padding:24px;background:#eee}
.cadre{width:300px;height:300px;overflow:hidden;background:#ccd}
.cadre img{width:100%;height:100%;object-fit:cover;display:block}
.carte{width:420px;height:180px;background:#556;color:#fff;margin-top:20px;padding:14px}</style>
</head><body>
<h1>Cadres</h1>
<div class="cadre"><img id="visuel" alt="Proto" src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="></div>
<div class="carte" id="carte">Ton &amp; intentions</div>
</body></html>`);

// une image nettement plus large que haute (400x100) : forcément rognée dans un carré
if (!fs.existsSync(LARGE)) throw new Error('image de test manquante');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 900 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1500);
  const fr = p.frameLocator('#frame');

  // ---------- 1. poser l'image : le recadrage s'ouvre tout seul ----------
  await p.click('#mImg');
  await p.waitForTimeout(500);
  await fr.locator('#visuel').click();
  await p.waitForTimeout(400);
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', LARGE);
  await p.waitForTimeout(1200);
  if (await p.$eval('#crop', e => e.classList.contains('hidden')))
    fail('l’image est rognée par son cadre, mais le recadrage ne s’ouvre pas');
  ok('image rognée → le recadrage s’ouvre de lui-même');

  const lire = () => p.evaluate(() => {
    const n = document.getElementById('frame').contentDocument.getElementById('visuel');
    return { fit: n.style.objectFit, pos: n.style.objectPosition, tr: n.style.transform };
  });
  const avant = await lire();
  if (avant.fit !== 'cover') fail('l’image n’est pas cadrée en cover : ' + avant.fit);

  // ---------- 2. glisser déplace l'image ----------
  const b = await p.locator('#frame').boundingBox();
  const box = await p.evaluate(() => {
    const n = document.getElementById('frame').contentDocument.getElementById('visuel');
    const r = n.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await p.mouse.move(b.x + box.x, b.y + box.y);
  await p.mouse.down();
  await p.mouse.move(b.x + box.x - 60, b.y + box.y, { steps: 8 });
  await p.mouse.up();
  await p.waitForTimeout(400);
  const apres = await lire();
  if (apres.pos === avant.pos) fail('le glisser n’a pas déplacé l’image (' + apres.pos + ')');
  ok('glisser déplace l’image dans son cadre : ' + avant.pos + ' → ' + apres.pos);

  // ---------- 3. le zoom ----------
  await p.locator('#cropZ').fill('180');
  await p.locator('#cropZ').dispatchEvent('input');
  await p.waitForTimeout(400);
  const zoome = await lire();
  if (!/scale\(1\.8\)/.test(zoome.tr)) fail('le zoom n’est pas appliqué : ' + zoome.tr);
  ok('le curseur zoome dans l’image : ' + zoome.tr);

  // ---------- 4. « Recentrer » remet tout à zéro ----------
  await p.click('#cropReset');
  await p.waitForTimeout(400);
  const remis = await lire();
  if (remis.pos !== '50% 50%') fail('Recentrer n’a pas remis au centre : ' + remis.pos);
  ok('« Recentrer » remet l’image au centre, sans zoom');

  // on refait un cadrage volontaire, à conserver
  await p.mouse.move(b.x + box.x, b.y + box.y);
  await p.mouse.down();
  await p.mouse.move(b.x + box.x - 80, b.y + box.y, { steps: 8 });
  await p.mouse.up();
  await p.locator('#cropZ').fill('140');
  await p.locator('#cropZ').dispatchEvent('input');
  await p.waitForTimeout(300);
  const choisi = await lire();
  await p.click('#cropOk');
  await p.waitForTimeout(300);
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden')))) fail('« Terminé » ne referme pas la barre');
  ok('cadrage retenu : ' + choisi.pos + ' zoom ' + choisi.tr);

  // ---------- 5. on peut y revenir depuis la liste ----------
  const boutons = await p.$$eval('#list .it button', ns => ns.map(n => n.title || ''));
  if (!boutons.some(t => /Recadrer/.test(t)))
    fail('pas de bouton de recadrage dans la liste : ' + JSON.stringify(boutons));
  await p.locator('#list .it button[title^="Recadrer"]').first().click();
  await p.waitForTimeout(500);
  if (await p.$eval('#crop', e => e.classList.contains('hidden'))) fail('le bouton ✥ ne rouvre pas le recadrage');
  const rouvert = await p.$eval('#cropZ', e => e.value);
  if (rouvert !== '140') fail('le zoom retenu n’est pas retrouvé : ' + rouvert);
  ok('on revient au recadrage depuis la liste, réglages retrouvés (zoom ' + rouvert + '%)');
  await p.click('#cropOk');

  // ---------- 6. export : le cadrage est rejoué ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1500);
  const fin = await v.evaluate(() => {
    const n = document.getElementById('visuel');
    return { pos: n.style.objectPosition, tr: n.style.transform, fit: n.style.objectFit,
             src: n.getAttribute('src').slice(0, 14) };
  });
  if (fin.src !== 'data:image/png') fail('export : image absente');
  if (fin.pos !== choisi.pos) fail('export : cadrage perdu (' + fin.pos + ' au lieu de ' + choisi.pos + ')');
  if (fin.tr !== choisi.tr) fail('export : zoom perdu (' + fin.tr + ')');
  ok('fichier exporté : même image, même cadrage, même zoom');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
