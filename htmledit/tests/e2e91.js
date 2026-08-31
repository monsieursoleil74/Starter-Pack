/* Dézoomer une image (< 100 %) réduisait le rendu DÉJÀ rogné par « cover » :
   les bords de l'image restaient coupés, et un overflow:hidden posé sur le
   conteneur réduisait la zone — coupant au passage les débordements VOULUS
   par la maquette (le personnage qui dépasse de son cadre). Désormais le
   dézoom élargit la VUE de l'image (object-view-box, au ratio du cadre) :
   l'image entière apparaît avec des marges, rien n'est rogné, et le clip
   d'un zoom passé se retire dès qu'on redescend à 100 % ou moins.
   Usage : node e2e91.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_dezoom.html');
const OUT = path.resolve(__dirname, 'dezoom_export.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

const ecrireMaq = (uri) => fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Dézoom</title>
<style>body{font-family:sans-serif;background:#e8d9b8;color:#333;padding:40px;margin:0}
.carte{width:360px;border:2px solid #7ac79a;border-radius:8px;padding:20px}
/* le cadre laisse VOLONTAIREMENT déborder : le personnage dépasse, c'est le design */
.fenetre{width:300px;height:300px;background:#dcc9a2}
.fenetre img{width:300px;height:300px;object-fit:cover;display:block}
</style></head><body>
<h1>Personnage</h1>
<div class="carte"><div class="fenetre"><img id="perso" src="${uri}" alt="Chien Barjola"></div></div>
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1300, height: 900 } });
  const gen = await ctx.newPage();
  await gen.goto('about:blank');
  // une image NETTEMENT plus large que le cadre : cover en rogne les deux bords
  const b64 = await gen.evaluate(() => {
    const cv = document.createElement('canvas');
    cv.width = 900; cv.height = 300;
    const g = cv.getContext('2d');
    g.fillStyle = '#2b6cb0'; g.fillRect(0, 0, 900, 300);
    g.fillStyle = '#ffd24d'; g.fillRect(0, 0, 40, 300);        // bord gauche jaune
    g.fillStyle = '#ff5d5d'; g.fillRect(860, 0, 40, 300);      // bord droit rouge
    return cv.toDataURL('image/png').split(',')[1];
  });
  await gen.close();
  // l'image vit DANS la maquette (data URI), comme dans les vrais packs
  ecrireMaq('data:image/png;base64,' + b64);

  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => { if (!/Clipboard|writeText/.test(e.message)) errs.push(e.message); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1300);
  await p.click('#mImg');
  await p.waitForTimeout(400);

  const etat = () => p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const n = d.getElementById('perso');
    const fen = d.querySelector('.fenetre');
    return {
      transform: n.style.transform || '',
      vue: n.style.objectViewBox || '',
      clip: d.defaultView.getComputedStyle(fen).overflow,
    };
  });
  const regler = async (v) => {
    await p.$eval('#cropZ', (e, val) => {
      e.value = val; e.dispatchEvent(new Event('input', { bubbles: true }));
    }, v);
    await p.waitForTimeout(350);
  };

  // ---------- ouvrir le cadrage sur l'image ----------
  const c = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const n = d.getElementById('perso');
    n.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = n.getBoundingClientRect();
    const f = document.getElementById('frame').getBoundingClientRect();
    return { x: f.left + r.left + r.width / 2, y: f.top + r.top + r.height / 2 };
  });
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(700);
  if (await p.$eval('#crop', (e) => e.classList.contains('hidden')))
    fail('le cadrage ne s’ouvre pas');

  // ---------- 1. zoom à 200 % : le clip se pose (rien ne doit déborder) ----------
  await regler(200);
  let e1 = await etat();
  if (!/scale\(2/.test(e1.transform)) fail('le zoom à 200 % ne pose pas l’agrandissement');
  if (e1.clip !== 'hidden') fail('à 200 %, le débordement du zoom devrait être contenu');
  ok('zoom 200 % : agrandissement posé, débordement contenu');

  // ---------- 2. retour à 60 % : le clip se RETIRE, la vue s’élargit ----------
  await regler(60);
  e1 = await etat();
  if (/scale/.test(e1.transform))
    fail('à 60 %, l’image est encore réduite par transform (rendu rogné) : ' + e1.transform);
  if (!e1.vue) fail('à 60 %, la vue élargie (object-view-box) n’est pas posée');
  if (e1.clip === 'hidden')
    fail('à 60 %, le conteneur garde overflow:hidden — la zone de la maquette est réduite, ' +
         'les débordements voulus par le design sont coupés');
  ok('dézoom 60 % : vue élargie, aucun clip — la maquette garde sa zone');

  // ---------- 3. à 30 %, l'image ENTIÈRE est dans la vue ----------
  await regler(30);
  e1 = await etat();
  const insets = (e1.vue.match(/inset\(([^)]+)\)/) || [])[1];
  if (!insets) fail('à 30 %, pas de vue élargie : ' + JSON.stringify(e1.vue));
  // le navigateur sérialise en raccourci : inset(a) = quatre côtés égaux
  const quatre = (l) => l.length === 1 ? [l[0], l[0], l[0], l[0]]
    : l.length === 2 ? [l[0], l[1], l[0], l[1]]
    : l.length === 3 ? [l[0], l[1], l[2], l[1]] : l;
  const vals = quatre(insets.split(/\s+/).map((x) => parseFloat(x)));
  if (vals.length !== 4 || vals.some((x) => x >= 0))
    fail('à 30 %, la vue devrait dépasser l’image des quatre côtés (marges partout, ' +
         'plus aucun bord coupé) : inset(' + insets + ')');
  ok('dézoom 30 % : l’image entière est visible, marges des quatre côtés (' + insets + ')');
  await p.click('#cropOk');
  await p.waitForTimeout(500);

  // ---------- 4. le pack exporté fait pareil ----------
  await p.evaluate(() => ['ask', 'askv', 'askl', 'askg', 'askm'].forEach((i) => {
    const e = document.getElementById(i); if (e) e.classList.add('hidden'); }));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', (e) => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(2000);
  const eE = await v.evaluate(() => {
    const n = document.getElementById('perso');
    return {
      transform: n.style.transform || '',
      vue: n.style.objectViewBox || '',
      clip: getComputedStyle(document.querySelector('.fenetre')).overflow,
    };
  });
  if (/scale/.test(eE.transform)) fail('le pack réduit encore l’image par transform');
  const insE = (eE.vue.match(/inset\(([^)]+)\)/) || [])[1];
  if (!insE || quatre(insE.split(/\s+/).map((x) => parseFloat(x))).some((x) => x >= 0))
    fail('le pack ne montre pas l’image entière : ' + JSON.stringify(eE.vue));
  if (eE.clip === 'hidden') fail('le pack pose encore overflow:hidden sur le conteneur');
  ok('le pack exporté : image entière, zone de la maquette intacte');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
