/* Application embarquée dans le HTML produit : visionneuse + éditeur.
   Elle lit les trois balises <script> du document (#cfg, #assets, #app-src),
   construit toute l'interface, et sait réécrire le fichier entier à partir de
   ces mêmes trois balises — d'où l'interdiction absolue de toucher au body. */
(function () {
'use strict';
var $ = function (id) { return document.getElementById(id); };
var CFG = JSON.parse($('cfg').textContent);
var ASSETS = JSON.parse($('assets').textContent);
var META = CFG.meta, SLIDES = CFG.slides;
var APP_VERSION = '4.2.0';

function assign(t) {
  for (var i = 1; i < arguments.length; i++) {
    var s = arguments[i];
    for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k];
  }
  return t;
}

/* Modèle : chaque diapo porte une liste d'éléments empilés dans l'ordre du
   tableau. Les fichiers produits par les versions précédentes stockaient
   « zones » et « videos » séparément : on les convertit au chargement. */
SLIDES.forEach(function (s) {
  if (!s.elements) {
    s.elements = [];
    (s.videos || []).forEach(function (v) { s.elements.push(assign({ type: 'video' }, v)); });
    (s.zones || []).forEach(function (z) { s.elements.push(assign({ type: 'zone' }, z)); });
  }
  delete s.zones; delete s.videos;
  s.notes = s.notes || '';
  s.hidden = !!s.hidden;
});

var FR = META.lang !== 'en';
var IMG = function (i) { return META.embed ? 'data:image/jpeg;base64,' + ASSETS.images[i] : ASSETS.images[i]; };
var MEDIA = function (id) {
  var m = ASSETS.media[id];
  return m ? (m.data ? 'data:' + m.mime + ';base64,' + m.data : m.path) : '';
};
var T = FR
  ? { of: '/', notes: 'Notes', noNotes: 'Aucune note pour cette diapo.', back: '↩ Retour',
      hidden: 'Diapo cachée', slide: 'diapo',
      help: '← → : naviguer · F : plein écran · N : notes · T : vignettes' }
  : { of: '/', notes: 'Notes', noNotes: 'No notes for this slide.', back: '↩ Back',
      hidden: 'Hidden slide', slide: 'slide',
      help: '← → : navigate · F : fullscreen · N : notes · T : thumbnails' };

document.title = META.title;

/* Réglages de lecture : ce qui s'affiche autour de la diapo pour le lecteur.
   Tout à true = comportement historique ; tout à false = mode immersif, où
   l'on ne navigue plus qu'avec les boutons posés sur les pages. */
var VIEW_KEYS = ['arrows', 'counter', 'progress', 'thumbs', 'header'];
if (!META.view) META.view = {};
VIEW_KEYS.forEach(function (k) { if (META.view[k] === undefined) META.view[k] = true; });
// « plein cadre » : par défaut non, pour ne pas changer l'allure des packs
// déjà montés ; les nouvelles conversions l'activent (voir le convertisseur).
if (META.view.full === undefined) META.view.full = false;
if (META.transition === undefined) META.transition = 'fade';
if (!META.nav) META.nav = [];   // sommaire : [{label, slide}]
if (!META.master) META.master = [];   // éléments présents sur TOUTES les pages

/* ============================ styles ============================ */
var style = document.createElement('style');
style.textContent = "\
:root{--bg:#111318;--panel:#1b1e26;--panel2:#232733;--panel3:#2b3040;--line:#2a2e3a;\
--fg:#e8eaf0;--muted:#8b90a0;--accent:#5b8cff;--warn:#ffb020;--radius:10px}\
*{margin:0;padding:0;box-sizing:border-box}\
html,body{height:100%;background:var(--bg);color:var(--fg);font:15px/1.5 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;overflow:hidden}\
.hidden{display:none!important}\
#app{display:flex;flex-direction:column;height:100%}\
header{display:flex;align-items:center;gap:8px;padding:9px 14px;background:var(--panel);border-bottom:1px solid var(--line);flex-shrink:0}\
header h1{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:24vw;flex-shrink:0}\
body.editing header h1{cursor:text}\
#counter{color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap;margin-right:auto;padding-left:4px}\
button.icon{background:var(--panel2);color:var(--fg);border:none;border-radius:8px;padding:7px 11px;cursor:pointer;font-size:14px;transition:background .15s;white-space:nowrap}\
button.icon:hover{background:var(--panel3)}\
button.icon.active{background:var(--accent);color:#fff}\
button.icon:disabled{opacity:.35;cursor:default;background:var(--panel2)}\
#tools{display:flex;gap:5px;align-items:center}\
#tools .tool{padding:7px 10px;font-size:15px;line-height:1}\
.sep{width:1px;height:22px;background:var(--line);margin:0 3px}\
#main{flex:1;display:flex;min-height:0}\
#stage{flex:1;display:flex;align-items:center;justify-content:center;position:relative;padding:18px;min-width:0}\
body.full:not(.editing) #stage{padding:0}\
body.full:not(.editing) #slide{border-radius:0;box-shadow:none}\
body.full:not(.editing) #wrap{border-radius:0}\
/* le cadre prend exactement le format de la page (aspect-ratio posé en JS depuis\
   les dimensions réelles de l'image) : ni étirement, ni décalage des éléments,\
   quel que soit le format du PDF — 16/9, A4 portrait ou autre */\
#wrap{position:relative;max-width:100%;max-height:100%;width:auto;height:auto;aspect-ratio:16/9;transition:opacity .18s ease}\
body:not(.editing) #wrap{overflow:hidden;border-radius:var(--radius)}\
#wrap.fading{opacity:0}\
#slide{width:100%;height:100%;object-fit:contain;border-radius:var(--radius);box-shadow:0 8px 40px rgba(0,0,0,.55);user-select:none;display:block}\
body.noarrows .navzone{display:none}\
/* transitions entre pages */\
#wrap[data-tr=fade].tr-out,#wrap[data-tr=fade].tr-in{opacity:0}\
#wrap[data-tr=slide].tr-out{opacity:0;transform:translateX(-5%)}\
#wrap[data-tr=slide].tr-in{opacity:0;transform:translateX(5%)}\
#wrap[data-tr=slide].back.tr-out{transform:translateX(5%)}\
#wrap[data-tr=slide].back.tr-in{transform:translateX(-5%)}\
#wrap[data-tr=zoom].tr-out{opacity:0;transform:scale(.965)}\
#wrap[data-tr=zoom].tr-in{opacity:0;transform:scale(1.035)}\
#wrap[data-tr=up].tr-out{opacity:0;transform:translateY(-3%)}\
#wrap[data-tr=up].tr-in{opacity:0;transform:translateY(3%)}\
/* apparition des elements */\
@keyframes elFade{from{opacity:0}to{opacity:1}}\
@keyframes elUp{from{opacity:0;transform:translateY(14%)}to{opacity:1;transform:none}}\
@keyframes elDown{from{opacity:0;transform:translateY(-14%)}to{opacity:1;transform:none}}\
@keyframes elLeft{from{opacity:0;transform:translateX(-12%)}to{opacity:1;transform:none}}\
@keyframes elRight{from{opacity:0;transform:translateX(12%)}to{opacity:1;transform:none}}\
@keyframes elZoom{from{opacity:0;transform:scale(.86)}to{opacity:1;transform:none}}\
.el.an-fade{animation:elFade .5s both}\
.el.an-up{animation:elUp .55s cubic-bezier(.22,.9,.3,1) both}\
.el.an-down{animation:elDown .55s cubic-bezier(.22,.9,.3,1) both}\
.el.an-left{animation:elLeft .55s cubic-bezier(.22,.9,.3,1) both}\
.el.an-right{animation:elRight .55s cubic-bezier(.22,.9,.3,1) both}\
.el.an-zoom{animation:elZoom .5s cubic-bezier(.22,.9,.3,1) both}\
/* survol */\
.hv-lift,.hv-zoom,.hv-glow{transition:transform .18s ease,box-shadow .18s ease,filter .18s ease}\
.hv-light,.hv-dark{transition:backdrop-filter .18s ease,background .18s ease}\
.hv-light:hover{backdrop-filter:brightness(1.18) saturate(1.05)}\
.hv-dark:hover{backdrop-filter:brightness(.75)}\
@supports not (backdrop-filter:brightness(1.2)){\
.hv-light:hover{background:rgba(255,255,255,.16)}\
.hv-dark:hover{background:rgba(0,0,0,.22)}}\
.hv-lift:hover{transform:translateY(-5px);box-shadow:0 12px 28px rgba(0,0,0,.45)}\
.hv-zoom:hover{transform:scale(1.045)}\
.hv-glow:hover{filter:brightness(1.18) drop-shadow(0 0 12px rgba(255,255,255,.45))}\
/* element actif : ce que montre le panneau en ce moment */\
.el.on>.btn-in{box-shadow:0 0 0 .14em rgba(255,255,255,.6),0 .2em .7em rgba(0,0,0,.45);filter:brightness(1.12)}\
.el.on.look-outline{border-color:#fff;background:rgba(255,255,255,.16)}\
.el.on.look-hover:not(.hasbtn){outline:3px solid rgba(255,255,255,.75);outline-offset:1px;border-radius:6px}\
.el.on.el-image,.el.on.el-shape,.el.on.el-text:not(.hasbtn){outline:3px solid rgba(255,255,255,.75);outline-offset:2px}\
/* sommaire */\
#nav{display:flex;gap:4px;align-items:center;padding:8px 16px;background:var(--panel);border-bottom:1px solid var(--line);flex-shrink:0;overflow-x:auto}\
#nav button{background:none;border:none;color:var(--muted);padding:6px 13px;border-radius:8px;cursor:pointer;font-size:13.5px;white-space:nowrap;transition:color .15s,background .15s}\
#nav button:hover{color:var(--fg);background:var(--panel2)}\
#nav button.on{color:var(--fg);background:var(--panel2);font-weight:600}\
#navList{margin-top:6px}\
#navList .row2{display:flex;gap:6px;align-items:center;margin-top:5px}\
#navList input{flex:1;min-width:0}\
#navList button{background:var(--panel2);color:var(--muted);border:none;border-radius:6px;padding:6px 9px;cursor:pointer}\
#navList button:hover{color:#ff8a8a}\
#fsFloat{position:fixed;top:14px;right:16px;z-index:25;background:rgba(20,22,30,.7);color:#fff;border:none;border-radius:50%;width:38px;height:38px;font-size:15px;cursor:pointer;opacity:.22;transition:opacity .2s}\
#fsFloat:hover{opacity:1}\
body.editing{user-select:none}\
body.drawing #stage{cursor:crosshair}\
.navzone{position:absolute;top:0;bottom:0;width:22%;cursor:pointer;display:flex;align-items:center;opacity:0;transition:opacity .2s;z-index:1}\
.navzone:hover{opacity:1}\
.navzone span{font-size:34px;color:#fff;background:rgba(0,0,0,.45);border-radius:50%;width:52px;height:52px;display:flex;align-items:center;justify-content:center}\
#prev{left:0;justify-content:flex-start;padding-left:14px}\
#next{right:0;justify-content:flex-end;padding-right:14px}\
body.editing .navzone,#stage.onhidden .navzone{display:none}\
\
.el{position:absolute;z-index:3}\
.el-video{background:#000;border-radius:8px;overflow:hidden}\
.el-video video,.el-video iframe{width:100%;height:100%;border:0;display:block}\
.el-image img{width:100%;height:100%;display:block}\
.el-panel{overflow:hidden}\
.el-panel .panel-img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block}\
.panel-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;text-align:center;padding:10px}\
.gal-nav{position:absolute;top:50%;transform:translateY(-50%);z-index:6;background:rgba(0,0,0,.5);color:#fff;border:none;border-radius:50%;width:36px;height:36px;font-size:19px;line-height:1;cursor:pointer;opacity:.5;transition:opacity .15s}\
.gal-nav:hover{opacity:1}\
.gal-prev{left:9px}\
.gal-next{right:9px}\
.gal-count{position:absolute;right:11px;bottom:9px;z-index:6;background:rgba(0,0,0,.55);color:#fff;padding:3px 10px;border-radius:12px;font-size:12px;pointer-events:none}\
#lb.slideov{background:transparent;box-shadow:none}\
.ovwrap{position:relative;width:100%;height:100%;background:#0a0c11;border-radius:10px;overflow:hidden;box-shadow:0 12px 60px rgba(0,0,0,.7)}\
.ovwrap .ovimg{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block}\
.el-text{display:flex;padding:.1em .2em;overflow-wrap:anywhere;white-space:pre-wrap}\
.act{cursor:pointer}\
.look-hover{border-radius:6px}\
.look-outline{border:2px solid var(--accent);border-radius:6px}\
.look-button{display:flex;align-items:center;justify-content:center;text-align:center;font-weight:600}\
/* Boutons : la forme épouse le texte. Le cadre qu'on dessine ne sert plus qu'à\
   le placer — c'est le texte lui-même qui est le bouton, comme sur un site.\
   .hug rend le cadre transparent au clic : seul le bouton visible réagit. */\
.btn-in{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:.4em;max-width:100%;line-height:1.3;white-space:pre-wrap;overflow-wrap:anywhere;text-align:inherit;box-sizing:border-box;transition:background-color .2s ease,color .2s ease,border-color .2s ease,box-shadow .2s ease,transform .16s ease,filter .2s ease}\
.hug{pointer-events:none}\
.hug>.btn-in{pointer-events:auto}\
.bs-plain,.bs-link{color:var(--bc)}\
.bs-plain{padding:0 .06em}\
.act .bs-plain:hover{transform:translateY(-.06em);filter:brightness(1.15) drop-shadow(0 .1em .28em rgba(0,0,0,.5))}\
.bs-link{padding:.04em .02em}\
.bs-link::after{content:'';position:absolute;left:0;right:0;bottom:-.08em;height:.075em;min-height:1px;background:currentColor;border-radius:1em;transform:scaleX(0);transform-origin:left center;transition:transform .3s cubic-bezier(.22,.61,.36,1)}\
.act .bs-link:hover::after{transform:scaleX(1)}\
.act .bs-link:hover{filter:brightness(1.12)}\
.bs-pill{padding:.42em 1.05em;border-radius:999px;background:var(--bc);color:var(--bt);box-shadow:0 .12em .5em rgba(0,0,0,.28)}\
.act .bs-pill:hover{transform:translateY(-.09em);box-shadow:0 .3em .9em rgba(0,0,0,.42);filter:brightness(1.08)}\
.bs-ghost{padding:.4em 1em;border:.085em solid var(--bc);border-radius:.55em;color:var(--bc)}\
.act .bs-ghost:hover{background:var(--bc);color:var(--bt);box-shadow:0 .25em .8em rgba(0,0,0,.32)}\
.bs-soft{padding:.42em 1.05em;border-radius:.6em;color:var(--bc);background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.26);backdrop-filter:blur(8px) saturate(1.3)}\
.act .bs-soft:hover{background:rgba(255,255,255,.22);border-color:rgba(255,255,255,.46);transform:translateY(-.09em)}\
.bs-bloc{width:100%;height:100%;padding:.2em .7em;background:var(--bc);color:var(--bt);box-shadow:0 .12em .5em rgba(0,0,0,.28)}\
.act .bs-bloc:hover{filter:brightness(1.1)}\
.act .btn-in:active{transform:translateY(.03em) scale(.985)}\
body.editing .el{outline:1px dashed rgba(91,140,255,.55);cursor:grab}\
body.editing .el.sel{outline:2px solid var(--warn)}\
body.editing .el.master{outline:1px dashed rgba(62,207,142,.85)}\
body.editing .el.master.sel{outline:2px solid var(--warn)}\
/* élément commun absent de cette page : invisible en lecture, fantôme en édition */\
.el.offpage{visibility:hidden}\
body.editing .el.offpage{visibility:visible;filter:grayscale(1) opacity(.22)}\
body.editing .el.offpage.sel{filter:grayscale(1) opacity(.5)}\
body.editing .el-text[contenteditable=true]{outline:2px solid var(--accent);cursor:text;user-select:text}\
.hdl{position:absolute;width:13px;height:13px;background:var(--warn);border:2px solid #111;border-radius:50%;z-index:6}\
.hdl-se{right:-7px;bottom:-7px;cursor:nwse-resize}\
.hdl-nw{left:-7px;top:-7px;cursor:nwse-resize}\
.vcover{position:absolute;inset:0;z-index:4}\
.guide{position:absolute;background:var(--warn);z-index:7;pointer-events:none;opacity:.9}\
.guide.v{width:1px;top:0;bottom:0}\
.guide.h{height:1px;left:0;right:0}\
.cand{position:absolute;z-index:5;border:2px dashed rgba(62,207,142,.9);border-radius:6px;cursor:pointer;background:rgba(62,207,142,.10);transition:background .12s}\
.cand:hover{background:rgba(62,207,142,.28)}\
.cand span{position:absolute;left:0;top:-17px;font-size:10.5px;color:#3ecf8e;white-space:nowrap;pointer-events:none;max-width:100%;overflow:hidden;text-overflow:ellipsis}\
\
#backBtn{position:absolute;top:16px;left:16px;z-index:6;background:rgba(20,22,30,.85);color:#fff;border:1px solid var(--line);border-radius:20px;padding:8px 16px;cursor:pointer;font-size:14px}\
#backBtn:hover{background:var(--accent);border-color:var(--accent)}\
#hidBadge{position:absolute;top:16px;right:16px;z-index:6;background:rgba(192,57,43,.85);color:#fff;border-radius:14px;padding:4px 12px;font-size:12px}\
\
#props{width:286px;background:var(--panel);border-left:1px solid var(--line);padding:14px;overflow-y:auto;flex-shrink:0;font-size:13px}\
#props h3{font-size:11.5px;text-transform:uppercase;letter-spacing:.7px;color:var(--muted);margin:2px 0 9px}\
#props label{display:block;margin:9px 0 2px;color:var(--muted)}\
#props label.ck{display:flex;gap:8px;align-items:flex-start;cursor:pointer;color:var(--fg)}\
#props input[type=text],#props select,#props textarea{width:100%;background:var(--panel2);color:var(--fg);border:1px solid var(--line);border-radius:7px;padding:6px 8px;font-size:13px;margin-top:3px;font-family:inherit}\
#props textarea{resize:vertical;min-height:52px}\
#props input[type=range]{width:100%;margin-top:6px;accent-color:var(--accent)}\
#props input[type=color]{width:100%;height:30px;padding:0;border:1px solid var(--line);border-radius:7px;background:var(--panel2);cursor:pointer;margin-top:3px}\
#props hr{border:none;border-top:1px solid var(--line);margin:13px 0}\
#props .muted{color:var(--muted);line-height:1.6}\
#props .grid2{display:flex;gap:8px}\
#props .grid2>*{flex:1;min-width:0}\
/* choix des pages d'un élément commun */\
.pagepick{max-height:184px;overflow-y:auto;background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:7px 9px;margin-top:6px}\
.pagepick label.ck{margin:3px 0;font-size:12.5px;align-items:center}\
.pagebtns{display:flex;gap:5px;margin-top:7px}\
.pagebtns button{flex:1 1 auto;background:var(--panel2);color:var(--muted);border:none;border-radius:7px;padding:6px 5px;cursor:pointer;font-size:11px;white-space:nowrap}\
.pagebtns button:hover{background:var(--panel3);color:var(--fg)}\
.pbtns{display:flex;gap:6px;margin-top:11px}\
.pbtns button{flex:1;background:var(--panel2);color:var(--fg);border:none;border-radius:7px;padding:7px;cursor:pointer;font-size:13px}\
.pbtns button:hover{background:var(--panel3)}\
#props button.wide{width:100%;background:var(--panel2);color:var(--fg);border:none;border-radius:7px;padding:8px;cursor:pointer;font-size:13px;margin-top:10px}\
#props button.wide:hover{background:var(--panel3)}\
#props button.danger{margin-top:8px;background:#3a2326;color:#ff8a8a;border:none;border-radius:7px;padding:8px 12px;cursor:pointer;width:100%;font-size:13px}\
.aud{background:var(--panel2);border-left:3px solid var(--warn);border-radius:6px;padding:8px 10px;margin-bottom:6px;cursor:pointer;font-size:12.5px;line-height:1.5}\
.aud:hover{background:var(--panel3)}\
.aud.bad{border-left-color:#e0524a}\
#props button.danger:hover{background:#54282d}\
\
#thumbs{width:164px;background:var(--panel);border-left:1px solid var(--line);overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px;flex-shrink:0}\
.th{position:relative;cursor:pointer}\
.th img{width:100%;display:block;border-radius:6px;border:2px solid transparent;opacity:.62;transition:.15s}\
.th:hover img{opacity:1}\
.th.current img{border-color:var(--accent);opacity:1}\
.th.th-hidden img{opacity:.26;filter:grayscale(.8)}\
.tnum{position:absolute;left:6px;bottom:6px;font-size:10px;background:rgba(0,0,0,.6);color:#fff;padding:1px 6px;border-radius:8px;pointer-events:none}\
.tname{display:block;font-size:11.5px;color:var(--fg);margin-top:3px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
.th.th-hidden .tname{color:var(--muted)}\
.tdot{position:absolute;right:6px;bottom:6px;font-size:9.5px;background:rgba(91,140,255,.85);color:#fff;padding:1px 6px;border-radius:8px;pointer-events:none}\
.teye{position:absolute;top:4px;right:4px;background:rgba(0,0,0,.6);border:none;border-radius:6px;padding:2px 5px;cursor:pointer;font-size:12px}\
\
#notes{background:var(--panel);border-top:1px solid var(--line);padding:12px 18px;max-height:26vh;overflow-y:auto;flex-shrink:0;white-space:pre-wrap;color:var(--muted);font-size:14px}\
#notes b{color:var(--fg);display:block;margin-bottom:4px}\
#progress{height:3px;background:var(--accent);width:0;transition:width .25s ease;flex-shrink:0}\
#hint{position:fixed;bottom:14px;left:50%;transform:translateX(-50%);background:rgba(20,22,30,.92);padding:8px 16px;border-radius:20px;font-size:12.5px;color:var(--muted);pointer-events:none;transition:opacity .5s;white-space:nowrap;z-index:20}\
#toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:var(--panel3);color:var(--fg);padding:9px 18px;border-radius:20px;font-size:13px;z-index:30;pointer-events:none;opacity:0;transition:opacity .25s}\
#toast.on{opacity:1}\
#testbar{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:26;background:rgba(91,140,255,.92);color:#fff;padding:7px 16px;border-radius:20px;font-size:13px;cursor:pointer;box-shadow:0 6px 22px rgba(0,0,0,.45)}\
#testbar:hover{filter:brightness(1.1)}\
#lightbox{position:fixed;inset:0;background:rgba(5,6,10,.9);z-index:50;display:flex;align-items:center;justify-content:center}\
#lb{width:min(92vw,1200px);aspect-ratio:16/9;background:#000;border-radius:10px;box-shadow:0 10px 60px rgba(0,0,0,.7)}\
#lb video,#lb iframe{width:100%;height:100%;border:0;border-radius:10px}\
#lbClose{position:fixed;top:18px;right:22px;z-index:51;background:rgba(255,255,255,.14);color:#fff;border:none;border-radius:50%;width:40px;height:40px;font-size:17px;cursor:pointer}\
#menu{position:fixed;z-index:40;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:6px;display:flex;flex-direction:column;gap:2px;box-shadow:0 8px 30px rgba(0,0,0,.5);min-width:250px}\
#menu button{background:none;border:none;color:var(--fg);padding:8px 12px;text-align:left;border-radius:6px;cursor:pointer;font-size:13px}\
#menu button:hover{background:var(--panel)}\
#floatbar{position:fixed;z-index:22;display:flex;gap:2px;align-items:center;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:4px;box-shadow:0 6px 22px rgba(0,0,0,.5)}\
#floatbar button{background:none;border:none;color:var(--fg);width:30px;height:30px;border-radius:7px;cursor:pointer;font-size:14px;line-height:1}\
#floatbar button:hover{background:var(--panel)}\
#floatbar button.del:hover{background:#3a2326;color:#ff8a8a}\
#floatbar .fsep{width:1px;height:18px;background:var(--line);margin:0 2px}\
@media (max-width:760px){#thumbs{display:none}.navzone span{display:none}}";
document.head.appendChild(style);

/* ======== squelette (ajouté APRÈS les <script>, jamais à leur place) ======== */
document.body.insertAdjacentHTML('beforeend',
'<div id="app">' +
'<header>' +
'<h1 id="title"></h1>' +
'<span id="counter"></span>' +
'<span id="tools" class="hidden">' +
'<button class="icon tool" id="tZone" title="Zone cliquable — dessine-la sur la diapo">➕</button>' +
'<button class="icon tool" id="tImage" title="Image">🖼</button>' +
'<button class="icon tool" id="tText" title="Texte">T</button>' +
'<button class="icon tool" id="tShape" title="Forme (cadre, pastille, masque)">▭</button>' +
'<button class="icon tool" id="tPanel" title="Panneau : affiche une autre page à l\u2019intérieur de celle-ci">🗔</button>' +
'<button class="icon tool" id="tVideo" title="Vidéo">🎬</button>' +
'<button class="icon tool hidden" id="tObjects" title="Formes venues du .pptx : un clic en fait un bouton">⌖</button>' +
'<span class="sep"></span>' +
'<button class="icon tool" id="tPreview" title="Rejouer les apparitions de cette page">▶</button>' +
'<button class="icon" id="tTest" title="Voir la page comme l’animateur, sans rien enregistrer">👁 Test</button>' +
'<button class="icon tool" id="tUndo" title="Annuler (Ctrl+Z)">↶</button>' +
'<button class="icon tool" id="tRedo" title="Rétablir (Ctrl+Y)">↷</button>' +
'<span class="sep"></span>' +
'<button class="icon" id="tAudit" title="Vérifier avant diffusion">✓ Vérifier</button>' +
'<button class="icon" id="tSave" title="Télécharger ce fichier mis à jour (Ctrl+S)">💾</button>' +
'<button class="icon" id="tLock" title="Exporter la version animateur : plus aucun comportement de diaporama">🔒 Animateur</button>' +
'</span>' +
(META.locked ? '' : '<button class="icon" id="btnEdit" title="Mode édition (E)">✏️</button>') +
'<button class="icon hidden" id="btnNotes" title="N">🗒 ' + T.notes + '</button>' +
'<button class="icon" id="btnThumbs" title="T">▦</button>' +
'<button class="icon" id="btnFS" title="F">⛶</button>' +
'</header>' +
'<nav id="nav" class="hidden"></nav>' +
'<div id="main">' +
'<div id="stage">' +
'<div id="wrap"><img id="slide" alt=""></div>' +
'<div class="navzone" id="prev"><span>‹</span></div>' +
'<div class="navzone" id="next"><span>›</span></div>' +
'<button id="backBtn" class="hidden"></button>' +
'<span id="hidBadge" class="hidden"></span>' +
'</div>' +
'<aside id="props" class="hidden"></aside>' +
'<div id="thumbs"></div>' +
'</div>' +
'<div id="notes" class="hidden"></div>' +
'<div id="progress"></div>' +
'</div>' +
'<div id="lightbox" class="hidden"><div id="lb"></div></div>' +
'<button id="lbClose" class="hidden">✕</button>' +
'<div id="menu" class="hidden"></div>' +
'<div id="floatbar" class="hidden">' +
'<button data-fb="dup" title="Dupliquer (Ctrl+D)">⧉</button>' +
'<button data-fb="front" title="Mettre devant">⬆</button>' +
'<button data-fb="back" title="Mettre derrière">⬇</button>' +
'<span class="fsep"></span>' +
'<button data-fb="del" title="Supprimer (Suppr)" class="del">🗑</button>' +
'</div>' +
'<input type="file" id="filePick" class="hidden">' +
'<button id="fsFloat" class="hidden" title="Plein écran (F)">⛶</button>' +
'<div id="testbar" class="hidden">👁 Aperçu animateur — <b>Échap</b> pour revenir à l’édition</div>' +
'<div id="toast"></div>' +
'<div id="hint">' + T.help + (META.locked ? '' : ' · E : édition') + '</div>');

var wrap = $('wrap'), slideEl = $('slide'), counter = $('counter'), thumbs = $('thumbs'),
    notesEl = $('notes'), prog = $('progress'), props = $('props'), stage = $('stage'),
    backBtn = $('backBtn'), hidBadge = $('hidBadge'), titleEl = $('title'), btnNotes = $('btnNotes');
var cur = 0, editMode = false, drawMode = false, dirty = false,
    sel = null, drag = null, hist = [], thumbItems = [], clip = null,
    undoStack = [], redoStack = [], panelState = {}, scalables = [], showObjects = false,
    previewing = false, galleryTimers = [], auditMode = false, advOpen = false,
    ovState = null, testMode = false;

/* Version animateur : plus aucun comportement de diaporama — ni vignettes,
   ni notes, ni clic sur les bords, ni clavier. Seuls les boutons posés
   fonctionnent. Le mode Aperçu simule exactement ça sans enregistrer. */
function readerLock() { return !!META.locked || testMode; }
titleEl.textContent = META.title;
hidBadge.textContent = T.hidden;
backBtn.textContent = T.back;
slideEl.draggable = false;

/* ============================ utilitaires ============================ */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
  });
}
function escA(s) { return esc(s).replace(/"/g, '&quot;'); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function r2(n) { return Math.round(n * 100) / 100; }
function markDirty() { dirty = true; titleEl.textContent = META.title + ' •'; }
function clearDirty() { dirty = false; titleEl.textContent = META.title; }
/* Nom donné à une page, sinon son numéro. Sert partout : vignettes, listes
   déroulantes, vérification — c'est ce qui évite de se perdre à 40 pages. */
function slideName(i) {
  var s2 = SLIDES[i];
  return (s2 && s2.name) ? s2.name : 'Diapo ' + (i + 1);
}
function slideOpt(i) {
  return slideName(i) + (SLIDES[i] && SLIDES[i].hidden ? ' (cachée)' : '');
}
function els() { return SLIDES[cur].elements; }
/* Les éléments communs (gabarit) sont rendus après ceux de la page, donc
   au-dessus. L'indexation d'affichage — et donc la sélection — porte sur la
   concaténation des deux listes. */
function allEls() { return els().concat(META.master); }
/* Un élément commun peut n'être posé que sur certaines pages (`el.pages`).
   Ailleurs il reste dans le DOM, masqué : le retirer décalerait l'indexation
   des éléments, dont dépendent la sélection et le déplacement. */
function onPage(el, i) { return !el.pages || el.pages.indexOf(i) >= 0; }
function ownerOf(i) {
  var n = els().length;
  return i < n ? { arr: els(), idx: i, master: false }
               : { arr: META.master, idx: i - n, master: true };
}
function selEl() { return sel == null ? null : allEls()[sel]; }
// seulement les éléments posés sur la diapo : ceux imbriqués dans un panneau
// portent la même classe et décaleraient l'indexation pendant un déplacement
function nodes() { return wrap.querySelectorAll(':scope > .el'); }
function toast(msg) {
  var t = $('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(t._t);
  t._t = setTimeout(function () { t.classList.remove('on'); }, 1700);
}

/* --- historique : instantanés des diapos (les médias, eux, sont additifs
       et nettoyés à l'enregistrement par gcMedia) --- */
function snapshot() { return JSON.stringify(SLIDES); }
function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack.length = 0;
  markDirty();
  syncUndoButtons();
}
function restore(json) {
  var data = JSON.parse(json);
  SLIDES.length = 0;
  data.forEach(function (s) { SLIDES.push(s); });
  sel = null;
  cur = clamp(cur, 0, SLIDES.length - 1);
  buildThumbs();
  refresh();
  syncUndoButtons();
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  markDirty();
  toast('Annulé');
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  markDirty();
  toast('Rétabli');
}
function syncUndoButtons() {
  var u = $('tUndo'), r = $('tRedo');
  if (u) u.disabled = !undoStack.length;
  if (r) r.disabled = !redoStack.length;
}

/* --- navigation --- */
function visCount() { return SLIDES.filter(function (s) { return !s.hidden; }).length || 1; }
function visPos(i) { var p = 0; for (var k = 0; k <= i; k++) if (!SLIDES[k].hidden) p++; return p; }
function firstVisible() { for (var i = 0; i < SLIDES.length; i++) if (!SLIDES[i].hidden) return i; return 0; }
function lastVisible() { for (var i = SLIDES.length - 1; i >= 0; i--) if (!SLIDES[i].hidden) return i; return SLIDES.length - 1; }
function linNext() { for (var i = cur + 1; i < SLIDES.length; i++) if (editMode || !SLIDES[i].hidden) return i; return cur; }
function linPrev() { for (var i = cur - 1; i >= 0; i--) if (editMode || !SLIDES[i].hidden) return i; return cur; }

function relPct(e) {
  var r = wrap.getBoundingClientRect();
  return { x: clamp((e.clientX - r.left) / r.width * 100, -20, 120),
           y: clamp((e.clientY - r.top) / r.height * 100, -20, 120) };
}
function setRect(el, o) {
  el.style.left = o.x + '%'; el.style.top = o.y + '%';
  el.style.width = o.w + '%'; el.style.height = o.h + '%';
}
function ytEmbed(u) {
  var m = String(u || '').match(
    /(?:youtube\.com\/(?:watch\?\S*?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? 'https://www.youtube.com/embed/' + m[1] : u;
}

/* ============================ affichage d'une diapo ============================ */
function go(i, opts) {
  opts = opts || {};
  i = clamp(i, 0, SLIDES.length - 1);
  if (!opts.noHist && i !== cur) { hist.push(cur); if (hist.length > 200) hist.shift(); }
  if (i !== cur) panelState = {};        // les panneaux repartent de leur contenu par défaut
  var back = i < cur;
  cur = i;
  var apply = function () {
    slideEl.src = IMG(SLIDES[cur].img);
    renderElements();
  };
  var tr = META.transition || 'fade';
  if (opts.instant || tr === 'none') { wrap.classList.remove('tr-out', 'tr-in'); apply(); }
  else {
    wrap.dataset.tr = tr;
    wrap.classList.toggle('back', back);
    wrap.classList.add('tr-out');
    setTimeout(function () {
      apply();
      wrap.classList.remove('tr-out');
      wrap.classList.add('tr-in');
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { wrap.classList.remove('tr-in'); });
      });
    }, 170);
  }

  var s = SLIDES[cur];
  if (editMode) counter.textContent = T.slide + ' ' + (cur + 1) + ' / ' + SLIDES.length;
  else if (s.hidden) counter.textContent = '•';
  else {
    counter.textContent = visPos(cur) + ' ' + T.of + ' ' + visCount();
    prog.style.width = (visPos(cur) / visCount() * 100) + '%';
  }
  stage.classList.toggle('onhidden', !!s.hidden && !editMode);
  backBtn.classList.toggle('hidden', editMode || !s.hidden);
  hidBadge.classList.toggle('hidden', !(editMode && s.hidden));
  syncThumbs();
  renderNav();
  notesEl.innerHTML = '<b>' + T.notes + ' — ' + T.slide + ' ' + (cur + 1) + '</b>' +
    (s.notes ? esc(s.notes) : '<i>' + T.noNotes + '</i>');
  location.hash = cur + 1;
  if (editMode) { if (!opts.keepSel) sel = null; renderProps(); }
}
function refresh() { go(cur, { instant: true, noHist: true, keepSel: true }); }
function goBack() { var p = hist.pop(); go(p == null ? firstVisible() : p, { noHist: true }); }

function renderElements() {
  galleryTimers.forEach(clearInterval);
  galleryTimers.length = 0;
  wrap.querySelectorAll('.el,.guide,.cand').forEach(function (n) { n.remove(); });
  scalables.length = 0;
  var nPage = els().length;
  allEls().forEach(function (el, i) {
    var node = buildEl(el, i, 0, wrap);
    if (i >= nPage && !onPage(el, cur)) node.classList.add('offpage');
    wrap.appendChild(node);
  });
  renderCandidates();
  scaleText();
  placeFloatbar();
}

/* Formes repérées dans le .pptx : elles ne font rien tant qu'on n'a pas
   cliqué dessus — un clic crée une zone exactement à leur place. */
function renderCandidates() {
  if (!editMode || !showObjects) return;
  (SLIDES[cur].objects || []).forEach(function (o) {
    var d = document.createElement('div');
    d.className = 'cand';
    setRect(d, o);
    d.title = 'Cliquer pour en faire un bouton';
    if (o.label) {
      var lab = document.createElement('span');
      lab.textContent = o.label;
      d.appendChild(lab);
    }
    d.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    d.addEventListener('click', function (e) {
      e.stopPropagation();
      pushUndo();
      els().push({ type: 'zone', x: o.x, y: o.y, w: o.w, h: o.h, look: 'hover',
                   hover: 'light',
                   action: 'goto', slide: Math.min(cur + 1, SLIDES.length - 1) });
      select(els().length - 1);
      buildThumbs();
      toast('Bouton créé sur cet objet — choisis sa destination');
    });
    wrap.appendChild(d);
  });
}

/* Panneaux : une fenêtre posée sur la diapo qui affiche une AUTRE diapo à
   l'intérieur, sans quitter la page. panelState garde ce qui est affiché
   pendant la visite ; el.slide est le contenu de départ. */
function panelKey(el) { return el.name || 'Panneau'; }
function panelContent(el) {
  var k = panelKey(el);
  if (Object.prototype.hasOwnProperty.call(panelState, k)) return panelState[k];
  if (el.list && el.list.length) return el.list[0];     // galerie : première image
  return typeof el.slide === 'number' ? el.slide : null;
}
/* Galerie : le panneau contient plusieurs diapos et on défile dedans. */
function galleryStep(el, dir) {
  var list = el.list || [];
  if (!list.length) return;
  var k = panelKey(el), cur0 = panelContent(el);
  var i = list.indexOf(cur0);
  if (i < 0) i = 0;
  panelState[k] = list[(i + dir + list.length) % list.length];
  renderElements();
}
function panelsHere() {
  return allEls().filter(function (e) { return e.type === 'panel'; });
}

/* ---------------------------------------------------------------------------
   Boutons. Un bouton n'est pas un rectangle qu'on pose par-dessus la diapo :
   c'est le texte lui-même qui prend la forme, et le cadre dessiné ne fait que
   le placer. On rend donc le libellé dans un <span> qui se dimensionne sur son
   contenu, et c'est lui qui porte le style et le survol.
--------------------------------------------------------------------------- */
var BTN_STYLES = { plain: 1, link: 1, ghost: 1, pill: 1, soft: 1, bloc: 1 };
var BTN_FLAT = { plain: 1, link: 1 };            // styles sans fond ni contour
function btnStyle(el) {
  if (BTN_STYLES[el.btn]) return el.btn;
  return el.type === 'zone' ? 'pill' : 'plain';  // repli : les anciens packs
}
function btnFill(el) {
  return el.btnColor || (el.type === 'zone' ? el.color : el.bg) || '#5b8cff';
}
/* Texte noir ou blanc selon le fond : un bouton clair reste lisible. */
function contrastOn(hex) {
  var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return '#ffffff';
  var n = parseInt(m[1], 16);
  var l = (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.62 ? '#15181f' : '#ffffff';
}
function makeBtn(d, el, txt) {
  var st = btnStyle(el), fill = btnFill(el);
  var sp = document.createElement('span');
  sp.className = 'btn-in bs-' + st;
  sp.textContent = txt;
  d.style.setProperty('--bc',
    el.type === 'text' && BTN_FLAT[st] ? (el.color || '#ffffff') : fill);
  d.style.setProperty('--bt', contrastOn(fill));
  if (st === 'bloc') {
    sp.style.borderRadius = (el.radius == null ? 10 : el.radius) + 'px';
    d.style.padding = '0';            // le bandeau occupe le cadre au pixel près
  }
  else if (el.radius != null && !BTN_FLAT[st] && st !== 'pill')
    sp.style.borderRadius = el.radius + 'px';
  d.classList.add('hasbtn');
  // en lecture, seul le bouton visible réagit — pas le cadre autour de lui
  if (st !== 'bloc' && !editMode) { d.classList.add('hug'); d.hugNode = sp; }
  d.appendChild(sp);
  return sp;
}

function buildEl(el, i, depth, box) {
  depth = depth || 0;
  var d = document.createElement('div');
  d.className = 'el el-' + el.type;
  setRect(d, el);
  if (el.opacity != null) d.style.opacity = el.opacity;

  if (el.type === 'image') {
    var im = document.createElement('img');
    im.src = MEDIA(el.media);
    im.draggable = false;
    im.style.objectFit = el.fit || 'contain';
    im.style.borderRadius = (el.radius || 0) + 'px';
    if (el.shadow) im.style.boxShadow = '0 6px 26px rgba(0,0,0,.5)';
    d.appendChild(im);
  } else if (el.type === 'text') {
    var tBtn = el.action && el.action !== 'none' ? btnStyle(el) : null;
    d.style.color = el.color || '#ffffff';
    d.style.fontWeight = el.weight || 600;
    d.style.justifyContent = el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start';
    d.style.alignItems = 'center';
    d.style.textAlign = el.align || 'left';
    // un texte-bouton porte son fond sur sa propre forme, pas sur le cadre
    if (el.bg && !(tBtn && !BTN_FLAT[tBtn])) {
      d.style.background = el.bg;
      d.style.borderRadius = (el.radius == null ? 8 : el.radius) + 'px';
    }
    if (el.shadow) d.style.textShadow = '0 2px 10px rgba(0,0,0,.65)';
    if (tBtn) makeBtn(d, el, el.text || '');
    else d.textContent = el.text || '';
  } else if (el.type === 'shape') {
    d.style.background = el.color || '#5b8cff';
    d.style.borderRadius = el.shape === 'ellipse' ? '50%' : (el.radius || 0) + 'px';
  } else if (el.type === 'video') {
    var v;
    if (el.url) {
      v = document.createElement('iframe');
      v.src = el.url;
      v.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
      v.allowFullscreen = true;
    } else {
      v = document.createElement('video');
      v.src = MEDIA(el.media);
      v.controls = el.controls !== false;
      v.loop = !!el.loop;
      v.muted = !!el.muted || !!el.autoplay;
      v.autoplay = !!el.autoplay && !editMode;
      v.playsInline = true;
    }
    d.appendChild(v);
  } else if (el.type === 'zone') {
    d.classList.add('look-' + (el.look || 'hover'));
    // l'arrondi épouse la forme du bouton dessiné en dessous : sans quoi les
    // coins d'une zone rectangulaire réagissent au survol hors du bouton
    if (el.radius != null && (el.look || 'hover') !== 'button') d.style.borderRadius = el.radius + 'px';
    if ((el.look || 'hover') === 'button') {
      makeBtn(d, el, (el.icon ? el.icon + ' ' : '') + (el.label || ''));
      scalables.push({ node: d, el: el, box: box, kind: 'button' });
    }
  } else if (el.type === 'panel') {
    d.style.background = el.bg || 'rgba(10,12,17,.92)';
    d.style.borderRadius = (el.radius == null ? 10 : el.radius) + 'px';
    if (el.shadow !== false) d.style.boxShadow = '0 10px 40px rgba(0,0,0,.55)';
    var content = panelContent(el);
    if (content != null && SLIDES[content]) {
      var pi = document.createElement('img');
      pi.src = IMG(SLIDES[content].img);
      pi.className = 'panel-img';
      pi.draggable = false;
      d.appendChild(pi);
      // la diapo affichée garde ses propres éléments (une seule imbrication :
      // un panneau dans un panneau n'est pas redessiné)
      if (depth === 0) {
        SLIDES[content].elements.forEach(function (sub) {
          if (sub.type === 'panel') return;
          d.appendChild(buildEl(sub, -1, depth + 1, d));
        });
      }
    } else if (editMode) {
      var ph = document.createElement('span');
      ph.className = 'panel-empty';
      ph.textContent = 'Panneau « ' + panelKey(el) +' » — vide au départ';
      d.appendChild(ph);
    }
    // flèches et compteur quand le panneau contient plusieurs diapos
    if (el.list && el.list.length > 1) {
      [['prev', '‹', -1], ['next', '›', 1]].forEach(function (a) {
        var b = document.createElement('button');
        b.className = 'gal-nav gal-' + a[0];
        b.textContent = a[1];
        b.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
        b.addEventListener('click', function (ev) { ev.stopPropagation(); galleryStep(el, a[2]); });
        d.appendChild(b);
      });
      var cnt = document.createElement('span');
      cnt.className = 'gal-count';
      var pos = el.list.indexOf(content);
      cnt.textContent = (pos < 0 ? 1 : pos + 1) + ' / ' + el.list.length;
      d.appendChild(cnt);
      if (!editMode && el.auto > 0) {
        galleryTimers.push(setInterval(function () { galleryStep(el, 1); }, el.auto * 1000));
      }
    }
  }

  if (el.type === 'text') scalables.push({ node: d, el: el, box: box, kind: 'text', top: depth === 0 });

  // apparition à l'arrivée sur la page (lecture, ou aperçu depuis l'éditeur)
  if ((!editMode || previewing) && el.anim && el.anim !== 'none') {
    d.classList.add('an-' + el.anim);
    if (el.delay) d.style.animationDelay = el.delay + 'ms';
  }
  // sur un bouton dont la forme épouse le texte, le survol porte sur le bouton
  if (!editMode && el.hover && el.hover !== 'none')
    (d.hugNode || d).classList.add('hv-' + el.hover);
  // bouton actif : c'est lui qu'affiche le panneau en ce moment
  if (!editMode && el.action === 'panel' && typeof el.slide === 'number') {
    var ps0 = panelsHere();
    var k0 = el.panelName || (ps0[0] ? panelKey(ps0[0]) : 'Panneau');
    var cur0 = Object.prototype.hasOwnProperty.call(panelState, k0)
      ? panelState[k0] : (ps0[0] && typeof ps0[0].slide === 'number' ? ps0[0].slide : null);
    if (cur0 === el.slide) d.classList.add('on');
  }

  if (!editMode || depth > 0) {
    if (el.action && el.action !== 'none' && !(editMode && depth > 0)) {
      d.classList.add('act');   // pas d'infobulle : le lecteur n'a pas à lire « Aller à la diapo 6 »
      d.addEventListener('click', function (ev) { ev.stopPropagation(); doAction(el); });
    }
  } else {
    if (el.type === 'video') {
      var cov = document.createElement('div');
      cov.className = 'vcover';
      d.appendChild(cov);
    }
    if (depth === 0 && i >= els().length) d.classList.add('master');
    if (sel === i) {
      d.classList.add('sel');
      ['se', 'nw'].forEach(function (c) {
        var h = document.createElement('div');
        h.className = 'hdl hdl-' + c;
        h.dataset.corner = c;
        d.appendChild(h);
      });
    }
    attachEdit(d, i, el);
  }
  return d;
}

/* Textes et boutons sont dimensionnés en % de la hauteur de leur conteneur —
   la diapo, ou le panneau qui les affiche : ils gardent leurs proportions
   quelle que soit la taille de la fenêtre, et se réduisent dans un panneau. */
function scaleText() {
  scalables.forEach(function (s) {
    var H = s.box.clientHeight || 1;
    if (s.kind === 'button') {
      // le texte remplit le cadre dessiné : la marge dépend du style choisi,
      // un bouton plein en réclame plus qu'un texte seul
      var st = btnStyle(s.el);
      var f = BTN_FLAT[st] ? 0.62 : st === 'bloc' ? 0.4 : 0.44;
      s.node.style.fontSize =
        Math.max(9, s.el.size ? H * s.el.size / 100 : H * s.el.h / 100 * f) + 'px';
      return;
    }
    s.node.style.fontSize = Math.max(7, H * (s.el.size || 6) / 100) + 'px';
    // hauteur automatique : le cadre épouse toujours le texte, qui ne déborde
    // donc jamais quand on change la taille ou le libellé. On ne réécrit le
    // modèle que pour un élément posé sur la diapo, jamais depuis un panneau.
    s.node.style.height = 'auto';
    var hp = r2(s.node.offsetHeight / H * 100);
    if (hp > 0.5) {
      if (s.top) s.el.h = hp;
      s.node.style.height = hp + '%';
    }
  });
}

/* Copie dans le presse-papiers — pratique pour un chemin serveur.
   Repli sur execCommand là où l'API n'est pas disponible en file://. */
function copyText(txt) {
  var done = function () { toast('Copié : ' + (txt.length > 40 ? txt.slice(0, 40) + '…' : txt)); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(done, function () { legacyCopy(txt, done); });
  } else legacyCopy(txt, done);
}
function legacyCopy(txt, done) {
  var ta = document.createElement('textarea');
  ta.value = txt;
  ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { alert(txt); }
  ta.remove();
}

function actionTitle(el) {
  switch (el.action) {
    case 'goto': return (FR ? 'Aller à la diapo ' : 'Go to slide ') + ((el.slide || 0) + 1);
    case 'url': return el.url || '';
    case 'video': return FR ? 'Lire la vidéo' : 'Play video';
    case 'back': return T.back;
    case 'next': return FR ? 'Diapo suivante' : 'Next';
    case 'prev': return FR ? 'Diapo précédente' : 'Previous';
    case 'panel': return (el.slide == null || el.slide < 0)
      ? 'Vider le panneau' : 'Afficher la diapo ' + (el.slide + 1) + ' dans le panneau';
  }
  return '';
}
function doAction(el) {
  switch (el.action) {
    case 'goto': go(el.slide || 0); break;
    case 'next': go(linNext()); break;
    case 'prev': go(linPrev()); break;
    case 'back': goBack(); break;
    case 'url': if (el.url) window.open(el.url, '_blank'); break;
    case 'video': openLightbox(el.video); break;
    case 'copy': copyText(el.copyText || ''); break;
    case 'overlay':
      if (el.slide === -2 && el.media) { openImageOverlay(MEDIA(el.media)); break; }
      var seq = overlaySeq(el);
      if (seq.length) openSlideOverlay(seq, 0);
      break;
    case 'panel': {
      // on reste sur la diapo : seul le contenu du panneau change.
      // Sans panneau nommé explicitement, on vise celui de la diapo.
      var ps = panelsHere();
      var target = el.panelName || (ps[0] ? panelKey(ps[0]) : 'Panneau');
      panelState[target] = (el.slide == null || el.slide < 0) ? null : el.slide;
      renderElements();
      break;
    }
  }
}

/* ============================ édition à la souris ============================ */
/* Le double-clic est détecté à la main : on annule l'événement pointerdown pour
   déplacer l'élément, ce qui supprime aussi le dblclick que le navigateur
   aurait produit. Et de toute façon le premier clic redessine les éléments :
   le second n'arriverait plus sur le même nœud. */
var lastTap = { i: -1, t: 0 };
function attachEdit(d, i, el) {
  d.addEventListener('pointerdown', function (e) {
    if (!editMode || drawMode || d.getAttribute('contenteditable') === 'true') return;
    e.preventDefault();
    e.stopPropagation();
    if (el.type === 'text' && lastTap.i === i && Date.now() - lastTap.t < 450) {
      lastTap.t = 0;
      select(i);
      var n2 = nodes()[i];
      if (n2) editText(n2, el);
      return;
    }
    lastTap = { i: i, t: Date.now() };
    select(i);
    var corner = e.target.dataset ? e.target.dataset.corner : null;
    var p = relPct(e);
    drag = { mode: corner ? 'resize' : 'move', corner: corner, o: el, i: i,
             x0: p.x, y0: p.y, ox: el.x, oy: el.y, ow: el.w, oh: el.h, moved: false,
             ratio: el.type === 'image' && el.h ? el.w / el.h : 0 };
    undoStack.push(snapshot());     // instantané pris avant le déplacement…
    redoStack.length = 0;
    try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
  });
}

function editText(d, el) {
  pushUndo();
  // on tape du texte brut : la forme du bouton est refaite à la sortie
  d.textContent = el.text || '';
  d.setAttribute('contenteditable', 'true');
  d.focus();
  var range = document.createRange();
  range.selectNodeContents(d);
  var s = window.getSelection();
  s.removeAllRanges();
  s.addRange(range);
  d.addEventListener('blur', function () {
    d.removeAttribute('contenteditable');
    el.text = d.textContent;
    markDirty();
    renderElements();
    renderProps();
  }, { once: true });
  d.addEventListener('keydown', function (e) {
    e.stopPropagation();
    if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); d.blur(); }
  });
}

function select(i) { sel = i; renderElements(); renderProps(); }
function deselect() { sel = null; renderElements(); renderProps(); }

/* Petite barre au-dessus de l'élément sélectionné : les gestes les plus
   fréquents sous la main, sans traverser l'écran jusqu'au panneau. */
function placeFloatbar() {
  var fb = $('floatbar');
  var node = sel == null ? null : nodes()[sel];
  if (!editMode || !node || drag) { fb.classList.add('hidden'); return; }
  var r = node.getBoundingClientRect();
  fb.classList.remove('hidden');
  var w = fb.offsetWidth || 150;
  var top = r.top - fb.offsetHeight - 8;
  if (top < 60) top = r.bottom + 8;
  fb.style.top = Math.round(top) + 'px';
  fb.style.left = Math.round(clamp(r.left + r.width / 2 - w / 2, 8, window.innerWidth - w - 8)) + 'px';
}
$('floatbar').addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b || sel == null) return;
  var what = b.dataset.fb;
  if (what === 'dup') duplicate();
  else if (what === 'del') deleteSel();
  else { pushUndo(); moveSel(what); }
});

/* aimantation : bords et centre de la diapo, bords des autres éléments */
function showGuide(kind, pos) {
  var g = document.createElement('div');
  g.className = 'guide ' + kind;
  if (kind === 'v') g.style.left = pos + '%'; else g.style.top = pos + '%';
  wrap.appendChild(g);
}
function snapMove(o, i) {
  wrap.querySelectorAll('.guide').forEach(function (n) { n.remove(); });
  var tol = 0.7, xs = [0, 50, 100], ys = [0, 50, 100];
  allEls().forEach(function (e2, j) {
    if (j === i) return;
    xs.push(e2.x, e2.x + e2.w / 2, e2.x + e2.w);
    ys.push(e2.y, e2.y + e2.h / 2, e2.y + e2.h);
  });
  [['x', 'w', xs, 'v'], ['y', 'h', ys, 'h']].forEach(function (a) {
    var k = a[0], dim = a[1], list = a[2], kind = a[3];
    var edges = [[o[k], 0], [o[k] + o[dim] / 2, o[dim] / 2], [o[k] + o[dim], o[dim]]];
    for (var e = 0; e < edges.length; e++) {
      for (var t = 0; t < list.length; t++) {
        if (Math.abs(edges[e][0] - list[t]) < tol) {
          o[k] = r2(list[t] - edges[e][1]);
          showGuide(kind, list[t]);
          return;
        }
      }
    }
  });
}

wrap.addEventListener('pointerdown', function (e) {
  if (!editMode) return;
  if (drawMode) {
    e.preventDefault();
    var p = relPct(e);
    pushUndo();
    var el = newElement(drawMode, p.x, p.y);
    els().push(el);
    sel = els().length - 1;
    renderElements();
    drag = { mode: 'draw', o: el, i: sel, x0: p.x, y0: p.y, moved: false };
    try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
  } else if (e.target === slideEl || e.target === wrap) deselect();
});

wrap.addEventListener('pointermove', function (e) {
  if (!drag) return;
  var p = relPct(e), o = drag.o;
  if (Math.abs(p.x - drag.x0) > 0.2 || Math.abs(p.y - drag.y0) > 0.2) drag.moved = true;
  if (drag.mode === 'draw') {
    o.x = r2(Math.min(p.x, drag.x0)); o.y = r2(Math.min(p.y, drag.y0));
    o.w = r2(Math.abs(p.x - drag.x0)); o.h = r2(Math.abs(p.y - drag.y0));
  } else if (drag.mode === 'move') {
    o.x = r2(clamp(drag.ox + (p.x - drag.x0), -o.w / 2, 100 - o.w / 2));
    o.y = r2(clamp(drag.oy + (p.y - drag.y0), -o.h / 2, 100 - o.h / 2));
    if (!e.altKey) snapMove(o, drag.i);
  } else if (drag.corner === 'nw') {
    var rx = drag.ox + drag.ow, ry = drag.oy + drag.oh;
    o.x = r2(clamp(p.x, -50, rx - 1)); o.y = r2(clamp(p.y, -50, ry - 1));
    o.w = r2(rx - o.x); o.h = r2(ry - o.y);
    if (drag.ratio && !e.shiftKey) { o.h = r2(o.w / drag.ratio); o.y = r2(ry - o.h); }
  } else {
    o.w = r2(clamp(drag.ow + (p.x - drag.x0), 1, 160));
    // un texte n'a pas de hauteur propre : elle suit son contenu (scaleText)
    if (o.type !== 'text') o.h = r2(clamp(drag.oh + (p.y - drag.y0), 1, 160));
    if (drag.ratio && !e.shiftKey) o.h = r2(o.w / drag.ratio);
  }
  var node = nodes()[drag.i];
  if (node) setRect(node, o);
  $('floatbar').classList.add('hidden');
  scaleText();
});

function endDrag(e) {
  if (!drag) return;
  wrap.querySelectorAll('.guide').forEach(function (n) { n.remove(); });
  if (drag.mode === 'draw') {
    var o = drag.o;
    if (!drag.moved || o.w < 1.5 || o.h < 1.5) {     // simple clic : taille par défaut
      var d = defaultSize(o.type);
      o.w = d.w; o.h = d.h;
      o.x = r2(clamp(o.x - d.w / 2, 0, 100 - d.w));
      o.y = r2(clamp(o.y - d.h / 2, 0, 100 - d.h));
    }
    setDraw(false);
    markDirty();
  } else if (drag.moved) markDirty();
  else undoStack.pop();                              // …reposé si rien n'a bougé
  drag = null;
  syncUndoButtons();
  renderElements();
  renderProps();
  if (e && e.pointerId != null) { try { wrap.releasePointerCapture(e.pointerId); } catch (err) {} }
}
wrap.addEventListener('pointerup', endDrag);
wrap.addEventListener('pointercancel', endDrag);

/* ============================ création d'éléments ============================ */
function defaultSize(type) {
  return type === 'text' ? { w: 40, h: 10 }
    : type === 'zone' ? { w: 22, h: 9 }
    : type === 'video' ? { w: 50, h: 45 }
    : type === 'panel' ? { w: 56, h: 50 }
    : { w: 30, h: 22 };
}
function newElement(type, x, y) {
  var base = { type: type, x: r2(x), y: r2(y), w: 0, h: 0 };
  if (type === 'zone')
    return assign(base, { action: 'goto', slide: Math.min(cur + 1, SLIDES.length - 1),
                          look: 'button', label: 'Bouton', color: '#5b8cff' });
  if (type === 'text')
    return assign(base, { text: 'Ton texte', size: 6, color: '#ffffff', weight: '600',
                          align: 'left', shadow: true, action: 'none' });
  if (type === 'shape')
    return assign(base, { shape: 'rect', color: '#5b8cff', opacity: 0.85, radius: 10, action: 'none' });
  if (type === 'panel') {
    var n = 1, taken = {};
    panelsHere().forEach(function (p) { taken[panelKey(p)] = 1; });
    while (taken['Panneau ' + n]) n++;
    return assign(base, { name: 'Panneau ' + n, radius: 10, shadow: true,
                          bg: 'rgba(10,12,17,.92)', bgHex: '#0a0c11' });
  }
  return base;
}
function addElement(el, msg) {
  pushUndo();
  els().push(el);
  select(els().length - 1);
  buildThumbs();
  if (msg) toast(msg);
}
function newMediaId() { var n = 1; while (ASSETS.media['m' + n]) n++; return 'm' + n; }

function pickFile(accept, cb) {
  var f = $('filePick');
  f.accept = accept;
  f.onchange = function (e) {
    var file = e.target.files[0];
    e.target.value = '';
    if (file) cb(file);
  };
  f.click();
}
function readAsMedia(file, cb) {
  var r = new FileReader();
  r.onload = function () {
    var m = /^data:([^;]+);base64,([\s\S]*)$/.exec(r.result);
    if (!m) { alert('Lecture du fichier impossible.'); return; }
    var id = newMediaId();
    ASSETS.media[id] = { mime: m[1] || file.type, data: m[2] };
    cb(id, r.result);
  };
  r.readAsDataURL(file);
}
function addImageFile(file) {
  if (file.size > 25 * 1024 * 1024 &&
      !confirm('Image de ' + Math.round(file.size / 1e6) + ' Mo : le HTML final sera lourd. Continuer ?')) return;
  readAsMedia(file, function (id, dataUrl) {
    var probe = new Image();
    var place = function (w, h) {
      addElement({ type: 'image', media: id, x: r2((100 - w) / 2), y: r2((100 - h) / 2),
                   w: w, h: h, fit: 'contain', radius: 0, action: 'none' }, 'Image ajoutée');
    };
    probe.onload = function () {
      var box = wrap.getBoundingClientRect();
      var slideRatio = (box.width / box.height) || 1.777;
      var ratio = (probe.width / probe.height) || 1;
      var w = 40, h = r2(w / ratio * slideRatio);
      if (h > 70) { h = 70; w = r2(h * ratio / slideRatio); }
      place(w, h);
    };
    probe.onerror = function () { place(40, 30); };
    probe.src = dataUrl;
  });
}
function addVideoFile(file) {
  if (file.size > 60 * 1024 * 1024 &&
      !confirm('Fichier de ' + Math.round(file.size / 1e6) + ' Mo : le HTML final sera très lourd. Continuer ?')) return;
  readAsMedia(file, function (id) {
    addElement({ type: 'video', media: id, x: 25, y: 25, w: 50, h: 45, controls: true }, 'Vidéo ajoutée');
  });
}

var menu = $('menu');
function openMenu(anchor, items) {
  menu.innerHTML = '';
  items.forEach(function (it) {
    var b = document.createElement('button');
    b.textContent = it[0];
    b.onclick = function () { menu.classList.add('hidden'); it[1](); };
    menu.appendChild(b);
  });
  var r = anchor.getBoundingClientRect();
  menu.classList.remove('hidden');
  menu.style.top = (r.bottom + 6) + 'px';
  menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 8)) + 'px';
}
document.addEventListener('click', function (e) {
  if (!menu.classList.contains('hidden') && !menu.contains(e.target)) menu.classList.add('hidden');
});

/* ============================ panneau propriétés ============================ */
function opt(v, label, curv) {
  return '<option value="' + escA(v) + '"' + (String(curv) === String(v) ? ' selected' : '') +
    '>' + esc(label) + '</option>';
}
/* Sur quelles pages un élément commun apparaît. Sans liste, il est partout —
   c'est le comportement d'origine, et celui des packs déjà faits. */
function pagesFields(el) {
  var some = !!el.pages;
  var h = '<label>Sur quelles pages<select id="pMScope">' +
    opt('all', 'Toutes les pages', some ? 'some' : 'all') +
    opt('some', 'Les pages que je choisis', some ? 'some' : 'all') +
    '</select></label>';
  if (!some) return h;
  h += '<div class="pagepick">';
  SLIDES.forEach(function (s, i) {
    h += '<label class="ck"><input type="checkbox" data-mp="' + i + '"' +
      (el.pages.indexOf(i) >= 0 ? ' checked' : '') + '><span>' +
      (i + 1) + '. ' + esc(slideOpt(i)) + '</span></label>';
  });
  h += '</div><div class="pagebtns"><button id="pMAll">Tout cocher</button>' +
    '<button id="pMNone">Tout décocher</button>' +
    '<button id="pMHere">Cette page seule</button></div>' +
    '<p class="muted" id="pMHint">' + pagesHint(el) + '</p>';
  return h;
}
function pagesHint(el) {
  if (!el.pages || !el.pages.length) return 'Aucune page cochée : cet élément n’apparaîtra nulle part.';
  var ici = el.pages.indexOf(cur) >= 0;
  return el.pages.length + ' page(s) cochée(s)' +
    (ici ? '.' : ' — pas celle-ci, il s’affiche donc en transparence ici.');
}

/* Apparence d'un élément cliquable. Le principe : la forme colle au texte,
   comme un bouton de site, plutôt qu'un rectangle plaqué par-dessus. */
function btnFields(el) {
  var st = btnStyle(el), zone = el.type === 'zone';
  var h = '<label>Style du bouton<select id="pBtn">' +
    opt('plain', 'Texte seul', st) +
    opt('link', 'Lien souligné au survol', st) +
    opt('ghost', 'Contour fin', st) +
    opt('pill', 'Pastille pleine', st) +
    opt('soft', 'Verre dépoli', st) +
    opt('bloc', 'Bandeau (remplit le cadre)', st) +
    '</select></label>';
  if (zone)
    h += '<div class="grid2"><label>Texte<input type="text" id="pLbl" value="' +
      escA(el.label || '') + '"></label>' +
      '<label>Icône<input type="text" id="pIcon" value="' + escA(el.icon || '') +
      '" placeholder="→"></label></div>';
  if (zone || !BTN_FLAT[st])
    h += '<label>Couleur' + (BTN_FLAT[st] ? ' du texte' : ' du bouton') +
      '<input type="color" id="pBtnCol" value="' + btnFill(el) + '"></label>';
  if (st === 'ghost' || st === 'soft' || st === 'bloc')
    h += '<label>Arrondi <span class="muted">' + (el.radius == null ? 8 : el.radius) +
      ' px</span><input type="range" id="pRadius" min="0" max="60" value="' +
      (el.radius == null ? 8 : el.radius) + '"></label>';
  if (zone)
    h += '<label>Taille du texte <span class="muted">' +
      (el.size ? el.size + ' %' : 'auto') + '</span>' +
      '<input type="range" id="pBSize" min="0" max="16" step="0.5" value="' +
      (el.size || 0) + '"></label>';
  h += '<p class="muted">Le cadre ne sert qu’à placer le bouton : c’est le ' +
    'texte qui prend la forme, et lui seul réagit au clic.</p>';
  return h;
}
function actionFields(el) {
  var panels = panelsHere();
  var h = '<label>Au clic<select id="pAct">' +
    opt('none', 'Rien', el.action || 'none') +
    opt('goto', 'Aller à une diapo', el.action) +
    (panels.length ? opt('panel', 'Afficher une diapo dans le panneau', el.action) : '') +
    opt('next', 'Diapo suivante', el.action) +
    opt('prev', 'Diapo précédente', el.action) +
    opt('back', 'Retour (diapo précédemment vue)', el.action) +
    opt('url', 'Ouvrir un lien', el.action) +
    opt('video', 'Lire une vidéo en grand', el.action) +
    opt('copy', 'Copier un texte (chemin serveur…)', el.action) +
    opt('overlay', 'Ouvrir en grand par-dessus la page', el.action) +
    '</select></label>';
  if (el.action === 'panel') {
    if (panels.length > 1) {
      h += '<label>Quel panneau<select id="pPanel">';
      panels.forEach(function (p) { h += opt(panelKey(p), panelKey(p), el.panelName); });
      h += '</select></label>';
    }
    h += '<label>Contenu à afficher<select id="pTgt">' +
      opt(-1, '— vider le panneau —', el.slide);
    SLIDES.forEach(function (t, i) {
      h += opt(i, slideOpt(i), el.slide);
    });
    h += '</select></label>';
  }
  if (el.action === 'goto') {
    h += '<label>Diapo cible<select id="pTgt">';
    SLIDES.forEach(function (t, i) {
      h += opt(i, slideOpt(i), el.slide);
    });
    h += '</select></label>';
  }
  if (el.action === 'overlay') {
    h += '<label>Ce qui s’ouvre<select id="pTgt">' +
      (el.type === 'image' ? opt(-2, '— cette image, en grand —', el.slide) : '');
    SLIDES.forEach(function (t, i) {
      h += opt(i, slideOpt(i), el.slide);
    });
    h += '</select></label>';
    if (el.slide !== -2) {
      h += '<p class="muted">Ajoute d’autres diapos pour les feuilleter dans la ' +
        'fenêtre : des flèches et un compteur apparaissent.</p><div id="navList">';
      (el.list || []).forEach(function (idx, i) {
        h += '<div class="row2"><input type="text" value="' + escA(slideName(idx)) +
          '" disabled><button data-galdel="' + i + '">✕</button></div>';
      });
      h += '</div><label>Ajouter au défilement<select id="pGalAdd">' +
        '<option value="">— choisir une diapo —</option>';
      SLIDES.forEach(function (t, i) {
        h += '<option value="' + i + '">' + esc(slideOpt(i)) + '</option>';
      });
      h += '</select></label>';
    }
    h += '<p class="muted">Le lecteur reste sur la page : ' +
      '<b>Échap</b> ou un clic à côté referme.</p>';
  }
  if (el.action === 'url')
    h += '<label>URL<input type="text" id="pUrl" value="' + escA(el.url || '') + '" placeholder="https://…"></label>';
  if (el.action === 'copy')
    h += '<label>Texte à copier<textarea id="pCopy" placeholder="\\\\serveur\\projet\\rigs\\pipo">' +
      esc(el.copyText || '') + '</textarea></label>';
  if (el.action === 'video') {
    var vv = el.video || {};
    h += '<label>Vidéo<select id="pVSrc">' + opt('yt', 'Lien YouTube', vv.media ? '' : 'yt');
    Object.keys(ASSETS.media).forEach(function (id) {
      if ((ASSETS.media[id].mime || '').indexOf('video') === 0)
        h += opt(id, 'Vidéo embarquée ' + id, vv.media || '');
    });
    h += '</select></label>';
    if (!vv.media)
      h += '<label>Lien YouTube<input type="text" id="pVUrl" value="' + escA(vv.url || '') + '"></label>';
    h += '<button class="wide" id="pVFile">📁 Choisir un fichier vidéo local</button>';
  }
  return h;
}

/* Réglages valables pour toute la présentation : ce que voit le lecteur
   autour de la diapo. Tout décocher = expérience immersive, où l'on ne
   navigue plus qu'avec les boutons posés sur les pages. */
var VIEW_LABELS = {
  arrows: 'Navigation libre (flèches, clic sur les côtés, swipe)',
  counter: 'Compteur de diapos',
  progress: 'Barre de progression',
  thumbs: 'Bandeau de vignettes',
  header: 'Barre du haut'
};
function viewFields() {
  var v = META.view;
  var h = '<hr><h3>Ce que voit le lecteur</h3>';
  VIEW_KEYS.forEach(function (k) {
    h += '<label class="ck"><input type="checkbox" id="v_' + k + '"' +
      (v[k] ? ' checked' : '') + '><span>' + VIEW_LABELS[k] + '</span></label>';
  });
  var immersive = VIEW_KEYS.every(function (k) { return !v[k]; });
  h += '<label class="ck"><input type="checkbox" id="v_full"' + (v.full ? ' checked' : '') +
    '><span>Page plein cadre (sans marge ni ombre)</span></label>' +
    '<div class="pbtns"><button id="vSite">🌐 Site</button>' +
    '<button id="vSlideshow">📄 Diaporama</button>' +
    '<button id="vImmersive">🔒 Kiosque</button></div>' +
    '<p class="muted" style="margin-top:8px"><b>Site</b> : rien autour de la page, ' +
    'on navigue par tes boutons, le clavier reste actif en secours. ' +
    '<b>Diaporama</b> : compteur, progression et vignettes. ' +
    '<b>Kiosque</b> : plus aucune navigation libre.</p>';
  h += '<label>Transition entre les pages<select id="vTrans">' +
    opt('none', 'Aucune (coupe franche)', META.transition) +
    opt('fade', 'Fondu', META.transition) +
    opt('slide', 'Glissement', META.transition) +
    opt('zoom', 'Zoom', META.transition) +
    opt('up', 'Vers le haut', META.transition) +
    '</select></label>';
  h += '<hr><h3>Sommaire</h3><p class="muted">Une barre toujours visible pour ' +
    'sauter d’une partie à l’autre, sans repasser par toutes les pages.</p>' +
    '<div id="navList">';
  META.nav.forEach(function (it, i) {
    h += '<div class="row2"><input type="text" data-nav="' + i + '" value="' + escA(it.label) +
      '" title="Diapo ' + (it.slide + 1) + '"><button data-navdel="' + i + '">✕</button></div>';
  });
  h += '</div><button class="wide" id="vNavAdd">➕ Ajouter la diapo ' + (cur + 1) + ' au sommaire</button>';
  if (!v.arrows)
    h += '<p class="muted" style="margin-top:10px">Navigation libre coupée : ' +
      'le lecteur ne peut avancer <b>que</b> par les boutons que tu poses. ' +
      'Vérifie que chaque page en a au moins un.' +
      (immersive ? '<br>La touche <b>E</b> reste ton accès à l’édition.' : '') + '</p>';
  return h;
}
function bindViewFields() {
  VIEW_KEYS.concat(['full']).forEach(function (k) {
    var n = $('v_' + k);
    if (n) n.addEventListener('change', function (e) {
      META.view[k] = e.target.checked;
      markDirty();
      applyViewChrome();
      renderProps();
    });
  });
  var profil = function (cfg2, msg) {
    return function () {
      assign(META.view, cfg2);
      markDirty();
      applyViewChrome();
      renderProps();
      toast(msg);
    };
  };
  var w2 = function (id, fn) { var n = $(id); if (n) n.addEventListener('click', fn); };
  w2('vSite', profil({ arrows: true, counter: false, progress: false, thumbs: false,
                       header: false, full: true }, 'Mode site : rien autour de la page'));
  w2('vSlideshow', profil({ arrows: true, counter: true, progress: true, thumbs: true,
                            header: true, full: false }, 'Mode diaporama : tous les repères'));
  w2('vImmersive', profil({ arrows: false, counter: false, progress: false, thumbs: false,
                            header: false, full: true },
                          'Kiosque : on ne navigue plus que par les boutons'));

  var tr = $('vTrans');
  if (tr) tr.addEventListener('change', function (e) {
    META.transition = e.target.value;
    markDirty();
    toast('Transition : ' + e.target.selectedOptions[0].textContent);
  });
  var add = $('vNavAdd');
  if (add) add.addEventListener('click', function () {
    if (META.nav.some(function (it) { return it.slide === cur; })) { toast('Déjà au sommaire'); return; }
    META.nav.push({ label: slideName(cur), slide: cur });
    META.nav.sort(function (x, y) { return x.slide - y.slide; });
    markDirty();
    renderProps();
  });
  props.querySelectorAll('[data-nav]').forEach(function (n) {
    n.addEventListener('input', function (e) {
      META.nav[+e.target.dataset.nav].label = e.target.value;
      markDirty();
    });
  });
  props.querySelectorAll('[data-navdel]').forEach(function (n) {
    n.addEventListener('click', function (e) {
      META.nav.splice(+e.currentTarget.dataset.navdel, 1);
      markDirty();
      renderProps();
    });
  });
}

function renderProps() {
  if (!editMode) { props.classList.add('hidden'); return; }
  props.classList.remove('hidden');
  if (auditMode) { renderAudit(auditMode === 'export'); return; }
  var s = SLIDES[cur], el = selEl();
  var h = '<h3>' + esc(slideName(cur)) + ' — ' + (cur + 1) + ' / ' + SLIDES.length + '</h3>' +
    '<label>Nom de la page<input type="text" id="pSlideName" value="' + escA(s.name || '') +
    '" placeholder="' + escA('Diapo ' + (cur + 1)) + '"></label>' +
    '<label class="ck"><input type="checkbox" id="pHid"' + (s.hidden ? ' checked' : '') +
    '><span>Diapo cachée — hors navigation, accessible uniquement via un bouton</span></label>';

  if (!el) {
    h += '<hr><p class="muted">' +
      'Ajoute un élément avec la barre du haut, ou clique sur un élément de la diapo pour le modifier.' +
      '<br><br>' +
      '• <b>glisser</b> pour déplacer — ça s’aimante tout seul (<b>Alt</b> pour l’en empêcher)<br>' +
      '• <b>poignées orange</b> pour redimensionner<br>' +
      '• <b>flèches</b> pour ajuster finement, <b>Ctrl+D</b> dupliquer, <b>Suppr</b> effacer<br>' +
      '• <b>Ctrl+Z</b> annuler · <b>Ctrl+V</b> coller une image du presse-papiers<br>' +
      '• <b>double-clic</b> sur un texte pour le réécrire<br>' +
      '• une image peut aussi être <b>déposée</b> directement sur la diapo<br>' +
      '• coche <b>Sur toutes les pages</b> sur un élément (logo, bouton d’accueil) ' +
      'pour qu’il suive partout — tu ne le modifies qu’une fois' +
      '<br><br>' +
      'N’importe quel élément peut devenir cliquable : une image ou un texte font ' +
      'de très bons boutons.<br><br>' +
      '<b>🗔 Panneau</b> : une fenêtre qui affiche une AUTRE diapo à l’intérieur ' +
      'de celle-ci. Idéal pour un écran de sélection : les boutons restent à ' +
      'l’écran, seul le contenu du panneau change.</p>' +
      viewFields();
    props.innerHTML = h;
    bindSlideFields(s);
    bindViewFields();
    return;
  }

  var names = { zone: 'Zone cliquable', image: 'Image', text: 'Texte', shape: 'Forme',
                video: 'Vidéo', panel: 'Panneau' };
  var isMaster = ownerOf(sel).master;
  h += '<hr><h3>' + names[el.type] + (isMaster ? ' — commun' : '') + '</h3>' +
    '<label class="ck"><input type="checkbox" id="pMaster"' + (isMaster ? ' checked' : '') +
    '><span>Le même sur plusieurs pages — un seul exemplaire à modifier, ' +
    'il suit partout</span></label>';
  if (isMaster) h += pagesFields(el);

  if (el.type === 'zone') {
    h += actionFields(el) +
      '<label>Apparence<select id="pLook">' +
      opt('hover', 'Invisible (halo au survol)', el.look || 'hover') +
      opt('outline', 'Contour visible', el.look || 'hover') +
      opt('button', 'Bouton avec un texte', el.look || 'hover') +
      '</select></label>';
    if ((el.look || 'hover') === 'button') {
      h += btnFields(el);
    } else {
      h += '<label>Arrondi des coins <span class="muted">' + (el.radius == null ? 6 : el.radius) +
        ' px</span><input type="range" id="pRadius" min="0" max="90" value="' +
        (el.radius == null ? 6 : el.radius) + '"></label>';
      if ((el.look || 'hover') === 'hover')
        h += '<p class="muted">Règle-le pour épouser la forme du bouton que tu as ' +
          'dessiné dans Slides : sinon les coins de la zone réagissent en dehors de lui.</p>';
    }
  } else if (el.type === 'text') {
    h += '<label>Texte<textarea id="pText">' + esc(el.text || '') + '</textarea></label>' +
      '<div class="grid2">' +
      '<label>Couleur<input type="color" id="pColor" value="' + (el.color || '#ffffff') + '"></label>' +
      '<label>Alignement<select id="pAlign">' +
      opt('left', 'Gauche', el.align) + opt('center', 'Centré', el.align) + opt('right', 'Droite', el.align) +
      '</select></label></div>' +
      '<label>Taille du texte <span class="muted">' + (el.size || 6) + ' %</span>' +
      '<input type="range" id="pSize" min="2" max="20" step="0.5" value="' + (el.size || 6) + '"></label>' +
      '<label>Graisse<select id="pWeight">' +
      opt('400', 'Normale', el.weight) + opt('600', 'Semi-grasse', el.weight) + opt('800', 'Grasse', el.weight) +
      '</select></label>' +
      '<label class="ck"><input type="checkbox" id="pShadow"' + (el.shadow ? ' checked' : '') +
      '><span>Ombre portée (lisible sur fond chargé)</span></label>';
    // un texte-bouton habille sa propre forme : le fond du cadre ferait doublon
    var tSt = el.action && el.action !== 'none' ? btnStyle(el) : null;
    if (!tSt || BTN_FLAT[tSt])
      h += '<label class="ck"><input type="checkbox" id="pBgOn"' + (el.bg ? ' checked' : '') +
        '><span>Fond coloré</span></label>' +
        (el.bg ? '<label>Couleur du fond<input type="color" id="pBg" value="' + el.bg + '"></label>' : '');
    h += actionFields(el);
    if (tSt) h += btnFields(el);
  } else if (el.type === 'image') {
    h += '<label>Cadrage<select id="pFit">' +
      opt('contain', 'Image entière', el.fit) +
      opt('cover', 'Remplir le cadre (recadre)', el.fit) +
      opt('fill', 'Étirer', el.fit) +
      '</select></label>' +
      '<label>Coins arrondis <span class="muted">' + (el.radius || 0) + ' px</span>' +
      '<input type="range" id="pRadius" min="0" max="60" value="' + (el.radius || 0) + '"></label>' +
      '<label class="ck"><input type="checkbox" id="pShadow"' + (el.shadow ? ' checked' : '') +
      '><span>Ombre portée</span></label>' +
      '<button class="wide" id="pReplace">🔁 Remplacer l’image</button>' +
      actionFields(el);
  } else if (el.type === 'shape') {
    h += '<label>Forme<select id="pShape">' +
      opt('rect', 'Rectangle', el.shape) + opt('ellipse', 'Ellipse', el.shape) +
      '</select></label>' +
      '<label>Couleur<input type="color" id="pColor" value="' + (el.color || '#5b8cff') + '"></label>' +
      '<label>Coins arrondis <span class="muted">' + (el.radius || 0) + ' px</span>' +
      '<input type="range" id="pRadius" min="0" max="80" value="' + (el.radius || 0) + '"></label>' +
      actionFields(el);
  } else if (el.type === 'panel') {
    h += '<p class="muted">Une fenêtre qui affiche une autre diapo à l’intérieur ' +
      'de celle-ci. Les boutons de la diapo restent visibles et changent le ' +
      'contenu du panneau, sans changer de page.</p>' +
      '<label>Nom du panneau<input type="text" id="pName" value="' + escA(panelKey(el)) + '"></label>' +
      '<label>Contenu au départ<select id="pDefault">' +
      opt(-1, '— vide —', typeof el.slide === 'number' ? el.slide : -1);
    SLIDES.forEach(function (t, i) {
      h += opt(i, slideOpt(i), typeof el.slide === 'number' ? el.slide : -1);
    });
    h += '</select></label>';
    h += '<hr><h3>Galerie</h3><p class="muted">Mets plusieurs diapos dans ce ' +
      'panneau : des flèches et un compteur apparaissent, et on défile dedans.</p>' +
      '<div id="navList">';
    (el.list || []).forEach(function (idx, i) {
      h += '<div class="row2"><input type="text" value="' + escA(slideName(idx)) +
        '" disabled><button data-galdel="' + i + '">✕</button></div>';
    });
    h += '</div><label>Ajouter au défilement<select id="pGalAdd"><option value="">— choisir une diapo —</option>';
    SLIDES.forEach(function (t, i) {
      h += '<option value="' + i + '">' + esc(slideOpt(i)) + '</option>';
    });
    h += '</select></label>';
    if ((el.list || []).length > 1)
      h += '<label>Défilement auto <span class="muted">' +
        (el.auto ? el.auto + ' s' : 'désactivé') + '</span>' +
        '<input type="range" id="pAuto2" min="0" max="15" step="1" value="' + (el.auto || 0) + '"></label>';
    h += '<hr>' +
      '<label>Coins arrondis <span class="muted">' + (el.radius == null ? 10 : el.radius) + ' px</span>' +
      '<input type="range" id="pRadius" min="0" max="60" value="' + (el.radius == null ? 10 : el.radius) + '"></label>' +
      '<label>Fond<input type="color" id="pBgPanel" value="' + (el.bgHex || '#0a0c11') + '"></label>' +
      '<label class="ck"><input type="checkbox" id="pShadow"' + (el.shadow !== false ? ' checked' : '') +
      '><span>Ombre portée</span></label>';
  } else if (el.type === 'video') {
    if (el.url) h += '<p class="muted">YouTube :<br>' + esc(el.url) + '</p>';
    else h += '<label class="ck"><input type="checkbox" id="pCtl"' + (el.controls !== false ? ' checked' : '') +
      '><span>Contrôles de lecture</span></label>' +
      '<label class="ck"><input type="checkbox" id="pAuto"' + (el.autoplay ? ' checked' : '') +
      '><span>Lecture auto (sans le son)</span></label>' +
      '<label class="ck"><input type="checkbox" id="pLoop"' + (el.loop ? ' checked' : '') +
      '><span>En boucle</span></label>';
  }

  h += '<hr><button class="wide" id="advTgl">' + (advOpen ? '▾' : '▸') +
    ' Mouvement et survol</button><div id="advBox"' + (advOpen ? '' : ' class="hidden"') + '>' +
    '<label>Apparition<select id="pAnim">' +
    opt('none', 'Aucune', el.anim || 'none') +
    opt('fade', 'Fondu', el.anim) +
    opt('up', 'Monte', el.anim) +
    opt('down', 'Descend', el.anim) +
    opt('left', 'Vient de la gauche', el.anim) +
    opt('right', 'Vient de la droite', el.anim) +
    opt('zoom', 'Zoom', el.anim) +
    '</select></label>';
  if (el.anim && el.anim !== 'none')
    h += '<label>Retard <span class="muted">' + (el.delay || 0) + ' ms</span>' +
      '<input type="range" id="pDelay" min="0" max="1500" step="50" value="' + (el.delay || 0) + '"></label>';
  h += '<label>Au survol<select id="pHover">' +
    opt('none', 'Rien', el.hover || 'none') +
    opt('light', 'Éclaircit ce qu’il y a dessous', el.hover) +
    opt('dark', 'Assombrit ce qu’il y a dessous', el.hover) +
    opt('lift', 'Se soulève', el.hover) +
    opt('zoom', 'Grossit', el.hover) +
    opt('glow', 'S’illumine', el.hover) +
    '</select></label>';
  if ((el.look || '') === 'hover' && ['lift', 'zoom', 'glow'].indexOf(el.hover) >= 0)
    h += '<p class="muted">Une zone invisible n’a rien à soulever ni à grossir : ' +
      'préfère <b>Éclaircit</b> ou <b>Assombrit</b>, qui agissent sur le bouton ' +
      'dessiné en dessous.</p>';
  h += '</div>';

  if (el.type !== 'video')
    h += '<label>Opacité <span class="muted">' + Math.round((el.opacity == null ? 1 : el.opacity) * 100) + ' %</span>' +
      '<input type="range" id="pOpacity" min="10" max="100" value="' +
      Math.round((el.opacity == null ? 1 : el.opacity) * 100) + '"></label>';

  h += '<p class="muted" style="margin-top:12px">Dupliquer, empiler et supprimer ' +
    'sont dans la petite barre au-dessus de l’élément.</p>';

  props.innerHTML = h;
  bindSlideFields(s);
  bindElementFields(el);
}

function bindSlideFields(s) {
  var nm = $('pSlideName');
  if (nm) {
    var started = false;
    nm.addEventListener('input', function (e) {
      if (!started) { pushUndo(); started = true; }
      var v = e.target.value.trim();
      if (v) s.name = v; else delete s.name;
      markDirty();
      buildThumbs();
      // on rafraîchit le titre à la main : un renderProps() complet ferait
      // perdre le focus du champ à chaque caractère
      var t = props.querySelector('h3');
      if (t) t.textContent = slideName(cur) + ' — ' + (cur + 1) + ' / ' + SLIDES.length;
    });
    nm.addEventListener('blur', function () { started = false; renderProps(); });
  }
  var c = $('pHid');
  if (c) c.addEventListener('change', function (e) {
    pushUndo();
    s.hidden = e.target.checked;
    buildThumbs();
    refresh();
  });
}

function bindElementFields(el) {
  var on = function (id, ev, fn) {
    var n = $(id);
    if (n) n.addEventListener(ev, fn);
  };
  /* réglage ponctuel : un instantané, puis on redessine */
  var set = function (id, ev, fn, reprops) {
    on(id, ev, function (e) {
      pushUndo();
      fn(e);
      renderElements();
      if (reprops) renderProps();
    });
  };
  /* réglage continu (curseur, pipette) : un seul instantané pour tout le geste */
  var live = function (id, fn) {
    var n = $(id);
    if (!n) return;
    var started = false;
    n.addEventListener('input', function (e) {
      if (!started) { pushUndo(); started = true; }
      fn(e);
      markDirty();
      renderElements();
    });
    n.addEventListener('change', function () { started = false; renderProps(); });
  };
  /* saisie de texte : instantané au premier caractère seulement */
  var typed = function (id, fn) {
    var n = $(id);
    if (!n) return;
    var started = false;
    n.addEventListener('input', function (e) {
      if (!started) { pushUndo(); started = true; }
      fn(e);
      markDirty();
      renderElements();
    });
    n.addEventListener('blur', function () { started = false; });
  };

  set('pAct', 'change', function (e) {
    el.action = e.target.value;
    if (el.action === 'goto' && typeof el.slide !== 'number') el.slide = Math.min(cur + 1, SLIDES.length - 1);
    if (el.action === 'video' && !el.video) el.video = { url: '' };
    if (el.action === 'panel' && !el.panelName) {
      var ps = panelsHere();
      if (ps[0]) el.panelName = panelKey(ps[0]);   // le panneau de la diapo
    }
  }, true);
  set('pTgt', 'change', function (e) {
    var v = parseInt(e.target.value, 10);
    el.slide = isNaN(v) ? 0 : v;                    // -1 = vider le panneau
  });
  set('pPanel', 'change', function (e) { el.panelName = e.target.value; });
  set('pDefault', 'change', function (e) {
    var v = parseInt(e.target.value, 10);
    if (isNaN(v) || v < 0) delete el.slide; else el.slide = v;
    panelState = {};
  });
  typed('pName', function (e) {
    var old = panelKey(el);
    el.name = e.target.value;
    els().forEach(function (o) {                    // suivre le renommage
      if (o.action === 'panel' && (o.panelName || 'Panneau') === old) o.panelName = el.name;
    });
  });
  live('pBgPanel', function (e) {
    el.bgHex = e.target.value;
    el.bg = e.target.value;
  });
  set('pGalAdd', 'change', function (e) {
    if (e.target.value === '') return;
    el.list = (el.list || []).concat([parseInt(e.target.value, 10)]);
    panelState = {};
  }, true);
  live('pAuto2', function (e) { el.auto = parseInt(e.target.value, 10); });
  props.querySelectorAll('[data-galdel]').forEach(function (n) {
    n.addEventListener('click', function (e) {
      pushUndo();
      el.list.splice(+e.currentTarget.dataset.galdel, 1);
      panelState = {};
      renderElements();
      renderProps();
    });
  });
  typed('pUrl', function (e) { el.url = e.target.value.trim(); });
  typed('pCopy', function (e) { el.copyText = e.target.value; });
  set('pAnim', 'change', function (e) { el.anim = e.target.value; previewOnce(); }, true);
  live('pDelay', function (e) { el.delay = parseInt(e.target.value, 10); });
  set('pHover', 'change', function (e) { el.hover = e.target.value; });
  set('pVSrc', 'change', function (e) {
    el.video = e.target.value === 'yt' ? { url: '' } : { media: e.target.value };
  }, true);
  on('pVFile', 'click', function () {
    pickFile('video/*', function (f) {
      if (f.size > 60 * 1024 * 1024 &&
          !confirm('Fichier de ' + Math.round(f.size / 1e6) + ' Mo : le HTML final sera très lourd. Continuer ?')) return;
      readAsMedia(f, function (id) {
        pushUndo();
        el.video = { media: id };
        renderProps();
        toast('Vidéo prête — elle se lira en grand, hors ligne');
      });
    });
  });
  set('pVUrl', 'change', function (e) { el.video = { url: ytEmbed(e.target.value.trim()) }; }, true);
  set('pLook', 'change', function (e) { el.look = e.target.value; }, true);
  set('pBtn', 'change', function (e) {
    el.btn = e.target.value;
    delete el.radius;                 // chaque style a son arrondi naturel
  }, true);
  live('pBtnCol', function (e) { el.btnColor = e.target.value; });
  live('pBSize', function (e) {
    var v = parseFloat(e.target.value);
    if (v) el.size = v; else delete el.size;
  });
  typed('pLbl', function (e) { el.label = e.target.value; });
  typed('pIcon', function (e) { el.icon = e.target.value; });
  typed('pText', function (e) { el.text = e.target.value; });
  live('pCol', function (e) { el.color = e.target.value; });
  live('pColor', function (e) { el.color = e.target.value; });
  live('pBg', function (e) { el.bg = e.target.value; });
  live('pSize', function (e) { el.size = parseFloat(e.target.value); });
  live('pRadius', function (e) { el.radius = parseInt(e.target.value, 10); });
  live('pOpacity', function (e) { el.opacity = parseInt(e.target.value, 10) / 100; });
  set('pAlign', 'change', function (e) { el.align = e.target.value; });
  set('pWeight', 'change', function (e) { el.weight = e.target.value; });
  set('pShadow', 'change', function (e) { el.shadow = e.target.checked; });
  set('pBgOn', 'change', function (e) { el.bg = e.target.checked ? (el.bg || '#111318') : null; }, true);
  set('pFit', 'change', function (e) { el.fit = e.target.value; });
  set('pShape', 'change', function (e) { el.shape = e.target.value; });
  set('pCtl', 'change', function (e) { el.controls = e.target.checked; });
  set('pAuto', 'change', function (e) { el.autoplay = e.target.checked; if (el.autoplay) el.muted = true; });
  set('pLoop', 'change', function (e) { el.loop = e.target.checked; });

  on('advTgl', 'click', function () { advOpen = !advOpen; renderProps(); });
  on('pMaster', 'change', function (e) {
    pushUndo();
    var o = ownerOf(sel);
    var it = o.arr.splice(o.idx, 1)[0];
    if (e.target.checked) {
      META.master.push(it);
      sel = els().length + META.master.length - 1;
      toast('Élément commun — choisis les pages juste en dessous');
    } else {
      delete it.pages;
      els().push(it);
      sel = els().length - 1;
      toast('Élément rendu propre à cette page');
    }
    buildThumbs();
    renderElements();
    renderProps();
  });
  /* Pages d'un élément commun. On ne redessine pas le panneau à chaque case
     cochée : la liste peut être longue, elle perdrait sa position. */
  set('pMScope', 'change', function (e) {
    if (e.target.value === 'all') delete el.pages;
    else el.pages = SLIDES.map(function (_, i) { return i; });
  }, true);
  var setPages = function (list) {
    pushUndo();
    el.pages = list;
    markDirty();
    renderElements();
    var hint = $('pMHint');
    if (hint) hint.textContent = pagesHint(el);
  };
  props.querySelectorAll('[data-mp]').forEach(function (n) {
    n.addEventListener('change', function (e) {
      var i = +e.currentTarget.dataset.mp;
      var l = (el.pages || []).slice();
      var k = l.indexOf(i);
      if (e.currentTarget.checked) { if (k < 0) l.push(i); }
      else if (k >= 0) l.splice(k, 1);
      l.sort(function (a, b) { return a - b; });
      setPages(l);
    });
  });
  on('pMAll', 'click', function () { setPages(SLIDES.map(function (_, i) { return i; })); renderProps(); });
  on('pMNone', 'click', function () { setPages([]); renderProps(); });
  on('pMHere', 'click', function () { setPages([cur]); renderProps(); });
  on('pReplace', 'click', function () {
    pickFile('image/*', function (f) {
      readAsMedia(f, function (id) { pushUndo(); el.media = id; renderElements(); });
    });
  });

}

/* rejoue les apparitions sans quitter l'édition */
function previewOnce() {
  previewing = true;
  renderElements();
  setTimeout(function () { previewing = false; }, 2600);
}

function moveSel(dir) {
  var o = ownerOf(sel);
  var it = o.arr.splice(o.idx, 1)[0];
  var to = dir === 'front' ? o.arr.length : 0;
  o.arr.splice(to, 0, it);
  sel = o.master ? els().length + to : to;
  renderElements();
  renderProps();
}
function duplicate() {
  var el = selEl();
  if (!el) return;
  var o = ownerOf(sel);
  var copy = JSON.parse(JSON.stringify(el));
  copy.x = r2(clamp(copy.x + 2.5, 0, 100 - copy.w));
  copy.y = r2(clamp(copy.y + 2.5, 0, 100 - copy.h));
  pushUndo();
  o.arr.push(copy);
  select(o.master ? els().length + o.arr.length - 1 : o.arr.length - 1);
  buildThumbs();
  toast('Dupliqué');
}
function deleteSel() {
  if (sel == null) return;
  pushUndo();
  var o = ownerOf(sel);
  o.arr.splice(o.idx, 1);
  sel = null;
  renderElements();
  renderProps();
  buildThumbs();
}
function gcMedia() {
  var used = {};
  SLIDES.concat([{ elements: META.master }]).forEach(function (s) {
    s.elements.forEach(function (e) {
      if (e.media) used[e.media] = 1;
      if (e.video && e.video.media) used[e.video.media] = 1;
    });
  });
  Object.keys(ASSETS.media).forEach(function (id) { if (!used[id]) delete ASSETS.media[id]; });
}

/* ==================== vérification avant diffusion ====================
   Repère ce qui piégerait le lecteur : page sans issue, renvoi vers une
   page disparue, bouton sans destination, page cachée que rien n'atteint. */
function navigates(a) {
  return a === 'goto' || a === 'next' || a === 'prev' || a === 'back';
}
function auditDeck(forExport) {
  var n = SLIDES.length, probs = [];
  var okSlide = function (v) { return typeof v === 'number' && v >= 0 && v < n; };
  var reached = {}, panelFed = {}, masterExit = {};   // pages où un élément commun fait sortir
  var add = function (grave, page, idx, txt) {
    probs.push({ grave: grave, page: page, idx: idx, txt: txt });
  };

  var scan = function (el, page, idx) {
    var où = page < 0 ? 'Élément commun' : slideName(page);
    switch (el.action) {
      case 'goto': case 'overlay':
        if (el.slide === -2) break;
        if (!okSlide(el.slide)) add(1, page, idx, où + ' : renvoi vers une page qui n’existe pas');
        else reached[el.slide] = 1;
        break;
      case 'panel':
        if (okSlide(el.slide)) reached[el.slide] = 1;
        else if (el.slide !== -1) add(1, page, idx, où + ' : renvoi vers une page qui n’existe pas');
        panelFed[el.panelName || '*'] = 1;
        break;
      case 'url':
        if (!el.url) add(1, page, idx, où + ' : bouton « ouvrir un lien » sans adresse');
        break;
      case 'copy':
        if (!el.copyText) add(1, page, idx, où + ' : bouton « copier » sans texte');
        break;
      case 'video':
        if (!el.video || (!el.video.url && !el.video.media))
          add(1, page, idx, où + ' : bouton vidéo sans vidéo choisie');
        break;
    }
    if (page < 0) {
      // un élément commun ne vaut sortie que là où il est effectivement posé
      if (navigates(el.action)) {
        if (!el.pages) masterExit.all = 1;
        else el.pages.forEach(function (v) { masterExit[v] = 1; });
      }
      if (el.pages && !el.pages.length)
        add(0, null, null, 'Un élément commun n’est coché sur aucune page : il n’apparaîtra nulle part');
    }
    if (el.media && !ASSETS.media[el.media])
      add(1, page, idx, où + ' : média introuvable (image ou vidéo perdue)');
    if (el.list) el.list.forEach(function (v) {
      if (okSlide(v)) reached[v] = 1;
      else add(1, page, idx, où + ' : la galerie renvoie à une page disparue');
    });
    if (el.x > 100 || el.y > 100 || el.x + el.w < 0 || el.y + el.h < 0)
      add(0, page, idx, où + ' : élément entièrement hors du cadre');
  };

  SLIDES.forEach(function (sl, i) { sl.elements.forEach(function (el, j) { scan(el, i, j); }); });
  META.master.forEach(function (el, j) { scan(el, -1, j); });
  (META.nav || []).forEach(function (it) {
    if (okSlide(it.slide)) reached[it.slide] = 1;
    else add(1, null, null, 'Sommaire : l’entrée « ' + (it.label || '?') + ' » vise une page disparue');
  });

  // pages cachées que rien n'atteint
  SLIDES.forEach(function (sl, i) {
    if (sl.hidden && !reached[i])
      add(1, i, null, slideName(i) + ' : cachée, et aucun bouton n’y mène : elle est inatteignable');
  });
  // panneaux qui resteront vides
  SLIDES.forEach(function (sl, i) {
    sl.elements.forEach(function (el, j) {
      if (el.type !== 'panel') return;
      var vide = typeof el.slide !== 'number' && !(el.list && el.list.length);
      if (vide && !panelFed[el.name || '*'] && !panelFed['*'])
        add(0, i, j, slideName(i) + ' : panneau « ' + panelKey(el) + ' » vide, qu’aucun bouton ne remplit');
    });
  });
  // sans navigation libre, chaque page visible doit offrir une sortie
  // la version animateur n'a jamais de navigation libre : à l'export on
  // vérifie donc toujours que chaque page offre une sortie
  if ((forExport || !META.view.arrows) && !(META.nav || []).length && !masterExit.all) {
    SLIDES.forEach(function (sl, i) {
      if (sl.hidden || masterExit[i]) return;
      var sortie = sl.elements.some(function (el) { return navigates(el.action); });
      if (!sortie)
        add(1, i, null, slideName(i) + ' : aucun bouton pour en sortir — ' +
            'le lecteur est bloqué');
    });
  }
  return probs;
}

function renderAudit(forExport) {
  var probs = auditDeck(forExport);
  var graves = probs.filter(function (p) { return p.grave; }).length;
  var h = '<h3>Vérification</h3>';
  if (!probs.length)
    h += '<p class="muted">Rien à signaler : aucun renvoi cassé, aucune page ' +
      'inatteignable, aucun bouton sans destination. Tu peux diffuser.</p>';
  else {
    h += '<p class="muted">' + graves + ' problème(s) à corriger' +
      (probs.length - graves ? ' et ' + (probs.length - graves) + ' point(s) à vérifier' : '') +
      '. Clique une ligne pour y aller.</p><div id="auditList">';
    probs.forEach(function (p, i) {
      h += '<div class="aud' + (p.grave ? ' bad' : '') + '" data-aud="' + i + '">' + esc(p.txt) + '</div>';
    });
    h += '</div>';
  }
  if (forExport)
    h += '<button class="wide" id="aExport">🔒 Exporter quand même</button>';
  h += '<button class="wide" id="aClose">Fermer la vérification</button>';
  props.innerHTML = h;
  props.querySelectorAll('[data-aud]').forEach(function (n2) {
    n2.addEventListener('click', function () {
      var p = probs[+n2.dataset.aud];
      if (p.page == null) return;
      auditMode = false;
      $('tAudit').classList.remove('active');
      if (p.page < 0) { sel = els().length + p.idx; refresh(); }
      else { go(p.page, { noHist: true }); if (p.idx != null) sel = p.idx; }
      renderElements();
      renderProps();
    });
  });
  var ex = $('aExport');
  if (ex) ex.addEventListener('click', function () {
    auditMode = false;
    $('tAudit').classList.remove('active');
    renderProps();
    exportReader();
  });
  $('aClose').addEventListener('click', function () {
    auditMode = false;
    $('tAudit').classList.remove('active');
    renderProps();
  });
}

/* ============================ vignettes ============================ */
function buildThumbs() {
  thumbs.innerHTML = '';
  thumbItems = [];
  SLIDES.forEach(function (s, i) {
    if (!editMode && s.hidden) return;
    var d = document.createElement('div');
    d.className = 'th' + (s.hidden ? ' th-hidden' : '');
    var im = document.createElement('img');
    im.src = IMG(s.img);
    im.draggable = false;
    d.appendChild(im);
    var n = document.createElement('span');
    n.className = 'tnum';
    n.textContent = i + 1;
    d.appendChild(n);
    if (s.name) {
      var nm2 = document.createElement('span');
      nm2.className = 'tname';
      nm2.textContent = s.name;
      nm2.title = s.name;
      d.appendChild(nm2);
    }
    if (editMode) {
      if (s.elements.length) {
        var dot = document.createElement('span');
        dot.className = 'tdot';
        dot.textContent = s.elements.length;
        dot.title = s.elements.length + ' élément(s) ajouté(s)';
        d.appendChild(dot);
      }
      var b = document.createElement('button');
      b.className = 'teye';
      b.textContent = s.hidden ? '🚫' : '👁';
      b.title = s.hidden ? 'Diapo cachée — clic pour la remettre dans le fil'
        : 'Cacher cette diapo (accessible uniquement via un bouton)';
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        pushUndo();
        s.hidden = !s.hidden;
        buildThumbs();
        refresh();
      });
      d.appendChild(b);
    }
    d.addEventListener('click', function () { go(i); });
    thumbs.appendChild(d);
    thumbItems.push({ el: d, i: i });
  });
  syncThumbs();
}
function syncThumbs() {
  thumbItems.forEach(function (t) {
    t.el.classList.toggle('current', t.i === cur);
    if (t.i === cur) t.el.scrollIntoView({ block: 'nearest' });
  });
}

/* ============================ lecteur vidéo ============================ */
/* Ouvrir une ou plusieurs diapos par-dessus la page courante : on ne change
   pas de page, on peut feuilleter, Échap ou un clic à côté referme et on
   retrouve exactement où on était.
   La séquence = « ce qui s'ouvre », puis les diapos ajoutées au défilement. */
function overlaySeq(el) {
  var seq = [];
  if (typeof el.slide === 'number' && el.slide >= 0 && SLIDES[el.slide]) seq.push(el.slide);
  (el.list || []).forEach(function (i) {
    if (SLIDES[i] && seq.indexOf(i) < 0) seq.push(i);
  });
  return seq;
}
function openSlideOverlay(seq, pos) {
  ovState = { seq: seq, pos: pos };
  var idx = seq[pos];
  var lb = $('lb');
  lb.innerHTML = '';
  lb.classList.add('slideov');
  lb.style.aspectRatio = wrap.style.aspectRatio || '16 / 9';
  var box = document.createElement('div');
  box.className = 'ovwrap';
  var im = document.createElement('img');
  im.className = 'ovimg';
  im.src = IMG(SLIDES[idx].img);
  im.draggable = false;
  im.addEventListener('load', function () {
    if (im.naturalWidth) lb.style.aspectRatio = im.naturalWidth + ' / ' + im.naturalHeight;
    scaleText();
  });
  box.appendChild(im);
  // la diapo affichée garde ses éléments (une seule imbrication)
  SLIDES[idx].elements.forEach(function (sub) {
    if (sub.type === 'panel') return;
    box.appendChild(buildEl(sub, -1, 1, box));
  });
  if (seq.length > 1) {
    [['prev', '‹', -1], ['next', '›', 1]].forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'gal-nav gal-' + a[0];
      b.textContent = a[1];
      b.addEventListener('click', function (ev) { ev.stopPropagation(); overlayStep(a[2]); });
      box.appendChild(b);
    });
    var cnt = document.createElement('span');
    cnt.className = 'gal-count';
    cnt.textContent = (pos + 1) + ' / ' + seq.length;
    box.appendChild(cnt);
  }
  lb.appendChild(box);
  $('lightbox').classList.remove('hidden');
  $('lbClose').classList.remove('hidden');
  scaleText();
}
function overlayStep(dir) {
  if (!ovState || ovState.seq.length < 2) return;
  var n = ovState.seq.length;
  openSlideOverlay(ovState.seq, (ovState.pos + dir + n) % n);
}
function openImageOverlay(src) {
  var lb = $('lb');
  lb.innerHTML = '';
  lb.classList.add('slideov');
  lb.style.aspectRatio = '16 / 9';
  var box = document.createElement('div');
  box.className = 'ovwrap';
  var im = document.createElement('img');
  im.className = 'ovimg';
  im.src = src;
  im.addEventListener('load', function () {
    if (im.naturalWidth) lb.style.aspectRatio = im.naturalWidth + ' / ' + im.naturalHeight;
  });
  box.appendChild(im);
  lb.appendChild(box);
  $('lightbox').classList.remove('hidden');
  $('lbClose').classList.remove('hidden');
}

function openLightbox(v) {
  if (!v) return;
  var lb = $('lb'), el = null;
  lb.innerHTML = '';
  if (v.url) {
    el = document.createElement('iframe');
    el.src = v.url + (v.url.indexOf('?') >= 0 ? '&' : '?') + 'autoplay=1';
    el.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
    el.allowFullscreen = true;
  } else if (v.media && ASSETS.media[v.media]) {
    el = document.createElement('video');
    el.src = MEDIA(v.media);
    el.controls = true;
    el.autoplay = true;
  }
  if (!el) return;
  lb.appendChild(el);
  $('lightbox').classList.remove('hidden');
  $('lbClose').classList.remove('hidden');
}
function closeLightbox() {
  ovState = null;
  var lb = $('lb');
  lb.innerHTML = '';
  lb.classList.remove('slideov');
  lb.style.aspectRatio = '';
  renderElements();          // les éléments de l'overlay sortent du registre
  $('lb').innerHTML = '';
  $('lightbox').classList.add('hidden');
  $('lbClose').classList.add('hidden');
}
$('lbClose').addEventListener('click', closeLightbox);
$('lightbox').addEventListener('click', function (e) { if (e.target.id === 'lightbox') closeLightbox(); });

/* ============ enregistrement : le fichier se reconstruit lui-même ============ */
function safeName(s) { return (s || 'presentation').replace(/[\\\/:*?"<>|]/g, '_'); }
function serialize(locked) {
  gcMedia();
  var cfg = JSON.parse(JSON.stringify(CFG));
  cfg.meta.locked = !!locked;
  cfg.meta.app = APP_VERSION;
  var j = function (o) { return JSON.stringify(o).replace(/<\//g, '<\\/'); };
  return '<!DOCTYPE html>\n<html lang="' + META.lang + '">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + esc(META.title) + '</title>\n</head>\n<body>\n' +
    '<script type="application/json" id="cfg">' + j(cfg) + '<\/script>\n' +
    '<script type="application/json" id="assets">' + j(ASSETS) + '<\/script>\n' +
    '<script id="app-src">' + $('app-src').textContent + '<\/script>\n' +
    '</body>\n</html>';
}
function download(name, txt) {
  var b = new Blob([txt], { type: 'text/html' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
}
function save() {
  download(safeName(META.title) + '.html', serialize(false));
  clearDirty();
  toast('Fichier téléchargé — remplace l’ancien par celui-ci');
}
window.addEventListener('beforeunload', function (e) {
  if (dirty) { e.preventDefault(); e.returnValue = ''; }
});

/* ============================ mode édition ============================ */
function setDraw(kind) {
  drawMode = kind || false;
  [['tZone', 'zone'], ['tText', 'text'], ['tShape', 'shape'], ['tPanel', 'panel']].forEach(function (p) {
    var b = $(p[0]);
    if (b) b.classList.toggle('active', drawMode === p[1]);
  });
  document.body.classList.toggle('drawing', !!drawMode);
}
/* montre ou masque tout ce qui entoure la diapo, selon META.view.
   En édition, on garde évidemment tous les repères. */
/* Sommaire : une barre toujours accessible, pour sauter d'une partie à
   l'autre sans repasser par toutes les pages. */
function renderNav() {
  var nav = $('nav');
  if (editMode || !META.nav.length) { nav.classList.add('hidden'); return; }
  nav.classList.remove('hidden');
  nav.innerHTML = '';
  // la partie courante : la dernière entrée dont la page est déjà atteinte
  var active = -1;
  META.nav.forEach(function (it, i) { if (it.slide <= cur) active = i; });
  META.nav.forEach(function (it, i) {
    var b = document.createElement('button');
    b.textContent = it.label || ('Diapo ' + (it.slide + 1));
    if (i === active) b.classList.add('on');
    b.addEventListener('click', function () { go(it.slide); });
    nav.appendChild(b);
  });
}

function applyViewChrome() {
  var v = META.view, ed = editMode;
  document.querySelector('header').classList.toggle('hidden', !ed && !v.header);
  $('counter').classList.toggle('hidden', !ed && !v.counter);
  prog.classList.toggle('hidden', !ed && !v.progress);
  var verrou = !ed && readerLock();
  $('btnThumbs').classList.toggle('hidden', verrou || (!ed && !v.thumbs));
  if (verrou || (!ed && !v.thumbs)) thumbs.classList.add('hidden');
  if (verrou) { notesEl.classList.add('hidden'); btnNotes.classList.add('hidden'); }
  $('fsFloat').classList.toggle('hidden', ed || v.header);
  document.body.classList.toggle('noarrows', !ed && (!v.arrows || readerLock()));
  document.body.classList.toggle('full', !!v.full);
  renderNav();
}
function freeNav() { return editMode || (META.view.arrows && !readerLock()); }

/* Aperçu : on quitte l'édition et on se comporte comme la version animateur,
   sans produire de fichier. Échap ou le bandeau ramène à l'édition. */
function setTest(onOff) {
  if (META.locked) return;
  testMode = onOff;
  $('testbar').classList.toggle('hidden', !onOff);
  $('tTest').classList.toggle('active', onOff);
  setEdit(!onOff);
}

function setEdit(onOff) {
  if (META.locked) return;
  if (onOff) { testMode = false; $('testbar').classList.add('hidden'); }
  editMode = onOff;
  sel = null;
  setDraw(false);
  document.body.classList.toggle('editing', onOff);
  if (!onOff) { auditMode = false; $('floatbar').classList.add('hidden'); }
  $('tools').classList.toggle('hidden', !onOff);
  var be = $('btnEdit');
  if (be) be.classList.toggle('active', onOff);
  if (onOff) { thumbs.classList.remove('hidden'); $('btnThumbs').classList.add('active'); }
  applyViewChrome();
  if (onOff && SLIDES.some(function (s2) { return s2.objects && s2.objects.length; }))
    $('tObjects').classList.remove('hidden');
  buildThumbs();
  refresh();
  renderProps();
  syncUndoButtons();
}

var btnEdit = $('btnEdit');
if (btnEdit) btnEdit.addEventListener('click', function () { setEdit(!editMode); });
titleEl.addEventListener('dblclick', function () {
  if (!editMode) return;
  var t = prompt('Titre de la présentation :', META.title);
  if (t && t.trim()) { META.title = t.trim(); document.title = META.title; markDirty(); }
});

$('tZone').addEventListener('click', function () { setDraw(drawMode === 'zone' ? false : 'zone'); });
$('tText').addEventListener('click', function () { setDraw(drawMode === 'text' ? false : 'text'); });
$('tShape').addEventListener('click', function () { setDraw(drawMode === 'shape' ? false : 'shape'); });
$('tPanel').addEventListener('click', function () { setDraw(drawMode === 'panel' ? false : 'panel'); });
$('tObjects').addEventListener('click', function () {
  showObjects = !showObjects;
  $('tObjects').classList.toggle('active', showObjects);
  renderElements();
});
$('tImage').addEventListener('click', function (e) {
  e.stopPropagation();
  pickFile('image/*', addImageFile);
});
$('tVideo').addEventListener('click', function (e) {
  e.stopPropagation();
  openMenu(e.currentTarget, [
    ['📁 Fichier vidéo local (lecture hors ligne)', function () { pickFile('video/*', addVideoFile); }],
    ['▶ Lien YouTube (nécessite internet)', function () {
      var u = prompt('Colle le lien YouTube :');
      if (u) addElement({ type: 'video', url: ytEmbed(u.trim()), x: 25, y: 25, w: 50, h: 45 }, 'Vidéo ajoutée');
    }]
  ]);
});
$('tPreview').addEventListener('click', previewOnce);
$('tTest').addEventListener('click', function () { setTest(true); });
$('testbar').addEventListener('click', function () { setTest(false); });
$('tAudit').addEventListener('click', function () {
  auditMode = !auditMode;
  $('tAudit').classList.toggle('active', auditMode);
  renderProps();
});
$('tUndo').addEventListener('click', undo);
$('tRedo').addEventListener('click', redo);
$('tSave').addEventListener('click', save);
/* Pas de confirm() ici : la boîte de dialogue fait perdre l'autorisation du
   navigateur, et le fichier arrivait nommé « download ». La vérification joue
   ce rôle, avec un bouton pour passer outre. */
function exportReader() {
  download(safeName(META.title) + ' - animateur.html', serialize(true));
  toast('Version animateur téléchargée — garde ton fichier de travail à côté');
}
$('tLock').addEventListener('click', function () {
  if (auditDeck(true).length) {
    auditMode = 'export';
    $('tAudit').classList.add('active');
    renderProps();
    return;
  }
  exportReader();
});

/* coller une image depuis le presse-papiers */
document.addEventListener('paste', function (e) {
  if (!editMode || !e.clipboardData || !e.clipboardData.files) return;
  var f = e.clipboardData.files;
  for (var i = 0; i < f.length; i++) {
    if (f[i].type.indexOf('image/') === 0) { e.preventDefault(); addImageFile(f[i]); return; }
  }
});
/* déposer une image ou une vidéo directement sur la diapo */
['dragover', 'drop'].forEach(function (ev) {
  wrap.addEventListener(ev, function (e) {
    if (!editMode) return;
    e.preventDefault();
    if (ev === 'drop' && e.dataTransfer && e.dataTransfer.files.length) {
      var f = e.dataTransfer.files[0];
      if (f.type.indexOf('image/') === 0) addImageFile(f);
      else if (f.type.indexOf('video/') === 0) addVideoFile(f);
    }
  });
});

/* ============================ entête, clavier, tactile ============================ */
if (SLIDES.some(function (s) { return s.notes; })) btnNotes.classList.remove('hidden');
btnNotes.addEventListener('click', function () {
  notesEl.classList.toggle('hidden');
  btnNotes.classList.toggle('active', !notesEl.classList.contains('hidden'));
});
$('btnThumbs').addEventListener('click', function () {
  thumbs.classList.toggle('hidden');
  $('btnThumbs').classList.toggle('active', !thumbs.classList.contains('hidden'));
});
$('btnFS').addEventListener('click', function () {
  document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
});
$('fsFloat').addEventListener('click', function () { $('btnFS').click(); });
$('prev').addEventListener('click', function () { if (!editMode && freeNav()) go(linPrev()); });
$('next').addEventListener('click', function () { if (!editMode && freeNav()) go(linNext()); });
backBtn.addEventListener('click', goBack);

document.addEventListener('keydown', function (e) {
  var inField = e.target.closest && e.target.closest('input,textarea,select,[contenteditable=true]');
  var k = e.key, low = k.toLowerCase();

  if (editMode && (e.ctrlKey || e.metaKey)) {
    if (low === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (low === 'y') { e.preventDefault(); redo(); return; }
    if (low === 's') { e.preventDefault(); save(); return; }
    if (!inField && low === 'd' && sel != null) { e.preventDefault(); duplicate(); return; }
    if (!inField && low === 'c' && sel != null) { clip = JSON.parse(JSON.stringify(selEl())); toast('Copié'); return; }
    if (!inField && low === 'v' && clip) {
      var c = JSON.parse(JSON.stringify(clip));
      c.x = r2(clamp(c.x + 2.5, 0, 100 - c.w));
      c.y = r2(clamp(c.y + 2.5, 0, 100 - c.h));
      addElement(c, 'Collé');
      return;
    }
  }
  if (inField) return;

  if (!$('lightbox').classList.contains('hidden')) {
    if (k === 'Escape') { closeLightbox(); return; }
    if (k === 'ArrowRight') { e.preventDefault(); overlayStep(1); return; }
    if (k === 'ArrowLeft') { e.preventDefault(); overlayStep(-1); return; }
    return;                       // la page dessous ne bouge pas
  }
  if (k === 'Escape') {
    if (testMode) { setTest(false); return; }
    if (drawMode) { setDraw(false); return; }
    if (editMode && sel != null) { deselect(); return; }
    return;
  }
  if (editMode && (k === 'Delete' || k === 'Backspace') && sel != null) {
    e.preventDefault();
    deleteSel();
    return;
  }
  if (editMode && sel != null && k.indexOf('Arrow') === 0) {
    e.preventDefault();
    var el = selEl(), step = e.shiftKey ? 2 : 0.3;
    pushUndo();
    if (k === 'ArrowLeft') el.x = r2(el.x - step);
    else if (k === 'ArrowRight') el.x = r2(el.x + step);
    else if (k === 'ArrowUp') el.y = r2(el.y - step);
    else el.y = r2(el.y + step);
    renderElements();
    return;
  }
  if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') {
    if (!freeNav()) return;
    e.preventDefault();
    if (editMode) go(Math.min(cur + 1, SLIDES.length - 1));
    else if (!SLIDES[cur].hidden) go(linNext());
  } else if (k === 'ArrowLeft' || k === 'PageUp') {
    if (SLIDES[cur].hidden && !editMode) { goBack(); return; }
    if (!freeNav()) return;
    if (editMode) go(Math.max(cur - 1, 0));
    else go(linPrev());
  } else if (k === 'Home') { if (freeNav()) go(editMode ? 0 : firstVisible()); }
  else if (k === 'End') { if (freeNav()) go(editMode ? SLIDES.length - 1 : lastVisible()); }
  else if (low === 'f') $('btnFS').click();
  else if (low === 't' && !readerLock()) $('btnThumbs').click();
  else if (low === 'n' && !readerLock() && !btnNotes.classList.contains('hidden')) btnNotes.click();
  else if (low === 'e') setEdit(!editMode);
});

var tx = null;
document.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
document.addEventListener('touchend', function (e) {
  if (tx === null || editMode || !$('lightbox').classList.contains('hidden')) { tx = null; return; }
  var dx = e.changedTouches[0].clientX - tx;
  tx = null;
  if (Math.abs(dx) < 50) return;
  if (SLIDES[cur].hidden) { if (dx > 0) goBack(); return; }
  if (!freeNav()) return;
  go(dx < 0 ? linNext() : linPrev());
});

/* le cadre épouse le format réel de la page : c'est ce qui empêche
   l'étirement quand le PDF n'est pas en 16/9 */
function fitFrame() {
  if (slideEl.naturalWidth && slideEl.naturalHeight)
    wrap.style.aspectRatio = slideEl.naturalWidth + ' / ' + slideEl.naturalHeight;
  scaleText();
}
window.addEventListener('resize', function () { scaleText(); placeFloatbar(); });
slideEl.addEventListener('load', fitFrame);
window.addEventListener('hashchange', function () {
  var h = parseInt(location.hash.slice(1), 10) - 1;
  if (!isNaN(h) && h !== cur) go(clamp(h, 0, SLIDES.length - 1), { noHist: true });
});

/* ============================ démarrage ============================ */
var hintEl = $('hint');
if (!META.view.header || !META.view.arrows) hintEl.remove();
else setTimeout(function () {
  if (hintEl && hintEl.parentNode) {
    hintEl.style.opacity = 0;
    setTimeout(function () { hintEl.remove(); }, 600);
  }
}, 5000);
applyViewChrome();
buildThumbs();
$('btnThumbs').classList.add('active');
var start = parseInt(location.hash.slice(1), 10) - 1;
go(isNaN(start) ? firstVisible() : clamp(start, 0, SLIDES.length - 1), { instant: true, noHist: true });
})();
