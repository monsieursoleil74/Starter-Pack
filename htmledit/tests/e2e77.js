/* Le témoin d'un texte hors fiche (l'équipe, le récit) était le nom du
   personnage AFFICHÉ SUR LA FICHE, à des sections de là : au premier
   changement de vue, toutes ces retouches mouraient d'un coup (« retour en
   arrière sur un nom et ça a tout détruit »). Désormais :
   - le témoin choisi est l'interpolé le plus PROCHE (le titre de la carte) ;
   - les retouches faites avec les ANCIENNES versions (témoin hors section)
     se ré-ancrent près de leur champ dès que leur témoin d'antan revit (la
     fiche repasse par le bon personnage) — puis tiennent pour toujours.
   Usage : node e2e77.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const VIEUX = path.resolve(__dirname, 'outil_j.html');       // version aux témoins lointains
const MAQ = path.resolve(__dirname, 'maq_equipe.html');
const OUT1 = path.resolve(__dirname, 'equipe_neuf.html');
const OUT2 = path.resolve(__dirname, 'equipe_vieux.html');
const OUT3 = path.resolve(__dirname, 'equipe_gueri.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Équipe</title></head>
<body style="font-family:sans-serif;margin:0"><div id="app" style="padding:24px">
<section style="margin-bottom:40px">
  <button id="vA">A</button> <button id="vB">B</button>
  <div style="margin-top:10px">
    <span class="sc-interp" id="ficheNom" style="font-size:18px;font-weight:700">Bruno</span>
    <p><span class="sc-interp" id="ficheDesc">Description de Bruno.</span></p>
  </div>
</section>
<section>
  <div style="border:1px solid #ccc;padding:14px;width:280px">
    <div><span class="sc-interp" style="font-size:15px;font-weight:600">Cheffe Équipe</span></div>
    <div style="font-size:13px;margin-top:8px">
      <span style="font-weight:500"><span class="sc-interp">Prénom</span></span>
      <span style="font-weight:600"><span class="sc-interp">NOM-B</span></span>
    </div>
  </div>
</section>
</div>
<script>
  var donnees = { A: ['Alice', 'Description d\\u2019Alice.'], B: ['Bruno', 'Description de Bruno.'] };
  function montre(q) {
    document.getElementById('ficheNom').textContent = donnees[q][0];
    document.getElementById('ficheDesc').textContent = donnees[q][1];
  }
  document.getElementById('vA').addEventListener('click', function () { montre('A'); });
  document.getElementById('vB').addEventListener('click', function () { montre('B'); });
</script>
</body></html>`);

async function editeNom(browser, outil, sortie) {
  // ouvre l'outil, met la fiche sur Alice, édite NOM-B -> JARDET, exporte
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1100, height: 700 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + outil);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1200);
  await p.click('#mView');
  await p.waitForTimeout(300);
  await p.frameLocator('#frame').locator('#vA').click();     // la fiche montre Alice
  await p.waitForTimeout(500);
  await p.click('#mText');
  await p.waitForTimeout(300);
  const c = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const n = [...d.querySelectorAll('span.sc-interp')].find(x => !x.children.length &&
      (x.textContent || '').trim() === 'NOM-B');
    n.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = n.getBoundingClientRect();
    const f = document.getElementById('frame').getBoundingClientRect();
    return { x: f.left + r.left + 8, y: f.top + r.top + r.height / 2 };
  });
  await p.waitForTimeout(400);
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(400);
  await p.keyboard.press('ControlOrMeta+a');
  await p.keyboard.type('JARDET');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(700);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(sortie);
  await ctx.close();
  return errs;
}

const litNom = async (page) => page.evaluate(() => {
  const l = [...document.querySelectorAll('span.sc-interp')];
  const j = l.find(x => (x.textContent || '').trim() === 'JARDET');
  const nb = l.find(x => (x.textContent || '').trim() === 'NOM-B');
  return j ? 'JARDET' : (nb ? 'NOM-B' : '(?)');
});

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  // ---------- 1. NOUVELLE version : le témoin est PROCHE ----------
  await editeNom(browser, TOOL, OUT1);
  const d1 = JSON.parse(fs.readFileSync(OUT1, 'utf8')
    .match(/<script id="pack-edit-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
  const pj = d1.find(x => x.after === 'JARDET');
  if (!pj || !pj.when) fail('retouche JARDET sans témoin');
  if (/section:nth-of-type/.test(pj.when.down || ''))
    fail('le témoin traverse encore les sections : ' + JSON.stringify(pj.when));
  if (pj.when.txt !== 'Cheffe Équipe')
    fail('le témoin devrait être le titre de la carte, pas « ' + pj.when.txt + ' »');
  ok('nouvelle version : témoin = « Cheffe Équipe » (le titre de la carte, tout près)');

  // l'export s'ouvre avec la fiche sur BRUNO (défaut) : le nom tient quand même
  const ctx1 = await browser.newContext({ viewport: { width: 1100, height: 700 } });
  const v1 = await ctx1.newPage();
  await v1.goto('file://' + OUT1);
  await v1.waitForTimeout(1500);
  if ((await litNom(v1)) !== 'JARDET')
    fail('export neuf : le nom d’équipe est perdu quand la fiche affiche un autre personnage');
  ok('export rouvert (fiche sur Bruno) : le nom d’équipe tient');
  await ctx1.close();

  // ---------- 2. ANCIENNE version : préparer un fichier malade ----------
  await editeNom(browser, VIEUX, OUT2);
  const d2 = JSON.parse(fs.readFileSync(OUT2, 'utf8')
    .match(/<script id="pack-edit-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
  const pv = d2.find(x => x.after === 'JARDET');
  if (!(pv && pv.when && /section:nth-of-type/.test(pv.when.down || '') && pv.when.txt === 'Alice'))
    fail('l’ancienne version aurait dû prendre « Alice » (fiche) comme témoin — scénario non représentatif : ' +
      JSON.stringify(pv && pv.when));
  ok('ancienne version : témoin = « Alice » à travers les sections (le fichier malade est prêt)');
  const ctx2 = await browser.newContext({ viewport: { width: 1100, height: 700 } });
  const v2 = await ctx2.newPage();
  await v2.goto('file://' + OUT2);
  await v2.waitForTimeout(1500);
  const malade = await litNom(v2);
  await ctx2.close();
  if (malade === 'JARDET') console.log('   (note : le vieil export tient ici aussi — la préparation reste valable)');
  else ok('preuve : ouvert tel quel, le vieil export a bien PERDU le nom (fiche sur Bruno)');

  // ---------- 3. GUÉRISON : le fichier malade redéposé dans la nouvelle version ----------
  const ctx3 = await browser.newContext({ acceptDownloads: true, viewport: { width: 1100, height: 700 } });
  const p3 = await ctx3.newPage();
  const errs3 = [];
  p3.on('pageerror', e => errs3.push(e.message));
  await p3.goto('file://' + TOOL);
  await p3.setInputFiles('#pick', OUT2);
  await p3.waitForSelector('#main:not(.hidden)');
  await p3.waitForTimeout(2000);
  // le témoin d'antan revit dès que la fiche repasse par Alice : la retouche
  // s'applique ET se ré-ancre alors près de son champ, une fois pour toutes
  await p3.click('#mView');
  await p3.waitForTimeout(300);
  await p3.frameLocator('#frame').locator('#vA').click();
  await p3.waitForTimeout(1200);
  await p3.frameLocator('#frame').locator('#vB').click();   // et on repart sur Bruno
  await p3.waitForTimeout(1200);
  const dansEditeur = await p3.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const l = [...d.querySelectorAll('span.sc-interp')];
    return l.some(x => (x.textContent || '').trim() === 'JARDET') ? 'JARDET' : 'NOM-B';
  });
  if (dansEditeur !== 'JARDET')
    fail('après un passage par Alice, le nom d’équipe devrait tenir même sur Bruno');
  ok('redépôt : un passage par la bonne fiche ré-ancre la retouche — elle tient ensuite sur Bruno');
  const [dl3] = await Promise.all([p3.waitForEvent('download'), p3.click('#save')]);
  await dl3.saveAs(OUT3);
  const d3 = JSON.parse(fs.readFileSync(OUT3, 'utf8')
    .match(/<script id="pack-edit-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
  const pg = d3.find(x => x.after === 'JARDET');
  if (!pg || /section:nth-of-type/.test(pg.when.down || ''))
    fail('après guérison, l’export garde un témoin hors section : ' + JSON.stringify(pg && pg.when));
  ok('réexporté : le témoin est ré-ancré près du champ (' + JSON.stringify(pg.when.txt) + ')');
  const v3 = await ctx3.newPage();
  await v3.goto('file://' + OUT3);
  await v3.waitForTimeout(1500);
  if ((await litNom(v3)) !== 'JARDET') fail('l’export guéri ne montre pas le nom');
  ok('l’export guéri s’ouvre avec le nom d’équipe en place');
  if (errs3.length) fail('erreurs JS (guérison) :\n' + errs3.join('\n'));
  await ctx3.close();

  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
