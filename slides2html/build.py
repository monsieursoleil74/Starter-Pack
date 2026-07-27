#!/usr/bin/env python3
"""Assemble Convertisseur.html : src/ + vendor/ -> un seul fichier autonome.

    python3 build.py [--check]

--check ne réécrit rien et sort en erreur si le fichier livré n'est plus à jour
(utilisé par la CI). Aucune dépendance : Python 3 seul.
"""
import hashlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "Convertisseur.html")

PARTS = {
    "@@PDFJS@@": "vendor/pdf.min.js",
    "@@FFLATE@@": "vendor/fflate.min.js",
    "@@PDFWORKER@@": "vendor/pdf.worker.min.js",
    "@@VIEWER@@": "src/viewer.js",
    "@@CONVERTER@@": "src/converter.js",
}


def read(rel):
    with open(os.path.join(HERE, rel), encoding="utf-8") as f:
        return f.read()


def build():
    doc = read("src/converter.html")
    for marker, rel in PARTS.items():
        code = read(rel)
        # une seule de ces séquences dans un <script> couperait la page en deux
        if "</script" in code.lower():
            sys.exit(f"{rel} contient '</script' : impossible à embarquer tel quel.")
        placeholder = "/*%s*/" % marker
        if placeholder not in doc:
            sys.exit(f"Marqueur {marker} absent de src/converter.html")
        doc = doc.replace(placeholder, code)
    left = [m for m in PARTS if m in doc]
    if left:
        sys.exit("Marqueurs non remplacés : " + ", ".join(left))
    return doc


if __name__ == "__main__":
    doc = build()
    if "--check" in sys.argv:
        cur = read("Convertisseur.html") if os.path.isfile(OUT) else ""
        if cur != doc:
            sys.exit("Convertisseur.html n'est pas à jour : lance « python3 build.py ».")
        print("Convertisseur.html est à jour.")
    else:
        with open(OUT, "w", encoding="utf-8") as f:
            f.write(doc)
        h = hashlib.sha256(doc.encode()).hexdigest()[:12]
        print("Convertisseur.html — %.2f Mo (sha256 %s)" % (len(doc.encode()) / 1e6, h))
