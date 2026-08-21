/* Les noms d'une carte sont ancrés sur son TITRE. Renommer le titre les
   faisait suivre — mais LE RE-RENOMMER (la propagation ne suivait que
   l'original) ou ANNULER le renommage (aucune propagation inverse) les
   laissait orphelins : tous les noms retombaient aux placeholders, sans
   retour possible. Les deux sens sont maintenant propagés.
   Usage : node e2e78.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_equipe.html');   // écrite par e2e77
const OUT = path.resolve(__dirname, 'e2e78_export.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }
if (!fs.existsSync(MAQ)) { console.error('lance e2e77 d’abord (maq_equipe.html)'); process.exit(1); }

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1100, height: 700 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1200);

  const edite = async (contenu, texte) => {
    await p.click('#mText');
    await p.waitForTimeout(250);
    const okS = await p.evaluate((q) => {
      const d = document.getElementById('frame').contentDocument;
      const n = [...d.querySelectorAll('span.sc-interp')].find(x => !x.children.length &&
        (x.textContent || '').trim() === q);
      if (!n) return false;
      n.scrollIntoView({ block: 'center', behavior: 'instant' });
      return true;
    }, contenu);
    if (!okS) fail('champ introuvable : ' + contenu);
    await p.waitForTimeout(400);
    const c = await p.evaluate((q) => {
      const d = document.getElementById('frame').contentDocument;
      const n = [...d.querySelectorAll('span.sc-interp')].find(x => !x.children.length &&
        (x.textContent || '').trim() === q);
      const r = n.getBoundingClientRect();
      const f = document.getElementById('frame').getBoundingClientRect();
      return { x: f.left + r.left + 8, y: f.top + r.top + r.height / 2 };
    }, contenu);
    await p.mouse.click(c.x, c.y);
    await p.waitForTimeout(350);
    await p.keyboard.press('ControlOrMeta+a');
    await p.keyboard.type(texte);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(600);
  };
  const montre = (q) => p.evaluate((t) => {
    const d = document.getElementById('frame').contentDocument;
    return [...d.querySelectorAll('span.sc-interp')].some(x => (x.textContent || '').trim() === t);
  }, q);

  // ---------- 1. nom posé, ancré sur le titre de la carte ----------
  await edite('NOM-B', 'JARDET');
  if (!(await montre('JARDET'))) fail('le nom ne s’est pas posé');
  ok('nom remplacé (ancré sur le titre de la carte)');

  // ---------- 2. renommer le titre : le nom suit ----------
  await edite('Cheffe Équipe', 'Pascale BORIES');
  await p.waitForTimeout(800);
  if (!(await montre('JARDET'))) fail('renommer le titre a perdu le nom');
  ok('titre renommé : le nom suit');

  // ---------- 3. RE-renommer le titre : le nom suit encore ----------
  await edite('Pascale BORIES', 'Sarah FAGOT');
  await p.waitForTimeout(800);
  if (!(await montre('JARDET'))) fail('RE-renommer le titre a perdu le nom (propagation depuis l’affiché)');
  ok('titre re-renommé : le nom suit encore');

  // ---------- 4. annuler le renommage : le nom revient sur le titre d'origine ----------
  await p.evaluate(() => {
    const it = [...document.querySelectorAll('#list .it')].find(x => /Sarah FAGOT/.test(x.textContent || ''));
    if (!it) throw new Error('retouche du titre introuvable dans la liste');
    it.querySelector('button.sup').click();
  });
  await p.waitForTimeout(3500);
  if (!(await montre('Cheffe Équipe'))) fail('l’annulation n’a pas remis le titre');
  if (!(await montre('JARDET')))
    fail('l’annulation du titre a détruit le nom — l’ancre n’est pas revenue avec lui');
  ok('renommage annulé : le nom tient, ré-accroché au titre d’origine');

  // ---------- 5. l'export est sain ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const dd = JSON.parse(fs.readFileSync(OUT, 'utf8')
    .match(/<script id="pack-edit-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
  const pj = dd.find(x => x.after === 'JARDET');
  if (!pj || (pj.when && pj.when.txt !== 'Cheffe Équipe'))
    fail('export : l’ancre du nom devrait être « Cheffe Équipe » : ' + JSON.stringify(pj && pj.when && pj.when.txt));
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1500);
  const dansExport = await v.evaluate(() =>
    [...document.querySelectorAll('span.sc-interp')].some(x => (x.textContent || '').trim() === 'JARDET'));
  if (!dansExport) fail('export rouvert : le nom est perdu');
  ok('export rouvert : le nom est là, ancre saine');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
