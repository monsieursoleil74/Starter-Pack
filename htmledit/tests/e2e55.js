/* Coller, valider, REVENIR sur le même texte, recoller et continuer : le
   scénario qui gelait l'édition. Un collé multiligne ne doit pas laisser de
   <div> dans le paragraphe, et les sauts de ligne doivent survivre à l'export. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_recolle2.html');
const OUT = path.resolve(__dirname, 'recolle_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Recolle</title>
</head><body style="font-family:sans-serif;padding:30px">
<h1>Notes de prod</h1><p id="txt">Texte de départ.</p></body></html>`);

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

  const coller = t => p.evaluate((t) => {
    const d = document.getElementById('frame').contentDocument;
    const n = d.querySelector('[contenteditable]');
    if (!n) return false;
    const dt = new DataTransfer();
    dt.setData('text/plain', t);
    n.dispatchEvent(new d.defaultView.ClipboardEvent('paste',
      { bubbles: true, cancelable: true, clipboardData: dt }));
    return true;
  }, t);

  // ---------- 1. coller un texte multiligne, valider ----------
  await fr.locator('#txt').click();
  await p.waitForTimeout(300);
  await p.keyboard.press('ControlOrMeta+a');
  if (!(await coller('Ligne un.\nLigne deux.'))) fail('pas de zone d’édition au 1er passage');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);
  const e1 = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const n = d.getElementById('txt');
    return { enfants: n.children.length, texte: n.textContent, ws: n.style.whiteSpace,
             lignes: n.getClientRects().length };
  });
  if (e1.enfants) fail('le collé multiligne a laissé des blocs dans le paragraphe (' + e1.enfants + ')');
  if (e1.texte !== 'Ligne un.\nLigne deux.') fail('texte inattendu : ' + JSON.stringify(e1.texte));
  if (e1.ws !== 'pre-line') fail('les sauts de ligne ne sont pas rendus (white-space=' + e1.ws + ')');
  ok('collé multiligne : paragraphe propre, sauts de ligne rendus');

  // ---------- 2. REVENIR sur le même texte : il doit se rouvrir en entier ----------
  await fr.locator('#txt').click();
  await p.waitForTimeout(400);
  const e2 = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const n = d.querySelector('[contenteditable]');
    return n ? { id: n.id || n.tagName, contenu: n.textContent } : null;
  });
  if (!e2) fail('LE BUG : le texte ne se rouvre plus après un premier collé');
  if (e2.id !== 'txt') fail('la réédition ouvre un morceau (' + e2.id + ') au lieu du bloc entier');
  ok('re-cliquer rouvre le bloc entier, pas un morceau');

  // recoller à la suite et continuer au clavier
  await p.keyboard.press('ControlOrMeta+End');
  if (!(await coller('\nEt la suite collée.'))) fail('recoller ne marche pas');
  await p.keyboard.type(' Fin.');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);
  const e3 = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    return d.getElementById('txt').textContent;
  });
  if (!/Ligne un\./.test(e3) || !/Et la suite collée\./.test(e3) || !/Fin\.$/.test(e3.trim()))
    fail('le contenu recollé/complété est faux : ' + JSON.stringify(e3));
  ok('recoller puis taper à la suite fonctionne : ' + JSON.stringify(e3.slice(0, 44) + '…'));

  // une seule retouche pour ce texte (réédition = remplacement, pas doublon)
  const n = await p.$$eval('#list .it', ns => ns.length);
  if (n !== 1) fail('la réédition a créé ' + n + ' retouches au lieu d’une');
  ok('toujours une seule retouche après trois passages');

  // ---------- 3. export : sauts de ligne rejoués ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1200);
  const fin = await v.evaluate(() => {
    const n = document.getElementById('txt');
    return { texte: n.textContent, ws: getComputedStyle(n).whiteSpace, enfants: n.children.length };
  });
  if (fin.texte !== e3) fail('export : le texte diffère : ' + JSON.stringify(fin.texte));
  if (fin.ws !== 'pre-line') fail('export : les sauts de ligne sont perdus (white-space=' + fin.ws + ')');
  ok('export : même texte, sauts de ligne rendus');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
