/* La barre de recadrage porte un bouton « Supprimer » : l'emplacement revient
   au visuel du PROTO de la maquette, sans passer par la liste des retouches.
   - sur une vraie retouche (image remplacée) : la retouche est annulée, la
     page d'origine revient, la liste se vide, l'export n'en garde rien ;
   - sur une image jamais remplacée (cadrage provisoire) : le cadrage d'essai
     est jeté, l'image reste rigoureusement intacte, aucune retouche ne naît.
   Usage : node e2e90.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_suppr.html');
const A = path.resolve(__dirname, 'e2e90_a.png');
const OUT = path.resolve(__dirname, 'suppr_export.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Personnage</title>
<style>body{font-family:sans-serif;background:#1d241d;color:#dfe7df;padding:24px;margin:0}
.carte{width:210px;border:3px solid #b9a2a2;border-radius:20px;padding:12px;text-align:center;
  background:#2a332a;display:inline-block;vertical-align:top;margin-right:16px}
.slot{width:180px;height:180px;border-radius:14px;background:#232c23;display:flex;
  align-items:center;justify-content:center;overflow:hidden;font-size:11px;opacity:.6}
.cadre{width:180px;height:180px;border-radius:14px;overflow:hidden;background:#232c23}
.cadre img{width:180px;height:180px;object-fit:cover;display:block}
</style></head><body>
<h1>Tito</h1>
<div class="carte"><div class="slot" data-k="assets_nda/personnages/tito/tito_portrait.png">PORTRAIT</div><b>Emplacement</b></div>
<div class="carte"><div class="cadre"><img id="deja" src="e2e90_a.png" alt="Décor Tito"></div><b>Image du proto</b></div>
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1300, height: 850 } });
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
  await p.waitForTimeout(1300);
  await p.click('#mImg');
  await p.waitForTimeout(400);

  const viser = (sel) => p.evaluate((s) => {
    const d = document.getElementById('frame').contentDocument;
    const n = d.querySelector(s);
    n.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = n.getBoundingClientRect();
    const f = document.getElementById('frame').getBoundingClientRect();
    return { x: f.left + r.left + r.width / 2, y: f.top + r.top + r.height / 2 };
  }, sel);
  const ouv = async (id) => p.$eval('#' + id, (e) => !e.classList.contains('hidden'));
  const nb = () => p.$$eval('#list .it', (l) => l.length);
  const slot = () => p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const s = d.querySelector('.slot');
    return { fond: /^url\(/.test(d.defaultView.getComputedStyle(s).backgroundImage || ''),
             texte: (s.textContent || '').trim() };
  });

  // ---------- 1. poser un visuel, le cadrer, puis SUPPRIMER ----------
  let c = await viser('.slot');
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(700);
  const [ch] = await Promise.all([p.waitForEvent('filechooser'), p.click('#askCover')]);
  await ch.setFiles(A);
  await p.waitForTimeout(1800);
  if (!(await slot()).fond) fail('le visuel n’est pas posé');
  if ((await nb()) !== 1) fail('pas de retouche après la pose');
  if (!(await ouv('crop'))) {                    // le cadrage s'ouvre tout seul (débordement)
    c = await viser('.slot');
    await p.mouse.click(c.x, c.y);
    await p.waitForTimeout(700);
  }
  if (!(await ouv('crop'))) fail('le cadrage ne s’ouvre pas sur l’emplacement rempli');
  if (!(await p.$('#cropSup'))) fail('pas de bouton « Supprimer » dans la barre de recadrage');
  await p.click('#cropSup');
  await p.waitForTimeout(2500);                  // la page d'origine se recharge
  const s1 = await slot();
  if (s1.fond) fail('après « Supprimer », le visuel posé est toujours là');
  if (!/PORTRAIT/.test(s1.texte)) fail('l’emplacement n’a pas retrouvé son gabarit du proto : ' + s1.texte);
  if ((await nb()) !== 0) fail('la retouche est encore dans la liste (' + (await nb()) + ')');
  if (await ouv('crop')) fail('la barre de recadrage est restée ouverte');
  ok('« Supprimer » : l’emplacement revient au gabarit du proto, la liste se vide');

  // ---------- 2. l'export n'en garde rien ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const dd = JSON.parse(fs.readFileSync(OUT, 'utf8')
    .match(/<script id="pack-edit-data"[^>]*>([\s\S]*?)<\/script>/)[1].replace(/<\\\//g, '</') || '[]');
  if (dd.some((x) => x.kind === 'img' || x.kind === 'bg'))
    fail('l’export garde encore une retouche d’image supprimée');
  ok('l’export ne porte plus la retouche supprimée');

  // ---------- 3. image du proto jamais remplacée : rien ne naît ----------
  await p.waitForTimeout(800);
  const avant = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    return d.getElementById('deja').getAttribute('style') || '(aucun)';
  });
  c = await viser('#deja');
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(700);
  if (!(await ouv('crop'))) fail('le clic sur l’image du proto n’ouvre pas le cadrage d’essai');
  // on déplace un peu — puis on se ravise : « Supprimer »
  await p.mouse.move(c.x, c.y);
  await p.mouse.down();
  await p.mouse.move(c.x - 30, c.y, { steps: 8 });
  await p.mouse.up();
  await p.waitForTimeout(400);
  await p.click('#cropSup');
  await p.waitForTimeout(800);
  const apres = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    return d.getElementById('deja').getAttribute('style') || '(aucun)';
  });
  if ((await nb()) !== 0) fail('le cadrage d’essai jeté a quand même créé une retouche');
  if (apres !== avant)
    fail('l’image du proto n’est pas revenue exactement comme avant : ' + JSON.stringify(apres));
  if (await ouv('crop')) fail('la barre de recadrage est restée ouverte (cas provisoire)');
  ok('sur une image du proto, « Supprimer » jette le cadrage d’essai sans rien créer');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
