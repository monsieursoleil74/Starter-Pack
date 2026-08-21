/* Deux points : coller du texte garde le style du site, et une image liée à
   un contenu (alt) ne déborde pas sur les autres. */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TOOL = '/home/user/Starter-Pack/htmledit/Editeur-HTML.html';
const MAQ = path.resolve(__dirname, 'maq_persos.html');
const IMG1 = path.resolve(__dirname, 'rempl1.png');
const OUT = path.resolve(__dirname, 'persos_modifie.html');

function fail(m) { console.error('ECHEC : ' + m); process.exit(1); }
function ok(m) { console.log('OK : ' + m); }

// une fiche perso réutilisée : seul le alt de l'image change selon l'onglet
fs.writeFileSync(MAQ, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Persos</title>
<style>body{font-family:sans-serif;padding:24px;background:#1e2a1e;color:#eee}
h2{font-size:22px}img{width:240px;height:160px;object-fit:cover;background:#456}
button{margin:4px;padding:8px 14px}</style></head><body>
<div><button id="bp">Pipo</button><button id="bb">Bruno</button></div>
<h2 id="titre">Pipo</h2>
<img id="fiche" alt="Pipo" src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==">
<p id="desc">Description originale.</p>
<script>
  var img = document.getElementById('fiche');
  var base = img.getAttribute('src');
  function show(nom) {
    document.getElementById('titre').textContent = nom;
    img.setAttribute('alt', nom);
    img.setAttribute('src', base);       // la maquette réécrit toujours la source
  }
  document.getElementById('bp').onclick = function () { show('Pipo'); };
  document.getElementById('bb').onclick = function () { show('Bruno'); };
</script></body></html>`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 850 } });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + TOOL);
  await p.setInputFiles('#pick', MAQ);
  await p.waitForSelector('#main:not(.hidden)');
  await p.waitForTimeout(1200);
  const fr = p.frameLocator('#frame');

  // ---------- 1. coller du texte formaté ----------
  await fr.locator('#desc').click();
  await p.waitForTimeout(400);
  await p.keyboard.press('Control+a');
  // presse-papiers riche, comme depuis Google Docs
  await p.evaluate(() => navigator.clipboard.writeText('Texte collé depuis Docs'));
  await p.evaluate(() => {
    const d = document.querySelector('#frame').contentDocument;
    const n = d.getElementById('desc');
    const dt = new DataTransfer();
    dt.setData('text/plain', 'Texte collé depuis Docs');
    dt.setData('text/html', '<span style="font-size:48pt;color:#ff0000;font-family:Georgia">Texte collé depuis Docs</span>');
    n.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
  });
  await p.waitForTimeout(400);
  await fr.locator('#titre').click();
  await p.waitForTimeout(500);
  const colle = await fr.locator('#desc').evaluate(n => ({
    txt: n.textContent.trim(), html: n.innerHTML,
    taille: getComputedStyle(n).fontSize
  }));
  if (colle.txt !== 'Texte collé depuis Docs') fail('texte collé : ' + colle.txt);
  if (/font-size|<span|Georgia|color/i.test(colle.html)) fail('la mise en forme a suivi : ' + colle.html);
  ok('collage : le texte arrive nu, au style du site (' + colle.taille + ')');

  // ---------- 2. image liée au personnage affiché ----------
  await p.keyboard.press('Escape');
  await p.click('#mImg');
  await p.waitForTimeout(500);
  await fr.locator('#fiche').click();
  await p.waitForTimeout(400);
  // le clic ouvre le cadrage : le remplacement se demande
  if (!(await p.$eval('#crop', e => e.classList.contains('hidden'))))
    await p.click('#cropRemp').catch(() => {});
  await p.setInputFiles('#pickImg', IMG1);
  await p.waitForTimeout(700);
  const srcPipo = await fr.locator('#fiche').getAttribute('src');
  if (srcPipo.indexOf('data:image/png') !== 0) fail('image non remplacée');
  const etiquette = await p.$$eval('#list .it span', ns => ns[ns.length - 1].textContent);
  if (!/Pipo/.test(etiquette)) fail('la retouche ne mentionne pas le personnage : ' + etiquette);
  ok('image de Pipo remplacée, retouche liée à « Pipo » (' + etiquette + ')');

  // on passe à Bruno : son image ne doit PAS être celle de Pipo
  await p.click('#mView');
  await p.waitForTimeout(300);
  await fr.locator('#bb').click();
  await p.waitForTimeout(900);
  const srcBruno = await fr.locator('#fiche').getAttribute('src');
  const altBruno = await fr.locator('#fiche').getAttribute('alt');
  if (altBruno !== 'Bruno') fail('la maquette n’a pas changé de personnage');
  if (srcBruno === srcPipo) fail('l’image de Pipo a débordé sur Bruno');
  ok('Bruno garde son visuel : la retouche ne déborde pas');

  // retour à Pipo : son image revient
  await fr.locator('#bp').click();
  await p.waitForTimeout(900);
  if (await fr.locator('#fiche').getAttribute('src') !== srcPipo) fail('l’image de Pipo n’est pas revenue');
  ok('retour sur Pipo : son visuel est bien là');

  // ---------- 3. et dans le fichier exporté ----------
  const [d] = await Promise.all([p.waitForEvent('download'), p.click('#save')]);
  await d.saveAs(OUT);
  const v = await ctx.newPage();
  v.on('pageerror', e => errs.push('[export] ' + e.message));
  await v.goto('file://' + OUT);
  await v.waitForTimeout(1200);
  const e1 = await v.evaluate(() => document.getElementById('fiche').getAttribute('src').slice(0, 14));
  await v.click('#bb');
  await v.waitForTimeout(900);
  const e2 = await v.evaluate(() => ({
    src: document.getElementById('fiche').getAttribute('src').slice(0, 14),
    alt: document.getElementById('fiche').getAttribute('alt')
  }));
  if (e1 !== 'data:image/png') fail('export : Pipo n’a pas son image (' + e1 + ')');
  if (e2.alt !== 'Bruno') fail('export : le changement de perso ne marche plus');
  if (e2.src === 'data:image/png') fail('export : l’image de Pipo déborde sur Bruno');
  ok('fichier exporté : chaque personnage garde son visuel');

  if (errs.length) fail('erreurs JS :\n' + errs.join('\n'));
  ok('aucune erreur JS');
  console.log('\nTOUS LES TESTS PASSENT');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
