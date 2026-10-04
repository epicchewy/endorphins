from io import BytesIO
from pathlib import Path
import json,re,sys
from pypdf import PdfReader
from fontTools.cffLib import CFFFontSet
from fontTools.fontBuilder import FontBuilder
from fontTools.ttLib import TTFont,newTable
from fontTools import agl
from fontTools.pens.boundsPen import BoundsPen

root=Path(__file__).resolve().parents[3]
out=root/'docs/design/font-recovery'
source_path=Path(sys.argv[1])
reader=PdfReader(source_path)
source=reader.pages[0]['/Resources']['/Font']['/T1_0']
descriptor=source['/FontDescriptor']
cff=CFFFontSet();cff.decompile(BytesIO(descriptor['/FontFile3'].get_data()),None)
top=cff.topDictIndex[0]
glyph_order=top.charset
cmap={}
for name in glyph_order:
 if name=='.notdef' or '.' in name or '_' in name:continue
 value=agl.toUnicode(name)
 # This specimen uses uni-prefixed names for some non-BMP symbols.
 if not value and re.fullmatch(r'uni[0-9A-F]{5,6}',name):
  cp=int(name[3:],16)
  if cp<=0x10ffff:value=chr(cp)
 if len(value)==1:cmap[ord(value)]=name
metrics={}
for name in glyph_order:
 char=top.CharStrings[name]
 pen=BoundsPen(None);char.draw(pen)
 metrics[name]=(round(char.width),round(pen.bounds[0]) if pen.bounds else 0)
fb=FontBuilder(1000,isTTF=False)
fb.setupGlyphOrder(glyph_order)
fb.setupCharacterMap(cmap)
fb.setupHorizontalMetrics(metrics)
fb.setupHorizontalHeader(ascent=int(descriptor['/Ascent']),descent=int(descriptor['/Descent']))
fb.setupNameTable({
 'familyName':'Sharp Serif Text PDF Preview',
 'styleName':'Regular',
 'uniqueFontIdentifier':'Endorphins-PDF-preview-SharpSerifText-Regular-1',
 'fullName':'Sharp Serif Text PDF Preview Regular',
 'psName':'SharpSerifTextPDFPreview-Regular',
 'version':'Version 0.001; reconstructed PDF subset',
 'manufacturer':'Original outlines: Sharp Type. PDF preview reconstruction for Endorphins.',
 'description':'Recovered from the user-provided Sharp Serif Text specimen. Partial Unicode reconstruction, original advance widths. No original kerning or OpenType layout tables. Not an official font distribution.',
 'designer':'Connor Davenport, My-Lan Thuong, Lena Le Pommelet; type director Lucas Sharp',
 'licenseDescription':'The source specimen identifies Sharp Type as the licensor. This reconstruction grants no additional rights. Use the original licensed font package for release.',
 'licenseInfoURL':'https://www.sharptype.co/licensing',
})
fb.setupOS2(sTypoAscender=int(descriptor['/Ascent']),sTypoDescender=int(descriptor['/Descent']),sTypoLineGap=0,usWinAscent=1031,usWinDescent=295,sxHeight=443,sCapHeight=658,usWeightClass=400,fsType=0)
fb.setupPost(italicAngle=0)
fb.setupMaxp()
top.FullName='Sharp Serif Text PDF Preview Regular'
top.FamilyName='Sharp Serif Text PDF Preview'
cff.fontNames=['SharpSerifTextPDFPreview-Regular']
cff.otFont=fb.font
cff_table=newTable('CFF ');cff_table.cff=cff
fb.font['CFF ']=cff_table
fb.font.sfntVersion='OTTO'
fb.font.save(out/'SharpSerifTextPDFPreview-Regular.otf')
font=TTFont(out/'SharpSerifTextPDFPreview-Regular.otf')
font.flavor='woff2';font.save(out/'SharpSerifTextPDFPreview-Regular.woff2')
required='Make your next move.Your time. Your pace.Make this one count.Bodyweight squatReady when you are.The athletic studio.Less thinking.More doing.Any day can be a good day to move.Good to see you.Your next chapter.Make room for you.0123456789'
missing=sorted(set(required)-set(map(chr,cmap)))
report={'source':str(source_path.resolve()),'font':'Sharp Serif Text PDF Preview','style':'Regular','glyph_count':len(glyph_order),'unicode_mappings':len(cmap),'ascii_missing':[chr(n) for n in range(32,127) if n not in cmap],'missing_headline_characters':missing,'tables':list(TTFont(out/'SharpSerifTextPDFPreview-Regular.otf').keys()),'limits':['Original kerning and OpenType layout tables are absent from the PDF.','PDF subset is not a complete original font package.','Alternate glyphs are preserved but not accessible through original OpenType features.']}
(out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
assert not missing
# Missing glyphs are reported rather than synthesized.
