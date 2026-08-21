/* Les identifiants d'un outil (Login / Mot de passe) vivent dans une CARTE
   QUI EST UN LIEN :
   - dans l'éditeur, le double-clic pour corriger un mot faisait suivre le
     lien (l'aperçu quittait la page, l'édition était perdue) ;
   - dans le pack final, cliquer la valeur la sélectionne et la copie, et
     SURLIGNER à la souris ne doit pas ouvrir la page au relâchement.
   Le reste de la carte, lui, ouvre toujours son lien.
   Usage : node e2e81.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_creds.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ressources</title></head>
<body style="font-family:sans-serif;padding:30px">
<h1>Ressources</h1>
<a id="carte" href="#ressources" style="display:flex;flex-direction:column;gap:10px;width:320px;
   padding:16px;border:1px solid #ccc;text-decoration:none;color:#222">
  <span id="titre" style="font-weight:700">Outil de review</span>
  <span style="display:flex;flex-direction:column;gap:8px;padding:12px;background:#EDE4D0;border-radius:10px">
    <span style="display:flex;flex-direction:column;gap:1px">
      <span id="etiq" style="font-size:10px;font-weight:700;text-transform:uppercase;color:#9a8f7c">Login</span>
      <span id="login" style="font-family:monospace;font-size:12.5px;font-weight:700">demo@studio.com</span>
    </span>
    <span style="display:flex;flex-direction:column;gap:1px">
      <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:#9a8f7c">Mot de passe</span>
      <span id="mdp" style="font-family:monospace;font-size:12.5px;font-weight:700">motdepasse123</span>
    </span>
  </span>
</a>
<div id="ressources" style="height:600px"></div>
</body></html>`);

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
  await p.click('#mText');
  await p.waitForTimeout(300);

  const pt = (sel, dx) => p.evaluate(([s, d]) => {
    const doc = document.getElementById('frame').contentDocument;
    const r = doc.querySelector(s).getBoundingClientRect();
    const f = document.getElementById('frame').getBoundingClientRect();
    return { x: f.left + r.left + (d != null ? d : r.width / 2), y: f.top + r.top + r.height / 2, w: r.width };
  }, [sel, dx]);
  const lire = (sel) => p.evaluate((s) => {
    const doc = document.getElementById('frame').contentDocument;
    if (!doc) return '(APERÇU PERDU)';
    const n = doc.querySelector(s);
    return n ? n.textContent.trim() : '(champ disparu)';
  }, sel);
  const enEdition = () => p.evaluate(() => {
    const doc = document.getElementById('frame').contentDocument;
    if (!doc) return '(APERÇU PERDU)';
    const e = doc.querySelector('[contenteditable=true]');
    return e ? (e.textContent || '').trim() : null;
  });

  // ---------- 1. DOUBLE-CLIC sur le login (corriger un mot) ----------
  let c = await pt('#login', 20);
  await p.mouse.dblclick(c.x, c.y);
  await p.waitForTimeout(700);
  const ed1 = await enEdition();
  if (ed1 === '(APERÇU PERDU)')
    fail('le double-clic a fait suivre le lien : l’aperçu a quitté la page');
  if (ed1 !== 'demo@studio.com') fail('le double-clic n’ouvre pas l’édition du login : ' + JSON.stringify(ed1));
  await p.keyboard.type('jeremy');
  await p.waitForTimeout(300);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(800);
  const l1 = await lire('#login');
  if (l1 !== 'jeremy@studio.com') fail('après double-clic + frappe, le login vaut ' + JSON.stringify(l1));
  ok('double-clic sur le login : le mot se remplace, l’aperçu tient (' + l1 + ')');

  // ---------- 2. SÉLECTION À LA SOURIS dans le mot de passe ----------
  c = await pt('#mdp', 4);
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(500);
  if ((await enEdition()) === null) fail('le clic n’ouvre pas l’édition du mot de passe');
  await p.mouse.move(c.x, c.y);
  await p.mouse.down();
  await p.mouse.move(c.x + Math.min(70, c.w - 6), c.y, { steps: 8 });
  await p.mouse.up();
  await p.waitForTimeout(400);
  const sel = await p.evaluate(() => {
    const doc = document.getElementById('frame').contentDocument;
    return String(doc.defaultView.getSelection());
  });
  if (!sel || sel.length < 3)
    fail('la sélection à la souris n’a rien pris (le lien s’est fait glisser ?) : ' + JSON.stringify(sel));
  ok('sélection à la souris dans le mot de passe : « ' + sel + ' »');
  await p.keyboard.type('X');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(800);
  const m1 = await lire('#mdp');
  if (m1 === '(APERÇU PERDU)') fail('l’aperçu a quitté la page pendant l’édition du mot de passe');
  if (m1 === 'motdepasse123' || !/X/.test(m1)) fail('le mot de passe n’a pas été modifié : ' + JSON.stringify(m1));
  ok('le mot de passe se modifie et tient (' + m1 + ')');

  // ---------- 3. l'étiquette aussi, et la carte garde son lien ----------
  c = await pt('#etiq', 10);
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(500);
  await p.keyboard.press('ControlOrMeta+a');
  await p.keyboard.type('Identifiant');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(800);
  if ((await lire('#etiq')) !== 'Identifiant') fail('l’étiquette ne se modifie pas');
  ok('l’étiquette « Login » se modifie aussi');

  const attrs = await p.evaluate(() => {
    const doc = document.getElementById('frame').contentDocument;
    const a = doc.getElementById('carte');
    return { href: a.getAttribute('href'), drag: a.getAttribute('draggable'),
      edit: !!doc.querySelector('[contenteditable=true]') };
  });
  if (attrs.href !== '#ressources') fail('le lien de la carte a été abîmé : ' + JSON.stringify(attrs.href));
  if (attrs.drag !== 'false') fail('la carte devrait rester non-glissable : ' + JSON.stringify(attrs.drag));
  if (attrs.edit) fail('une édition est restée ouverte');
  ok('après édition : la carte a retrouvé son lien intact, rien ne traîne');

  // ---------- 4. le PACK FINAL : un clic sélectionne et copie ----------
  const OUT = path.resolve(__dirname, 'creds_export.html');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(2000);
  const boite = await v.evaluate(() => {
    const r = document.getElementById('login').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await v.mouse.click(boite.x, boite.y);
  await v.waitForTimeout(600);
  const res = await v.evaluate(() => ({
    selection: String(window.getSelection()).trim(),
    bulle: !!document.querySelector('[data-pk-bulle]'),
    hash: location.hash,
  }));
  if (res.hash === '#ressources')
    fail('dans le pack, cliquer le login ouvre encore le lien');
  if (res.selection !== 'jeremy@studio.com')
    fail('le clic ne sélectionne pas la valeur entière : ' + JSON.stringify(res.selection));
  if (!res.bulle) fail('aucun retour « Copié » après le clic sur le login');
  ok('pack final : cliquer le login le sélectionne et le copie, sans ouvrir la page');

  // ---------- 5. SURLIGNER à la souris n'ouvre pas la page ----------
  await v.evaluate(() => { location.hash = ''; window.getSelection().removeAllRanges(); });
  await v.waitForTimeout(300);
  // on surligne LARGE, comme à la main : le geste déborde du champ et finit
  // sur la carte — c'est là que le clic de relâchement ouvrait la page
  const bl = await v.evaluate(() => {
    const r = document.getElementById('login').getBoundingClientRect();
    const c = document.getElementById('carte').getBoundingClientRect();
    return { x: r.left + 2, y: r.top + r.height / 2,
             x2: Math.min(c.right - 6, r.right + 60), y2: r.bottom + 6 };
  });
  await v.mouse.move(bl.x, bl.y);
  await v.mouse.down();
  await v.mouse.move(bl.x2, bl.y2, { steps: 12 });
  await v.mouse.up();                       // c'est ICI que la page s'ouvrait
  await v.waitForTimeout(700);
  const surlig = await v.evaluate(() => ({
    selection: String(window.getSelection()).trim(), hash: location.hash,
  }));
  if (surlig.hash === '#ressources')
    fail('surligner le login ouvre encore la page au relâchement de la souris');
  if (!surlig.selection || surlig.selection.length < 4)
    fail('le surlignage n’a rien sélectionné : ' + JSON.stringify(surlig.selection));
  ok('surligner le login : sélection gardée (« ' + surlig.selection + ' »), page non ouverte');

  // ---------- 6. le reste de la carte ouvre toujours le lien ----------
  await v.evaluate(() => window.getSelection().removeAllRanges());
  const bt = await v.evaluate(() => {
    const r = document.getElementById('titre').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await v.mouse.click(bt.x, bt.y);
  await v.waitForTimeout(600);
  if ((await v.evaluate(() => location.hash)) !== '#ressources')
    fail('le reste de la carte n’ouvre plus son lien');
  ok('le reste de la carte ouvre toujours son lien');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
