/* Un visuel EMBARQUÉ de plusieurs Mo (vidéo charalead, grande image) :
   le fichier exporté collait la data URI complète dans les src et dans la
   feuille de propagation, à CHAQUE passe — les machines modestes figeaient
   sur une page blanche. Désormais tout passe par une URL blob courte,
   créée une fois. La data URI reste intacte dans le bloc (redépôt inchangé).
   Usage : node e2e79.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_reserve.html');       // écrite par e2e76
const DONOR = path.resolve(__dirname, 'donor_gros.html');
const OUT = path.resolve(__dirname, 'e2e79_export.html');
const PNG = path.resolve(__dirname, 'alt_a.png');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }
if (!fs.existsSync(MAQ)) { console.error('lance e2e76 d’abord (maq_reserve.html)'); process.exit(1); }

// un « gros » PNG : le vrai pixel + 8 Mo de bourrage base64 valide (le PNG
// s'arrête à IEND, le décodeur ignore la suite — l'image reste décodable)
const brut = fs.readFileSync(PNG);
const gros = Buffer.concat([brut, Buffer.alloc(8 * 1024 * 1024, 0x41)]);
const dataUri = 'data:image/png;base64,' + gros.toString('base64');
const patchs = [{ id: 'pgros1', kind: 'img', src: 'reserve', k: 'assets/planche01.png',
  sel: 'body:nth-of-type(1)>div:nth-of-type(1)>img:nth-of-type(1)',
  before: 'assets/planche01.png', after: dataUri, label: 'planche lourde' }];
fs.writeFileSync(DONOR, `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>x
<!--pack-edit-->
<script id="pack-edit-data" type="application/json">${JSON.stringify(patchs)}</script>
<!--/pack-edit-->
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1100, height: 700 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => { if (!/Clipboard|writeText/.test(e.message)) errs.push(e.message); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1500);
  await p.setInputFiles('#pickImp', DONOR);
  await p.waitForTimeout(3000);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  ok('export produit (' + Math.round(fs.statSync(OUT).size / 1e6) + ' Mo)');

  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  // on note QUAND l'outil remplace la réserve : si la planche reste vide,
  // le message dit tout de suite s'il a perdu la course ou mal peint
  await v.addInitScript(() => {
    window.__t0 = Date.now(); window.__quand = null;
    const it = setInterval(() => {
      const im = document.querySelector('#rg-assetmap img');
      if (im && /^blob:|^data:/.test(im.getAttribute('src') || '')) {
        window.__quand = Date.now() - window.__t0; clearInterval(it);
      }
    }, 10);
  });
  await v.goto('file://' + OUT);
  await v.waitForTimeout(3500);

  // 1. la page vit (le canvas peint depuis la réserve reprise)
  const px = await v.evaluate(() => {
    const cv = document.getElementById('planche');
    const d = cv.getContext('2d').getImageData(0, 0, 80, 60).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  });
  if (px === 0) fail('export ouvert : la planche reprise ne s’affiche pas (réserve remplacée après ' +
    (await v.evaluate(() => window.__quand)) + ' ms, l’appli la lit à 900 ms)');
  ok('export ouvert : la planche s’affiche (' + px + ' pixels)');

  // 2. plus de data URI géante dans les src ni la feuille de propagation
  const usage = await v.evaluate(() => {
    const st = document.getElementById('pack-edit-prop');
    const srcs = [...document.querySelectorAll('img,video')].map(x => x.getAttribute('src') || '');
    return {
      cssData: !!(st && st.textContent.indexOf('data:') >= 0),
      cssTaille: st ? st.textContent.length : 0,
      srcData: srcs.some(x => x.length > 1e6),
      srcBlob: srcs.some(x => x.indexOf('blob:') === 0),
    };
  });
  if (usage.cssData || usage.cssTaille > 100000)
    fail('la feuille de propagation embarque encore la data URI (' + usage.cssTaille + ' octets)');
  if (usage.srcData) fail('un src porte encore la data URI complète');
  if (!usage.srcBlob) fail('aucune URL blob posée — le visuel embarqué n’est pas servi en blob');
  ok('data URI convertie en URL blob : src et CSS restent légers');

  // 3. la page reste RÉACTIVE (pas de reconstruction géante à chaque passe)
  let pire = 0;
  for (let i = 0; i < 5; i++) {
    await v.waitForTimeout(1100);          // laisse passer une passe d'ap()
    const t0 = Date.now();
    await v.evaluate(() => 1);
    pire = Math.max(pire, Date.now() - t0);
  }
  if (pire > 500) fail('la page reste engorgée : aller-retour de ' + pire + ' ms');
  ok('la page reste réactive (pire aller-retour : ' + pire + ' ms)');

  // 4. le bloc, lui, garde la data URI intacte (le redépôt continue de marcher)
  const dd = JSON.parse(fs.readFileSync(OUT, 'utf8')
    .match(/<script id="pack-edit-data"[^>]*>([\s\S]*?)<\/script>/)[1].replace(/<\\\//g, '</'));
  const pg = dd.find(x => x.k === 'assets/planche01.png');
  if (!pg || pg.after.indexOf('data:image/png;base64,') !== 0 || pg.after.length < 8 * 1024 * 1024)
    fail('la data URI n’est plus intacte dans le bloc exporté');
  if (pg.pkBu) fail('l’URL blob (éphémère) ne doit pas être exportée');
  ok('la data URI reste intacte dans le bloc — le redépôt est préservé');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
