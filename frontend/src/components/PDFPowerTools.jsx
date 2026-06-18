import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import * as pdfTools from '../utils/pdfPowerTools';
import { Icons } from '../utils/helpers';

// Icon component for SVG rendering
const Icon = ({ name, size = 16, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
    dangerouslySetInnerHTML={{ __html: Icons[name] || '' }}
  />
);

export default function PDFPowerTools({ item, onClose }) {
  const { actions } = useApp();
  const [activeSection, setActiveSection] = useState('main');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const signatureCanvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const mergeFilesRef = useRef(null);
  const imageFilesRef = useRef(null);

  // Form Data States
  const [formData, setFormData] = useState({});
  const [watermarkConfig, setWatermarkConfig] = useState({
    text: 'CONFIDENTIAL',
    opacity: 0.3,
    rotation: 45,
    fontSize: 60,
    color: { r: 0.5, g: 0.5, b: 0.5 }
  });
  const [signatureData, setSignatureData] = useState(null);
  const [passwords, setPasswords] = useState({ userPassword: '', ownerPassword: '' });
  const [bgConfig, setBgConfig] = useState({ type: 'color', value: { r: 1, g: 1, b: 0.9 }, opacity: 0.5 });
  const [pageConfig, setPageConfig] = useState({ position: 'end', count: 1, size: 'A4' });
  const [pageIndices, setPageIndices] = useState('');
  const [splitRanges, setSplitRanges] = useState([{ start: 1, end: 5 }]);
  const [pageOrder, setPageOrder] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [convertFormat, setConvertFormat] = useState('text');
  const [insertSourceFile, setInsertSourceFile] = useState(null);
  const [insertPosition, setInsertPosition] = useState('end');
  const [duplicatePagesInput, setDuplicatePagesInput] = useState('');
  const [duplicateCopies, setDuplicateCopies] = useState(1);
  const [extractPagesInput, setExtractPagesInput] = useState('');
  const [rotatePagesInput, setRotatePagesInput] = useState('');

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const executeAction = async (actionFn, successMsg) => {
    try {
      setLoading(true);
      await actionFn();
      showMessage('success', successMsg);
    } catch (error) {
      showMessage('error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // === HANDLER FUNCTIONS ===

  const handleFillForm = () => {
    executeAction(
      async () => await actions.fillPDFForm(item.id, formData),
      'Form filled successfully!'
    );
  };

  const handleSaveFlattenedForm = () => {
    executeAction(
      async () => await actions.saveFlattenedForm(item.id),
      'Form flattened and saved!'
    );
  };

  const handleDrawSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    
    const dataUrl = canvas.toDataURL('image/png');
    setSignatureData({
      type: 'draw',
      data: dataUrl,
      position: { page: 0, x: 50, y: 50, width: 200, height: 100 }
    });
  };

  const handleAddSignature = () => {
    if (!signatureData) {
      showMessage('error', 'Please draw or upload a signature first');
      return;
    }
    executeAction(
      async () => await actions.addSignature(item.id, signatureData),
      'Signature added successfully!'
    );
  };

  const handleAddWatermark = () => {
    executeAction(
      async () => await actions.addWatermark(item.id, watermarkConfig),
      'Watermark added successfully!'
    );
  };

  const handleAddBackground = () => {
    executeAction(
      async () => await actions.addPageBackground(item.id, bgConfig),
      'Background added successfully!'
    );
  };

  const handleAddPages = () => {
    executeAction(
      async () => await actions.addPDFPages(item.id, pageConfig),
      `${pageConfig.count} page(s) added successfully!`
    );
  };

  const handleRemovePages = () => {
    const indices = pageIndices.split(',').map(i => parseInt(i.trim()) - 1).filter(i => !isNaN(i));
    if (indices.length === 0) {
      showMessage('error', 'Please enter valid page numbers (e.g., 1,3,5)');
      return;
    }
    executeAction(
      async () => await actions.removePDFPages(item.id, indices),
      `${indices.length} page(s) removed successfully!`
    );
  };

  const handleInsertPagesFromPDF = () => {
    if (!insertSourceFile) {
      showMessage('error', 'Please select a PDF to insert');
      return;
    }
    executeAction(
      async () => await actions.insertPDFPagesFromPDF(item.id, insertSourceFile, { position: insertPosition }),
      'Pages inserted successfully!'
    );
  };

  const handleDuplicatePages = () => {
    const indices = duplicatePagesInput.split(',').map(i => parseInt(i.trim()) - 1).filter(i => !isNaN(i));
    if (indices.length === 0) {
      showMessage('error', 'Please enter valid page numbers to duplicate');
      return;
    }
    const copies = Math.max(1, parseInt(duplicateCopies) || 1);
    executeAction(
      async () => await actions.duplicatePDFPages(item.id, indices, copies),
      `Duplicated ${indices.length} page(s)!`
    );
  };

  const handleExtractPages = () => {
    const indices = extractPagesInput.split(',').map(i => parseInt(i.trim()) - 1).filter(i => !isNaN(i));
    if (indices.length === 0) {
      showMessage('error', 'Please enter valid page numbers to extract');
      return;
    }
    executeAction(
      async () => await actions.extractPDFPages(item.id, indices),
      `Extracted ${indices.length} page(s) to a new PDF!`
    );
  };

  const handleSplitToSinglePages = () => {
    executeAction(
      async () => await actions.splitPDFToSinglePages(item.id),
      'Split into single-page PDFs!'
    );
  };

  const handleExtractTables = () => {
    executeAction(
      async () => await actions.extractPDFTables(item.id),
      'Extracted tables to CSV!'
    );
  };

  const handleExtractFonts = () => {
    executeAction(
      async () => await actions.extractPDFFonts(item.id),
      'Extracted embedded fonts list!'
    );
  };

  const handleSplitByRange = () => {
    executeAction(
      async () => await actions.splitPDFByRange(item.id, splitRanges),
      `PDF split into ${splitRanges.length} parts!`
    );
  };

  const handlePasswordProtect = () => {
    executeAction(
      async () => await actions.passwordProtectPDF(item.id, passwords),
      'PDF password protected!'
    );
  };

  const handleRemovePassword = () => {
    executeAction(
      async () => await actions.removePasswordPDF(item.id, passwords.userPassword),
      'Password removed successfully!'
    );
  };

  const handlePDFToText = () => {
    executeAction(
      async () => await actions.pdfToText(item.id),
      'PDF converted to text!'
    );
  };

  const handlePDFToImages = () => {
    executeAction(
      async () => await actions.pdfToImages(item.id),
      'PDF converted to images!'
    );
  };

  const handleMergePDFs = async () => {
    if (selectedFiles.length < 2) {
      showMessage('error', 'Please select at least 2 PDF files to merge');
      return;
    }
    executeAction(
      async () => {
        const mergedBytes = await pdfTools.mergePDFFiles(selectedFiles);
        pdfTools.downloadBytes(mergedBytes, 'merged.pdf');
      },
      'PDFs merged successfully!'
    );
  };

  const handleReorderPages = () => {
    const newOrder = pageOrder.split(',').map(i => parseInt(i.trim()) - 1).filter(i => !isNaN(i) && i >= 0);
    if (newOrder.length === 0) {
      showMessage('error', 'Please enter valid page order (e.g., 3,1,2,4)');
      return;
    }
    executeAction(
      async () => {
        const reorderedBytes = await pdfTools.reorderPDFPages(item.url || item.path, newOrder);
        pdfTools.downloadBytes(reorderedBytes, `reordered_${item.name}`);
      },
      'Pages reordered successfully!'
    );
  };

  const handleImagesToPDF = async () => {
    if (selectedFiles.length === 0) {
      showMessage('error', 'Please select images to convert');
      return;
    }
    executeAction(
      async () => {
        const pdfBytes = await pdfTools.imagesToPDF(selectedFiles);
        pdfTools.downloadBytes(pdfBytes, 'images_converted.pdf');
      },
      'Images converted to PDF!'
    );
  };

  const handleDocToPDF = async () => {
    if (selectedFiles.length === 0) {
      showMessage('error', 'Please select a DOC/DOCX file');
      return;
    }
    executeAction(
      async () => {
        const pdfBytes = await pdfTools.docToPDF(selectedFiles[0]);
        pdfTools.downloadBytes(pdfBytes, selectedFiles[0].name.replace(/\.(docx?)/i, '.pdf'));
      },
      'Document converted to PDF!'
    );
  };

  const handleTxtToPDF = async () => {
    if (selectedFiles.length === 0) {
      showMessage('error', 'Please select a TXT file');
      return;
    }
    executeAction(
      async () => {
        const pdfBytes = await pdfTools.txtToPDF(selectedFiles[0]);
        pdfTools.downloadBytes(pdfBytes, selectedFiles[0].name.replace(/\.txt/i, '.pdf'));
      },
      'Text file converted to PDF!'
    );
  };

  const handlePDFToDoc = () => {
    executeAction(
      async () => {
        await pdfTools.downloadPDFAsDoc(item.url || item.path, item.name.replace(/\.pdf/i, '.doc'));
      },
      'PDF converted to DOC!'
    );
  };

  const handleCompressPDF = () => {
    executeAction(
      async () => {
        const compressedBytes = await pdfTools.compressPDF(item.url || item.path);
        pdfTools.downloadBytes(compressedBytes, `compressed_${item.name}`);
      },
      'PDF compressed successfully!'
    );
  };

  const handleRotatePDF = (degrees) => {
    const indices = rotatePagesInput
      .split(',')
      .map(i => parseInt(i.trim()) - 1)
      .filter(i => !isNaN(i));
    executeAction(
      async () => {
        const rotatedBytes = await pdfTools.rotatePDF(item.url || item.path, degrees, indices.length ? indices : null);
        pdfTools.downloadBytes(rotatedBytes, `rotated_${item.name}`);
      },
      `PDF rotated ${degrees}°!`
    );
  };

  const handlePDFToPPT = () => {
    executeAction(
      async () => {
        const result = await pdfTools.pdfToPPT(item.url || item.path);
        // Download images for PPT conversion
        for (const img of result.images) {
          const link = document.createElement('a');
          link.href = img.dataUrl;
          link.download = img.name;
          link.click();
        }
        showMessage('success', 'Images extracted. Import them into PowerPoint as slides.');
      },
      'PDF pages exported for PowerPoint!'
    );
  };

  const handleSavePDFAs = (compress = false) => {
    executeAction(
      async () => await actions.savePDFAs(item.id, item.name, { compress, optimize: true }),
      `PDF saved${compress ? ' and compressed' : ''}!`
    );
  };

  // === RENDER SECTIONS ===

  const renderMainMenu = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <button onClick={() => setActiveSection('forms')} className="pdf-tool-btn">
        <Icon name="edit" size={20} className="text-navy-600" />
        <span>Forms & Fields</span>
      </button>
      <button onClick={() => setActiveSection('signature')} className="pdf-tool-btn">
        <Icon name="signature" size={20} className="text-navy-600" />
        <span>Digital Signature</span>
      </button>
      <button onClick={() => setActiveSection('watermark')} className="pdf-tool-btn">
        <Icon name="watermark" size={20} className="text-navy-600" />
        <span>Watermark</span>
      </button>
      <button onClick={() => setActiveSection('background')} className="pdf-tool-btn">
        <Icon name="background" size={20} className="text-navy-600" />
        <span>Page Background</span>
      </button>
      <button onClick={() => setActiveSection('pages')} className="pdf-tool-btn">
        <Icon name="pages" size={20} className="text-navy-600" />
        <span>Add/Remove Pages</span>
      </button>
      <button onClick={() => setActiveSection('merge')} className="pdf-tool-btn">
        <Icon name="merge" size={20} className="text-navy-600" />
        <span>Merge PDFs</span>
      </button>
      <button onClick={() => setActiveSection('split')} className="pdf-tool-btn">
        <Icon name="split" size={20} className="text-navy-600" />
        <span>Split PDF</span>
      </button>
      <button onClick={() => setActiveSection('reorder')} className="pdf-tool-btn">
        <Icon name="reorder" size={20} className="text-navy-600" />
        <span>Reorder Pages</span>
      </button>
      <button onClick={() => setActiveSection('security')} className="pdf-tool-btn">
        <Icon name="lock" size={20} className="text-navy-600" />
        <span>Security & Password</span>
      </button>
      <button onClick={() => setActiveSection('convert')} className="pdf-tool-btn">
        <Icon name="convert" size={20} className="text-navy-600" />
        <span>PDF Conversions</span>
      </button>
      <button onClick={() => setActiveSection('images')} className="pdf-tool-btn">
        <Icon name="image" size={20} className="text-navy-600" />
        <span>Images ↔ PDF</span>
      </button>
      <button onClick={() => setActiveSection('documents')} className="pdf-tool-btn">
        <Icon name="document" size={20} className="text-navy-600" />
        <span>Docs ↔ PDF</span>
      </button>
      <button onClick={() => setActiveSection('extract')} className="pdf-tool-btn">
        <Icon name="export" size={20} className="text-navy-600" />
        <span>Extract & Export</span>
      </button>
    </div>
  );

  const renderFormsSection = () => (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg mb-3 flex items-center gap-2"><Icon name="edit" size={18} className="text-navy-600" /> Form Filling</h3>
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Field Name"
          className="w-full px-3 py-2 border rounded"
          onBlur={(e) => {
            const fieldName = e.target.value;
            const fieldValue = prompt('Enter value for ' + fieldName);
            if (fieldValue) {
              setFormData({ ...formData, [fieldName]: fieldValue });
            }
          }}
        />
        <button onClick={handleFillForm} className="btn-primary w-full">
          Fill Form Fields
        </button>
        <button onClick={handleSaveFlattenedForm} className="btn-secondary w-full">
          Flatten & Save Form
        </button>
      </div>
    </div>
  );

  const renderSignatureSection = () => (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg mb-3 flex items-center gap-2"><Icon name="signature" size={18} className="text-navy-600" /> Digital Signature</h3>
      <div className="border rounded p-4 bg-white">
        <canvas
          ref={signatureCanvasRef}
          width={400}
          height={150}
          className="border border-dashed w-full cursor-crosshair"
          onMouseDown={(e) => {
            const canvas = e.target;
            const ctx = canvas.getContext('2d');
            const rect = canvas.getBoundingClientRect();
            let drawing = true;
            
            const draw = (e) => {
              if (!drawing) return;
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              ctx.lineWidth = 2;
              ctx.lineCap = 'round';
              ctx.strokeStyle = '#000';
              ctx.lineTo(x, y);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(x, y);
            };
            
            canvas.onmousemove = draw;
            canvas.onmouseup = () => {
              drawing = false;
              canvas.onmousemove = null;
              canvas.onmouseup = null;
              handleDrawSignature();
            };
            
            ctx.beginPath();
            ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
          }}
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => {
              const ctx = signatureCanvasRef.current?.getContext('2d');
              if (ctx) ctx.clearRect(0, 0, 400, 150);
            }}
            className="btn-secondary flex-1"
          >
            Clear
          </button>
          <button onClick={handleAddSignature} className="btn-primary flex-1">
            Add to PDF
          </button>
        </div>
      </div>
    </div>
  );

  const renderWatermarkSection = () => (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg mb-3 flex items-center gap-2"><Icon name="watermark" size={18} className="text-navy-600" /> Watermark</h3>
      <input
        type="text"
        placeholder="Watermark Text"
        value={watermarkConfig.text}
        onChange={(e) => setWatermarkConfig({ ...watermarkConfig, text: e.target.value })}
        className="w-full px-3 py-2 border rounded"
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-600">Opacity</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={watermarkConfig.opacity}
            onChange={(e) => setWatermarkConfig({ ...watermarkConfig, opacity: parseFloat(e.target.value) })}
            className="w-full"
          />
        </div>
        <div>
          <label className="text-sm text-gray-600">Rotation</label>
          <input
            type="number"
            value={watermarkConfig.rotation}
            onChange={(e) => setWatermarkConfig({ ...watermarkConfig, rotation: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
      </div>
      <button onClick={handleAddWatermark} className="btn-primary w-full">
        Add Watermark
      </button>
    </div>
  );

  const renderBackgroundSection = () => (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg mb-3 flex items-center gap-2"><Icon name="background" size={18} className="text-navy-600" /> Page Background</h3>
      <select
        value={bgConfig.type}
        onChange={(e) => setBgConfig({ ...bgConfig, type: e.target.value })}
        className="w-full px-3 py-2 border rounded"
      >
        <option value="color">Color Background</option>
        <option value="image">Image Background</option>
      </select>
      {bgConfig.type === 'color' && (
        <div className="grid grid-cols-3 gap-2">
          <input type="color" className="w-full h-10 border rounded" 
            onChange={(e) => {
              const hex = e.target.value;
              const r = parseInt(hex.slice(1,3), 16) / 255;
              const g = parseInt(hex.slice(3,5), 16) / 255;
              const b = parseInt(hex.slice(5,7), 16) / 255;
              setBgConfig({ ...bgConfig, value: { r, g, b } });
            }}
          />
        </div>
      )}
      <button onClick={handleAddBackground} className="btn-primary w-full">
        Add Background
      </button>
    </div>
  );

  const renderPagesSection = () => (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg mb-3 flex items-center gap-2"><Icon name="pages" size={18} className="text-navy-600" /> Page Management</h3>
      <div className="border rounded p-3 space-y-3">
        <h4 className="font-medium">Add Pages</h4>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min="1"
            placeholder="Count"
            value={pageConfig.count}
            onChange={(e) => setPageConfig({ ...pageConfig, count: parseInt(e.target.value) })}
            className="px-3 py-2 border rounded"
          />
          <select
            value={pageConfig.position}
            onChange={(e) => setPageConfig({ ...pageConfig, position: e.target.value })}
            className="px-3 py-2 border rounded"
          >
            <option value="start">At Start</option>
            <option value="end">At End</option>
          </select>
        </div>
        <button onClick={handleAddPages} className="btn-primary w-full">
          Add Pages
        </button>
      </div>
      <div className="border rounded p-3 space-y-3">
        <h4 className="font-medium">Remove Pages</h4>
        <input
          type="text"
          placeholder="Page numbers (e.g., 1,3,5)"
          value={pageIndices}
          onChange={(e) => setPageIndices(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        />
        <button onClick={handleRemovePages} className="btn-danger w-full">
          Remove Pages
        </button>
      </div>
      <div className="border rounded p-3 space-y-3">
        <h4 className="font-medium">Insert Pages from Another PDF</h4>
        <input
          type="file"
          accept=".pdf"
          onChange={(e) => setInsertSourceFile(e.target.files?.[0] || null)}
          className="w-full px-3 py-2 border rounded"
        />
        <select
          value={insertPosition}
          onChange={(e) => setInsertPosition(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        >
          <option value="start">Insert at Start</option>
          <option value="end">Insert at End</option>
        </select>
        <button onClick={handleInsertPagesFromPDF} className="btn-primary w-full">
          Insert PDF Pages
        </button>
      </div>
      <div className="border rounded p-3 space-y-3">
        <h4 className="font-medium">Duplicate Pages</h4>
        <input
          type="text"
          placeholder="Page numbers (e.g., 2,4)"
          value={duplicatePagesInput}
          onChange={(e) => setDuplicatePagesInput(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        />
        <input
          type="number"
          min="1"
          value={duplicateCopies}
          onChange={(e) => setDuplicateCopies(e.target.value)}
          className="w-full px-3 py-2 border rounded"
          placeholder="Copies"
        />
        <button onClick={handleDuplicatePages} className="btn-secondary w-full">
          Duplicate Pages
        </button>
      </div>
    </div>
  );

  const renderSplitSection = () => (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg mb-3 flex items-center gap-2"><Icon name="split" size={18} className="text-navy-600" /> Split PDF</h3>
      {splitRanges.map((range, idx) => (
        <div key={idx} className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="Start Page"
            value={range.start}
            onChange={(e) => {
              const newRanges = [...splitRanges];
              newRanges[idx].start = parseInt(e.target.value);
              setSplitRanges(newRanges);
            }}
            className="px-3 py-2 border rounded"
          />
          <input
            type="number"
            placeholder="End Page"
            value={range.end}
            onChange={(e) => {
              const newRanges = [...splitRanges];
              newRanges[idx].end = parseInt(e.target.value);
              setSplitRanges(newRanges);
            }}
            className="px-3 py-2 border rounded"
          />
        </div>
      ))}
      <button
        onClick={() => setSplitRanges([...splitRanges, { start: 1, end: 5 }])}
        className="btn-secondary w-full"
      >
        + Add Range
      </button>
      <button onClick={handleSplitByRange} className="btn-primary w-full">
        Split by Ranges
      </button>
    </div>
  );

  const renderSecuritySection = () => (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg mb-3 flex items-center gap-2"><Icon name="lock" size={18} className="text-navy-600" /> Security & Password</h3>
      <input
        type="password"
        placeholder="User Password"
        value={passwords.userPassword}
        onChange={(e) => setPasswords({ ...passwords, userPassword: e.target.value })}
        className="w-full px-3 py-2 border rounded"
      />
      <input
        type="password"
        placeholder="Owner Password (Optional)"
        value={passwords.ownerPassword}
        onChange={(e) => setPasswords({ ...passwords, ownerPassword: e.target.value })}
        className="w-full px-3 py-2 border rounded"
      />
      <button onClick={handlePasswordProtect} className="btn-primary w-full flex items-center justify-center gap-2">
        <Icon name="lock" size={14} /> Protect with Password
      </button>
      <button onClick={handleRemovePassword} className="btn-secondary w-full flex items-center justify-center gap-2">
        <Icon name="unlock" size={14} /> Remove Password
      </button>
    </div>
  );

  const renderConvertSection = () => (
    <div className="space-y-3">
      <h3 className="font-semibold text-lg mb-3 flex items-center gap-2"><Icon name="convert" size={18} className="text-navy-600" /> PDF Conversions</h3>
      <button onClick={handlePDFToText} className="btn-secondary w-full flex items-center justify-center gap-2">
        <Icon name="text" size={14} /> PDF → Text
      </button>
      <button onClick={handlePDFToDoc} className="btn-secondary w-full flex items-center justify-center gap-2">
        <Icon name="word" size={14} /> PDF → DOC
      </button>
      <button onClick={handlePDFToImages} className="btn-secondary w-full flex items-center justify-center gap-2">
        <Icon name="image" size={14} /> PDF → Images
      </button>
      <button onClick={handlePDFToPPT} className="btn-secondary w-full flex items-center justify-center gap-2">
        <Icon name="powerpoint" size={14} /> PDF → PowerPoint Slides
      </button>
      <hr className="my-3" />
      <button onClick={() => handleSavePDFAs(false)} className="btn-primary w-full flex items-center justify-center gap-2">
        <Icon name="save" size={14} /> Save As...
      </button>
      <button onClick={handleCompressPDF} className="btn-primary w-full flex items-center justify-center gap-2">
        <Icon name="compress" size={14} /> Compress PDF
      </button>
      <input
        type="text"
        placeholder="Rotate pages (optional, e.g., 1,3,5)"
        value={rotatePagesInput}
        onChange={(e) => setRotatePagesInput(e.target.value)}
        className="w-full px-3 py-2 border rounded"
      />
      <div className="grid grid-cols-3 gap-2 mt-3">
        <button onClick={() => handleRotatePDF(90)} className="btn-secondary flex items-center justify-center gap-1">
          <Icon name="rotateRight" size={14} /> 90°
        </button>
        <button onClick={() => handleRotatePDF(180)} className="btn-secondary flex items-center justify-center gap-1">
          <Icon name="rotateRight" size={14} /> 180°
        </button>
        <button onClick={() => handleRotatePDF(270)} className="btn-secondary flex items-center justify-center gap-1">
          <Icon name="rotateRight" size={14} /> 270°
        </button>
      </div>
    </div>
  );

  const renderMergeSection = () => (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg mb-3 flex items-center gap-2"><Icon name="merge" size={18} className="text-navy-600" /> Merge Multiple PDFs</h3>
      <p className="text-sm text-gray-600">Select multiple PDF files to merge into a single document.</p>
      <input
        ref={mergeFilesRef}
        type="file"
        accept=".pdf"
        multiple
        onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
        className="w-full px-3 py-2 border rounded"
      />
      {selectedFiles.length > 0 && (
        <div className="bg-gray-50 p-3 rounded max-h-32 overflow-y-auto">
          <p className="text-sm font-medium mb-2">Selected files ({selectedFiles.length}):</p>
          <ul className="text-sm space-y-1">
            {selectedFiles.map((file, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="text-gray-500">{idx + 1}.</span>
                <span className="truncate">{file.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button onClick={handleMergePDFs} className="btn-primary w-full flex items-center justify-center gap-2" disabled={selectedFiles.length < 2}>
        <Icon name="merge" size={14} /> Merge {selectedFiles.length} PDF{selectedFiles.length !== 1 ? 's' : ''}
      </button>
    </div>
  );

  const renderReorderSection = () => (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg mb-3 flex items-center gap-2"><Icon name="reorder" size={18} className="text-navy-600" /> Reorder PDF Pages</h3>
      <p className="text-sm text-gray-600">
        Enter the new page order as comma-separated numbers.
        <br />Example: "3,1,2,4" will put page 3 first, then page 1, etc.
      </p>
      <input
        type="text"
        placeholder="New page order (e.g., 3,1,2,4)"
        value={pageOrder}
        onChange={(e) => setPageOrder(e.target.value)}
        className="w-full px-3 py-2 border rounded"
      />
      <button onClick={handleReorderPages} className="btn-primary w-full flex items-center justify-center gap-2">
        <Icon name="reorder" size={14} /> Reorder Pages
      </button>
    </div>
  );

  const renderImagesSection = () => (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg mb-3 flex items-center gap-2"><Icon name="image" size={18} className="text-navy-600" /> Images ↔ PDF</h3>
      
      <div className="border rounded p-3 space-y-3">
        <h4 className="font-medium">PDF → Images</h4>
        <p className="text-sm text-gray-600">Convert each PDF page to an image file.</p>
        <button onClick={handlePDFToImages} className="btn-primary w-full flex items-center justify-center gap-2">
          <Icon name="export" size={14} /> Export PDF as Images
        </button>
      </div>
      
      <div className="border rounded p-3 space-y-3">
        <h4 className="font-medium">Images → PDF</h4>
        <p className="text-sm text-gray-600">Combine images into a single PDF document.</p>
        <input
          ref={imageFilesRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
          className="w-full px-3 py-2 border rounded"
        />
        {selectedFiles.length > 0 && (
          <p className="text-sm text-gray-600">{selectedFiles.length} image(s) selected</p>
        )}
        <button onClick={handleImagesToPDF} className="btn-primary w-full flex items-center justify-center gap-2" disabled={selectedFiles.length === 0}>
          <Icon name="download" size={14} /> Convert Images to PDF
        </button>
      </div>
    </div>
  );

  const renderDocumentsSection = () => (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg mb-3 flex items-center gap-2"><Icon name="document" size={18} className="text-navy-600" /> Documents ↔ PDF</h3>
      
      <div className="border rounded p-3 space-y-3">
        <h4 className="font-medium">DOC/DOCX → PDF</h4>
        <input
          type="file"
          accept=".doc,.docx"
          onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
          className="w-full px-3 py-2 border rounded"
        />
        <button onClick={handleDocToPDF} className="btn-primary w-full flex items-center justify-center gap-2">
          <Icon name="word" size={14} /> Convert Word to PDF
        </button>
      </div>
      
      <div className="border rounded p-3 space-y-3">
        <h4 className="font-medium">TXT → PDF</h4>
        <input
          type="file"
          accept=".txt"
          onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
          className="w-full px-3 py-2 border rounded"
        />
        <button onClick={handleTxtToPDF} className="btn-primary w-full flex items-center justify-center gap-2">
          <Icon name="text" size={14} /> Convert Text to PDF
        </button>
      </div>
      
      <div className="border rounded p-3 space-y-3">
        <h4 className="font-medium">PDF → DOC</h4>
        <p className="text-sm text-gray-600">Convert current PDF to Word document.</p>
        <button onClick={handlePDFToDoc} className="btn-primary w-full flex items-center justify-center gap-2">
          <Icon name="document" size={14} /> Export as DOC
        </button>
      </div>
    </div>
  );

  const renderExtractSection = () => (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg mb-3 flex items-center gap-2"><Icon name="export" size={18} className="text-navy-600" /> Extract & Export</h3>

      <div className="border rounded p-3 space-y-3">
        <h4 className="font-medium">Extract Selected Pages</h4>
        <input
          type="text"
          placeholder="Page numbers (e.g., 1,2,5)"
          value={extractPagesInput}
          onChange={(e) => setExtractPagesInput(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        />
        <button onClick={handleExtractPages} className="btn-primary w-full">
          Extract Pages to New PDF
        </button>
      </div>

      <div className="border rounded p-3 space-y-3">
        <h4 className="font-medium">Split to Single Pages</h4>
        <button onClick={handleSplitToSinglePages} className="btn-secondary w-full">
          Split into One-Page PDFs
        </button>
      </div>

      <div className="border rounded p-3 space-y-3">
        <h4 className="font-medium">Extract Tables → CSV</h4>
        <p className="text-sm text-gray-600">Best-effort extraction based on text layout.</p>
        <button onClick={handleExtractTables} className="btn-primary w-full">
          Extract Tables
        </button>
      </div>

      <div className="border rounded p-3 space-y-3">
        <h4 className="font-medium">Extract Embedded Fonts</h4>
        <button onClick={handleExtractFonts} className="btn-secondary w-full">
          Export Font List
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">PDF Power Tools</h2>
            <p className="text-sm opacity-90">{item?.name}</p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white hover:bg-opacity-20 rounded p-2">
            ✕
          </button>
        </div>

        {/* Navigation */}
        {activeSection !== 'main' && (
          <div className="p-3 border-b flex items-center gap-2">
            <button
              onClick={() => setActiveSection('main')}
              className="text-blue-600 hover:underline flex items-center gap-1"
            >
              ← Back to Menu
            </button>
          </div>
        )}

        {/* Message */}
        {message.text && (
          <div className={`mx-4 mt-4 p-3 rounded ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          )}
          
          {!loading && (
            <>
              {activeSection === 'main' && renderMainMenu()}
              {activeSection === 'forms' && renderFormsSection()}
              {activeSection === 'signature' && renderSignatureSection()}
              {activeSection === 'watermark' && renderWatermarkSection()}
              {activeSection === 'background' && renderBackgroundSection()}
              {activeSection === 'pages' && renderPagesSection()}
              {activeSection === 'merge' && renderMergeSection()}
              {activeSection === 'split' && renderSplitSection()}
              {activeSection === 'reorder' && renderReorderSection()}
              {activeSection === 'security' && renderSecuritySection()}
              {activeSection === 'convert' && renderConvertSection()}
              {activeSection === 'images' && renderImagesSection()}
              {activeSection === 'documents' && renderDocumentsSection()}
              {activeSection === 'extract' && renderExtractSection()}
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .pdf-tool-btn {
          @apply flex flex-col items-center gap-2 p-4 border-2 rounded-lg hover:border-blue-500 
                 hover:bg-blue-50 transition-all cursor-pointer;
        }
        .btn-primary {
          @apply bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition;
        }
        .btn-secondary {
          @apply bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition;
        }
        .btn-danger {
          @apply bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition;
        }
      `}</style>
    </div>
  );
}
