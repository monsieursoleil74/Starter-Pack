#!/usr/bin/env python3
"""
pptx2html — convertit un .pptx en visionneuse HTML interactive autonome.

Usage : python pptx2html.py deck.pptx [-o sortie.html] [--dpi 150] [--lang fr]

Pipeline : pptx -> PDF (LibreOffice) -> images JPEG (pdftoppm) -> HTML unique
avec images en base64, navigation clavier/clic/swipe, vignettes, plein écran,
notes du présentateur (extraites via python-pptx).
"""
import argparse, base64, glob, html, json, os, shutil, subprocess, sys, tempfile

APP_VERSION = "1.1.0"
SOFFICE_WRAPPER = "/mnt/skills/public/pptx/scripts/office/soffice.py"


def app_dir():
    """Dossier de l'application (exe PyInstaller ou script)."""
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


class ConvError(Exception):
    pass


def find_soffice():
    """Trouve LibreOffice selon l'OS."""
    if os.path.isfile(SOFFICE_WRAPPER):
        return [sys.executable, SOFFICE_WRAPPER]
    cands = [shutil.which("soffice"),
             r"C:\Program Files\LibreOffice\program\soffice.exe",
             r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
             "/Applications/LibreOffice.app/Contents/MacOS/soffice"]
    for c in cands:
        if c and os.path.isfile(c):
            return [c]
    raise ConvError("LibreOffice introuvable. Installe-le depuis libreoffice.org\n"
                    "(ou ajoute soffice au PATH).")


def find_pdftoppm():
    # Poppler livré à côté de l'exe (zip Windows) — prioritaire
    exe = "pdftoppm.exe" if sys.platform == "win32" else "pdftoppm"
    bundled = os.path.join(app_dir(), "poppler", exe)
    if os.path.isfile(bundled):
        return bundled
    c = shutil.which("pdftoppm")
    if c:
        return c
    for extra in [r"C:\poppler\Library\bin\pdftoppm.exe",
                  r"C:\Program Files\poppler\Library\bin\pdftoppm.exe",
                  "/opt/homebrew/bin/pdftoppm", "/usr/local/bin/pdftoppm"]:
        if os.path.isfile(extra):
            return extra
    raise ConvError("Poppler (pdftoppm) introuvable.\n"
                    "Windows : télécharger poppler et le dézipper dans C:\\poppler\n"
                    "Mac : brew install poppler")


def run(cmd, **kw):
    if sys.platform == "win32":
        # pas de fenêtre console qui clignote depuis l'exe/pythonw
        kw.setdefault("creationflags", subprocess.CREATE_NO_WINDOW)
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        raise ConvError(f"Échec : {' '.join(map(str, cmd))}\n{r.stderr[:500]}")
    return r


def extract_notes(pptx_path):
    """Retourne la liste des notes (une par slide, '' si aucune)."""
    try:
        from pptx import Presentation
    except ImportError:
        return []
    try:
        prs = Presentation(pptx_path)
    except Exception:
        return []
    notes = []
    for slide in prs.slides:
        txt = ""
        if slide.has_notes_slide:
            tf = slide.notes_slide.notes_text_frame
            if tf is not None:
                txt = tf.text.strip()
        notes.append(txt)
    return notes


def extract_links(pptx_path):
    """Retourne, par slide, les zones cliquables :
    [{x,y,w,h (en % de la slide), 'slide': index} ou {'url': ...}]"""
    try:
        from pptx import Presentation
        from pptx.enum.action import PP_ACTION
    except ImportError:
        return []
    try:
        prs = Presentation(pptx_path)
    except Exception:
        return []
    sw, sh = prs.slide_width, prs.slide_height
    slide_index = {s.slide_id: i for i, s in enumerate(prs.slides)}
    result = []
    for slide in prs.slides:
        zones = []
        for shape in slide.shapes:
            if None in (shape.left, shape.top, shape.width, shape.height):
                continue
            target = None
            # lien posé sur la forme entière
            try:
                ca = shape.click_action
                if ca.target_slide is not None:
                    target = {"slide": slide_index[ca.target_slide.slide_id]}
                elif ca.action == PP_ACTION.NEXT_SLIDE:
                    target = {"rel": 1}
                elif ca.action == PP_ACTION.PREVIOUS_SLIDE:
                    target = {"rel": -1}
                elif ca.action == PP_ACTION.FIRST_SLIDE:
                    target = {"slide": 0}
                elif ca.action == PP_ACTION.LAST_SLIDE:
                    target = {"slide": len(slide_index) - 1}
                elif ca.hyperlink.address:
                    target = {"url": ca.hyperlink.address}
            except Exception:
                pass
            # sinon, lien sur un run de texte dans la forme
            if target is None and shape.has_text_frame:
                for para in shape.text_frame.paragraphs:
                    for run in para.runs:
                        try:
                            if run.hyperlink.address:
                                target = {"url": run.hyperlink.address}
                                break
                        except Exception:
                            pass
                    if target:
                        break
            if target:
                target.update({
                    "x": round(shape.left / sw * 100, 2),
                    "y": round(shape.top / sh * 100, 2),
                    "w": round(shape.width / sw * 100, 2),
                    "h": round(shape.height / sh * 100, 2),
                })
                zones.append(target)
        result.append(zones)
    return result


def convert(pptx_path, out_html, dpi=150, lang="fr", embed=True, log=print):
    pptx_path = os.path.abspath(pptx_path)
    if not os.path.isfile(pptx_path):
        raise ConvError(f"Fichier introuvable : {pptx_path}")

    title = os.path.splitext(os.path.basename(pptx_path))[0]
    tmp = tempfile.mkdtemp(prefix="pptx2html_")
    try:
        # 1) pptx -> pdf
        log("Rendu des slides via LibreOffice…")
        run(find_soffice() + ["--headless", "--convert-to", "pdf",
                              "--outdir", tmp, pptx_path])
        pdfs = glob.glob(os.path.join(tmp, "*.pdf"))
        if not pdfs:
            raise ConvError("La conversion PDF a échoué (aucun PDF produit).")
        pdf = pdfs[0]

        # 2) pdf -> jpegs
        log("Génération des images…")
        run([find_pdftoppm(), "-jpeg", "-jpegopt", "quality=85",
             "-r", str(dpi), pdf, os.path.join(tmp, "slide")])
        imgs = sorted(glob.glob(os.path.join(tmp, "slide-*.jpg")))
        if not imgs:
            raise ConvError("Aucune image générée.")

        # 3) base64 (embarqué) ou dossier d'assets (non portable)
        slides_src = []
        if embed:
            for p in imgs:
                with open(p, "rb") as f:
                    slides_src.append(base64.b64encode(f.read()).decode("ascii"))
        else:
            assets = os.path.splitext(os.path.basename(out_html))[0] + "_assets"
            assets_dir = os.path.join(os.path.dirname(os.path.abspath(out_html)), assets)
            os.makedirs(assets_dir, exist_ok=True)
            for i, p in enumerate(imgs, 1):
                name = f"slide-{i:03d}.jpg"
                shutil.copy(p, os.path.join(assets_dir, name))
                slides_src.append(f"{assets}/{name}")

        # 4) notes + liens
        notes = extract_notes(pptx_path)
        notes += [""] * (len(slides_src) - len(notes))
        links = extract_links(pptx_path)
        links += [[]] * (len(slides_src) - len(links))
        n_links = sum(len(z) for z in links)
        if n_links:
            log(f"{n_links} zone(s) cliquable(s) détectée(s)")

        # 5) HTML
        write_html(out_html, title, slides_src, notes, links, lang, embed)
        size_mb = os.path.getsize(out_html) / 1e6
        mode = "tout embarqué" if embed else "assets séparés (non portable)"
        log(f"Terminé : {len(slides_src)} slides, {size_mb:.1f} Mo ({mode})")
        return out_html
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


L10N = {
    "fr": {"of": "/", "notes": "Notes", "no_notes": "Aucune note pour cette slide.",
           "thumbs": "Vignettes", "fullscreen": "Plein écran", "help":
           "← → : naviguer · F : plein écran · N : notes · T : vignettes · Échap : fermer"},
    "en": {"of": "/", "notes": "Notes", "no_notes": "No notes for this slide.",
           "thumbs": "Thumbnails", "fullscreen": "Fullscreen", "help":
           "← → : navigate · F : fullscreen · N : notes · T : thumbnails · Esc : close"},
}


def write_html(out_path, title, slides_src, notes, links, lang, embed=True):
    t = L10N.get(lang, L10N["fr"])
    slides_json = json.dumps(
        [{"img": s, "notes": n, "links": l}
         for s, n, l in zip(slides_src, notes, links)])
    has_notes = any(n for n in notes)
    doc = f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<style>
:root {{
  --bg:#111318; --panel:#1b1e26; --panel2:#232733; --fg:#e8eaf0;
  --muted:#8b90a0; --accent:#5b8cff; --radius:10px;
}}
* {{ margin:0; padding:0; box-sizing:border-box; }}
html,body {{ height:100%; background:var(--bg); color:var(--fg);
  font:15px/1.5 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  overflow:hidden; }}
#app {{ display:flex; flex-direction:column; height:100%; }}

header {{ display:flex; align-items:center; gap:14px; padding:10px 16px;
  background:var(--panel); border-bottom:1px solid #2a2e3a; flex-shrink:0; }}
header h1 {{ font-size:15px; font-weight:600; white-space:nowrap;
  overflow:hidden; text-overflow:ellipsis; flex:1; }}
#counter {{ color:var(--muted); font-variant-numeric:tabular-nums;
  white-space:nowrap; }}
button.icon {{ background:var(--panel2); color:var(--fg); border:none;
  border-radius:8px; padding:7px 12px; cursor:pointer; font-size:14px;
  transition:background .15s; }}
button.icon:hover {{ background:#2e3342; }}
button.icon.active {{ background:var(--accent); color:#fff; }}

#main {{ flex:1; display:flex; min-height:0; }}
#stage {{ flex:1; display:flex; align-items:center; justify-content:center;
  position:relative; padding:18px; min-width:0; }}
#wrap {{ position:relative; max-width:100%; max-height:100%;
  display:flex; transition:opacity .18s ease; }}
#wrap.fading {{ opacity:0; }}
#slide {{ max-width:100%; max-height:100%; border-radius:var(--radius);
  box-shadow:0 8px 40px rgba(0,0,0,.55); user-select:none; display:block; }}
.hotspot {{ position:absolute; z-index:2; cursor:pointer; border-radius:6px;
  border:2px solid transparent; transition:border-color .15s, background .15s; }}
.hotspot:hover {{ border-color:var(--accent);
  background:rgba(91,140,255,.12); }}
.navzone {{ z-index:1; }}

.navzone {{ position:absolute; top:0; bottom:0; width:28%; cursor:pointer;
  display:flex; align-items:center; opacity:0; transition:opacity .2s; }}
.navzone:hover {{ opacity:1; }}
.navzone span {{ font-size:34px; color:#fff; background:rgba(0,0,0,.45);
  border-radius:50%; width:52px; height:52px; display:flex;
  align-items:center; justify-content:center; }}
#prev {{ left:0; justify-content:flex-start; padding-left:14px; }}
#next {{ right:0; justify-content:flex-end; padding-right:14px; }}

#thumbs {{ width:168px; background:var(--panel); border-left:1px solid #2a2e3a;
  overflow-y:auto; padding:10px; display:flex; flex-direction:column; gap:8px;
  flex-shrink:0; }}
#thumbs.hidden {{ display:none; }}
#thumbs img {{ width:100%; border-radius:6px; cursor:pointer;
  border:2px solid transparent; opacity:.65; transition:.15s; }}
#thumbs img:hover {{ opacity:1; }}
#thumbs img.current {{ border-color:var(--accent); opacity:1; }}

#notes {{ background:var(--panel); border-top:1px solid #2a2e3a;
  padding:12px 18px; max-height:26vh; overflow-y:auto; flex-shrink:0;
  white-space:pre-wrap; color:var(--muted); font-size:14px; }}
#notes.hidden {{ display:none; }}
#notes b {{ color:var(--fg); display:block; margin-bottom:4px; }}

#progress {{ height:3px; background:var(--accent); width:0;
  transition:width .25s ease; flex-shrink:0; }}
#hint {{ position:fixed; bottom:14px; left:50%; transform:translateX(-50%);
  background:rgba(20,22,30,.92); padding:8px 16px; border-radius:20px;
  font-size:12.5px; color:var(--muted); pointer-events:none;
  transition:opacity .5s; white-space:nowrap; }}
@media (max-width:700px) {{ #thumbs {{ display:none; }} .navzone span {{ display:none; }} }}
</style>
</head>
<body>
<div id="app">
  <header>
    <h1>{html.escape(title)}</h1>
    <span id="counter"></span>
    {'<button class="icon" id="btnNotes" title="N">🗒 ' + t["notes"] + '</button>' if has_notes else ''}
    <button class="icon" id="btnThumbs" title="T">▦</button>
    <button class="icon" id="btnFS" title="F">⛶</button>
  </header>
  <div id="main">
    <div id="stage">
      <div id="wrap"><img id="slide" alt=""></div>
      <div class="navzone" id="prev"><span>‹</span></div>
      <div class="navzone" id="next"><span>›</span></div>
    </div>
    <div id="thumbs"></div>
  </div>
  <div id="notes" class="hidden"></div>
  <div id="progress"></div>
</div>
<div id="hint">{t["help"]}</div>
<script>
const SLIDES = {slides_json};
const EMBED = {str(embed).lower()};
const SRC = s => EMBED ? 'data:image/jpeg;base64,' + s : s;
const NO_NOTES = {json.dumps(t["no_notes"])};
const NOTES_LBL = {json.dumps(t["notes"])};
let cur = 0;
const $ = id => document.getElementById(id);
const slideEl = $('slide'), counter = $('counter'), thumbs = $('thumbs'),
      notesEl = $('notes'), prog = $('progress'), wrap = $('wrap');

function renderLinks() {{
  wrap.querySelectorAll('.hotspot').forEach(h => h.remove());
  (SLIDES[cur].links || []).forEach(l => {{
    const d = document.createElement('div');
    d.className = 'hotspot';
    d.style.left = l.x + '%'; d.style.top = l.y + '%';
    d.style.width = l.w + '%'; d.style.height = l.h + '%';
    if (l.url) {{
      d.title = l.url;
      d.onclick = e => {{ e.stopPropagation(); window.open(l.url, '_blank'); }};
    }} else {{
      const dest = l.rel !== undefined ? cur + l.rel : l.slide;
      d.title = 'Slide ' + (dest + 1);
      d.onclick = e => {{ e.stopPropagation();
        go(l.rel !== undefined ? cur + l.rel : l.slide); }};
    }}
    wrap.appendChild(d);
  }});
}}

SLIDES.forEach((s, i) => {{
  const im = document.createElement('img');
  im.src = SRC(s.img);
  im.onclick = () => go(i);
  thumbs.appendChild(im);
}});

function go(i, instant) {{
  cur = Math.max(0, Math.min(SLIDES.length - 1, i));
  const apply = () => {{
    slideEl.src = SRC(SLIDES[cur].img);
    renderLinks();
    wrap.classList.remove('fading');
  }};
  if (instant) apply();
  else {{ wrap.classList.add('fading'); setTimeout(apply, 120); }}
  counter.textContent = (cur + 1) + ' {t["of"]} ' + SLIDES.length;
  prog.style.width = ((cur + 1) / SLIDES.length * 100) + '%';
  [...thumbs.children].forEach((im, j) => {{
    im.classList.toggle('current', j === cur);
    if (j === cur) im.scrollIntoView({{ block: 'nearest' }});
  }});
  const n = SLIDES[cur].notes;
  notesEl.innerHTML = '<b>' + NOTES_LBL + ' — slide ' + (cur + 1) + '</b>' +
    (n ? '' : '<i>') + escapeHtml(n || NO_NOTES) + (n ? '' : '</i>');
  location.hash = cur + 1;
}}
function escapeHtml(s) {{
  return s.replace(/[&<>]/g, c => ({{'&':'&amp;','<':'&lt;','>':'&gt;'}})[c]);
}}

$('prev').onclick = () => go(cur - 1);
$('next').onclick = () => go(cur + 1);
$('btnThumbs').onclick = () => {{
  thumbs.classList.toggle('hidden');
  $('btnThumbs').classList.toggle('active', !thumbs.classList.contains('hidden'));
}};
$('btnFS').onclick = () => document.fullscreenElement
  ? document.exitFullscreen() : document.documentElement.requestFullscreen();
const bn = $('btnNotes');
if (bn) bn.onclick = () => {{
  notesEl.classList.toggle('hidden');
  bn.classList.toggle('active', !notesEl.classList.contains('hidden'));
}};

document.addEventListener('keydown', e => {{
  if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') go(cur + 1);
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(cur - 1);
  else if (e.key === 'Home') go(0);
  else if (e.key === 'End') go(SLIDES.length - 1);
  else if (e.key.toLowerCase() === 'f') $('btnFS').click();
  else if (e.key.toLowerCase() === 't') $('btnThumbs').click();
  else if (e.key.toLowerCase() === 'n' && bn) bn.click();
}});

let tx = null;
document.addEventListener('touchstart', e => tx = e.touches[0].clientX);
document.addEventListener('touchend', e => {{
  if (tx === null) return;
  const dx = e.changedTouches[0].clientX - tx;
  if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1));
  tx = null;
}});

setTimeout(() => {{ const h = $('hint'); h.style.opacity = 0;
  setTimeout(() => h.remove(), 600); }}, 5000);

const start = parseInt(location.hash.slice(1)) - 1;
go(isNaN(start) ? 0 : start, true);
</script>
</body>
</html>"""
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(doc)



# ============================== INTERFACE ==============================

LO_URL = "https://fr.libreoffice.org/download/telecharger-libreoffice/"
PPTX_EXTS = (".pptx", ".ppt", ".potx")


def launch_gui(preload=None):
    import threading, webbrowser
    import tkinter as tk
    from tkinter import filedialog

    # glisser-déposer si tkinterdnd2 est disponible (toujours le cas dans l'exe)
    try:
        from tkinterdnd2 import DND_FILES, TkinterDnD
        root = TkinterDnD.Tk()
        has_dnd = True
    except Exception:
        root = tk.Tk()
        has_dnd = False

    BG, PANEL, FG, MUTED, ACCENT = "#111318", "#1b1e26", "#e8eaf0", "#8b90a0", "#5b8cff"

    root.title(f"PPTX → HTML interactif — v{APP_VERSION}")
    root.geometry("560x540")
    root.configure(bg=BG)
    root.minsize(480, 480)

    state = {"queue": [], "busy": False}

    tk.Label(root, text="PPTX → HTML interactif", bg=BG, fg=FG,
             font=("Segoe UI", 16, "bold")).pack(pady=(18, 2))
    tk.Label(root, text="Google Slides : Fichier → Télécharger → Microsoft PowerPoint (.pptx)",
             bg=BG, fg=MUTED, font=("Segoe UI", 10)).pack(pady=(0, 12))

    # --- zone de dépôt ---
    dropbox = tk.Frame(root, bg=PANEL, highlightbackground="#2a2e3a",
                       highlightthickness=1, cursor="hand2")
    dropbox.pack(fill="x", padx=24, pady=4)
    drop_lbl = tk.Label(
        dropbox,
        text="⬇\nDépose ton fichier .pptx ici" if has_dnd
        else "Clique pour choisir un fichier .pptx",
        bg=PANEL, fg=FG, font=("Segoe UI", 12, "bold"), justify="center",
        cursor="hand2")
    drop_lbl.pack(pady=(18, 2))
    file_lbl = tk.Label(
        dropbox,
        text="(ou clique pour parcourir — plusieurs fichiers acceptés)"
        if has_dnd else "(plusieurs fichiers acceptés)",
        bg=PANEL, fg=MUTED, font=("Segoe UI", 9), cursor="hand2")
    file_lbl.pack(pady=(0, 16))

    # --- options ---
    opts = tk.Frame(root, bg=BG)
    opts.pack(fill="x", padx=24, pady=(12, 4))
    assets_var = tk.BooleanVar(value=False)
    tk.Checkbutton(opts, text="Images dans un dossier séparé (le HTML ne "
                   "fonctionne pas s'il est copié seul — anti-diffusion)",
                   variable=assets_var, bg=BG, fg=FG, selectcolor=PANEL,
                   activebackground=BG, activeforeground=FG,
                   font=("Segoe UI", 9), wraplength=480,
                   justify="left").pack(anchor="w")
    qrow = tk.Frame(opts, bg=BG); qrow.pack(anchor="w", pady=(8, 0))
    tk.Label(qrow, text="Qualité :", bg=BG, fg=FG,
             font=("Segoe UI", 9)).pack(side="left")
    dpi_var = tk.StringVar(value="150")
    for label, val in [("Légère (100)", "100"), ("Standard (150)", "150"),
                       ("Haute (200)", "200")]:
        tk.Radiobutton(qrow, text=label, value=val, variable=dpi_var, bg=BG,
                       fg=FG, selectcolor=PANEL, activebackground=BG,
                       activeforeground=FG, font=("Segoe UI", 9)
                       ).pack(side="left", padx=6)

    # --- bouton + log ---
    go_btn = tk.Button(root, text="Convertir", state="disabled", bg="#2e3342",
                       fg="white", relief="flat", cursor="hand2",
                       font=("Segoe UI", 12, "bold"), padx=30, pady=8)
    go_btn.pack(pady=14)
    logbox = tk.Text(root, height=6, bg=PANEL, fg=MUTED, relief="flat",
                     font=("Consolas", 9), state="disabled", wrap="word")
    logbox.pack(fill="both", expand=True, padx=24, pady=(0, 18))

    def log(msg):
        def _():
            logbox.config(state="normal")
            logbox.insert("end", msg + "\n")
            logbox.see("end")
            logbox.config(state="disabled")
        root.after(0, _)

    def open_folder(path):
        d = os.path.dirname(path)
        try:
            if sys.platform == "win32":
                os.startfile(d)
            elif sys.platform == "darwin":
                subprocess.Popen(["open", d])
            else:
                subprocess.Popen(["xdg-open", d])
        except Exception:
            pass

    def start_convert():
        if state["busy"] or not state["queue"]:
            return
        state["busy"] = True
        go_btn.config(state="disabled", text="Conversion…", bg="#2e3342")

        def work():
            done, last = 0, None
            for f in list(state["queue"]):
                out = os.path.splitext(f)[0] + ".html"
                try:
                    log(f"▶ {os.path.basename(f)}")
                    last = convert(f, out, dpi=int(dpi_var.get()),
                                   embed=not assets_var.get(), log=log)
                    done += 1
                except ConvError as e:
                    log("ERREUR : " + str(e))
                except Exception as e:
                    log("ERREUR inattendue : " + repr(e))
            if done and last:
                open_folder(last)
            state["busy"] = False
            root.after(0, lambda: go_btn.config(
                state="normal", text="Convertir", bg=ACCENT))
        threading.Thread(target=work, daemon=True).start()

    go_btn.config(command=start_convert)

    def set_files(paths, auto=True):
        if state["busy"]:
            log("Conversion en cours — dépose ton fichier quand c'est terminé.")
            return
        valid = [os.path.abspath(p) for p in paths
                 if os.path.isfile(p) and p.lower().endswith(PPTX_EXTS)]
        skipped = len(paths) - len(valid)
        if skipped:
            log(f"{skipped} fichier(s) ignoré(s) — seuls "
                f"{', '.join(PPTX_EXTS)} sont acceptés.")
        if not valid:
            return
        state["queue"] = valid
        file_lbl.config(fg=FG, text=os.path.basename(valid[0])
                        if len(valid) == 1 else f"{len(valid)} fichiers sélectionnés")
        go_btn.config(state="normal", bg=ACCENT)
        if auto:
            start_convert()

    def choose(_event=None):
        p = filedialog.askopenfilenames(
            title="Choisir une ou plusieurs présentations",
            filetypes=[("PowerPoint", "*.pptx *.ppt *.potx"), ("Tous", "*.*")])
        if p:
            set_files(list(p))

    for w in (dropbox, drop_lbl, file_lbl):
        w.bind("<Button-1>", choose)

    if has_dnd:
        def on_drop(e):
            set_files(list(root.tk.splitlist(e.data)))
        for w in (root, dropbox, drop_lbl, file_lbl):
            w.drop_target_register(DND_FILES)
            w.dnd_bind("<<Drop>>", on_drop)

    def check_deps():
        try:
            find_soffice()
            log("LibreOffice : OK")
        except ConvError:
            log("LibreOffice manquant — il sert à rendre les slides "
                "(installation unique, tout reste hors ligne).")
            tk.Button(root, text="Installer LibreOffice",
                      command=lambda: webbrowser.open(LO_URL),
                      bg="#c0392b", fg="white", relief="flat", cursor="hand2",
                      font=("Segoe UI", 10, "bold"), padx=14, pady=5
                      ).pack(pady=(0, 10))
        try:
            find_pdftoppm()
            log("Poppler : OK")
        except ConvError as e:
            log("ERREUR : " + str(e))
        log("Prêt — dépose un .pptx, la conversion démarre toute seule."
            if has_dnd else "Prêt — clique dans la zone pour choisir un .pptx.")

    check_deps()
    if preload:
        root.after(300, lambda: set_files([preload]))
    root.mainloop()


if __name__ == "__main__":
    argv = sys.argv[1:]
    if argv and getattr(sys, "frozen", False) and os.path.isfile(argv[0]):
        # fichier déposé sur l'icône de l'exe → GUI préchargée, conversion auto
        launch_gui(preload=os.path.abspath(argv[0]))
    elif argv:
        ap = argparse.ArgumentParser()
        ap.add_argument("pptx")
        ap.add_argument("-o", "--output", default=None)
        ap.add_argument("--dpi", type=int, default=150)
        ap.add_argument("--lang", default="fr", choices=["fr", "en"])
        ap.add_argument("--assets", action="store_true")
        a = ap.parse_args()
        out = a.output or os.path.splitext(a.pptx)[0] + ".html"
        try:
            convert(a.pptx, out, dpi=a.dpi, lang=a.lang, embed=not a.assets)
        except ConvError as e:
            sys.exit(str(e))
    else:
        launch_gui()
