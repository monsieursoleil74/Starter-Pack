/* Le panneau de droite : « Mes retouches » reste visible quoi qu'il arrive,
   la progression se lit d'un coup d'œil, et l'astuce ne reste pas en travers
   de la page. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_panneau.html');
const PNG = path.resolve(__dirname, 'remplacement.png');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

const VIDE = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
// beaucoup de familles : de quoi faire déborder le panneau
const FAM = ['rex', 'pipo', 'bruno', 'anne', 'bill', 'gaby', 'hugo', 'june', 'karl', 'lea'];
const K = [];
FAM.forEach(f => { for (let i = 1; i <= 5; i++) K.push(`assets_nda/personnages/${f}/${f}_planche_0${i}.png`); });
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Panneau</title>
<style>body{font-family:sans-serif;padding:16px;background:#eee}#rg-assetmap{display:none}
.v{width:150px;height:100px;object-fit:cover;background:#ccd;margin:4px;display:inline-block}</style>
</head><body><h1>Beaucoup de visuels</h1>
<div id="rg-assetmap">${K.map((k, i) =>
  `<img data-k="${k}" src="${VIDE}#${i}">`).join('')}</div>
<div id="scene">${K.map((k, i) =>
  `<img class="v" alt="${k.split('/').pop().replace('.png', '')}" src="${VIDE}#${i}">`).join('')}</div>
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 800 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(2500);
  await p.click('#mImg');
  await p.waitForTimeout(1500);

  const bas = () => p.evaluate(() => {
    const n = document.getElementById('sideBas');
    const r = n.getBoundingClientRect();
    return { haut: Math.round(r.top), bas: Math.round(r.bottom), h: Math.round(r.height) };
  });
  const fenetre = await p.evaluate(() => window.innerHeight);

  // ---------- 1. « Mes retouches » reste ancré en bas, même avec 50 visuels ----------
  const nbFam = await p.$$eval('#gal .hd', ns => ns.length);
  if (nbFam < 8) fail('pas assez de familles pour le test : ' + nbFam);
  const b0 = await bas();
  if (b0.bas > fenetre + 2) fail('« Mes retouches » déborde sous la fenêtre : ' + JSON.stringify(b0));
  if (b0.h < 20) fail('« Mes retouches » est écrasé : ' + JSON.stringify(b0));
  ok('avec ' + nbFam + ' familles, « Mes retouches » reste visible en bas (' + b0.haut + '→' + b0.bas + ' sur ' + fenetre + ')');

  // la liste des visuels défile dans SA zone, sans emporter le bas
  const defile = await p.evaluate(() => {
    const h = document.getElementById('sideHaut');
    h.scrollTop = 99999;
    return { max: h.scrollHeight > h.clientHeight, pos: h.scrollTop };
  });
  if (!defile.max) fail('la liste des visuels ne défile pas dans sa zone');
  await p.waitForTimeout(200);
  const b1 = await bas();
  if (b1.haut !== b0.haut) fail('faire défiler la liste a bougé « Mes retouches » (' + b0.haut + ' → ' + b1.haut + ')');
  ok('faire défiler les visuels ne déplace pas « Mes retouches »');

  // ---------- 2. la progression, globale et par famille ----------
  const p0 = await p.$eval('#galProg', e => e.textContent.replace(/\s+/g, ' ').trim());
  if (!/0 sur 50/.test(p0)) fail('progression globale de départ : « ' + p0 + ' »');
  if (!/50 à faire/.test(p0)) fail('le reste à faire n’est pas annoncé : « ' + p0 + ' »');
  ok('progression globale au départ : « ' + p0 + ' »');

  await p.evaluate(() => {
    const h = document.getElementById('sideHaut'); h.scrollTop = 0;
    const t = [...document.querySelectorAll('#gal .hd')].find(n => /rex/i.test(n.textContent));
    if (t) t.click();
  });
  await p.waitForTimeout(700);
  const tete0 = await p.$$eval('#gal .hd', ns => ns.map(n => n.textContent.replace(/\s+/g, ' ').trim()));
  if (!tete0.some(t => /0\/5/.test(t))) fail('les familles ne montrent pas « 0/5 » : ' + JSON.stringify(tete0.slice(0, 3)));
  ok('chaque famille annonce ce qui reste : ' + JSON.stringify(tete0.slice(0, 3)));

  // on remplace deux visuels de Rex
  for (let i = 0; i < 2; i++) {
    const t = await p.$$('#gal .g');
    if (!t[i]) fail('vignette manquante');
    await t[i].click();
    // le clic ouvre le cadrage : le remplacement se demande
    if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
      await p.click('#cropRemp').catch(() => {});
    await p.setInputFiles('#pickImg', PNG);
    await p.waitForTimeout(1100);
    if (!(await p.$eval('#crop', e => e.classList.contains('hidden')))) await p.click('#cropOk');
    await p.waitForTimeout(200);
  }
  const p1 = await p.$eval('#galProg', e => e.textContent.replace(/\s+/g, ' ').trim());
  if (!/2 sur 50/.test(p1) || !/48 à faire/.test(p1)) fail('la progression globale ne suit pas : « ' + p1 + ' »');
  ok('la progression globale suit : « ' + p1 + ' »');
  const large = await p.$$eval('#gal .hd .jauge i', ns => ns.map(n => n.style.width));
  if (!large.some(w => w !== '0%')) fail('aucune jauge de famille ne bouge : ' + JSON.stringify(large));
  ok('la jauge de la famille se remplit : ' + JSON.stringify(large.filter(w => w !== '0%')));

  // ---------- 3. le repli de « Mes retouches » ----------
  const avant = await p.$$eval('#list .it', ns => ns.length);
  if (avant !== 2) fail('il devrait y avoir 2 retouches, il y en a ' + avant);
  const hBas = (await bas()).h;
  await p.click('#titreRetouches');
  await p.waitForTimeout(300);
  const replie = await p.$eval('#sideBas', e => e.classList.contains('plie'));
  if (!replie) fail('le clic sur le titre ne replie pas la section');
  const hPlie = (await bas()).h;
  if (hPlie >= hBas) fail('replier ne rend pas de place : ' + hBas + ' → ' + hPlie);
  ok('« Mes retouches » se replie et rend la place au reste (' + hBas + 'px → ' + hPlie + 'px)');
  await p.click('#titreRetouches');
  await p.waitForTimeout(300);
  if (await p.$eval('#sideBas', e => e.classList.contains('plie'))) fail('impossible de redéplier');
  if ((await p.$$eval('#list .it', ns => ns.length)) !== 2) fail('les retouches ont disparu au repli');
  ok('on redéplie et les retouches sont toujours là');

  // le libellé entier est lisible, pas coupé à moitié
  const coupe = await p.$$eval('#list .it span', ns => ns.map(n => ({
    txt: n.textContent.trim(),
    tient: n.scrollHeight <= n.clientHeight + 1
  })));
  if (!coupe.every(o => o.tient))
    fail('un libellé de retouche est encore coupé : ' + JSON.stringify(coupe));
  ok('les libellés tiennent en entier : ' + JSON.stringify(coupe.map(o => o.txt)));

  // ---------- 4. la bulle de rappel du mode est RETIRÉE (demande terrain :
  // elle gênait plus qu'elle n'aidait) : elle ne doit plus jamais apparaître --
  for (const m of ['#mText', '#mImg', '#mLink', '#mView']) {
    await p.click(m);
    await p.waitForTimeout(300);
    if (!(await p.$eval('#hint', e => e.classList.contains('hidden'))))
      fail('la bulle de rappel réapparaît en ' + m);
  }
  ok('la bulle de rappel du mode ne réapparaît dans aucun mode');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
