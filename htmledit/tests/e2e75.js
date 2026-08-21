/* En mode Texte, la maquette ne doit JAMAIS se réveiller sous un clic :
   - la vignette (zone sans texte) d'une carte tutoriel ouvrait sa vidéo ;
   - une sélection à la souris qui déborde du texte en cours d'édition
     lâchait le clic sur la carte — vidéo encore ;
   - l'icône d'une carte à lien suivait le lien.
   Le titre, lui, s'édite toujours ; l'enchaînement d'un champ à l'autre
   reste direct ; et en Aperçu, la carte marche comme avant.
   Usage : node e2e75.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_cartes.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cartes</title></head>
<body style="font-family:sans-serif;padding:30px">
<h1>Ressources</h1>
<div style="display:grid;grid-template-columns:repeat(2,260px);gap:16px">
  <button id="tuto1" style="text-align:left;padding:0;border:1px solid #ccc;background:#fff;cursor:pointer">
    <div id="vignette" style="height:110px;background:#334"></div>
    <div style="padding:10px">
      <div id="titreTuto" style="font-weight:700">Présentation du rig</div>
      <div id="duree" style="color:#777;font-size:13px">4 min</div>
    </div>
  </button>
  <a id="lien1" href="https://example.com/doc" style="display:block;border:1px solid #ccc;text-decoration:none;color:#222">
    <div id="icone" style="height:110px;background:#464"></div>
    <div style="padding:10px">
      <div id="titreLien" style="font-weight:700">Documentation studio</div>
      <div style="color:#777;font-size:13px">docs internes</div>
    </div>
  </a>
</div>
<div id="visionneuse" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.8);color:#fff;
  align-items:center;justify-content:center"><span>VIDEO OUVERTE</span></div>
<script>
  window.ouvertures = 0; window.navigations = 0;
  document.getElementById('tuto1').addEventListener('click', function () {
    window.ouvertures++;
    document.getElementById('visionneuse').style.display = 'flex';
  });
  document.getElementById('lien1').addEventListener('click', function (e) {
    window.navigations++;
  });
</script>
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1200);
  const fr = p.frameLocator('#frame');
  const compteurs = () => p.evaluate(() => {
    const w = document.getElementById('frame').contentWindow;
    return { video: w.ouvertures, nav: w.navigations,
      visionneuse: w.document.getElementById('visionneuse').style.display !== 'none' };
  });
  const pt = async (sel, dx) => p.evaluate(([s, d]) => {
    const doc = document.getElementById('frame').contentDocument;
    const r = doc.querySelector(s).getBoundingClientRect();
    const f = document.getElementById('frame').getBoundingClientRect();
    return { x: f.left + r.left + (d != null ? d : r.width / 2), y: f.top + r.top + r.height / 2 };
  }, [sel, dx]);

  await p.click('#mText');
  await p.waitForTimeout(300);

  // ---------- 1. clic sur la VIGNETTE (zone sans texte) : rien ne s'ouvre ----------
  let c = await pt('#vignette');
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(500);
  let e1 = await compteurs();
  if (e1.video > 0 || e1.visionneuse) fail('la vignette de la carte tutoriel a ouvert la vidéo en mode Texte');
  ok('vignette de carte tutoriel cliquée : la vidéo ne s’ouvre pas');

  // ---------- 2. clic sur l'ICÔNE de la carte à lien : pas de navigation ----------
  c = await pt('#icone');
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(500);
  e1 = await compteurs();
  if (e1.nav > 0) fail('l’icône de la carte à lien a déclenché le lien en mode Texte');
  ok('icône de carte à lien cliquée : le lien ne se déclenche pas');

  // ---------- 3. le TITRE s'édite toujours ----------
  c = await pt('#titreTuto', 10);
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(500);
  const ed = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const n = d.querySelector('[contenteditable=true]');
    return n ? n.textContent.trim() : null;
  });
  if (ed !== 'Présentation du rig') fail('le titre de la carte ne s’édite plus : ' + JSON.stringify(ed));
  const e3 = await compteurs();
  if (e3.video > 0) fail('ouvrir l’édition du titre a aussi ouvert la vidéo');
  ok('le titre de la carte s’édite, sans ouvrir la vidéo');

  // ---------- 4. sélection à la souris qui DÉBORDE sur la vignette ----------
  const a = await pt('#titreTuto', 10);
  const b = await pt('#vignette');
  await p.mouse.move(a.x, a.y);
  await p.mouse.down();
  await p.mouse.move(b.x, b.y, { steps: 6 });
  await p.mouse.up();
  await p.waitForTimeout(500);
  const e4 = await compteurs();
  if (e4.video > 0 || e4.visionneuse) fail('la sélection qui déborde du titre a ouvert la vidéo');
  ok('sélection à la souris débordant du titre : la vidéo ne s’ouvre pas');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // ---------- 5. l'enchaînement d'un champ à l'autre reste direct ----------
  c = await pt('#titreTuto', 10);
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(400);
  c = await pt('#titreLien', 10);
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(500);
  const ed2 = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const n = d.querySelector('[contenteditable=true]');
    return n ? n.textContent.trim() : null;
  });
  if (ed2 !== 'Documentation studio')
    fail('l’enchaînement direct d’un champ à l’autre est cassé : ' + JSON.stringify(ed2));
  ok('cliquer un autre champ pendant une édition ouvre bien son édition, directement');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // ---------- 6. en Aperçu, la carte marche comme avant ----------
  await p.click('#mView');
  await p.waitForTimeout(300);
  c = await pt('#vignette');
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(500);
  const e6 = await compteurs();
  if (!e6.visionneuse) fail('en Aperçu, la carte tutoriel n’ouvre plus sa vidéo');
  ok('en Aperçu, la carte tutoriel ouvre toujours sa vidéo');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
