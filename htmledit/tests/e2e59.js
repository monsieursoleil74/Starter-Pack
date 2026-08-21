/* Certaines cartes (« Serveur de production »…) copient un chemin CODÉ EN DUR
   qui n'est affiché nulle part — rien à retoucher en mode Textes. Le mode
   Liens doit montrer ce chemin (champ dédié, pré-rempli depuis l'infobulle),
   le laisser changer sans poser d'adresse, et le bouton doit copier le
   nouveau — en Aperçu et dans l'export. La carte non retouchée garde l'usine. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_copiecache.html');
const OUT = path.resolve(__dirname, 'copiecache_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pipeline</title>
<style>body{font-family:sans-serif;padding:30px;background:#eee}
a.carte{display:block;max-width:520px;padding:18px;background:#fff;border-radius:12px;
  color:#222;text-decoration:none;margin:10px 0}</style></head><body>
<h1>Pipeline</h1>
<a class="carte" id="cSrv" href="#"><b>Serveur de production</b><br>
  Le chemin réseau du studio. (Chemin fictif.)<br>
  <button id="cpSrv" title="X:\\DEMO\\PROD\\SEQUENCES">Copier le chemin</button></a>
<a class="carte" id="cRef" href="#"><b>Références anim</b><br>
  Dossier serveur dédié. (Lien fictif.)<br>
  <button id="cpRef" title="X:\\DEMO\\REF\\ANIM">Copier le chemin</button></a>
<script>
// comme la vraie maquette : cartes neutralisées, chemins copiés codés en dur
document.querySelectorAll('a.carte').forEach(function (a) {
  a.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); });
});
document.getElementById('cpSrv').addEventListener('click', function (e) {
  e.preventDefault(); e.stopPropagation();
  navigator.clipboard && navigator.clipboard.writeText('X:\\\\DEMO\\\\PROD\\\\SEQUENCES');
});
document.getElementById('cpRef').addEventListener('click', function (e) {
  e.preventDefault(); e.stopPropagation();
  navigator.clipboard && navigator.clipboard.writeText('X:\\\\DEMO\\\\REF\\\\ANIM');
});
<\/script>
</body></html>`);

const NOUVEAU = 'Y:\\STUDIO\\PROD\\SEQUENCES';

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1200, height: 700 },
    permissions: ['clipboard-read', 'clipboard-write'] });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/permissions policy/i.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1400);
  const fr = p.frameLocator('#frame');

  const lireClip = async (page) => page.evaluate(async () => {
    window.focus();
    try { return await navigator.clipboard.readText(); } catch (e) { return 'ERR ' + e.message; }
  });

  // ---------- 1. mode Liens : le chemin caché apparaît, pré-rempli ----------
  await p.click('#mLink');
  await p.waitForTimeout(700);
  const entree = p.locator('#lnks button').filter({ hasText: /Serveur de production/i }).first();
  if (!(await entree.count())) fail('la carte n’est pas dans la liste des liens');
  await entree.click();
  await p.waitForTimeout(500);
  if (await p.$eval('#asklCpLab', e => e.classList.contains('hidden')))
    fail('le champ « chemin copié » reste caché');
  const usine = await p.inputValue('#asklCp');
  if (usine !== 'X:\\DEMO\\PROD\\SEQUENCES')
    fail('le chemin d’usine n’est pas pré-rempli : ' + JSON.stringify(usine));
  ok('le champ montre le chemin d’usine, jamais affiché dans la page');

  // ---------- 2. changer le chemin SANS poser d'adresse ----------
  await p.fill('#asklCp', NOUVEAU);
  await p.click('#asklOk');
  await p.waitForTimeout(500);
  if (!(await p.$$eval('#list .it', l => l.length))) fail('aucune retouche enregistrée');
  const href = await fr.locator('#cSrv').getAttribute('href');
  if (href !== '#') fail('le href a été touché alors qu’aucune adresse n’était posée : ' + href);
  ok('retouche enregistrée, le href de la carte n’a pas bougé');

  // ---------- 3. Aperçu : le bouton copie le NOUVEAU chemin ----------
  await p.click('#mView');
  await p.waitForTimeout(400);
  await fr.locator('#cpSrv').click();
  await p.waitForTimeout(400);
  const c1 = await lireClip(p);
  if (c1 !== NOUVEAU) fail('Aperçu : copié = ' + JSON.stringify(c1));
  ok('Aperçu : le bouton copie le nouveau chemin');

  // rouvrir la fenêtre : elle montre maintenant NOTRE chemin
  await p.click('#mLink');
  await p.waitForTimeout(500);
  await p.locator('#lnks button').filter({ hasText: /Serveur de production/i }).first().click();
  await p.waitForTimeout(400);
  if ((await p.inputValue('#asklCp')) !== NOUVEAU)
    fail('rouvert, le champ ne montre pas le chemin retouché');
  await p.click('#asklNo');
  ok('rouvrir la fenêtre montre le chemin retouché');

  // ---------- 4. export ----------
  await p.click('#mView');
  await p.waitForTimeout(300);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const ctx2 = await browser.newContext({ viewport: { width: 1200, height: 700 },
    permissions: ['clipboard-read', 'clipboard-write'] });
  const v = await ctx2.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1500);
  await v.locator('#cpSrv').click();
  await v.waitForTimeout(400);
  const e1 = await lireClip(v);
  if (e1 !== NOUVEAU) fail('export : copié = ' + JSON.stringify(e1));
  ok('export : le bouton copie le nouveau chemin');
  const fb = (await v.locator('[data-pk-bulle]').count()) ? 'bulle' :
    (/Copié/.test(await v.locator('#cpSrv').textContent()) ? 'bouton' : '');
  if (!fb) fail('pas de retour visuel après la copie');
  ok('retour visuel après la copie (' + fb + ')');
  const t1 = await v.locator('#cpSrv').getAttribute('title');
  if (t1 !== NOUVEAU) fail('l’infobulle du bouton n’est pas mise à jour : ' + t1);
  ok('l’infobulle du bouton montre le nouveau chemin');
  await v.locator('#cpRef').click();
  await v.waitForTimeout(400);
  const e2 = await lireClip(v);
  if (e2 !== 'X:\\DEMO\\REF\\ANIM')
    fail('export : la carte non retouchée copie : ' + JSON.stringify(e2));
  ok('export : la carte non retouchée garde son chemin d’usine');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
