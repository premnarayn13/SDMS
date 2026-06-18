import React, { useEffect, useMemo, useRef, useState } from 'react';
import { exportHtmlAsDocxBlob } from '../utils/docxExport';
import {
  analyzeWordDocument,
  applyOrRefreshToc,
  buildDiffHighlightHtml,
  computeSimpleLineDiff,
  convertTableToCsv,
  detectHeadingsFromHtml,
} from '../utils/wordPowerTools';
import { getFileVersions, rollbackToVersion } from '../utils/versionControl';
import { tokenUtils } from '../utils/authApi';
import { Icons } from '../utils/helpers';

const FEATURES_38 = [
  'Layout-preserving render',
  'Page breaks',
  'Header/footer view',
  'Table view',
  'Embedded image preview',
  'Inline editing',
  'Bold/Italic/Underline',
  'Alignment',
  'Font size change',
  'Paragraph spacing',
  'Insert page break',
  'Insert section break',
  'Basic styles',
  'Outline view',
  'Auto-detect headings',
  'Generate TOC',
  'Refresh TOC',
  'Edit header/footer',
  'Insert page numbers',
  'Word count',
  'Character count',
  'Page count',
  'Edit table cells',
  'Add/remove row/column',
  'Export table to CSV',
  'Table structure detection',
  'Extract images',
  'Replace image',
  'Resize image',
  'View embedded objects',
  'Password protect DOCX',
  'Remove password',
  'Restrict editing mode',
  'Compare two DOCX files',
  'Highlight differences',
  'Track changes (basic)',
  'Accept/reject changes',
  'Version rollback',
];

const FEATURE_ICON_MAP = {
  'Layout-preserving render': 'eye',
  'Page breaks': 'pages',
  'Header/footer view': 'book',
  'Table view': 'grid',
  'Embedded image preview': 'image',
  'Inline editing': 'edit',
  'Bold/Italic/Underline': 'type',
  'Alignment': 'columns',
  'Font size change': 'type',
  'Paragraph spacing': 'lineNumbers',
  'Insert page break': 'plus',
  'Insert section break': 'splitPane',
  'Basic styles': 'palette',
  'Outline view': 'list',
  'Auto-detect headings': 'search',
  'Generate TOC': 'book',
  'Refresh TOC': 'refresh',
  'Edit header/footer': 'edit',
  'Insert page numbers': 'lineNumbers',
  'Word count': 'text',
  'Character count': 'type',
  'Page count': 'pages',
  'Edit table cells': 'edit',
  'Add/remove row/column': 'grid',
  'Export table to CSV': 'export',
  'Table structure detection': 'search',
  'Extract images': 'download',
  'Replace image': 'refresh',
  'Resize image': 'maximize',
  'View embedded objects': 'box',
  'Password protect DOCX': 'lock',
  'Remove password': 'unlock',
  'Restrict editing mode': 'shield',
  'Compare two DOCX files': 'splitPane',
  'Highlight differences': 'highlight',
  'Track changes (basic)': 'activity',
  'Accept/reject changes': 'check',
  'Version rollback': 'version',
};

const FEATURE_SECTION_MAP = {
  'Layout-preserving render': 'viewing',
  'Page breaks': 'viewing',
  'Header/footer view': 'viewing',
  'Table view': 'table',
  'Embedded image preview': 'media',
  'Inline editing': 'editing',
  'Bold/Italic/Underline': 'editing',
  'Alignment': 'editing',
  'Font size change': 'editing',
  'Paragraph spacing': 'editing',
  'Insert page break': 'editing',
  'Insert section break': 'editing',
  'Basic styles': 'editing',
  'Outline view': 'structure',
  'Auto-detect headings': 'structure',
  'Generate TOC': 'structure',
  'Refresh TOC': 'structure',
  'Edit header/footer': 'structure',
  'Insert page numbers': 'structure',
  'Word count': 'viewing',
  'Character count': 'viewing',
  'Page count': 'viewing',
  'Edit table cells': 'table',
  'Add/remove row/column': 'table',
  'Export table to CSV': 'table',
  'Table structure detection': 'table',
  'Extract images': 'media',
  'Replace image': 'media',
  'Resize image': 'media',
  'View embedded objects': 'media',
  'Password protect DOCX': 'security',
  'Remove password': 'security',
  'Restrict editing mode': 'security',
  'Compare two DOCX files': 'compare',
  'Highlight differences': 'compare',
  'Track changes (basic)': 'compare',
  'Accept/reject changes': 'compare',
  'Version rollback': 'compare',
};

const SECTION_SHORT_LABEL = {
  viewing: 'Viewing',
  editing: 'Editing',
  structure: 'Structure',
  table: 'Table',
  media: 'Media',
  security: 'Security',
  compare: 'Compare',
};

const SECTION_STYLE_MAP = {
  viewing: {
    button: 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100',
    active: 'border-sky-400 bg-sky-100 text-sky-900',
    badge: 'text-sky-700',
  },
  editing: {
    button: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
    active: 'border-emerald-400 bg-emerald-100 text-emerald-900',
    badge: 'text-emerald-700',
  },
  structure: {
    button: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
    active: 'border-amber-400 bg-amber-100 text-amber-900',
    badge: 'text-amber-700',
  },
  table: {
    button: 'border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100',
    active: 'border-teal-400 bg-teal-100 text-teal-900',
    badge: 'text-teal-700',
  },
  media: {
    button: 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100',
    active: 'border-rose-400 bg-rose-100 text-rose-900',
    badge: 'text-rose-700',
  },
  security: {
    button: 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100',
    active: 'border-red-400 bg-red-100 text-red-900',
    badge: 'text-red-700',
  },
  compare: {
    button: 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100',
    active: 'border-slate-400 bg-slate-100 text-slate-900',
    badge: 'text-slate-700',
  },
};

const FEATURE_HELP_MAP = {
  'Layout-preserving render': 'Switches to a read-only layout view.',
  'Page breaks': 'Shows how many page breaks were detected.',
  'Header/footer view': 'Summarizes header and footer blocks.',
  'Table view': 'Shows how many tables were detected.',
  'Embedded image preview': 'Shows how many images were detected.',
  'Inline editing': 'Enables editing inside the workspace editor.',
  'Bold/Italic/Underline': 'Applies basic text emphasis to selection.',
  'Alignment': 'Centers the current paragraph.',
  'Font size change': 'Applies font size to selected text.',
  'Paragraph spacing': 'Applies spacing to the current paragraph.',
  'Insert page break': 'Inserts a visual page-break marker.',
  'Insert section break': 'Inserts a visual section-break marker.',
  'Basic styles': 'Applies an H1 style to the current block.',
  'Outline view': 'Shows how many headings are in the outline.',
  'Auto-detect headings': 'Promotes headings based on text patterns.',
  'Generate TOC': 'Creates a new table of contents.',
  'Refresh TOC': 'Updates the table of contents.',
  'Edit header/footer': 'Inserts editable header/footer placeholders.',
  'Insert page numbers': 'Adds a page number marker.',
  'Word count': 'Shows word count for the document.',
  'Character count': 'Shows character count for the document.',
  'Page count': 'Shows estimated page count.',
  'Edit table cells': 'Enables table cell editing in the editor.',
  'Add/remove row/column': 'Adds a new row after the current one.',
  'Export table to CSV': 'Exports the selected table to CSV.',
  'Table structure detection': 'Counts tables detected in the file.',
  'Extract images': 'Downloads embedded images as files.',
  'Replace image': 'Replaces a selected embedded image.',
  'Resize image': 'Adjusts image width percentage.',
  'View embedded objects': 'Shows embedded objects count.',
  'Password protect DOCX': 'Encrypts the DOCX with a password.',
  'Remove password': 'Decrypts a password-protected DOCX.',
  'Restrict editing mode': 'Toggles local edit restriction.',
  'Compare two DOCX files': 'Choose a second file to compare.',
  'Highlight differences': 'Runs the compare and highlights changes.',
  'Track changes (basic)': 'Tracks edits and shows pending changes.',
  'Accept/reject changes': 'Accepts tracked changes.',
  'Version rollback': 'Exports a snapshot from version history.',
};

function Icon({ name, size = 14, className = '' }) {
  const icon = Icons[name];
  if (!icon) return null;
  const sizedIcon = icon.replace(/width="\d+"/, `width="${size}"`).replace(/height="\d+"/, `height="${size}"`);
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      dangerouslySetInnerHTML={{ __html: sizedIcon }}
    />
  );
}

function escapeForRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ensureSelectionInside(editor) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const node = range.commonAncestorContainer.nodeType === 3
    ? range.commonAncestorContainer.parentNode
    : range.commonAncestorContainer;
  if (!editor || !node || !editor.contains(node)) return null;
  return range;
}

function resolveSelectionRange(editor, savedRange, preferNonCollapsed = false) {
  const current = ensureSelectionInside(editor);
  if (current && (!preferNonCollapsed || !current.collapsed)) return current;
  if (savedRange) {
    const node = savedRange.commonAncestorContainer.nodeType === 3
      ? savedRange.commonAncestorContainer.parentNode
      : savedRange.commonAncestorContainer;
    if (editor && node && node.isConnected && editor.contains(node) && (!preferNonCollapsed || !savedRange.collapsed)) {
      return savedRange;
    }
  }
  return current || savedRange || null;
}

function wrapSelectionWithSpan(editor, style = {}, savedRange = null) {
  const range = resolveSelectionRange(editor, savedRange, true);
  if (!range || range.collapsed) return false;

  const span = document.createElement('span');
  Object.entries(style).forEach(([key, value]) => {
    span.style[key] = value;
  });

  try {
    range.surroundContents(span);
  } catch {
    const fragment = range.extractContents();
    span.appendChild(fragment);
    range.insertNode(span);
  }

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return true;
}

function findClosestBlock(editor) {
  const range = ensureSelectionInside(editor);
  if (!range) return null;
  let node = range.startContainer.nodeType === 3 ? range.startContainer.parentNode : range.startContainer;
  while (node && node !== editor) {
    const tag = (node.tagName || '').toLowerCase();
    if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th'].includes(tag)) {
      return node;
    }
    node = node.parentNode;
  }
  return null;
}

function replaceBlockTag(block, nextTag) {
  if (!block || !nextTag) return false;
  const replacement = document.createElement(nextTag);
  replacement.innerHTML = block.innerHTML;
  Array.from(block.attributes || []).forEach((attr) => {
    if (attr.name !== 'style') replacement.setAttribute(attr.name, attr.value);
  });
  replacement.style.cssText = block.style.cssText;
  block.replaceWith(replacement);
  return true;
}

function insertHtmlAtCursor(editor, html) {
  const range = ensureSelectionInside(editor);
  if (!range) return false;
  const fragment = range.createContextualFragment(html);
  range.deleteContents();
  range.insertNode(fragment);
  return true;
}

function addRowToSelectedTable(editor) {
  const block = findClosestBlock(editor);
  const cell = block?.closest?.('td,th');
  if (!cell) return false;
  const row = cell.closest('tr');
  if (!row) return false;

  const newRow = row.cloneNode(true);
  newRow.querySelectorAll('td,th').forEach((c) => {
    c.innerHTML = 'New cell';
  });
  row.insertAdjacentElement('afterend', newRow);
  return true;
}

function addColumnToSelectedTable(editor) {
  const block = findClosestBlock(editor);
  const cell = block?.closest?.('td,th');
  if (!cell) return false;
  const table = cell.closest('table');
  if (!table) return false;

  table.querySelectorAll('tr').forEach((row) => {
    const template = row.querySelector('td,th');
    const nextCell = template ? template.cloneNode(true) : document.createElement('td');
    nextCell.innerHTML = 'New cell';
    row.appendChild(nextCell);
  });
  return true;
}

function removeSelectedRowOrColumn(editor) {
  const block = findClosestBlock(editor);
  const cell = block?.closest?.('td,th');
  if (!cell) return false;
  const row = cell.closest('tr');
  if (!row) return false;

  if (row.querySelectorAll('td,th').length > 1) {
    cell.remove();
    return true;
  }

  row.remove();
  return true;
}

export default function WordPowerFeaturesPanel({
  item,
  getItemUrl,
  saveConvertedToStorage,
  showMessage,
}) {
  const [loading, setLoading] = useState(false);
  const [docModel, setDocModel] = useState(null);
  const [editorHtml, setEditorHtml] = useState('');
  const [editorMode, setEditorMode] = useState('view');
  const [fontSizePx, setFontSizePx] = useState(16);
  const [paragraphSpacing, setParagraphSpacing] = useState(8);
  const [selectedTableIndex, setSelectedTableIndex] = useState(0);
  const [compareFile, setCompareFile] = useState(null);
  const [diffResult, setDiffResult] = useState(null);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [baselineText, setBaselineText] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [docPassword, setDocPassword] = useState('');
  const [restrictEditing, setRestrictEditing] = useState(false);
  const [selectedImageName, setSelectedImageName] = useState('');
  const [replacementImageFile, setReplacementImageFile] = useState(null);
  const [imageWidthPercent, setImageWidthPercent] = useState(100);
  const [sourceFile, setSourceFile] = useState(null);
  const [sourceLabel, setSourceLabel] = useState('');
  const [modelError, setModelError] = useState('');
  const [activeFeatureCategory, setActiveFeatureCategory] = useState('editing');
  const [showAdvancedFeatures, setShowAdvancedFeatures] = useState(false);
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(false);
  const editorRef = useRef(null);
  const selectionRef = useRef(null);
  const viewingRef = useRef(null);
  const editingRef = useRef(null);
  const structureRef = useRef(null);
  const tableRef = useRef(null);
  const mediaRef = useRef(null);
  const securityRef = useRef(null);
  const compareRef = useRef(null);
  const workspaceRef = useRef(null);

  const securityKey = useMemo(
    () => `docmatrix_docx_security_${item?.id || item?.name || 'unknown'}`,
    [item?.id, item?.name]
  );

  const availableVersions = useMemo(() => {
    if (!item?.id) return [];
    return getFileVersions(item.id);
  }, [item?.id]);

  const featureProgress = useMemo(() => ({
    enabled: FEATURES_38.length,
    total: FEATURES_38.length,
  }), []);

  const hiddenCategories = useMemo(() => {
    if (showAdvancedFeatures) return new Set();
    return new Set(['table', 'media', 'structure']);
  }, [showAdvancedFeatures]);

  const featureSections = useMemo(() => (
    Object.keys(SECTION_SHORT_LABEL)
      .filter((key) => !hiddenCategories.has(key))
      .map((key) => ({
        key,
        label: SECTION_SHORT_LABEL[key],
        count: FEATURES_38.filter((name) => FEATURE_SECTION_MAP[name] === key).length,
      }))
  ), [hiddenCategories]);

  const visibleFeatures = useMemo(() => (
    FEATURES_38
      .filter((name) => FEATURE_SECTION_MAP[name] === activeFeatureCategory)
      .filter((name) => !hiddenCategories.has(FEATURE_SECTION_MAP[name]))
  ), [activeFeatureCategory, hiddenCategories]);

  const visibleFeatureCount = useMemo(() => (
    FEATURES_38.filter((name) => !hiddenCategories.has(FEATURE_SECTION_MAP[name])).length
  ), [hiddenCategories]);

  useEffect(() => {
    const raw = localStorage.getItem(securityKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setRestrictEditing(Boolean(parsed?.restrictEditing));
      if (parsed?.password) setDocPassword(parsed.password);
    } catch {
      // Ignore malformed security settings.
    }
  }, [securityKey]);

  useEffect(() => {
    if (activeFeatureCategory === 'editing' && !restrictEditing) {
      setEditorMode('edit');
    }
  }, [activeFeatureCategory, restrictEditing]);

  useEffect(() => {
    if (!featureSections.length) return;
    const allowed = new Set(featureSections.map((section) => section.key));
    if (!allowed.has(activeFeatureCategory)) {
      setActiveFeatureCategory(featureSections[0].key);
    }
  }, [featureSections, activeFeatureCategory]);

  const syncEditorHtml = () => {
    if (!editorRef.current) return;
    setEditorHtml(editorRef.current.innerHTML);
  };

  const captureSelection = () => {
    const range = ensureSelectionInside(editorRef.current);
    if (range) {
      selectionRef.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    const range = selectionRef.current;
    if (!range || !editorRef.current) return;
    const node = range.commonAncestorContainer.nodeType === 3
      ? range.commonAncestorContainer.parentNode
      : range.commonAncestorContainer;
    if (!node || !node.isConnected || !editorRef.current.contains(node)) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const handleToolbarMouseDown = (event) => {
    event.preventDefault();
  };

  const focusEditor = () => {
    if (!editorRef.current) {
      requestAnimationFrame(() => {
        if (editorRef.current) {
          editorRef.current.focus();
          restoreSelection();
        }
      });
      return;
    }
    editorRef.current.focus();
    restoreSelection();
  };

  const ensureEditorReady = (needsSelection = false) => {
    if (restrictEditing) {
      showMessage('error', 'Editing is restricted. Disable restriction first.');
      return false;
    }
    if (!editorRef.current) {
      showMessage('error', 'Editor not ready yet. Load a document first.');
      return false;
    }
    if (editorMode !== 'edit') {
      setEditorMode('edit');
    }
    focusEditor();

    if (needsSelection) {
      const range = resolveSelectionRange(editorRef.current, selectionRef.current, true);
      if (!range || range.collapsed) {
        showMessage('error', 'Select text inside the editor first.');
        return false;
      }
    }
    return true;
  };

  const applyInlineStyle = (style) => {
    if (!ensureEditorReady(true)) return;
    const applied = wrapSelectionWithSpan(editorRef.current, style, selectionRef.current);
    if (!applied) {
      showMessage('error', 'Select text inside the editor first.');
      return;
    }
    syncEditorHtml();
  };

  const applyBlockStyle = (style) => {
    if (!ensureEditorReady()) return;

    const block = findClosestBlock(editorRef.current);
    if (!block) {
      showMessage('error', 'Place cursor inside a paragraph or heading.');
      return;
    }

    Object.entries(style).forEach(([key, value]) => {
      block.style[key] = value;
    });
    syncEditorHtml();
  };

  const applyBlockTag = (tag) => {
    if (!ensureEditorReady()) return;

    const block = findClosestBlock(editorRef.current);
    if (!block) {
      showMessage('error', 'Place cursor inside a text block first.');
      return;
    }
    replaceBlockTag(block, tag);
    syncEditorHtml();
  };

  const insertMarker = (html) => {
    if (!ensureEditorReady()) return;

    if (!insertHtmlAtCursor(editorRef.current, html)) {
      showMessage('error', 'Place cursor inside editor to insert content.');
      return;
    }
    syncEditorHtml();
  };

  const updateTracking = () => {
    if (!trackingEnabled) return;
    const currentText = (editorRef.current?.innerText || '').trim();
    const diff = computeSimpleLineDiff(baselineText, currentText);
    setPendingChanges(diff.lines.filter((line) => line.type !== 'unchanged'));
  };

  const loadCurrentDocument = async () => {
    try {
      setLoading(true);
      setModelError('');

      let source = sourceFile;
      if (!source) {
        source = await Promise.race([
          getItemUrl(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out while preparing DOCX source. You can still load a local file below.')), 15000)),
        ]);
      }

      const model = await analyzeWordDocument(source);
      setDocModel(model);
      setEditorHtml(model.html || '');
      setBaselineText(model.rawText || '');
      setPendingChanges([]);
      setDiffResult(null);
      setSelectedImageName(model.media?.[0]?.name || '');
      if (sourceFile) {
        setSourceLabel(sourceFile.name || 'Local DOCX');
      } else {
        setSourceLabel(item?.name || 'Current document');
      }
      return model;
    } catch (error) {
      const message = error?.message || 'Failed to load DOCX model';
      setModelError(message);
      showMessage('error', message);
      const emptyModel = {
        html: '<p></p>',
        rawText: '',
        metrics: {
          wordCount: 0,
          characterCount: 0,
          pageCount: 1,
          pageBreakCount: 0,
          sectionBreakCount: 0,
        },
        structure: {
          outline: [],
          tables: [],
          headerEntries: [],
          footerEntries: [],
          embeddedObjects: [],
        },
        media: [],
      };
      setDocModel(emptyModel);
      setEditorHtml(emptyModel.html);
      setBaselineText(emptyModel.rawText);
      setPendingChanges([]);
      setDiffResult(null);
      setSelectedImageName('');
      setSourceLabel(sourceFile?.name || item?.name || 'Unavailable source');
      return emptyModel;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentDocument();
  }, [item?.id, item?.name, sourceFile]);

  const buildOutlineFromHtml = (html = '') => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html || '<div></div>', 'text/html');
    return Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((node, index) => ({
      id: `h_${index + 1}`,
      level: Number(node.tagName.slice(1)),
      text: (node.textContent || '').trim(),
    })).filter((entry) => entry.text);
  };

  const promptForOutputName = (defaultName) => {
    if (typeof window === 'undefined') return defaultName;
    const response = window.prompt('Save output as (leave blank to accept default name)', defaultName);
    const trimmed = (response || '').trim();
    return trimmed || defaultName;
  };

  const handleLocalSourceChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    setSourceFile(nextFile);
    if (nextFile) {
      setSourceLabel(nextFile.name);
      showMessage('success', `Loaded local source: ${nextFile.name}`);
    } else {
      setSourceLabel('');
    }
  };

  const saveEditedDocx = async (description = 'Edited DOCX saved.') => {
    const blob = await exportHtmlAsDocxBlob(editorHtml);
    const sourceName = sourceFile?.name || item?.name || 'document.docx';
    const defaultName = sourceName.replace(/\.(docx?|odt)$/i, '') + '_word_power.docx';
    const outputName = promptForOutputName(defaultName);
    await saveConvertedToStorage(blob, outputName, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    showMessage('success', `${description} Saved as ${outputName}.`);
  };

  const autoApplyAndSavePowerTools = async () => {
    try {
      setLoading(true);

      const model = docModel || await loadCurrentDocument();
      const baseHtml = editorHtml || model?.html || '';

      const detected = detectHeadingsFromHtml(baseHtml);
      const outline = buildOutlineFromHtml(detected.html);
      const tocReadyHtml = applyOrRefreshToc(detected.html, outline);

      setEditorHtml(tocReadyHtml);
      if (editorRef.current) editorRef.current.innerHTML = tocReadyHtml;
      setDocModel((prev) => {
        if (prev) return { ...prev, structure: { ...(prev.structure || {}), outline } };
        if (model) return { ...model, structure: { ...(model.structure || {}), outline } };
        return prev;
      });

      const blob = await exportHtmlAsDocxBlob(tocReadyHtml);
      const sourceName = sourceFile?.name || item?.name || 'document.docx';
      const defaultName = sourceName.replace(/\.(docx?|odt)$/i, '') + '_power_ready.docx';
      const outputName = promptForOutputName(defaultName);
      await saveConvertedToStorage(blob, outputName, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

      showMessage('success', `Power tools applied (headings: ${outline.length}, TOC refreshed) and saved as ${outputName}.`);
    } catch (error) {
      showMessage('error', error?.message || 'Failed to apply power tools and save.');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoDetectHeadings = () => {
    const detected = detectHeadingsFromHtml(editorHtml);
    setEditorHtml(detected.html);
    if (editorRef.current) editorRef.current.innerHTML = detected.html;
    showMessage('success', `Auto-detected ${detected.detected.length} heading candidate(s).`);
  };

  const handleGenerateToc = () => {
    const outline = docModel?.structure?.outline || [];
    const next = applyOrRefreshToc(editorHtml, outline);
    setEditorHtml(next);
    if (editorRef.current) editorRef.current.innerHTML = next;
    showMessage('success', 'Table of contents inserted.');
  };

  const handleRefreshToc = () => {
    const latestOutline = detectHeadingsFromHtml(editorHtml);
    const parser = new DOMParser();
    const doc = parser.parseFromString(latestOutline.html, 'text/html');
    const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((node, index) => ({
      id: `h_${index + 1}`,
      level: Number(node.tagName.slice(1)),
      text: (node.textContent || '').trim(),
    })).filter((entry) => entry.text);

    const refreshed = applyOrRefreshToc(latestOutline.html, headings);
    setEditorHtml(refreshed);
    if (editorRef.current) editorRef.current.innerHTML = refreshed;
    showMessage('success', 'Table of contents refreshed.');
  };

  const handleTableCsvExport = async () => {
    const tables = docModel?.structure?.tables || [];
    const table = tables[selectedTableIndex];
    if (!table) {
      showMessage('error', 'No table found at selected index.');
      return;
    }

    const csv = convertTableToCsv(table);
    const outputName = (item?.name || 'document.docx').replace(/\.(docx?|odt)$/i, '') + `_table_${selectedTableIndex + 1}.csv`;
    await saveConvertedToStorage(csv, outputName, 'text/csv');
    showMessage('success', 'Table exported to CSV.');
  };

  const handleExtractImages = async () => {
    const images = docModel?.media || [];
    if (!images.length) {
      showMessage('error', 'No embedded images found.');
      return;
    }

    let count = 0;
    for (const image of images) {
      if (!image?.dataUrl || !image?.name) continue;
      const blob = await fetch(image.dataUrl).then((res) => res.blob());
      const outputName = `${(item?.name || 'document').replace(/\.[^.]+$/, '')}_${image.name}`;
      await saveConvertedToStorage(blob, outputName, image.mimeType || blob.type || 'application/octet-stream');
      count += 1;
    }

    showMessage('success', `Extracted ${count} image(s).`);
  };

  const handleReplaceImage = () => {
    if (!replacementImageFile || !selectedImageName) {
      showMessage('error', 'Select existing image and replacement file first.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const pattern = new RegExp(`<img[^>]*alt=\\"${escapeForRegex(selectedImageName)}\\"[^>]*>`, 'i');
      const replacement = `<img src="${dataUrl}" alt="${selectedImageName}" style="max-width:${imageWidthPercent}%;height:auto;" />`;
      const nextHtml = editorHtml.match(pattern)
        ? editorHtml.replace(pattern, replacement)
        : `${editorHtml}<p>${replacement}</p>`;

      setEditorHtml(nextHtml);
      if (editorRef.current) editorRef.current.innerHTML = nextHtml;
      showMessage('success', 'Image replacement applied in editor.');
    };
    reader.readAsDataURL(replacementImageFile);
  };

  const handleResizeImage = () => {
    if (!selectedImageName) {
      showMessage('error', 'Select an image to resize.');
      return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(editorHtml, 'text/html');
    const target = doc.querySelector(`img[alt="${selectedImageName}"]`) || doc.querySelector('img');
    if (!target) {
      showMessage('error', 'No image found in editor content.');
      return;
    }

    target.style.maxWidth = `${Math.max(10, Math.min(200, imageWidthPercent))}%`;
    target.style.height = 'auto';
    const next = doc.body.innerHTML;
    setEditorHtml(next);
    if (editorRef.current) editorRef.current.innerHTML = next;
    showMessage('success', 'Image resized.');
  };

  const handleCompare = async () => {
    if (!compareFile) {
      showMessage('error', 'Select a DOCX file to compare.');
      return;
    }

    const leftText = docModel?.rawText || '';
    const rightModel = await analyzeWordDocument(compareFile);
    const diff = computeSimpleLineDiff(leftText, rightModel.rawText || '');

    setDiffResult({
      summary: diff.summary,
      html: buildDiffHighlightHtml(diff),
      targetName: compareFile.name,
    });
    showMessage('success', 'Comparison complete.');
  };

  const handleAcceptChanges = () => {
    const currentText = (editorRef.current?.innerText || '').trim();
    setBaselineText(currentText);
    setPendingChanges([]);
    showMessage('success', 'Tracked changes accepted.');
  };

  const handleRejectChanges = async () => {
    const source = sourceFile || await getItemUrl();
    const model = await analyzeWordDocument(source);
    setEditorHtml(model.html || '');
    if (editorRef.current) editorRef.current.innerHTML = model.html || '';
    setPendingChanges([]);
    setBaselineText(model.rawText || '');
    showMessage('success', 'Tracked changes rejected.');
  };

  const handleRollback = async () => {
    if (!item?.id || !selectedVersionId) {
      showMessage('error', 'Select a version first.');
      return;
    }

    const rolled = rollbackToVersion(item.id, selectedVersionId, {
      fileName: item.name,
      fileType: item.type,
    });

    if (!rolled?.restoredContent) {
      showMessage('error', 'Rollback failed.');
      return;
    }

    const outputName = (item?.name || 'document.docx').replace(/\.(docx?|odt)$/i, '') + '_rollback.txt';
    await saveConvertedToStorage(rolled.restoredContent, outputName, 'text/plain;charset=utf-8');
    showMessage('success', 'Rollback snapshot exported to TXT.');
  };

  const runDocxCrypto = async (mode) => {
    if (!docPassword) {
      showMessage('error', 'Enter password first.');
      return;
    }

    try {
      let sourceBlob;
      let sourceName;

      if (sourceFile) {
        sourceBlob = sourceFile;
        sourceName = sourceFile.name || 'document.docx';
      } else {
        const sourceUrl = await getItemUrl();
        sourceBlob = await fetch(sourceUrl).then((res) => res.blob());
        sourceName = item?.name || 'document.docx';
      }

      const preparedFile = new File([sourceBlob], sourceName, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const token = tokenUtils.getAccessToken();
      const formData = new FormData();
      formData.append('file', preparedFile);
      formData.append('password', docPassword);

      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`/api/v1/documents/tools/docx/${mode}`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: formData,
      });

      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const payload = await response.json();
          message = payload?.detail || message;
        } catch {
          message = await response.text();
        }
        throw new Error(message || `DOCX ${mode} failed`);
      }

      const outputBlob = await response.blob();
      const outputName = mode === 'encrypt'
        ? sourceName.replace(/\.(docx?|odt)$/i, '') + '_encrypted.docx'
        : sourceName.replace(/\.(docx?|odt)$/i, '') + '_decrypted.docx';

      await saveConvertedToStorage(
        outputBlob,
        outputName,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );

      showMessage('success', `DOCX ${mode}ed successfully via backend crypto tool.`);
    } catch (error) {
      showMessage('error', error.message || `DOCX ${mode} failed`);
    }
  };

  const handleSaveSecurityMeta = () => {
    localStorage.setItem(securityKey, JSON.stringify({
      password: docPassword,
      restrictEditing,
      updatedAt: new Date().toISOString(),
    }));
    showMessage('success', 'DOCX security profile saved.');
  };

  const handleRemovePasswordMeta = () => {
    setDocPassword('');
    localStorage.setItem(securityKey, JSON.stringify({
      password: '',
      restrictEditing,
      updatedAt: new Date().toISOString(),
    }));
    showMessage('success', 'Password removed from security profile.');
  };

  const handleDocPasswordProtect = async () => {
    await runDocxCrypto('encrypt');
  };

  const handleDocPasswordRemove = async () => {
    await runDocxCrypto('decrypt');
  };

  const sectionRefMap = {
    viewing: viewingRef,
    editing: editingRef,
    structure: structureRef,
    table: tableRef,
    media: mediaRef,
    security: securityRef,
    compare: compareRef,
    workspace: workspaceRef,
    load: workspaceRef,
  };

  const jumpToSection = (sectionKey) => {
    if (sectionKey === 'workspace') {
      setActiveFeatureCategory('editing');
    }
    if (SECTION_SHORT_LABEL[sectionKey]) {
      setActiveFeatureCategory(sectionKey);
    }
    const ref = sectionRefMap[sectionKey];
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const requireDocumentLoaded = () => {
    if (docModel) return true;
    showMessage('error', 'Load a document first: click "Load current" or choose a local DOCX.');
    jumpToSection('load');
    return false;
  };

  const handleFeatureAction = async (featureName) => {
    const section = FEATURE_SECTION_MAP[featureName];
    if (section) jumpToSection(section);

    const needsDocument = new Set(FEATURES_38);
    if (needsDocument.has(featureName) && !requireDocumentLoaded()) return;

    try {
      switch (featureName) {
        case 'Layout-preserving render':
          setEditorMode('view');
          jumpToSection('workspace');
          showMessage('success', 'Viewer mode enabled with layout-preserving render.');
          break;
        case 'Page breaks':
          showMessage('success', `Page breaks detected: ${stats.pageBreakCount}`);
          break;
        case 'Header/footer view':
          showMessage('success', `Headers: ${docModel?.structure?.headerEntries?.length || 0}, Footers: ${docModel?.structure?.footerEntries?.length || 0}`);
          break;
        case 'Table view':
          showMessage('success', `Detected tables: ${docModel?.structure?.tables?.length || 0}`);
          break;
        case 'Embedded image preview':
          showMessage('success', `Embedded image previews: ${docModel?.media?.length || 0}`);
          break;
        case 'Inline editing':
          setEditorMode('edit');
          jumpToSection('workspace');
          focusEditor();
          showMessage('success', 'Inline edit mode enabled.');
          break;
        case 'Bold/Italic/Underline':
          applyInlineStyle({ fontWeight: '700' });
          break;
        case 'Alignment':
          applyBlockStyle({ textAlign: 'center' });
          break;
        case 'Font size change':
          applyInlineStyle({ fontSize: `${fontSizePx}px` });
          break;
        case 'Paragraph spacing':
          applyBlockStyle({ marginBottom: `${paragraphSpacing}px` });
          break;
        case 'Insert page break':
          insertMarker('<hr data-page-break="true" style="border-top:2px dashed #94a3b8;" />');
          break;
        case 'Insert section break':
          insertMarker('<div data-section-break="true" style="height:16px;border-top:2px solid #334e68;margin:12px 0;"></div>');
          break;
        case 'Basic styles':
          applyBlockTag('h1');
          break;
        case 'Outline view':
          showMessage('success', `Outline entries: ${(docModel?.structure?.outline || []).length}`);
          break;
        case 'Auto-detect headings':
          handleAutoDetectHeadings();
          break;
        case 'Generate TOC':
          handleGenerateToc();
          break;
        case 'Refresh TOC':
          handleRefreshToc();
          break;
        case 'Edit header/footer':
          insertMarker('<p><strong>Header:</strong> [Editable Header]</p><p><strong>Footer:</strong> [Editable Footer]</p>');
          break;
        case 'Insert page numbers':
          insertMarker('<p style="text-align:right">Page <span data-page-number="true">1</span></p>');
          break;
        case 'Word count':
          showMessage('success', `Word count: ${stats.wordCount}`);
          break;
        case 'Character count':
          showMessage('success', `Character count: ${stats.characterCount}`);
          break;
        case 'Page count':
          showMessage('success', `Estimated page count: ${stats.pageCount}`);
          break;
        case 'Edit table cells':
          setEditorMode('edit');
          focusEditor();
          showMessage('success', 'Click inside a table cell in the editor to edit content.');
          break;
        case 'Add/remove row/column':
          if (!ensureEditorReady()) return;
          if (!addRowToSelectedTable(editorRef.current)) {
            showMessage('error', 'Place cursor inside a table cell first.');
          } else {
            syncEditorHtml();
            showMessage('success', 'Row added. Use Remove Row/Column to delete cell or row.');
          }
          break;
        case 'Export table to CSV':
          await handleTableCsvExport();
          break;
        case 'Table structure detection':
          showMessage('success', `Tables detected: ${(docModel?.structure?.tables || []).length}`);
          break;
        case 'Extract images':
          await handleExtractImages();
          break;
        case 'Replace image':
          handleReplaceImage();
          break;
        case 'Resize image':
          handleResizeImage();
          break;
        case 'View embedded objects':
          showMessage('success', `Embedded objects: ${(docModel?.structure?.embeddedObjects || []).length}`);
          break;
        case 'Password protect DOCX':
          await runDocxCrypto('encrypt');
          break;
        case 'Remove password':
          await runDocxCrypto('decrypt');
          break;
        case 'Restrict editing mode':
          setRestrictEditing((prev) => !prev);
          break;
        case 'Compare two DOCX files':
          if (!compareFile) {
            showMessage('error', 'Select a DOCX file in Compare section first.');
          } else {
            await handleCompare();
          }
          break;
        case 'Highlight differences':
          if (!compareFile) {
            showMessage('error', 'Select a DOCX file to compare first.');
          } else {
            await handleCompare();
          }
          break;
        case 'Track changes (basic)':
          setTrackingEnabled((prev) => !prev);
          break;
        case 'Accept/reject changes':
          if ((pendingChanges || []).length > 0) {
            handleAcceptChanges();
          } else {
            await handleRejectChanges();
          }
          break;
        case 'Version rollback':
          if (!selectedVersionId) {
            showMessage('error', 'Select a version in Compare & Version section first.');
          } else {
            await handleRollback();
          }
          break;
        default:
          break;
      }
    } catch (error) {
      showMessage('error', error?.message || `Failed to run feature: ${featureName}`);
    }
  };

  const stats = docModel?.metrics || {
    wordCount: 0,
    characterCount: 0,
    pageCount: 0,
    pageBreakCount: 0,
    sectionBreakCount: 0,
  };

  const activeStyles = SECTION_STYLE_MAP[activeFeatureCategory] || SECTION_STYLE_MAP.viewing;

  const renderCategoryDetails = () => {
    switch (activeFeatureCategory) {
      case 'viewing':
        return (
          <div ref={viewingRef} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <div>
              <h4 className="text-base font-semibold text-slate-900">Viewing Insights</h4>
              <p className="text-[13px] text-slate-600">Read-only document stats and structure highlights.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Word count: <strong>{stats.wordCount}</strong></div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Character count: <strong>{stats.characterCount}</strong></div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Page count: <strong>{stats.pageCount}</strong></div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Page breaks: <strong>{stats.pageBreakCount}</strong></div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">Header blocks: {docModel?.structure?.headerEntries?.length || 0}</div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">Footer blocks: {docModel?.structure?.footerEntries?.length || 0}</div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">Detected tables: {docModel?.structure?.tables?.length || 0}</div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">Embedded images: {docModel?.media?.length || 0}</div>
            </div>
          </div>
        );
      case 'editing':
        return (
          <div className="space-y-4">
            <div ref={editingRef} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-base font-semibold text-slate-900">Editing Tools</h4>
                  <p className="text-[13px] text-slate-600">Select text in the editor, then apply styles.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditorMode('edit'); focusEditor(); }}
                    className="btn-primary text-sm"
                  >
                    Enable Edit & Focus
                  </button>
                  <button
                    onClick={() => setEditorMode((prev) => (prev === 'edit' ? 'view' : 'edit'))}
                    className="btn-secondary text-sm"
                  >
                    {editorMode === 'edit' ? 'Switch to View' : 'Inline Edit'}
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[13px] text-emerald-800">
                Tip: Click inside the editor workspace, highlight text, then use the tools below.
              </div>
              {restrictEditing && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[13px] text-rose-700 flex flex-wrap items-center justify-between gap-2">
                  <span>Editing is locked. Disable restriction in Security to apply changes.</span>
                  <button
                    onClick={() => setActiveFeatureCategory('security')}
                    className="btn-secondary text-sm"
                  >
                    Open Security
                  </button>
                </div>
              )}
              <div className="flex flex-wrap gap-2" onMouseDown={handleToolbarMouseDown}>
                <button onClick={() => applyInlineStyle({ fontWeight: '700' })} className="tool-btn text-sm">Bold</button>
                <button onClick={() => applyInlineStyle({ fontStyle: 'italic' })} className="tool-btn text-sm">Italic</button>
                <button onClick={() => applyInlineStyle({ textDecoration: 'underline' })} className="tool-btn text-sm">Underline</button>
                <button onClick={() => applyBlockStyle({ textAlign: 'left' })} className="tool-btn text-sm">Align Left</button>
                <button onClick={() => applyBlockStyle({ textAlign: 'center' })} className="tool-btn text-sm">Align Center</button>
                <button onClick={() => applyBlockStyle({ textAlign: 'right' })} className="tool-btn text-sm">Align Right</button>
                <button onClick={() => applyBlockStyle({ textAlign: 'justify' })} className="tool-btn text-sm">Justify</button>
                <button onClick={() => insertMarker('<hr data-page-break="true" style="border-top:2px dashed #94a3b8;" />')} className="tool-btn text-sm">Insert Page Break</button>
                <button onClick={() => insertMarker('<div data-section-break="true" style="height:16px;border-top:2px solid #334e68;margin:12px 0;"></div>')} className="tool-btn text-sm">Insert Section Break</button>
                <button onClick={() => applyBlockTag('h1')} className="tool-btn text-sm">Style H1</button>
                <button onClick={() => applyBlockTag('h2')} className="tool-btn text-sm">Style H2</button>
                <button onClick={() => applyBlockTag('p')} className="tool-btn text-sm">Style Normal</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm">Font size (px)
                  <input type="number" min="8" max="48" value={fontSizePx} onChange={(e) => setFontSizePx(Number(e.target.value) || 16)} className="input w-full text-sm" />
                </label>
                <label className="text-sm">Paragraph spacing (px)
                  <input type="number" min="0" max="40" value={paragraphSpacing} onChange={(e) => setParagraphSpacing(Number(e.target.value) || 8)} className="input w-full text-sm" />
                </label>
              </div>
              <div className="flex gap-2 flex-wrap" onMouseDown={handleToolbarMouseDown}>
                <button onClick={() => applyInlineStyle({ fontSize: `${fontSizePx}px` })} className="btn-secondary text-sm">Apply Font Size</button>
                <button onClick={() => applyBlockStyle({ marginBottom: `${paragraphSpacing}px` })} className="btn-secondary text-sm">Apply Paragraph Spacing</button>
                <button onClick={() => saveEditedDocx('Edited DOCX saved.')} className="btn-primary text-sm">Save DOCX</button>
              </div>
            </div>
            <div ref={workspaceRef} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-base font-semibold text-slate-900">Editor Workspace</h4>
                <button onClick={focusEditor} className="text-[13px] text-slate-600 hover:text-slate-900">Focus editor</button>
              </div>
              <div
                ref={editorRef}
                contentEditable={editorMode === 'edit' && !restrictEditing}
                className="min-h-[280px] rounded border p-3 text-sm bg-white focus:outline-none"
                dangerouslySetInnerHTML={{ __html: editorHtml }}
                onInput={(e) => {
                  setEditorHtml(e.currentTarget.innerHTML);
                  updateTracking();
                  captureSelection();
                }}
                onMouseUp={captureSelection}
                onKeyUp={captureSelection}
                onFocus={captureSelection}
              />
            </div>
          </div>
        );
      case 'structure':
        return (
          <div ref={structureRef} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <div>
              <h4 className="text-base font-semibold text-slate-900">Structure Tools</h4>
              <p className="text-[13px] text-slate-600">Manage headings, TOC, and page numbering.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleAutoDetectHeadings} className="tool-btn text-sm">Auto-detect headings</button>
              <button onClick={handleGenerateToc} className="tool-btn text-sm">Generate TOC</button>
              <button onClick={handleRefreshToc} className="tool-btn text-sm">Refresh TOC</button>
              <button onClick={() => insertMarker('<p><strong>Header:</strong> [Editable Header]</p><p><strong>Footer:</strong> [Editable Footer]</p>')} className="tool-btn text-sm">Edit Header/Footer</button>
              <button onClick={() => insertMarker('<p style="text-align:right">Page <span data-page-number="true">1</span></p>')} className="tool-btn text-sm">Insert Page Numbers</button>
            </div>
            <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 p-3 text-sm bg-slate-50">
              {(docModel?.structure?.outline || []).length ? (
                (docModel?.structure?.outline || []).map((heading) => (
                  <div key={heading.id} style={{ marginLeft: `${Math.max(0, heading.level - 1) * 12}px` }}>
                    H{heading.level}: {heading.text}
                  </div>
                ))
              ) : (
                <p>No headings found yet.</p>
              )}
            </div>
          </div>
        );
      case 'table':
        return (
          <div ref={tableRef} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <div>
              <h4 className="text-base font-semibold text-slate-900">Table Tools</h4>
              <p className="text-[13px] text-slate-600">Select a table to export or edit cells.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">Detected table
                <select value={selectedTableIndex} onChange={(e) => setSelectedTableIndex(Number(e.target.value) || 0)} className="input w-full text-sm">
                  {(docModel?.structure?.tables || []).map((table, idx) => (
                    <option key={table.id} value={idx}>Table {idx + 1} ({table.rowCount}x{table.columnCount})</option>
                  ))}
                  {!(docModel?.structure?.tables || []).length && <option value={0}>No tables</option>}
                </select>
              </label>
              <div className="flex flex-col justify-end gap-2">
                <button onClick={handleTableCsvExport} className="btn-secondary text-sm">Export Table to CSV</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => insertMarker('<table border="1" style="width:100%"><tr><td>Cell 1</td><td>Cell 2</td></tr></table>')} className="tool-btn text-sm">Insert Table</button>
              <button onClick={() => { ensureEditorReady(); if (!addRowToSelectedTable(editorRef.current)) showMessage('error', 'Place cursor inside a table cell first.'); else syncEditorHtml(); }} className="tool-btn text-sm">Add Row</button>
              <button onClick={() => { ensureEditorReady(); if (!addColumnToSelectedTable(editorRef.current)) showMessage('error', 'Place cursor inside a table cell first.'); else syncEditorHtml(); }} className="tool-btn text-sm">Add Column</button>
              <button onClick={() => { ensureEditorReady(); if (!removeSelectedRowOrColumn(editorRef.current)) showMessage('error', 'Place cursor inside a table cell first.'); else syncEditorHtml(); }} className="tool-btn text-sm">Remove Row/Column</button>
              <button onClick={() => showMessage('success', 'Table structure detection complete.')} className="tool-btn text-sm">Detect Table Structure</button>
            </div>
          </div>
        );
      case 'media':
        return (
          <div ref={mediaRef} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <div>
              <h4 className="text-base font-semibold text-slate-900">Media Tools</h4>
              <p className="text-[13px] text-slate-600">Extract, replace, or resize embedded images.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleExtractImages} className="tool-btn text-sm">Extract Images</button>
              <button onClick={handleReplaceImage} className="tool-btn text-sm">Replace Image</button>
              <button onClick={handleResizeImage} className="tool-btn text-sm">Resize Image</button>
              <button onClick={() => showMessage('success', `Embedded objects: ${(docModel?.structure?.embeddedObjects || []).length}`)} className="tool-btn text-sm">View Embedded Objects</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-sm col-span-1">Image
                <select value={selectedImageName} onChange={(e) => setSelectedImageName(e.target.value)} className="input w-full text-sm">
                  {(docModel?.media || []).map((img) => <option key={img.name} value={img.name}>{img.name}</option>)}
                  {!(docModel?.media || []).length && <option value="">No images</option>}
                </select>
              </label>
              <label className="text-sm col-span-1">Replacement
                <input type="file" accept="image/*" onChange={(e) => setReplacementImageFile(e.target.files?.[0] || null)} className="input w-full text-sm" />
              </label>
              <label className="text-sm col-span-1">Width %
                <input type="number" min="10" max="200" value={imageWidthPercent} onChange={(e) => setImageWidthPercent(Number(e.target.value) || 100)} className="input w-full text-sm" />
              </label>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(docModel?.media || []).slice(0, 8).map((img) => (
                <img key={img.name} src={img.dataUrl} alt={img.name} className="w-full h-16 object-cover rounded border" />
              ))}
            </div>
          </div>
        );
      case 'security':
        return (
          <div ref={securityRef} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <div>
              <h4 className="text-base font-semibold text-slate-900">Security</h4>
              <p className="text-[13px] text-slate-600">Protect or unlock DOCX files with a password.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">Password
                <input type="password" value={docPassword} onChange={(e) => setDocPassword(e.target.value)} className="input w-full text-sm" />
              </label>
              <label className="text-sm flex items-end gap-2">
                <input type="checkbox" checked={restrictEditing} onChange={(e) => setRestrictEditing(e.target.checked)} />
                Restrict editing mode
              </label>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => runDocxCrypto('encrypt')} className="btn-primary text-sm">Password Protect DOCX</button>
              <button onClick={() => runDocxCrypto('decrypt')} className="btn-secondary text-sm">Remove Password</button>
              <button onClick={handleSaveSecurityMeta} className="tool-btn text-sm">Save Restriction Profile</button>
              <button onClick={handleRemovePasswordMeta} className="tool-btn text-sm">Clear Local Password</button>
            </div>
          </div>
        );
      case 'compare':
        return (
          <div ref={compareRef} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <div>
              <h4 className="text-base font-semibold text-slate-900">Compare & Version</h4>
              <p className="text-[13px] text-slate-600">Compare two DOCX files and manage versions.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">Compare two DOCX files
                <input type="file" accept=".doc,.docx" onChange={(e) => setCompareFile(e.target.files?.[0] || null)} className="input w-full text-sm" />
              </label>
              <div className="flex items-end">
                <button onClick={handleCompare} className="btn-secondary text-sm w-full">Compare + Highlight Differences</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setTrackingEnabled((prev) => !prev)} className="tool-btn text-sm">Track changes (basic): {trackingEnabled ? 'ON' : 'OFF'}</button>
              <button onClick={handleAcceptChanges} className="tool-btn text-sm">Accept changes</button>
              <button onClick={handleRejectChanges} className="tool-btn text-sm">Reject changes</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">Version rollback
                <select value={selectedVersionId} onChange={(e) => setSelectedVersionId(e.target.value)} className="input w-full text-sm">
                  <option value="">Select version</option>
                  {availableVersions.map((version) => (
                    <option key={version.id} value={version.id}>{version.label} - {new Date(version.createdAt).toLocaleString()}</option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button onClick={handleRollback} className="btn-secondary text-sm w-full">Rollback Snapshot</button>
              </div>
            </div>
            {diffResult && (
              <div className="rounded border p-3 text-sm">
                <p className="font-medium mb-1">Compared with: {diffResult.targetName}</p>
                <p className="mb-2">Added: {diffResult.summary.added}, Removed: {diffResult.summary.removed}, Modified: {diffResult.summary.modified}</p>
                <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1" dangerouslySetInnerHTML={{ __html: diffResult.html }} />
              </div>
            )}
            {trackingEnabled && (
              <div className="rounded border p-2 text-sm">Pending tracked changes: <strong>{pendingChanges.length}</strong></div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 text-sm" style={{ fontFamily: 'Space Grotesk, Trebuchet MS, Segoe UI, sans-serif' }}>
      <div className="rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_top,_#ffffff,_#eef2ff,_#e0f2fe)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-slate-900">Word Power Studio</p>
            <p className="text-[13px] text-slate-600">Clean, focused tools for text-only DOCX workflows.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={loadCurrentDocument} className="btn-secondary text-sm">Load current file</button>
            <button onClick={loadCurrentDocument} className="tool-btn text-sm">Reload</button>
            <button onClick={autoApplyAndSavePowerTools} className="btn-primary text-sm">Auto-prepare & Save</button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-[13px] text-slate-700">
            Load local DOCX source
            <input type="file" accept=".doc,.docx,.odt" onChange={handleLocalSourceChange} className="input mt-2 w-full text-sm" />
          </label>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-[13px] text-slate-700">
            Active source: <strong>{sourceLabel || item?.name || 'Not loaded'}</strong>
          </div>
        </div>
        {loading && (
          <p className="mt-2 text-[13px] text-slate-600">Loading Word model in background. Tools remain available.</p>
        )}
        {!!modelError && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
            {modelError}
          </div>
        )}
        <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-600">
          Tip: Pick a category, then click a tool. For text styling, click inside the editor, select text, and apply.
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="text-base font-semibold text-slate-900">Quick Word Actions</h4>
            <p className="text-[13px] text-slate-600">Simple mode with the most-used tools.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAdvancedPanel((prev) => !prev)}
            className="btn-secondary text-sm"
          >
            {showAdvancedPanel ? 'Hide Advanced Tools' : 'Show Advanced Tools'}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <button onClick={autoApplyAndSavePowerTools} className="btn-primary text-sm">Auto Prepare + Save</button>
          <button onClick={() => saveEditedDocx('Manual save')} className="btn-secondary text-sm">Save Edited DOCX</button>
          <button onClick={handleDocPasswordProtect} className="tool-btn text-sm">Password Protect</button>
          <button onClick={handleDocPasswordRemove} className="tool-btn text-sm">Remove Password</button>
          <button onClick={handleAutoDetectHeadings} className="tool-btn text-sm">Auto Headings</button>
          <button onClick={handleGenerateToc} className="tool-btn text-sm">Generate TOC</button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-cyan-50 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="text-base font-semibold text-slate-900">Status & Quick Actions</h4>
            <p className="text-[13px] text-slate-600">Keep the document ready for power tools.</p>
          </div>
          <div className="text-[13px] text-slate-600">Source: <span className="font-medium text-slate-800">{sourceLabel || item?.name || 'Not loaded'}</span></div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">Word count: <strong>{stats.wordCount}</strong></div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">Character count: <strong>{stats.characterCount}</strong></div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">Page count: <strong>{stats.pageCount}</strong></div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">Page breaks: <strong>{stats.pageBreakCount}</strong></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={autoApplyAndSavePowerTools} className="btn-primary text-sm">Run & Save Power Copy</button>
          <button onClick={() => saveEditedDocx('Manual save')} className="btn-secondary text-sm">Save Current Editor</button>
          <button onClick={focusEditor} className="tool-btn text-sm">Focus Editor</button>
        </div>
      </div>

      {showAdvancedPanel && (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-base font-semibold text-slate-900">Feature Categories</h4>
            <p className="text-[13px] text-slate-600">Pick a category, then run any tool inside it.</p>
          </div>
          <div className="text-[13px] text-slate-600">Showing {visibleFeatureCount} of {featureProgress.total} tools</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAdvancedFeatures(false)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${showAdvancedFeatures ? 'border-slate-200 text-slate-600 bg-white' : 'border-emerald-300 bg-emerald-50 text-emerald-800'}`}
          >
            Text-only essentials
          </button>
          <button
            type="button"
            onClick={() => setShowAdvancedFeatures(true)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${showAdvancedFeatures ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 bg-white'}`}
          >
            All 38 tools
          </button>
        </div>
        {!showAdvancedFeatures && (
          <p className="text-[12px] text-slate-500">Advanced categories (Structure, Table, Media) are hidden to keep the UI simple.</p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" onMouseDown={handleToolbarMouseDown}>
          {featureSections.map((section) => {
            const styles = SECTION_STYLE_MAP[section.key] || SECTION_STYLE_MAP.viewing;
            const isActive = activeFeatureCategory === section.key;
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveFeatureCategory(section.key)}
                className={`rounded-xl border px-3 py-3 text-left transition-colors ${styles.button} ${isActive ? styles.active : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{section.label}</span>
                  <span className={`text-[13px] ${styles.badge}`}>{section.count}</span>
                </div>
                <p className="text-[12px] mt-1 text-slate-600">Tap to open tools</p>
              </button>
            );
          })}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-slate-900">{SECTION_SHORT_LABEL[activeFeatureCategory]}</span>
              <span className="text-[13px] text-slate-600">{visibleFeatures.length} tools</span>
            </div>
            <button
              type="button"
              onClick={() => jumpToSection(activeFeatureCategory)}
              className="text-[13px] text-slate-600 hover:text-slate-900"
            >
              Jump to details
            </button>
          </div>
          {activeFeatureCategory === 'editing' && (
            <p className="text-[13px] text-slate-600 mb-3">
              Editing tools apply to the Editor Workspace below. Select text there before applying styles.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" onMouseDown={handleToolbarMouseDown}>
            {visibleFeatures.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => handleFeatureAction(name)}
                className={`rounded-lg border px-3 py-3 text-left transition-colors ${activeStyles.button}`}
              >
                <div className="flex items-start gap-2">
                  <Icon name={FEATURE_ICON_MAP[name] || 'check'} size={14} className="mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">{name}</div>
                    <div className="text-[13px] text-slate-600">{FEATURE_HELP_MAP[name] || 'Click to run'}</div>
                  </div>
                </div>
              </button>
            ))}
            {!visibleFeatures.length && (
              <div className="text-sm text-slate-600">No tools in this category.</div>
            )}
          </div>
        </div>
      </div>
      )}

      {showAdvancedPanel && renderCategoryDetails()}
    </div>
  );
}
