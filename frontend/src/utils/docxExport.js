import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';

const HEADING_MAP = {
  H1: HeadingLevel.HEADING_1,
  H2: HeadingLevel.HEADING_2,
  H3: HeadingLevel.HEADING_3,
  H4: HeadingLevel.HEADING_4,
  H5: HeadingLevel.HEADING_5,
  H6: HeadingLevel.HEADING_6,
};

const normalizeText = (value) => (value || '').replace(/\u00a0/g, ' ');

const toHexColor = (value) => {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.slice(1).toUpperCase();
  }

  const rgbMatch = trimmed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return [r, g, b]
      .map((channel) => Number(channel).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }

  return undefined;
};

const mergeStyle = (parentStyle, node) => {
  const next = { ...parentStyle };

  if (!node || node.nodeType !== Node.ELEMENT_NODE) {
    return next;
  }

  const tag = node.tagName?.toUpperCase();
  const nodeStyle = node.style;

  if (tag === 'B' || tag === 'STRONG') next.bold = true;
  if (tag === 'I' || tag === 'EM') next.italics = true;
  if (tag === 'U') next.underline = true;
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') next.strike = true;

  if (nodeStyle?.fontWeight && Number(nodeStyle.fontWeight) >= 600) next.bold = true;
  if (nodeStyle?.fontStyle === 'italic') next.italics = true;
  if (nodeStyle?.textDecoration?.includes('underline')) next.underline = true;
  if (nodeStyle?.textDecoration?.includes('line-through')) next.strike = true;

  const color = toHexColor(nodeStyle?.color);
  if (color) next.color = color;

  return next;
};

const inlineRunsFromNode = (node, style = {}) => {
  if (!node) return [];

  if (node.nodeType === Node.TEXT_NODE) {
    const text = normalizeText(node.textContent);
    if (!text) return [];
    return [
      new TextRun({
        text,
        bold: style.bold,
        italics: style.italics,
        underline: style.underline ? {} : undefined,
        strike: style.strike,
        color: style.color,
      }),
    ];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return [];
  }

  if (node.tagName?.toUpperCase() === 'BR') {
    return [new TextRun({ text: '', break: 1 })];
  }

  const nextStyle = mergeStyle(style, node);
  const children = Array.from(node.childNodes || []);
  const runs = children.flatMap((child) => inlineRunsFromNode(child, nextStyle));

  if (!runs.length) {
    const text = normalizeText(node.textContent);
    if (!text) return [];
    return [
      new TextRun({
        text,
        bold: nextStyle.bold,
        italics: nextStyle.italics,
        underline: nextStyle.underline ? {} : undefined,
        strike: nextStyle.strike,
        color: nextStyle.color,
      }),
    ];
  }

  return runs;
};

const getParagraphAlignment = (element) => {
  const align = element?.style?.textAlign;
  if (align === 'center') return AlignmentType.CENTER;
  if (align === 'right') return AlignmentType.RIGHT;
  if (align === 'justify') return AlignmentType.JUSTIFIED;
  return undefined;
};

const paragraphFromElement = (element) => {
  const tag = element.tagName?.toUpperCase();
  if (!tag) return null;

  const text = normalizeText(element.textContent || '').trim();
  if (!text) return null;

  let prefix = '';
  if (tag === 'LI') {
    const inOrderedList = element.parentElement?.tagName?.toUpperCase() === 'OL';
    if (inOrderedList) {
      const siblings = Array.from(element.parentElement?.children || []);
      const position = Math.max(0, siblings.indexOf(element)) + 1;
      prefix = `${position}. `;
    } else {
      prefix = '• ';
    }
  }

  const baseRuns = inlineRunsFromNode(element, {});
  const children = prefix ? [new TextRun(prefix), ...baseRuns] : baseRuns;

  if (!children.length) {
    children.push(new TextRun(text));
  }

  return new Paragraph({
    heading: HEADING_MAP[tag],
    alignment: getParagraphAlignment(element),
    spacing: { after: 160 },
    children,
  });
};

export const exportHtmlAsDocxBlob = async (html) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || '', 'text/html');
  const body = doc.body;

  if ((html || '').length > 35000) {
    const textLines = (body.innerText || '')
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    const fastParagraphs = textLines.length
      ? textLines.map((line) => new Paragraph({ spacing: { after: 140 }, children: [new TextRun(line)] }))
      : [new Paragraph({ children: [new TextRun(' ')] })];

    const fastFile = new Document({ sections: [{ children: fastParagraphs }] });
    return Packer.toBlob(fastFile);
  }

  const blockSelectors = 'h1,h2,h3,h4,h5,h6,p,div,li,blockquote,pre';
  const allBlockElements = Array.from(body.querySelectorAll(blockSelectors));
  const blockElements = allBlockElements.filter((element) => {
    const parentBlock = element.parentElement?.closest(blockSelectors);
    return !parentBlock;
  });

  const paragraphs = blockElements
    .map((element) => paragraphFromElement(element))
    .filter(Boolean);

  if (!paragraphs.length) {
    const fallback = normalizeText(body.textContent || '').trim() || ' ';
    paragraphs.push(new Paragraph({ children: [new TextRun(fallback)] }));
  }

  const file = new Document({
    sections: [{ children: paragraphs }],
  });

  return Packer.toBlob(file);
};
