/* Les fichiers retouchés avec les anciennes versions portent des retouches
   « héritées » : ancrées sur l'ENROBAGE du champ (le <p> autour du <span>
   interpolé) avec un « avant » qui est le résultat d'une autre retouche.
   Avant : écrire sur le <p> détruisait le <span> — la maquette ne pouvait
   plus repeindre, et le texte d'un personnage s'affichait chez TOUS les
   autres. Désormais : l'écriture descend au porteur feuille (la structure
   survit), les chaînes d'époque sont repliées et les « avant » empoisonnés
   guérissent sur leur fiche — dans l'éditeur ET dans l'export.
   Usage : node e2e74.js [chemin-outil] */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = process.argv[2] || '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const FICHIER = path.resolve(__dirname, 'fichier_user.html');
const OUT = path.resolve(__dirname, 'e2e74_export.html');
const SELF = 'section:nth-of-type(4)>div:nth-of-type(2)>div:nth-of-type(3)>div:nth-of-type(2)>p:nth-of-type(1)';
const PREF = 'body>div:nth-of-type(1)>div:nth-of-type(1)>div:nth-of-type(1)>';

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

// ce que chaque fiche doit afficher (début de description)
const ATTENDU = {
  Ringo: 'Adopté bébé dans un carton',
  Baxter: 'Bull Terrier au regard glacial',      // sa DERNIÈRE retouche (chaîne repliée)
  Cindy: 'Lévrier élevée dans une famille',      // retouche héritée guérie
  Barjola: "L'un des deux molosses",             // idem
  Mouthy: "L'autre molosse du clan",             // idem
  Dolores: 'Vieux berger allemand',              // idem
  Bill: 'Le moniteur : organisé',                // texte NATUREL (jamais retouché)
  Léa: 'Le foyer : celle avec qui',              // texte NATUREL
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 800 } });
  const errs = [];

  const verifie = async (page, dansIframe, etiquette) => {
    const clique = async (lbl) => {
      await page.evaluate(([q, ifr]) => {
        const d = ifr ? document.getElementById('frame').contentDocument : document;
        const b = [...d.querySelectorAll('button')].find(x =>
          (x.textContent || '').trim() === q && x.getBoundingClientRect().width > 0);
        if (b) { b.scrollIntoView({ block: 'center', behavior: 'instant' }); b.click(); }
      }, [lbl, dansIframe]);
      await page.waitForTimeout(900);
    };
    const lit = () => page.evaluate(([sf, pref, ifr]) => {
      const d = ifr ? document.getElementById('frame').contentDocument : document;
      const P = d.querySelector(pref + sf);
      if (!P) return { struct: false, txt: '(pas de P)' };
      return { struct: !!P.querySelector('span'),
        txt: P.textContent.replace(/\s+/g, ' ').trim() };
    }, [SELF, PREF, dansIframe]);
    const plan = [
      ['Team Ringo', 'Ringo'], ['Team Max', 'Baxter'], ['Team Max', 'Cindy'],
      ['Team Max', 'Barjola'], ['Team Max', 'Mouthy'], ['Le Camp', 'Dolores'],
      ['Le Camp', 'Bill'], ['Famille Ringo', 'Léa'],
      ['Team Ringo', 'Ringo'],   // seconde visite : rien ne doit avoir bougé
    ];
    for (const [eq, qui] of plan) {
      await clique(eq);
      await clique(qui);
      const f = await lit();
      if (!f.struct)
        fail(etiquette + ' — fiche ' + qui + ' : le <span> interpolé est DÉTRUIT (' + f.txt.slice(0, 60) + ')');
      if (f.txt.indexOf(ATTENDU[qui]) !== 0)
        fail(etiquette + ' — fiche ' + qui + ' : attendu « ' + ATTENDU[qui] + '… », affiché « ' + f.txt.slice(0, 60) + ' »');
    }
    ok(etiquette + ' : les 8 fiches affichent chacune LEUR texte, structure intacte, revisite stable');
  };

  // ---------- 1. dans l'éditeur ----------
  const p = await ctx.newPage();
  p.on('pageerror', e => { if (!/Clipboard|writeText/.test(e.message)) errs.push('[editeur] ' + e.message); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', FICHIER);
  await p.waitForSelector('#main:not(.hidden)', { timeout: 120000 });
  await p.waitForTimeout(8000);
  await p.click('#mView');
  await p.waitForTimeout(600);
  await verifie(p, true, 'éditeur');

  // ---------- 2. rééditer un champ doublonné à l'époque : la nouvelle
  //              valeur tient, même après navigation (le doublon d'enrobage
  //              ne ressuscite pas par-dessus) ----------
  const cliqueB = async (lbl) => {
    await p.evaluate((q) => {
      const d = document.getElementById('frame').contentDocument;
      const b = [...d.querySelectorAll('button')].find(x =>
        (x.textContent || '').trim() === q && x.getBoundingClientRect().width > 0);
      if (b) { b.scrollIntoView({ block: 'center', behavior: 'instant' }); b.click(); }
    }, lbl);
    await p.waitForTimeout(900);
  };
  await cliqueB('Team Ringo'); await cliqueB('Ringo');
  await p.click('#mText');
  await p.waitForTimeout(400);
  await p.evaluate(([sf, pref]) => {
    const d = document.getElementById('frame').contentDocument;
    d.querySelector(pref + sf).scrollIntoView({ block: 'center', behavior: 'instant' });
  }, [SELF, PREF]);
  await p.waitForTimeout(800);
  const pt = await p.evaluate(([sf, pref]) => {
    const d = document.getElementById('frame').contentDocument;
    const r = d.querySelector(pref + sf).getBoundingClientRect();
    const f = document.getElementById('frame').getBoundingClientRect();
    return { x: f.left + r.left + 40, y: f.top + r.top + r.height / 2 };
  }, [SELF, PREF]);
  await p.mouse.click(pt.x, pt.y);
  await p.waitForTimeout(600);
  await p.keyboard.press('ControlOrMeta+a');
  await p.keyboard.type('Nouvelle description de Ringo, version test.');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(1000);
  await p.click('#mView');
  await p.waitForTimeout(400);
  await cliqueB('Team Max'); await cliqueB('Baxter');
  await cliqueB('Team Ringo'); await cliqueB('Ringo');
  const relu = await p.evaluate(([sf, pref]) => {
    const d = document.getElementById('frame').contentDocument;
    const P = d.querySelector(pref + sf);
    return { struct: !!P.querySelector('span'), txt: P.textContent.replace(/\s+/g, ' ').trim() };
  }, [SELF, PREF]);
  if (!relu.struct) fail('réédition : le <span> interpolé a été détruit');
  if (relu.txt.indexOf('Nouvelle description de Ringo') !== 0)
    fail('réédition perdue au retour sur la fiche : « ' + relu.txt.slice(0, 60) + ' »');
  ok('réédition : la nouvelle valeur tient après navigation, le doublon d\'époque ne la vole plus');
  ATTENDU.Ringo = 'Nouvelle description de Ringo';

  // ---------- 3. l'export se comporte à l'identique ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await dl.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => { if (!/Clipboard|writeText/.test(e.message)) errs.push('[export] ' + e.message); });
  await v.goto('file://' + OUT);
  await v.waitForTimeout(8000);
  await verifie(v, false, 'export');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
