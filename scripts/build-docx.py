#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Génère un fichier .docx (Word) sans dépendance externe (zip + WordprocessingML)."""
import zipfile, html, os

OUT = os.path.join(os.path.dirname(__file__), "Rapport_AVS_KasaiCentral_Avril_vs_Mai_2026.docx")

NS = ('xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"')

def esc(t): return html.escape(str(t), quote=False)

def run(text, bold=False, color=None, sz=22):
    rpr = "<w:rPr>"
    if bold: rpr += "<w:b/>"
    if color: rpr += f'<w:color w:val="{color}"/>'
    rpr += f'<w:sz w:val="{sz}"/><w:szCs w:val="{sz}"/></w:rPr>'
    return f'<w:r>{rpr}<w:t xml:space="preserve">{esc(text)}</w:t></w:r>'

def para(text="", bold=False, color=None, sz=22, align=None, space_before=0):
    ppr = "<w:pPr>"
    if space_before: ppr += f'<w:spacing w:before="{space_before}"/>'
    if align: ppr += f'<w:jc w:val="{align}"/>'
    ppr += "</w:pPr>"
    return f"<w:p>{ppr}{run(text, bold, color, sz)}</w:p>"

def heading(text, sz=30):
    return para(text, bold=True, color="0B4EA2", sz=sz, space_before=240)

def cell(text, bold=False, fill=None, align="left", color="1A1A1A"):
    shd = f'<w:shd w:val="clear" w:fill="{fill}"/>' if fill else ""
    tcpr = (f'<w:tcPr><w:tcBorders>'
            f'<w:top w:val="single" w:sz="4" w:color="B8B8B8"/>'
            f'<w:left w:val="single" w:sz="4" w:color="B8B8B8"/>'
            f'<w:bottom w:val="single" w:sz="4" w:color="B8B8B8"/>'
            f'<w:right w:val="single" w:sz="4" w:color="B8B8B8"/>'
            f'</w:tcBorders>{shd}</w:tcPr>')
    p = (f'<w:p><w:pPr><w:jc w:val="{align}"/></w:pPr>'
         f'{run(text, bold=bold, color=("FFFFFF" if fill=="0B4EA2" else color), sz=21)}</w:p>')
    return f"<w:tc>{tcpr}{p}</w:tc>"

def table(headers, rows, total=None, aligns=None):
    aligns = aligns or (["left"] + ["right"]*(len(headers)-1))
    out = ['<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>'
           '<w:tblLayout w:type="autofit"/></w:tblPr>']
    # header
    hr = "".join(cell(h, bold=True, fill="0B4EA2", align=aligns[i]) for i, h in enumerate(headers))
    out.append(f"<w:tr>{hr}</w:tr>")
    for ri, row in enumerate(rows):
        fill = "F2F6FB" if ri % 2 == 1 else None
        tr = "".join(cell(c, fill=fill, align=aligns[i]) for i, c in enumerate(row))
        out.append(f"<w:tr>{tr}</w:tr>")
    if total:
        tr = "".join(cell(c, bold=True, fill="DCE9F7", align=aligns[i]) for i, c in enumerate(total))
        out.append(f"<w:tr>{tr}</w:tr>")
    out.append("</w:tbl>")
    out.append('<w:p/>')
    return "".join(out)

body = []
body.append(para("Monitorage indépendant Polio — RDC", bold=True, color="0B4EA2", sz=34))
body.append(para("Province du KASAÏ CENTRAL", bold=True, color="C0392B", sz=24))
body.append(para("Analyse comparative des soumissions ODK — Campagne Avril 2026 (23–30/04) vs Campagne Mai 2026 (23/05–10/06)",
                 color="555555", sz=20))

body.append(heading("1. Mobilisation des ressources locales — soumissions par formulaire"))
body.append(table(
    ["Type de formulaire", "ID ODK", "Avril 2026", "Mai 2026"],
    [
        ["Supervision des équipes de vaccination", "4497", "21 832", "17 226"],
        ["Formulaire A pour VPOb", "14850", "167", "146"],
        ["Formulaire A pour nVPO2", "5645", "266", "245"],
        ["Inventaire des MCF (chaîne de froid)", "9442", "225", "146"],
        ["Liste de contrôle des formations AVS", "5278", "61", "45"],
        ["Liste de vérification validation des préparatifs AVS", "4501", "102", "55"],
        ["Monitorage indépendant dans les ménages", "4498", "3 325", "2 761"],
    ],
    total=["Total", "—", "25 978", "20 624"],
))

body.append(heading("2. Profil d'acteur (niveau / désignation du superviseur)"))
body.append(para("Aucun champ « profil » littéral n'existe : le profil d'acteur est porté par Designation_Supervisor "
                 "(form. 5278) ou Monitored_Level (form. 4497, 4501, 4498). Les Formulaires A (14850, 5645) et "
                 "l'Inventaire MCF (9442) ne contiennent pas de profil d'acteur.", color="555555", sz=18))
body.append(table(
    ["Profil d'acteur", "Avril 2026", "Mai 2026"],
    [
        ["Superviseurs nationaux", "82", "59"],
        ["Superviseurs provinciaux", "578", "446"],
        ["Superviseurs d'axes (district)", "1 230", "1 015"],
        ["Superviseurs d'équipes", "21 695", "16 916"],
        ["Moniteurs indépendants", "1 349", "1 300"],
        ["Consultants (OMS, UNICEF, CDC, BMGF, IQVIA, AFENET, ONG, Croix-Rouge, stoppeurs…)", "316", "277"],
        ["Autres profils (non précisés)", "70", "74"],
    ],
    total=["Total renseigné", "25 320", "20 087"],
    aligns=["left", "right", "right"],
))

body.append(heading("3. Distribution brute des codes de désignation"))
body.append(para("Données brutes ODK (avant regroupement du §2), pour transparence et vérification.",
                 color="555555", sz=18))
body.append(table(
    ["Code ODK", "Avril 2026", "Mai 2026"],
    [
        ["team_sup (superviseur d'équipe)", "21 668", "16 894"],
        ["Team_supervisor", "27", "22"],
        ["Indp_Monitor (moniteur indépendant)", "1 349", "1 300"],
        ["District_sup (superviseur d'axe)", "1 230", "1 014"],
        ["subdistrict_sup", "0", "1"],
        ["region_supervi (superviseur provincial)", "578", "446"],
        ["national_super (superviseur national)", "82", "59"],
        ["WHO_Staff", "147", "139"],
        ["IQVIA", "59", "88"],
        ["Stopper (stoppeurs)", "69", "27"],
        ["Others (non précisé)", "70", "74"],
        ["UNICEF_Staff", "10", "4"],
        ["AFINET / AFNET", "13", "5"],
        ["Oth_NGO", "1", "9"],
        ["AFR_Staf", "4", "0"],
        ["ESR_Staff", "3", "1"],
        ["BMGF_Staff", "3", "0"],
        ["McKing", "3", "2"],
        ["CDC_Staff", "0", "1"],
        ["AfriCDC / Rotary / wcr_Staff / Red Cross", "4", "1"],
    ],
    aligns=["left", "right", "right"],
))

body.append(para("Filtre : province = Kasaï Central (champ Region). Source : API ODK/ONA whonghub.org (projet omsdrc/851) — "
                 "formulaires 4497, 14850, 5645, 9442, 5278, 4501, 4498. Fenêtres : Avril 23–30/04/2026 ; Mai 23/05–10/06/2026. "
                 "Extraction du 04/06/2026 — la fenêtre de mai étant encore en cours, les chiffres de mai sont partiels à cette date.",
                 color="777777", sz=16, space_before=200))

document = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            f'<w:document {NS}><w:body>{"".join(body)}'
            f'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
            f'<w:pgMar w:top="1134" w:bottom="1134" w:left="1134" w:right="1134"/></w:sectPr>'
            f'</w:body></w:document>')

content_types = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    '</Types>')

rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    '</Relationships>')

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", content_types)
    z.writestr("_rels/.rels", rels)
    z.writestr("word/document.xml", document)

print("OK ->", OUT)
