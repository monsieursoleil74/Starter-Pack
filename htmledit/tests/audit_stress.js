/* AUDIT D — stabilité sous stress : le fichier de terrain (190 retouches),
   navigation rapide et aléatoire (mais reproductible), puis trois visites de
   chaque état de fiche : l'affichage doit être IDENTIQUE à chaque visite. */
const { chromium } = require('playwright-core');
const path = require('path');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const FICHIER = path.resolve(__dirname, 'fichier_user.html');
if (!require('fs').existsSync(FICHIER)) {
  console.log('SAUTÉ : ce test rejoue un vrai fichier (fichier_user.html), qui n’est pas versionné.');
  process.exit(0);
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => { if (!/Clipboard|writeText/.test(e.message)) errs.push(e.message); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', FICHIER);
  await p.waitForSelector('#main:not(.hidden)', { timeout: 120000 });
  await p.waitForTimeout(7000);
  await p.click('#mView');
  await p.waitForTimeout(600);

  const boutons = await p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    return [...d.querySelectorAll('button')].filter(b => {
      const t = (b.textContent || '').trim().replace(/\s+/g, ' ');
      return t && t.length < 30 && b.getBoundingClientRect().width > 0;
    }).map(b => (b.textContent || '').trim().replace(/\s+/g, ' '));
  });
  console.log('boutons :', boutons.length);

  // suite pseudo-aleatoire REPRODUCTIBLE
  let graine = 42;
  const alea = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine / 2147483648; };
  const clique = async (nom, attente) => {
    await p.evaluate((q) => {
      const d = document.getElementById('frame').contentDocument;
      const b = [...d.querySelectorAll('button')].find(x =>
        (x.textContent || '').trim().replace(/\s+/g, ' ') === q &&
        x.getBoundingClientRect().width > 0);
      if (b) { b.scrollIntoView({ block: 'center', behavior: 'instant' }); b.click(); }
    }, nom);
    await p.waitForTimeout(attente);
  };

  // ---------- 1. 40 clics rapides aléatoires ----------
  for (let i = 0; i < 40; i++) {
    const nom = boutons[Math.floor(alea() * boutons.length)];
    await clique(nom, alea() < 0.4 ? 30 : 250);   // parfois tres vite
  }
  await p.waitForTimeout(1500);
  console.log('40 clics rapides faits — erreurs :', errs.length ? errs.slice(0, 3) : 'aucune');

  // ---------- 2. déterminisme : trois visites d'un même état = même affichage ----------
  const etatFiche = () => p.evaluate(() => {
    const d = document.getElementById('frame').contentDocument;
    const out = [];
    for (const n of d.querySelectorAll('span.sc-interp')) {
      if (n.children.length || !n.getBoundingClientRect().width) continue;
      const t = (n.textContent || '').replace(/\s+/g, ' ').trim();
      if (t) out.push(t);
    }
    return out.join(' | ').slice(0, 600);
  });
  const cibles = boutons.slice(0, 8);
  let instables = 0;
  for (const nom of cibles) {
    const vus = [];
    for (let v = 0; v < 3; v++) {
      // detour par un autre bouton, puis retour
      await clique(boutons[(cibles.indexOf(nom) + 3) % boutons.length], 400);
      await clique(nom, 900);
      vus.push(await etatFiche());
    }
    if (!(vus[0] === vus[1] && vus[1] === vus[2])) {
      instables++;
      console.log('INSTABLE « ' + nom + ' » :');
      console.log('  v1:', vus[0].slice(0, 110));
      console.log('  v2:', vus[1].slice(0, 110));
      console.log('  v3:', vus[2].slice(0, 110));
    }
  }
  console.log('etats instables :', instables);
  console.log('erreurs JS finales :', errs.length ? errs.slice(0, 4) : 'aucune');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
