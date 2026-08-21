/* AUDIT B/C — localité et parité : une retouche de chaque nature, puis on
   vérifie que RIEN d'autre n'a bougé, que les retouches suivent la navigation
   sans déborder, et que l'export se comporte à l'identique. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_ronds.html');
if (!fs.existsSync(MAQ)) {
  console.log('SAUTÉ : ce test rejoue un vrai fichier (maq_ronds.html), qui n’est pas versionné.');
  process.exit(0);
}
const OUT = path.resolve(__dirname, 'audit_export.html');
const PNG = path.resolve(__dirname, 'alt_a.png');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => { if (!/Clipboard|writeText/.test(e.message)) errs.push(e.message); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)', { timeout: 120000 });
  await p.waitForTimeout(6000);

  const snap = () => p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const txts = new Map();
    for (const n of d.querySelectorAll('body *')) {
      if (n.children.length || /^(SCRIPT|STYLE)$/.test(n.tagName)) continue;
      const t = (n.textContent || '').replace(/\s+/g, ' ').trim();
      if (t) txts.set(t, (txts.get(t) || 0) + 1);
    }
    return [...txts.entries()];
  });
  const diffSnap = (a, b) => {
    const ma = new Map(a), mb = new Map(b);
    const perdu = [], gagne = [];
    for (const [t, c] of ma) if ((mb.get(t) || 0) < c) perdu.push(t.slice(0, 60));
    for (const [t, c] of mb) if ((ma.get(t) || 0) < c) gagne.push(t.slice(0, 60));
    return { perdu, gagne };
  };
  const cliqueTexte = async (contenuRegex, texte) => {
    const b = await p.evaluate((re) => {
      const d = document.getElementById('frame').contentDocument;
      const n = [...d.querySelectorAll('span,p,div')].find(x => !x.children.length &&
        new RegExp(re).test((x.textContent || '').trim()) && x.getBoundingClientRect().width > 20);
      if (!n) return null;
      n.scrollIntoView({ block: 'center', behavior: 'instant' });
      return true;
    }, contenuRegex);
    if (!b) return false;
    await p.waitForTimeout(700);
    const c = await p.evaluate((re) => {
      const d = document.getElementById('frame').contentDocument;
      const n = [...d.querySelectorAll('span,p,div')].find(x => !x.children.length &&
        new RegExp(re).test((x.textContent || '').trim()) && x.getBoundingClientRect().width > 20);
      const r = n.getBoundingClientRect();
      const f = document.getElementById('frame').getBoundingClientRect();
      return { x: f.left + r.left + Math.min(20, r.width / 2), y: f.top + r.top + r.height / 2 };
    }, contenuRegex);
    await p.click('#mText');
    await p.waitForTimeout(300);
    await p.mouse.click(c.x, c.y);
    await p.waitForTimeout(500);
    await p.keyboard.press('ControlOrMeta+a');
    await p.keyboard.type(texte);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(700);
    return true;
  };

  // ---------- B1 : retouches d'échantillon ----------
  const s0 = await snap();
  const faits = [];
  // un texte descriptif (l'accroche du synopsis ou autre paragraphe)
  if (await cliqueTexte('^Le héros', 'AUDIT-TEXTE-UN.')) faits.push(['Le héros', 'AUDIT-TEXTE-UN.']);
  // un champ de fiche interpolé (espèce/rôle affiché)
  if (await cliqueTexte('^Espèce fictive', 'AUDIT-ESPECE.')) faits.push(['Espèce fictive', 'AUDIT-ESPECE.']);
  console.log('retouches texte posees :', faits.length);
  // une image de la page (la premiere grande visible)
  await p.click('#mImg');
  await p.waitForTimeout(500);
  const imgOk = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const n = [...d.querySelectorAll('img')].find(x => {
      const r = x.getBoundingClientRect();
      return r.width > 150 && r.height > 100;
    });
    if (!n) return false;
    n.scrollIntoView({ block: 'center', behavior: 'instant' });
    return true;
  });
  if (imgOk) {
    await p.waitForTimeout(700);
    const ci = await p.evaluate(() => {
      const d = document.getElementById('frame').contentDocument;
      const n = [...d.querySelectorAll('img')].find(x => {
        const r = x.getBoundingClientRect();
        return r.width > 150 && r.height > 100;
      });
      const r = n.getBoundingClientRect();
      const f = document.getElementById('frame').getBoundingClientRect();
      return { x: f.left + r.left + r.width / 2, y: f.top + r.top + r.height / 2 };
    });
    await p.mouse.click(ci.x, ci.y);
    await p.waitForTimeout(600);
    // pile possible
    if (!(await p.$eval('#ask', e => e.classList.contains('hidden')))) {
      const g = await p.$('#askGrid .gi');
      if (g) { await g.click(); await p.waitForTimeout(400); }
    }
    await p.setInputFiles('#pickImg', PNG);
    await p.waitForTimeout(1200);
    if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
      await p.click('#cropOk');
    console.log('image remplacee : oui');
  }
  await p.waitForTimeout(800);

  // ---------- B2 : rien d'autre n'a bougé ----------
  const s1 = await snap();
  const d1 = diffSnap(s0, s1);
  const attendusPerdus = ['Le héros', 'Espèce fictive'];
  const collateralPerdu = d1.perdu.filter(t => !attendusPerdus.some(a => t.startsWith(a)));
  const collateralGagne = d1.gagne.filter(t => !/^AUDIT-/.test(t));
  console.log('perdus inattendus :', collateralPerdu.length ? JSON.stringify(collateralPerdu.slice(0, 5)) : 'aucun');
  console.log('gagnes inattendus :', collateralGagne.length ? JSON.stringify(collateralGagne.slice(0, 5)) : 'aucun');

  // ---------- B3 : navigation, les retouches ne débordent pas ----------
  const boutons = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    return [...d.querySelectorAll('button')].filter(b => {
      const t = (b.textContent || '').trim().replace(/\s+/g, ' ');
      return t && t.length < 30 && b.getBoundingClientRect().width > 0;
    }).map(b => (b.textContent || '').trim().replace(/\s+/g, ' ')).slice(0, 14);
  });
  await p.click('#mView');
  await p.waitForTimeout(400);
  let debordements = 0;
  const compteAudit = () => p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    let esp = 0;
    for (const n of d.querySelectorAll('body *')) {
      if (n.children.length) continue;
      if (/AUDIT-ESPECE/.test(n.textContent || '')) esp++;
    }
    return esp;
  });
  for (const nom of boutons) {
    await p.evaluate((q) => {
      const d = document.getElementById('frame').contentDocument;
      const b = [...d.querySelectorAll('button')].find(x =>
        (x.textContent || '').trim().replace(/\s+/g, ' ') === q &&
        x.getBoundingClientRect().width > 0);
      if (b) b.click();
    }, nom);
    await p.waitForTimeout(700);
    const c = await compteAudit();
    if (c > 1) { debordements++; console.log('DEBORDEMENT apres « ' + nom + ' » : AUDIT-ESPECE x' + c); }
  }
  console.log('debordements :', debordements);

  // ---------- C : export, parité de comportement ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  const errsV = [];
  v.on('pageerror', e => { if (!/Clipboard|writeText/.test(e.message)) errsV.push(e.message); });
  await v.goto('file://' + OUT);
  await v.waitForTimeout(7000);
  const finV = await v.evaluate(() => {
    let audits = 0, esp = 0;
    for (const n of document.querySelectorAll('body *')) {
      if (n.children.length) continue;
      if (/AUDIT-TEXTE-UN/.test(n.textContent || '')) audits++;
      if (/AUDIT-ESPECE/.test(n.textContent || '')) esp++;
    }
    const img = [...document.querySelectorAll('img')].filter(x =>
      (x.getAttribute('src') || '').startsWith('data:image/png')).length;
    return { audits, esp, img };
  });
  console.log('export :', JSON.stringify(finV), '(attendu : audits>=1, esp<=1, img>=1)');
  console.log('erreurs editeur :', errs.length ? errs.slice(0, 3) : 'aucune');
  console.log('erreurs export  :', errsV.length ? errsV.slice(0, 3) : 'aucune');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
