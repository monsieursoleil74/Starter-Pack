/* Les tutoriels (MANUEL, RIG, PICKER…) partagent UNE fenêtre vidéo, et la
   maquette annonce le MÊME fichier de réserve pour tous. Poser la vidéo du
   Manuel écrivait alors l'entrée de réserve partagée : elle apparaissait chez
   tous les tutoriels et chaque pose écrasait la précédente — impossible de
   mettre plusieurs vidéos. Quand un titre identifie la fenêtre, le TITRE
   prime désormais : chaque bouton garde SA vidéo.
   Usage : node e2e92.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_tutos.html');
const OUT = path.resolve(__dirname, 'tutos_export.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

const TUTOS = ['MANUEL', 'RIG', 'PICKER'];
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tutoriels</title>
<style>body{font-family:sans-serif;background:#1d241d;color:#dfe7df;padding:24px;margin:0}
.tuto{display:block;margin:10px 0;padding:14px 22px;border:1px solid #6f8f6f;border-radius:10px;
  background:#2a332a;color:#dfe7df;font-size:15px;cursor:pointer}
#fen{position:fixed;inset:6% 12%;background:#0b0e0b;border-radius:14px;display:none;
  flex-direction:column;align-items:center;gap:10px;padding:18px;z-index:50}
#fen video{width:82%;height:64%;background:#000}
</style></head><body>
<h1>Tutoriels</h1>
${TUTOS.map((t) => `<button class="tuto" data-t="${t}">${t}</button>`).join('\n')}
<div id="fen">
  <h3 id="fenTitre" style="margin:0"></h3>
  <video id="fenVid" controls src="assets_nda/videos/tuto_placeholder.mp4"></video>
  <button id="fenX">Fermer</button>
</div>
<div id="rg-assetmap" style="display:none">
  <video data-k="assets_nda/videos/tuto_placeholder.mp4" src="assets_nda/videos/tuto_placeholder.mp4"></video>
</div>
<script>
  [].forEach.call(document.querySelectorAll('.tuto'), function (b) {
    b.addEventListener('click', function () {
      document.getElementById('fenTitre').textContent = 'Tutoriel ' + b.dataset.t;
      document.getElementById('fen').style.display = 'flex';
    });
  });
  document.getElementById('fenX').addEventListener('click', function () {
    document.getElementById('fen').style.display = 'none';
  });
</script>
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1300, height: 850 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => { if (!/Clipboard|writeText/.test(e.message)) errs.push(e.message); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1300);

  const bouton = (t, mode) => p.evaluate(([q, m]) => {
    const d = document.getElementById('frame').contentDocument;
    const n = [...d.querySelectorAll(m || '.tuto')].find((x) => (x.textContent || '').trim() === q) ||
              d.querySelector(q);
    n.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = n.getBoundingClientRect();
    const f = document.getElementById('frame').getBoundingClientRect();
    return { x: f.left + r.left + r.width / 2, y: f.top + r.top + r.height / 2 };
  }, [t, mode]);

  // ---------- poser une vidéo par tutoriel, via la fenêtre partagée ----------
  const poser = async (tuto, chemin) => {
    await p.click('#mVid');
    await p.waitForTimeout(400);
    const c = await bouton(tuto);
    await p.mouse.click(c.x, c.y);
    await p.waitForTimeout(1400);                       // la fenêtre s'ouvre, l'outil la repère
    if (await p.$eval('#askv', (e) => e.classList.contains('hidden')))
      fail('la fenêtre vidéo n’a pas été proposée pour ' + tuto);
    const note = await p.$eval('#askvWhat', (e) => e.textContent);
    if (!/plusieurs boutons/.test(note))
      fail('la fenêtre partagée n’est pas reconnue (pas de témoin) pour ' + tuto + ' : ' + note);
    p.once('dialog', (d) => d.accept(chemin));
    await p.click('#askvLien');
    await p.waitForTimeout(900);
    // on referme la fenêtre de la maquette pour le tour suivant
    await p.click('#mView');
    await p.waitForTimeout(300);
    const x = await bouton('#fenX', 'aucun');
    await p.mouse.click(x.x, x.y);
    await p.waitForTimeout(400);
  };
  await poser('MANUEL', 'videos/manuel.mp4');
  await poser('RIG', 'videos/rig.mp4');

  const nb = await p.$$eval('#list .it', (l) => l.length);
  if (nb !== 2)
    fail('deux vidéos posées → ' + nb + ' retouche(s) : la seconde a écrasé la première');
  ok('deux vidéos posées : deux retouches distinctes, chacune ancrée sur son titre');

  // ---------- dans l'aperçu : chaque bouton montre SA vidéo ----------
  const lireFen = () => p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    return d.getElementById('fenVid').getAttribute('src') || '';
  });
  const verif = async (tuto, attendu) => {
    const c = await bouton(tuto);
    await p.mouse.click(c.x, c.y);
    await p.waitForTimeout(1600);                       // la passe applique selon le titre
    const src = await lireFen();
    if (src.indexOf(attendu) < 0)
      fail('aperçu, ' + tuto + ' : la fenêtre lit ' + JSON.stringify(src) + ' au lieu de ' + attendu);
    const x = await bouton('#fenX', 'aucun');
    await p.mouse.click(x.x, x.y);
    await p.waitForTimeout(400);
  };
  await verif('MANUEL', 'manuel.mp4');
  await verif('RIG', 'rig.mp4');
  await verif('MANUEL', 'manuel.mp4');                  // et retour : rien ne colle
  ok('aperçu : MANUEL lit manuel.mp4, RIG lit rig.mp4 — chacun la sienne');

  // ---------- le pack exporté fait pareil ----------
  await p.evaluate(() => ['ask', 'askv', 'askl', 'askg', 'askm'].forEach((i) => {
    const e = document.getElementById(i); if (e) e.classList.add('hidden'); }));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', (e) => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(2000);
  const verifExp = async (tuto, attendu) => {
    await v.evaluate((q) => {
      [...document.querySelectorAll('.tuto')].find((x) => (x.textContent || '').trim() === q).click();
    }, tuto);
    await v.waitForTimeout(1600);
    const src = await v.evaluate(() => document.getElementById('fenVid').getAttribute('src') || '');
    if (src.indexOf(attendu) < 0)
      fail('pack, ' + tuto + ' : la fenêtre lit ' + JSON.stringify(src) + ' au lieu de ' + attendu);
    await v.evaluate(() => document.getElementById('fenX').click());
    await v.waitForTimeout(300);
  };
  await verifExp('MANUEL', 'manuel.mp4');
  await verifExp('RIG', 'rig.mp4');
  await verifExp('MANUEL', 'manuel.mp4');
  ok('pack exporté : chaque tutoriel garde sa vidéo, dans les deux sens');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
