/* Une maquette SANS réserve qui réutilise la même balise <img> pour deux
   personnages (seul le alt change). Remplacer l'image de Pipo PUIS celle de
   Bruno doit donner DEUX retouches — pas la seconde qui écrase la première. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_alt.html');
const OUT = path.resolve(__dirname, 'alt_modifie.html');
const A = path.resolve(__dirname, 'alt_a.png');
const B = path.resolve(__dirname, 'alt_b.png');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

let TAB = null;
function crc32(buf) {
  if (!TAB) { TAB = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; TAB[n] = c >>> 0; } }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = TAB[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function png(r, g, b) {
  const W = 8, H = 8;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) { raw[y * (1 + W * 3)] = 0;
    for (let x = 0; x < W; x++) { const o = y * (1 + W * 3) + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; } }
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t, 'ascii'), d]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
fs.writeFileSync(A, png(200, 20, 20));
fs.writeFileSync(B, png(20, 20, 200));

const VIDE = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fiche partagée</title>
<style>body{font-family:sans-serif;padding:20px;background:#eee}
#fiche{width:280px;height:200px;object-fit:cover;background:#ccd;display:block}</style>
</head><body>
<h1>Personnages</h1>
<button id="bPipo">Voir Pipo</button>
<button id="bBruno">Voir Bruno</button>
<img id="fiche" alt="Pipo" src="${VIDE}">
<script>
var fiches = { Pipo: '${VIDE}', Bruno: '${VIDE}' };
function montre(qui) {
  var f = document.getElementById('fiche');
  f.setAttribute('alt', qui);
  f.setAttribute('src', fiches[qui]);
}
document.getElementById('bPipo').addEventListener('click', function () { montre('Pipo'); });
document.getElementById('bBruno').addEventListener('click', function () { montre('Bruno'); });
<\/script>
</body></html>`);

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

  // ---------- 1. remplacer la fiche de Pipo ----------
  await p.click('#mImg');
  await p.waitForTimeout(600);
  await fr.locator('#fiche').click();
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', A);
  await p.waitForTimeout(1000);
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden')))) await p.click('#cropOk');
  const s1 = await fr.locator('#fiche').getAttribute('src');
  if (s1.indexOf('data:image/png') !== 0) fail('la fiche de Pipo n’est pas remplacée');
  ok('fiche de Pipo remplacée (alt = Pipo)');

  // ---------- 2. la page passe à Bruno, on remplace AUSSI sa fiche ----------
  await p.click('#mView');
  await p.waitForTimeout(300);
  await fr.locator('#bBruno').click();
  await p.waitForTimeout(600);
  const altB = await fr.locator('#fiche').getAttribute('alt');
  if (altB !== 'Bruno') fail('la maquette n’a pas basculé sur Bruno : ' + altB);
  await p.click('#mImg');
  await p.waitForTimeout(500);
  await fr.locator('#fiche').click();
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', B);
  await p.waitForTimeout(1000);
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden')))) await p.click('#cropOk');
  ok('fiche de Bruno remplacée (alt = Bruno)');

  // ---------- 3. LE point : les deux retouches doivent coexister ----------
  const n = await p.$$eval('#list .it span', ns => ns.map(x => x.textContent.trim()));
  if (n.length !== 2)
    fail('la retouche de Bruno a écrasé celle de Pipo — ' + n.length +
         ' retouche(s) au lieu de 2 : ' + JSON.stringify(n));
  if (!n.some(t => /Pipo/.test(t)) || !n.some(t => /Bruno/.test(t)))
    fail('les retouches ne disent pas leur personnage : ' + JSON.stringify(n));
  ok('deux retouches distinctes, une par personnage : ' + JSON.stringify(n));

  // ---------- 4. export : chacun garde la sienne ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const b64A = fs.readFileSync(A).toString('base64');
  const b64B = fs.readFileSync(B).toString('base64');
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1500);
  const lit = () => v.evaluate(() => {
    const f = document.getElementById('fiche');
    return { alt: f.getAttribute('alt'), src: f.getAttribute('src') };
  });
  const e1 = await lit();
  if (e1.alt !== 'Pipo') fail('export : la page ne démarre pas sur Pipo');
  if (e1.src !== 'data:image/png;base64,' + b64A)
    fail('export : Pipo n’a pas SA fiche (' + e1.src.slice(0, 30) + '…)');
  ok('export : Pipo affiche sa fiche à lui');
  await v.click('#bBruno');
  await v.waitForTimeout(1400);
  const e2 = await lit();
  if (e2.src !== 'data:image/png;base64,' + b64B)
    fail('export : Bruno n’a pas SA fiche (' + e2.src.slice(0, 30) + '…)');
  ok('export : Bruno affiche la sienne');
  await v.click('#bPipo');
  await v.waitForTimeout(1400);
  const e3 = await lit();
  if (e3.src !== 'data:image/png;base64,' + b64A)
    fail('export : au retour sur Pipo, sa fiche est perdue (' + e3.src.slice(0, 30) + '…)');
  ok('export : on rebascule sur Pipo, sa fiche est toujours là');
  await v.close();

  // ---------- 5. « Reprendre d'un autre fichier » garde AUSSI les deux ----------
  p.on('dialog', d => { console.log('   (dialogue : ' + d.message().slice(0, 70) + '…)'); d.dismiss(); });
  await p.setInputFiles('#pick', []);           // même fichier que la 1re fois :
  await p.setInputFiles('#pick', MAQ);          // il faut que ça rouvre quand même
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1500);
  const nV = await p.$$eval('#list .it span', ns => ns.map(x => x.textContent.trim()));
  if (nV.length) fail('la maquette vierge a des retouches : ' + JSON.stringify(nV));
  await p.setInputFiles('#pickImp', OUT);       // on rapatrie le travail
  await p.waitForTimeout(1500);
  const nI = await p.$$eval('#list .it span', ns => ns.map(x => x.textContent.trim()));
  if (nI.length !== 2)
    fail('l’import a perdu une des deux fiches : ' + JSON.stringify(nI));
  if (!nI.some(t => /Pipo/.test(t)) || !nI.some(t => /Bruno/.test(t)))
    fail('l’import ne garde pas un personnage par retouche : ' + JSON.stringify(nI));
  ok('« Reprendre d’un autre fichier » garde les deux fiches : ' + JSON.stringify(nI));

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
