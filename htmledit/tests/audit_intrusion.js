/* AUDIT A — non-intrusion : la maquette ouverte dans l'éditeur, SANS aucune
   retouche, doit se comporter exactement comme ouverte seule. On navigue
   partout des deux côtés, et on compare tous les textes à chaque étape. */
const { chromium } = require('playwright-core');
const path = require('path');

const MAQ = path.resolve(__dirname, process.argv[3] || 'maq_ronds.html');
if (!require('fs').existsSync(MAQ)) {
  console.log('SAUTÉ : ce test rejoue un vrai fichier (maq_ronds.html), qui n’est pas versionné.');
  process.exit(0);
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  // page témoin : la maquette brute
  const brute = await ctx.newPage();
  const errB = [];
  brute.on('pageerror', e => errB.push(e.message));
  await brute.goto('file://' + MAQ);
  await brute.waitForTimeout(6000);

  // page éditeur : la même maquette dans l'outil, mode Aperçu, zéro retouche
  const ed = await ctx.newPage();
  const errE = [];
  ed.on('pageerror', e => errE.push(e.message));
  await ed.goto('file://' + (process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html'));
  await ed.setInputFiles('#pick', MAQ);
  await ed.waitForSelector('#main:not(.hidden)', { timeout: 120000 });
  await ed.waitForTimeout(6000);
  await ed.click('#mView');
  await ed.waitForTimeout(600);

  // les boutons de navigation, identifiés pareil des deux côtés
  const listeBoutons = (doc) => {
    return [...doc.querySelectorAll('button')].filter(b => {
      const t = (b.textContent || '').trim().replace(/\s+/g, ' ');
      return t && t.length < 30 && b.getBoundingClientRect().width > 0;
    }).map(b => (b.textContent || '').trim().replace(/\s+/g, ' '));
  };
  const snapshot = (doc) => {
    const out = [];
    for (const n of doc.querySelectorAll('body *')) {
      if (n.children.length || /^(SCRIPT|STYLE)$/.test(n.tagName)) continue;
      const t = (n.textContent || '').replace(/\s+/g, ' ').trim();
      if (t) out.push(t);
    }
    return out;
  };
  const clique = async (page, dansIframe, nom, idx) => {
    return page.evaluate(([q, i, ifr]) => {
      const d = ifr ? document.getElementById('frame').contentDocument : document;
      const cands = [...d.querySelectorAll('button')].filter(b =>
        (b.textContent || '').trim().replace(/\s+/g, ' ') === q &&
        b.getBoundingClientRect().width > 0);
      const b = cands[i] || cands[0];
      if (!b) return false;
      b.click();
      return true;
    }, [nom, idx, dansIframe]);
  };

  const boutons = await brute.evaluate(() => {
    return [...document.querySelectorAll('button')].filter(b => {
      const t = (b.textContent || '').trim().replace(/\s+/g, ' ');
      return t && t.length < 30 && b.getBoundingClientRect().width > 0;
    }).map(b => (b.textContent || '').trim().replace(/\s+/g, ' '));
  });
  console.log('boutons de navigation reperes :', boutons.length);

  let ecarts = 0;
  const compare = async (etape) => {
    const sB = await brute.evaluate(() => {
      const out = [];
      for (const n of document.querySelectorAll('body *')) {
        if (n.children.length || /^(SCRIPT|STYLE)$/.test(n.tagName)) continue;
        const t = (n.textContent || '').replace(/\s+/g, ' ').trim();
        if (t) out.push(t);
      }
      return out;
    });
    const sE = await ed.evaluate(() => {
      const d = document.getElementById('frame').contentDocument;
      const out = [];
      for (const n of d.querySelectorAll('body *')) {
        if (n.children.length || /^(SCRIPT|STYLE)$/.test(n.tagName)) continue;
        const t = (n.textContent || '').replace(/\s+/g, ' ').trim();
        if (t) out.push(t);
      }
      return out;
    });
    const bs = new Map(); sB.forEach(t => bs.set(t, (bs.get(t) || 0) + 1));
    const es = new Map(); sE.forEach(t => es.set(t, (es.get(t) || 0) + 1));
    const manque = [], ajoute = [];
    for (const [t, c] of bs) if ((es.get(t) || 0) < c) manque.push(t.slice(0, 70));
    for (const [t, c] of es) if ((bs.get(t) || 0) < c) ajoute.push(t.slice(0, 70));
    if (manque.length || ajoute.length) {
      ecarts++;
      console.log('ECART [' + etape + ']');
      if (manque.length) console.log('  absent cote editeur :', JSON.stringify(manque.slice(0, 4)));
      if (ajoute.length) console.log('  en trop cote editeur :', JSON.stringify(ajoute.slice(0, 4)));
    }
  };

  await compare('chargement');
  // naviguer sur un echantillon (jusqu'a 20 boutons), en parallele des deux cotes
  const vus = new Set();
  let n = 0;
  for (let i = 0; i < boutons.length && n < 20; i++) {
    const nom = boutons[i];
    const cle = nom + '#' + (vus.has(nom) ? 1 : 0);
    if (vus.has(cle)) continue;
    vus.add(cle); n++;
    const okB = await clique(brute, false, nom, 0);
    const okE = await clique(ed, true, nom, 0);
    if (!okB || !okE) continue;
    await brute.waitForTimeout(700);
    await ed.waitForTimeout(700);
    await compare('clic « ' + nom + ' »');
  }
  console.log('---');
  console.log('etapes en ecart :', ecarts);
  console.log('erreurs JS brute :', errB.length ? errB.slice(0, 3) : 'aucune');
  console.log('erreurs JS editeur :', errE.length ? errE.slice(0, 3) : 'aucune');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
