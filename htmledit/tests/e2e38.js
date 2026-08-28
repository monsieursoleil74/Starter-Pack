/* Recadrage sur la vraie maquette : un visuel qui passe par la réserve
   (portrait de personnage) doit pouvoir être déplacé, et le cadrage doit
   suivre l'image partout où elle sert. */
const { chromium } = require('playwright-core');
const path = require('path');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = '/root/.claude/uploads/9b61ac52-1242-5681-b4f1-1a84f74cc71a/24ff5115-Pack_NDA__Version_demo__horsligne_1.html';
if (!require('fs').existsSync(MAQ)) {
  console.log('SAUTÉ : ce test rejoue un vrai pack déposé dans la session, qui n’est pas versionné.');
  process.exit(0);
}

const LARGE = path.resolve(__dirname, 'large.png');
const OUT = path.resolve(__dirname, 'maq10_modifiee.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

const ou = ({ k, phase }) => {
  const d = document.getElementById('frame').contentDocument;
  const ent = d.querySelector('#rg-assetmap [data-k$="' + k + '"]');
  if (!ent) return null;
  const src = ent.getAttribute('src');
  const vue = [...d.querySelectorAll('img')].find(n => !n.closest('#rg-assetmap') &&
    n.getBoundingClientRect().width > 40 &&
    (n.getAttribute('src') === src ||
     getComputedStyle(n).content.indexOf(src.slice(0, 48)) >= 0));
  if (!vue) return null;
  if (phase === 'scroll') { vue.scrollIntoView({ block: 'center' }); return { ok: 1 }; }
  const r = vue.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: Math.round(r.width), h: Math.round(r.height) };
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1500, height: 900 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load|DEMUXER|Media resource/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(10000);
  await p.click('#mImg');
  await p.waitForTimeout(1200);

  await p.evaluate(ou, { k: 'pipo_portrait.png', phase: 'scroll' });
  await p.waitForTimeout(900);
  const pos = await p.evaluate(ou, { k: 'pipo_portrait.png', phase: 'lire' });
  if (!pos) fail('portrait de Pipo introuvable');
  const b = await p.locator('#frame').boundingBox();
  await p.mouse.click(b.x + pos.x, b.y + pos.y);
  await p.waitForTimeout(700);
  if (!(await p.$eval('#askg', e => e.classList.contains('hidden')))) await p.locator('#askgGrid .gi').first().click();
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', LARGE);
  await p.waitForTimeout(1800);
  if (await p.$eval('#crop', e => e.classList.contains('hidden')))
    fail('image large dans un portrait carré : le recadrage devrait s’ouvrir');
  ok('portrait (' + pos.w + '×' + pos.h + ') : le recadrage s’ouvre');

  const p2 = await p.evaluate(ou, { k: 'pipo_portrait.png', phase: 'lire' });
  await p.mouse.move(b.x + p2.x, b.y + p2.y);
  await p.mouse.down();
  await p.mouse.move(b.x + p2.x - 50, b.y + p2.y, { steps: 8 });
  await p.mouse.up();
  await p.waitForTimeout(500);
  const style = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const n = [...d.querySelectorAll('img')].find(x => !x.closest('#rg-assetmap')
      && x.getBoundingClientRect().width > 40
      && ((x.getAttribute('src') || '').indexOf('data:image/png') === 0
          || d.defaultView.getComputedStyle(x).content.indexOf('data:image/png') >= 0));
    return n ? { pos: n.style.objectPosition, fit: n.style.objectFit } : null;
  });
  if (!style || style.pos === '50% 50%') fail('le glisser n’a pas bougé le portrait : ' + JSON.stringify(style));
  ok('le portrait se déplace dans sa pastille : ' + style.pos);
  await p.click('#cropOk');

  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(10000);
  const fin = await v.evaluate(() => {
    const n = [...document.querySelectorAll('img')].filter(x => (x.getAttribute('src') || '').indexOf('data:image/png') === 0);
    return n.map(x => x.style.objectPosition).filter(Boolean);
  });
  if (!fin.length) fail('export : aucun cadrage rejoué');
  ok('export : le cadrage suit l’image (' + fin.join(', ') + ')');
  await v.close();

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
