/* Claude Design régénère la maquette : la structure change, tous les chemins
   internes bougent. « Reprendre d'un autre fichier… » doit quand même
   retrouver les retouches : un texte par son contenu d'origine, une image par
   sa description. Ce qui n'existe plus est laissé de côté, et annoncé. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const V1 = path.resolve(__dirname, 'maq_v1.html');
const V2 = path.resolve(__dirname, 'maq_v2.html');
const EXP1 = path.resolve(__dirname, 'v1_modifie.html');
const OUT = path.resolve(__dirname, 'v2_repris.html');
const PNG = path.resolve(__dirname, 'alt_a.png');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
fs.writeFileSync(V1, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>V1</title></head>
<body style="font-family:sans-serif;padding:30px">
<h1>Mon film</h1>
<section><p id="pitch">Le pitch du film, version longue.</p></section>
<section><p id="multi"><span>Le kit </span><em>de bienvenue</em><span> du studio.</span></p></section>
<section><img alt="Portrait — Marcel" src="${GIF}" style="width:120px;height:120px"></section>
<section><p>Un texte qui disparaîtra de la V2.</p></section>
</body></html>`);

// V2 : même contenu, structure toute différente (chemins nth-of-type cassés),
// et le troisième texte n'existe plus
fs.writeFileSync(V2, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>V2</title></head>
<body style="font-family:sans-serif;padding:30px">
<main><div><header><h1>Mon film</h1></header></div>
<div><section><div><figure><img alt="Portrait — Marcel" src="${GIF}" style="width:120px;height:120px"></figure></div></section>
<section><div><article><p>Le pitch du film, version longue.</p></article></div></section>
<section><div><p><em>Le kit</em> <span>de bienvenue du </span><span>studio.</span></p></div></section></div></main>
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1200, height: 700 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  const dialogues = [];
  p.on('dialog', d => { dialogues.push(d.message()); d.accept(); });

  // ---------- 1. retoucher la V1 et l'exporter ----------
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', V1);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1000);
  const fr = p.frameLocator('#frame');
  const edite = async (loc, texte) => {
    await p.click('#mText');
    await p.waitForTimeout(300);
    await loc.click();
    await p.waitForTimeout(300);
    await p.keyboard.press('ControlOrMeta+a');
    await p.keyboard.type(texte);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(500);
  };
  await edite(fr.locator('#pitch'), 'Le pitch corrigé, version 2.');
  await edite(fr.locator('#multi'), 'Le kit d’accueil des animateurs.');
  await edite(fr.locator('p').filter({ hasText: 'disparaîtra' }), 'Adieu.');
  await p.click('#mImg');
  await p.waitForTimeout(400);
  await fr.locator('img').click();
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', PNG);
  await p.waitForTimeout(900);
  const [dl1] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl1.saveAs(EXP1);
  ok('V1 retouchée (2 textes + 1 image) et exportée');

  // ---------- 2. ouvrir la V2 (structure changée) et reprendre ----------
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', V2);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1000);
  await p.click('#importer');
  await p.setInputFiles('#pickImp', EXP1);
  await p.waitForTimeout(1200);

  const textes = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    return { pitch: [...d.querySelectorAll('p')].map(x => x.textContent.trim()),
             img: d.querySelector('img').getAttribute('src').slice(0, 15) };
  });
  if (!textes.pitch.some(t => t === 'Le pitch corrigé, version 2.'))
    fail('le texte n’est pas repris malgré la nouvelle structure : ' + JSON.stringify(textes.pitch));
  ok('le texte corrigé est repris — retrouvé par son contenu, pas par son chemin');
  if (!textes.pitch.some(t => t === 'Le kit d’accueil des animateurs.'))
    fail('le texte en <span> multiples n’est pas repris : ' + JSON.stringify(textes.pitch));
  ok('un texte enrobé de <span> (découpage différent dans la V2) est repris aussi');
  if (!/^data:image\/png/.test(textes.img))
    fail('l’image n’est pas reprise : ' + textes.img);
  ok('l’image est reprise — retrouvée par sa description');
  if (!dialogues.length || !/laissée/.test(dialogues.join(' ')))
    fail('la retouche du texte disparu devrait être annoncée comme laissée de côté : ' + JSON.stringify(dialogues));
  ok('le texte qui n’existe plus est laissé de côté, et annoncé : ' +
    JSON.stringify(dialogues[0].slice(0, 80)));

  // ---------- 3. l'export de la V2 rejoue le tout ----------
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl2.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1200);
  const fin = await v.evaluate(() => ({
    pitch: [...document.querySelectorAll('p')].map(x => x.textContent.trim()),
    img: document.querySelector('img').getAttribute('src').slice(0, 15)
  }));
  if (!fin.pitch.some(t => t === 'Le pitch corrigé, version 2.') || !/^data:image\/png/.test(fin.img))
    fail('export V2 : ' + JSON.stringify(fin));
  ok('export de la V2 : texte et image repris, rejoués');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
