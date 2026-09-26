/*
 * PDF-заглушка презентации для кнопки «Скачать презентацию» в главе «День» (CLAUDE.md, раздел 2).
 * TODO(client-data): настоящая презентация заказчика (на трёх языках) заменит этот файл.
 * Запуск: node scripts/generate-pdf-stub.mjs → public/assets/docs/uly-dala-presentation.pdf
 * Одна страница A4 (альбомная), фон indigo, текст kumys, шрифт Helvetica (латиница —
 * встроенный шрифт PDF без файлов; кириллица требует встраивания шрифта — это в настоящем файле).
 */
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = new URL("../public/assets/docs/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const content = [
  "0.11 0.133 0.188 rg 0 0 842 595 re f", // --indigo
  "0.969 0.957 0.933 rg", // --kumys
  "BT /F1 44 Tf 72 380 Td (ULY DALA) Tj ET",
  "BT /F1 16 Tf 72 340 Td (Full-cycle event agency, Almaty) Tj ET",
  "0.878 0.376 0.165 rg 72 318 48 2 re f", // --ember, тонкая линия
  "0.969 0.957 0.933 rg",
  "BT /F1 12 Tf 72 290 Td (Presentation placeholder. The client presentation will replace this file.) Tj ET",
].join("\n");

const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
  `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  "<< /Title (ULY DALA - presentation placeholder) /Producer (uly-dala-site) >>",
];

let pdf = "%PDF-1.4\n";
const offsets = [];
objects.forEach((body, i) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

writeFileSync(new URL("uly-dala-presentation.pdf", OUT), pdf);
console.log(`public/assets/docs/uly-dala-presentation.pdf  ${Buffer.byteLength(pdf)} Б`);
