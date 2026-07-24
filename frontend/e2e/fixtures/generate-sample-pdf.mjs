// Generates a minimal, valid, plain-ASCII single-page PDF fixture used by the
// Playwright E2E suite. Kept as a script (rather than a hand-crafted binary)
// so the fixture can be regenerated/audited without needing a PDF-authoring
// tool or an extra runtime dependency. Run with: node generate-sample-pdf.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const bodyText =
  "LedgerLock Test Financial Report. Total revenue for fiscal year 2024 was " +
  "42 million dollars, up from 35 million dollars in fiscal year 2023. Net " +
  "income for fiscal year 2024 was 8 million dollars. The company employed " +
  "150 people as of December 2024.";

// Wrap the content stream text across a few Tj lines so it renders within
// the page width instead of running off the edge.
const words = bodyText.split(" ");
const lines = [];
let current = "";
for (const word of words) {
  const candidate = current ? `${current} ${word}` : word;
  if (candidate.length > 70) {
    lines.push(current);
    current = word;
  } else {
    current = candidate;
  }
}
if (current) lines.push(current);

const escape = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const textOps = lines
  .map((line, i) => (i === 0 ? `(${escape(line)}) Tj` : `0 -16 Td (${escape(line)}) Tj`))
  .join("\n");

const contentStream = `BT\n/F1 12 Tf\n72 720 Td\n${textOps}\nET`;

const objects = [];
objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
objects[2] = `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`;
objects[3] = `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>`;
objects[4] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
objects[5] = `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`;

let pdf = "%PDF-1.4\n";
const offsets = [0];
for (let i = 1; i <= 5; i++) {
  offsets[i] = pdf.length;
  pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
}

const xrefOffset = pdf.length;
let xref = `xref\n0 6\n0000000000 65535 f \n`;
for (let i = 1; i <= 5; i++) {
  xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
}
pdf += xref;
pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

const outPath = join(__dirname, "sample-financial-report.pdf");
writeFileSync(outPath, pdf, "latin1");
console.log(`Wrote ${outPath} (${pdf.length} bytes)`);
