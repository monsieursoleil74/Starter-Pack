/* Retours terrain n°2 :
   1) deux réalisateurs partagent le même fichier générique → ne changer que
      celui qu'on clique ;
   2) la maquette retrouve ses planches en comparant les src (lightbox) → le
      remplacement ne doit plus casser ce repérage ;
   3) « Toute l'image » : montrer le visuel en entier au lieu de rogner ;
   4) après un remplacement, le panneau montre la famille concernée ;
   5) re-rendre la galerie ne renvoie plus en haut du panneau. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_identite.html');
const PNG = path.resolve(__dirname, 'remplacement.png');
const LARGE = path.resolve(__dirname, 'large.png');
const OUT = path.resolve(__dirname, 'identite_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

const VIDE = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const FAM = ['anne', 'bill', 'bruno', 'gaby', 'hugo', 'june', 'karl', 'lea', 'lila', 'momo'];
const K = [];
FAM.forEach(f => { for (let i = 1; i <= 4; i++) K.push(`assets_nda/personnages/${f}/${f}_planche_0${i}.png`); });
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Identité</title>
<style>body{font-family:sans-serif;padding:20px;background:#eee}
#rg-assetmap{display:none}
.mini{width:130px;height:90px;object-fit:cover;background:#ccd;margin:3px}
.rond{width:52px;height:52px;object-fit:cover;border-radius:50%}
.pp{width:200px;height:320px;object-fit:cover;background:#dcd;display:block}
#lb{position:fixed;inset:0;background:rgba(0,0,0,.8);display:none;align-items:center;justify-content:center}
#lb.on{display:flex}#lb img{max-width:80vw;max-height:80vh}</style></head><body>
<h1>Identité par src</h1>
<div id="rg-assetmap">
${K.map((k, i) => `<img data-k="${k}" src="${VIDE}#a${i}">`).join('\n')}
<img data-k="assets_nda/ph_head.png" src="${VIDE}#head">
<img data-k="assets_nda/personnages/momo/momo_pleinpied.png" src="${VIDE}#pp">
</div>
<h2>Réalisation</h2>
<img class="rond" id="realA" alt="Réalisatrice A" src="${VIDE}#head">
<img class="rond" id="realB" alt="Réalisateur B" src="${VIDE}#head">
<h2>Momo — plein pied</h2>
<img class="pp" alt="Momo plein pied" src="${VIDE}#pp">
<h2>Planches</h2>
<div id="planches"></div>
<div id="lb"><img alt="" src=""></div>
<script>
// l'app garde SA table src → nom, comme la vraie maquette
var table = {};
document.querySelectorAll('#rg-assetmap [data-k]').forEach(function (n) {
  table[n.getAttribute('src')] = n.getAttribute('data-k');
});
// elle peint les planches de bruno depuis sa table
var pl = document.getElementById('planches');
Object.keys(table).filter(function (s) { return /bruno/.test(table[s]); }).forEach(function (s) {
  var im = document.createElement('img');
  im.className = 'mini';
  im.src = s;
  im.alt = table[s].split('/').pop();
  pl.appendChild(im);
});
// clic sur une planche → lightbox, résolue PAR LE SRC (le piège)
pl.addEventListener('click', function (e) {
  if (e.target.tagName !== 'IMG') return;
  var quoi = table[e.target.getAttribute('src')];
  var lb = document.getElementById('lb');
  lb.querySelector('img').src = quoi ? e.target.getAttribute('src') : '';
  lb.querySelector('img').alt = quoi || 'INCONNU';
  lb.classList.add('on');
});
document.getElementById('lb').addEventListener('click', function () { this.classList.remove('on'); });
<\/script>
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1360, height: 820 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(2200);
  const fr = p.frameLocator('#frame');
  await p.click('#mImg');
  await p.waitForTimeout(1500);

  // ---------- 1. réalisateurs : ne changer que celui qu'on clique ----------
  await fr.locator('#realA').click();
  await p.waitForTimeout(500);
  if (!(await p.$eval('#askg', e => e.classList.contains('hidden'))))
    await p.locator('#askgGrid .gi').first().click();
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', PNG);
  await p.waitForTimeout(1200);
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden')))) await p.click('#cropOk');
  const reals = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const w = d.defaultView;
    const rendu = n => w.getComputedStyle(n).content;
    const A = d.getElementById('realA'), B = d.getElementById('realB');
    return { srcA: A.getAttribute('src').slice(0, 16), aA: rendu(A).slice(0, 24),
             srcB: B.getAttribute('src').slice(0, 16), aB: rendu(B).slice(0, 24) };
  });
  const changeA = reals.srcA.indexOf('data:image/png') === 0 || /url/.test(reals.aA);
  const changeB = reals.srcB.indexOf('data:image/png') === 0 || (/url/.test(reals.aB) && reals.aB !== 'normal');
  if (!changeA) fail('la réalisatrice A n’a pas reçu sa photo : ' + JSON.stringify(reals));
  if (changeB) fail('la photo a débordé sur le réalisateur B : ' + JSON.stringify(reals));
  ok('réalisatrice A changée, réalisateur B intact (fichier générique partagé)');

  // ---------- 2. l'identité par src survit au remplacement d'une planche ----------
  // remplacer bruno_planche_02 via le panneau
  await p.evaluate(() => {
    const hd = [...document.querySelectorAll('#gal .hd')].find(n => /bruno/i.test(n.textContent));
    if (hd && hd.classList.contains('plie')) hd.click();
  });
  await p.waitForTimeout(700);
  const t2 = p.locator('#gal .g').filter({ hasText: /planche_02/i }).first();
  if (!(await t2.count())) fail('tuile bruno_planche_02 introuvable');
  await t2.click();
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', PNG);
  await p.waitForTimeout(1200);
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden')))) await p.click('#cropOk');

  const ident = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const w = d.defaultView;
    const im = [...d.querySelectorAll('#planches img')].find(n => /planche_02/.test(n.alt));
    return { src: im.getAttribute('src').slice(0, 14), contenu: w.getComputedStyle(im).content.slice(0, 30) };
  });
  if (ident.src === 'data:image/png')
    fail('le src de la copie affichée a été réécrit : l’app ne peut plus la reconnaître');
  if (!/url\("data:image\/png/.test(ident.contenu))
    fail('le remplacement ne s’affiche pas par-dessus : ' + JSON.stringify(ident));
  ok('la copie garde son src d’origine, le remplacement s’affiche par-dessus (CSS)');

  // en Aperçu, le lightbox retrouve la BONNE planche
  await p.click('#mView');
  await p.waitForTimeout(400);
  const im2 = fr.locator('#planches img').nth(1);
  await im2.scrollIntoViewIfNeeded();
  await im2.click();
  await p.waitForTimeout(600);
  const lb = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const l = d.getElementById('lb');
    return { on: l.classList.contains('on'), alt: l.querySelector('img').alt,
             contenu: d.defaultView.getComputedStyle(l.querySelector('img')).content.slice(0, 30) };
  });
  if (!lb.on) fail('le lightbox ne s’ouvre plus');
  if (!/planche_02/.test(lb.alt)) fail('le lightbox ouvre la mauvaise planche : ' + lb.alt);
  if (!/url\("data:image\/png/.test(lb.contenu))
    fail('le lightbox montre l’ancienne image : ' + JSON.stringify(lb));
  ok('le lightbox retrouve la bonne planche ET y montre le remplacement');
  await fr.locator('#lb').click();
  await p.waitForTimeout(300);

  // ---------- 3. « Toute l'image » sur le plein pied ----------
  await p.click('#mImg');
  await p.waitForTimeout(600);
  await fr.locator('img.pp').click();
  await p.waitForTimeout(500);
  if (!(await p.$eval('#askg', e => e.classList.contains('hidden'))))
    await p.locator('#askgGrid .gi').first().click();
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', LARGE);   // très large : cover ne montre qu'une tranche
  await p.waitForTimeout(1200);
  if (await p.$eval('#crop', e => e.classList.contains('hidden')))
    fail('le recadrage ne s’ouvre pas sur le plein pied');
  const btn = await p.$eval('#cropTout', e => e.textContent.trim());
  if (!/Toute l’image/.test(btn)) fail('le bouton « Toute l’image » manque : ' + btn);
  await p.click('#cropTout');
  await p.waitForTimeout(500);
  const pp = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const im = [...d.querySelectorAll('img')].find(n =>
      !n.closest('#rg-assetmap') && n.classList.contains('pp'));
    return { fit: im.style.objectFit, tr: im.style.transform };
  });
  if (pp.fit !== 'contain') fail('« Toute l’image » n’applique pas contain : ' + JSON.stringify(pp));
  ok('« Toute l’image » : le plein pied se montre en entier (contain), zoom neutralisé');
  const basc = await p.$eval('#cropTout', e => e.textContent.trim());
  if (!/Remplir le cadre/.test(basc)) fail('le bouton ne propose pas le retour : ' + basc);
  await p.click('#cropOk');
  await p.waitForTimeout(300);

  // ---------- 4 & 5. le panneau : repérage et position conservée ----------
  // remplacer une planche de LEA en cliquant DANS LA PAGE… d'abord peindre lea ?
  // (la page ne peint que bruno : on passe par la réserve → clic vignette momo)
  // → on vérifie le repérage : après le remplacement du plein pied (momo),
  //   la famille momo doit être dépliée et sa vignette visible dans le panneau
  const repere = await p.evaluate(() => {
    const t = [...document.querySelectorAll('#gal .g')]
      .find(n => (n.dataset.k || '').indexOf('momo_pleinpied') >= 0);
    if (!t) return { trouve: false };
    const r = t.getBoundingClientRect();
    const z = document.getElementById('sideHaut').getBoundingClientRect();
    return { trouve: true, visible: r.top >= z.top - 4 && r.bottom <= z.bottom + 4 };
  });
  if (!repere.trouve) fail('la vignette momo_pleinpied n’est pas dépliée après le remplacement');
  if (!repere.visible) fail('le panneau n’a pas amené la vignette en vue');
  ok('après un remplacement fait DANS LA PAGE, le panneau montre la famille et la vignette');

  // position conservée : défiler la liste, remplacer via une tuile, vérifier
  await p.evaluate(() => { document.getElementById('sideHaut').scrollTop = 300; });
  await p.waitForTimeout(200);
  const avantScroll = await p.evaluate(() => document.getElementById('sideHaut').scrollTop);
  if (avantScroll < 200) fail('mise en place du test de défilement ratée (' + avantScroll + ')');
  const tuileVisible = await p.evaluate(() => {
    const z = document.getElementById('sideHaut').getBoundingClientRect();
    const t = [...document.querySelectorAll('#gal .g')].find(n => {
      const r = n.getBoundingClientRect();
      return r.top >= z.top && r.bottom <= z.bottom;
    });
    if (!t) return null;
    t.id = 'tuileScroll';
    return t.dataset.k || t.dataset.sel;
  });
  if (!tuileVisible) fail('aucune tuile visible à mi-défilement');
  await p.click('#tuileScroll');
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', PNG);
  await p.waitForTimeout(1200);
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden')))) await p.click('#cropOk');
  const apresScroll = await p.evaluate(() => document.getElementById('sideHaut').scrollTop);
  if (apresScroll < 60)
    fail('le panneau est reparti en haut après le remplacement (' + avantScroll + ' → ' + apresScroll + ')');
  ok('le panneau garde sa position après un remplacement (' + avantScroll + ' → ' + apresScroll + ')');

  // ---------- 6. export : identité, réalisateurs, contain — tout rejoué ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(2500);
  const fin = await v.evaluate(() => {
    const w = window;
    const rendu = n => w.getComputedStyle(n).content;
    const A = document.getElementById('realA'), B = document.getElementById('realB');
    const im = [...document.querySelectorAll('#planches img')].find(n => /planche_02/.test(n.alt));
    const pp = [...document.querySelectorAll('img.pp')][0];
    // le lightbox : clic sur la planche remplacée
    im.click();
    const lb = document.getElementById('lb');
    return {
      realA: /url/.test(rendu(A)) ? 'remplacée' : A.getAttribute('src').slice(0, 14),
      realB: (/url\("data:/.test(rendu(B)) || B.getAttribute('src').indexOf('data:image/png') === 0) ? 'DEBORDE' : 'intact',
      plancheSrc: im.getAttribute('src').slice(0, 14),
      plancheVue: /url\("data:image\/png/.test(rendu(im)),
      lbAlt: lb.querySelector('img').alt,
      ppFit: pp.style.objectFit
    };
  });
  if (fin.realA !== 'remplacée' && fin.realA !== 'data:image/png')
    fail('export : la réalisatrice A a perdu sa photo (' + fin.realA + ')');
  if (fin.realB === 'DEBORDE') fail('export : la photo déborde sur le réalisateur B');
  if (fin.plancheSrc === 'data:image/png') fail('export : le src de la planche a été réécrit');
  if (!fin.plancheVue) fail('export : la planche remplacée ne montre pas la nouvelle image');
  if (!/planche_02/.test(fin.lbAlt)) fail('export : le lightbox se trompe de planche (' + fin.lbAlt + ')');
  if (fin.ppFit !== 'contain') fail('export : « Toute l’image » est perdu (' + fin.ppFit + ')');
  ok('export : réalisateurs distincts, identité des planches intacte, lightbox juste, contain rejoué');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
