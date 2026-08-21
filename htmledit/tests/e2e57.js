/* Une maquette de démo NEUTRALISE le clic sur ses cartes-liens (preventDefault
   + stopPropagation sur les liens fictifs). Poser une vraie adresse dessus
   doit quand même ouvrir le lien — en Aperçu et dans l'export. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_neutralise.html');
const OUT = path.resolve(__dirname, 'neutralise_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cartes</title>
<style>body{font-family:sans-serif;padding:30px;background:#eee}
a.carte{display:block;width:240px;padding:18px;background:#fff;border-radius:12px;
  color:#222;text-decoration:none;margin:10px 0}</style></head><body>
<h1>Ressources</h1>
<a class="carte" id="cSync" href="#"><b>REVIEW</b> — Outil de review (Lien fictif.)</a>
<a class="carte" id="cDrive" href="#"><b>DRIVE</b> — Drive du projet (Lien fictif.)</a>
<script>
// comme la vraie maquette : les liens fictifs sont neutralisés
document.querySelectorAll('a.carte').forEach(function (a) {
  a.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
  });
});
<\/script>
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1200, height: 700 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1400);
  const fr = p.frameLocator('#frame');

  // ---------- 1. poser l'adresse via le panneau Liens ----------
  await p.click('#mLink');
  await p.waitForTimeout(700);
  const entree = p.locator('#lnks button').filter({ hasText: /REVIEW/i }).first();
  if (!(await entree.count())) fail('la carte REVIEW n’est pas dans la liste des liens');
  await entree.click();
  await p.waitForTimeout(500);
  if (await p.$eval('#askl', e => e.classList.contains('hidden'))) fail('la fenêtre de lien ne s’ouvre pas');
  await p.fill('#asklUrl', 'https://syncsketch.example.com/projet');
  await p.click('#asklOk');
  await p.waitForTimeout(500);
  const href = await fr.locator('#cSync').getAttribute('href');
  if (href !== 'https://syncsketch.example.com/projet') fail('le href n’est pas posé : ' + href);
  ok('adresse posée sur la carte (href mis à jour)');

  // ---------- 2. Aperçu : le clic ouvre MALGRÉ la neutralisation ----------
  await p.click('#mView');
  await p.waitForTimeout(400);
  const avant = ctx.pages().length;
  await fr.locator('#cSync').click();
  await p.waitForTimeout(1400);
  if (ctx.pages().length <= avant)
    fail('Aperçu : le clic n’ouvre rien — la neutralisation de la maquette gagne encore');
  ok('Aperçu : le clic ouvre le lien malgré le preventDefault de la maquette');
  // hors ligne, l'URL fictive ne résout pas : l'important est que l'onglet
  // se soit ouvert (le clic n'est plus neutralisé)
  await ctx.pages()[ctx.pages().length - 1].close();

  // la carte DRIVE, sans retouche, reste neutralisée (pas de régression)
  const avant2 = ctx.pages().length;
  await fr.locator('#cDrive').click();
  await p.waitForTimeout(900);
  if (ctx.pages().length > avant2) fail('la carte non retouchée ouvre quelque chose maintenant');
  ok('la carte non retouchée reste neutralisée, comme la maquette le veut');

  // ---------- 3. export : pareil ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const ctx2 = await browser.newContext({ viewport: { width: 1200, height: 700 } });
  const v = await ctx2.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1500);
  const avant3 = ctx2.pages().length;
  await v.locator('#cSync').click();
  await v.waitForTimeout(1400);
  if (ctx2.pages().length <= avant3)
    fail('export : le clic n’ouvre rien — c’est le bug signalé');
  ok('export : le clic ouvre le lien posé, malgré la neutralisation de la maquette');
  await ctx2.pages()[ctx2.pages().length - 1].close();
  const avant4 = ctx2.pages().length;
  await v.locator('#cDrive').click();
  await v.waitForTimeout(900);
  if (ctx2.pages().length > avant4) fail('export : la carte non retouchée ouvre quelque chose');
  ok('export : la carte non retouchée reste neutralisée');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
