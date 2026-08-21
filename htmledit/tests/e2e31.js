/* Maquette qui range ses visuels dans une réserve cachée (une image par
   fichier) : remplacer la planche de Pipo ne doit toucher QUE Pipo, et le
   remplacement doit suivre partout où ce visuel est utilisé. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = '/root/.claude/uploads/9b61ac52-1242-5681-b4f1-1a84f74cc71a/642b4870-Pack_NDA__Version_demo__horsligne_1.html';
const PNG = path.resolve(__dirname, 'remplacement.png');
const OUT = path.resolve(__dirname, 'maq4_modifiee.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

const etat = () => {
  const d = document.getElementById('frame') ? document.getElementById('frame').contentDocument : document;
  const map = {};
  d.querySelectorAll('#rg-assetmap img[data-k]').forEach(im => { map[im.getAttribute('data-k')] = im.getAttribute('src').slice(0, 15); });
  const vus = [...d.querySelectorAll('img[alt^="Planche proto"]')]
    .filter(n => !n.closest('#rg-assetmap'))
    .map(n => {
      const c = d.defaultView.getComputedStyle(n).content;
      return c && c.indexOf('url(') === 0 ? c.slice(5, 20) : n.getAttribute('src').slice(0, 15);
    });
  return { pipo1: map['assets_nda/personnages/pipo/pipo_planche_01.png'],
           pipo2: map['assets_nda/personnages/pipo/pipo_planche_02.png'],
           bruno1: map['assets_nda/personnages/bruno/bruno_planche_01.png'],
           vus: vus };
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1500, height: 900 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(8000);
  const fr = p.frameLocator('#frame');
  await p.click('#mImg');
  await p.waitForTimeout(1000);

  const av = await p.evaluate(etat);
  if (!av.pipo1 || !av.bruno1) fail('réserve d’images introuvable : ' + JSON.stringify(av));
  ok('la maquette range ses visuels par personnage (réserve lue : pipo + bruno)');

  // ---------- 1. remplacer la planche affichée (Pipo) ----------
  const pl = fr.locator('img[alt="Planche proto I"]');
  await pl.scrollIntoViewIfNeeded();
  await p.waitForTimeout(400);
  await pl.click({ force: true });
  await p.waitForTimeout(600);
  if (await p.$eval('#askg', e => e.classList.contains('hidden'))) fail('le choix des images ne s’ouvre pas');
  const noms = await p.$$eval('#askgGrid .gi .nm', ns => ns.map(n => n.textContent.trim()));
  const i1 = noms.findIndex(n => /Planche proto I$/.test(n));
  await p.locator('#askgGrid .gi').nth(i1).click();
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', PNG);
  await p.waitForTimeout(1200);

  const ap = await p.evaluate(etat);
  if (ap.pipo1 === av.pipo1) fail('la réserve de Pipo n’a pas changé');
  if (ap.pipo1.indexOf('data:image/png') !== 0) fail('réserve : source inattendue ' + ap.pipo1);
  ok('c’est l’entrée « pipo_planche_01.png » de la réserve qui a été remplacée');
  if (ap.bruno1 !== av.bruno1) fail('la planche de Bruno a bougé alors qu’on éditait Pipo !');
  if (ap.pipo2 !== av.pipo2) fail('la 2e planche de Pipo a bougé aussi');
  ok('les autres personnages — et l’autre planche de Pipo — sont intacts');
  if (!ap.vus.some(s => s.indexOf('data:image/png') === 0))
    fail('le carrousel affiché ne montre pas le remplacement : ' + JSON.stringify(ap.vus));
  ok('le carrousel affiché montre tout de suite le nouveau visuel');

  // la retouche est nommée par le fichier de la réserve
  const lab = await p.$eval('#list', e => e.textContent);
  if (!/pipo_planche_01\.png/.test(lab)) fail('la retouche ne dit pas quel visuel : ' + lab.trim().slice(0, 80));
  ok('la retouche est nommée : ' + lab.replace(/\s+/g, ' ').trim().slice(0, 60));
  await p.click('#askgNo');

  // ---------- 2. le carrousel continue de tourner sans écraser la retouche ----------
  await p.waitForTimeout(4500);   // le défilement automatique est à 3,5 s
  const ap2 = await p.evaluate(etat);
  if (ap2.pipo1.indexOf('data:image/png') !== 0) fail('la retouche a été perdue au défilement');
  ok('le carrousel tourne, la retouche tient');

  // ---------- 3. export : la réserve part avec, chacun garde son visuel ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(9000);
  const fin = await v.evaluate(etat);
  if (fin.pipo1.indexOf('data:image/png') !== 0) fail('export : réserve de Pipo non rejouée (' + fin.pipo1 + ')');
  if (fin.bruno1.indexOf('data:image/png') === 0) fail('export : la planche de Bruno a été écrasée');
  ok('fichier exporté : Pipo a son nouveau visuel, Bruno garde le sien');
  const affiche = await v.evaluate(() => {
    const n = document.querySelector('img[alt="Planche proto I"]');
    return n ? n.getAttribute('src').slice(0, 15) : null;
  });
  if (affiche.indexOf('data:image/png') !== 0) fail('export : le carrousel n’affiche pas le nouveau visuel (' + affiche + ')');
  ok('export : le carrousel sert bien le visuel remplacé, sans rien changer d’autre');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
