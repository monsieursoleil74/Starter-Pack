/* Convertisseur : PDF (export Google Slides) -> page HTML interactive.
   Tout se passe dans le navigateur : pdf.js rend chaque page en JPEG, les
   liens du PDF deviennent des zones cliquables, et le tout est écrit dans un
   fichier HTML qui embarque son propre éditeur (viewer.js). */
(function () {
'use strict';

var APP_VERSION = '4.5.0';
var $ = function (id) { return document.getElementById(id); };

/* pdf.js a besoin d'un worker : on le sert depuis un blob, aucun fichier
   externe à charger — c'est ce qui permet de marcher en double-clic (file://). */
pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
  new Blob([$('pdf-worker').textContent], { type: 'text/javascript' }));

var state = { pdf: null, pptx: null, deck: null, width: 1600, quality: 0.85, busy: false, url: null };

/* WebP : mêmes pixels, fichier bien plus léger. Encodé par le navigateur
   lui-même, en local — repli JPEG si le navigateur ne sait pas l'écrire. */
var WEBP = (function () {
  var c = document.createElement('canvas');
  c.width = c.height = 2;
  return c.toDataURL('image/webp').indexOf('data:image/webp') === 0;
})();

/* ---------------- utilitaires ---------------- */

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
  });
}
function r2(n) { return Math.round(n * 100) / 100; }
function baseName(name) { return name.replace(/\.[^.]+$/, ''); }
function safeName(s) { return (s || 'presentation').replace(/[\\\/:*?"<>|]/g, '_').trim() || 'presentation'; }
function log(msg, cls) {
  var d = document.createElement('div');
  if (cls) d.className = cls;
  d.textContent = msg;
  $('log').appendChild(d);
  $('log').scrollTop = $('log').scrollHeight;
}
function progress(f) { $('barIn').style.width = Math.round(f * 100) + '%'; }
function ytEmbed(u) {
  var m = String(u || '').match(
    /(?:youtube\.com\/(?:watch\?\S*?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? 'https://www.youtube.com/embed/' + m[1] : null;
}
/* laisse respirer l'interface entre deux pages */
function tick() { return new Promise(function (r) { setTimeout(r, 0); }); }

/* ---------------- fichiers déposés ---------------- */

function setFiles(list) {
  if (state.busy) return;
  var rejected = 0;
  Array.prototype.forEach.call(list, function (f) {
    var n = f.name.toLowerCase();
    if (n.endsWith('.pdf')) state.pdf = f;
    else if (n.endsWith('.pptx')) state.pptx = f;
    else if (n.endsWith('.html') || n.endsWith('.htm')) state.deck = f;
    else rejected++;
  });
  if (rejected) log(rejected + ' fichier(s) ignoré(s) — dépose un .pdf, et si tu veux un .pptx ou ton .html déjà édité.', 'err');
  if (state.pdf && !$('title').value.trim()) $('title').value = baseName(state.pdf.name);
  renderFiles();
  if (!state.pdf) {
    $('prog').classList.remove('hidden');
    log('Il manque le PDF : dans Google Slides, Fichier → Télécharger → Document PDF (.pdf). ' +
        'Le .pptx seul ne suffit pas, il ne sert qu’aux notes.', 'err');
    return;
  }
  convert();
}

function renderFiles() {
  var box = $('files');
  box.innerHTML = '';
  [['pdf', 'PDF', 'diapos'], ['pptx', 'PPTX', 'notes + objets'],
   ['deck', 'HTML', 'réglages repris']].forEach(function (kind) {
    var f = state[kind[0]];
    if (!f) return;
    var c = document.createElement('span');
    c.className = 'chip' + (kind[0] === 'pdf' ? ' pdf' : '');
    c.innerHTML = '<b>' + esc(kind[1]) + '</b> ' + esc(f.name) +
      ' <span style="color:#5c6274">· ' + kind[2] + '</span>';
    var x = document.createElement('button');
    x.textContent = '✕';
    x.title = 'Retirer';
    x.onclick = function (e) {
      e.stopPropagation();
      state[kind[0]] = null;
      renderFiles();
      $('go').disabled = !state.pdf;
    };
    c.appendChild(x);
    box.appendChild(c);
  });
  $('go').disabled = !state.pdf || state.busy;
}

/* ---------------- liens du PDF -> zones cliquables ---------------- */

async function pageZones(pdf, page, vp) {
  var anns = [];
  try { anns = await page.getAnnotations({ intent: 'display' }); } catch (e) { return []; }
  var out = [];
  for (var i = 0; i < anns.length; i++) {
    var a = anns[i];
    if (a.subtype !== 'Link' || !a.rect) continue;
    var r = vp.convertToViewportRectangle(a.rect);
    var x = Math.min(r[0], r[2]) / vp.width * 100,
        y = Math.min(r[1], r[3]) / vp.height * 100,
        w = Math.abs(r[2] - r[0]) / vp.width * 100,
        h = Math.abs(r[3] - r[1]) / vp.height * 100;
    if (w < 0.4 || h < 0.4) continue;
    var act = null;
    if (a.url) {
      var yt = ytEmbed(a.url);
      act = yt ? { action: 'video', video: { url: yt } } : { action: 'url', url: a.url };
    } else if (a.dest) {
      try {
        var d = typeof a.dest === 'string' ? await pdf.getDestination(a.dest) : a.dest;
        if (d && d[0]) act = { action: 'goto', slide: await pdf.getPageIndex(d[0]) };
      } catch (e) { /* destination illisible : on ignore ce lien */ }
    }
    if (!act) continue;
    act.type = 'zone';
    act.x = r2(x); act.y = r2(y); act.w = r2(w); act.h = r2(h);
    act.look = 'hover';
    act.hover = 'light';   // le bouton dessiné dans Slides s'éclaircit au survol
    out.push(act);
  }
  return dedupe(out);
}

/* ---------------- texte du PDF -> candidats boutons ----------------
   pdf.js sait où sont les glyphes : on reconstruit des lignes de texte avec
   leur boîte EXACTE. C'est ce qui permet de faire d'un texte le bouton
   lui-même, au lieu de la grande boîte de texte qui l'entoure. */
async function pageTexts(page, vp) {
  var tc;
  try { tc = await page.getTextContent(); } catch (e) { return []; }
  var lines = [];
  tc.items.forEach(function (it) {
    if (!it.str || !it.str.trim()) return;
    var t = pdfjsLib.Util.transform(vp.transform, it.transform);
    var fh = Math.hypot(t[2], t[3]);                  // hauteur de police à l'écran
    var w = (it.width || 0) * vp.scale;
    if (fh < 7 || w < 6) return;                      // trop petit pour un bouton
    var x = t[4], base = t[5];
    // même ligne de base et collé au morceau précédent : même ligne visuelle
    for (var i = 0; i < lines.length; i++) {
      var L = lines[i];
      if (Math.abs(L.base - base) < fh * 0.4 &&
          x - (L.x + L.w) < fh * 1.2 && x + w > L.x - fh * 1.2) {
        var x2 = Math.max(L.x + L.w, x + w);
        L.x = Math.min(L.x, x); L.w = x2 - L.x;
        L.top = Math.min(L.top, base - fh * 0.84);
        L.h = Math.max(L.h, fh * 1.06);
        L.txt += it.str;
        return;
      }
    }
    lines.push({ x: x, top: base - fh * 0.84, w: w, h: fh * 1.06, base: base, txt: it.str });
  });
  var out = [];
  lines.forEach(function (L) {
    var txt = L.txt.replace(/\s+/g, ' ').trim();
    if (txt.length < 2 || txt.length > 80) return;    // ni miette, ni paragraphe
    var pad = L.h * 0.22;                             // l'air autour du texte
    var o = { x: r2((L.x - pad) / vp.width * 100), y: r2((L.top - pad) / vp.height * 100),
              w: r2((L.w + pad * 2) / vp.width * 100), h: r2((L.h + pad * 2) / vp.height * 100),
              kind: 'ligne', label: txt.slice(0, 60) };
    if (o.w > 1 && o.h > 0.8 && o.w < 98) out.push(o);
  });
  return out.slice(0, 60);
}

/* Slides pose souvent un lien par morceau de texte : on fusionne les doublons
   qui visent la même cible et se recouvrent. */
function key(z) { return z.action + '|' + (z.url || (z.video && z.video.url) || z.slide); }
function overlaps(a, b) {
  var ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  var iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (ix <= 0 || iy <= 0) return false;
  return ix * iy > 0.5 * Math.min(a.w * a.h, b.w * b.h);
}
function dedupe(zones) {
  var out = [];
  zones.forEach(function (z) {
    for (var i = 0; i < out.length; i++) {
      if (key(out[i]) === key(z) && overlaps(out[i], z)) {
        var o = out[i];                       // on garde l'enveloppe des deux
        var x2 = Math.max(o.x + o.w, z.x + z.w), y2 = Math.max(o.y + o.h, z.y + z.h);
        o.x = r2(Math.min(o.x, z.x)); o.y = r2(Math.min(o.y, z.y));
        o.w = r2(x2 - o.x); o.h = r2(y2 - o.y);
        return;
      }
    }
    out.push(z);
  });
  return out;
}

/* ---------------- notes du présentateur (.pptx) ---------------- */

function localEls(node, local) {
  return Array.prototype.filter.call(node.getElementsByTagName('*'), function (e) {
    return e.localName === local;
  });
}
function relAttr(el, local) {
  for (var i = 0; i < el.attributes.length; i++) {
    var a = el.attributes[i];
    if (a.localName === local && (a.namespaceURI || '').indexOf('relationships') > 0) return a.value;
  }
  return null;
}
function resolvePath(base, target) {
  var parts = base.split('/').slice(0, -1);
  target.split('/').forEach(function (p) {
    if (p === '..') parts.pop();
    else if (p !== '.' && p !== '') parts.push(p);
  });
  return parts.join('/');
}

/* Ouvre le .pptx une fois : accès XML, ordre réel des diapos, taille de page. */
function pptxOpen(zip) {
  var dec = new TextDecoder('utf-8');
  var parser = new DOMParser();
  var xml = function (path) {
    if (!zip[path]) return null;
    var d = parser.parseFromString(dec.decode(zip[path]), 'application/xml');
    return d.getElementsByTagName('parsererror').length ? null : d;
  };
  var pres = xml('ppt/presentation.xml'), presRels = xml('ppt/_rels/presentation.xml.rels');
  if (!pres || !presRels) return null;

  var rel = {};
  localEls(presRels, 'Relationship').forEach(function (r) {
    rel[r.getAttribute('Id')] = r.getAttribute('Target');
  });
  // ordre réel des diapos : sldIdLst, pas le numéro de fichier
  var slidePaths = localEls(pres, 'sldId').map(function (s) {
    var t = rel[relAttr(s, 'id')];
    return t ? resolvePath('ppt/presentation.xml', t) : null;
  });
  var sz = localEls(pres, 'sldSz')[0];
  return {
    xml: xml,
    slidePaths: slidePaths,
    sw: sz ? +sz.getAttribute('cx') : 0,
    sh: sz ? +sz.getAttribute('cy') : 0
  };
}

/* Les formes du .pptx deviennent des « objets » : des rectangles déjà
   positionnés que l'éditeur propose de transformer en boutons d'un clic.
   On ne lit que les formes de premier niveau ayant leur propre position ;
   un groupe est renvoyé comme un seul objet (son cadre). */
function slideObjects(doc, sw, sh) {
  var tree = localEls(doc, 'spTree')[0];
  if (!tree || !sw || !sh) return [];
  var out = [];
  Array.prototype.forEach.call(tree.children, function (node) {
    var kind = node.localName;
    if (['sp', 'pic', 'graphicFrame', 'grpSp', 'cxnSp'].indexOf(kind) < 0) return;
    var xfrm = null;
    Array.prototype.forEach.call(node.children, function (c) {
      if (xfrm) return;
      if (c.localName === 'xfrm') xfrm = c;                        // graphicFrame
      else if (c.localName === 'spPr' || c.localName === 'grpSpPr')
        xfrm = localEls(c, 'xfrm')[0] || null;
    });
    if (!xfrm) return;                    // position héritée du modèle : incalculable ici
    var off = localEls(xfrm, 'off')[0], ext = localEls(xfrm, 'ext')[0];
    if (!off || !ext) return;
    var w = +ext.getAttribute('cx') / sw * 100, h = +ext.getAttribute('cy') / sh * 100;
    if (!(w > 0.8 && h > 0.8)) return;                  // miettes
    if (w > 97 && h > 97) return;                       // fond de page
    var text = localEls(node, 't').map(function (t) { return t.textContent; }).join(' ').trim();
    var geom = localEls(node, 'prstGeom')[0];
    var o = {
      x: r2(+off.getAttribute('x') / sw * 100),
      y: r2(+off.getAttribute('y') / sh * 100),
      w: r2(w), h: r2(h),
      kind: kind === 'pic' ? 'image' : (text ? 'text' : 'shape'),
      label: text.slice(0, 60)
    };
    // une forme ronde dans Slides doit donner une zone ronde, pas un rectangle
    if (geom && geom.getAttribute('prst') === 'ellipse') o.ellipse = true;
    out.push(o);
  });
  return out;
}

function extractObjects(idx, count) {
  var out = idx.slidePaths.map(function (sp) {
    var d = sp ? idx.xml(sp) : null;
    return d ? slideObjects(d, idx.sw, idx.sh) : [];
  });
  while (out.length < count) out.push([]);
  return out;
}

function extractNotes(idx, count) {
  var xml = idx.xml;
  var notes = [];
  idx.slidePaths.forEach(function (sp) {
    var txt = '';
    if (sp) {
      var srels = xml(sp.replace(/([^\/]+)$/, '_rels/$1.rels'));
      var npath = null;
      if (srels) {
        localEls(srels, 'Relationship').forEach(function (r) {
          if ((r.getAttribute('Type') || '').endsWith('/notesSlide'))
            npath = resolvePath(sp, r.getAttribute('Target'));
        });
      }
      var nd = npath ? xml(npath) : null;
      if (nd) txt = notesText(nd);
    }
    notes.push(txt);
  });
  while (notes.length < count) notes.push('');
  return notes;
}

function notesText(doc) {
  var best = '';
  localEls(doc, 'sp').forEach(function (sp) {
    // on saute le pavé « numéro de diapo »
    var ph = localEls(sp, 'ph')[0];
    if (ph && ph.getAttribute('type') !== 'body') return;
    if (localEls(sp, 'fld').some(function (f) { return f.getAttribute('type') === 'slidenum'; })) return;
    var txt = localEls(sp, 'p').map(function (p) {
      return localEls(p, 't').map(function (t) { return t.textContent; }).join('');
    }).join('\n').trim();
    if (txt.length > best.length) best = txt;
  });
  return best;
}

/* ---------------- reprise d'un pack déjà édité ---------------- */

/* Le HTML produit ne contient que trois balises : on relit sa configuration
   pour transplanter le travail d'interactivité sur les nouvelles pages.
   ('<\/' dans le JSON est un échappement valide, JSON.parse le gère.) */
function readDeck(txt) {
  var grab = function (id) {
    var m = txt.match(new RegExp('<script type="application/json" id="' + id + '">([\\s\\S]*?)<\\/script>'));
    if (!m) return null;
    try { return JSON.parse(m[1]); } catch (e) { return null; }
  };
  var cfg = grab('cfg'), assets = grab('assets');
  if (!cfg || !cfg.slides) return null;
  return { cfg: cfg, assets: assets || { images: [], media: {} } };
}

/* Transplante l'ancien travail sur les nouvelles pages, et nettoie les
   renvois devenus impossibles (page supprimée depuis). */
function mergeDeck(old, n, images, zones, notes, objects, ars) {
  var meta = old.cfg.meta || {};
  var oldSlides = old.cfg.slides || [];
  var perdues = Math.max(0, oldSlides.length - n);
  var slides = images.map(function (_, i) {
    var o = oldSlides[i] || {};
    return {
      img: i,
      name: o.name,
      ar: ars ? ars[i] : o.ar,
      cover: o.cover,
      notes: (notes && notes[i]) || o.notes || '',
      hidden: !!o.hidden,
      // les liens du nouveau PDF ne sont repris que là où rien n'existait
      elements: (o.elements && o.elements.length) ? o.elements : (zones[i] || []),
      objects: (objects && objects[i] && objects[i].length) ? objects[i] : o.objects
    };
  });

  var coupes = 0;
  var okSlide = function (v) { return typeof v === 'number' && v >= 0 && v < n; };
  var cleanEl = function (e) {
    if (e.action === 'goto' || e.action === 'panel' || e.action === 'overlay') {
      if (typeof e.slide === 'number' && e.slide !== -2 && !okSlide(e.slide)) {
        e.slide = n - 1; coupes++;
      }
    }
    if (e.list) {
      var avant = e.list.length;
      e.list = e.list.filter(okSlide);
      coupes += avant - e.list.length;
    }
    if (e.type === 'panel' && typeof e.slide === 'number' && !okSlide(e.slide)) {
      delete e.slide; coupes++;
    }
    // pages d'un élément commun : sans page valide il disparaîtrait partout,
    // on le remet donc sur toutes
    if (e.pages) {
      var avantP = e.pages.length;
      e.pages = e.pages.filter(okSlide);
      coupes += avantP - e.pages.length;
      if (!e.pages.length) delete e.pages;
    }
  };
  slides.forEach(function (sl) { sl.elements.forEach(cleanEl); });
  (meta.master || []).forEach(cleanEl);
  if (meta.nav) {
    var avantNav = meta.nav.length;
    meta.nav = meta.nav.filter(function (it) { return okSlide(it.slide); });
    coupes += avantNav - meta.nav.length;
  }
  return { meta: meta, slides: slides, perdues: perdues, coupes: coupes };
}

/* ---------------- fabrication du HTML ---------------- */

function buildHtml(title, images, zones, notes, objects, old, ars) {
  var cfg, media = {};
  if (old) {
    var m = mergeDeck(old, images.length, images, zones, notes, objects, ars);
    cfg = { meta: m.meta, slides: m.slides };
    cfg.meta.title = title;
    cfg.meta.locked = false;
    cfg.meta.app = APP_VERSION;
    media = (old.assets && old.assets.media) || {};
    log('Réglages repris de ton HTML : boutons, panneaux, diapos cachées, sommaire.');
    if (m.perdues)
      log(m.perdues + ' page(s) en trop dans l’ancien pack : leur travail est perdu ' +
          '(le nouveau PDF en compte ' + images.length + ').', 'err');
    if (m.coupes)
      log(m.coupes + ' renvoi(s) pointaient vers une page disparue — corrigés, à vérifier.', 'err');
  } else {
    cfg = {
      // par défaut on lit un SITE, pas un document : ni compteur, ni barre de
      // progression, ni vignettes, ni entête. Le clavier reste actif pour ne
      // bloquer personne tant qu'aucun bouton n'a été posé.
      meta: { title: title, lang: 'fr', embed: true, locked: false, app: APP_VERSION,
              // pas de fondu par défaut : on passe d'une page à l'autre net,
              // comme sur un site — la transition se choisit dans l'éditeur
              transition: 'none',
              view: { arrows: true, counter: false, progress: false,
                      thumbs: false, header: false, full: true } },
      slides: images.map(function (_, i) {
        var s = { img: i, ar: ars ? ars[i] : undefined,
                  notes: notes[i] || '', hidden: false, elements: zones[i] || [] };
        // formes repérées dans le .pptx : des candidats à transformer en boutons
        if (objects && objects[i] && objects[i].length) s.objects = objects[i];
        return s;
      })
    };
  }
  var assets = { images: images, media: media };
  if (WEBP) assets.imgMime = 'image/webp';
  var j = function (o) { return JSON.stringify(o).replace(/<\//g, '<\\/'); };
  return '<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + esc(title) + '</title>\n</head>\n<body>\n' +
    '<script type="application/json" id="cfg">' + j(cfg) + '<\/script>\n' +
    '<script type="application/json" id="assets">' + j(assets) + '<\/script>\n' +
    '<script id="app-src">' + $('viewer-src').textContent + '<\/script>\n' +
    '</body>\n</html>';
}

/* ---------------- conversion ---------------- */

async function convert() {
  if (state.busy || !state.pdf) return;
  state.busy = true;
  $('go').disabled = true;
  $('go').textContent = 'Conversion…';
  $('done').classList.add('hidden');
  $('prog').classList.remove('hidden');
  $('log').innerHTML = '';
  progress(0);
  if (state.url) { URL.revokeObjectURL(state.url); state.url = null; }

  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d', { alpha: false });
  try {
    var pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(await state.pdf.arrayBuffer()),
      isEvalSupported: false
    }).promise;
    var n = pdf.numPages;
    log(n + ' diapo(s) à rendre…');

    var images = [], zones = [], ars = [], texts = [], nz = 0, nt = 0;
    for (var i = 1; i <= n; i++) {
      var page = await pdf.getPage(i);
      var scale = state.width / page.getViewport({ scale: 1 }).width;
      var vp = page.getViewport({ scale: scale });
      canvas.width = Math.round(vp.width);
      canvas.height = Math.round(vp.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      images.push(canvas.toDataURL(WEBP ? 'image/webp' : 'image/jpeg', state.quality).split(',')[1]);
      ars.push(Math.round(vp.width / vp.height * 1e4) / 1e4);   // format réel de la page
      var z = await pageZones(pdf, page, vp);
      nz += z.length;
      zones.push(z);
      var tl = await pageTexts(page, vp);
      nt += tl.length;
      texts.push(tl);
      progress(i / n * 0.92);
      if (i === 1 || i % 5 === 0 || i === n) log('Diapo ' + i + ' / ' + n);
      await tick();
    }
    log(WEBP ? 'Images encodées en WebP — même qualité, fichier nettement plus léger'
             : 'Ce navigateur ne sait pas écrire le WebP : images en JPEG (rien d’autre ne change)');
    if (nz) log(nz + ' lien(s) du PDF converti(s) en zones cliquables');
    if (nt) log(nt + ' texte(s) repéré(s) — « ⌖ Objets » dans l’éditeur les transforme en boutons, au pixel près');
    // des pages de formats différents : ça se voit à la lecture, on prévient
    var arCounts = {};
    ars.forEach(function (a) { arCounts[a] = (arCounts[a] || 0) + 1; });
    if (Object.keys(arCounts).length > 1)
      log('⚠ Les pages du PDF n’ont pas toutes le même format — certaines paraîtront ' +
          'plus petites. L’éditeur propose « recadrer au format du pack » sur ces pages.', 'err');

    var notes = [], objects = [];
    if (state.pptx) {
      try {
        var zip = fflate.unzipSync(new Uint8Array(await state.pptx.arrayBuffer()));
        var idx = pptxOpen(zip);
        if (!idx) throw new Error('structure du .pptx illisible');
        notes = extractNotes(idx, n);
        var got = notes.filter(function (t) { return t; }).length;
        log(got ? got + ' note(s) du présentateur récupérée(s)' : 'Aucune note trouvée dans le .pptx');
        objects = extractObjects(idx, n);
        var nb = objects.reduce(function (a, o) { return a + o.length; }, 0);
        if (nb) log(nb + ' objet(s) du .pptx repérés — dans l’éditeur, « ⌖ Objets » ' +
                    'les transforme en boutons d’un clic');
        if (notes.length !== n)
          log('Le .pptx a ' + notes.length + ' diapo(s) et le PDF ' + n + ' — vérifie que les deux exports correspondent.', 'err');
      } catch (e) {
        log('Lecture du .pptx incomplète (' + e.message + ') — le reste est bon.', 'err');
      }
    }

    // candidats d'une page = formes du .pptx + lignes de texte du PDF
    var candidats = images.map(function (_, i2) {
      return ((objects[i2] || [])).concat(texts[i2] || []);
    });

    var old = null;
    if (state.deck) {
      old = readDeck(await state.deck.text());
      if (!old) log('Le .html déposé n’est pas un pack produit par cet outil — ignoré.', 'err');
    }
    var title = $('title').value.trim() || baseName(state.pdf.name) || 'Présentation';
    var html = buildHtml(title, images, zones, notes, candidats, old, ars);
    progress(1);

    state.url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    var dl = $('dl');
    dl.href = state.url;
    dl.download = safeName(title) + '.html';
    $('doneMsg').innerHTML = n + ' diapos · ' + (html.length / 1048576).toFixed(1) +
      ' Mo · <b>' + esc(dl.download) + '</b><br>' +
      'Ouvre-le dans ton navigateur, puis appuie sur <b>E</b> pour dessiner des boutons, ' +
      'cacher des diapos et ajouter des vidéos. <b>💾 Enregistrer</b>, dans la page, ' +
      'te redonne le fichier à jour.';
    $('done').classList.remove('hidden');
    log('Terminé.');
  } catch (e) {
    log('Échec : ' + (e && e.message ? e.message : e), 'err');
    log('Vérifie que le fichier est bien un PDF exporté depuis Google Slides.', 'err');
    progress(0);
  } finally {
    canvas.width = canvas.height = 0;
    state.busy = false;
    $('go').textContent = 'Reconvertir';
    $('go').disabled = !state.pdf;
  }
}

/* ---------------- branchements ---------------- */

var drop = $('drop');
drop.addEventListener('click', function () { $('pick').click(); });
$('pick').addEventListener('change', function (e) { setFiles(e.target.files); e.target.value = ''; });
['dragenter', 'dragover'].forEach(function (ev) {
  drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
});
['dragleave', 'drop'].forEach(function (ev) {
  drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
});
drop.addEventListener('drop', function (e) {
  if (e.dataTransfer && e.dataTransfer.files.length) setFiles(e.dataTransfer.files);
});
// éviter qu'un fichier lâché à côté de la zone ouvre le PDF dans l'onglet
window.addEventListener('dragover', function (e) { e.preventDefault(); });
window.addEventListener('drop', function (e) { e.preventDefault(); });

$('q').addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b) return;
  Array.prototype.forEach.call($('q').children, function (c) { c.classList.toggle('on', c === b); });
  state.width = parseInt(b.dataset.w, 10);
  state.quality = parseFloat(b.dataset.q);
});
$('go').addEventListener('click', convert);

})();
