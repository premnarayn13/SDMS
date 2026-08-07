import React, { useState, useEffect, useRef } from 'react';
import DocumentAILoader from './DocumentAILoader';
import DocumentAIDashboard from './DocumentAIDashboard';
import DocumentAIRomeoChat from './DocumentAIRomeoChat';
import { tokenUtils } from '../../utils/authApi';

export default function DocumentAIWorkspace({ documentItem, allDocuments = [], onClose }) {
  const [activeDoc, setActiveDoc] = useState(documentItem);
  const [docList, setDocList] = useState(allDocuments);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard' or 'romeo_chat'
  const [initialChatMessage, setInitialChatMessage] = useState('');
  const fileInputRef = useRef(null);

  // Synchronize initial prop
  useEffect(() => {
    if (documentItem) {
      setActiveDoc(documentItem);
    }
  }, [documentItem]);

  // Fetch full document list from API with Authorization token
  useEffect(() => {
    const fetchFullDocList = async () => {
      try {
        const token = tokenUtils.getAccessToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch('/api/v1/documents?view=all&page_size=100', { headers });
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : (data.documents || data.items || []);
          const fileItems = items.filter(i => (i.type === 'file' || i.file_type) && !i.trash);
          if (fileItems.length > 0) {
            setDocList(fileItems);
            // If activeDoc is missing or placeholder, set first real file
            if (!activeDoc || activeDoc.name === 'Document' || activeDoc.name === 'Untitled Document') {
              const realDoc = fileItems.find(d => (d.name || d.display_name) && d.name !== 'Document' && d.name !== 'Untitled Document') || fileItems[0];
              if (realDoc) {
                setActiveDoc(realDoc);
              }
            }
          }
        }
      } catch (e) {
        // Fallback to prop list
      }
    };
    fetchFullDocList();
  }, []);

  const docName = activeDoc?.name || activeDoc?.display_name || activeDoc?.original_name || 'Document';
  const docType = activeDoc?.extension || activeDoc?.file_extension || activeDoc?.fileType || (docName.split('.').pop() || 'PDF').toLowerCase();

  useEffect(() => {
    let isMounted = true;
    const startAnalysis = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = tokenUtils.getAccessToken();
        const response = await fetch('/api/v1/ai/document/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            document_id: String(activeDoc?.id || ''),
            file_name: docName,
            file_type: docType,
            file_path: activeDoc?.path || activeDoc?.local_path || null,
            content_base64: activeDoc?.content ? btoa(unescape(encodeURIComponent(activeDoc.content))) : null
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            setSessionId(data.session_id);
            setAnalysis(data.analysis);
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || 'Analysis endpoint returned error status');
        }
      } catch (err) {
        console.warn('Backend analyze API error:', err);
        if (isMounted) {
          setError(err.message || 'Failed to analyze document');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (activeDoc) {
      startAnalysis();
    }

    return () => {
      isMounted = false;
    };
  }, [activeDoc]);

  // Handle direct file upload in workspace
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Content = event.target.result.split(',')[1];
      const uploadedDocItem = {
        id: `upload_${Date.now()}`,
        name: file.name,
        display_name: file.name,
        extension: file.name.split('.').pop().toLowerCase(),
        content_base64: base64Content
      };
      setActiveDoc(uploadedDocItem);
      setDocList((prev) => [uploadedDocItem, ...prev]);
    };
    reader.readAsDataURL(file);
  };

  const handleClose = async () => {
    if (sessionId) {
      try {
        await fetch(`/api/v1/ai/document/session/${sessionId}`, { method: 'DELETE' });
      } catch (e) {
        // Silent cleanup
      }
    }
    if (onClose) onClose();
  };

  const handleOpenRomeoChat = (promptMessage = '') => {
    setInitialChatMessage(promptMessage);
    setActiveView('romeo_chat');
  };

  const availableFiles = docList && docList.length > 0
    ? docList
    : (activeDoc ? [activeDoc] : []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col relative font-sans">
      {/* PERSISTENT HEADER BAR */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
          >
            ← Back to Docs
          </button>
          <div className="h-4 w-px bg-slate-200"></div>

          {/* DOCUMENT SELECTOR DROPDOWN */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1.5 bg-blue-100 text-blue-900 rounded-lg text-xs font-bold uppercase">
              {docType}
            </span>
            
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 hidden sm:inline">Active Document:</span>
              <select
                value={activeDoc?.id || ''}
                onChange={(e) => {
                  const selected = availableFiles.find(d => String(d.id) === String(e.target.value));
                  if (selected) {
                    setActiveDoc(selected);
                  }
                }}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-900 text-xs md:text-sm font-bold px-3 py-1.5 rounded-xl outline-none transition-colors cursor-pointer max-w-xs md:max-w-md truncate"
              >
                {availableFiles.map(doc => {
                  const dName = doc.name || doc.display_name || doc.original_name || 'Document';
                  const dExt = doc.extension || doc.file_extension || doc.fileType || 'file';
                  return (
                    <option key={doc.id || doc.name} value={doc.id}>
                      📄 {dName} ({String(dExt).toUpperCase()})
                    </option>
                  );
                })}
              </select>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
                title="Upload & Analyze Local Document"
              >
                <span>📤 Upload & Analyze</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* METRICS & VIEW TOGGLE BADGES */}
        <div className="flex items-center gap-3">
          {activeView === 'dashboard' ? (
            <button
              onClick={() => handleOpenRomeoChat('')}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              <span>💬 Chat with Romeo</span>
            </button>
          ) : (
            <button
              onClick={() => setActiveView('dashboard')}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors"
            >
              <span>📊 Intelligence Dashboard</span>
            </button>
          )}
        </div>
      </header>

      {/* BODY WORKSPACE AREA */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {loading ? (
          <DocumentAILoader documentName={docName} />
        ) : error ? (
          <div className="p-8 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-center max-w-md mx-auto mt-12">
            <p className="font-bold mb-2">Analysis Error</p>
            <p className="text-xs mb-4">{error}</p>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold"
            >
              Return to Documents
            </button>
          </div>
        ) : activeView === 'dashboard' ? (
          <DocumentAIDashboard
            analysis={analysis}
            onOpenRomeoChat={handleOpenRomeoChat}
          />
        ) : (
          <DocumentAIRomeoChat
            sessionId={sessionId}
            documentName={docName}
            initialMessage={initialChatMessage}
            onBackToDashboard={() => setActiveView('dashboard')}
          />
        )}
      </main>
    </div>
  );
}
