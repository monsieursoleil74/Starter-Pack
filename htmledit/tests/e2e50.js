/* Retours de terrain : 1) une maquette générée enrobe ses textes dans des
   <span>/<em> — ils doivent rester éditables ; 2) coller depuis Google Slides
   ne fournit parfois que du HTML ; 3) le glisser du recadrage doit marcher
   même quand le visuel est sous un dégradé et du texte. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_terrain.html');
const LARGE = path.resolve(__dirname, 'large.png');
const OUT = path.resolve(__dirname, 'terrain_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

const VIDE = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Terrain</title>
<style>body{font-family:sans-serif;padding:24px;background:#eee}
.carte{position:relative;width:280px;height:360px;overflow:hidden;border-radius:12px}
.carte img{width:100%;height:100%;object-fit:cover;display:block}
.carte .voile{position:absolute;inset:0;background:linear-gradient(transparent,rgba(0,0,0,.8))}
.carte .titre{position:absolute;bottom:12px;left:12px;color:#fff;font-weight:bold}
.gros section{margin:2px}</style></head><body>
<h1><span>Le </span><span>titre </span><span>en spans</span></h1>
<p id="pitch">Le kit de bienvenue. <em>(Version <span>démo</span>.)</em></p>
<div class="gros" id="gros"><section><span>Bloc un.</span></section><section><span>Bloc deux.</span></section>
<section><span>Bloc trois qui fait du volume pour dépasser la limite du paragraphe et ne pas être
pris pour un simple texte. On ajoute des mots, encore des mots, toujours des mots, pour que la
longueur totale dépasse largement les huit cents caractères qui servent de garde-fou au mode
texte. Encore une phrase. Et une autre. Et une autre encore, pour être bien sûr que ce gros
conteneur ne soit jamais proposé à l'édition d'un seul bloc, parce que l'éditer d'un coup
écraserait la structure de toute la section, ce qui serait une très mauvaise idée pour la
maquette. Toujours plus de mots pour gonfler artificiellement la taille de ce bloc de texte de
démonstration, jusqu'à franchir le seuil voulu, c'est bientôt fait, encore quelques dizaines de
caractères et nous y serons enfin, voilà, ce doit être bon maintenant.</span></section></div>
<div class="carte"><img id="proto" alt="Proto" src="${VIDE}"><div class="voile"></div>
<div class="titre">Ton &amp; intentions</div></div>
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1300, height: 850 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1500);
  const fr = p.frameLocator('#frame');

  // ---------- 1. un paragraphe plein de spans/em s'édite en entier ----------
  await fr.locator('#pitch').click();
  await p.waitForTimeout(500);
  let edit = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const n = d.querySelector('[contenteditable]');
    return n ? n.id || n.tagName : null;
  });
  if (edit !== 'pitch') fail('le paragraphe à <em>/<span> ne s’édite pas (editable = ' + edit + ')');
  ok('un paragraphe enrobé de <em>/<span> s’édite en entier');

  // ---------- 2. coller du HTML SANS text/plain (zone de texte Google Slides) ----------
  const colle = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const n = d.querySelector('[contenteditable]');
    const dt = new DataTransfer();
    dt.setData('text/html',
      '<meta charset="utf-8"><b style="font-size:48px;color:red">Colle&nbsp;Slides</b>');
    n.dispatchEvent(new d.defaultView.ClipboardEvent('paste',
      { bubbles: true, cancelable: true, clipboardData: dt }));
    return n.textContent;
  });
  if (!/Colle Slides/.test(colle)) fail('le collé HTML-seul n’a pas donné de texte : « ' + colle + ' »');
  if (/48px|color/.test(colle)) fail('la mise en forme du collé a fui dans le texte');
  ok('coller une zone Google Slides (HTML sans text/plain) colle bien le texte, sans le style');
  await fr.locator('h1').click();      // valider
  await p.waitForTimeout(500);

  // le titre en spans aussi
  await fr.locator('h1').click();
  await p.waitForTimeout(400);
  edit = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const n = d.querySelector('[contenteditable]');
    return n ? n.tagName : null;
  });
  if (edit !== 'H1') fail('le titre en spans ne s’édite pas');
  await p.keyboard.press('Escape');
  ok('un titre découpé en <span> s’édite aussi');

  // et le GROS conteneur de sections, lui, ne doit PAS devenir éditable d'un bloc
  await fr.locator('#gros').click({ position: { x: 4, y: 4 } });
  await p.waitForTimeout(400);
  const gros = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const n = d.querySelector('[contenteditable]');
    return n ? (n.id || n.tagName) : null;
  });
  if (gros === 'gros') fail('toute la section (3 blocs) est passée en édition d’un seul coup');
  ok('un gros conteneur ne s’édite pas d’un bloc (protégé) — cliqué : ' + (gros || 'rien'));
  if (gros) await p.keyboard.press('Escape');

  // ---------- 3. recadrer un visuel posé SOUS un dégradé + un titre ----------
  await p.click('#mImg');
  await p.waitForTimeout(400);
  await fr.locator('.carte .voile').click({ force: true });
  await p.waitForTimeout(600);
  if (!(await p.$eval('#askg', e => e.classList.contains('hidden')))) {
    await p.locator('#askgGrid .gi').first().click();
  }
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', LARGE);
  await p.waitForTimeout(1200);
  if (await p.$eval('#crop', e => e.classList.contains('hidden')))
    fail('le recadrage ne s’ouvre pas sur l’image rognée');
  await p.locator('#cropZ').fill('180');
  await p.locator('#cropZ').dispatchEvent('input');
  await p.waitForTimeout(300);

  const lire = () => p.evaluate(() => {
    const n = document.getElementById('frame').contentDocument.getElementById('proto');
    return n.style.objectPosition;
  });
  const b0 = await p.locator('#frame').boundingBox();
  const c0 = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const r = d.getElementById('proto').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  const avant = await lire();
  // le geste part du MILIEU de la carte — donc sur le dégradé, pas sur l'image
  await p.mouse.move(b0.x + c0.x, b0.y + c0.y);
  await p.mouse.down();
  await p.mouse.move(b0.x + c0.x, b0.y + c0.y + 80, { steps: 8 });
  await p.mouse.up();
  await p.waitForTimeout(400);
  const apres = await lire();
  if (avant.split(' ')[1] === apres.split(' ')[1])
    fail('glisser à travers le dégradé ne déplace pas l’image en hauteur (' + avant + ' → ' + apres + ')');
  ok('le glisser traverse le dégradé : l’image bouge en hauteur (' + avant + ' → ' + apres + ')');

  // pendant le recadrage, un CLIC sur l'image ne doit PAS relancer un
  // remplacement (le sélecteur de fichier qui s'ouvre en plein repositionnement)
  await p.evaluate(() => {
    window._pkPick = 0;
    document.getElementById('pickImg').addEventListener('click', () => window._pkPick++);
  });
  await p.mouse.click(b0.x + c0.x, b0.y + c0.y);
  await p.waitForTimeout(500);
  if (await p.evaluate(() => window._pkPick))
    fail('cliquer l’image pendant le recadrage rouvre le sélecteur de fichier');
  if (await p.$eval('#crop', e => e.classList.contains('hidden')))
    fail('le recadrage s’est fermé sur un simple clic');
  ok('un clic pendant le recadrage ne rouvre plus le sélecteur de fichier');
  await p.click('#cropOk');

  // ---------- 4. export : le texte aplati proprement, le cadrage tenu ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1500);
  const fin = await v.evaluate(() => ({
    pitch: document.getElementById('pitch').textContent,
    pos: document.getElementById('proto').style.objectPosition,
    src: document.getElementById('proto').getAttribute('src').slice(0, 14)
  }));
  if (!/Colle Slides/.test(fin.pitch)) fail('export : le texte collé est perdu : « ' + fin.pitch + ' »');
  if (fin.src !== 'data:image/png') fail('export : l’image de la carte est perdue');
  if (fin.pos !== apres) fail('export : le cadrage vertical est perdu (' + fin.pos + ' au lieu de ' + apres + ')');
  ok('export : texte collé et cadrage vertical rejoués à l’identique');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
