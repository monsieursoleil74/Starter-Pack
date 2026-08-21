/* Les onglets de personnages portent le même nom que la fiche en dessous.
   Renommer un ONGLET puis transférer vers une maquette régénérée : le nom
   doit retrouver l'onglet (pas la fiche) — la structure locale départage. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const V1 = path.resolve(__dirname, 'maq_tabs_v1.html');
const V2 = path.resolve(__dirname, 'maq_tabs_v2.html');
const EXP1 = path.resolve(__dirname, 'tabs_v1_modifie.html');
const OUT = path.resolve(__dirname, 'tabs_v2_repris.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

// onglets EN HAUT (aucun titre au-dessus : pas de témoin possible),
// et le même nom réapparaît en gros sur la fiche
fs.writeFileSync(V1, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>T1</title>
<style>button{padding:8px 18px}.nom{font-size:34px;font-weight:700;display:block}</style>
</head><body style="font-family:sans-serif;padding:20px">
<nav><button id="tPipo">Pipo</button><button id="tBruno">Bruno</button></nav>
<div id="fiche"><span class="nom" id="nom">Pipo</span>
<span>Le héros de l'histoire.</span></div>
</body></html>`);

fs.writeFileSync(V2, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>T2</title>
<style>button{padding:8px 18px}.nom{font-size:34px;font-weight:700;display:block}</style>
</head><body style="font-family:sans-serif;padding:20px">
<main><div><nav><div><button id="tPipo">Pipo</button><button id="tBruno">Bruno</button></div></nav></div>
<section><div id="fiche"><header><span class="nom" id="nom">Pipo</span></header>
<div><span>Le héros de l'histoire.</span></div></div></section></main>
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1200, height: 700 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  const fr = p.frameLocator('#frame');
  const editer = async (sel, texte) => {
    await p.click('#mText');
    await p.waitForTimeout(300);
    await fr.locator(sel).click();
    await p.waitForTimeout(300);
    await p.keyboard.press('ControlOrMeta+a');
    await p.keyboard.type(texte);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(500);
  };

  // ---------- 1. V1 : renommer l'ONGLET Pipo (pas la fiche) ----------
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', V1);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1000);
  await editer('#tPipo', 'Marcel');
  if ((await fr.locator('#tPipo').textContent()).trim() !== 'Marcel')
    fail('l’onglet n’est pas renommé');
  if ((await fr.locator('#nom').textContent()).trim() !== 'Pipo')
    fail('le renommage de l’onglet a débordé sur la fiche');
  ok('V1 : onglet renommé en « Marcel », la fiche garde « Pipo »');
  const [dl1] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl1.saveAs(EXP1);

  // ---------- 2. transfert vers la V2 restructurée ----------
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', V2);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1000);
  await p.click('#importer');
  await p.setInputFiles('#pickImp', EXP1);
  await p.waitForTimeout(1200);
  if ((await fr.locator('#tPipo').textContent()).trim() !== 'Marcel')
    fail('le nom de l’onglet n’est pas repris : « ' +
      (await fr.locator('#tPipo').textContent()).trim() + ' »');
  ok('V2 : le nom d’onglet est repris — la structure locale a départagé');
  if ((await fr.locator('#nom').textContent()).trim() !== 'Pipo')
    fail('le transfert a écrit sur la fiche au lieu de l’onglet');
  ok('la fiche, elle, garde son « Pipo » d’origine');

  // ---------- 3. export ----------
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl2.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1200);
  if ((await v.locator('#tPipo').textContent()).trim() !== 'Marcel')
    fail('export : onglet = ' + (await v.locator('#tPipo').textContent()));
  if ((await v.locator('#nom').textContent()).trim() !== 'Pipo')
    fail('export : la fiche a été écrasée');
  ok('export : onglet « Marcel », fiche intacte');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
