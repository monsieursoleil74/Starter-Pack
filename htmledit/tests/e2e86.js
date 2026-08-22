/* Le carré de sélection d'un personnage n'a pas d'image : c'est un
   emplacement qui affiche « PORTRAIT / SAM / sam_portrait.png ». On y pose un
   visuel, on le cadre — puis la maquette reconstruit sa grille DANS UN AUTRE
   ORDRE (au changement de page, à la sélection…). L'emplacement n'était
   repéré que par sa position : la retouche partait chez le voisin et le
   personnage retrouvait son gabarit. Elle s'ancre désormais sur le chemin du
   fichier que la maquette écrit sur l'emplacement.
   On vérifie aussi qu'un second fichier posé au même endroit GARDE le
   cadrage déjà réglé.
   Usage : node e2e86.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_grille.html');
// ses propres visuels, NETTEMENT plus larges que hauts : dans un carré, il y
// a donc de la matière à déplacer (les fichiers partagés changent de forme
// d'un test à l'autre — le cadrage n'aurait alors rien à mordre)
const A = path.resolve(__dirname, 'e2e86_a.png');
const B = path.resolve(__dirname, 'e2e86_b.png');
const OUT = path.resolve(__dirname, 'grille_export.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

const PERSOS = ['sam', 'barjola', 'pipo'];
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Personnages</title>
<style>body{font-family:sans-serif;background:#1d241d;color:#dfe7df;padding:24px;margin:0}
#grille{display:flex;gap:18px;flex-wrap:wrap}
.carte{width:210px;border:3px solid #6f8f6f;border-radius:20px;padding:12px;text-align:center;
  background:#2a332a}
.slot{width:180px;height:180px;border-radius:14px;background:#232c23;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:4px;overflow:hidden}
.slot .lb{font-size:9px;letter-spacing:2px;opacity:.65}
.slot .nm{font-size:17px;font-weight:800}
.slot .fi{font-size:8px;opacity:.35}
.carte b{display:block;margin-top:10px;font-size:20px}
</style></head><body>
<h1>Personnages</h1><button id="pg">Changer de page</button>
<div id="grille"></div>
<script>
  var modele = ${JSON.stringify(PERSOS)};
  function peindre() {
    document.getElementById('grille').innerHTML = modele.map(function (n) {
      return '<div class="carte" data-p="' + n + '">' +
        '<div class="slot" data-k="assets_nda/personnages/' + n + '/' + n + '_portrait.png">' +
        '<span class="lb">PORTRAIT</span><span class="nm">' + n.toUpperCase() + '</span>' +
        '<span class="fi">' + n + '_portrait.png</span></div>' +
        '<b>' + n[0].toUpperCase() + n.slice(1) + '</b></div>';
    }).join('');
  }
  peindre();
  // la grille se refait DANS UN AUTRE ORDRE — comme une sélection qui remonte
  document.getElementById('pg').addEventListener('click', function () {
    modele = modele.slice(1).concat(modele[0]);
    peindre();
  });
</script></body></html>`);

const releve = (page, iframe) => page.evaluate((f) => {
  const d = f ? document.getElementById('frame').contentDocument : document;
  const out = {};
  [...d.querySelectorAll('.carte')].forEach((k) => {
    const s = k.querySelector('.slot');
    const st = d.defaultView.getComputedStyle(s);
    out[k.dataset.p] = {
      pose: /^url\(/.test(st.backgroundImage || ''),
      pos: st.backgroundPosition,
      taille: st.backgroundSize,
    };
  });
  out._ordre = [...d.querySelectorAll('.carte')].map((k) => k.dataset.p).join(',');
  return out;
}, iframe);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1300, height: 850 } });
  const gen = await ctx.newPage();
  await gen.goto('about:blank');
  for (const [f2, couleur] of [[A, '#2b6cb0'], [B, '#b02b6c']]) {
    const b64 = await gen.evaluate((c) => {
      const cv = document.createElement('canvas');
      cv.width = 420; cv.height = 140;
      const g = cv.getContext('2d');
      g.fillStyle = c; g.fillRect(0, 0, 420, 140);
      for (let i = 0; i < 30; i++) {
        g.fillStyle = 'rgba(255,255,255,.2)';
        g.fillRect(i * 14, (i * 37) % 120, 8, 8);
      }
      return cv.toDataURL('image/png').split(',')[1];
    }, couleur);
    fs.writeFileSync(f2, Buffer.from(b64, 'base64'));
  }
  await gen.close();
  ok('visuels d’essai fabriqués (420×140 : large dans un carré de 180)');
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => { if (!/Clipboard|writeText/.test(e.message)) errs.push(e.message); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1300);
  await p.click('#mImg');
  await p.waitForTimeout(400);

  const viser = () => p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const n = d.querySelector('.carte[data-p="sam"] .slot');
    n.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = n.getBoundingClientRect();
    const f = document.getElementById('frame').getBoundingClientRect();
    return { x: f.left + r.left + r.width / 2, y: f.top + r.top + r.height / 2 };
  });
  const ouvert = (id) => p.$eval('#' + id, (e) => !e.classList.contains('hidden'));
  const rangerFenetres = () => p.evaluate(() => ['ask', 'askv', 'askl', 'askg', 'askm']
    .forEach((i) => { const e = document.getElementById(i); if (e) e.classList.add('hidden'); }));

  // ---------- 1. poser un visuel dans le carré de Sam ----------
  let c = await viser();
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(700);
  if (!(await ouvert('ask'))) fail('cliquer l’emplacement ne propose rien');
  const [ch] = await Promise.all([p.waitForEvent('filechooser'), p.click('#askCover')]);
  await ch.setFiles(A);
  await p.waitForTimeout(1600);
  let r = await releve(p, true);
  if (!r.sam.pose) fail('le visuel n’est pas posé dans le carré de Sam');
  if (r.barjola.pose || r.pipo.pose) fail('le visuel a débordé sur les voisins');
  ok('visuel posé dans le carré de Sam, et nulle part ailleurs');

  // ---------- 2. le cadrer à la souris ----------
  if (!(await ouvert('crop'))) {
    c = await viser();
    await p.mouse.click(c.x, c.y);
    await p.waitForTimeout(800);
  }
  if (!(await ouvert('crop'))) fail('le cadrage ne s’ouvre pas sur l’emplacement rempli');
  // l'aperçu peut encore être en train de défiler : on vise juste avant de
  // glisser, et on redonne un coup si rien n'a bougé
  for (let essai = 0; essai < 3; essai++) {
    await p.waitForTimeout(500);
    c = await viser();
    await p.waitForTimeout(250);
    c = await viser();
    await p.mouse.move(c.x, c.y);
    await p.mouse.down();
    await p.mouse.move(c.x - 45, c.y - 30, { steps: 10 });
    await p.mouse.up();
    await p.waitForTimeout(450);
    if ((await releve(p, true)).sam.pos !== '50% 50%') break;
  }
  await p.click('#cropOk');
  await p.waitForTimeout(700);
  r = await releve(p, true);
  const cadrage = r.sam.pos;
  if (cadrage === '50% 50%') fail('le déplacement à la souris n’a rien changé');
  ok('cadrage réglé à la souris (' + cadrage + ')');

  // ---------- 3. le rouvrir : on peut encore retoucher ----------
  await rangerFenetres();
  c = await viser();
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(800);
  if (!(await ouvert('crop')))
    fail('impossible de rouvrir le cadrage : l’emplacement rempli n’est plus reconnu');
  if ((await p.$$eval('#list .it', (l) => l.length)) !== 1)
    fail('recliquer a créé une seconde retouche au lieu de rouvrir la première');
  await p.click('#cropOk');
  await p.waitForTimeout(500);
  ok('le cadrage se rouvre sur la MÊME retouche — l’emplacement reste retouchable');

  // ---------- 4. un second fichier garde le cadrage ----------
  await rangerFenetres();
  await p.click('#cropRemp').catch(() => {});
  c = await viser();
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(700);
  if (!(await ouvert('crop'))) fail('le cadrage ne se rouvre pas avant le remplacement');
  const [ch2] = await Promise.all([p.waitForEvent('filechooser'), p.click('#cropRemp')]);
  await ch2.setFiles(B);
  await p.waitForTimeout(1600);
  r = await releve(p, true);
  if (r.sam.pos !== cadrage)
    fail('le second fichier a perdu le cadrage réglé : ' + r.sam.pos + ' au lieu de ' + cadrage);
  ok('un autre fichier posé au même endroit garde le cadrage déjà réglé');

  // ---------- 5. la grille se refait dans un autre ordre ----------
  await rangerFenetres();
  if (await ouvert('crop')) { await p.click('#cropOk'); await p.waitForTimeout(400); }
  // on navigue comme un lecteur : en mode Aperçu, la maquette reprend la main
  await p.click('#mView');
  await p.waitForTimeout(400);
  await p.frameLocator('#frame').locator('#pg').click();
  await p.waitForTimeout(2600);
  r = await releve(p, true);
  if (r._ordre === 'sam,barjola,pipo') fail('la grille ne s’est pas réordonnée — scénario non représentatif');
  if (!r.sam.pose) fail('après réordonnancement, le carré de Sam a retrouvé son gabarit');
  if (r.barjola.pose || r.pipo.pose)
    fail('après réordonnancement, le visuel de Sam est parti chez le voisin (' + r._ordre + ')');
  if (r.sam.pos !== cadrage) fail('après réordonnancement, le cadrage est perdu : ' + r.sam.pos);
  ok('grille réordonnée (' + r._ordre + ') : le visuel et son cadrage restent chez Sam');

  // ---------- 6. le pack exporté, avant et après changement de page ----------
  await rangerFenetres();
  await p.waitForTimeout(300);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', (e) => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(2500);
  r = await releve(v, false);
  if (!r.sam.pose || r.sam.pos !== cadrage)
    fail('pack ouvert : le visuel de Sam ou son cadrage manque (' + JSON.stringify(r.sam) + ')');
  ok('pack ouvert : visuel et cadrage en place');
  await v.click('#pg');
  await v.waitForTimeout(2600);
  r = await releve(v, false);
  if (!r.sam.pose) fail('pack, après changement de page : le carré de Sam est revenu au gabarit');
  if (r.barjola.pose || r.pipo.pose)
    fail('pack, après changement de page : le visuel de Sam est passé chez le voisin (' + r._ordre + ')');
  if (r.sam.pos !== cadrage)
    fail('pack, après changement de page : le cadrage est perdu (' + r.sam.pos + ')');
  ok('pack, après changement de page : tout reste chez Sam, cadrage compris');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
