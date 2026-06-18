import React, { useState, useEffect, useRef } from 'react';
import { getVersion, compareVersions, formatVersionDate } from '../utils/versionControl';
import { createSideBySideDiff, getDiffStats, computeWordDiff } from '../utils/textDiff';

export default function VersionCompareModal({
  fileId,
  versionId1,
  versionId2,
  onClose,
  isOpen = true
}) {
  const [version1, setVersion1] = useState(null);
  const [version2, setVersion2] = useState(null);
  const [diffData, setDiffData] = useState(null);
  const [diffStats, setDiffStats] = useState(null);
  const [viewMode, setViewMode] = useState('side-by-side'); // 'side-by-side', 'unified', 'inline'
  const [showUnchanged, setShowUnchanged] = useState(true);
  const [syncScroll, setSyncScroll] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatch, setCurrentMatch] = useState(0);
  const [matches, setMatches] = useState([]);
  
  const leftPanelRef = useRef(null);
  const rightPanelRef = useRef(null);

  useEffect(() => {
    if (fileId && versionId1 && versionId2 && isOpen) {
      loadComparison();
    }
  }, [fileId, versionId1, versionId2, isOpen]);

  const loadComparison = () => {
    const v1 = getVersion(fileId, versionId1);
    const v2 = getVersion(fileId, versionId2);
    
    if (v1 && v2) {
      setVersion1(v1);
      setVersion2(v2);
      
      const content1 = typeof v1.content === 'string' ? v1.content : '';
      const content2 = typeof v2.content === 'string' ? v2.content : '';
      
      const sideBySide = createSideBySideDiff(content1, content2);
      const stats = getDiffStats(content1, content2);
      
      setDiffData(sideBySide);
      setDiffStats(stats);
    }
  };

  const handleScroll = (e, source) => {
    if (!syncScroll) return;
    
    const scrollTop = e.target.scrollTop;
    const scrollLeft = e.target.scrollLeft;
    
    if (source === 'left' && rightPanelRef.current) {
      rightPanelRef.current.scrollTop = scrollTop;
      rightPanelRef.current.scrollLeft = scrollLeft;
    } else if (source === 'right' && leftPanelRef.current) {
      leftPanelRef.current.scrollTop = scrollTop;
      leftPanelRef.current.scrollLeft = scrollLeft;
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query || !diffData) {
      setMatches([]);
      setCurrentMatch(0);
      return;
    }

    const foundMatches = [];
    const lowerQuery = query.toLowerCase();

    diffData.leftLines.forEach((line, idx) => {
      if (line.content.toLowerCase().includes(lowerQuery)) {
        foundMatches.push({ side: 'left', index: idx });
      }
    });
    diffData.rightLines.forEach((line, idx) => {
      if (line.content.toLowerCase().includes(lowerQuery)) {
        foundMatches.push({ side: 'right', index: idx });
      }
    });

    setMatches(foundMatches);
    setCurrentMatch(foundMatches.length > 0 ? 0 : -1);
  };

  const navigateMatch = (direction) => {
    if (matches.length === 0) return;
    
    let newIndex = currentMatch + direction;
    if (newIndex < 0) newIndex = matches.length - 1;
    if (newIndex >= matches.length) newIndex = 0;
    
    setCurrentMatch(newIndex);
  };

  const getLineClass = (type) => {
    switch (type) {
      case 'added':
        return 'bg-green-100 border-l-4 border-green-500';
      case 'removed':
        return 'bg-red-100 border-l-4 border-red-500';
      case 'empty':
        return 'bg-gray-50';
      default:
        return '';
    }
  };

  const highlightText = (text, query) => {
    if (!query) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={i} className="bg-yellow-300 px-0.5 rounded">{part}</mark>
        : part
    );
  };

  const renderUnifiedView = () => {
    if (!diffData) return null;
    
    const unifiedLines = [];
    let leftIdx = 0;
    let rightIdx = 0;

    while (leftIdx < diffData.leftLines.length || rightIdx < diffData.rightLines.length) {
      const leftLine = diffData.leftLines[leftIdx];
      const rightLine = diffData.rightLines[rightIdx];

      if (leftLine?.type === 'removed') {
        unifiedLines.push({ ...leftLine, marker: '-' });
        leftIdx++;
      } else if (rightLine?.type === 'added') {
        unifiedLines.push({ ...rightLine, marker: '+' });
        rightIdx++;
      } else if (leftLine?.type === 'unchanged') {
        if (showUnchanged) {
          unifiedLines.push({ ...leftLine, marker: ' ' });
        }
        leftIdx++;
        rightIdx++;
      } else {
        leftIdx++;
        rightIdx++;
      }
    }

    return (
      <div className="font-mono text-sm overflow-auto h-full">
        {unifiedLines.map((line, idx) => (
          <div
            key={idx}
            className={`flex ${
              line.marker === '+' ? 'bg-green-100' :
              line.marker === '-' ? 'bg-red-100' : ''
            }`}
          >
            <span className={`w-8 flex-shrink-0 text-center text-gray-400 select-none ${
              line.marker === '+' ? 'text-green-600' :
              line.marker === '-' ? 'text-red-600' : ''
            }`}>
              {line.marker}
            </span>
            <span className="w-12 flex-shrink-0 text-right pr-2 text-gray-400 select-none border-r border-gray-200">
              {line.lineNum || ''}
            </span>
            <pre className="flex-1 pl-2 whitespace-pre-wrap break-all">
              {highlightText(line.content, searchQuery)}
            </pre>
          </div>
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔍</span>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Compare Versions</h2>
              <p className="text-sm text-gray-500">Side-by-side text comparison</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* Stats Bar */}
        {diffStats && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <span className="text-green-700 font-medium">+{diffStats.lines.added}</span>
              <span className="text-gray-500">added</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span className="text-red-700 font-medium">-{diffStats.lines.removed}</span>
              <span className="text-gray-500">removed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-600 font-medium">{diffStats.lines.unchanged}</span>
              <span className="text-gray-500">unchanged</span>
            </div>
            <div className="flex-1"></div>
            <div className="flex items-center gap-1.5">
              <span className="text-blue-600 font-medium">{diffStats.similarity.toFixed(1)}%</span>
              <span className="text-gray-500">similar</span>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'side-by-side' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              ⬜⬜ Side by Side
            </button>
            <button
              onClick={() => setViewMode('unified')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'unified' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              📄 Unified
            </button>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showUnchanged}
                onChange={(e) => setShowUnchanged(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              Show unchanged
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={syncScroll}
                onChange={(e) => setSyncScroll(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              Sync scroll
            </label>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search..."
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-40"
              />
              {matches.length > 0 && (
                <>
                  <span className="text-xs text-gray-500 mx-1">
                    {currentMatch + 1}/{matches.length}
                  </span>
                  <button
                    onClick={() => navigateMatch(-1)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => navigateMatch(1)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    ▼
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Version Headers */}
        <div className="flex border-b border-gray-200">
          <div className="flex-1 px-4 py-2 bg-red-50 border-r border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-gray-800">
                  {version1?.label || 'Version 1'}
                </span>
                <span className="text-sm text-gray-500 ml-2">
                  {version1 && formatVersionDate(version1.createdAt)}
                </span>
              </div>
              <span className="text-xs text-gray-400">
                {version1?.wordCount || 0} words
              </span>
            </div>
          </div>
          <div className="flex-1 px-4 py-2 bg-green-50">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-gray-800">
                  {version2?.label || 'Version 2'}
                </span>
                <span className="text-sm text-gray-500 ml-2">
                  {version2 && formatVersionDate(version2.createdAt)}
                </span>
              </div>
              <span className="text-xs text-gray-400">
                {version2?.wordCount || 0} words
              </span>
            </div>
          </div>
        </div>

        {/* Diff Content */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'side-by-side' && diffData ? (
            <div className="flex h-full">
              {/* Left Panel (Old/Removed) */}
              <div
                ref={leftPanelRef}
                className="flex-1 overflow-auto border-r border-gray-200 font-mono text-sm"
                onScroll={(e) => handleScroll(e, 'left')}
              >
                {diffData.leftLines.map((line, idx) => {
                  const shouldHide = !showUnchanged && line.type === 'unchanged';
                  if (shouldHide) return null;
                  
                  return (
                    <div
                      key={idx}
                      className={`flex min-h-[24px] ${getLineClass(line.type)}`}
                    >
                      <span className="w-12 flex-shrink-0 text-right pr-2 text-gray-400 select-none bg-gray-50 border-r border-gray-200">
                        {line.lineNum || ''}
                      </span>
                      <pre className="flex-1 pl-2 whitespace-pre-wrap break-all">
                        {line.type === 'removed' ? (
                          <span className="text-red-700">{highlightText(line.content, searchQuery)}</span>
                        ) : (
                          highlightText(line.content, searchQuery)
                        )}
                      </pre>
                    </div>
                  );
                })}
              </div>

              {/* Right Panel (New/Added) */}
              <div
                ref={rightPanelRef}
                className="flex-1 overflow-auto font-mono text-sm"
                onScroll={(e) => handleScroll(e, 'right')}
              >
                {diffData.rightLines.map((line, idx) => {
                  const shouldHide = !showUnchanged && line.type === 'unchanged';
                  if (shouldHide) return null;
                  
                  return (
                    <div
                      key={idx}
                      className={`flex min-h-[24px] ${getLineClass(line.type)}`}
                    >
                      <span className="w-12 flex-shrink-0 text-right pr-2 text-gray-400 select-none bg-gray-50 border-r border-gray-200">
                        {line.lineNum || ''}
                      </span>
                      <pre className="flex-1 pl-2 whitespace-pre-wrap break-all">
                        {line.type === 'added' ? (
                          <span className="text-green-700">{highlightText(line.content, searchQuery)}</span>
                        ) : (
                          highlightText(line.content, searchQuery)
                        )}
                      </pre>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : viewMode === 'unified' ? (
            <div className="h-full overflow-auto">
              {renderUnifiedView()}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>Loading comparison...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {diffStats && (
              <>
                Words: {diffStats.words.before} → {diffStats.words.after} 
                ({diffStats.words.diff >= 0 ? '+' : ''}{diffStats.words.diff})
                {' | '}
                Characters: {diffStats.chars.before} → {diffStats.chars.after}
                ({diffStats.chars.diff >= 0 ? '+' : ''}{diffStats.chars.diff})
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
