/* Poser une série d'images d'un coup : lâcher plusieurs fichiers sur une
   famille de la liste doit les ranger dans l'ordre, après avoir montré
   l'appariement — et l'export doit tout rejouer. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_lot.html');
const OUT = path.resolve(__dirname, 'lot_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

const VIDE = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

// une maquette avec une réserve, comme celles de Claude Design
const K = [
  'assets_nda/personnages/rex/rex_portrait.png',
  'assets_nda/personnages/rex/rex_planche_02.png',
  'assets_nda/personnages/rex/rex_planche_03.png',
  'assets_nda/personnages/rex/rex_planche_10.png',
  'assets_nda/personnages/pipo/pipo_portrait.png',
  'assets_nda/personnages/pipo/pipo_planche_01.png',
  'assets_nda/decors/foret.png'
];
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Lot</title>
<style>body{font-family:sans-serif;padding:20px;background:#eee}
#rg-assetmap{display:none}
.v{width:200px;height:140px;object-fit:cover;background:#ccd;margin:6px;display:inline-block}</style>
</head><body>
<h1>Personnages</h1>
<div id="rg-assetmap">${K.map((k, i) => `<img data-k="${k}" src="${VIDE}#e${i}">`).join('')}</div>
<div id="scene"></div>
<script>
// la page pioche dans la réserve, comme une vraie maquette
var m = {};
document.querySelectorAll('#rg-assetmap [data-k]').forEach(function (n) { m[n.getAttribute('data-k')] = n.getAttribute('src'); });
document.getElementById('scene').innerHTML = Object.keys(m).map(function (k) {
  return '<img class="v" alt="' + k.split('/').pop().replace('.png','') + '" src="' + m[k] + '">';
}).join('');
<\/script>
</body></html>`);

// des PNG distincts : une couleur par fichier, pour vérifier QUI est allé OÙ
function png(r, g, b) {
  const zlib = require('zlib');
  const W = 8, H = 8;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    for (let x = 0; x < W; x++) {
      const o = y * (1 + W * 3) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
  ]);
}
let TAB = null;
function crc32(buf) {
  if (!TAB) {
    TAB = [];
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; TAB[n] = c >>> 0; }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = TAB[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
// noms volontairement dans le désordre, avec des nombres à une et deux chiffres
const LOT = [
  ['rex_c_10.png', png(10, 10, 200)],
  ['rex_a_02.png', png(200, 10, 10)],
  ['rex_b_03.png', png(10, 200, 10)]
];
const b64 = {};
LOT.forEach(([n, buf]) => { b64[n] = buf.toString('base64'); });

// lâcher N fichiers sur un élément du panneau (galerie)
async function lacherSur(p, sel, noms) {
  return p.evaluate(({ sel, noms, b64 }) => {
    const el = document.querySelector(sel);
    if (!el) return 'introuvable';
    const dt = new DataTransfer();
    noms.forEach(n => {
      const bin = atob(b64[n]);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      dt.items.add(new File([arr], n, { type: 'image/png' }));
    });
    const o = { bubbles: true, cancelable: true, dataTransfer: dt };
    el.dispatchEvent(new DragEvent('dragover', o));
    const sur = el.classList.contains('survol');
    const ev = new DragEvent('drop', o);
    el.dispatchEvent(ev);
    return (ev.defaultPrevented ? 'retenu' : 'laisse-passer') + (sur ? '+surligne' : '');
  }, { sel, noms, b64 });
}

const couleur = s => s.slice(0, 200);   // deux PNG différents diffèrent tôt

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
  await p.waitForTimeout(2000);

  await p.click('#mImg');
  await p.waitForTimeout(1200);

  // la famille « Rex » de la liste
  const familles = await p.$$eval('#gal .hd', ns => ns.map(n => n.textContent.trim()));
  const iRex = familles.findIndex(t => /rex/i.test(t));
  if (iRex < 0) fail('famille Rex introuvable : ' + JSON.stringify(familles));
  ok('familles listées : ' + JSON.stringify(familles));

  // ---------- 1. lâcher 3 fichiers sur la famille ouvre l'appariement ----------
  await p.evaluate(i => {
    document.querySelectorAll('#gal .hd')[i].id = 'famRex';
    return true;
  }, iRex);
  const r1 = await lacherSur(p, '#famRex', ['rex_c_10.png', 'rex_a_02.png', 'rex_b_03.png']);
  if (!/^retenu/.test(r1)) fail('le dépôt sur la famille n’est pas pris en charge (' + r1 + ')');
  if (!/surligne/.test(r1)) fail('la famille ne se surligne pas au survol du glisser');
  ok('la famille se surligne pendant le glisser et retient le dépôt');
  await p.waitForTimeout(600);
  if (await p.$eval('#askm', e => e.classList.contains('hidden')))
    fail('l’appariement n’est pas proposé');

  // ---------- 2. l'ordre est celui des NOMS, pas celui du glisser ----------
  const paires = await p.$$eval('#askmList .pa', ns => ns.map(n => ({
    f: n.querySelector('.f').textContent.trim(),
    c: n.querySelector('.c').textContent.trim(),
    hors: n.classList.contains('hors')
  })));
  const ordre = paires.map(o => o.f);
  if (JSON.stringify(ordre) !== JSON.stringify(['rex_a_02.png', 'rex_b_03.png', 'rex_c_10.png']))
    fail('les fichiers ne sont pas remis dans l’ordre des noms : ' + JSON.stringify(ordre));
  ok('les fichiers sont remis dans l’ordre des noms : ' + JSON.stringify(ordre));
  if (paires.some(o => o.hors)) fail('un fichier est annoncé sans place alors que Rex a 4 emplacements');
  ok('appariement montré avant de poser : ' + JSON.stringify(paires.map(o => o.f + ' → ' + o.c)));

  // ---------- 3. annuler ne pose rien ----------
  await p.click('#askmNo');
  await p.waitForTimeout(400);
  if (await p.$$eval('#list .it', n => n.length))
    fail('annuler a quand même posé des images');
  ok('annuler ne pose rien');

  // ---------- 4. poser : chaque fichier va au bon emplacement ----------
  const r2 = await lacherSur(p, '#famRex', ['rex_c_10.png', 'rex_a_02.png', 'rex_b_03.png']);
  if (!/^retenu/.test(r2)) fail('2e dépôt non pris en charge');
  await p.waitForTimeout(400);
  const bouton = await p.$eval('#askmOk', e => e.textContent.trim());
  if (!/3/.test(bouton)) fail('le bouton n’annonce pas 3 images : ' + bouton);
  await p.click('#askmOk');
  await p.waitForTimeout(2500);
  if (!(await p.$eval('#askm', e => e.classList.contains('hidden')))) fail('la fenêtre ne se referme pas');
  const n = await p.$$eval('#list .it', ns => ns.length);
  if (n !== 3) fail('il devrait y avoir 3 retouches, il y en a ' + n);
  ok('les 3 images sont posées d’un seul geste');

  const reserve = () => {
    const d = document.getElementById('frame').contentDocument;
    const m = {};
    d.querySelectorAll('#rg-assetmap [data-k]').forEach(x => { m[x.getAttribute('data-k')] = x.getAttribute('src'); });
    return m;
  };
  const av = await p.evaluate(reserve);
  const rangs = ['assets_nda/personnages/rex/rex_portrait.png',
                 'assets_nda/personnages/rex/rex_planche_02.png',
                 'assets_nda/personnages/rex/rex_planche_03.png'];
  const attendu = ['rex_a_02.png', 'rex_b_03.png', 'rex_c_10.png'];
  const vrai = {};
  Object.keys(b64).forEach(nom => { vrai['data:image/png;base64,' + b64[nom]] = nom; });
  const place = rangs.map(k => vrai[av[k]] || '(inconnu)');
  if (JSON.stringify(place) !== JSON.stringify(attendu))
    fail('les images ne sont pas allées dans l’ordre : ' + JSON.stringify(place) +
         ' au lieu de ' + JSON.stringify(attendu));
  ok('chaque fichier est allé au bon emplacement, dans l’ordre : ' +
     rangs.map((k, i) => place[i] + ' → ' + k.split('/').pop()).join(' · '));

  // le 4e emplacement de Rex, et les autres familles, sont intacts
  if (av['assets_nda/personnages/rex/rex_planche_10.png'].indexOf('data:image/png') === 0)
    fail('le 4e emplacement de Rex a été touché alors qu’on n’a lâché que 3 fichiers');
  if (av['assets_nda/personnages/pipo/pipo_portrait.png'].indexOf('data:image/png') === 0)
    fail('la pose a débordé sur Pipo');
  ok('rien n’a débordé : ni le 4e emplacement de Rex, ni Pipo, ni les décors');

  // pas de fenêtre de recadrage restée ouverte après un lot
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    fail('une barre de recadrage est restée ouverte après la pose en série');
  ok('aucune fenêtre de recadrage ne s’ouvre pendant une pose en série');

  // ---------- 5. trop de fichiers pour la place restante ----------
  await p.evaluate(() => {
    const hd = [...document.querySelectorAll('#gal .hd')].find(n => /pipo/i.test(n.textContent));
    if (hd) hd.id = 'famPipo';
  });
  const r3 = await lacherSur(p, '#famPipo', ['rex_c_10.png', 'rex_a_02.png', 'rex_b_03.png']);
  if (!/^retenu/.test(r3)) fail('dépôt sur Pipo non pris en charge');
  await p.waitForTimeout(500);
  const hors = await p.$$eval('#askmList .pa.hors .f', ns => ns.map(n => n.textContent.trim()));
  if (hors.length !== 1) fail('Pipo a 2 emplacements : une seule image devrait être « sans place », ' + hors.length + ' annoncée(s)');
  const avert = await p.$eval('#askmWarn', e => e.classList.contains('hidden') ? '' : e.textContent);
  if (!/de trop/.test(avert)) fail('rien n’avertit du surplus : « ' + avert + ' »');
  ok('surplus annoncé sans rien poser en douce : « ' + avert.trim() + ' » (' + hors[0] + ')');
  await p.click('#askmNo');

  // ---------- 6. lâcher sur une vignette commence à CET emplacement ----------
  await p.evaluate(() => {
    const hd = document.getElementById('famPipo');
    if (hd) hd.click();                       // s'assurer que la famille est dépliée
  });
  await p.waitForTimeout(500);
  const tuiles = await p.$$eval('#gal .g .nm', ns => ns.map(n => n.textContent.trim()));
  ok('vignettes visibles : ' + JSON.stringify(tuiles.slice(0, 8)));

  // lâcher 2 fichiers sur « Planche 03 » doit remplir Planche 03 PUIS Planche 10
  const iT = await p.evaluate(() => {
    const t = [...document.querySelectorAll('#gal .g')]
      .find(n => /Planche 03/.test(n.querySelector('.nm').textContent));
    if (!t) return false;
    t.id = 'tuile3';
    return true;
  });
  if (!iT) fail('vignette « Planche 03 » introuvable : ' + JSON.stringify(tuiles));
  const r4 = await lacherSur(p, '#tuile3', ['rex_a_02.png', 'rex_b_03.png']);
  if (!/^retenu/.test(r4)) fail('dépôt sur une vignette non pris en charge (' + r4 + ')');
  if (!/surligne/.test(r4)) fail('la vignette ne se surligne pas pendant le glisser');
  await p.waitForTimeout(500);
  const p2 = await p.$$eval('#askmList .pa', ns => ns.map(n => ({
    f: n.querySelector('.f').textContent.trim(),
    c: n.querySelector('.c').textContent.trim(),
    ecrase: n.classList.contains('ecrase')
  })));
  if (p2.length !== 2 || !/planche.?0?3/i.test(p2[0].c) || !/planche.?10/i.test(p2[1].c))
    fail('le dépôt sur une vignette ne commence pas à CET emplacement : ' + JSON.stringify(p2));
  if (!p2[0].ecrase) fail('l’écrasement d’un emplacement déjà fait n’est pas signalé');
  const av2 = await p.$eval('#askmWarn', e => e.classList.contains('hidden') ? '' : e.textContent);
  if (!/écras/i.test(av2)) fail('rien n’avertit de l’écrasement : « ' + av2 + ' »');
  ok('lâcher sur une vignette part de CET emplacement et signale l’écrasement : ' +
     JSON.stringify(p2.map(o => o.f + ' → ' + o.c)));
  await p.click('#askmOk');
  await p.waitForTimeout(2000);
  const ap2 = await p.evaluate(reserve);
  if ((vrai[ap2['assets_nda/personnages/rex/rex_planche_03.png']] || '') !== 'rex_a_02.png')
    fail('Planche 03 n’a pas été écrasée par le 1er fichier');
  if ((vrai[ap2['assets_nda/personnages/rex/rex_planche_10.png']] || '') !== 'rex_b_03.png')
    fail('Planche 10 n’a pas reçu le 2e fichier');
  if ((vrai[ap2['assets_nda/personnages/rex/rex_portrait.png']] || '') !== 'rex_a_02.png')
    fail('le portrait de Rex a bougé alors qu’on partait de la Planche 03');
  ok('les deux images sont allées à Planche 03 et Planche 10, le portrait n’a pas bougé');

  // ---------- 7. export ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(2000);
  const fin = await v.evaluate(() => {
    const m = {};
    document.querySelectorAll('#rg-assetmap [data-k]').forEach(x => { m[x.getAttribute('data-k')] = x.getAttribute('src'); });
    return m;
  });
  const tousRangs = rangs.concat(['assets_nda/personnages/rex/rex_planche_10.png']);
  const tousAttendus = ['rex_a_02.png', 'rex_b_03.png', 'rex_a_02.png', 'rex_b_03.png'];
  const place2 = tousRangs.map(k => vrai[fin[k]] || '(inconnu)');
  if (JSON.stringify(place2) !== JSON.stringify(tousAttendus))
    fail('export : l’ordre est perdu → ' + JSON.stringify(place2) +
         ' au lieu de ' + JSON.stringify(tousAttendus));
  if (fin['assets_nda/personnages/pipo/pipo_portrait.png'].indexOf('data:image/png') === 0)
    fail('export : la pose a débordé sur Pipo');
  ok('fichier exporté : les 4 emplacements de Rex sont rejoués chacun à sa place, Pipo intact');
  const affiche = await v.evaluate(() => {
    const n = [...document.querySelectorAll('img[alt="rex_planche_02"]')].find(x => !x.closest('#rg-assetmap'));
    if (!n) return null;
    return n.getAttribute('src').indexOf('data:image/png') === 0 ||
           getComputedStyle(n).content.indexOf('data:image/png') >= 0;
  });
  if (!affiche) fail('export : la page n’affiche pas l’image posée');
  ok('export : la page affiche bien les images posées');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
