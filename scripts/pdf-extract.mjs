// Standalone script, deliberately kept outside `src/` so Next.js/Turbopack
// never bundles it. It's invoked as a child process (see route.ts) because
// pdfjs-dist's worker-loading logic (used both directly and internally by
// pdf-to-img) cannot run correctly inside Turbopack's bundled server chunks -
// Turbopack rewrites the dynamic import() it uses to load its worker module
// to a path that doesn't exist. Running as a plain, unbundled Node process
// sidesteps that entirely.
import fs from 'fs/promises';
import path from 'path';

async function extractText(buffer) {
  try {
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
    const data = await pdfParse(buffer);
    if (data.text && data.text.trim()) return data.text;
  } catch (e) {
    console.error('[pdf-extract] pdf-parse failed:', e?.message || e);
  }
  return '';
}

async function renderPagesToImages(buffer, outDir, maxPages = 2) {
  const { pdf } = await import('pdf-to-img');
  const doc = await pdf(buffer, { scale: 2 });
  const files = [];
  let i = 0;
  for await (const image of doc) {
    const file = path.join(outDir, `page-${i}.png`);
    await fs.writeFile(file, image);
    files.push(file);
    i++;
    if (i >= maxPages) break;
  }
  return files;
}

// Libraries in the pdf.js chain (pdf-parse's bundled pdfjs, pdf-to-img) write
// font/rendering warnings directly to stdout via console.log/warn. Since
// stdout is also our IPC channel back to route.ts, those warnings corrupt the
// JSON payload and make JSON.parse throw - which surfaced to users as a
// generic "Could not read this PDF" even for perfectly valid PDFs. Writing
// the result to a file instead of stdout sidesteps this entirely.
async function main() {
  const [, , pdfPath, outDir] = process.argv;
  const resultPath = path.join(outDir, 'result.json');
  const buffer = await fs.readFile(pdfPath);

  const text = await extractText(buffer);
  if (text.trim()) {
    await fs.writeFile(resultPath, JSON.stringify({ ok: true, text }));
    return;
  }

  const images = await renderPagesToImages(buffer, outDir);
  await fs.writeFile(resultPath, JSON.stringify({ ok: true, text: '', images }));
}

main().catch(async e => {
  const [, , , outDir] = process.argv;
  const resultPath = path.join(outDir, 'result.json');
  await fs.writeFile(resultPath, JSON.stringify({ ok: false, error: e?.message || String(e) })).catch(() => {});
  process.exit(1);
});
