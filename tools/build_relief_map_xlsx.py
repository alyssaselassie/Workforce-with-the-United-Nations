#!/usr/bin/env python3
"""Builds relief-map/Relief-Map-Analysis-Template.xlsx from the survey model in relief-map/relief-map.js.

The workbook holds the fictional sample export on the Data sheet. Every score is a formula, so pasting
a real Qualtrics export (numeric values, seen-but-unanswered = -99) over the sample updates everything.
Usage: python3 tools/build_relief_map_xlsx.py   (then recalculate with LibreOffice to store values)
"""
import csv
import io
import json
import os
import subprocess

from openpyxl import Workbook
from openpyxl.chart import LineChart, Reference
from openpyxl.chart.layout import Layout, ManualLayout
from openpyxl.comments import Comment
from openpyxl.formatting.rule import ColorScaleRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'relief-map', 'Relief-Map-Analysis-Template.xlsx')
LAST = 2001  # Data rows 1..2001: three header rows and up to 1,998 responses
DATA = f"Data!$A$1:$ZZ${LAST}"

SPEC_JS = r"""
const RM = require(process.argv[1]);
console.log(JSON.stringify({
  title: RM.PROJECT_TITLE, version: RM.VERSION, k: RM.MIN_GROUP, skipped: RM.SKIPPED,
  minSetting: RM.MIN_SETTING_ITEMS, minOverall: RM.MIN_OVERALL_ITEMS,
  settings: RM.SETTINGS.map(s => ({ id: s.id, label: s.label })),
  dims: RM.DIMENSIONS.map(d => ({ id: d.id, label: d.label, color: d.color })),
  overall: RM.OVERALL.map(o => ({ id: o.id, text: o.text, construct: o.construct })),
  identity: RM.IDENTITY.map(q => ({ id: q.id, label: q.label, short: q.short, groups: q.groups, options: q.options })),
  codebookHeaders: RM.CODEBOOK_HEADERS, codebook: RM.codebookRows(),
  csv: RM.toQualtricsCSV()
}));
"""

ARIAL = 'Arial'
NAVY = '1B2A4E'
LAVENDER = 'ECE8F7'
YELLOW = 'FFF2CC'
F = lambda **kw: Font(name=ARIAL, size=kw.pop('size', 10), **kw)
THIN = Side(style='thin', color='D0D4DE')
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
HEAD_FILL = PatternFill('solid', fgColor=NAVY)
SUB_FILL = PatternFill('solid', fgColor=LAVENDER)
INPUT_FILL = PatternFill('solid', fgColor=YELLOW)
WRAP = Alignment(wrap_text=True, vertical='top')
CENTER = Alignment(horizontal='center', vertical='center', wrap_text=True)


def spec():
    out = subprocess.run(['node', '-e', SPEC_JS, os.path.join(ROOT, 'relief-map', 'relief-map.js')],
                         check=True, capture_output=True, text=True).stdout
    return json.loads(out)


def header(ws, row, values, col=1):
    for i, v in enumerate(values):
        c = ws.cell(row=row, column=col + i, value=v)
        c.font = F(bold=True, color='FFFFFF')
        c.fill = HEAD_FILL
        c.alignment = CENTER
        c.border = BOX


def title(ws, text, sub=None):
    ws['A1'] = text
    ws['A1'].font = F(size=15, bold=True, color=NAVY)
    if sub:
        ws['A2'] = sub
        ws['A2'].font = F(size=10, italic=True, color='5A6275')


def col_ref(name):
    """Whole-column range (rows 1..LAST) of the Data column whose header is `name`."""
    return f'INDEX({DATA},0,MATCH("{name}",Data!$1:$1,0))'


INCLUDE = f'Workings!$B$1:$B${LAST}'


def build():
    s = spec()
    wb = Workbook()
    readme = wb.active
    readme.title = 'Read me'
    data = wb.create_sheet('Data')
    rmap = wb.create_sheet('Relief Map')
    groups = wb.create_sheet('Groups')
    work = wb.create_sheet('Workings')
    lists = wb.create_sheet('Lists')
    book = wb.create_sheet('Codebook')

    # ---------- Data: the fictional sample export, exactly as Qualtrics lays it out ----------
    rows = list(csv.reader(io.StringIO(s['csv'])))
    for r, row in enumerate(rows, start=1):
        for c, v in enumerate(row, start=1):
            if r > 3 and v != '' and v.lstrip('-').isdigit():
                v = int(v)
            data.cell(row=r, column=c, value=v)
    for c in range(1, len(rows[0]) + 1):
        data.cell(row=1, column=c).font = F(bold=True)
        data.column_dimensions[get_column_letter(c)].width = 12
    data.freeze_panes = 'A4'
    data['A1'].comment = Comment('Paste your Qualtrics export here, starting in cell A1 (all three header rows included). '
                                 'Export with "Use numeric values" and "Recode seen but unanswered questions as -99". '
                                 'This sample is fictional.', 'Relief Maps Tool')

    # ---------- Lists: column numbers found by name, and group labels ----------
    lists['A1'], lists['B1'] = 'Variable', 'Column in Data'
    header(lists, 1, ['Variable', 'Column in Data'])
    names = ['Status', 'CONSENT'] + [f"{st['id']}_PS" for st in s['settings']] + ['OV_BEL'] + [q['id'] for q in s['identity']]
    for i, name in enumerate(names, start=2):
        lists.cell(row=i, column=1, value=name)
        lists.cell(row=i, column=2, value=f'=IFERROR(MATCH(A{i},Data!$1:$1,0),"missing")')
        defined = 'col_' + name
        wb.defined_names[defined] = DefinedName(defined, attr_text=f"Lists!$B${i}")
    gstart = len(names) + 4
    header(lists, gstart, ['Identity question', 'Variable', 'Group 1', 'Group 2', 'Group 3', 'Groups plotted'])
    for i, q in enumerate(s['identity']):
        r = gstart + 1 + i
        vals = [q['label'], q['id']] + (q['short'] + ['', '', ''])[:3] + [q['groups']]
        for c, v in enumerate(vals, start=1):
            lists.cell(row=r, column=c, value=v)
    g_first, g_last = gstart + 1, gstart + len(s['identity'])
    for col, w in zip('ABCDEF', (28, 14, 24, 26, 24, 14)):
        lists.column_dimensions[col].width = w

    # ---------- Workings: one row per Data row ----------
    wh = ['Data row', 'Include (1 = consented, real response)'] + [f"{st['label']}: person score" for st in s['settings']] + \
         ['Overall index: person score'] + [f"{q['label']} (code)" for q in s['identity']] + ['Has a score (1 = yes)']
    header(work, 1, wh)
    status = f'INDEX({DATA},ROW(),col_Status)'
    consent = f'INDEX({DATA},ROW(),col_CONSENT)'
    for r in range(2, LAST + 1):
        work.cell(row=r, column=1, value='=ROW()')
        work.cell(row=r, column=2, value=f'=IF(IFERROR({consent},"")=1,IF(IFERROR(OR({status}=0,{status}=4,{status}=16),TRUE),1,0),0)')
        for i, st in enumerate(s['settings']):
            rng = f"OFFSET(Data!$A$1,ROW()-1,col_{st['id']}_PS-1,1,5)"
            cnt = f'COUNTIFS({rng},">=1",{rng},"<=5")'
            sm = f'SUMIFS({rng},{rng},">=1",{rng},"<=5")'
            work.cell(row=r, column=3 + i, value=f'=IF($B{r}<>1,"",IFERROR(IF({cnt}>={s["minSetting"]},{sm}/{cnt},""),""))')
        rng = 'OFFSET(Data!$A$1,ROW()-1,col_OV_BEL-1,1,5)'
        cnt = f'COUNTIFS({rng},">=1",{rng},"<=5")'
        sm = f'SUMIFS({rng},{rng},">=1",{rng},"<=5")'
        work.cell(row=r, column=9, value=f'=IF($B{r}<>1,"",IFERROR(IF({cnt}>={s["minOverall"]},{sm}/{cnt},""),""))')
        for i, q in enumerate(s['identity']):
            v = f"INDEX({DATA},ROW(),col_{q['id']})"
            work.cell(row=r, column=10 + i, value=f'=IF($B{r}<>1,"",IFERROR(IF(AND(ISNUMBER({v}),{v}>=1),{v},""),""))')
        work.cell(row=r, column=15, value=f'=IF($B{r}<>1,0,IF(COUNT(C{r}:I{r})>0,1,0))')
        for c in range(3, 10):
            work.cell(row=r, column=c).number_format = '0.00'
    work.freeze_panes = 'C2'
    for c in range(1, 16):
        work.column_dimensions[get_column_letter(c)].width = 16
    work.row_dimensions[1].height = 54

    # ---------- Relief Map ----------
    title(rmap, 'Relief Map: everyone', 'Average agreement from 1 (strongly disagree) to 5 (strongly agree); higher is more positive. '
          'Yellow cell = you can change it. Everything else is a formula.')
    rmap['A4'], rmap['B4'] = 'Smallest group shown (k)', s['k']
    rmap['B4'].fill = INPUT_FILL
    rmap['B4'].font = F(bold=True)
    rmap['B4'].comment = Comment('Nothing based on fewer answers than this is shown. Never set it below 5.', 'Relief Maps Tool')
    dv = DataValidation(type='whole', operator='greaterThanOrEqual', formula1='5', showErrorMessage=True,
                        error='Use 5 or more to protect anonymity.', errorTitle='Too small')
    rmap.add_data_validation(dv)
    dv.add('B4')
    wb.defined_names['k_min'] = DefinedName('k_min', attr_text="'Relief Map'!$B$4")
    rmap['A5'], rmap['B5'] = 'Responses used', f'=SUM(Workings!$O$2:$O${LAST})'
    rmap['A6'], rmap['B6'] = 'Chose not to take part', f'=COUNTIF({col_ref("CONSENT")},2)'
    for c in ('A4', 'A5', 'A6'):
        rmap[c].font = F(bold=True)

    settings = s['settings']
    dims = s['dims']
    ncols = len(settings)
    last_col = get_column_letter(1 + ncols)

    def table_block(top, caption, row_labels, cell_formula, fmt, with_avg=False):
        rmap.cell(row=top, column=1, value=caption).font = F(bold=True, color=NAVY, size=11)
        header(rmap, top + 1, ['Dimension'] + [st['label'] for st in settings] + (['Average across settings'] if with_avg else []))
        for i, (label, dim) in enumerate(row_labels):
            r = top + 2 + i
            rmap.cell(row=r, column=1, value=label).font = F(bold=True)
            for j, st in enumerate(settings):
                c = rmap.cell(row=r, column=2 + j, value=cell_formula(dim, st, r, j))
                c.number_format = fmt
                c.border = BOX
                c.alignment = Alignment(horizontal='center')
            if with_avg:
                c = rmap.cell(row=r, column=2 + ncols, value=f'=IF(COUNT(B{r}:{last_col}{r})=0,"Hidden",AVERAGE(B{r}:{last_col}{r}))')
                c.number_format = fmt
                c.font = F(bold=True)
                c.border = BOX
                c.alignment = Alignment(horizontal='center')
        return top + 2

    dim_rows = [(d['label'], d) for d in dims]
    N_TOP = 18
    n_first = table_block(N_TOP, 'Number of answers (n)', dim_rows,
                          lambda d, st, r, j: f'=COUNTIFS({col_ref(st["id"] + "_" + d["id"])},">=1",{col_ref(st["id"] + "_" + d["id"])},"<=5",{INCLUDE},1)', '0')
    rmap.cell(row=n_first + len(dims), column=1, value='All five dimensions (people with a setting score)').font = F(bold=True)
    for j, st in enumerate(settings):
        wcol = get_column_letter(3 + j)
        c = rmap.cell(row=n_first + len(dims), column=2 + j, value=f'=COUNT(Workings!{wcol}$2:{wcol}${LAST})')
        c.border = BOX
        c.alignment = Alignment(horizontal='center')

    def mean_formula(d, st, r, j):
        item = col_ref(st['id'] + '_' + d['id'])
        ncell = f'{get_column_letter(2 + j)}{n_first + dims.index(d)}'
        return f'=IF({ncell}>=k_min,IFERROR(AVERAGEIFS({item},{item},">=1",{item},"<=5",{INCLUDE},1),"Hidden"),"Hidden")'

    A_TOP = 8
    a_first = table_block(A_TOP, 'Average agreement (1 to 5) by dimension and setting', dim_rows, mean_formula, '0.00', with_avg=True)
    srow = a_first + len(dims)
    rmap.cell(row=srow, column=1, value='All five dimensions (setting score)').font = F(bold=True)
    for j, st in enumerate(settings):
        wcol = get_column_letter(3 + j)
        c = rmap.cell(row=srow, column=2 + j, value=f'=IF(COUNT(Workings!{wcol}$2:{wcol}${LAST})>=k_min,AVERAGE(Workings!{wcol}$2:{wcol}${LAST}),"Hidden")')
        c.number_format = '0.00'
        c.font = F(bold=True)
        c.fill = SUB_FILL
        c.border = BOX
        c.alignment = Alignment(horizontal='center')
    rmap.conditional_formatting.add(f'B{a_first}:{last_col}{srow}', ColorScaleRule(start_type='num', start_value=1, start_color='F3C3B2',
                                                                                    mid_type='num', mid_value=3, mid_color='F2F2F2',
                                                                                    end_type='num', end_value=5, end_color='B7D6EE'))

    P_TOP = 28
    p_first = table_block(P_TOP, 'Share who agree or strongly agree (answers of 4 or 5)', dim_rows,
                          lambda d, st, r, j: (lambda item, ncell: f'=IF({ncell}>=k_min,COUNTIFS({item},">=4",{item},"<=5",{INCLUDE},1)/{ncell},"Hidden")')(
                              col_ref(st['id'] + '_' + d['id']), f'{get_column_letter(2 + j)}{n_first + dims.index(d)}'), '0%')
    K_TOP = 37
    table_block(K_TOP, f'Saw the statement but skipped it (exported as {s["skipped"]})', dim_rows,
                lambda d, st, r, j: f'=COUNTIFS({col_ref(st["id"] + "_" + d["id"])},{s["skipped"]},{INCLUDE},1)', '0')
    C_TOP = 46
    c_first = table_block(C_TOP, 'Chart data (a hidden value is stored as NA() so the chart draws no point)', dim_rows,
                          lambda d, st, r, j: f'=IF(ISNUMBER({get_column_letter(2 + j)}{a_first + dims.index(d)}),{get_column_letter(2 + j)}{a_first + dims.index(d)},NA())', '0.00')

    # Overall section
    O_TOP = 55
    rmap.cell(row=O_TOP, column=1, value='Overall workplace experience (everyone sees all five)').font = F(bold=True, color=NAVY, size=11)
    header(rmap, O_TOP + 1, ['Statement', 'Construct', 'Average', '% agree', 'Answers', 'Skipped'])
    for i, o in enumerate(s['overall']):
        r = O_TOP + 2 + i
        item = col_ref(o['id'])
        rmap.cell(row=r, column=1, value=o['text']).alignment = WRAP
        rmap.cell(row=r, column=2, value=o['construct']).alignment = WRAP
        rmap.cell(row=r, column=5, value=f'=COUNTIFS({item},">=1",{item},"<=5",{INCLUDE},1)')
        rmap.cell(row=r, column=3, value=f'=IF(E{r}>=k_min,AVERAGEIFS({item},{item},">=1",{item},"<=5",{INCLUDE},1),"Hidden")').number_format = '0.00'
        rmap.cell(row=r, column=4, value=f'=IF(E{r}>=k_min,COUNTIFS({item},">=4",{item},"<=5",{INCLUDE},1)/E{r},"Hidden")').number_format = '0%'
        rmap.cell(row=r, column=6, value=f'=COUNTIFS({item},{s["skipped"]},{INCLUDE},1)')
        for c in range(1, 7):
            rmap.cell(row=r, column=c).border = BOX
        rmap.row_dimensions[r].height = 28
    r = O_TOP + 2 + len(s['overall'])
    rmap.cell(row=r, column=1, value='Overall index (each person\'s average of the five, at least 3 answered)').font = F(bold=True)
    rmap.cell(row=r, column=5, value=f'=COUNT(Workings!$I$2:$I${LAST})')
    rmap.cell(row=r, column=3, value=f'=IF(E{r}>=k_min,AVERAGE(Workings!$I$2:$I${LAST}),"Hidden")').number_format = '0.00'
    rmap.cell(row=r, column=3).font = F(bold=True)

    rmap.column_dimensions['A'].width = 46
    for j in range(2, 3 + ncols):
        rmap.column_dimensions[get_column_letter(j)].width = 15
    for row in range(A_TOP + 1, A_TOP + 2):
        rmap.row_dimensions[row].height = 32

    chart = LineChart()
    chart.title = 'Relief Map: five experience dimensions across six workplace settings'
    chart.y_axis.title = 'Average agreement (1 to 5, higher is more positive)'
    chart.y_axis.scaling.min = 1
    chart.y_axis.scaling.max = 5
    chart.y_axis.majorUnit = 1
    chart.height, chart.width = 10.5, 24
    cats = Reference(rmap, min_col=2, max_col=1 + ncols, min_row=C_TOP + 1)
    for i, d in enumerate(dims):
        r = c_first + i
        chart.add_data(Reference(rmap, min_col=1, max_col=1 + ncols, min_row=r), from_rows=True, titles_from_data=True)
    chart.set_categories(cats)
    markers = {'PS': 'square', 'BEL': 'circle', 'INC': 'triangle', 'VOI': 'diamond', 'COM': 'x'}
    for ser, d in zip(chart.series, dims):
        ser.graphicalProperties.line.solidFill = d['color'].lstrip('#').upper()
        ser.graphicalProperties.line.width = 22000
        ser.marker.symbol = markers[d['id']]
        ser.marker.size = 7
        ser.marker.graphicalProperties.solidFill = d['color'].lstrip('#').upper()
        ser.marker.graphicalProperties.line.solidFill = d['color'].lstrip('#').upper()
        ser.smooth = False
    style_chart(chart)
    rmap.add_chart(chart, 'J8')
    rmap.freeze_panes = 'B8'

    # ---------- Groups ----------
    title(groups, 'Relief Map by group: overall experience in each setting',
          'Pick an identity question in the yellow cell. Groups with fewer answers than k are hidden, and so is any comparison '
          'that would let someone work out a hidden group.')
    groups['A4'], groups['B4'] = 'Compare by', s['identity'][0]['label']
    groups['B4'].fill = INPUT_FILL
    groups['B4'].font = F(bold=True)
    dv2 = DataValidation(type='list', formula1=f'Lists!$A${g_first}:$A${g_last}', showDropDown=False)
    groups.add_data_validation(dv2)
    dv2.add('B4')
    groups['A5'], groups['B5'] = 'Question number', f'=MATCH(B4,Lists!$A${g_first}:$A${g_last},0)'
    groups['A6'], groups['B6'] = 'Smallest group shown (k)', '=k_min'
    for c in ('A4', 'A5', 'A6'):
        groups[c].font = F(bold=True)

    ident = f'INDEX(Workings!$J$1:$N${LAST},0,$B$5)'
    GH = 8
    groups.cell(row=GH, column=1, value='Average overall experience (setting score, 1 to 5)').font = F(bold=True, color=NAVY, size=11)
    header(groups, GH + 1, ['Group'] + [st['label'] for st in settings])
    labels_top = GH + 2  # Everyone, then groups 1..3
    groups.cell(row=labels_top, column=1, value='Everyone').font = F(bold=True)
    for g in range(1, 4):
        groups.cell(row=labels_top + g, column=1,
                    value=f'=IF({g}<=INDEX(Lists!$F${g_first}:$F${g_last},$B$5),INDEX(Lists!$C${g_first}:$E${g_last},$B$5,{g}),"")').font = F(bold=True)
    # helper rows: answers per group, totals, pooled answers, comparison allowed
    HN = labels_top + 6
    groups.cell(row=HN - 1, column=1, value='Checks behind the privacy rule').font = F(bold=True, color=NAVY, size=11)
    header(groups, HN, ['Check'] + [st['label'] for st in settings])
    for j, st in enumerate(settings):
        wcol = get_column_letter(3 + j)
        score = f'Workings!${wcol}$1:${wcol}${LAST}'
        col = get_column_letter(2 + j)
        groups.cell(row=HN + 1, column=1, value='Answers, everyone')
        groups[f'{col}{HN + 1}'] = f'=COUNT({score})'
        for g in range(1, 4):
            groups.cell(row=HN + 1 + g, column=1, value=f'Answers, group {g}')
            groups[f'{col}{HN + 1 + g}'] = f'=IF($A${labels_top + g}="",0,COUNTIFS({score},">=1",{ident},{g}))'
        groups.cell(row=HN + 5, column=1, value='Groups at or above k')
        groups[f'{col}{HN + 5}'] = f'=({col}{HN + 2}>=k_min)+({col}{HN + 3}>=k_min)+({col}{HN + 4}>=k_min)'
        groups.cell(row=HN + 6, column=1, value='Pooled (small groups and people who did not say)')
        groups[f'{col}{HN + 6}'] = f'={col}{HN + 1}-({col}{HN + 2}>=k_min)*{col}{HN + 2}-({col}{HN + 3}>=k_min)*{col}{HN + 3}-({col}{HN + 4}>=k_min)*{col}{HN + 4}'
        groups.cell(row=HN + 7, column=1, value='Comparison allowed (1 = yes)')
        groups[f'{col}{HN + 7}'] = f'=IF(AND({col}{HN + 1}>=k_min,{col}{HN + 5}>=2,OR({col}{HN + 6}=0,{col}{HN + 6}>=k_min)),1,0)'
        groups[f'{col}{labels_top}'] = f'=IF({col}{HN + 1}>=k_min,AVERAGE({score}),"Hidden")'
        for g in range(1, 4):
            groups[f'{col}{labels_top + g}'] = (f'=IF($A${labels_top + g}="","",IF(AND({col}${HN + 7}=1,{col}{HN + 1 + g}>=k_min),'
                                                f'AVERAGEIFS({score},{score},">=1",{ident},{g}),"Hidden"))')
        for rr in range(labels_top, labels_top + 4):
            c = groups[f'{col}{rr}']
            c.number_format = '0.00'
            c.border = BOX
            c.alignment = Alignment(horizontal='center')
        for rr in range(HN + 1, HN + 8):
            groups[f'{col}{rr}'].alignment = Alignment(horizontal='center')
            groups[f'{col}{rr}'].border = BOX
    groups.conditional_formatting.add(f'B{labels_top}:{get_column_letter(1 + ncols)}{labels_top + 3}',
                                      ColorScaleRule(start_type='num', start_value=1, start_color='F3C3B2', mid_type='num', mid_value=3,
                                                     mid_color='F2F2F2', end_type='num', end_value=5, end_color='B7D6EE'))
    GC = HN + 10
    groups.cell(row=GC, column=1, value='Chart data (a hidden value is stored as NA() so the chart draws no point)').font = F(bold=True, color=NAVY, size=11)
    header(groups, GC + 1, ['Line'] + [st['label'] for st in settings])
    for g in range(0, 4):
        rr = GC + 2 + g
        groups.cell(row=rr, column=1, value=f'=IF($A${labels_top + g}="","(none)",$A${labels_top + g})')
        for j in range(ncols):
            col = get_column_letter(2 + j)
            groups[f'{col}{rr}'] = f'=IF(ISNUMBER({col}{labels_top + g}),{col}{labels_top + g},NA())'
            groups[f'{col}{rr}'].number_format = '0.00'
    groups.column_dimensions['A'].width = 46
    for j in range(2, 2 + ncols):
        groups.column_dimensions[get_column_letter(j)].width = 15
    gchart = LineChart()
    gchart.title = 'Overall experience by group'
    gchart.y_axis.title = 'Average agreement (1 to 5)'
    gchart.y_axis.scaling.min = 1
    gchart.y_axis.scaling.max = 5
    gchart.y_axis.majorUnit = 1
    gchart.height, gchart.width = 10, 22
    for g in range(4):
        gchart.add_data(Reference(groups, min_col=1, max_col=1 + ncols, min_row=GC + 2 + g), from_rows=True, titles_from_data=True)
    gchart.set_categories(Reference(groups, min_col=2, max_col=1 + ncols, min_row=GC + 1))
    for ser, (color, mk) in zip(gchart.series, [('8B90A0', 'circle'), ('0072B2', 'square'), ('D55E00', 'triangle'), ('009E73', 'diamond')]):
        ser.graphicalProperties.line.solidFill = color
        ser.graphicalProperties.line.width = 22000
        ser.marker.symbol = mk
        ser.marker.size = 7
        ser.marker.graphicalProperties.solidFill = color
        ser.marker.graphicalProperties.line.solidFill = color
        ser.smooth = False
    style_chart(gchart)
    groups.add_chart(gchart, 'J8')

    # ---------- Codebook ----------
    title(book, 'Codebook', 'Every variable in the Qualtrics export: wording, type, codes, who sees it, construct and source.')
    header(book, 4, [h[1] for h in s['codebookHeaders']])
    for i, row in enumerate(s['codebook'], start=5):
        for c, (key, _) in enumerate(s['codebookHeaders'], start=1):
            cell = book.cell(row=i, column=c, value=row.get(key, ''))
            cell.alignment = WRAP
            cell.border = BOX
    for col, w in zip('ABCDEFGHIJ', (16, 18, 44, 22, 34, 14, 24, 22, 18, 52)):
        book.column_dimensions[col].width = w
    book.freeze_panes = 'B5'

    # ---------- Read me ----------
    title(readme, 'Relief Maps Tool: analysis workbook', f"{s['title']} · survey version {s['version']}")
    checks = []
    for st in settings:
        exp = [f"{st['id']}_{d['id']}" for d in dims]
        checks.append((st['label'], exp, f"col_{st['id']}_PS"))
    checks.append(('Overall workplace experience', [o['id'] for o in s['overall']], 'col_OV_BEL'))
    lines = [
        ('What it does', None),
        ('Turns a Qualtrics export of the Relief Maps survey into the team Relief Map: an average for each dimension in each '
         'setting, setting scores, the overall section and group comparisons, with the privacy rules built in. The Data sheet holds a '
         'fictional sample team, so every number you see now is made up.', 'p'),
        ('How to use it', None),
        ('1. In Qualtrics: Data & Analysis > Export & Import > Export data > CSV. Choose "Use numeric values", and under more options tick '
         '"Recode seen but unanswered questions as -99".', 'p'),
        ('2. Open the CSV, select everything and copy it. On the Data sheet, click cell A1 and paste over the sample (keep all three '
         'header rows). Delete any leftover sample rows below your data.', 'p'),
        ('3. Check the data checks below say OK. If one says "Check", a column was renamed or moved: compare it with the Codebook.', 'p'),
        ('4. Read the Relief Map sheet. On the Groups sheet, pick an identity question in the yellow cell.', 'p'),
        ('5. Keep this file private. It contains individual responses. Share only the charts and tables, never the Data sheet.', 'p'),
        ('Cells you can change', None),
        ('Yellow cells: the smallest group shown (Relief Map!B4, never below 5) and the identity question (Groups!B4). The Data sheet '
         'is the paste area. Everything else is a formula: do not type over it.', 'p'),
        ('Scoring', None),
        ('Answers run from 1 (strongly disagree) to 5 (strongly agree). Every statement is positively worded, so higher always means a '
         'more positive experience. Each person sees 3 of the 5 statements in each setting, chosen at random.', 'p'),
        ('Each point on the map = the average of everyone who answered that statement. Setting score = for each person, the average of '
         f"the statements they answered in that setting (at least {s['minSetting']}), then averaged across people. Dimension average = the "
         f"average of its six points. Overall index = each person's average of the five overall statements (at least {s['minOverall']}). "
         '"% agree" = share answering 4 or 5.', 'p'),
        ('Missing answers', None),
        (f"Blank = not shown (the random selection, or the virtual setting after \"No\"). {s['skipped']} = seen but skipped. Both are left out, "
         'never counted as 0 or neutral. Responses without consent, previews, tests and spam (Status 1, 2, 8) are removed.', 'p'),
        ('Privacy rules', None),
        (f"Nothing based on fewer than k answers is shown (k = {s['k']} or more). For group comparisons, people in small groups and those "
         'who did not say are pooled; if that pool is between 1 and k-1, the comparison is hidden in that setting, so a hidden group cannot '
         'be worked out. Only one identity question is compared at a time. Never report comments word for word.', 'p'),
        ('Data checks', None),
    ]
    r = 4
    for text, kind in lines:
        c = readme.cell(row=r, column=1, value=text)
        if kind is None:
            c.font = F(size=11, bold=True, color=NAVY)
        else:
            c.font = F()
            c.alignment = WRAP
            readme.merge_cells(start_row=r, start_column=1, end_row=r, end_column=3)
            readme.row_dimensions[r].height = 15 * max(1, len(text) // 105 + 1)
        r += 1
    header(readme, r, ['Block', 'Expected columns', 'Check'])
    r += 1
    for label, exp, name in checks:
        readme.cell(row=r, column=1, value=label)
        readme.cell(row=r, column=2, value=', '.join(exp)).alignment = WRAP
        conds = ','.join(f'INDEX(Data!$1:$1,{name}+{k})="{e}"' for k, e in enumerate(exp))
        readme.cell(row=r, column=3, value=f'=IFERROR(IF(AND({conds}),"OK","Check"),"Check: column missing")')
        for c in range(1, 4):
            readme.cell(row=r, column=c).border = BOX
        r += 1
    readme.cell(row=r, column=1, value='Consent column (CONSENT)')
    readme.cell(row=r, column=3, value='=IF(ISNUMBER(col_CONSENT),"OK","Check: column missing")')
    for c in range(1, 4):
        readme.cell(row=r, column=c).border = BOX
    readme.column_dimensions['A'].width = 34
    readme.column_dimensions['B'].width = 62
    readme.column_dimensions['C'].width = 22

    for ws in wb.worksheets:
        ws.sheet_view.showGridLines = ws.title in ('Data', 'Workings')
        for row in ws.iter_rows():
            for cell in row:
                if cell.font is None or cell.font.name != ARIAL:
                    f = cell.font
                    cell.font = Font(name=ARIAL, size=f.size or 10, bold=f.bold, italic=f.italic, color=f.color)
    wb.active = 0
    wb.save(OUT)
    print('Wrote', os.path.relpath(OUT, ROOT))


def style_chart(chart):
    chart.roundedCorners = False
    chart.legend.position = 'b'
    chart.legend.overlay = False
    chart.x_axis.delete = False
    chart.y_axis.delete = False
    chart.dispBlanksAs = 'gap'
    if chart.title is not None:
        try:
            chart.title.overlay = False
        except AttributeError:
            pass


if __name__ == '__main__':
    build()
