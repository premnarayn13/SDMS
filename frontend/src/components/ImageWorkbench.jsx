import React, { useEffect, useMemo, useState } from 'react';
import {
  extractImageMetadata,
  transformImage,
  dataUrlToBlob,
  convertImageFormat,
  compressImage,
  removeImageMetadata,
  imageToPdfBlob,
  imageToTextOcr
} from '../utils/imageTools';

export default function ImageWorkbench({ item, src, zoomLevel = 100, onCreateDerivedFile }) {
  const [workingSrc, setWorkingSrc] = useState(src || '');
  const [metadata, setMetadata] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [error, setError] = useState('');

  const [rotate, setRotate] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [grayscale, setGrayscale] = useState(false);
  const [quality, setQuality] = useState(75);
  const [resizeWidth, setResizeWidth] = useState('');
  const [resizeHeight, setResizeHeight] = useState('');
  const [cropX, setCropX] = useState('0');
  const [cropY, setCropY] = useState('0');
  const [cropW, setCropW] = useState('');
  const [cropH, setCropH] = useState('');

  useEffect(() => {
    setWorkingSrc(src || '');
  }, [src]);

  useEffect(() => {
    if (!workingSrc) return;
    let cancelled = false;
    extractImageMetadata(workingSrc, item || {})
      .then((data) => {
        if (cancelled) return;
        setMetadata(data);
        if (!resizeWidth) setResizeWidth(String(data.width || ''));
        if (!resizeHeight) setResizeHeight(String(data.height || ''));
        if (!cropW) setCropW(String(data.width || ''));
        if (!cropH) setCropH(String(data.height || ''));
      })
      .catch(() => {
        if (!cancelled) setMetadata(null);
      });

    return () => {
      cancelled = true;
    };
  }, [workingSrc]);

  const imageStyle = useMemo(() => ({
    transform: `scale(${zoomLevel / 100}) rotate(${rotate}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
    filter: `brightness(${brightness}%) contrast(${contrast}%) ${grayscale ? 'grayscale(100%)' : ''}`,
    transition: 'all 0.2s ease'
  }), [zoomLevel, rotate, flipH, flipV, brightness, contrast, grayscale]);

  const deriveName = (suffix, ext = null) => {
    const name = item?.name || 'image.png';
    const match = name.match(/\.[^.]+$/);
    const base = match ? name.slice(0, -match[0].length) : name;
    const finalExt = ext || (match ? match[0] : '.png');
    return `${base}${suffix}${finalExt.startsWith('.') ? finalExt : `.${finalExt}`}`;
  };

  const runTransform = async (options, outputName) => {
    if (!workingSrc) return;
    setBusy(true);
    setError('');
    try {
      const transformed = await transformImage(workingSrc, options);
      setWorkingSrc(transformed);
      const blob = await dataUrlToBlob(transformed);
      if (onCreateDerivedFile) {
        await onCreateDerivedFile(outputName, blob);
      }
    } catch (err) {
      setError(err?.message || 'Image operation failed');
    } finally {
      setBusy(false);
    }
  };

  const applyCropResizeAdjust = async () => {
    const crop = {
      x: Number(cropX || 0),
      y: Number(cropY || 0),
      width: Number(cropW || metadata?.width || 0),
      height: Number(cropH || metadata?.height || 0)
    };
    const resize = {
      width: Number(resizeWidth || crop.width),
      height: Number(resizeHeight || crop.height)
    };

    await runTransform({
      rotate,
      flipH,
      flipV,
      brightness,
      contrast,
      grayscale,
      crop,
      resize,
      format: 'png'
    }, deriveName('_edited', '.png'));
  };

  const handleConvert = async (targetExt) => {
    if (!workingSrc) return;
    setBusy(true);
    setError('');
    try {
      const converted = await convertImageFormat(workingSrc, targetExt, quality / 100);
      const blob = await dataUrlToBlob(converted);
      setWorkingSrc(converted);
      await onCreateDerivedFile?.(deriveName(`_${targetExt}`, `.${targetExt}`), blob);
    } catch (err) {
      setError(err?.message || 'Conversion failed');
    } finally {
      setBusy(false);
    }
  };

  const handleCompress = async () => {
    if (!workingSrc) return;
    setBusy(true);
    setError('');
    try {
      const compressed = await compressImage(workingSrc, quality / 100);
      const blob = await dataUrlToBlob(compressed);
      setWorkingSrc(compressed);
      await onCreateDerivedFile?.(deriveName('_compressed', '.jpg'), blob);
    } catch (err) {
      setError(err?.message || 'Compression failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMetadata = async () => {
    if (!workingSrc) return;
    setBusy(true);
    setError('');
    try {
      const cleaned = await removeImageMetadata(workingSrc, 'png');
      const blob = await dataUrlToBlob(cleaned);
      setWorkingSrc(cleaned);
      await onCreateDerivedFile?.(deriveName('_clean', '.png'), blob);
    } catch (err) {
      setError(err?.message || 'Metadata removal failed');
    } finally {
      setBusy(false);
    }
  };

  const handleImageToPdf = async () => {
    if (!workingSrc) return;
    setBusy(true);
    setError('');
    try {
      const pdfBlob = await imageToPdfBlob(workingSrc, deriveName('', '.pdf'));
      await onCreateDerivedFile?.(deriveName('', '.pdf'), pdfBlob);
    } catch (err) {
      setError(err?.message || 'Image to PDF failed');
    } finally {
      setBusy(false);
    }
  };

  const handleImageToText = async () => {
    if (!workingSrc) return;
    setBusy(true);
    setError('');
    try {
      const text = await imageToTextOcr(workingSrc);
      setOcrText(text || 'No text detected');
      const blob = new Blob([text || ''], { type: 'text/plain;charset=utf-8' });
      await onCreateDerivedFile?.(deriveName('_ocr', '.txt'), blob);
    } catch (err) {
      setError(err?.message || 'OCR failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
      <div className="bg-white rounded-lg p-4 shadow">
        <div className="flex items-center gap-2 mb-3 text-sm text-slate-700">
          <span className="font-semibold">Image Workspace</span>
          {busy && <span className="text-blue-600">Processing...</span>}
          {error && <span className="text-rose-600">{error}</span>}
        </div>
        <div className="overflow-auto bg-slate-100 rounded-lg p-4 min-h-[420px] flex items-center justify-center">
          {workingSrc ? (
            <img src={workingSrc} alt={item?.name || 'image'} className="max-w-full h-auto" style={imageStyle} />
          ) : (
            <p className="text-sm text-slate-500">Preview unavailable</p>
          )}
        </div>
        {ocrText && (
          <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-xs font-semibold text-slate-600 mb-1">OCR Text</p>
            <pre className="text-xs whitespace-pre-wrap text-slate-700">{ocrText}</pre>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg p-4 shadow space-y-3 text-xs">
        <h4 className="text-sm font-semibold text-slate-800">Image Operations</h4>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setRotate((v) => v - 90)} className="px-2 py-1.5 bg-slate-100 rounded">Rotate Left</button>
          <button onClick={() => setRotate((v) => v + 90)} className="px-2 py-1.5 bg-slate-100 rounded">Rotate Right</button>
          <button onClick={() => setFlipH((v) => !v)} className="px-2 py-1.5 bg-slate-100 rounded">Flip H</button>
          <button onClick={() => setFlipV((v) => !v)} className="px-2 py-1.5 bg-slate-100 rounded">Flip V</button>
        </div>

        <div>
          <label className="block mb-1">Brightness {brightness}%</label>
          <input type="range" min="0" max="200" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-full" />
        </div>
        <div>
          <label className="block mb-1">Contrast {contrast}%</label>
          <input type="range" min="0" max="200" value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="w-full" />
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={grayscale} onChange={(e) => setGrayscale(e.target.checked)} />
          Convert to grayscale
        </label>

        <div className="grid grid-cols-2 gap-2">
          <input value={resizeWidth} onChange={(e) => setResizeWidth(e.target.value)} className="border rounded px-2 py-1" placeholder="Resize W" />
          <input value={resizeHeight} onChange={(e) => setResizeHeight(e.target.value)} className="border rounded px-2 py-1" placeholder="Resize H" />
          <input value={cropX} onChange={(e) => setCropX(e.target.value)} className="border rounded px-2 py-1" placeholder="Crop X" />
          <input value={cropY} onChange={(e) => setCropY(e.target.value)} className="border rounded px-2 py-1" placeholder="Crop Y" />
          <input value={cropW} onChange={(e) => setCropW(e.target.value)} className="border rounded px-2 py-1" placeholder="Crop W" />
          <input value={cropH} onChange={(e) => setCropH(e.target.value)} className="border rounded px-2 py-1" placeholder="Crop H" />
        </div>

        <button onClick={applyCropResizeAdjust} className="w-full px-3 py-2 bg-blue-600 text-white rounded">Apply Crop/Resize/Adjust</button>

        <div>
          <label className="block mb-1">Compression {quality}%</label>
          <input type="range" min="20" max="100" value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleCompress} className="px-2 py-1.5 bg-slate-100 rounded">Compress</button>
          <button onClick={handleRemoveMetadata} className="px-2 py-1.5 bg-slate-100 rounded">Remove Metadata</button>
          <button onClick={() => handleConvert('png')} className="px-2 py-1.5 bg-slate-100 rounded">To PNG</button>
          <button onClick={() => handleConvert('jpg')} className="px-2 py-1.5 bg-slate-100 rounded">To JPG</button>
          <button onClick={handleImageToPdf} className="px-2 py-1.5 bg-slate-100 rounded">Image to PDF</button>
          <button onClick={handleImageToText} className="px-2 py-1.5 bg-slate-100 rounded">Image to TXT (OCR)</button>
        </div>

        <div className="border rounded p-2 bg-slate-50">
          <p className="font-semibold text-slate-700 mb-1">Metadata</p>
          <p>Resolution: {metadata?.resolution || 'Unknown'}</p>
          <p>Camera: {metadata?.camera || 'Unknown'}</p>
          <p>Creation date: {metadata?.createdAt || 'Unknown'}</p>
          <p>ISO: {metadata?.iso || '-'}</p>
          <p>Aperture: {metadata?.aperture || '-'}</p>
          <p>Shutter: {metadata?.shutter || '-'}</p>
          <p>Focal: {metadata?.focalLength || '-'}</p>
        </div>
      </div>
    </div>
  );
}
