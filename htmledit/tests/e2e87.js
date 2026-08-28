/* Reposer un visuel au même endroit APRÈS que la page a bougé (grille de
   personnages reconstruite dans un autre ordre) empilait une SECONDE
   retouche : l'emplacement n'était reconnu que par sa position. Les deux se
   disputaient alors l'affichage à chaque passe — on zoomait, le curseur
   montait, et l'image restait à sa taille de base.
   Un visuel reposé au même endroit REMPLACE donc le précédent, et le zoom
   tient. Usage : node e2e87.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_zoom.html');
const A = path.resolve(__dirname, 'e2e87_a.png');
const B = path.resolve(__dirname, 'e2e87_b.png');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

const PERSOS = ['tito', 'stanley', 'pipo'];
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Personnages</title>
<style>body{font-family:sans-serif;background:#1d241d;color:#dfe7df;padding:24px;margin:0}
#grille{display:flex;gap:18px;flex-wrap:wrap}
.carte{width:210px;border:3px solid #b9a2a2;border-radius:20px;padding:12px;text-align:center;
  background:#2a332a}
.slot{width:180px;height:180px;border-radius:14px;background:#232c23;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:4px;overflow:hidden}
.slot .lb{font-size:9px;letter-spacing:2px;opacity:.65}
.slot .nm{font-size:17px;font-weight:800}
.carte b{display:block;margin-top:10px;font-size:20px}
</style></head><body>
<h1>Personnages</h1><button id="pg">Changer de page</button>
<div id="grille"></div>
<script>
  var modele = ${JSON.stringify(PERSOS)};
  function peindre() {
    document.getElementById('grille').innerHTML = modele.map(function (n) {
      return '<div class="carte" data-p="' + n + '">' +
        '<div class="slot" data-k="assets/' + n + '_portrait.png">' +
        '<span class="lb">PORTRAIT</span><span class="nm">' + n.toUpperCase() + '</span></div>' +
        '<b>' + n[0].toUpperCase() + n.slice(1) + '</b></div>';
    }).join('');
  }
  peindre();
  document.getElementById('pg').addEventListener('click', function () {
    modele = modele.slice(1).concat(modele[0]);      // la grille se réordonne
    peindre();
  });
</script></body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1300, height: 850 } });
  const gen = await ctx.newPage();
  await gen.goto('about:blank');
  for (const [f, c] of [[A, '#2b6cb0'], [B, '#b02b6c']]) {
    const b64 = await gen.evaluate((col) => {
      const cv = document.createElement('canvas');
      cv.width = 420; cv.height = 140;                 // large dans un carré : il y a de quoi zoomer
      const g = cv.getContext('2d');
      g.fillStyle = col; g.fillRect(0, 0, 420, 140);
      for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(i * 14, (i * 37) % 120, 8, 8); }
      return cv.toDataURL('image/png').split(',')[1];
    }, c);
    fs.writeFileSync(f, Buffer.from(b64, 'base64'));
  }
  await gen.close();

  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => { if (!/Clipboard|writeText/.test(e.message)) errs.push(e.message); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1400);

  const viser = () => p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const n = d.querySelector('.carte[data-p="tito"] .slot');
    n.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = n.getBoundingClientRect();
    const f = document.getElementById('frame').getBoundingClientRect();
    return { x: f.left + r.left + r.width / 2, y: f.top + r.top + r.height / 2 };
  });
  const ouv = async () => !(await p.$eval('#crop', (e) => e.classList.contains('hidden')));
  const ranger = () => p.evaluate(() => ['ask', 'askv', 'askl', 'askg', 'askm']
    .forEach((i) => { const e = document.getElementById(i); if (e) e.classList.add('hidden'); }));
  const nb = () => p.$$eval('#list .it', (l) => l.length);
  const taille = () => p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const s = d.querySelector('.carte[data-p="tito"] .slot');
    return d.defaultView.getComputedStyle(s).backgroundSize;
  });
  const poser = async (fichier) => {
    await p.click('#mImg');
    await p.waitForTimeout(400);
    const c = await viser();
    await p.mouse.click(c.x, c.y);
    await p.waitForTimeout(700);
    if (!(await p.$eval('#ask', (e) => e.classList.contains('hidden')))) {
      const [ch] = await Promise.all([p.waitForEvent('filechooser'), p.click('#askCover')]);
      await ch.setFiles(fichier);
    } else if (await ouv()) {
      const [ch] = await Promise.all([p.waitForEvent('filechooser'), p.click('#cropRemp')]);
      await ch.setFiles(fichier);
    } else fail('cliquer l’emplacement ne propose ni pose ni cadrage');
    await p.waitForTimeout(1700);
    await ranger();
  };

  // ---------- 1. un visuel, un changement de page, un autre visuel ----------
  await poser(A);
  if ((await nb()) !== 1) fail('la première pose n’a pas créé une retouche (' + (await nb()) + ')');
  if (await ouv()) { await p.click('#cropOk'); await p.waitForTimeout(400); }
  await p.click('#mView');
  await p.waitForTimeout(400);
  await p.frameLocator('#frame').locator('#pg').click();
  await p.waitForTimeout(2200);
  const ordre = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    return [...d.querySelectorAll('.carte')].map((k) => k.dataset.p).join(',');
  });
  if (ordre === 'tito,stanley,pipo') fail('la grille ne s’est pas réordonnée — scénario non représentatif');
  ok('grille réordonnée (' + ordre + ')');

  await poser(B);
  const n2 = await nb();
  if (n2 !== 1)
    fail('reposer un visuel au même endroit a empilé ' + n2 + ' retouches au lieu de remplacer');
  ok('un visuel reposé au même endroit REMPLACE le précédent (1 retouche)');

  // ---------- 2. le zoom prend, et il tient ----------
  if (await ouv()) { await p.click('#cropOk'); await p.waitForTimeout(400); }
  await p.evaluate(() => {
    const it = document.querySelectorAll('#list .it');
    const b = it[0] && it[0].querySelector('button[title*="adr"]');
    if (b) b.click();
  });
  await p.waitForTimeout(800);
  if (!(await ouv())) {
    const c = await viser();
    await p.mouse.click(c.x, c.y);
    await p.waitForTimeout(800);
  }
  if (!(await ouv())) fail('impossible de rouvrir le cadrage');
  const avant = await taille();
  const c2 = await viser();
  await p.mouse.move(c2.x, c2.y);
  for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(60); }
  await p.waitForTimeout(300);
  const curseur = await p.$eval('#cropZ', (e) => e.value);
  const apres = await taille();
  if (curseur === '100') fail('la molette n’a pas fait monter le zoom');
  if (apres === avant)
    fail('le curseur monte à ' + curseur + ' % mais l’image reste à sa taille de base (' + avant + ')');
  ok('le zoom à la molette agrandit vraiment l’image (' + avant + ' → ' + apres + ')');

  // il tient : aucune passe ne le remet en arrière
  for (let t = 0; t < 6; t++) {
    await p.waitForTimeout(400);
    const m = await taille();
    if (m !== apres) fail('le zoom est revenu en arrière tout seul après ' + ((t + 1) * 0.4) + ' s : ' + m);
  }
  ok('le zoom tient (aucun retour en arrière sur 2,4 s)');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
