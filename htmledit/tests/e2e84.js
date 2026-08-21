/* SURLIGNER un identifiant (login, mot de passe) dans une carte-lien ne doit
   JAMAIS ouvrir la page au relâchement de la souris — même quand l'outil n'a
   pas su reconnaître l'étiquette « Mot de passe » (valeur enrobée avec une
   icône, ou pas d'étiquette du tout). La garde ne repose plus sur la
   reconnaissance : tout glissé qui laisse une sélection dans une carte annule
   le clic qui suit. Un clic simple, lui, ouvre toujours le lien.
   Usage : node e2e84.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_mdp.html');
const OUT = path.resolve(__dirname, 'mdp_export.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

const carte = (id, href, corps) => `<a id="${id}" href="${href}" style="display:block;width:340px;
  padding:14px;margin-bottom:14px;border:1px solid #ccc;text-decoration:none;color:#222">
  <div id="t_${id}" style="font-weight:700;margin-bottom:8px">Outil ${id}</div>${corps}</a>`;

fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Accès</title></head>
<body style="font-family:sans-serif;padding:30px">
<h1>Accès aux outils</h1>
${carte('carte1', '#zone1', `
  <div><span style="font-size:10px">Login</span>
       <span id="log1" style="font-family:monospace;font-weight:700">demo@studio.com</span></div>
  <div><span style="font-size:10px">Mot de passe</span>
       <span id="mdp1" style="font-family:monospace;font-weight:700">motdepasse123</span></div>`)}
${/* la valeur est enrobée avec une icône SANS texte : l'ancienne détection
      abandonnait ici, donc AUCUNE garde n'était posée sur la carte */ ''}
${carte('carte2', '#zone2', `
  <div><span style="font-size:10px">Mot de passe</span></div>
  <div style="display:flex;gap:6px;align-items:center">
    <span id="mdp2" style="font-family:monospace;font-weight:700">Sup3r-Secret-2026</span>
    <svg width="12" height="12"><rect width="12" height="12" fill="#bbb"></rect></svg>
  </div>`)}
${/* aucune étiquette reconnaissable, et la carte n'est pas un <a> mais une
      case cliquable : la détection ne peut rien, seule la garde générale du
      geste protège le surlignage */ ''}
<div id="carte3" role="button" onclick="location.hash='#zone3'"
  style="display:block;width:340px;padding:14px;margin-bottom:14px;border:1px solid #ccc;cursor:pointer">
  <div id="t_carte3" style="font-weight:700;margin-bottom:8px">Outil carte3</div>
  <div>Accès direct : <b id="mdp3" style="font-family:monospace">zzz-999-plip</b></div>
</div>
<div id="zone1" style="height:700px"></div>
<div id="zone2" style="height:700px"></div>
<div id="zone3" style="height:700px"></div>
</body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1100, height: 700 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => { if (!/Clipboard|writeText/.test(e.message)) errs.push(e.message); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1400);

  // ---------- 1. dans l'APERÇU : surligner ne fait pas suivre le lien ----------
  await p.click('#mView');
  await p.waitForTimeout(400);
  const glisserApercu = async (sel) => {
    const b = await p.evaluate((s) => {
      const d = document.getElementById('frame').contentDocument;
      d.defaultView.getSelection().removeAllRanges();
      d.defaultView.location.hash = '';
      const n = d.querySelector(s);
      n.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = n.getBoundingClientRect();
      const f = document.getElementById('frame').getBoundingClientRect();
      return { x: f.left + r.left + 2, y: f.top + r.top + r.height / 2,
               x2: f.left + r.right - 2, y2: f.top + r.top + r.height / 2,
               y0: d.defaultView.scrollY };
    }, sel);
    await p.waitForTimeout(250);
    await p.mouse.move(b.x, b.y);
    await p.mouse.down();
    await p.mouse.move(b.x2, b.y2, { steps: 12 });
    await p.mouse.up();
    await p.waitForTimeout(600);
    return p.evaluate((y0) => {
      const d = document.getElementById('frame').contentDocument;
      if (!d) return { perdu: true };
      return { sel: String(d.defaultView.getSelection()).trim(),
               bouge: Math.abs(d.defaultView.scrollY - y0) > 40 };
    }, b.y0);
  };
  for (const s of ['#mdp1', '#mdp2', '#mdp3']) {
    const r = await glisserApercu(s);
    if (r.perdu) fail('aperçu : surligner ' + s + ' a fait quitter la page');
    if (r.bouge) fail('aperçu : surligner ' + s + ' a fait suivre le lien (la page a sauté à l’ancre)');
    if (!r.sel || r.sel.length < 4)
      fail('aperçu : le surlignage de ' + s + ' n’a rien sélectionné : ' + JSON.stringify(r.sel));
    ok('aperçu : surligner ' + s + ' garde la sélection (« ' + r.sel + ' ») sans suivre le lien');
  }

  // ---------- 2. le pack exporté ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => { if (!/Clipboard|writeText/.test(e.message)) errs.push('[export] ' + e.message); });
  await v.goto('file://' + OUT);
  await v.waitForTimeout(2000);

  // la valeur enrobée avec une icône est désormais reconnue comme identifiant
  const marques = await v.evaluate(() => ['mdp1', 'mdp2'].map(
    (i) => !!document.getElementById(i).getAttribute('data-pk-cred')));
  if (!marques[0]) fail('pack : le mot de passe simple n’est pas repéré comme identifiant');
  if (!marques[1]) fail('pack : le mot de passe enrobé (icône à côté) n’est pas repéré comme identifiant');
  ok('pack : les deux mots de passe étiquetés sont sélectionnables et copiables');

  const glisser = async (sel) => {
    await v.evaluate(() => { location.hash = ''; window.getSelection().removeAllRanges(); });
    await v.waitForTimeout(250);
    const b = await v.evaluate((s) => {
      const n = document.getElementById(s.slice(1));
      n.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = n.getBoundingClientRect();
      // on surligne LARGE, comme à la main : le geste déborde un peu du champ
      return { x: r.left + 2, y: r.top + r.height / 2, x2: r.right + 10, y2: r.bottom + 4 };
    }, sel);
    await v.mouse.move(b.x, b.y);
    await v.mouse.down();
    await v.mouse.move(b.x2, b.y2, { steps: 12 });
    await v.mouse.up();                      // c'est ICI que la page s'ouvrait
    await v.waitForTimeout(700);
    return v.evaluate(() => ({ sel: String(window.getSelection()).trim(), hash: location.hash }));
  };
  const attendu = { '#mdp1': '#zone1', '#mdp2': '#zone2', '#mdp3': '#zone3' };
  for (const s of ['#mdp1', '#mdp2', '#mdp3']) {
    const r = await glisser(s);
    if (r.hash === attendu[s])
      fail('pack : surligner ' + s + ' ouvre encore le lien au relâchement de la souris');
    if (!r.sel || r.sel.length < 4)
      fail('pack : le surlignage de ' + s + ' n’a rien sélectionné : ' + JSON.stringify(r.sel));
    ok('pack : surligner ' + s + ' garde la sélection (« ' + r.sel + ' ») sans ouvrir la page');
  }

  // ---------- 3. un clic simple ouvre toujours le lien ----------
  for (const c of ['carte1', 'carte2', 'carte3']) {
    await v.evaluate(() => { location.hash = ''; window.getSelection().removeAllRanges(); });
    await v.waitForTimeout(200);
    const b = await v.evaluate((id) => {
      const n = document.getElementById('t_' + id);
      n.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = n.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, c);
    await v.mouse.click(b.x, b.y);
    await v.waitForTimeout(500);
    const h = await v.evaluate(() => location.hash);
    if (h !== '#' + c.replace('carte', 'zone'))
      fail('pack : un clic simple sur ' + c + ' n’ouvre plus son lien (hash=' + JSON.stringify(h) + ')');
  }
  ok('pack : un clic simple ouvre toujours le lien des trois cartes');

  // ---------- 4. cliquer une valeur reconnue la copie toujours ----------
  await v.evaluate(() => { location.hash = ''; window.getSelection().removeAllRanges(); });
  await v.waitForTimeout(250);
  const b2 = await v.evaluate(() => {
    const n = document.getElementById('mdp2');
    n.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = n.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await v.mouse.click(b2.x, b2.y);
  await v.waitForTimeout(600);
  const cop = await v.evaluate(() => ({
    sel: String(window.getSelection()).trim(),
    bulle: !!document.querySelector('[data-pk-bulle]'), hash: location.hash }));
  if (cop.hash === '#zone2') fail('pack : cliquer le mot de passe ouvre le lien');
  if (cop.sel !== 'Sup3r-Secret-2026')
    fail('pack : le clic ne sélectionne pas la valeur entière : ' + JSON.stringify(cop.sel));
  if (!cop.bulle) fail('pack : aucun retour « Copié » après le clic sur le mot de passe');
  ok('pack : cliquer le mot de passe le sélectionne et le copie');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
