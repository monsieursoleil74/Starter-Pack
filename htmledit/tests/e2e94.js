/* CONTRAT v2 : la maquette étiquette chaque contenu remplaçable
   (data-slot / data-slot-texte) et maintient l'étiquette à jour quand la
   page change de contenu. L'éditeur s'ancre alors DIRECTEMENT : plus de
   témoin, plus de chemin fragile, plus de réserve devinée.
   Ce test est la réception du contrat : images, texte, vidéos d'une fenêtre
   partagée, vues multiples d'un même slot, grille réordonnée — dans
   l'éditeur et dans le pack exporté.
   Usage : node e2e94.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_v2.html');
const A = path.resolve(__dirname, 'e2e94_a.png');
const OUT = path.resolve(__dirname, 'v2_export.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

const PERSOS = ['sam', 'barjola', 'pipo'];
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pack v2</title>
<style>body{font-family:sans-serif;background:#1d241d;color:#dfe7df;padding:24px;margin:0}
#grille{display:flex;gap:18px;flex-wrap:wrap}
.carte{width:210px;border:3px solid #6f8f6f;border-radius:20px;padding:12px;text-align:center;
  background:#2a332a}
.carte img{width:180px;height:180px;object-fit:cover;display:block;border-radius:12px;background:#232c23}
.carte b{display:block;margin-top:8px;font-size:18px}
.tuto{display:inline-block;margin:6px;padding:12px 20px;border:1px solid #6f8f6f;border-radius:10px;
  background:#2a332a;color:#dfe7df;cursor:pointer}
#fen{position:fixed;inset:6% 12%;background:#0b0e0b;border-radius:14px;display:none;
  flex-direction:column;align-items:center;gap:10px;padding:18px;z-index:50}
#fen video{width:82%;height:60%;background:#000}
.deco{display:flex;gap:16px;margin-top:26px}
.deco img{background:#232c23;object-fit:cover}
</style></head><body>
<h1>Personnages</h1><button id="pg">Changer de page</button>
<div id="grille"></div>
<h1>Tutoriels</h1>
<button class="tuto" data-t="manuel">MANUEL</button>
<button class="tuto" data-t="rig">PRESENTATION RIG</button>
<div id="fen">
  <h3 id="fenTitre" style="margin:0"></h3>
  <video id="fenVid" controls></video>
  <button id="fenX">Fermer</button>
</div>
<h1>Décor</h1>
<div class="deco">
  <img data-slot="decors/01" alt="Décor 01 (vignette)" style="width:120px;height:90px">
  <img data-slot="decors/01" alt="Décor 01 (grand)" style="width:360px;height:270px">
</div>
<script>
  var modele = ${JSON.stringify(PERSOS)};
  function peindre() {
    document.getElementById('grille').innerHTML = modele.map(function (n) {
      return '<div class="carte">' +
        '<img data-slot="personnages/' + n + '/portrait" alt="Portrait ' + n + '">' +
        '<b data-slot-texte="personnages/' + n + '/nom">' + n.toUpperCase() + '</b></div>';
    }).join('');
  }
  peindre();
  document.getElementById('pg').addEventListener('click', function () {
    modele = modele.slice(1).concat(modele[0]);      // la grille se réordonne
    peindre();
  });
  [].forEach.call(document.querySelectorAll('.tuto'), function (b) {
    b.addEventListener('click', function () {
      document.getElementById('fenTitre').textContent = 'Tutoriel ' + b.dataset.t.toUpperCase();
      var v = document.getElementById('fenVid');
      // contrat v2, règle 3 : la fenêtre partagée met à jour SON étiquette
      v.setAttribute('data-slot', 'tutos/' + b.dataset.t + '/video');
      v.removeAttribute('src');
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
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1300, height: 900 } });
  const gen = await ctx.newPage();
  await gen.goto('about:blank');
  const b64 = await gen.evaluate(() => {
    const cv = document.createElement('canvas');
    cv.width = 420; cv.height = 140;
    const g = cv.getContext('2d');
    g.fillStyle = '#2b6cb0'; g.fillRect(0, 0, 420, 140);
    for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(i * 14, (i * 37) % 120, 8, 8); }
    return cv.toDataURL('image/png').split(',')[1];
  });
  fs.writeFileSync(A, Buffer.from(b64, 'base64'));
  await gen.close();

  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => { if (!/Clipboard|writeText/.test(e.message)) errs.push(e.message); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1400);

  const viser = (sel) => p.evaluate((q) => {
    const d = document.getElementById('frame').contentDocument;
    const n = d.querySelector(q);
    n.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = n.getBoundingClientRect();
    const f = document.getElementById('frame').getBoundingClientRect();
    return { x: f.left + r.left + r.width / 2, y: f.top + r.top + r.height / 2 };
  }, sel);
  const dansPage = (fn, arg) => p.evaluate(([f, a]) => {
    const d = document.getElementById('frame').contentDocument;
    return d.defaultView.eval(f)(d, a);
  }, [fn, arg]);
  const ranger = () => p.evaluate(() => ['ask', 'askv', 'askl', 'askg', 'askm', 'crop'].forEach((i) => {
    const e = document.getElementById(i); if (e) e.classList.add('hidden'); }));

  // ---------- 1. portrait de Sam : remplacé + cadré, par son slot ----------
  await p.click('#mImg');
  await p.waitForTimeout(400);
  let c = await viser('[data-slot="personnages/sam/portrait"]');
  // l'emplacement est vide : le clic ouvre l'explorateur directement ;
  // s'il portait déjà un visuel, le cadrage s'ouvrirait — on couvre les deux
  const chA = p.waitForEvent('filechooser', { timeout: 15000 }).catch(() => null);
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(700);
  if (!(await p.$eval('#crop', (e) => e.classList.contains('hidden')))) await p.click('#cropRemp');
  else if (!(await p.$eval('#ask', (e) => e.classList.contains('hidden')))) await p.click('#askCover');
  const ch = await chA;
  if (!ch) fail('le clic sur le portrait vide n’a ouvert ni explorateur, ni cadrage, ni proposition');
  await ch.setFiles(A);
  await p.waitForTimeout(1800);
  await ranger();

  // ---------- 2. son nom, par slot texte ----------
  await p.click('#mText');
  await p.waitForTimeout(400);
  c = await viser('[data-slot-texte="personnages/sam/nom"]');
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(500);
  await p.keyboard.press('ControlOrMeta+a');
  await p.keyboard.type('SAMUEL');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(800);

  // ---------- 3. deux vidéos dans la fenêtre partagée ----------
  const poserVideo = async (lbl, chemin) => {
    await p.click('#mVid');
    await p.waitForTimeout(400);
    const b = await p.evaluate((q) => {
      const d = document.getElementById('frame').contentDocument;
      const n = [...d.querySelectorAll('.tuto')].find((x) => (x.textContent || '').trim() === q);
      n.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = n.getBoundingClientRect();
      const f = document.getElementById('frame').getBoundingClientRect();
      return { x: f.left + r.left + r.width / 2, y: f.top + r.top + r.height / 2 };
    }, lbl);
    await p.mouse.click(b.x, b.y);
    await p.waitForTimeout(1400);
    if (await p.$eval('#askv', (e) => e.classList.contains('hidden')))
      fail('la fenêtre vidéo n’a pas été proposée pour ' + lbl);
    p.once('dialog', (d) => d.accept(chemin));
    await p.click('#askvLien');
    await p.waitForTimeout(800);
    await p.click('#mView');
    await p.waitForTimeout(300);
    const x = await viser('#fenX');
    await p.mouse.click(x.x, x.y);
    await p.waitForTimeout(400);
  };
  await poserVideo('MANUEL', 'videos/manuel.mp4');
  await poserVideo('PRESENTATION RIG', 'videos/rig.mp4');

  // ---------- 4. le décor : les DEUX vues suivent dans l'éditeur ----------
  await p.click('#mImg');
  await p.waitForTimeout(400);
  c = await viser('.deco img:first-child');
  const chB = p.waitForEvent('filechooser');
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(700);
  if (!(await p.$eval('#crop', (e) => e.classList.contains('hidden')))) await p.click('#cropRemp');
  const ch2 = await chB;
  await ch2.setFiles(A);
  await p.waitForTimeout(1800);
  await ranger();
  const vuesDeco = await dansPage(`(function (d) {
    return [...d.querySelectorAll('[data-slot="decors/01"]')]
      .map((n) => /^(data|blob):/.test(n.getAttribute('src') || ''));
  })`);
  if (vuesDeco.length !== 2 || vuesDeco.some((x) => !x))
    fail('éditeur : les deux vues du décor devraient suivre (' + JSON.stringify(vuesDeco) + ')');
  ok('éditeur : la vignette ET l’agrandissement du décor suivent (même slot)');

  // ---------- 5. l'ancrage est bien DIRECT : slots partout, zéro témoin ----------
  const anc = await p.evaluate(() => {
    const l = [...document.querySelectorAll('#list .it')].length;
    return { retouches: l };
  });
  if (anc.retouches !== 5) fail(anc.retouches + ' retouches au lieu de 5');
  // ---------- 6. grille réordonnée : tout reste chez Sam ----------
  await p.click('#mView');
  await p.waitForTimeout(300);
  await p.frameLocator('#frame').locator('#pg').click();
  await p.waitForTimeout(2200);
  const apresTri = await dansPage(`(function (d) {
    const im = d.querySelector('[data-slot="personnages/sam/portrait"]');
    const autres = [...d.querySelectorAll('[data-slot$="/portrait"]')]
      .filter((n) => n !== im && /^(data|blob):/.test(n.getAttribute('src') || '')).length;
    return { sam: /^(data|blob):/.test(im.getAttribute('src') || ''),
             nom: (d.querySelector('[data-slot-texte="personnages/sam/nom"]').textContent || '').trim(),
             fuites: autres,
             ordre: [...d.querySelectorAll('.carte b')].map((x) => x.getAttribute('data-slot-texte')).join() };
  })`);
  if (apresTri.ordre.indexOf('sam') === 0) fail('la grille ne s’est pas réordonnée');
  if (!apresTri.sam) fail('après réordonnancement, le portrait de Sam est perdu');
  if (apresTri.fuites) fail('le portrait a fui chez ' + apresTri.fuites + ' voisin(s)');
  if (apresTri.nom !== 'SAMUEL') fail('le nom de Sam est perdu : ' + apresTri.nom);
  ok('grille réordonnée : portrait et nom restent chez Sam, aucune fuite');

  // ---------- 7. l'export : slots exportés, aucun témoin ----------
  await ranger();
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const dd = JSON.parse(fs.readFileSync(OUT, 'utf8')
    .match(/<script id="pack-edit-data"[^>]*>([\s\S]*?)<\/script>/)[1].replace(/<\\\//g, '</'));
  const utiles = dd.filter((x) => x.kind !== 'head');
  if (utiles.length !== 5) fail('export : ' + utiles.length + ' retouches au lieu de 5');
  const sansSlot = utiles.filter((x) => !x.slot);
  if (sansSlot.length)
    fail('export : ' + sansSlot.length + ' retouche(s) sans slot (' +
         sansSlot.map((x) => x.kind).join(',') + ') — l’ancrage v2 n’a pas pris');
  if (utiles.some((x) => x.when))
    fail('export : une retouche étiquetée porte encore un témoin — la devinette n’est pas éteinte');
  ok('export : 5 retouches, toutes ancrées par slot, zéro témoin');

  // ---------- 8. le pack : réordonné, multi-vues, vidéos par tutoriel ----------
  const v = await ctx.newPage();
  v.on('pageerror', (e) => errs.push('[pack] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(2200);
  await v.click('#pg');                                  // la grille se réordonne
  await v.waitForTimeout(2200);
  const pk = await v.evaluate(() => {
    const im = document.querySelector('[data-slot="personnages/sam/portrait"]');
    const deco = [...document.querySelectorAll('[data-slot="decors/01"]')].map((n) => {
      const st = getComputedStyle(n);
      return /^(data|blob)/.test(n.getAttribute('src') || '') ||
             /url\("(data|blob)/.test(st.content || '');
    });
    return { sam: /^(data|blob):/.test(im.getAttribute('src') || ''),
             nom: (document.querySelector('[data-slot-texte="personnages/sam/nom"]').textContent || '').trim(),
             deco };
  });
  if (!pk.sam) fail('pack réordonné : portrait de Sam perdu');
  if (pk.nom !== 'SAMUEL') fail('pack réordonné : nom de Sam perdu (' + pk.nom + ')');
  if (pk.deco.length !== 2 || pk.deco.some((x) => !x))
    fail('pack : les deux vues du décor ne suivent pas (' + JSON.stringify(pk.deco) + ')');
  ok('pack réordonné : portrait, nom et les deux vues du décor en place');

  const tuto = async (lbl, attendu) => {
    await v.evaluate((q) => {
      [...document.querySelectorAll('.tuto')].find((x) => (x.textContent || '').trim() === q).click();
    }, lbl);
    await v.waitForTimeout(1600);
    const src = await v.evaluate(() => document.getElementById('fenVid').getAttribute('src') || '');
    if (src.indexOf(attendu) < 0)
      fail('pack, ' + lbl + ' : la fenêtre lit ' + JSON.stringify(src) + ' au lieu de ' + attendu);
    await v.evaluate(() => document.getElementById('fenX').click());
    await v.waitForTimeout(300);
  };
  // le fichier n'existe pas sur ce disque : le repli d'introuvable peut
  // réécrire videos/ en video/ — c'est l'IDENTITÉ de la vidéo qu'on vérifie
  await tuto('MANUEL', 'manuel.mp4');
  await tuto('PRESENTATION RIG', 'rig.mp4');
  await tuto('MANUEL', 'manuel.mp4');
  ok('pack : la fenêtre partagée sert chaque tutoriel par son étiquette');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
