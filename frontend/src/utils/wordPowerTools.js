import JSZip from 'jszip';
import mammoth from 'mammoth';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function getMimeFromExtension(name = '') {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.tif') || lower.endsWith('.tiff')) return 'image/tiff';
  if (lower.endsWith('.emf')) return 'image/emf';
  if (lower.endsWith('.wmf')) return 'image/wmf';
  return 'application/octet-stream';
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function readWordSourceArrayBuffer(source) {
  if (!source) throw new Error('No DOCX source provided');

  if (source instanceof ArrayBuffer) {
    return source;
  }

  if (source instanceof Uint8Array) {
    return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  }

  if (typeof Blob !== 'undefined' && source instanceof Blob) {
    return source.arrayBuffer();
  }

  if (typeof source === 'string') {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch DOCX source: HTTP ${response.status}`);
    }
    return response.arrayBuffer();
  }

  throw new Error('Unsupported DOCX input source');
}

function parseXml(xml) {
  const parser = new DOMParser();
  return parser.parseFromString(xml, 'application/xml');
}

function getWordTextFromXml(xml) {
  if (!xml) return '';
  try {
    const doc = parseXml(xml);
    const textNodes = Array.from(doc.getElementsByTagNameNS(WORD_NS, 't'));
    return textNodes.map((node) => node.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

function getTableDataFromXml(xml) {
  if (!xml) return [];
  try {
    const doc = parseXml(xml);
    const tableNodes = Array.from(doc.getElementsByTagNameNS(WORD_NS, 'tbl'));

    return tableNodes.map((tableNode, index) => {
      const rowNodes = Array.from(tableNode.getElementsByTagNameNS(WORD_NS, 'tr'));
      const rows = rowNodes.map((rowNode) => {
        const cellNodes = Array.from(rowNode.getElementsByTagNameNS(WORD_NS, 'tc'));
        return cellNodes.map((cellNode) => {
          const textNodes = Array.from(cellNode.getElementsByTagNameNS(WORD_NS, 't'));
          return textNodes.map((textNode) => textNode.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
        });
      });

      const rowCount = rows.length;
      const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);

      return {
        id: `table_${index + 1}`,
        index,
        rowCount,
        columnCount,
        rows,
      };
    });
  } catch {
    return [];
  }
}

function estimatePageCount(wordCount, pageBreakCount) {
  const byWords = Math.max(1, Math.ceil((wordCount || 0) / 450));
  const byBreaks = Math.max(1, (pageBreakCount || 0) + 1);
  return Math.max(byWords, byBreaks);
}

export async function analyzeWordDocument(source) {
  const arrayBuffer = await readWordSourceArrayBuffer(source);
  const zip = await JSZip.loadAsync(arrayBuffer);
  const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
  const textResult = await mammoth.extractRawText({ arrayBuffer });

  const html = htmlResult.value || '';
  const rawText = (textResult.value || '').trim();
  const wordCount = rawText ? rawText.split(/\s+/).filter(Boolean).length : 0;
  const characterCount = rawText.length;

  const documentXml = await zip.file('word/document.xml')?.async('string');
  const pageBreakCount = documentXml
    ? (documentXml.match(/<w:br[^>]*w:type=\"page\"/g) || []).length + (documentXml.match(/<w:lastRenderedPageBreak\b/g) || []).length
    : 0;
  const sectionBreakCount = documentXml ? (documentXml.match(/<w:sectPr\b/g) || []).length : 0;

  const tables = getTableDataFromXml(documentXml || '');

  const parser = new DOMParser();
  const htmlDoc = parser.parseFromString(html || '<div></div>', 'text/html');
  const headingNodes = Array.from(htmlDoc.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  const outline = headingNodes.map((node, index) => ({
    id: `heading_${index + 1}`,
    level: Number(node.tagName.slice(1)),
    text: (node.textContent || '').trim(),
  })).filter((h) => h.text);

  const headerEntries = [];
  const footerEntries = [];
  const mediaEntries = [];
  const embeddedObjects = [];

  const files = Object.keys(zip.files);
  for (const filePath of files) {
    const zipFile = zip.file(filePath);
    if (!zipFile || zipFile.dir) continue;

    if (/^word\/header\d+\.xml$/i.test(filePath)) {
      const xml = await zipFile.async('string');
      headerEntries.push({ name: filePath.split('/').pop(), text: getWordTextFromXml(xml) });
      continue;
    }

    if (/^word\/footer\d+\.xml$/i.test(filePath)) {
      const xml = await zipFile.async('string');
      footerEntries.push({ name: filePath.split('/').pop(), text: getWordTextFromXml(xml) });
      continue;
    }

    if (/^word\/media\//i.test(filePath)) {
      const base64 = await zipFile.async('base64');
      mediaEntries.push({
        name: filePath.split('/').pop() || filePath,
        path: filePath,
        mimeType: getMimeFromExtension(filePath),
        dataUrl: `data:${getMimeFromExtension(filePath)};base64,${base64}`,
      });
      continue;
    }

    if (/^word\/embeddings\//i.test(filePath)) {
      embeddedObjects.push({
        name: filePath.split('/').pop() || filePath,
        path: filePath,
      });
    }
  }

  const pageCount = estimatePageCount(wordCount, pageBreakCount);

  return {
    arrayBuffer,
    html,
    rawText,
    metrics: {
      wordCount,
      characterCount,
      pageCount,
      pageBreakCount,
      sectionBreakCount,
    },
    structure: {
      outline,
      tables,
      headerEntries,
      footerEntries,
      embeddedObjects,
    },
    media: mediaEntries,
  };
}

export function detectHeadingsFromHtml(html = '') {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || '<div></div>', 'text/html');
  const detected = [];

  const paragraphs = Array.from(doc.querySelectorAll('p'));
  paragraphs.forEach((paragraph) => {
    const text = (paragraph.textContent || '').trim();
    if (!text) return;

    if (/^[0-9]+\./.test(text) || text === text.toUpperCase() || text.length <= 60) {
      paragraph.outerHTML = `<h2>${escapeHtml(text)}</h2>`;
      detected.push(text);
    }
  });

  return {
    html: doc.body.innerHTML,
    detected,
  };
}

export function generateTocHtml(outline = []) {
  if (!outline.length) {
    return '<div data-sdms-toc="true"><h1>Table of Contents</h1><p>No headings found.</p></div>';
  }

  const items = outline
    .map((entry) => `<li style="margin-left:${Math.max(0, entry.level - 1) * 20}px">${escapeHtml(entry.text)}</li>`)
    .join('');

  return `<div data-sdms-toc="true"><h1>Table of Contents</h1><ul>${items}</ul></div>`;
}

export function applyOrRefreshToc(html = '', outline = []) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || '<div></div>', 'text/html');
  const tocHtml = generateTocHtml(outline);
  const nextDoc = parser.parseFromString(tocHtml, 'text/html');
  const nextTocNode = nextDoc.body.firstElementChild;
  if (!nextTocNode) return html;

  const existing = doc.querySelector('[data-sdms-toc="true"]');
  if (existing) {
    existing.replaceWith(nextTocNode);
  } else {
    doc.body.insertBefore(nextTocNode, doc.body.firstChild);
  }

  return doc.body.innerHTML;
}

export function convertTableToCsv(table) {
  const rows = table?.rows || [];
  return rows
    .map((row) => row
      .map((cell) => {
        const value = String(cell || '');
        return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
      })
      .join(','))
    .join('\n');
}

export function computeSimpleLineDiff(leftText = '', rightText = '') {
  const leftLines = String(leftText || '').split(/\r?\n/);
  const rightLines = String(rightText || '').split(/\r?\n/);
  const length = Math.max(leftLines.length, rightLines.length);

  const lines = [];
  for (let i = 0; i < length; i += 1) {
    const left = leftLines[i] ?? '';
    const right = rightLines[i] ?? '';

    if (left === right) {
      lines.push({ type: 'unchanged', line: i + 1, left, right });
    } else if (!left && right) {
      lines.push({ type: 'added', line: i + 1, left, right });
    } else if (left && !right) {
      lines.push({ type: 'removed', line: i + 1, left, right });
    } else {
      lines.push({ type: 'modified', line: i + 1, left, right });
    }
  }

  const summary = {
    added: lines.filter((line) => line.type === 'added').length,
    removed: lines.filter((line) => line.type === 'removed').length,
    modified: lines.filter((line) => line.type === 'modified').length,
  };

  return { lines, summary };
}

export function buildDiffHighlightHtml(diff) {
  const rows = (diff?.lines || []).map((line) => {
    if (line.type === 'unchanged') {
      return `<div class="sdms-diff-row"><span>${escapeHtml(line.left)}</span></div>`;
    }
    if (line.type === 'added') {
      return `<div class="sdms-diff-row sdms-diff-added"><span>+ ${escapeHtml(line.right)}</span></div>`;
    }
    if (line.type === 'removed') {
      return `<div class="sdms-diff-row sdms-diff-removed"><span>- ${escapeHtml(line.left)}</span></div>`;
    }
    return `<div class="sdms-diff-row sdms-diff-modified"><span>- ${escapeHtml(line.left)}</span><span>+ ${escapeHtml(line.right)}</span></div>`;
  });

  return `<div data-sdms-diff="true">${rows.join('')}</div>`;
}
