/* L'onglet du navigateur : une icône et un titre choisis dans l'outil, qui
   partent avec le fichier exporté — et qu'on retrouve en le redéposant. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_simple.html');
const LOGO = path.resolve(__dirname, 'large.png');
const OUT = path.resolve(__dirname, 'onglet_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

const onglet = () => {
  const d = document.getElementById('frame') ? document.getElementById('frame').contentDocument : document;
  const l = d.querySelector('link[rel~="icon"]');
  return { titre: d.title, icone: l ? (l.getAttribute('href') || '').slice(0, 15) : null,
           combien: d.querySelectorAll('link[rel~="icon"]').length };
};

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

  // ---------- 1. le panneau est là, prérempli avec le titre de la maquette ----------
  if (await p.$eval('#ongletBox', e => e.classList.contains('hidden'))) fail('pas de réglage d’onglet');
  const titreDep = await p.$eval('#ongletTitre', e => e.value);
  if (titreDep !== 'Ma maquette') fail('titre non prérempli : ' + JSON.stringify(titreDep));
  ok('réglage de l’onglet présent, titre repris de la maquette : « ' + titreDep + ' »');

  // ---------- 2. choisir une icône ----------
  await p.click('#ongletPick');
  await p.waitForTimeout(200);
  await p.setInputFiles('#pickIco', LOGO);
  await p.waitForTimeout(900);
  const ap = await p.evaluate(onglet);
  if (ap.icone.indexOf('data:image/png') !== 0) fail('icône non posée : ' + ap.icone);
  ok('icône posée dans la page (' + ap.combien + ' balise icon)');
  const poids = await p.evaluate(() => {
    const l = document.getElementById('frame').contentDocument.querySelector('link[data-pk-ico]');
    return Math.round((l.getAttribute('href') || '').length / 1024);
  });
  if (poids > 60) fail('icône trop lourde : ' + poids + ' Ko');
  ok('icône ramenée à ' + poids + ' Ko (128 px, recadrée au carré)');

  // ---------- 3. changer le titre ----------
  await p.fill('#ongletTitre', 'Starter Pack — Studio Démo');
  await p.waitForTimeout(800);
  const t2 = await p.evaluate(onglet);
  if (t2.titre !== 'Starter Pack — Studio Démo') fail('titre non appliqué : ' + t2.titre);
  ok('titre appliqué : « ' + t2.titre + ' »');

  const n = await p.$$eval('#list .it span', ns => ns.map(e => e.textContent));
  if (!n.some(t => /Onglet/.test(t))) fail('la retouche n’apparaît pas dans la liste : ' + JSON.stringify(n));
  ok('une retouche « Onglet du navigateur » dans la liste');

  // ---------- 4. export ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1500);
  const fin = await v.evaluate(onglet);
  if (fin.titre !== 'Starter Pack — Studio Démo') fail('export : titre perdu (' + fin.titre + ')');
  if (fin.icone.indexOf('data:image/png') !== 0) fail('export : icône perdue (' + fin.icone + ')');
  if (fin.combien !== 1) fail('export : ' + fin.combien + ' balises icon (1 attendue)');
  ok('fichier exporté : bon titre, une seule icône, la bonne');
  await v.close();

  // ---------- 5. redéposer l'export : les réglages sont retrouvés ----------
  const p2 = await ctx.newPage();
  p2.on('pageerror', e => errs.push('[reprise] ' + e.message));
  await p2.goto('file://' + TOOL);
  await p2.setInputFiles('#pick', OUT);
  await p2.waitForSelector('#main:not(.hidden)');
  await p2.waitForTimeout(1800);
  const repris = await p2.$eval('#ongletTitre', e => e.value);
  const icoRep = await p2.$eval('#ongletVu', e => (e.style.backgroundImage || '').slice(0, 20));
  if (repris !== 'Starter Pack — Studio Démo') fail('reprise : titre ' + JSON.stringify(repris));
  if (icoRep.indexOf('url("data:image') !== 0) fail('reprise : icône ' + icoRep);
  ok('en redéposant l’export : titre et icône retrouvés');

  // ---------- 6. retirer l'icône ----------
  await p2.click('#ongletDel');
  await p2.waitForTimeout(600);
  const sans = await p2.$eval('#ongletVu', e => (e.style.backgroundImage || ''));
  if (sans) fail('l’icône n’a pas été retirée');
  ok('on peut retirer l’icône');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
