/* Les placeholders IDENTIQUES d'une fiche partagée (« Prénom Nom » du
   charalead, « Réf. anim »…) : le texte d'origine ne distingue plus rien,
   la retouche doit s'accrocher au NOM du personnage affiché au-dessus. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_placeholders.html');
const OUT = path.resolve(__dirname, 'placeholders_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

// même structure que la vraie fiche : nom en gros, puis des placeholders
// IDENTIQUES pour chaque personnage
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fiches</title>
<style>body{font-family:sans-serif;padding:30px;background:#eee}
h1{font-size:46px}
.nom{font-size:34px;font-weight:700;display:block}
.etq{font-size:11px;text-transform:uppercase;color:#888;display:block;margin-top:14px}
.souslabel{font-size:14px;font-weight:600;display:block}
.val{font-size:15px;display:block}</style></head><body>
<h1>Personnages</h1>
<button id="bPipo">Pipo</button><button id="bBruno">Bruno</button>
<div id="fiche">
  <span class="nom sc-interp" id="nom">Pipo</span>
  <span class="etq">Réf. CharaLead</span>
  <span class="souslabel">Prénom Nom</span>
  <span class="val" id="lead">Prénom Nom</span>
  <span class="etq">Réf. anim</span>
  <span class="val" id="refanim">Dossier à préciser</span>
</div>
<script>
var fiches = {
  Pipo:  { lead: 'Prénom Nom', refanim: 'Dossier à préciser' },
  Bruno: { lead: 'Prénom Nom', refanim: 'Dossier à préciser' }
};
var courant = 'Pipo';
function montre(qui) {
  // comme la vraie maquette : on ne repeint QUE ce qui diffère entre les deux
  // personnages — un placeholder identique n'est jamais retouché
  if (document.getElementById('nom').textContent !== qui)
    document.getElementById('nom').textContent = qui;
  if (fiches[courant].lead !== fiches[qui].lead)
    document.getElementById('lead').textContent = fiches[qui].lead;
  if (fiches[courant].refanim !== fiches[qui].refanim)
    document.getElementById('refanim').textContent = fiches[qui].refanim;
  courant = qui;
}
document.getElementById('bPipo').addEventListener('click', function () { montre('Pipo'); });
document.getElementById('bBruno').addEventListener('click', function () { montre('Bruno'); });
<\/script>
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1200, height: 700 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1200);
  const fr = p.frameLocator('#frame');
  const lead = () => fr.locator('#lead').textContent();
  const refA = () => fr.locator('#refanim').textContent();

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
    await p.waitForTimeout(900);
  };

  // ---------- 1. le charalead de Pipo — placeholder IDENTIQUE partout ----------
  await editer('#lead', 'Marie Dupont');
  if ((await lead()) !== 'Marie Dupont') fail('le charalead de Pipo n’est pas réécrit');
  ok('charalead de Pipo → « Marie Dupont »');

  await voir('Bruno');
  if ((await lead()) !== 'Prénom Nom')
    fail('le charalead de Pipo a écrasé celui de Bruno : « ' + (await lead()) + ' »');
  ok('la fiche de Bruno garde SON « Prénom Nom » — le placeholder identique n’a pas débordé');

  // ---------- 2. celui de Bruno, et la réf. anim des deux ----------
  await editer('#lead', 'Karim Ben');
  await editer('#refanim', 'srv/anim/bruno');
  await voir('Pipo');
  await editer('#refanim', 'srv/anim/pipo');
  const n = await p.$$eval('#list .it span', ns => ns.map(x => x.textContent.trim()));
  if (n.length !== 4) fail('il devrait y avoir 4 retouches, il y en a ' + n.length + ' : ' + JSON.stringify(n));
  ok('quatre retouches distinctes sur des placeholders identiques : ' + JSON.stringify(n));

  // ---------- 3. dans l'éditeur, chaque fiche montre les siens ----------
  await voir('Bruno');
  if ((await lead()) !== 'Karim Ben' || (await refA()) !== 'srv/anim/bruno')
    fail('fiche Bruno : ' + (await lead()) + ' / ' + (await refA()));
  await voir('Pipo');
  if ((await lead()) !== 'Marie Dupont' || (await refA()) !== 'srv/anim/pipo')
    fail('fiche Pipo : ' + (await lead()) + ' / ' + (await refA()));
  ok('chaque personnage garde son charalead ET sa réf. anim, en direct');

  // ---------- 4. renommer le personnage : ses retouches suivent ----------
  await editer('#nom', 'Pipou');
  await voir('Bruno');
  await voir('Pipou' === 'Pipou' ? 'Pipo' : 'Pipo');   // le bouton remet « Pipo » : la maquette réécrit le nom
  // la maquette repose « Pipo » comme nom → notre retouche de nom le repasse en « Pipou »,
  // et les retouches accrochées au nom doivent suivre
  await p.waitForTimeout(800);
  if ((await lead()) !== 'Marie Dupont')
    fail('après renommage, le charalead de Pipo est perdu : « ' + (await lead()) + ' »');
  ok('renommer le personnage n’orpheline pas ses retouches (témoin suivi)');

  // ---------- 5. export : navigation, chacun les siens ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1600);
  const lireV = () => v.evaluate(() => ({
    nom: document.getElementById('nom').textContent,
    lead: document.getElementById('lead').textContent,
    ref: document.getElementById('refanim').textContent
  }));
  let e1 = await lireV();
  if (e1.lead !== 'Marie Dupont' || e1.ref !== 'srv/anim/pipo')
    fail('export, fiche de départ (Pipo) : ' + JSON.stringify(e1));
  await v.click('#bBruno');
  await v.waitForTimeout(1600);
  const e2 = await lireV();
  if (e2.lead !== 'Karim Ben' || e2.ref !== 'srv/anim/bruno')
    fail('export, fiche Bruno : ' + JSON.stringify(e2));
  await v.click('#bPipo');
  await v.waitForTimeout(1600);
  const e3 = await lireV();
  if (e3.lead !== 'Marie Dupont' || e3.ref !== 'srv/anim/pipo')
    fail('export, retour sur Pipo : ' + JSON.stringify(e3));
  ok('export : chaque personnage garde charalead et réf. anim en naviguant');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
