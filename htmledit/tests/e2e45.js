/* Deux gestes ajoutés : lâcher un fichier image directement sur la page, et
   cliquer une ligne de « Mes retouches » pour se rendre à l'endroit. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_drop.html');
const PNG = path.resolve(__dirname, 'remplacement.png');
const OUT = path.resolve(__dirname, 'drop_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

const VIDE = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Depot</title>
<style>body{font-family:sans-serif;padding:20px;background:#eee;margin:0}
img{display:block;width:320px;height:200px;object-fit:cover;background:#ccd}
.loin{margin-top:1600px}
.pile{position:relative;width:320px;height:200px;margin-top:24px}
.pile img{position:absolute;inset:0;width:100%;height:100%}
.pile img.dessous{opacity:0}</style></head><body>
<h1>Dépôt</h1>
<img id="haut" alt="Bandeau du haut" src="${VIDE}">
<div class="pile"><img class="dessous" alt="Planche A" src="${VIDE}"><img alt="Planche B" src="${VIDE}"></div>
<p class="loin">tout en bas</p>
<img id="bas" alt="Visuel du bas" src="${VIDE}">
</body></html>`);

const b64 = fs.readFileSync(PNG).toString('base64');

// lâcher un vrai fichier à un endroit précis de la page affichée
async function lacher(p, sel, fichier) {
  return p.evaluate(({ sel, b64, nom, type }) => {
    const d = document.getElementById('frame').contentDocument;
    const el = d.querySelector(sel);
    if (!el) return 'introuvable';
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const dt = new DataTransfer();
    dt.items.add(new File([arr], nom, { type: type }));
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const W = d.defaultView;
    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt };
    el.dispatchEvent(new W.DragEvent('dragover', opts));
    const ev = new W.DragEvent('drop', opts);
    el.dispatchEvent(ev);
    return ev.defaultPrevented ? 'retenu' : 'laisse-passer';
  }, { sel, b64, nom: fichier, type: /\.png$/.test(fichier) ? 'image/png' : 'text/plain' });
}

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

  // ---------- 1. hors du mode Images : la page ne doit surtout pas partir ----------
  await p.click('#mText');
  await p.waitForTimeout(300);
  const horsMode = await lacher(p, '#haut', 'remplacement.png');
  if (horsMode !== 'retenu')
    fail('un fichier lâché en mode Textes n’est pas retenu : l’aperçu quitterait la page (' + horsMode + ')');
  ok('un fichier lâché hors du mode Images est retenu — l’aperçu ne quitte pas la page');
  if (await p.$$eval('#list .it', n => n.length))
    fail('une retouche a été créée alors qu’on n’est pas en mode Images');

  // ---------- 2. lâcher sur une image la remplace, sans sélecteur de fichier ----------
  await p.click('#mImg');
  await p.waitForTimeout(500);
  const r1 = await lacher(p, '#haut', 'remplacement.png');
  if (r1 !== 'retenu') fail('le dépôt n’a pas été pris en charge (' + r1 + ')');
  await p.waitForTimeout(900);
  const s1 = await fr.locator('#haut').getAttribute('src');
  if (s1.indexOf('data:image/png') !== 0) fail('l’image n’a pas été remplacée : ' + s1.slice(0, 30));
  ok('un fichier lâché sur une image la remplace directement');
  const lab = await p.$$eval('#list .it span', n => n.map(x => x.textContent));
  if (!lab.length || !/remplacement\.png/.test(lab[0]))
    fail('la retouche n’apparaît pas dans la liste : ' + JSON.stringify(lab));
  ok('la retouche est listée : « ' + lab[0] + ' »');

  // ---------- 3. sur des images empilées, l'outil demande laquelle ----------
  const r2 = await lacher(p, '.pile img:not(.dessous)', 'remplacement.png');
  if (r2 !== 'retenu') fail('dépôt sur la pile non pris en charge');
  await p.waitForTimeout(700);
  if (await p.$eval('#askg', e => e.classList.contains('hidden')))
    fail('images empilées : l’outil n’a pas demandé laquelle remplacer');
  const noms = await p.$$eval('#askgGrid .gi .nm', ns => ns.map(n => n.textContent.trim()));
  if (noms.length < 2) fail('le choix ne montre pas les deux planches : ' + JSON.stringify(noms));
  ok('images empilées : l’outil demande laquelle — ' + JSON.stringify(noms));

  // et le fichier déjà lâché sert : pas de sélecteur qui se rouvre
  const iA = noms.findIndex(n => /Planche A$/.test(n));
  await p.locator('#askgGrid .gi').nth(iA < 0 ? 0 : iA).click();
  await p.waitForTimeout(900);
  const sA = await fr.locator('img[alt="Planche A"]').getAttribute('src');
  if (sA.indexOf('data:image/png') !== 0)
    fail('le fichier lâché n’a pas servi après le choix : ' + sA.slice(0, 30));
  ok('le fichier lâché est réutilisé après le choix — on ne le redemande pas');
  await p.click('#askgNo');
  await p.waitForTimeout(300);

  // annuler le choix ne doit pas laisser un fichier « en attente » qui partirait
  const r3 = await lacher(p, '.pile img:not(.dessous)', 'remplacement.png');
  if (r3 !== 'retenu') fail('2e dépôt sur la pile non pris en charge');
  await p.waitForTimeout(600);
  await p.click('#askgNo');
  await p.waitForTimeout(300);
  const avant = await p.$$eval('#list .it', n => n.length);
  await fr.locator('#haut').click();
  await p.waitForTimeout(500);
  const ouvert = await p.evaluate(() => !!document.getElementById('pickImg'));
  const apres = await p.$$eval('#list .it', n => n.length);
  if (apres !== avant)
    fail('un clic après un dépôt annulé a posé une image toute seule (' + avant + ' → ' + apres + ')');
  ok('un dépôt annulé ne laisse pas de fichier qui se poserait au clic suivant');

  // ---------- 4. un fichier qui n'est pas une image est refusé proprement ----------
  const n0 = await p.$$eval('#list .it', n => n.length);
  await lacher(p, '#haut', 'notes.txt');
  await p.waitForTimeout(600);
  const n1 = await p.$$eval('#list .it', n => n.length);
  if (n1 !== n0) fail('un fichier texte a été posé comme image');
  const t = await p.$eval('#toast', e => e.textContent);
  if (!/image/i.test(t)) fail('rien n’est dit sur le fichier refusé : « ' + t + '»');
  ok('un fichier qui n’est pas une image est refusé, et l’outil le dit : « ' + t.trim() + ' »');

  // ---------- 5. cliquer une ligne de la liste emmène à l'endroit ----------
  // on pose une retouche tout en bas, puis on remonte tout en haut
  await fr.locator('#bas').scrollIntoViewIfNeeded();
  await p.waitForTimeout(400);
  await fr.locator('#bas').click();
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', PNG);
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    d.defaultView.scrollTo(0, 0);
  });
  await p.waitForTimeout(500);
  const loin = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    return d.getElementById('bas').getBoundingClientRect().top;
  });
  if (loin < 800) fail('le visuel du bas n’est pas assez loin pour tester (' + Math.round(loin) + 'px)');
  const ligne = p.locator('#list .it').filter({ hasText: 'Visuel du bas' }).first();
  if (!(await ligne.count())) {
    const tout = await p.$$eval('#list .it span', n => n.map(x => x.textContent));
    fail('retouche du bas introuvable dans la liste : ' + JSON.stringify(tout));
  }
  const titre = await ligne.locator('span').first().getAttribute('title');
  if (!/page/i.test(titre || '')) fail('la ligne ne dit pas qu’elle est cliquable : ' + titre);
  await ligne.locator('span').first().click();
  await p.waitForTimeout(1600);
  const proche = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    return d.getElementById('bas').getBoundingClientRect().top;
  });
  if (proche > 700) fail('le clic n’a pas emmené à la retouche (' + Math.round(loin) + ' → ' + Math.round(proche) + ')');
  ok('cliquer une ligne emmène à l’endroit dans la page (' + Math.round(loin) + 'px → ' + Math.round(proche) + 'px)');

  // ---------- 6. export : les dépôts sont rejoués comme les autres retouches ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1500);
  const fin = await v.evaluate(() => {
    const g = s => { const n = document.querySelector(s); return n ? n.getAttribute('src').slice(0, 14) : null; };
    return { haut: g('#haut'), planche: g('img[alt="Planche A"]'), bas: g('#bas') };
  });
  if (fin.haut !== 'data:image/png') fail('export : le dépôt du haut est perdu (' + fin.haut + ')');
  if (fin.planche !== 'data:image/png') fail('export : le dépôt sur la pile est perdu (' + fin.planche + ')');
  if (fin.bas !== 'data:image/png') fail('export : le visuel du bas est perdu (' + fin.bas + ')');
  ok('fichier exporté : les trois remplacements sont rejoués');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
