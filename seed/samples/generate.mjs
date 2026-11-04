// Generates the fictional court orders used for demos and tests (blueprint §9).
// Run: npm run generate-samples -w @casepilot/seed
import { writeFileSync } from 'node:fs';
import { strToU8, zipSync } from 'fflate';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const STAMP = 'FICTIONAL SAMPLE - NOT A REAL COURT ORDER';
const DISCLAIMER =
  'This synthetic text is solely for testing document extraction and workflow generation. ' +
  'It does not describe an actual proceeding or establish real legal deadlines.';

const ORDER = {
  court: 'Demo Civil Court, Delhi',
  title: 'ABC Traders v. XYZ Supplies',
  date: 'Order dated 2 November 2026',
  directions: [
    '1. The plaintiff shall file its updated statement of account within 14 days from the date of this order.',
    '2. The defendant may file a response within 14 days after service of the updated statement of account.',
    '3. The matter is listed for the next hearing on 15 December 2026.',
    '4. Both parties shall ensure that their authorized representatives are available on the next date.',
  ],
};

const out = (name) => new URL(name, import.meta.url);
// Fixed dates keep the files byte-identical between runs, so their SHA-256 (used to look up
// recorded analyses) only changes when the content does.
const FIXED_DATE = new Date('2026-11-02T00:00:00Z');

function wrap(text, font, size, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function orderPdf() {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${ORDER.title} - ${STAMP}`);
  pdf.setSubject(STAMP);
  pdf.setCreationDate(FIXED_DATE);
  pdf.setModificationDate(FIXED_DATE);
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const page = pdf.addPage([595, 842]); // A4
  const left = 64;
  const width = 595 - left * 2;
  let y = 790;
  const draw = (text, font = regular, size = 12, color = rgb(0, 0, 0)) => {
    for (const line of wrap(text, font, size, width)) {
      page.drawText(line, { x: left, y, size, font, color });
      y -= size * 1.5;
    }
  };
  draw(STAMP, bold, 11, rgb(0.75, 0.1, 0.1));
  y -= 12;
  draw(ORDER.court, bold, 14);
  draw(ORDER.title, bold, 13);
  draw(ORDER.date, regular, 12);
  y -= 12;
  for (const direction of ORDER.directions) {
    draw(direction);
    y -= 6;
  }
  y -= 18;
  draw(DISCLAIMER, regular, 10, rgb(0.35, 0.35, 0.35));
  return pdf.save();
}

async function blankPdf() {
  const pdf = await PDFDocument.create();
  pdf.setSubject(STAMP);
  pdf.setCreationDate(FIXED_DATE);
  pdf.setModificationDate(FIXED_DATE);
  pdf.addPage([595, 842]);
  return pdf.save();
}

function orderDocx() {
  const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const paragraph = (text, bold = false) =>
    `<w:p><w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${escape(text)}</w:t></w:r></w:p>`;
  const body = [
    paragraph(STAMP, true),
    paragraph(ORDER.court, true),
    paragraph(ORDER.title, true),
    paragraph(ORDER.date),
    ...ORDER.directions.map((d) => paragraph(d)),
    paragraph(DISCLAIMER),
  ].join('');
  // fflate stamps each entry with this time unless told otherwise.
  const mtime = FIXED_DATE;
  return zipSync(
    {
      '[Content_Types].xml': strToU8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
          '</Types>',
      ),
      '_rels/.rels': strToU8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
          '</Relationships>',
      ),
      'word/document.xml': strToU8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
          `<w:body>${body}</w:body></w:document>`,
      ),
    },
    { mtime },
  );
}

writeFileSync(out('sample-order.pdf'), await orderPdf());
writeFileSync(out('sample-order.docx'), orderDocx());
writeFileSync(out('blank-page.pdf'), await blankPdf());
console.log('Wrote sample-order.pdf, sample-order.docx and blank-page.pdf');
