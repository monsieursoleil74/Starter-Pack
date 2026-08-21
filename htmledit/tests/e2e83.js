/* Ouverture du pack : on ne doit JAMAIS voir l'état intermédiaire de la
   maquette — ni le lecteur vidéo du gabarit, ni les visuels « proto », ni
   les textes d'origine. Le fichier exporté se dévoile une fois les retouches
   posées, puis rend la main.
   Usage : node e2e83.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_ouverture.html');
const OUT = path.resolve(__dirname, 'ouverture_export.html');
const PNG = path.resolve(__dirname, 'gros_visuel.png');
// un vrai PNG volumineux : son décodage prend du temps, comme les planches
if (!fs.existsSync(PNG)) {
  const zlib = require('zlib');
  const W = 1400, H = 900;
  const brut = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    const o = y * (W * 3 + 1);
    brut[o] = 0;
    for (let x = 0; x < W; x++) {
      const i = o + 1 + x * 3;
      brut[i] = (x * 7 + y * 3) & 255;
      brut[i + 1] = (x ^ y) & 255;
      brut[i + 2] = (x * 3 + y * 11) & 255;
    }
  }
  const crcT = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    crcT[n] = c >>> 0;
  }
  const crc = (b) => {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, cc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(PNG, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(brut, { level: 1 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

// une maquette qui se monte APRÈS coup, comme celles de Claude Design :
// lecteur vidéo du gabarit, visuel « proto », texte d'origine
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pack</title></head>
<body style="font-family:sans-serif;margin:0;background:#F6F1E5">
<div id="app" style="padding:24px"><p>Chargement…</p></div>
<script>
  setTimeout(function () {
    document.getElementById('app').innerHTML =
      '<div id="visionneuse" style="position:fixed;inset:0;background:rgba(10,12,10,.96);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:50">' +
      '<video id="gabarit" src="{{ vidSrc }}" controls style="width:70vw;height:60vh;background:#222"></video>' +
      '<div id="etiqVid">{{ vidLabel }} <span>Échap ou clic à côté pour fermer</span></div></div>' +
      '<div id="visu" style="width:520px;height:150px;background:#2f3b2f;color:#cfe;' +
      'display:flex;align-items:center;justify-content:center;font-size:24px">VISUEL PROTO</div>' +
      '<img id="planche" src="assets/planche.jpg" alt="Planche proto" style="width:220px;height:140px;background:#ddd">' +
      '<h1 id="titre">Titre d\\'origine</h1>';
    setTimeout(function () {
      var v = document.getElementById('visionneuse');
      if (v) v.style.display = 'none';
    }, 1200);
  }, 1500);
<\/script>
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 900, height: 620 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(2000);

  // une retouche de texte + une image remplacée
  await p.click('#mText');
  await p.waitForTimeout(300);
  const c = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const n = d.getElementById('titre');
    const r = n.getBoundingClientRect();
    const f = document.getElementById('frame').getBoundingClientRect();
    return { x: f.left + r.left + 20, y: f.top + r.top + r.height / 2 };
  });
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(400);
  await p.keyboard.press('ControlOrMeta+a');
  await p.keyboard.type('Mon pack à moi');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(600);

  await p.click('#mImg');
  await p.waitForTimeout(400);
  const ci = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const n = d.getElementById('planche');
    const r = n.getBoundingClientRect();
    const f = document.getElementById('frame').getBoundingClientRect();
    return { x: f.left + r.left + r.width / 2, y: f.top + r.top + r.height / 2 };
  });
  await p.mouse.click(ci.x, ci.y);
  await p.waitForTimeout(600);
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', PNG);
  await p.waitForTimeout(1200);
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropOk').catch(() => {});
  await p.waitForTimeout(400);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const nomPropose = dl.suggestedFilename();
  if (/modifi[ée].*modifi[ée]/i.test(nomPropose))
    fail('le nom du fichier empile les « - modifie » : ' + nomPropose);
  ok('pack exporté (1 texte + 1 image), nommé « ' + nomPropose + ' »');

  // ---------- ouverture, sur une machine lente ----------
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[pack] ' + e.message));
  const cdp = await ctx.newCDPSession(v);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 8 });
  const t0 = Date.now();
  v.goto('file://' + OUT).catch(() => {});
  let vuProto = 0, vuLecteur = 0, vuTexteOrigine = 0, apparu = 0, voileVu = 0;
  for (let i = 0; i < 140; i++) {
    await v.waitForTimeout(60);
    const e = await v.evaluate(() => {
      const vo = document.getElementById('pack-edit-voile');
      const opa = vo ? parseFloat(getComputedStyle(vo).opacity) : 0;
      if (vo && opa > 0.4) return { couvert: true };
      const vis = (n) => {
        if (!n) return false;
        const r = n.getBoundingClientRect();
        if (!(r.width > 30 && r.height > 20 && r.top < innerHeight && r.bottom > 0)) return false;
        // vraiment à l'œil : ni masqué, ni transparent (une boîte réservée
        // mais invisible ne se voit pas)
        let g = n;
        for (let k = 0; g && k < 8; g = g.parentElement, k++) {
          const st = getComputedStyle(g);
          if (st.visibility === 'hidden' || st.display === 'none' || parseFloat(st.opacity) < 0.05) return false;
        }
        return true;
      };
      const t = document.getElementById('titre');
      const im = document.getElementById('planche');
      return {
        couvert: false,
        // l'image d'ORIGINE encore en place alors qu'elle est visible
        proto: vis(im) && /assets\/planche\.jpg$/.test(im.getAttribute('src') || ''),
        lecteur: vis(document.getElementById('gabarit')) ||
          vis(document.getElementById('visionneuse')),
        origine: !!t && vis(t) && /Titre d’origine|Titre d'origine/.test(t.textContent || ''),
        pret: !!t && /Mon pack à moi/.test(t.textContent || ''),
      };
    }).catch(() => null);
    if (!e) continue;
    if (e.couvert) { voileVu++; continue; }
    if (e.proto) vuProto++;
    if (e.lecteur) vuLecteur++;
    if (e.origine) vuTexteOrigine++;
    if (e.pret && !apparu) apparu = Date.now() - t0;
    if (apparu && i > 60) break;
  }
  // le pack doit s'ouvrir VOILÉ : sans ça, on assiste au montage de la
  // maquette (lecteur du gabarit, visuels d'origine) avant les retouches
  if (!voileVu)
    fail('aucun voile d’ouverture : la page se monte à l’écran avant ses retouches');
  ok('l’ouverture est voilée le temps que les retouches se posent (' + voileVu + ' relevés)');
  if (vuProto) fail('l’image d’origine a été visible ' + vuProto + ' fois avant d’être remplacée');
  if (vuLecteur) fail('le lecteur vidéo du gabarit a été visible ' + vuLecteur + ' fois');
  if (vuTexteOrigine) fail('le texte d’origine a été visible ' + vuTexteOrigine + ' fois');
  ok('rien d’intermédiaire n’a été montré : ni image d’origine, ni lecteur, ni texte d’origine');
  if (!apparu) fail('le pack ne s’est jamais affiché');
  if (apparu > 6000) fail('le pack met trop longtemps à se montrer : ' + apparu + ' ms');
  ok('le pack se montre, prêt, en ' + (apparu / 1000).toFixed(1) + ' s');

  // ---------- le voile s'efface bien, la page est utilisable ----------
  await v.waitForTimeout(2500);
  const fin = await v.evaluate(() => {
    const vo = document.getElementById('pack-edit-voile');
    const t = document.getElementById('titre');
    return { voile: !!vo, titre: t ? t.textContent.trim() : '(absent)',
      clicOk: document.elementFromPoint(innerWidth / 2, innerHeight / 2) !== vo };
  });
  if (fin.voile) fail('le voile d’ouverture n’a pas été retiré');
  if (!fin.clicOk) fail('le voile bloque encore la page');
  if (fin.titre !== 'Mon pack à moi') fail('la retouche de texte manque : ' + JSON.stringify(fin.titre));
  ok('voile retiré, page rendue et cliquable, retouches en place');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
