# Sharp Serif Text PDF recovery

This is a preview reconstruction from the user-supplied `2024-SharpSerifText-Specimen.pdf`. It is not the original Sharp Type font package.

## Recovered

- Regular 400: 1,385 original CFF glyph outlines and advance widths, all compared against the PDF embedding.
- 919 Unicode character mappings reconstructed from glyph names. The alphabet, numerals, punctuation needed by the app, and every current headline are covered.
- Desktop OTF and compressed WOFF2, named **Sharp Serif Text PDF Preview** to distinguish the reconstruction.
- The WOFF2 is loaded in the local frontend. Inter remains the UI font. Text stays selectable and accessible.

## Missing

- Original kerning, GPOS/GSUB layout tables, contextual substitutions, and complete language behavior.
- Automatic access to alternate glyphs, small caps, and other OpenType features.
- The ASCII grave accent/backtick is not present. Other styles were inspected but not reconstructed; the interface uses only Regular for serif text.

This recovery grants no additional usage rights. The source specimen points to Sharp Type's licensing terms. Use the original licensed font package for public release.

## Paper and video

macOS recognizes the recovered OTF, installed in the current user's Fonts directory. Paper still reported it unavailable, so its ten display headings use original vector outlines. Body text remains editable Inter. `headings.json` preserves the headline text, dimensions, tracking, and SVG paths. Replace outlined headings with editable text once Paper can load the intended font.

The refreshed video is `../video/endorphins-sharp-serif-inter-walkthrough.mp4`. It is a Paper design preview, not a live-app recording.

## Reproduction

`recover.py` targets the structure of this specific PDF. Run it with Python plus `pypdf`, `fonttools`, and `brotli`, passing the PDF path as the first argument. `report.json` records the input hash, coverage, and validation of the delivered files.
