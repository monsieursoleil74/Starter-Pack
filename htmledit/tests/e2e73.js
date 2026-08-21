/* Un texte affiché en MAJUSCULES par text-transform (bandeaux, étiquettes) :
   innerText rend l'affichage, pas la source — le « avant » mémorisé ne
   correspondait plus jamais à l'original, et la retouche ne se rejouait pas
   à la réouverture. Le « avant » vient maintenant de la source, et toutes
   les gardes sont insensibles à la casse — ce qui guérit aussi les
   fichiers retouchés avec les anciennes versions.
   Usage : node e2e73.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_majuscules.html');
const OUT = path.resolve(__dirname, 'majuscules_modifie.html');
const OUT2 = path.resolve(__dirname, 'majuscules_ancien.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Majuscules</title>
<style>.kicker{display:inline-block;font-size:12px;font-weight:600;letter-spacing:.18em;
  text-transform:uppercase;color:#C13B31}</style></head><body style="font-family:sans-serif;padding:30px">
<div class="kicker" id="kicker">Un film Studio Démo · Préproduction</div>
<p id="pitch" style="max-width:600px;font-size:19px">Le kit de bienvenue des animateurs, version fictive.</p>
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1200, height: 700 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1200);
  const fr = p.frameLocator('#frame');

  // ---------- 1. éditer le bandeau en majuscules ----------
  await p.click('#mText');
  await p.waitForTimeout(300);
  await fr.locator('#kicker').click();
  await p.waitForTimeout(400);
  await p.keyboard.press('ControlOrMeta+a');
  await p.keyboard.type('Un film Mon Studio · Prod');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(700);
  ok('bandeau en majuscules d’affichage édité');

  // ---------- 2. export : le « avant » est en casse SOURCE, et se rejoue ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const brut = fs.readFileSync(OUT, 'utf8');
  const donnees = JSON.parse(brut.match(/<script id="pack-edit-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
  const pk = donnees.find(x => /mon studio/i.test(x.after || ''));
  if (!pk) fail('patch introuvable dans l’export');
  if (pk.before !== 'Un film Studio Démo · Préproduction')
    fail('le « avant » n’est pas la casse source : ' + JSON.stringify(pk.before));
  ok('le « avant » mémorisé est le texte source, pas l’affichage en majuscules');
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1500);
  const exp = await v.locator('#kicker').textContent();
  if (!/mon studio/i.test(exp)) fail('export rouvert : le bandeau est réinitialisé (' + exp.trim() + ')');
  ok('export rouvert : la retouche du bandeau se rejoue');
  await v.close();

  // ---------- 3. un ANCIEN fichier (« avant » en majuscules) guérit ----------
  const ancien = brut.replace('"Un film Studio Démo · Préproduction"',
    '"UN FILM STUDIO DÉMO · PRÉPRODUCTION"');
  if (ancien === brut) fail('simulation ancien fichier impossible');
  fs.writeFileSync(OUT2, ancien);
  const v2 = await ctx.newPage();
  v2.on('pageerror', e => errs.push('[ancien] ' + e.message));
  await v2.goto('file://' + OUT2);
  await v2.waitForTimeout(1500);
  const anc = await v2.locator('#kicker').textContent();
  if (!/mon studio/i.test(anc))
    fail('un fichier des anciennes versions ne guérit pas : ' + anc.trim());
  ok('un fichier retouché avec les ANCIENNES versions se rejoue aussi (casse ignorée)');
  await v2.close();

  // ---------- 4. redépôt : la retouche est retrouvée et tenue ----------
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', OUT2);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1500);
  const red = await fr.locator('#kicker').textContent();
  if (!/mon studio/i.test(red)) fail('redépôt : ' + red.trim());
  ok('redépôt d’un ancien fichier : la retouche est retrouvée et appliquée');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
