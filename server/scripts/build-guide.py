"""Builds assets/Kokobi-Usage-Guide.pdf (the guide emailed to customers after delivery).
Edit the text below, run:  python3 scripts/build-guide.py   then:  npm run build:guide
Needs: pip install reportlab"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle, KeepTogether, Flowable, PageBreak, CondPageBreak
from reportlab.platypus.flowables import HRFlowable

HERE = os.path.dirname(os.path.abspath(__file__))
LOGO = os.path.join(HERE, '..', 'assets', 'logo.png')
OUT = os.path.join(HERE, '..', 'assets', 'Kokobi-Usage-Guide.pdf')

GREEN = colors.HexColor('#17391F'); LEAF = colors.HexColor('#1F7A4D'); ORANGE = colors.HexColor('#B4521A')
CREAM = colors.HexColor('#FBF5E1'); SAND = colors.HexColor('#E4D6AE'); MUTED = colors.HexColor('#58614F'); INK = colors.HexColor('#1d2a1f')
W, H = A4; M = 18 * mm

def st(name, **kw):
    base = dict(fontName='Helvetica', fontSize=10.5, leading=15.5, textColor=INK, alignment=TA_LEFT)
    base.update(kw); return ParagraphStyle(name, **base)
body = st('body'); small = st('small', fontSize=9, leading=13, textColor=MUTED)
h1 = st('h1', fontName='Helvetica-Bold', fontSize=15, leading=19, textColor=GREEN, spaceBefore=4, spaceAfter=3)
h2 = st('h2', fontName='Helvetica-Bold', fontSize=13, leading=17, textColor=GREEN)
lead = st('lead', fontName='Helvetica-Bold', fontSize=12.5, leading=17, textColor=LEAF)
bullet = st('bullet', leftIndent=14, bulletIndent=2, spaceAfter=2)
label = st('label', fontName='Helvetica-Bold', fontSize=9.5, leading=13, textColor=GREEN)
tipt = st('tipt', fontName='Helvetica-Bold', fontSize=10.8, leading=14.5, textColor=GREEN)

class Leaf(Flowable):
    """A small hand-drawn leaf, used instead of an emoji (PDF fonts cannot draw emoji)."""
    def __init__(self, size=14, color=LEAF): super().__init__(); self.s = size; self.c = color; self.width = size; self.height = size
    def draw(self):
        c = self.canv; s = self.s; c.saveState(); c.setFillColor(self.c); c.setStrokeColor(self.c)
        p = c.beginPath(); p.moveTo(0.08*s, 0.1*s); p.curveTo(0.0*s, 0.75*s, 0.45*s, 1.0*s, 0.95*s, 0.95*s); p.curveTo(1.0*s, 0.45*s, 0.65*s, 0.0*s, 0.08*s, 0.1*s); c.drawPath(p, fill=1, stroke=0)
        c.setStrokeColor(colors.white); c.setLineWidth(0.8); c.line(0.12*s, 0.14*s, 0.8*s, 0.8*s); c.restoreState()

class Banner(Flowable):
    """Page-1 header: green band, logo on a cream tile, title and tagline."""
    def __init__(self): super().__init__(); self.height = 56 * mm
    def wrap(self, aw, ah): self.width = aw; return aw, self.height
    def draw(self):
        c = self.canv; w = self.width; h = self.height
        c.saveState(); c.setFillColor(GREEN); c.roundRect(0, 0, w, h, 6*mm, fill=1, stroke=0)
        c.saveState(); p = c.beginPath(); p.roundRect(0, 0, w, h, 6*mm); c.clipPath(p, stroke=0, fill=0)
        c.setFillColor(LEAF); c.circle(w - 6*mm, h - 4*mm, 30*mm, fill=1, stroke=0)   # soft decoration, clipped to the band
        c.setFillColor(colors.HexColor('#1B4A29')); c.circle(w - 30*mm, 2*mm, 16*mm, fill=1, stroke=0)
        c.restoreState()
        # logo tile
        tw, th = 58*mm, 21*mm; tx, ty = 8*mm, h - th - 7*mm
        c.setFillColor(CREAM); c.roundRect(tx, ty, tw, th, 4*mm, fill=1, stroke=0)
        c.drawImage(LOGO, tx + 4*mm, ty + 2*mm, width=tw - 8*mm, height=th - 4*mm, mask='auto', preserveAspectRatio=True)
        c.setFillColor(CREAM); c.setFont('Helvetica-Bold', 19); c.drawString(8*mm, 17.5*mm, 'CUSTOMER USAGE &')
        c.drawString(8*mm, 10.5*mm, 'NUTRITION GUIDE')
        c.setFont('Helvetica-Oblique', 11); c.setFillColor(SAND); c.drawString(8*mm, 4*mm, 'Everyday wellness, made easier.')
        c.restoreState()

def section(title): return [CondPageBreak(50*mm), Paragraph(title, h1), HRFlowable(width='100%', thickness=1.6, color=ORANGE, spaceAfter=8, spaceBefore=1)]
def bullets(items): return [Paragraph(t, bullet, bulletText='•') for t in items]

def box(flow, bg=CREAM, border=SAND, pad=10):
    t = Table([[flow]], colWidths=[W - 2*M]); t.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,-1), bg), ('BOX', (0,0), (-1,-1), 0.9, border), ('ROUNDEDCORNERS', [6,6,6,6]), ('LEFTPADDING', (0,0), (-1,-1), pad+2), ('RIGHTPADDING', (0,0), (-1,-1), pad+2), ('TOPPADDING', (0,0), (-1,-1), pad), ('BOTTOMPADDING', (0,0), (-1,-1), pad)])); return t

def formula_card(title, intro, serving, rows, enjoy, closing, basis='40 g'):
    inner_w = W - 2*M - 24
    head = Table([[Leaf(15), Paragraph(title, h2)]], colWidths=[8*mm, inner_w - 8*mm]); head.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'MIDDLE'), ('LEFTPADDING', (0,0), (-1,-1), 0), ('BOTTOMPADDING', (0,0), (-1,-1), 0), ('TOPPADDING', (0,0), (-1,-1), 0)]))
    lw, rw = inner_w * 0.56, inner_w * 0.44
    srv = Table([[Paragraph(f'<b>{k}</b>', small), Paragraph(v, st('sv', fontSize=10, leading=14))] for k, v in serving], colWidths=[22*mm, lw - 22*mm - 12])
    srv.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP'), ('TOPPADDING', (0,0), (-1,-1), 2), ('BOTTOMPADDING', (0,0), (-1,-1), 2), ('LEFTPADDING', (0,0), (-1,-1), 0), ('LINEBELOW', (0,0), (-1,-2), 0.4, SAND)]))
    nt = Table([[Paragraph('<b>Nutrient</b>', body), Paragraph('<b>Amount</b>', st('r', alignment=2))]] + [[Paragraph(a, body), Paragraph(b, st('r2', alignment=2))] for a, b in rows], colWidths=[rw * 0.58, rw * 0.42])
    nt.setStyle(TableStyle([('LINEBELOW', (0,0), (-1,0), 1, LEAF), ('LINEBELOW', (0,1), (-1,-2), 0.4, SAND), ('TOPPADDING', (0,0), (-1,-1), 2.5), ('BOTTOMPADDING', (0,0), (-1,-1), 2.5), ('LEFTPADDING', (0,0), (-1,-1), 3), ('RIGHTPADDING', (0,0), (-1,-1), 3)]))
    left = [Paragraph('SUGGESTED SERVING', label), Spacer(1, 2), srv, Spacer(1, 9), Paragraph('HOW TO ENJOY IT', label), Spacer(1, 2)] + bullets(enjoy)
    right = [Paragraph(f'ESTIMATED NUTRITIONAL VALUES<br/>PER {basis} SERVING', label), Spacer(1, 4), nt]
    cols = Table([[left, right]], colWidths=[lw, rw]); cols.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP'), ('LEFTPADDING', (0,0), (-1,-1), 0), ('RIGHTPADDING', (0,0), (0,0), 12), ('RIGHTPADDING', (1,0), (1,0), 0), ('TOPPADDING', (0,0), (-1,-1), 0), ('BOTTOMPADDING', (0,0), (-1,-1), 0)]))
    inner = [head, Spacer(1, 4), Paragraph(intro, body), Spacer(1, 8), cols, Spacer(1, 6), Paragraph(closing, st('cl', fontName='Helvetica-Oblique', textColor=GREEN))]
    return KeepTogether([box(inner, bg=colors.white, border=LEAF, pad=11), Spacer(1, 4)])

story = [Banner(), Spacer(1, 10),
 Paragraph('Thank you for choosing KOKÓBI+!', lead), Spacer(1, 3),
 Paragraph('Our nutritional blends are created to make everyday nourishment easier and more enjoyable. To get the best out of your product, it’s important to understand how to use it, maintain balanced eating habits and stay consistent.', body), Spacer(1, 4),
 Paragraph('<b>Here is everything you need to know.</b>', body), Spacer(1, 6)]

story += section('1. MEET YOUR KOKÓBI+ FORMULAS')[1:]
story.append(formula_card('FORMULA A — WEIGHT GAIN BLEND',
  'Formula A is designed to support healthy weight gain by providing additional calories, protein and other nutrients to complement your everyday meals. It works best when combined with adequate food intake, balanced meals and consistency.',
  [('Serving size', '40 g'), ('Frequency', 'Once daily initially, alongside regular meals.'), ('Preparation', 'Mix into milk or water, or blend into your favourite smoothie.')],
  [('Energy', '181 kcal'), ('Protein', '9 g'), ('Carbohydrates', '17.1 g'), ('Fat', '9.8 g'), ('Fibre', '3.3 g')],
  ['Blend with milk and banana.', 'Add to oats or pap.', 'Blend with peanut butter for additional calories.', 'Mix into your favourite homemade smoothie.'],
  'Remember: Formula A complements your meals; it does not replace them.'))
story.append(formula_card('FORMULA B — EVERYDAY NUTRITION BLEND',
  'Formula B is designed to support everyday nourishment by providing a combination of protein, carbohydrates, healthy fats and dietary fibre. It is suitable for people looking to complement their everyday diet with a nourishing blend.',
  [('Serving size', '40 g'), ('Frequency', 'Once daily.'), ('Preparation', 'Mix into milk or water, or add to your favourite smoothie.')],
  [('Energy', '184 kcal'), ('Protein', '12.1 g'), ('Carbohydrates', '13.2 g'), ('Fat', '10.5 g'), ('Fibre', '4 g')],
  ['Mix with milk or water.', 'Add to oats or pap.', 'Blend with fruits.', 'Incorporate into your everyday breakfast routine.'],
  'Important: Formula B is an everyday nutrition blend, not a dedicated weight-gain formula.'))

which = [Paragraph('NOT SURE YOU CHOSE THE RIGHT FORMULA?', st('wh', fontName='Helvetica-Bold', fontSize=11.5, leading=15, textColor=GREEN)), Spacer(1, 4),
  Paragraph('Both blends are nourishing, and both can be part of a balanced routine. Here is a simple way to tell them apart:', body), Spacer(1, 4)] + bullets([
  '<b>Formula A</b> is our energy-led, weight-gain blend. It has more oats, millet and groundnut, so it leans towards carbohydrate energy and a smooth, easy-to-drink texture.',
  '<b>Formula B</b> is our protein-led, everyday blend. It has more soy and added pea protein, plus a little more fibre and seeds.',
  'Per serving, the two are close in calories. What matters most for either one is your overall eating: regular meals, enough calories, protein and consistency (see Section 2).',
  'Chose Formula B and want more calories? Blend it with milk, banana or peanut butter. If a richer or higher-fibre drink feels filling, start with a smaller amount and build up.']) + [Spacer(1, 3), Paragraph('Questions? Message us on WhatsApp and we will help you choose.', small)]
story.append(box(which, bg=CREAM, border=SAND))
story.append(Spacer(1, 6))

story += section('2. TIPS FOR HEALTHY WEIGHT GAIN')
story.append(Paragraph('If you’re using Formula A, here are some important habits to adopt:', body)); story.append(Spacer(1, 6))
tips = [('Eat consistently.', 'Don’t skip meals. Aim for regular breakfast, lunch and dinner, with nutritious snacks in between if needed.'),
 ('Eat enough calories.', 'Healthy weight gain requires consuming more calories than your body burns. Formula A can help supplement your calorie intake, but your overall diet matters.'),
 ('Include protein in your meals.', 'Enjoy foods such as eggs, fish, chicken, beans, milk and other protein-rich foods.'),
 ('Don’t forget carbohydrates.', 'Rice, yam, potatoes, oats, pasta and other carbohydrate-rich foods provide energy.'),
 ('Include healthy fats.', 'Avocados, groundnuts, nuts and other healthy fat sources can help increase your daily calorie intake.'),
 ('Stay hydrated.', 'Drink enough water throughout the day.'),
 ('Get enough rest.', 'Adequate sleep and recovery are important for overall health and muscle development.'),
 ('Be consistent and patient.', 'Healthy weight gain takes time. Your results will depend on your eating habits, activity levels, health and consistency.')]
class Num(Flowable):
    def __init__(self, n): super().__init__(); self.n = n; self.width = 8*mm; self.height = 8*mm
    def draw(self):
        c = self.canv; c.setFillColor(LEAF); c.circle(4*mm, 4*mm, 3.6*mm, fill=1, stroke=0); c.setFillColor(colors.white); c.setFont('Helvetica-Bold', 10); c.drawCentredString(4*mm, 2.6*mm, str(self.n))
for i, (t, d) in enumerate(tips, 1):
    row = Table([[Num(i), [Paragraph(t, tipt), Paragraph(d, body)]]], colWidths=[11*mm, W - 2*M - 11*mm]); row.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP'), ('LEFTPADDING', (0,0), (-1,-1), 0), ('TOPPADDING', (0,0), (-1,-1), 0), ('BOTTOMPADDING', (0,0), (-1,-1), 3)]))
    story.append(KeepTogether(row))

story += section('3. IMPORTANT THINGS TO REMEMBER')
story.append(box(bullets(['Do not use either formula as a replacement for your regular meals.', 'Follow the recommended serving instructions.', 'Avoid exceeding the recommended serving.', 'Always use a clean, dry spoon.', 'Keep the package tightly sealed after every use.', 'Store in a cool, dry place, away from moisture and direct sunlight.', 'Check the ingredient list for potential allergens before consumption.'])))
story.append(Spacer(1, 8))
story.append(box([Paragraph('If you have an existing medical condition, food allergies, dietary restrictions, or are pregnant or breastfeeding, <b>consult a qualified healthcare professional before use.</b>', body), Spacer(1, 5),
  Paragraph('If you are experiencing unexplained weight loss or persistent difficulty gaining weight, <b>seek medical advice.</b>', body)], bg=colors.HexColor('#FDF1E6'), border=ORANGE))

story += section('4. A NOTE ON RESULTS')
story += [Paragraph('<b>Everybody’s body is different.</b>', body), Spacer(1, 3),
 Paragraph('Your nutritional needs, metabolism, lifestyle and eating habits can influence your results. KOKÓBI+ encourages healthy nourishment, consistency and realistic expectations.', body), Spacer(1, 3),
 Paragraph('We do not promise a specific amount of weight gain within a particular number of days.', body), Spacer(1, 14)]

close = Table([[Leaf(18, SAND), [Paragraph('A LITTLE REMINDER FROM KOKÓBI+', st('c1', fontName='Helvetica-Bold', fontSize=12, leading=16, textColor=CREAM)), Spacer(1, 4),
  Paragraph('Nourishment is a journey, not a competition.', st('c2', textColor=CREAM, fontSize=11)), Paragraph('<b>Eat well. Stay consistent. Take care of your body.</b>', st('c3', textColor=CREAM, fontSize=11)), Spacer(1, 5),
  Paragraph('Thank you for making KOKÓBI+ part of your everyday wellness routine.', st('c4', textColor=SAND)), Spacer(1, 6),
  Paragraph('<b>KOKÓBI+</b> <i>Everyday wellness, made easier.</i>', st('c5', textColor=CREAM))]]], colWidths=[12*mm, W - 2*M - 12*mm])
close.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,-1), GREEN), ('ROUNDEDCORNERS', [8,8,8,8]), ('VALIGN', (0,0), (-1,-1), 'TOP'), ('LEFTPADDING', (0,0), (-1,-1), 14), ('RIGHTPADDING', (0,0), (-1,-1), 14), ('TOPPADDING', (0,0), (-1,-1), 14), ('BOTTOMPADDING', (0,0), (-1,-1), 14)]))
story.append(KeepTogether(close))

TOTAL = {'n': 0}
def decorate(c, doc):
    c.saveState()
    if doc.page > 1:
        c.drawImage(LOGO, M, H - 14*mm, width=26*mm, height=26*mm * 198/544, mask='auto')
        c.setFont('Helvetica', 8.5); c.setFillColor(MUTED); c.drawRightString(W - M, H - 11*mm, 'Customer Usage & Nutrition Guide')
        c.setStrokeColor(SAND); c.setLineWidth(0.6); c.line(M, H - 16*mm, W - M, H - 16*mm)
    c.setStrokeColor(SAND); c.setLineWidth(0.6); c.line(M, 14*mm, W - M, 14*mm)
    c.setFont('Helvetica', 8); c.setFillColor(MUTED)
    c.drawString(M, 9.5*mm, 'KOKÓBI+  •  kokobifoods@gmail.com  •  WhatsApp +234 704 877 9681  •  Instagram & TikTok @kokobifoods')
    c.drawRightString(W - M, 9.5*mm, f'Page {doc.page}')
    c.restoreState()

doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=M, rightMargin=M, topMargin=M, bottomMargin=20*mm, title='KOKÓBI+ Customer Usage & Nutrition Guide', author='KOKÓBI+', subject='Everyday wellness, made easier.')
doc.addPageTemplates([PageTemplate(id='p', frames=[Frame(M, 20*mm, W - 2*M, H - 20*mm - 22*mm, id='f', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)], onPage=decorate)])
# first page has a taller content area (no running header)
doc.pageTemplates[0].frames[0]._y1 = 20*mm
doc.build(story)
print('wrote', OUT)
