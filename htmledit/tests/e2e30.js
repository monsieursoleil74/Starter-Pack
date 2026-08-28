/* Images empilées : un clic sur un carrousel doit proposer SES images, et un
   visuel posé sous un dégradé + du texte (« Ton & intentions ») doit être
   atteignable. Testé sur la vraie maquette mise à jour. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = '/root/.claude/uploads/9b61ac52-1242-5681-b4f1-1a84f74cc71a/8f401045-Pack_NDA__Version_demo__horsligne_1.html';
if (!require('fs').existsSync(MAQ)) {
  console.log('SAUTÉ : ce test rejoue un vrai pack déposé dans la session, qui n’est pas versionné.');
  process.exit(0);
}

const PNG = path.resolve(__dirname, 'remplacement.png');
const OUT = path.resolve(__dirname, 'maq3_modifiee.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1500, height: 900 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(7000);
  const fr = p.frameLocator('#frame');
  await p.click('#mImg');
  await p.waitForTimeout(1200);

  // ---------- 1. le carrousel « Planches » : cliquer dessus propose SES images ----------
  const pl = fr.locator('img[alt="Planche proto I"]');
  if (!(await pl.count())) fail('carrousel planches introuvable dans la maquette');
  await pl.scrollIntoViewIfNeeded();
  await p.waitForTimeout(500);
  await pl.click({ force: true });
  await p.waitForTimeout(600);
  if (await p.$eval('#askg', e => e.classList.contains('hidden')))
    fail('cliquer le carrousel n’ouvre pas le choix des images');
  const noms = await p.$$eval('#askgGrid .gi .nm', ns => ns.map(n => n.textContent.trim()));
  if (!noms.some(n => /Planche proto I$/.test(n)) || !noms.some(n => /Planche proto II$/.test(n)))
    fail('le choix ne montre pas les deux planches : ' + JSON.stringify(noms));
  ok('carrousel : les ' + noms.length + ' images du bloc sont proposées → ' + JSON.stringify(noms));

  // l'état « affichée / pas affichée » aide à savoir laquelle on remplace
  const sous = await p.$$eval('#askgGrid .gi .su', ns => ns.map(n => n.textContent.trim()));
  if (!sous.some(s => /pas affichée/.test(s))) fail('aucune image signalée comme masquée : ' + JSON.stringify(sous));
  ok('l’outil dit laquelle est affichée et laquelle ne l’est pas');

  // ---------- 2. remplacer la DEUXIÈME (celle qu'un clic n'atteint jamais) ----------
  const i2 = noms.findIndex(n => /Planche proto II$/.test(n));
  const srcAvant = await fr.locator('img[alt="Planche proto II"]').getAttribute('src');
  await p.locator('#askgGrid .gi').nth(i2).click();
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', PNG);
  await p.waitForTimeout(900);
  const vueApres = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const n = [...d.querySelectorAll('img[alt="Planche proto II"]')].find(x => !x.closest('#rg-assetmap'));
    return { src: n.getAttribute('src'), c: d.defaultView.getComputedStyle(n).content };
  });
  if (vueApres.src !== srcAvant && vueApres.src.indexOf('data:image/png') !== 0)
    fail('src inattendu : ' + vueApres.src.slice(0, 30));
  if (vueApres.src.indexOf('data:image/png') !== 0 && vueApres.c.indexOf('data:image/png') < 0)
    fail('la 2e planche n’a pas changé : ' + JSON.stringify({ src: vueApres.src.slice(0, 24), c: vueApres.c.slice(0, 24) }));
  ok('la 2e image du carrousel — invisible au clic — est bien remplacée');

  // le panneau reste ouvert pour enchaîner, et marque ce qui est fait
  if (await p.$eval('#askg', e => e.classList.contains('hidden')))
    fail('le panneau s’est fermé : impossible d’enchaîner les images du carrousel');
  const faits = await p.$$eval('#askgGrid .gi.done .nm', ns => ns.map(n => n.textContent.trim()));
  if (!faits.length) fail('la retouche n’est pas marquée dans le panneau');
  ok('panneau toujours ouvert, image marquée ✓ (' + faits[0] + ')');

  // et la VIGNETTE de la tuile montre le nouveau visuel, pas l'ancien
  const vig = await p.$$eval('#askgGrid .gi.done .box', ns =>
    ns.map(n => (n.style.backgroundImage || '').slice(0, 30)));
  if (!vig.some(v => v.indexOf('data:image/png') >= 0))
    fail('la vignette du choix montre encore l’ancien visuel : ' + JSON.stringify(vig));
  ok('la vignette de la tuile remplacée montre le NOUVEAU visuel');

  // enchaîner sur la première sans re-viser
  const i1 = noms.findIndex(n => /Planche proto I$/.test(n));
  await p.locator('#askgGrid .gi').nth(i1).click();
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', PNG);
  await p.waitForTimeout(900);
  const v1 = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const n = [...d.querySelectorAll('img[alt="Planche proto I"]')].find(x => !x.closest('#rg-assetmap'));
    return n.getAttribute('src').indexOf('data:image/png') === 0 ||
           d.defaultView.getComputedStyle(n).content.indexOf('data:image/png') >= 0;
  });
  if (!v1) fail('1re planche non remplacée');
  ok('les deux images du carrousel remplacées d’affilée, sans re-viser');
  await p.click('#askgNo');
  await p.waitForTimeout(300);

  // ---------- 3. « Ton & intentions » : le visuel est sous un dégradé et du texte ----------
  const bloc = fr.getByText('Ton & intentions', { exact: true }).first();
  if (!(await bloc.count())) fail('bloc « Ton & intentions » introuvable');
  await bloc.scrollIntoViewIfNeeded();
  await p.waitForTimeout(500);
  await bloc.hover();
  await p.waitForTimeout(400);
  const astuce = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const t = d.getElementById('pk-tip');
    return t ? t.textContent : '';
  });
  if (!/image/i.test(astuce)) fail('rien n’est signalé au survol du bloc : « ' + astuce + ' »');
  ok('au survol, l’outil annonce : « ' + astuce + ' »');
  await bloc.click({ force: true });
  await p.waitForTimeout(600);
  const ouvert = {
    choix: !(await p.$eval('#askg', e => e.classList.contains('hidden'))),
    zone: !(await p.$eval('#ask', e => e.classList.contains('hidden')))
  };
  if (ouvert.zone && !ouvert.choix)
    fail('le visuel de fond n’est pas vu : l’outil propose seulement de POSER une image');
  // soit le choix s'ouvre (plusieurs images), soit le sélecteur de fichier s'est ouvert direct
  if (ouvert.choix) {
    const n2 = await p.$$eval('#askgGrid .gi .nm', ns => ns.map(n => n.textContent.trim()));
    ok('« Ton & intentions » : images atteignables → ' + JSON.stringify(n2));
    await p.locator('#askgGrid .gi').first().click();
  }
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', PNG);
  await p.waitForTimeout(900);
  const posee = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    return [...d.querySelectorAll('img')].filter(n =>
      n.getAttribute('src').indexOf('data:image/png') === 0 ||
      d.defaultView.getComputedStyle(n).content.indexOf('data:image/png') >= 0).length;
  });
  if (posee < 3) fail('le visuel de « Ton & intentions » n’a pas été remplacé (' + posee + ' images posées)');
  ok('le visuel de fond de « Ton & intentions » se remplace d’un clic');
  if (!(await p.$eval('#askg', e => e.classList.contains('hidden')))) await p.click('#askgNo');

  // ---------- 4. la galerie de droite est groupée par carrousel ----------
  const heads = await p.$$eval('#gal .hd', ns => ns.map(n => n.title || n.textContent.trim()));
  if (!heads.length) fail('la galerie n’est plus groupée');
  if (!heads.some(h => /au même endroit/.test(h))) fail('aucun groupe de superposées : ' + JSON.stringify(heads));
  ok('galerie groupée : ' + JSON.stringify(heads.slice(0, 4)));

  // ---------- 5. export : tout est rejoué ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(8000);
  const fin = await v.evaluate(() => {
    const vue = a => {
      const n = [...document.querySelectorAll('img[alt="' + a + '"]')].find(x => !x.closest('#rg-assetmap'));
      if (!n) return null;
      return n.getAttribute('src').indexOf('data:image/png') === 0 ||
             getComputedStyle(n).content.indexOf('data:image/png') >= 0;
    };
    return { p1: vue('Planche proto I'), p2: vue('Planche proto II'),
             png: [...document.querySelectorAll('img')].filter(n =>
               n.getAttribute('src').indexOf('data:image/png') === 0 ||
               getComputedStyle(n).content.indexOf('data:image/png') >= 0).length };
  });
  if (!fin.p1) fail('export : planche I non rejouée');
  if (!fin.p2) fail('export : planche II non rejouée');
  if (fin.png < 3) fail('export : ' + fin.png + ' images rejouées seulement');
  ok('fichier exporté : les ' + fin.png + ' remplacements sont rejoués');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
