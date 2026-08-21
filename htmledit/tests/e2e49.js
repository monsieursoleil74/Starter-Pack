/* Audit : les coins jamais testés. Un texte qui contient « </script> » et des
   emoji, les raccourcis clavier selon où est le focus, Échap sur le choix
   d'images, et le cycle export → redépôt → export (un seul correctif). */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_audit.html');
const PNG = path.resolve(__dirname, 'remplacement.png');
const OUT = path.resolve(__dirname, 'audit_modifie.html');
const OUT2 = path.resolve(__dirname, 'audit_modifie_2.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

const VIDE = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Audit</title>
<style>body{font-family:sans-serif;padding:20px;background:#eee}
img{width:220px;height:150px;object-fit:cover;background:#ccd;margin:4px}
.pile{position:relative;width:220px;height:150px;display:inline-block}
.pile img{position:absolute;inset:0;margin:0}
.pile img.dessous{opacity:0}</style></head><body>
<h1 id="titre">Le titre du pack</h1>
<p id="pitch">Le pitch du film, à réécrire.</p>
<img id="banniere" alt="Bannière" src="${VIDE}">
<div class="pile"><img class="dessous" alt="Plan A" src="${VIDE}"><img alt="Plan B" src="${VIDE}"></div>
<a id="lien" href="#">Le drive</a>
</body></html>`);

const TEXTE = 'Fin d’acte : le </script> s’affiche tel quel — 🎬 été à Noël';

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

  // ---------- 1. un texte piégé : « </script> », emoji, accents ----------
  await fr.locator('#pitch').click();
  await p.waitForTimeout(300);
  await p.keyboard.press('ControlOrMeta+a');
  await p.keyboard.type(TEXTE);
  await fr.locator('#titre').click();      // un clic ailleurs valide
  await p.waitForTimeout(500);
  const lu = await fr.locator('#pitch').textContent();
  if (lu !== TEXTE) fail('le texte piégé n’est pas retenu : « ' + lu + ' »');
  ok('texte avec « </script> », emoji et accents retenu dans l’éditeur');

  // au passage : rééditer le MÊME texte ne crée pas une 2e retouche
  await fr.locator('#pitch').click();
  await p.waitForTimeout(300);
  await p.keyboard.press('End');
  await p.keyboard.type(' !');
  await fr.locator('#titre').click();
  await p.waitForTimeout(500);
  const nT = await p.$$eval('#list .it', ns => ns.length);
  if (nT !== 1) fail('rééditer le même texte a créé ' + nT + ' retouches');
  ok('rééditer le même texte remplace la retouche, sans doublon');

  // ---------- 2. une image + un lien avec une adresse à guillemets ----------
  await p.click('#mImg');
  await p.waitForTimeout(400);
  await fr.locator('#banniere').click();
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', PNG);
  await p.waitForTimeout(900);
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden')))) await p.click('#cropOk');
  await p.click('#mLink');
  await p.waitForTimeout(400);
  await fr.locator('#lien').click();
  await p.waitForTimeout(400);
  if (await p.$eval('#askl', e => e.classList.contains('hidden'))) fail('la fenêtre de lien ne s’ouvre pas');
  const URL_PIEGE = 'https://drive.example.com/d/abc?nom="rex & pipo"&v=2';
  await p.fill('#asklUrl', URL_PIEGE);
  await p.click('#asklOk');
  await p.waitForTimeout(500);
  ok('lien enregistré avec guillemets et esperluettes dans l’adresse');

  // ---------- 3. les raccourcis suivent le focus ----------
  await p.click('#mImg');
  await p.waitForTimeout(300);
  // focus dans la PAGE (clic sur un endroit neutre), puis Ctrl+Z
  const avant = await p.$$eval('#list .it', ns => ns.length);
  await fr.locator('#titre').click();
  await p.waitForTimeout(200);
  await p.keyboard.press('ControlOrMeta+z');
  await p.waitForTimeout(500);
  const apres = await p.$$eval('#list .it', ns => ns.length);
  if (apres !== avant - 1) fail('Ctrl+Z depuis la page n’annule pas (' + avant + ' → ' + apres + ')');
  ok('Ctrl+Z fonctionne même quand le focus est dans la page (' + avant + ' → ' + apres + ')');
  // on remet le lien annulé
  await p.click('#mLink');
  await p.waitForTimeout(300);
  await fr.locator('#lien').click();
  await p.waitForTimeout(400);
  await p.fill('#asklUrl', URL_PIEGE);
  await p.click('#asklOk');
  await p.waitForTimeout(400);

  // Ctrl+Z DANS un champ de saisie ne doit PAS annuler une retouche
  const n2 = await p.$$eval('#list .it', ns => ns.length);
  await fr.locator('#lien').click();
  await p.waitForTimeout(400);
  await p.click('#asklUrl');
  await p.keyboard.type('xyz');
  await p.keyboard.press('ControlOrMeta+z');
  await p.waitForTimeout(400);
  const n3 = await p.$$eval('#list .it', ns => ns.length);
  if (n3 !== n2) fail('Ctrl+Z dans le champ d’adresse a annulé une retouche (' + n2 + ' → ' + n3 + ')');
  ok('Ctrl+Z dans un champ de saisie n’annule pas de retouche');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  if (!(await p.$eval('#askl', e => e.classList.contains('hidden'))))
    fail('Échap ne ferme pas la fenêtre de lien depuis son champ');
  ok('Échap referme la fenêtre de lien');

  // ---------- 4. Échap ferme le choix d'images empilées ----------
  await p.click('#mImg');
  await p.waitForTimeout(300);
  await fr.locator('.pile img:not(.dessous)').click();
  await p.waitForTimeout(500);
  if (await p.$eval('#askg', e => e.classList.contains('hidden'))) fail('le choix de pile ne s’ouvre pas');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  if (!(await p.$eval('#askg', e => e.classList.contains('hidden'))))
    fail('Échap ne ferme pas le choix d’images empilées');
  ok('Échap ferme le choix d’images empilées');

  // ---------- 5. export → redépôt → export : un seul correctif, rien de perdu ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const t1 = fs.readFileSync(OUT, 'utf8');
  const blocs1 = (t1.match(/<!--pack-edit-->/g) || []).length;
  if (blocs1 !== 1) fail('export : ' + blocs1 + ' blocs correctifs au lieu d’un');
  ok('1er export : un seul bloc correctif');

  // redéposer le fichier exporté : les retouches reviennent
  await p.setInputFiles('#pick', OUT);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1500);
  const repris = await p.$$eval('#list .it', ns => ns.length);
  if (repris !== 3) fail('redépôt : ' + repris + ' retouche(s) reprises au lieu de 3');
  ok('redépôt du fichier exporté : les 3 retouches sont reprises');

  const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl2.saveAs(OUT2);
  const t2 = fs.readFileSync(OUT2, 'utf8');
  const blocs2 = (t2.match(/<!--pack-edit-->/g) || []).length;
  if (blocs2 !== 1) fail('2e export : ' + blocs2 + ' blocs correctifs — le correctif s’empile');
  ok('2e export : toujours un seul bloc correctif, pas d’empilement');

  // ---------- 6. le fichier final rejoue tout, texte piégé compris ----------
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT2);
  await v.waitForTimeout(1500);
  const fin = await v.evaluate(() => ({
    pitch: document.getElementById('pitch').textContent,
    ban: document.getElementById('banniere').getAttribute('src').slice(0, 14),
    href: document.getElementById('lien').getAttribute('href')
  }));
  if (fin.pitch !== TEXTE + ' !') fail('export : le texte piégé est déformé : « ' + fin.pitch + ' »');
  ok('export : le texte avec « </script> » et emoji est rejoué à l’identique');
  if (fin.ban !== 'data:image/png') fail('export : la bannière est perdue');
  if (fin.href !== URL_PIEGE) fail('export : l’adresse à guillemets est déformée : ' + fin.href);
  ok('export : l’image et le lien à guillemets sont rejoués');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
