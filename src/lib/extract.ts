/**
 * Client-side text extraction for receipt import. Everything runs in the
 * browser — the receipt never leaves the user's device. Libraries are
 * dynamically imported so the rest of the app pays nothing for them, and
 * all worker/wasm/language assets are self-hosted under /public (no CDN).
 */

/** OCR a screenshot/photo of a receipt. Progress is 0..1. */
export async function extractTextFromImage(
  file: File | Blob,
  onProgress?: (fraction: number) => void
): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr/core",
    langPath: "/ocr/lang",
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) onProgress(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text ?? "";
  } finally {
    await worker.terminate();
  }
}

/**
 * Extract embedded text from a PDF receipt (online-order PDFs have a text
 * layer). Returns "" for scanned/image-only PDFs — caller should suggest
 * the screenshot route instead.
 */
export async function extractTextFromPdf(file: File | Blob): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const doc = await loadingTask.promise;
  const pageTexts: string[] = [];
  const pages = Math.min(doc.numPages, 20);
  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // Rebuild lines by grouping items on the same vertical position.
    const rows = new Map<number, { x: number; str: string }[]>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      // merge rows within 2px
      let key = y;
      for (const existing of rows.keys()) {
        if (Math.abs(existing - y) <= 2) {
          key = existing;
          break;
        }
      }
      const row = rows.get(key) ?? [];
      row.push({ x, str: item.str });
      rows.set(key, row);
    }
    const lines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0]) // PDF y-axis: top has larger y
      .map(([, parts]) =>
        parts
          .sort((a, b) => a.x - b.x)
          .map((p) => p.str)
          .join(" ")
      );
    pageTexts.push(lines.join("\n"));
  }
  await loadingTask.destroy();
  return pageTexts.join("\n").trim();
}
