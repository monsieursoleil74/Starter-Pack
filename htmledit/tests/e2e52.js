/* L'édition de texte, comme dans un vrai éditeur : le curseur se pose au
   clic, on sélectionne à la souris, on supprime juste un mot, on colle au
   curseur — plus jamais de « tout est sélectionné d'office ». */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_curseur.html');
const OUT = path.resolve(__dirname, 'curseur_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Curseur</title>
<style>body{font-family:monospace;font-size:20px;padding:40px;background:#eee}</style>
</head><body>
<h1 id="titre">Le grand titre</h1>
<p id="txt">Un chat gris dort sur le canapé rouge.</p>
</body></html>`);

// position écran (dans la fenêtre du parent) d'un mot du paragraphe
const posDuMot = (p, mot) => p.evaluate(mot => {
  const d = document.getElementById('frame').contentDocument;
  const n = d.getElementById('txt');
  const t = n.firstChild;
  const i = t.nodeValue.indexOf(mot);
  const rg = d.createRange();
  rg.setStart(t, i); rg.setEnd(t, i + mot.length);
  const r = rg.getBoundingClientRect();
  const f = document.getElementById('frame').getBoundingClientRect();
  return { x: f.left + r.left + r.width / 2, y: f.top + r.top + r.height / 2 };
}, mot);

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
  await p.waitForTimeout(1200);
  const fr = p.frameLocator('#frame');
  const texte = () => fr.locator('#txt').textContent();

  // ---------- 1. le clic pose le curseur, sans tout sélectionner ----------
  const surGris = await posDuMot(p, 'gris');
  await p.mouse.click(surGris.x, surGris.y);
  await p.waitForTimeout(400);
  const sel1 = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const s = d.defaultView.getSelection();
    const n = d.getElementById('txt');
    return { editable: n.getAttribute('contenteditable') === 'true',
             vide: s.isCollapsed, dedans: n.contains(s.anchorNode),
             offset: s.anchorOffset };
  });
  if (!sel1.editable) fail('le clic n’ouvre pas l’édition');
  if (!sel1.vide) fail('le texte entier est sélectionné au clic — corriger un mot est impossible');
  if (!sel1.dedans) fail('le curseur n’est pas dans le texte');
  const iGris = 'Un chat gris dort sur le canapé rouge.'.indexOf('gris');
  if (Math.abs(sel1.offset - (iGris + 2)) > 3)
    fail('le curseur ne s’est pas posé au niveau du clic (offset ' + sel1.offset + ', attendu ≈ ' + (iGris + 2) + ')');
  ok('le curseur se pose là où on clique (offset ' + sel1.offset + '), rien n’est sélectionné');

  // taper insère AU curseur, sans rien effacer
  await p.keyboard.type('X');
  await p.waitForTimeout(200);
  const t1 = await texte();
  if (t1 === 'X') fail('la frappe a remplacé tout le texte !');
  if (t1.indexOf('gr') < 0 || t1.indexOf('X') < 0 || t1.length !== 39)
    fail('la frappe ne s’est pas insérée au curseur : « ' + t1 + ' »');
  ok('la frappe s’insère au curseur : « ' + t1.slice(0, 24) + '… »');
  await p.keyboard.press('Backspace');
  await p.waitForTimeout(200);

  // ---------- 2. re-cliquer AILLEURS dans le texte déplace le curseur ----------
  const surRouge = await posDuMot(p, 'rouge');
  await p.mouse.click(surRouge.x, surRouge.y);
  await p.waitForTimeout(300);
  const sel2 = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const s = d.defaultView.getSelection();
    return { vide: s.isCollapsed, offset: s.anchorOffset };
  });
  const iRouge = 'Un chat gris dort sur le canapé rouge.'.indexOf('rouge');
  if (!sel2.vide) fail('re-cliquer a resélectionné tout le texte');
  if (Math.abs(sel2.offset - (iRouge + 2)) > 3)
    fail('le curseur n’a pas suivi le second clic (offset ' + sel2.offset + ')');
  ok('re-cliquer déplace le curseur sans resélectionner (offset ' + sel2.offset + ')');

  // ---------- 3. double-clic = un mot ; Suppr n'efface QUE lui ----------
  await p.mouse.dblclick(surGris.x, surGris.y);
  await p.waitForTimeout(300);
  const selMot = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    return d.defaultView.getSelection().toString();
  });
  if (selMot.trim() !== 'gris') fail('le double-clic ne sélectionne pas le mot : « ' + selMot + ' »');
  await p.keyboard.press('Delete');
  await p.waitForTimeout(200);
  const t2 = await texte();
  if (!/Un chat\s+dort sur le canapé rouge\./.test(t2))
    fail('Suppr n’a pas effacé que le mot : « ' + t2 + ' »');
  ok('double-clic sélectionne un mot, Suppr n’efface que lui : « ' + t2.slice(0, 26) + '… »');

  // ---------- 4. coller s'insère au curseur ----------
  await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const n = d.getElementById('txt');
    const dt = new DataTransfer();
    dt.setData('text/plain', 'noir ');
    n.dispatchEvent(new d.defaultView.ClipboardEvent('paste',
      { bubbles: true, cancelable: true, clipboardData: dt }));
  });
  await p.waitForTimeout(300);
  const t3 = await texte();
  if (t3 === 'noir ') fail('le collé a remplacé tout le texte !');
  if (t3.indexOf('noir') < 0) fail('le collé ne s’est pas inséré : « ' + t3 + ' »');
  ok('le collé s’insère au curseur : « ' + t3.slice(0, 30) + '… »');

  // ---------- 5. Ctrl+A garde le chemin « tout réécrire » ----------
  await p.keyboard.press('ControlOrMeta+a');
  await p.keyboard.type('Tout neuf.');
  await p.waitForTimeout(200);
  if ((await texte()) !== 'Tout neuf.') fail('Ctrl+A puis frappe ne réécrit pas tout : « ' + (await texte()) + ' »');
  ok('Ctrl+A puis frappe réécrit tout le texte d’un coup');

  // ---------- 6. Échap valide, la retouche part à l'export ----------
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  const n = await p.$$eval('#list .it span', ns => ns.map(x => x.textContent.trim()));
  if (!n.some(t => /Tout neuf/.test(t))) fail('la retouche n’est pas enregistrée : ' + JSON.stringify(n));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1200);
  const fin = await v.evaluate(() => document.getElementById('txt').textContent);
  if (fin !== 'Tout neuf.') fail('export : le texte n’est pas rejoué : « ' + fin + ' »');
  ok('export : le texte final est rejoué à l’identique');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
