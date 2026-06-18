import React, { useState, useRef, useEffect } from 'react';
import { formatSize, formatDate, Icons } from '../utils/helpers';
import DocumentPowerTools from './DocumentPowerTools';

// Icon component for SVG rendering
const Icon = ({ name, size = 16, className = '' }) => {
  const icon = Icons[name];
  if (!icon) return null;
  const sizedIcon = icon.replace(/width="\d+"/, `width="${size}"`).replace(/height="\d+"/, `height="${size}"`);
  return (
    <span 
      className={`inline-flex items-center justify-center flex-shrink-0 ${className}`}
      dangerouslySetInnerHTML={{ __html: sizedIcon }}
    />
  );
};

// Comprehensive file type detection
const getFileTypeInfo = (item) => {
  const ext = item?.name?.split('.').pop()?.toLowerCase() || '';
  
  // Folders
  if (item?.type === 'folder') {
    return { category: 'folder', icon: 'folder', color: 'text-amber-500', bg: 'bg-amber-50', label: 'Folder', viewable: false };
  }
  
  // Documents
  if (['pdf'].includes(ext)) {
    return { category: 'pdf', icon: 'pdf', color: 'text-red-500', bg: 'bg-red-50', label: 'PDF Document', viewable: true };
  }
  if (['doc', 'docx'].includes(ext)) {
    return { category: 'word', icon: 'word', color: 'text-blue-600', bg: 'bg-blue-50', label: 'Word Document', viewable: true };
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return { category: 'excel', icon: 'excel', color: 'text-green-600', bg: 'bg-green-50', label: 'Excel Spreadsheet', viewable: true };
  }
  if (['ppt', 'pptx'].includes(ext)) {
    return { category: 'powerpoint', icon: 'powerpoint', color: 'text-orange-500', bg: 'bg-orange-50', label: 'PowerPoint Presentation', viewable: true };
  }
  
  // Text/Code
  if (['txt', 'log', 'ini', 'cfg', 'conf'].includes(ext)) {
    return { category: 'text', icon: 'text', color: 'text-gray-600', bg: 'bg-gray-100', label: 'Text File', viewable: true, editable: true };
  }
  if (['md', 'markdown'].includes(ext)) {
    return { category: 'markdown', icon: 'text', color: 'text-gray-700', bg: 'bg-gray-100', label: 'Markdown', viewable: true, editable: true };
  }
  if (['json'].includes(ext)) {
    return { category: 'code', icon: 'code', color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'JSON', viewable: true, editable: true };
  }
  if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
    return { category: 'code', icon: 'code', color: 'text-yellow-500', bg: 'bg-yellow-50', label: 'JavaScript', viewable: true, editable: true };
  }
  if (['html', 'htm'].includes(ext)) {
    return { category: 'code', icon: 'code', color: 'text-orange-600', bg: 'bg-orange-50', label: 'HTML', viewable: true, editable: true };
  }
  if (['css', 'scss', 'sass', 'less'].includes(ext)) {
    return { category: 'code', icon: 'code', color: 'text-blue-500', bg: 'bg-blue-50', label: 'CSS', viewable: true, editable: true };
  }
  if (['py'].includes(ext)) {
    return { category: 'code', icon: 'code', color: 'text-blue-600', bg: 'bg-blue-50', label: 'Python', viewable: true, editable: true };
  }
  if (['java', 'c', 'cpp', 'h', 'hpp', 'cs'].includes(ext)) {
    return { category: 'code', icon: 'code', color: 'text-purple-600', bg: 'bg-purple-50', label: 'Source Code', viewable: true, editable: true };
  }
  if (['xml', 'yaml', 'yml'].includes(ext)) {
    return { category: 'code', icon: 'code', color: 'text-green-600', bg: 'bg-green-50', label: 'Config File', viewable: true, editable: true };
  }
  
  // Images
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif'].includes(ext)) {
    return { category: 'image', icon: 'image', color: 'text-purple-500', bg: 'bg-purple-50', label: 'Image', viewable: true };
  }
  if (['svg'].includes(ext)) {
    return { category: 'image', icon: 'image', color: 'text-purple-600', bg: 'bg-purple-50', label: 'SVG Image', viewable: true };
  }
  if (['ico'].includes(ext)) {
    return { category: 'image', icon: 'image', color: 'text-purple-400', bg: 'bg-purple-50', label: 'Icon', viewable: true };
  }
  if (['psd'].includes(ext)) {
    return { category: 'image', icon: 'image', color: 'text-blue-500', bg: 'bg-blue-50', label: 'Photoshop', viewable: false };
  }
  if (['ai', 'eps'].includes(ext)) {
    return { category: 'image', icon: 'image', color: 'text-orange-500', bg: 'bg-orange-50', label: 'Illustrator', viewable: false };
  }
  
  // Videos
  if (['mp4', 'webm', 'ogg', 'ogv'].includes(ext)) {
    return { category: 'video', icon: 'video', color: 'text-pink-500', bg: 'bg-pink-50', label: 'Video', viewable: true, playable: true };
  }
  if (['avi', 'mov', 'mkv', 'wmv', 'flv', 'm4v', '3gp'].includes(ext)) {
    return { category: 'video', icon: 'video', color: 'text-pink-500', bg: 'bg-pink-50', label: 'Video', viewable: false, needsConversion: true };
  }
  
  // Audio
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(ext)) {
    return { category: 'audio', icon: 'music', color: 'text-indigo-500', bg: 'bg-indigo-50', label: 'Audio', viewable: true, playable: true };
  }
  
  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) {
    return { category: 'archive', icon: 'archive', color: 'text-amber-600', bg: 'bg-amber-50', label: 'Archive', viewable: false, extractable: true };
  }
  
  // Executables
  if (['exe', 'msi', 'bat', 'cmd', 'ps1', 'sh', 'bash'].includes(ext)) {
    return { category: 'executable', icon: 'terminal', color: 'text-gray-700', bg: 'bg-gray-100', label: 'Executable', viewable: false, executable: true };
  }
  if (['dll', 'so', 'dylib'].includes(ext)) {
    return { category: 'library', icon: 'box', color: 'text-gray-600', bg: 'bg-gray-100', label: 'Library', viewable: false };
  }
  if (['sys', 'drv'].includes(ext)) {
    return { category: 'system', icon: 'settings', color: 'text-gray-600', bg: 'bg-gray-100', label: 'System File', viewable: false };
  }
  
  // Binary/Data
  if (['bin', 'dat', 'db', 'sqlite', 'mdb'].includes(ext)) {
    return { category: 'binary', icon: 'database', color: 'text-gray-600', bg: 'bg-gray-100', label: 'Binary Data', viewable: false };
  }
  
  // Fonts
  if (['ttf', 'otf', 'woff', 'woff2', 'eot'].includes(ext)) {
    return { category: 'font', icon: 'type', color: 'text-gray-600', bg: 'bg-gray-100', label: 'Font', viewable: true };
  }
  
  // ISO/Disk Images
  if (['iso', 'img', 'dmg'].includes(ext)) {
    return { category: 'disk', icon: 'disc', color: 'text-gray-600', bg: 'bg-gray-100', label: 'Disk Image', viewable: false };
  }
  
  // Default
  return { category: 'file', icon: 'file', color: 'text-gray-500', bg: 'bg-gray-100', label: 'File', viewable: false };
};

// Sample content for demo
const getSampleContent = (item, fileInfo) => {
  if (item?.content) return item.content;
  
  switch (fileInfo.category) {
    case 'text':
    case 'markdown':
      return `# Sample ${item?.name || 'Document'}\n\nThis is sample text content for demonstration purposes.\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n\n## Features\n- Easy to read and edit\n- Supports markdown formatting\n- Automatic saving`;
    case 'code':
      if (item?.name?.endsWith('.json')) {
        return JSON.stringify({ name: item?.name, type: "sample", data: { key: "value" } }, null, 2);
      }
      return `// ${item?.name || 'Sample Code'}\nfunction example() {\n  console.log("Hello, World!");\n  return true;\n}\n\nexport default example;`;
    default:
      return null;
  }
};

// PDF Viewer Component - renders actual PDF using iframe/object
const PDFViewer = ({ item, zoomLevel, currentPage, setCurrentPage }) => {
  const [pdfError, setPdfError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedPdfUrl, setLoadedPdfUrl] = useState(null);
  const pdfUrl = item?.dataUrl || item?.preview || loadedPdfUrl;
  
  // Load PDF from backend if no dataUrl
  useEffect(() => {
    const loadPDF = async () => {
      if (!item?.dataUrl && !item?.preview && item?.id && !loadedPdfUrl) {
        try {
          setIsLoading(true);
          setPdfError(false);
          
          // Import documentApi dynamically
          const { documentOpsApi } = await import('../utils/documentApi');
          const blob = await downloadBlobForViewer(item.id);
          const dataUrl = URL.createObjectURL(blob);
          setLoadedPdfUrl(dataUrl);
          setIsLoading(false);
        } catch (err) {
          console.error('Failed to load PDF:', err);
          setPdfError(true);
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };
    
    loadPDF();
  }, [item?.id, item?.dataUrl, item?.preview, loadedPdfUrl]);
  
  // Handle PDF load
  const handlePdfLoad = () => {
    setIsLoading(false);
    setPdfError(false);
  };
  
  // Handle PDF error
  const handlePdfError = () => {
    setIsLoading(false);
    setPdfError(true);
  };
  
  // If we have a valid PDF URL (dataUrl), render it
  if (pdfUrl && !pdfError) {
    return (
      <div className="flex flex-col h-full min-h-[800px]">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-navy-200 border-t-navy-600 rounded-full animate-spin"></div>
              <p className="text-sm text-navy-600">Loading PDF Preview...</p>
            </div>
          </div>
        )}
        <iframe
          src={pdfUrl}
          className="w-full flex-1 border-0 rounded-lg bg-white"
          style={{ 
            minHeight: '800px',
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'top center'
          }}
          title={item?.name || 'PDF Document'}
          onLoad={handlePdfLoad}
          onError={handlePdfError}
        />
      </div>
    );
  }
  
  // Fallback for files without dataUrl or on error
  return (
    <div className="min-h-[800px] p-4">
      <div className="bg-white shadow-lg rounded-lg p-8 max-w-4xl mx-auto">
        <div className="text-center mb-6 pb-6 border-b border-gray-200">
          <Icon name="pdf" size={48} className="text-red-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900">{item?.name}</h2>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-800">
            <strong>PDF Preview Unavailable:</strong> {pdfError ? 'Failed to load PDF content. The file may be corrupted or inaccessible.' : 'Loading PDF content...'} 
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <button 
            onClick={async () => {
              if (item?.id && !loadedPdfUrl) {
                try {
                  setIsLoading(true);
                  setPdfError(false);
                  const { documentOpsApi } = await import('../utils/documentApi');
                  const blob = await downloadBlobForViewer(item.id);
                  const dataUrl = URL.createObjectURL(blob);
                  setLoadedPdfUrl(dataUrl);
                } catch (err) {
                  setPdfError(true);
                } finally {
                  setIsLoading(false);
                }
              }
            }}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Load Preview'}
          </button>
          <button 
            onClick={async () => {
              if (item?.id) {
                try {
                  const { documentOpsApi } = await import('../utils/documentApi');
                  const blob = await downloadBlobForViewer(item.id);
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = item.name;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (err) {
                  console.error('Download failed:', err);
                }
              }
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 flex items-center gap-2"
          >
            <Icon name="download" size={16} />
            Download PDF
          </button>
        </div>
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>File Info:</strong><br />
            Size: {formatSize(item?.size || 0)}<br />
            Modified: {formatDate(item?.date)}
          </p>
        </div>
      </div>
    </div>
  );
};

// Image Viewer Component with controls
const ImageViewer = ({ item, zoomLevel }) => {
  const [rotation, setRotation] = useState(0);
  const [filter, setFilter] = useState('none');
  
  const imageUrl = item?.preview || item?.dataUrl || `https://via.placeholder.com/800x600/E5E7EB/374151?text=${encodeURIComponent(item?.name || 'Image')}`;
  
  const filters = {
    none: '',
    grayscale: 'grayscale(100%)',
    sepia: 'sepia(100%)',
    invert: 'invert(100%)',
    brightness: 'brightness(150%)',
    contrast: 'contrast(150%)',
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[600px] p-4">
      <div className="flex items-center gap-2 mb-4 p-2 bg-white rounded-lg shadow-sm">
        <button onClick={() => setRotation(r => r - 90)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Rotate Left">
          <Icon name="rotateLeft" size={18} className="text-gray-600" />
        </button>
        <button onClick={() => setRotation(r => r + 90)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Rotate Right">
          <Icon name="rotateRight" size={18} className="text-gray-600" />
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1" />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
          <option value="none">No Filter</option>
          <option value="grayscale">Grayscale</option>
          <option value="sepia">Sepia</option>
          <option value="invert">Invert</option>
          <option value="brightness">Bright</option>
          <option value="contrast">High Contrast</option>
        </select>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow-lg">
        <img
          src={imageUrl}
          alt={item?.name}
          className="max-w-full h-auto rounded transition-all duration-300"
          style={{ 
            transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
            filter: filters[filter],
            maxHeight: '70vh'
          }}
          onError={(e) => {
            e.target.src = `https://via.placeholder.com/400x300/E5E7EB/374151?text=Image+Not+Available`;
          }}
        />
      </div>
      
      <p className="text-sm text-gray-500 mt-4">{item?.name} - {formatSize(item?.size || 0)}</p>
    </div>
  );
};

// Video Player Component with advanced controls
const VideoPlayer = ({ item }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  
  const videoUrl = item?.dataUrl || item?.preview || null;
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };
  
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };
  
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };
  
  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };
  
  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
    }
    setIsMuted(vol === 0);
  };
  
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };
  
  const changePlaybackRate = (rate) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };
  
  const skipForward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(duration, currentTime + 10);
    }
  };
  
  const skipBackward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, currentTime - 10);
    }
  };
  
  if (!videoUrl) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] p-8">
        <div className="w-24 h-24 bg-pink-100 rounded-full flex items-center justify-center mb-4">
          <Icon name="video" size={48} className="text-pink-500" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{item?.name}</h3>
        <p className="text-gray-500 mb-4">Video file - {formatSize(item?.size || 0)}</p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md">
          <p className="text-sm text-blue-800">
            <strong>Video Preview:</strong> Upload an actual video file (MP4, WebM, OGG) to see the full player with playback controls.
          </p>
        </div>
        <div className="mt-6 flex gap-3">
          <button className="px-4 py-2 bg-pink-600 text-white rounded-lg text-sm font-medium hover:bg-pink-700 flex items-center gap-2">
            <Icon name="download" size={16} />
            Download Video
          </button>
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center gap-2">
            <Icon name="share" size={16} />
            Share
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] p-4 bg-black">
      <div 
        className="relative w-full max-w-4xl"
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(isPlaying ? false : true)}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full rounded-lg"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          onClick={togglePlay}
        />
        
        {/* Video Controls Overlay */}
        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="mb-3">
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-white/30 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #ec4899 0%, #ec4899 ${(currentTime / duration) * 100}%, rgba(255,255,255,0.3) ${(currentTime / duration) * 100}%, rgba(255,255,255,0.3) 100%)`
              }}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={togglePlay} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <Icon name={isPlaying ? 'pause' : 'play'} size={24} className="text-white" />
              </button>
              <button onClick={skipBackward} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <Icon name="skipBack" size={20} className="text-white" />
              </button>
              <button onClick={skipForward} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <Icon name="skipForward" size={20} className="text-white" />
              </button>
              <span className="text-white text-sm ml-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <Icon name={isMuted ? 'volumeX' : 'volume'} size={20} className="text-white" />
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-white/30 rounded-full appearance-none cursor-pointer"
              />
              <select 
                value={playbackRate}
                onChange={(e) => changePlaybackRate(parseFloat(e.target.value))}
                className="bg-transparent text-white text-sm border border-white/30 rounded px-2 py-1"
              >
                <option value="0.5" className="text-black">0.5x</option>
                <option value="0.75" className="text-black">0.75x</option>
                <option value="1" className="text-black">1x</option>
                <option value="1.25" className="text-black">1.25x</option>
                <option value="1.5" className="text-black">1.5x</option>
                <option value="2" className="text-black">2x</option>
              </select>
              <button className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <Icon name="maximize" size={20} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <p className="text-white/70 text-sm mt-4">{item?.name}</p>
    </div>
  );
};

// Audio Player Component
const AudioPlayer = ({ item }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  
  const audioUrl = item?.dataUrl || item?.preview || null;
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="w-32 h-32 bg-gradient-to-br from-indigo-400 to-purple-600 rounded-full flex items-center justify-center mb-6 shadow-lg">
        <Icon name="music" size={64} className="text-white" />
      </div>
      
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{item?.name}</h3>
      <p className="text-gray-500 mb-6">{formatSize(item?.size || 0)}</p>
      
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
          onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
          onEnded={() => setIsPlaying(false)}
        />
      )}
      
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6">
        <div className="mb-4">
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={(e) => {
              const time = parseFloat(e.target.value);
              if (audioRef.current) audioRef.current.currentTime = time;
              setCurrentTime(time);
            }}
            className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-center gap-4">
          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <Icon name="skipBack" size={24} className="text-gray-600" />
          </button>
          <button onClick={togglePlay} className="p-4 bg-indigo-600 hover:bg-indigo-700 rounded-full transition-colors">
            <Icon name={isPlaying ? 'pause' : 'play'} size={28} className="text-white" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <Icon name="skipForward" size={24} className="text-gray-600" />
          </button>
        </div>
        
        <div className="flex items-center gap-2 mt-4 justify-center">
          <Icon name="volume" size={16} className="text-gray-400" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => {
              const vol = parseFloat(e.target.value);
              setVolume(vol);
              if (audioRef.current) audioRef.current.volume = vol;
            }}
            className="w-24 h-1 bg-gray-200 rounded-full appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};

// Code/Text Viewer
const CodeViewer = ({ item, content, isEditMode, setContent, zoomLevel }) => {
  return (
    <div className="min-h-[800px] p-4" style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}>
      <div className="bg-gray-900 rounded-lg shadow-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
          </div>
          <span className="text-gray-400 text-sm ml-2">{item?.name}</span>
        </div>
        {isEditMode ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full min-h-[700px] p-4 font-mono text-sm bg-gray-900 text-green-400 outline-none resize-none"
            spellCheck="false"
          />
        ) : (
          <pre className="p-4 font-mono text-sm text-green-400 overflow-x-auto">
            <code>{content || 'No content available'}</code>
          </pre>
        )}
      </div>
    </div>
  );
};

// Document Viewer for Word/PPT/Excel
const DocumentViewer = ({ item, fileInfo }) => {
  return (
    <div className="min-h-[800px] p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
        <div className="text-center mb-6 pb-6 border-b border-gray-200">
          <div className={`w-20 h-20 ${fileInfo.bg} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
            <Icon name={fileInfo.icon} size={40} className={fileInfo.color} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">{item?.name}</h2>
          <p className="text-sm text-gray-500 mt-1">{fileInfo.label} - {formatSize(item?.size || 0)}</p>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Document Preview:</strong> In a production environment, this would display using Microsoft Office Online Viewer, Google Docs Viewer, or server-side conversion.
          </p>
        </div>
        
        <div className="prose max-w-none">
          <p className="text-gray-600">{item?.content || 'Document content preview would appear here.'}</p>
        </div>
        
        <div className="mt-8 flex gap-3 justify-center">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
            <Icon name="externalLink" size={16} />
            Open in {fileInfo.label.split(' ')[0]}
          </button>
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center gap-2">
            <Icon name="download" size={16} />
            Download
          </button>
        </div>
      </div>
    </div>
  );
};

// Binary/Archive/Executable Viewer
const BinaryViewer = ({ item, fileInfo }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] p-8">
      <div className={`w-24 h-24 ${fileInfo.bg} rounded-full flex items-center justify-center mb-4`}>
        <Icon name={fileInfo.icon} size={48} className={fileInfo.color} />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{item?.name}</h3>
      <p className="text-gray-500 mb-2">{fileInfo.label} - {formatSize(item?.size || 0)}</p>
      <p className="text-sm text-gray-400 mb-6">Modified: {formatDate(item?.date)}</p>
      
      <div className="bg-gray-100 rounded-lg p-6 max-w-md text-center">
        {fileInfo.extractable ? (
          <>
            <p className="text-sm text-gray-600 mb-4">This archive contains files that can be extracted.</p>
            <button className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 flex items-center gap-2 mx-auto">
              <Icon name="folderOpen" size={16} />
              Extract Archive
            </button>
          </>
        ) : fileInfo.executable ? (
          <>
            <p className="text-sm text-gray-600 mb-4">This is an executable file. It cannot be previewed for security reasons.</p>
            <button className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 flex items-center gap-2 mx-auto">
              <Icon name="download" size={16} />
              Download
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4">This file type cannot be previewed in the browser.</p>
            <button className="px-4 py-2 bg-navy-600 text-white rounded-lg text-sm font-medium hover:bg-navy-700 flex items-center gap-2 mx-auto">
              <Icon name="download" size={16} />
              Download File
            </button>
          </>
        )}
      </div>
      
      <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4 w-full max-w-md">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">File Details</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Type:</span>
            <span className="text-gray-900">{fileInfo.label}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Size:</span>
            <span className="text-gray-900">{formatSize(item?.size || 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Extension:</span>
            <span className="text-gray-900">.{item?.name?.split('.').pop()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main FileViewerModal Component
export default function FileViewerModal({
  isOpen,
  onClose,
  item,
  onSave,
  onDownload,
  onShare,
  onPrint
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [editContent, setEditContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showPdfTools, setShowPdfTools] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const fileInfo = getFileTypeInfo(item);
  const content = getSampleContent(item, fileInfo);

  useEffect(() => {
    if (content) {
      setEditContent(content);
    }
  }, [content]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === 'Escape') {
        if (showSearch) setShowSearch(false);
        else if (showPdfTools) setShowPdfTools(false);
        else onClose();
      }
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showSearch, showPdfTools, onClose]);

  if (!isOpen || !item) return null;

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 25, 50));
  const handleZoomReset = () => setZoomLevel(100);

  const handleSave = () => {
    onSave?.(item.id, editContent);
    setIsEditMode(false);
  };

  const renderContent = () => {
    switch (fileInfo.category) {
      case 'pdf':
        return <PDFViewer item={item} zoomLevel={zoomLevel} currentPage={currentPage} setCurrentPage={setCurrentPage} />;
      case 'image':
        return <ImageViewer item={item} zoomLevel={zoomLevel} />;
      case 'video':
        return <VideoPlayer item={item} />;
      case 'audio':
        return <AudioPlayer item={item} />;
      case 'code':
      case 'text':
      case 'markdown':
        return <CodeViewer item={item} content={editContent} isEditMode={isEditMode} setContent={setEditContent} zoomLevel={zoomLevel} />;
      case 'word':
      case 'powerpoint':
      case 'excel':
        return <DocumentViewer item={item} fileInfo={fileInfo} />;
      default:
        return <BinaryViewer item={item} fileInfo={fileInfo} />;
    }
  };

  return (
    <div className={`fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 ${isFullscreen ? 'p-0' : ''}`}>
      <div className={`bg-white rounded-xl shadow-strong flex flex-col animate-scale-in ${isFullscreen ? 'w-full h-full rounded-none' : 'w-[95%] h-[95%] max-w-7xl'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-navy-100 bg-navy-50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${fileInfo.bg} flex items-center justify-center`}>
              <Icon name={fileInfo.icon} size={20} className={fileInfo.color} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-navy-900">{item.name}</h3>
              <p className="text-sm text-navy-500">{fileInfo.label} - {formatSize(item.size)} - {formatDate(item.date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 hover:bg-navy-100 rounded-lg transition-colors" title="Toggle Fullscreen">
              <Icon name={isFullscreen ? 'minimize' : 'maximize'} size={18} className="text-navy-600" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-navy-100 rounded-lg transition-colors" title="Close">
              <Icon name="close" size={18} className="text-navy-600" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-navy-100 bg-white flex-wrap">
          {fileInfo.editable && (
            <>
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${isEditMode ? 'bg-navy-900 text-white' : 'bg-navy-100 hover:bg-navy-200 text-navy-700'}`}
              >
                <Icon name={isEditMode ? 'eye' : 'edit'} size={14} />
                {isEditMode ? 'View' : 'Edit'}
              </button>
              <div className="h-6 w-px bg-navy-200"></div>
            </>
          )}

          {fileInfo.viewable && (
            <>
              <button onClick={() => setShowSearch(true)} className="px-3 py-2 rounded-lg text-sm bg-navy-100 hover:bg-navy-200 text-navy-700 flex items-center gap-1.5 transition-colors">
                <Icon name="search" size={14} />
                Find
              </button>
              <div className="h-6 w-px bg-navy-200"></div>
              <button onClick={handleZoomOut} className="p-2 rounded-lg text-sm bg-navy-100 hover:bg-navy-200 text-navy-700 transition-colors">
                <Icon name="zoomOut" size={14} />
              </button>
              <span className="px-2 text-sm font-medium text-navy-700">{zoomLevel}%</span>
              <button onClick={handleZoomIn} className="p-2 rounded-lg text-sm bg-navy-100 hover:bg-navy-200 text-navy-700 transition-colors">
                <Icon name="zoomIn" size={14} />
              </button>
              <button onClick={handleZoomReset} className="px-3 py-2 rounded-lg text-sm bg-navy-100 hover:bg-navy-200 text-navy-700 transition-colors">
                Reset
              </button>
              <div className="h-6 w-px bg-navy-200"></div>
            </>
          )}

          {isEditMode && (
            <button onClick={handleSave} className="px-3 py-2 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-700 font-medium flex items-center gap-1.5 transition-colors">
              <Icon name="save" size={14} />
              Save
            </button>
          )}

          <button onClick={() => onDownload?.(item.id)} className="px-3 py-2 rounded-lg text-sm bg-navy-100 hover:bg-navy-200 text-navy-700 flex items-center gap-1.5 transition-colors">
            <Icon name="download" size={14} />
            Download
          </button>

          {fileInfo.category !== 'video' && fileInfo.category !== 'audio' && (
            <button onClick={() => onPrint?.()} className="px-3 py-2 rounded-lg text-sm bg-navy-100 hover:bg-navy-200 text-navy-700 flex items-center gap-1.5 transition-colors">
              <Icon name="print" size={14} />
              Print
            </button>
          )}

          <button onClick={() => onShare?.()} className="px-3 py-2 rounded-lg text-sm bg-navy-100 hover:bg-navy-200 text-navy-700 flex items-center gap-1.5 transition-colors">
            <Icon name="share" size={14} />
            Share
          </button>

          {fileInfo.category === 'pdf' && (
            <button 
              onClick={() => setShowPdfTools(true)} 
              className="px-3 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-navy-700 to-sky-600 text-white hover:from-navy-800 hover:to-sky-700 flex items-center gap-1.5 transition-colors"
            >
              <Icon name="zap" size={14} />
              PDF Power Tools
            </button>
          )}

          <div className="flex-1"></div>

          <button
            onClick={() => setShowRightPanel(!showRightPanel)}
            className="px-3 py-2 rounded-lg text-sm bg-navy-100 hover:bg-navy-200 text-navy-700 flex items-center gap-1.5 transition-colors"
          >
            <Icon name={showRightPanel ? 'chevronRight' : 'chevronLeft'} size={14} />
            {showRightPanel ? 'Hide' : 'Info'}
          </button>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="px-4 py-2 bg-navy-50 border-b border-navy-100 flex items-center gap-2">
            <div className="flex-1 relative">
              <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search in document..."
                className="w-full pl-9 pr-3 py-2 border border-navy-200 rounded-lg text-sm focus:ring-2 focus:ring-navy-400 focus:border-navy-400 outline-none"
                autoFocus
              />
            </div>
            <button onClick={() => setShowSearch(false)} className="p-2 bg-navy-100 hover:bg-navy-200 rounded-lg transition-colors">
              <Icon name="close" size={14} className="text-navy-600" />
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-auto bg-navy-100">
            {renderContent()}
          </div>

          {/* Right Panel */}
          {showRightPanel && (
            <div className="w-72 border-l border-navy-100 bg-white flex flex-col">
              <div className="flex border-b border-navy-100">
                <button
                  onClick={() => setActiveTab('info')}
                  className={`flex-1 px-3 py-3 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'info' ? 'bg-navy-50 text-navy-900 border-b-2 border-navy-900' : 'text-navy-600 hover:bg-navy-50'}`}
                >
                  <Icon name="info" size={14} />
                  Info
                </button>
                <button
                  onClick={() => setActiveTab('actions')}
                  className={`flex-1 px-3 py-3 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'actions' ? 'bg-navy-50 text-navy-900 border-b-2 border-navy-900' : 'text-navy-600 hover:bg-navy-50'}`}
                >
                  <Icon name="settings" size={14} />
                  Actions
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {activeTab === 'info' && (
                  <div className="space-y-4">
                    <div className={`p-4 ${fileInfo.bg} rounded-lg text-center`}>
                      <Icon name={fileInfo.icon} size={48} className={`${fileInfo.color} mx-auto mb-2`} />
                      <p className={`text-sm font-medium ${fileInfo.color}`}>{fileInfo.label}</p>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs font-medium text-navy-500">File Name</span>
                        <p className="text-sm text-navy-900 mt-1 break-words">{item.name}</p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-navy-500">Size</span>
                        <p className="text-sm text-navy-900 mt-1">{formatSize(item.size || 0)}</p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-navy-500">Type</span>
                        <p className="text-sm text-navy-900 mt-1">{fileInfo.label}</p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-navy-500">Extension</span>
                        <p className="text-sm text-navy-900 mt-1">.{item.name?.split('.').pop()}</p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-navy-500">Modified</span>
                        <p className="text-sm text-navy-900 mt-1">{formatDate(item.date)}</p>
                      </div>
                      {item.category && (
                        <div>
                          <span className="text-xs font-medium text-navy-500">Category</span>
                          <p className="text-sm text-navy-900 mt-1">{item.category}</p>
                        </div>
                      )}
                      {item.tags && item.tags.length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-navy-500">Tags</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.tags.map(tag => (
                              <span key={tag} className="px-2 py-1 bg-navy-100 text-navy-700 rounded text-xs">{tag}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'actions' && (
                  <div className="space-y-3">
                    <button onClick={() => onDownload?.(item.id)} className="w-full px-4 py-2.5 bg-navy-100 hover:bg-navy-200 text-navy-700 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                      <Icon name="download" size={16} />
                      Download
                    </button>
                    <button onClick={() => onShare?.()} className="w-full px-4 py-2.5 bg-navy-100 hover:bg-navy-200 text-navy-700 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                      <Icon name="share" size={16} />
                      Share
                    </button>
                    {fileInfo.category !== 'video' && fileInfo.category !== 'audio' && (
                      <button onClick={() => onPrint?.()} className="w-full px-4 py-2.5 bg-navy-100 hover:bg-navy-200 text-navy-700 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                        <Icon name="print" size={16} />
                        Print
                      </button>
                    )}
                    {fileInfo.extractable && (
                      <button className="w-full px-4 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                        <Icon name="folderOpen" size={16} />
                        Extract Archive
                      </button>
                    )}
                    {fileInfo.category === 'pdf' && (
                      <button onClick={() => setShowPdfTools(true)} className="w-full px-4 py-2.5 bg-gradient-to-r from-navy-700 to-sky-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors hover:from-navy-800 hover:to-sky-700">
                        <Icon name="zap" size={16} />
                        PDF Power Tools
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Toolbar for PDF */}
        {fileInfo.category === 'pdf' && (
          <div className="flex items-center justify-center gap-4 px-4 py-3 border-t border-navy-100 bg-navy-50">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-lg text-sm bg-white border border-navy-200 hover:bg-navy-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <Icon name="chevronLeft" size={14} />
              Previous
            </button>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={currentPage}
                onChange={(e) => setCurrentPage(Math.max(1, Math.min(item?.pageCount || 5, parseInt(e.target.value) || 1)))}
                className="w-16 px-2 py-1.5 border border-navy-200 rounded-lg text-center text-sm focus:ring-2 focus:ring-navy-400 focus:border-navy-400 outline-none"
              />
              <span className="text-sm text-navy-600">of {item?.pageCount || 5}</span>
            </div>
            <button
              onClick={() => setCurrentPage(Math.min(item?.pageCount || 5, currentPage + 1))}
              disabled={currentPage === (item?.pageCount || 5)}
              className="px-4 py-2 rounded-lg text-sm bg-white border border-navy-200 hover:bg-navy-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              Next
              <Icon name="chevronRight" size={14} />
            </button>
          </div>
        )}
      </div>

      {/* PDF Power Tools Modal */}
      {showPdfTools && fileInfo.category === 'pdf' && (
        <DocumentPowerTools item={item} onClose={() => setShowPdfTools(false)} />
      )}
    </div>
  );
}
