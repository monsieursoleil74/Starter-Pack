/* Transfert vers une maquette régénérée, cas des FICHES PARTAGÉES : la
   retouche du personnage affiché se recale tout de suite ; celle d'un
   personnage non affiché est gardée et se recale dès que sa fiche s'ouvre. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const V1 = path.resolve(__dirname, 'maq_fiche_v1.html');
const V2 = path.resolve(__dirname, 'maq_fiche_v2.html');
const EXP1 = path.resolve(__dirname, 'fiche_v1_modifie.html');
const OUT = path.resolve(__dirname, 'fiche_v2_repris.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

// même appli dans les deux versions : fiche partagée, repeint différentiel —
// mais la V2 a une STRUCTURE toute différente (wrappers en plus)
const APPJS = `var fiches = { Pipo: { arc: 'Arc à écrire' }, Bruno: { arc: 'Arc à écrire' } };
var courant = 'Pipo';
function montre(qui) {
  if (document.getElementById('nom').textContent !== qui)
    document.getElementById('nom').textContent = qui;
  if (fiches[courant].arc !== fiches[qui].arc)
    document.getElementById('arc').textContent = fiches[qui].arc;
  courant = qui;
}
document.getElementById('bPipo').addEventListener('click', function () { montre('Pipo'); });
document.getElementById('bBruno').addEventListener('click', function () { montre('Bruno'); });`;

fs.writeFileSync(V1, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>F1</title>
<style>.nom{font-size:34px;font-weight:700;display:block}.val{font-size:15px;display:block}</style>
</head><body style="font-family:sans-serif;padding:30px">
<button id="bPipo">Pipo</button><button id="bBruno">Bruno</button>
<div id="fiche"><span class="nom sc-interp" id="nom">Pipo</span>
<span class="val" id="arc">Arc à écrire</span></div>
<script>${APPJS}<\/script></body></html>`);

fs.writeFileSync(V2, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>F2</title>
<style>.nom{font-size:34px;font-weight:700;display:block}.val{font-size:15px;display:block}</style>
</head><body style="font-family:sans-serif;padding:30px">
<main><nav><div><button id="bPipo">Pipo</button><button id="bBruno">Bruno</button></div></nav>
<div><section><div id="fiche"><header><span class="nom sc-interp" id="nom">Pipo</span></header>
<div><span class="val" id="arc">Arc à écrire</span></div></div></section></div></main>
<script>${APPJS}<\/script></body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1200, height: 700 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  p.on('console', m => { if (/\[dbg\]/.test(m.text())) console.log(m.text()); });
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
  const voir = async (qui) => {
    await p.click('#mView');
    await p.waitForTimeout(250);
    await fr.locator(qui === 'Pipo' ? '#bPipo' : '#bBruno').click();
    await p.waitForTimeout(1100);
  };
  const arc = () => fr.locator('#arc').textContent();

  // ---------- 1. V1 : un arc pour chacun, export ----------
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', V1);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1000);
  await editer('#arc', 'L’arc de Pipo, le héros.');
  await voir('Bruno');
  await editer('#arc', 'L’arc de Bruno, le rival.');
  await voir('Pipo');
  const [dl1] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl1.saveAs(EXP1);
  ok('V1 : un arc par personnage, exportée');

  // ---------- 2. V2 restructurée : transfert (Pipo affiché) ----------
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', V2);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1000);
  await p.click('#importer');
  await p.setInputFiles('#pickImp', EXP1);
  await p.waitForTimeout(1500);
  if ((await arc()) !== 'L’arc de Pipo, le héros.')
    fail('l’arc du personnage affiché n’est pas recalé : ' + (await arc()));
  ok('l’arc de Pipo (affiché) est recalé dès le transfert');
  const nRet = await p.$$eval('#list .it', l => l.length);
  if (nRet < 2) fail('l’arc de Bruno a été jeté au lieu d’être gardé (' + nRet + ' retouche(s))');
  ok('l’arc de Bruno (pas affiché) est gardé en attente');

  // ---------- 3. ouvrir la fiche de Bruno : il se recale tout seul ----------
  await voir('Bruno');
  if ((await arc()) !== 'L’arc de Bruno, le rival.')
    fail('l’arc de Bruno ne se recale pas à l’affichage : ' + (await arc()));
  ok('la fiche de Bruno s’ouvre : son arc transféré apparaît');
  await voir('Pipo');
  if ((await arc()) !== 'L’arc de Pipo, le héros.')
    fail('retour Pipo : ' + (await arc()));
  ok('chacun garde le sien en naviguant');

  // ---------- 4. export : les deux voyagent ----------
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl2.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1500);
  const arcV = () => v.locator('#arc').textContent();
  if ((await arcV()) !== 'L’arc de Pipo, le héros.') fail('export, Pipo : ' + (await arcV()));
  await v.click('#bBruno');
  await v.waitForTimeout(1400);
  if ((await arcV()) !== 'L’arc de Bruno, le rival.') fail('export, Bruno : ' + (await arcV()));
  await v.click('#bPipo');
  await v.waitForTimeout(1400);
  if ((await arcV()) !== 'L’arc de Pipo, le héros.') fail('export, retour Pipo : ' + (await arcV()));
  ok('export de la V2 : les deux arcs voyagent et se cloisonnent');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
