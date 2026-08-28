/* Bug signalé : je remplace un plan du color script, et quand je clique pour
   l'agrandir, c'est une autre image qui s'ouvre. Et : un portrait remplacé ne
   doit valoir que pour SON personnage. Sur la maquette à jour. */
const { chromium } = require('playwright-core');
const path = require('path');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = '/root/.claude/uploads/9b61ac52-1242-5681-b4f1-1a84f74cc71a/24ff5115-Pack_NDA__Version_demo__horsligne_1.html';
if (!require('fs').existsSync(MAQ)) {
  console.log('SAUTÉ : ce test rejoue un vrai pack déposé dans la session, qui n’est pas versionné.');
  process.exit(0);
}

const PNG = path.resolve(__dirname, 'remplacement.png');
const PNG2 = path.resolve(__dirname, 'rempl2.png');
const OUT = path.resolve(__dirname, 'maq7_modifiee.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

// toutes les entrées de la réserve, par chemin
const res = () => {
  const d = document.getElementById('frame') ? document.getElementById('frame').contentDocument : document;
  const m = {};
  d.querySelectorAll('#rg-assetmap [data-k]').forEach(n => { m[n.getAttribute('data-k')] = n.getAttribute('src') || ''; });
  return m;
};

// où s'affiche, dans la page, le visuel d'une entrée de réserve.
// scrollIntoView ne prend effet qu'après coup : on relit la position ensuite.
const ou = ({ k, phase }) => {
  const d = document.getElementById('frame').contentDocument;
  const sel = '#rg-assetmap [data-k' + (k.indexOf('/') >= 0 ? '="' + k + '"' : '$="' + k + '"') + ']';
  const ent = d.querySelector(sel);
  if (!ent) return null;
  const src = ent.getAttribute('src');
  const vue = [...d.querySelectorAll('img')]
    .find(n => !n.closest('#rg-assetmap') && n.getBoundingClientRect().width > 40 &&
      (n.getAttribute('src') === src ||
       getComputedStyle(n).content.indexOf(src.slice(0, 48)) >= 0));
  if (!vue) return null;
  if (phase === 'scroll') { vue.scrollIntoView({ block: 'center' }); return { alt: vue.getAttribute('alt') }; }
  const r = vue.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, alt: vue.getAttribute('alt') };
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1500, height: 900 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load|DEMUXER|Media resource/.test(m.text())) errs.push(m.text()); });

  const viser = async k => {
    if (!(await p.evaluate(ou, { k: k, phase: 'scroll' }))) return null;
    await p.waitForTimeout(900);
    return p.evaluate(ou, { k: k, phase: 'lire' });
  };
  const cliquer = async pos => {
    const b = await p.locator('#frame').boundingBox();
    await p.mouse.click(b.x + pos.x, b.y + pos.y);
    await p.waitForTimeout(800);
  };
  const remplacer = async fichier => {
    if (!(await p.$eval('#askg', e => e.classList.contains('hidden'))))
      await p.locator('#askgGrid .gi').first().click();
    if (!(await p.$eval('#ask', e => e.classList.contains('hidden'))))
      fail('l’outil propose de POSER une image : il n’a pas vu celle qui est là');
    // le clic ouvre le cadrage : le remplacement se demande
    if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
      await p.click('#cropRemp').catch(() => {});
    await p.setInputFiles('#pickImg', fichier);
    await p.waitForTimeout(1500);
    if (!(await p.$eval('#askg', e => e.classList.contains('hidden')))) await p.click('#askgNo');
  };

  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(10000);

  // ---------- 1. un plan du color script ----------
  await p.click('#mImg');
  await p.waitForTimeout(1200);
  const CS = 'assets_nda/colorscript/cs_03.jpg';
  const vise = await viser(CS);
  if (!vise) fail('cs_03 n’est affiché nulle part dans la page');
  ok('plan visé : cs_03.jpg (« ' + vise.alt + ' »)');
  await cliquer(vise);
  await remplacer(PNG);
  const ap = await p.evaluate(res);
  const chg = Object.keys(ap).filter(k => ap[k].indexOf('data:image') === 0);
  if (chg.length !== 1) {
    const noms = await p.$$eval('#list .it span', ns => ns.map(n => n.textContent));
    fail('entrées de réserve posées : ' + JSON.stringify(chg) + ' — retouches : ' + JSON.stringify(noms));
  }
  if (chg[0] !== CS) fail('ce n’est pas le bon plan : ' + chg[0]);
  ok('c’est bien l’entrée cs_03.jpg de la réserve qui est remplacée, elle seule');

  // ---------- 2. l'agrandissement montre LA MÊME image ----------
  await p.click('#mView');
  await p.waitForTimeout(700);
  const pos = await viser(CS);
  if (!pos) fail('la vignette retouchée n’est plus affichée');
  await cliquer(pos);
  await p.waitForTimeout(900);
  // l'image de test fait 8 px : on ne juge pas sur la taille mais sur la SOURCE
  const agrandi = await p.evaluate(k => {
    const d = document.getElementById('frame').contentDocument;
    const attendu = d.querySelector('#rg-assetmap [data-k="' + k + '"]').getAttribute('src');
    const fen = [...d.querySelectorAll('div')]
      .filter(n => getComputedStyle(n).position === 'fixed' && n.getBoundingClientRect().width > 400);
    if (!fen.length) return { ouvert: false };
    const dedans = [...fen[0].querySelectorAll('img')].map(n => n.getAttribute('src') || '');
    const contenus = [...fen[0].querySelectorAll('img')].map(n => getComputedStyle(n).content || '');
    const fonds = [...fen[0].querySelectorAll('*')]
      .map(n => getComputedStyle(n).backgroundImage || '').filter(v => v.indexOf('url(') === 0);
    return { ouvert: true, attendu: attendu.slice(0, 22),
             memeImage: dedans.some(sr => sr === attendu) ||
                        contenus.some(c => c.indexOf(attendu.slice(0, 48)) >= 0),
             images: dedans.map(sr => sr.slice(0, 22)),
             fonds: fonds.map(v => v.slice(0, 30)) };
  }, CS);
  if (!agrandi.ouvert) fail('le clic n’ouvre pas l’agrandissement');
  if (!agrandi.memeImage)
    fail('l’agrandissement ne montre PAS la même image que la vignette : ' + JSON.stringify(agrandi));
  ok('l’agrandissement montre exactement la source de la vignette remplacée (' + agrandi.attendu + '…)');

  // refermer l'agrandissement
  const fermer = p.frameLocator('#frame').locator('button[aria-label="Fermer"]').first();
  if (await fermer.count()) await fermer.click({ force: true });
  await p.waitForTimeout(900);

  // ---------- 3. un portrait ne vaut que pour son personnage ----------
  await p.click('#mImg');
  await p.waitForTimeout(1000);
  const port = await viser('pipo_portrait.png');
  if (!port) fail('le portrait de Pipo n’est affiché nulle part');
  await cliquer(port);
  await remplacer(PNG2);
  const fin = await p.evaluate(res);
  const tous = Object.keys(fin).filter(k => /portrait\.png$/.test(k));
  const faits = tous.filter(k => fin[k].indexOf('data:image') === 0);
  if (faits.length !== 1) fail('portraits touchés : ' + JSON.stringify(faits));
  if (!/pipo/.test(faits[0])) fail('ce n’est pas le portrait de Pipo : ' + faits[0]);
  ok('portrait remplacé pour Pipo seul — les ' + (tous.length - 1) + ' autres personnages intacts');

  // ---------- 4. export ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(10000);
  const dehors = await v.evaluate(res);
  const posees = Object.keys(dehors).filter(k => dehors[k].indexOf('data:image') === 0);
  if (posees.length !== 2) fail('export : ' + posees.length + ' contenus posés → ' + JSON.stringify(posees));
  ok('export : les 2 contenus retouchés, et eux seuls (' + posees.map(k => k.split('/').pop()).join(', ') + ')');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
