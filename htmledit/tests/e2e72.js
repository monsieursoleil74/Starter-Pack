/* Une zone de fiche contient PLUSIEURS champs (étiquette + valeur + arc…).
   Cliquer sur le fond de la zone la prenait ENTIÈRE en édition : à la
   validation elle s'aplatissait, et la maquette repeignait ses exemples
   par-dessus — toute la zone perdue. Une zone à plusieurs champs ne doit
   jamais s'éditer d'un bloc : le clic vise le champ le plus proche.
   Usage : node e2e72.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_zone.html');
const OUT = path.resolve(__dirname, 'zone_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

// la zone : des SPANS stylés en bloc (comme les maquettes générées), et un
// framework qui repeint ses exemples si la structure des champs disparaît
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Zone</title>
<style>body{font-family:sans-serif;padding:30px;background:#eee}
.zone{max-width:420px;background:#fff;border-radius:12px;padding:22px}
.etq{display:block;font-size:11px;text-transform:uppercase;color:#888;margin-top:12px}
.val{display:block;font-size:15px}</style></head><body>
<h1>Fiche</h1>
<div class="zone" id="zone">
  <span class="etq">Arc</span>
  <span class="val sc-interp" id="arc">L'arc du personnage, exemple fictif.</span>
  <span class="etq">Espèce</span>
  <span class="val sc-interp" id="espece">Espèce fictive · exemple</span>
</div>
<script>
// comme la vraie maquette : si ses champs disparaissent, elle reconstruit la
// zone avec ses EXEMPLES
var modele = { arc: "L'arc du personnage, exemple fictif.", espece: 'Espèce fictive · exemple' };
setInterval(function () {
  if (!document.getElementById('arc') || !document.getElementById('espece')) {
    document.getElementById('zone').innerHTML =
      '<span class="etq">Arc</span><span class="val sc-interp" id="arc">' + modele.arc +
      '</span><span class="etq">Espèce</span><span class="val sc-interp" id="espece">' + modele.espece + '</span>';
  }
}, 300);
<\/script>
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

  // ---------- 1. clic sur le FOND de la zone : jamais la zone entière ----------
  await p.click('#mText');
  await p.waitForTimeout(300);
  const b = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const rZ = d.getElementById('zone').getBoundingClientRect();
    const rA = d.getElementById('arc').getBoundingClientRect();
    const f = document.getElementById('frame').getBoundingClientRect();
    // à droite du champ arc, sur le fond de la zone
    return { x: f.left + rA.right + Math.min(30, (rZ.right - rA.right) / 2),
             y: f.top + rA.top + rA.height / 2 };
  });
  await p.mouse.click(b.x, b.y);
  await p.waitForTimeout(500);
  const surQuoi = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const e = d.querySelector('[contenteditable="true"]');
    return e ? { id: e.id || e.className, nChamps: e.querySelectorAll('span').length } : null;
  });
  if (surQuoi && surQuoi.nChamps >= 2)
    fail('la ZONE ENTIÈRE est passée en édition (' + JSON.stringify(surQuoi) + ') — le bug signalé');
  if (!surQuoi || surQuoi.id !== 'arc')
    fail('le clic sur le fond ne vise pas le champ le plus proche : ' + JSON.stringify(surQuoi));
  ok('clic sur le fond de la zone : seul le champ le plus proche s’édite');

  // ---------- 2. éditer, valider : les autres champs restent intacts ----------
  await p.keyboard.press('ControlOrMeta+a');
  await p.keyboard.type('Un arc écrit par moi.');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(1200);
  const etat = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    return { arc: d.getElementById('arc') && d.getElementById('arc').textContent.trim(),
      espece: d.getElementById('espece') && d.getElementById('espece').textContent.trim(),
      etqs: [...d.querySelectorAll('#zone .etq')].map(x => x.textContent.trim()) };
  });
  if (etat.arc !== 'Un arc écrit par moi.')
    fail('l’arc édité est perdu (la maquette a repeint ses exemples) : ' + JSON.stringify(etat));
  if (etat.espece !== 'Espèce fictive · exemple' || etat.etqs.join() !== 'Arc,Espèce')
    fail('les autres champs de la zone ont été chamboulés : ' + JSON.stringify(etat));
  ok('champ édité retenu, étiquettes et autres champs intacts');

  // ---------- 3. export ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1500);
  const fin = await v.evaluate(() => ({
    arc: document.getElementById('arc') && document.getElementById('arc').textContent.trim(),
    espece: document.getElementById('espece') && document.getElementById('espece').textContent.trim() }));
  if (fin.arc !== 'Un arc écrit par moi.' || fin.espece !== 'Espèce fictive · exemple')
    fail('export : ' + JSON.stringify(fin));
  ok('export : le champ édité est rejoué, le reste de la zone est d’origine');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
