/* La zone d'une image appartient à la MAQUETTE, pas au fichier posé.
   Beaucoup de maquettes laissent l'image dicter une dimension (bannière en
   width:100%/height:auto, logo en height fixe/width:auto, image brute sans
   style) : y poser une grande image agrandissait la zone et poussait toute
   la page. L'éditeur doit rendre son gabarit à la zone — et le pack aussi.
   Usage : node e2e95.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'e2e95_maq.html');
const GRANDE = path.resolve(__dirname, 'e2e95_grande.png');
const OUT = path.resolve(__dirname, 'e2e95_pack.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

// petits protos embarqués (dessinés à la volée plus bas)
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1200, height: 850 } });

  const gen = await ctx.newPage();
  await gen.goto('about:blank');
  const dessine = (w, h, c) => gen.evaluate(([w2, h2, c2]) => {
    const cv = document.createElement('canvas');
    cv.width = w2; cv.height = h2;
    const g = cv.getContext('2d');
    g.fillStyle = c2; g.fillRect(0, 0, w2, h2);
    g.fillStyle = '#fff'; g.fillRect(4, 4, Math.min(40, w2 - 8), Math.min(40, h2 - 8));
    return cv.toDataURL('image/png');
  }, [w, h, c]);
  const bandeau = await dessine(600, 150, '#356');   // ratio 4:1
  const logo = await dessine(200, 50, '#635');
  const brut = await dessine(300, 100, '#563');
  const pastille = await dessine(100, 100, '#553');
  const grande = await dessine(500, 1200, '#a33');   // TRÈS verticale
  fs.writeFileSync(GRANDE, Buffer.from(grande.split(',')[1], 'base64'));
  await gen.close();

  fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Zones</title>
<style>body{font-family:sans-serif;background:#1a211a;color:#dfe7df;margin:0;padding:20px}
main{max-width:900px;margin:0 auto}</style></head><body><main>
<h1>LE PROJET</h1>
<img id="bandeau" data-slot="projet/bandeau" src="${bandeau}" alt="Bandeau"
     style="display:block;width:100%;height:auto">
<p>Sous le bandeau : ce paragraphe doit rester à sa place.</p>
<img id="logo" data-slot="projet/logo" src="${logo}" alt="Logo"
     style="display:block;height:40px;width:auto">
<img id="brut" data-slot="projet/brut" src="${brut}" alt="Brut">
<img id="pastille" data-slot="projet/pastille" src="${pastille}" alt="Pastille"
     style="width:90px;height:90px;object-fit:cover;border-radius:50%">
<p id="pied">Pied de page témoin.</p>
</main></body></html>`);

  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => { if (!/Clipboard|writeText/.test(e.message)) errs.push(e.message); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1400);

  const boite = (sel) => p.evaluate((q) => {
    const d = document.getElementById('frame').contentDocument;
    const r = d.querySelector(q).getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  }, sel);
  const avant = {
    bandeau: await boite('#bandeau'), logo: await boite('#logo'),
    brut: await boite('#brut'), pastille: await boite('#pastille'),
  };
  if (avant.bandeau.h < 100 || avant.bandeau.h > 350)
    fail('maquette de test : bandeau inattendu ' + JSON.stringify(avant.bandeau));

  // ---------- poser la GRANDE image (500x1200) sur chaque zone ----------
  await p.click('#mImg');
  await p.waitForTimeout(500);
  const poserSur = async (sel) => {
    const c = await p.evaluate((q) => {
      const d = document.getElementById('frame').contentDocument;
      const n = d.querySelector(q);
      n.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = n.getBoundingClientRect();
      const f = document.getElementById('frame').getBoundingClientRect();
      return { x: f.left + r.left + r.width / 2, y: f.top + r.top + r.height / 2 };
    }, sel);
    const chA = p.waitForEvent('filechooser', { timeout: 15000 }).catch(() => null);
    await p.mouse.click(c.x, c.y);
    await p.waitForTimeout(700);
    if (!(await p.$eval('#crop', (e) => e.classList.contains('hidden')))) await p.click('#cropRemp');
    else if (!(await p.$eval('#ask', (e) => e.classList.contains('hidden')))) await p.click('#askCover');
    const ch = await chA;
    if (!ch) fail(sel + ' : ni explorateur ni cadrage au clic');
    await ch.setFiles(GRANDE);
    await p.waitForTimeout(1600);
    await p.evaluate(() => ['ask', 'askv', 'askl', 'askg', 'askm', 'crop'].forEach((i) => {
      const e = document.getElementById(i); if (e) e.classList.add('hidden'); }));
  };
  await poserSur('#bandeau');
  await poserSur('#logo');
  await poserSur('#brut');
  await poserSur('#pastille');
  await p.waitForTimeout(1200);          // le temps que l'éditeur fige les zones

  // ---------- éditeur : chaque zone garde son gabarit ----------
  const proche = (a, b, tol) => Math.abs(a - b) <= tol;
  const verifie = async (etiq, lireBoite) => {
    for (const [nom, av] of Object.entries(avant)) {
      const ap = await lireBoite('#' + nom);
      if (!proche(ap.w, av.w, 8) || !proche(ap.h, av.h, 8))
        fail(etiq + ' : la zone « ' + nom + ' » a bougé — ' + JSON.stringify(av) + ' → ' + JSON.stringify(ap) +
             ' (l’image posée dicte la taille au lieu de rester dans la zone)');
    }
    ok(etiq + ' : les quatre zones gardent le gabarit de la maquette');
  };
  await verifie('éditeur', boite);
  // les images posées sont bien affichées (pas de zone verrouillée mais vide)
  const srcs = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    return ['bandeau', 'logo', 'brut', 'pastille'].map((i) => (d.getElementById(i).getAttribute('src') || '').slice(0, 5));
  });
  if (srcs.some((s) => s !== 'data:')) fail('éditeur : une image posée manque (' + JSON.stringify(srcs) + ')');

  // ---------- export → pack ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const dd = JSON.parse(fs.readFileSync(OUT, 'utf8')
    .match(/<script id="pack-edit-data"[^>]*>([\s\S]*?)<\/script>/)[1].replace(/<\\\//g, '</'));
  const imgs = dd.filter((x) => x.kind === 'img');
  if (imgs.length !== 4) fail('export : ' + imgs.length + ' retouches image au lieu de 4');

  // la référence du pack, c'est la MAQUETTE D'ORIGINE dans la même fenêtre
  // (l'aperçu de l'éditeur est plus étroit : panneau latéral)
  const ref = await ctx.newPage();
  await ref.goto('file://' + MAQ);
  await ref.waitForTimeout(600);
  const avantPack = {};
  for (const nom of Object.keys(avant))
    avantPack[nom] = await ref.evaluate((q) => {
      const r = document.querySelector(q).getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    }, '#' + nom);
  await ref.close();

  const v = await ctx.newPage();
  v.on('pageerror', (e) => errs.push('[pack] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(2200);
  const boiteV = (sel) => v.evaluate((q) => {
    const r = document.querySelector(q).getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  }, sel);
  for (const [nom, av] of Object.entries(avantPack)) {
    const ap = await boiteV('#' + nom);
    if (!proche(ap.w, av.w, 8) || !proche(ap.h, av.h, 8))
      fail('pack : la zone « ' + nom + ' » a bougé — ' + JSON.stringify(av) + ' → ' + JSON.stringify(ap) +
           ' (l’image posée dicte la taille au lieu de rester dans la zone)');
  }
  ok('pack : les quatre zones gardent le gabarit de la maquette');
  const srcsV = await v.evaluate(() =>
    ['bandeau', 'logo', 'brut', 'pastille'].map((i) => (document.getElementById(i).getAttribute('src') || '').slice(0, 5)));
  if (srcsV.some((s) => s !== 'data:')) fail('pack : une image posée manque (' + JSON.stringify(srcsV) + ')');
  ok('pack : les quatre images posées sont servies');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
