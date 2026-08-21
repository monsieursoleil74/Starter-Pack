/* Fabrique les fichiers d'appui PARTAGÉS par plusieurs tests (petites images,
   petites vidéos). Chaque test écrit lui-même sa maquette ; seuls ces binaires
   sont communs, et ils ne sont pas versionnés. À lancer une fois avant la
   batterie : node fixtures.js */
const { chromium } = require('playwright-core');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ici = (n) => path.resolve(__dirname, n);
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* e2e77 compare la version d'aujourd'hui à celle d'AVANT le correctif des
   retouches d'équipe : on la ressort de l'historique. */
const ANCIENNES = { 'outil_j.html': '63c18f6' };

// images : nom -> [largeur, hauteur, couleur]
const IMAGES = {
  'alt_a.png': [120, 90, '#2b6cb0'],
  'alt_b.png': [120, 90, '#b02b6c'],
  'fr_a.png': [140, 100, '#2bb06c'],
  'pipo_portrait.png': [160, 200, '#c9a227'],
  'rex_a_02.png': [130, 130, '#7a4bd1'],
  'rex_b_03.png': [130, 130, '#d14b7a'],
  'rex_c_10.png': [130, 130, '#4bd1a3'],
  'large.png': [1400, 900, '#3a3f4b'],
  'gros_visuel.png': [2200, 1400, '#1f2a36'],
};
// vidéos : nom -> nombre d'images (pour qu'elles diffèrent l'une de l'autre)
const VIDEOS = { 'vraie.webm': 7, 'seconde.webm': 11, 'clip.mp4': 5 };

(async () => {
  for (const nom of Object.keys(ANCIENNES)) {
    try {
      const t = execFileSync('git', ['show', ANCIENNES[nom] + ':htmledit/Editeur-HTML.html'],
        { cwd: path.resolve(__dirname, '..', '..'), maxBuffer: 64 * 1024 * 1024 });
      fs.writeFileSync(ici(nom), t);
      console.log(nom + ' : ' + fs.statSync(ici(nom)).size + ' octets (depuis ' + ANCIENNES[nom] + ')');
    } catch (e) {
      console.log(nom + ' : introuvable dans l’historique — e2e77 sera à sauter');
    }
  }

  const browser = await chromium.launch({ executablePath: CHROME });
  const p = await (await browser.newContext()).newPage();
  await p.goto('about:blank');

  for (const nom of Object.keys(IMAGES)) {
    const [w, h, c] = IMAGES[nom];
    const b64 = await p.evaluate(([w, h, c]) => {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const g = cv.getContext('2d');
      g.fillStyle = c; g.fillRect(0, 0, w, h);
      // un peu de bruit : deux images de même taille ne doivent pas être
      // octet pour octet identiques
      for (let i = 0; i < 40; i++) {
        g.fillStyle = 'rgba(255,255,255,' + (0.05 + (i % 7) / 40) + ')';
        g.fillRect((i * 37) % w, (i * 53) % h, 9, 9);
      }
      return cv.toDataURL('image/png').split(',')[1];
    }, [w, h, c]);
    fs.writeFileSync(ici(nom), Buffer.from(b64, 'base64'));
    console.log(nom + ' : ' + fs.statSync(ici(nom)).size + ' octets');
  }

  for (const nom of Object.keys(VIDEOS)) {
    const b64 = await p.evaluate((n) => new Promise((res, rej) => {
      const cv = document.createElement('canvas');
      cv.width = 64; cv.height = 48;
      const g = cv.getContext('2d');
      const rec = new MediaRecorder(cv.captureStream(10), { mimeType: 'video/webm' });
      const parts = [];
      rec.ondataavailable = (e) => parts.push(e.data);
      rec.onstop = () => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result.split(',')[1]);
        fr.onerror = rej;
        fr.readAsDataURL(new Blob(parts, { type: 'video/webm' }));
      };
      let t = 0;
      const it = setInterval(() => {
        g.fillStyle = t % 2 ? '#c00' : '#06c';
        g.fillRect(0, 0, 64, 48);
        if (++t > n) { clearInterval(it); rec.stop(); }
      }, 80);
      rec.start();
    }), VIDEOS[nom]);
    fs.writeFileSync(ici(nom), Buffer.from(b64, 'base64'));
    console.log(nom + ' : ' + fs.statSync(ici(nom)).size + ' octets');
  }

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
