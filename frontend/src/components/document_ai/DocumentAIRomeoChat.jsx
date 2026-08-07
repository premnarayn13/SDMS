import React, { useState, useRef, useEffect } from 'react';

export default function DocumentAIRomeoChat({
  sessionId,
  documentName = 'Document',
  initialMessage = '',
  onBackToDashboard
}) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hello! I am Romeo, your Grounded Conversational AI Assistant. I can answer any question about '${documentName}' with explicit page citations.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      page_references: []
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef(null);
  const hasSentInitial = useRef(false);

  // Auto scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle initial message passed from dashboard prompt bar (Run ONCE)
  useEffect(() => {
    if (initialMessage && initialMessage.trim() && !hasSentInitial.current) {
      hasSentInitial.current = true;
      handleSendMessage(initialMessage.trim());
    }
  }, [initialMessage]);

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isSending) return;

    const userMsg = {
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsSending(true);

    try {
      const response = await fetch('/api/v1/ai/document/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId || 'aisess_demo',
          message: query,
          conversation_history: messages.slice(-6)
        })
      });

      if (!response.ok) {
        throw new Error('Chat API returned error');
      }

      const data = await response.json();
      const aiMsg = {
        role: 'assistant',
        content: data.answer || 'The requested information is not available in the current document.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        page_references: data.page_references || [],
        confidence: data.confidence || 1.0
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.warn('Chat request fallback:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'The requested information is not available in the current document.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          page_references: []
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[82vh] text-slate-900">
      {/* HEADER BAR */}
      <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 text-white flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-800/80 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            ← Back to Intelligence Dashboard
          </button>
          <div className="h-5 w-px bg-blue-700/60"></div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Chat with Romeo
              <span className="text-[10px] px-2.5 py-0.5 bg-blue-500/30 border border-blue-400/40 rounded-full font-medium text-blue-200">
                Grounded AI
              </span>
            </h3>
            <p className="text-xs text-blue-200 truncate max-w-md">
              Conversing with: <span className="font-semibold text-white">{documentName}</span>
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs bg-blue-950/60 px-3 py-1.5 rounded-xl border border-blue-700/50 text-blue-200">
          <span>🔒 Grounded to current doc</span>
        </div>
      </div>

      {/* MESSAGES BODY */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/50">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold text-slate-500">
                {msg.role === 'user' ? 'You' : 'Romeo AI'}
              </span>
              <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
            </div>

            <div
              className={`max-w-[80%] p-4 rounded-2xl text-xs md:text-sm leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-blue-700 text-white rounded-tr-none font-normal'
                  : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>

              {/* CITATION BADGES */}
              {msg.page_references && msg.page_references.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-200 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 font-semibold">Source Citations:</span>
                  {msg.page_references.map((p, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold border border-blue-200"
                    >
                      Page {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 p-3 rounded-2xl border border-blue-200 w-fit">
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></div>
            <span>Romeo is analyzing document context...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* BOTTOM INPUT BAR */}
      <div className="p-4 bg-white border-t border-slate-200 flex items-center gap-3">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Ask Romeo anything about this document..."
          disabled={isSending}
          className="flex-1 bg-slate-50 border border-slate-300 focus:border-blue-700 focus:bg-white text-xs md:text-sm text-slate-900 rounded-xl px-4 py-3 outline-none transition-colors disabled:opacity-50"
        />
        <button
          onClick={() => handleSendMessage()}
          disabled={isSending || !inputMessage.trim()}
          className="px-5 py-3 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white rounded-xl text-xs md:text-sm font-semibold transition-colors flex items-center justify-center shadow-sm"
        >
          Send
        </button>
      </div>
    </div>
  );
}
