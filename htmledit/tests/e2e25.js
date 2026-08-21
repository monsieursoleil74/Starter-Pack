/* Poser une image là où il n'y en a pas : pastille de personnage (une lettre
   sur un fond CSS) et bloc décoratif. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_pastilles.html');
const IMG = path.resolve(__dirname, 'rempl1.png');
const OUT = path.resolve(__dirname, 'pastilles_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

// pastilles « P B N T » : aucune image dedans, juste une lettre sur un dégradé
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Persos</title>
<style>body{font-family:sans-serif;padding:24px;background:#1e2a1e}
.row{display:flex;gap:12px}
.pill{width:96px;height:96px;border-radius:14px;background:linear-gradient(#e9a,#c66);
      display:flex;align-items:center;justify-content:center;position:relative}
.pill .l{font-size:38px;font-weight:800;color:#a22}
.pill .nm{position:absolute;bottom:4px;font-size:11px;color:#fff}
.hero{width:420px;height:150px;background:#354;margin-top:20px}</style></head><body>
<div class="row">
  <div class="pill" id="p1"><span class="l">P</span><span class="nm">Pipo</span></div>
  <div class="pill" id="p2"><span class="l">B</span><span class="nm">Bruno</span></div>
</div>
<div class="hero" id="hero"></div>
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 850 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1200);
  const fr = p.frameLocator('#frame');
  await p.click('#mImg');
  await p.waitForTimeout(500);

  // ---------- 1. survol : la pastille est signalée comme « zone » ----------
  await fr.locator('#p1 .l').hover();
  await p.waitForTimeout(400);
  const hi = await fr.locator('#p1').getAttribute('class');
  if (!/pk-hi-zone/.test(hi)) fail('la pastille n’est pas signalée comme zone (' + hi + ')');
  ok('survol d’une lettre : c’est la pastille entière qui est visée');

  // ---------- 2. clic : on propose de poser une image ----------
  await fr.locator('#p1 .l').click();
  await p.waitForTimeout(400);
  if (await p.$eval('#ask', e => e.classList.contains('hidden'))) fail('pas de proposition');
  const quoi = await p.$eval('#askWhat', e => e.textContent);
  if (!/96×96/.test(quoi)) fail('zone mal décrite : ' + quoi);
  ok('proposition affichée avec la zone visée (' + quoi.trim() + ')');

  // « à la place du contenu » : la lettre disparaît sous l'image
  await p.click('#askCover');
  await p.waitForTimeout(300);
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', IMG);
  await p.waitForTimeout(700);
  const st = await fr.locator('#p1').evaluate(n => ({
    bg: n.style.backgroundImage.slice(0, 22), size: n.style.backgroundSize,
    hide: n.hasAttribute('data-pk-hide'),
    lettreVisible: getComputedStyle(n.querySelector('.l')).visibility
  }));
  if (st.bg.indexOf('url("data:image') !== 0) fail('pas d’image posée : ' + st.bg);
  if (st.size !== 'cover') fail('cadrage : ' + st.size);
  if (!st.hide || st.lettreVisible !== 'hidden') fail('la lettre reste visible : ' + JSON.stringify(st));
  ok('image posée à la place du contenu : la lettre est masquée');

  // ---------- 3. « en fond » garde le contenu ----------
  await fr.locator('#p2 .l').click();
  await p.waitForTimeout(400);
  await p.click('#askBg');
  await p.waitForTimeout(300);
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', IMG);
  await p.waitForTimeout(700);
  const st2 = await fr.locator('#p2').evaluate(n => ({
    bg: n.style.backgroundImage.slice(0, 15), hide: n.hasAttribute('data-pk-hide'),
    lettreVisible: getComputedStyle(n.querySelector('.l')).visibility
  }));
  if (st2.bg.indexOf('url("data:') !== 0) fail('pas d’image en fond');
  if (st2.hide || st2.lettreVisible !== 'visible') fail('le contenu a été masqué à tort');
  ok('image en fond : la lettre reste visible par-dessus');

  // ---------- 4. un bloc vide accepte aussi une image ----------
  await fr.locator('#hero').click();
  await p.waitForTimeout(400);
  await p.click('#askCover');
  await p.waitForTimeout(300);
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', IMG);
  await p.waitForTimeout(700);
  if (!(await fr.locator('#hero').evaluate(n => n.style.backgroundImage.length > 20)))
    fail('le bloc décoratif n’a pas reçu d’image');
  ok('un bloc sans image en accepte une');

  // ---------- 5. l'export rejoue tout ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1300);
  const fin = await v.evaluate(() => ({
    p1: document.getElementById('p1').style.backgroundImage.length > 20,
    p1hide: getComputedStyle(document.querySelector('#p1 .l')).visibility,
    p2hide: getComputedStyle(document.querySelector('#p2 .l')).visibility,
    hero: document.getElementById('hero').style.backgroundImage.length > 20
  }));
  if (!fin.p1 || !fin.hero) fail('export : images non rejouées ' + JSON.stringify(fin));
  if (fin.p1hide !== 'hidden') fail('export : la lettre masquée réapparaît');
  if (fin.p2hide !== 'visible') fail('export : une lettre a été masquée à tort');
  ok('fichier exporté : images posées et masquage respecté');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
