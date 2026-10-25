from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT, TA_CENTER
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, ListFlowable, ListItem, NextPageTemplate,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

F = '/tmp/fonts/package/ttf/'
pdfmetrics.registerFont(TTFont('Sans', F + 'DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('Sans-Bold', F + 'DejaVuSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Sans-Italic', F + 'DejaVuSans-Oblique.ttf'))
pdfmetrics.registerFontFamily('Sans', normal='Sans', bold='Sans-Bold', italic='Sans-Italic', boldItalic='Sans-Bold')

INK = colors.HexColor('#1c1917')
MUTED = colors.HexColor('#57534e')
ACCENT = colors.HexColor('#ea580c')
SOFT = colors.HexColor('#fff7ed')
LINE = colors.HexColor('#e7e5e4')
WHITE = colors.white

CLIENT = {
    'name': 'Yummy S.C. Marcin Krystosiak, Aleksandra Brzoza',
    'nip': '6423234493',
    'address': 'ul. Gen. Władysława Andersa 7, 44-270 Rybnik',
}
SYSTEM = 'Platforma Yummy'
DATE = 'Październik 2026'

S = {
    'h1': ParagraphStyle('h1', fontName='Sans-Bold', fontSize=19, leading=24, textColor=INK, spaceBefore=4, spaceAfter=4),
    'h2': ParagraphStyle('h2', fontName='Sans-Bold', fontSize=12.5, leading=16, textColor=ACCENT, spaceBefore=12, spaceAfter=4),
    'h3': ParagraphStyle('h3', fontName='Sans-Bold', fontSize=10.5, leading=14, textColor=INK, spaceBefore=8, spaceAfter=2),
    'p': ParagraphStyle('p', fontName='Sans', fontSize=9.4, leading=14, textColor=INK, alignment=TA_JUSTIFY, spaceAfter=5),
    'lead': ParagraphStyle('lead', fontName='Sans', fontSize=11, leading=16.5, textColor=MUTED, alignment=TA_LEFT, spaceAfter=8),
    'li': ParagraphStyle('li', fontName='Sans', fontSize=9.4, leading=13.5, textColor=INK, alignment=TA_LEFT),
    'cell': ParagraphStyle('cell', fontName='Sans', fontSize=8.6, leading=11.5, textColor=INK),
    'cellb': ParagraphStyle('cellb', fontName='Sans-Bold', fontSize=8.6, leading=11.5, textColor=WHITE),
    'box': ParagraphStyle('box', fontName='Sans', fontSize=9.2, leading=13.5, textColor=INK),
    'boxt': ParagraphStyle('boxt', fontName='Sans-Bold', fontSize=9.6, leading=13, textColor=ACCENT, spaceAfter=3),
    'kpiv': ParagraphStyle('kpiv', fontName='Sans-Bold', fontSize=16, leading=20, textColor=ACCENT, alignment=TA_CENTER),
    'kpil': ParagraphStyle('kpil', fontName='Sans', fontSize=7.6, leading=10, textColor=MUTED, alignment=TA_CENTER),
    'sec': ParagraphStyle('sec', fontName='Sans-Bold', fontSize=10.5, leading=14, textColor=INK, alignment=TA_CENTER, spaceBefore=12, spaceAfter=6),
    'small': ParagraphStyle('small', fontName='Sans', fontSize=8, leading=11, textColor=MUTED),
}

CONTENT_W = A4[0] - 40 * mm


def h1(t): return Paragraph(t, S['h1'])
def h2(t): return Paragraph(t, S['h2'])
def h3(t): return Paragraph(t, S['h3'])
def p(t): return Paragraph(t, S['p'])
def lead(t): return Paragraph(t, S['lead'])
def sec(t): return Paragraph(t, S['sec'])
def small(t): return Paragraph(t, S['small'])
def sp(h=6): return Spacer(1, h)
def br(): return PageBreak()


def ul(items):
    return ListFlowable(
        [ListItem(Paragraph(i, S['li']), leftIndent=12, value='•') for i in items],
        bulletType='bullet', bulletColor=ACCENT, bulletFontName='Sans-Bold', bulletFontSize=9,
        leftIndent=12, spaceBefore=1, spaceAfter=6,
    )


def ol(items):
    return ListFlowable(
        [ListItem(Paragraph(i, S['li']), leftIndent=16) for i in items],
        bulletType='1', bulletFormat='%s.', bulletFontName='Sans-Bold', bulletFontSize=9,
        bulletColor=INK, leftIndent=16, spaceAfter=6,
    )


def table(rows, widths=None, header=True):
    n = len(rows[0])
    widths = [CONTENT_W * w for w in widths] if widths else [CONTENT_W / n] * n
    data = []
    for r_i, row in enumerate(rows):
        style = S['cellb'] if header and r_i == 0 else S['cell']
        data.append([Paragraph(str(c), style) for c in row])
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    st = [
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LINEBELOW', (0, 0), (-1, -1), 0.4, LINE),
        ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]
    if header:
        st.append(('BACKGROUND', (0, 0), (-1, 0), INK))
        for i in range(2, len(rows), 2):
            st.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#fafaf9')))
    t.setStyle(TableStyle(st))
    return KeepTogether([sp(2), t, sp(8)]) if len(rows) < 9 else t


def box(title, text):
    content = [Paragraph(title, S['boxt'])]
    if isinstance(text, list):
        content += [Paragraph('• ' + x, S['box']) for x in text]
    else:
        content.append(Paragraph(text, S['box']))
    t = Table([[content]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), SOFT),
        ('LINEBEFORE', (0, 0), (0, -1), 3, ACCENT),
        ('LEFTPADDING', (0, 0), (-1, -1), 12), ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 9), ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
    ]))
    return KeepTogether([sp(4), t, sp(8)])


def kpis(pairs):
    row1 = [Paragraph(v, S['kpiv']) for v, _ in pairs]
    row2 = [Paragraph(l, S['kpil']) for _, l in pairs]
    w = CONTENT_W / len(pairs)
    t = Table([row1, row2], colWidths=[w] * len(pairs))
    t.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.6, LINE), ('LINEAFTER', (0, 0), (-2, -1), 0.6, LINE),
        ('TOPPADDING', (0, 0), (-1, 0), 10), ('BOTTOMPADDING', (0, 1), (-1, 1), 10),
        ('TOPPADDING', (0, 1), (-1, 1), 0), ('BOTTOMPADDING', (0, 0), (-1, 0), 2),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    return KeepTogether([sp(4), t, sp(10)])


def toc(items):
    rows = [[Paragraph(f'<font color="#ea580c"><b>{n}</b></font>', S['cell']), Paragraph(t, S['cell'])] for n, t in items]
    t = Table(rows, colWidths=[14 * mm, CONTENT_W - 14 * mm])
    t.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, -1), 0.4, LINE),
        ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    return t


def build(path, doc_title, doc_code, cover_title, cover_sub, story):
    def cover(c, d):
        w, h = A4
        c.saveState()
        c.setFillColor(INK); c.rect(0, 0, w, h, fill=1, stroke=0)
        c.setFillColor(ACCENT); c.rect(0, h - 9 * mm, w, 9 * mm, fill=1, stroke=0)
        c.rect(20 * mm, 122 * mm, 26 * mm, 2.2 * mm, fill=1, stroke=0)
        c.setFillColor(colors.HexColor('#a8a29e')); c.setFont('Sans', 9)
        c.drawString(20 * mm, h - 30 * mm, SYSTEM.upper() + '   •   DOKUMENTACJA SYSTEMU')
        c.drawString(20 * mm, h - 36 * mm, doc_code)
        c.setFillColor(WHITE); c.setFont('Sans-Bold', 28)
        y = 175 * mm
        for line in cover_title.split('\n'):
            c.drawString(20 * mm, y, line); y -= 12.5 * mm
        c.setFont('Sans', 11.5); c.setFillColor(colors.HexColor('#d6d3d1'))
        y = 110 * mm
        for line in cover_sub.split('\n'):
            c.drawString(20 * mm, y, line); y -= 6.5 * mm
        c.setFillColor(colors.HexColor('#a8a29e')); c.setFont('Sans', 8.5)
        c.drawString(20 * mm, 32 * mm, f'Licencjobiorca: {CLIENT["name"]}')
        c.drawString(20 * mm, 27 * mm, f'Wersja dokumentu 1.1   •   {DATE}')
        c.setFillColor(ACCENT); c.setFont('Sans-Bold', 8.5)
        c.drawString(20 * mm, 20 * mm, 'DOKUMENT POUFNY – WYŁĄCZNIE DLA STRON UMOWY')
        c.restoreState()

    def page(c, d):
        w, h = A4
        c.saveState()
        c.setStrokeColor(LINE); c.setLineWidth(0.5)
        c.line(20 * mm, h - 15 * mm, w - 20 * mm, h - 15 * mm)
        c.line(20 * mm, 15 * mm, w - 20 * mm, 15 * mm)
        c.setFont('Sans-Bold', 7.5); c.setFillColor(ACCENT)
        c.drawString(20 * mm, h - 12 * mm, SYSTEM.upper())
        c.setFont('Sans', 7.5); c.setFillColor(MUTED)
        c.drawRightString(w - 20 * mm, h - 12 * mm, doc_title)
        c.drawString(20 * mm, 10.5 * mm, f'{doc_code}   •   Poufne')
        c.drawRightString(w - 20 * mm, 10.5 * mm, f'Strona {d.page}')
        c.restoreState()

    doc = BaseDocTemplate(path, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm,
                          topMargin=22 * mm, bottomMargin=22 * mm,
                          title=doc_title, author=SYSTEM, subject=doc_title)
    fr = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='f')
    doc.addPageTemplates([
        PageTemplate(id='cover', frames=[fr], onPage=cover),
        PageTemplate(id='body', frames=[fr], onPage=page),
    ])
    doc.build([NextPageTemplate('body'), PageBreak()] + story)
