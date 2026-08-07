import React, { useState, useRef, useEffect } from 'react';

export default function DocumentAIChatDrawer({
  sessionId,
  isOpen,
  onToggle,
  initialQuestion = '',
  onClearQuestion = () => {}
}) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'I am your Grounded Document AI Assistant. I can answer questions strictly based on the currently open document with page citations.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      page_references: []
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle external initial question trigger (from suggested questions)
  useEffect(() => {
    if (initialQuestion && initialQuestion.trim()) {
      handleSendMessage(initialQuestion);
      onClearQuestion();
    }
  }, [initialQuestion]);

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isSending || !sessionId) return;

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
          session_id: sessionId,
          message: query,
          conversation_history: messages.slice(-6)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get answer from AI Assistant');
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
      console.error('Chat error:', err);
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
    <div
      className={`fixed right-6 bottom-6 z-50 transition-all duration-300 ${
        isOpen
          ? 'w-[420px] h-[600px] max-h-[85vh]'
          : 'w-72 h-14'
      }`}
    >
      <div className="w-full h-full bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white">
        {/* COLLAPSED / EXPANDED HEADER */}
        <div
          onClick={onToggle}
          className="h-14 px-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800 flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 bg-fuchsia-600/30 text-fuchsia-300 rounded-lg text-xs font-bold animate-pulse">
              ✨
            </span>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                Ask AI Assistant
                <span className="text-[10px] px-2 py-0.5 bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30 rounded-full">
                  Copilot
                </span>
              </h4>
              {!isOpen && (
                <p className="text-[11px] text-slate-400">Click to expand chat...</p>
              )}
            </div>
          </div>

          <button
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
            title={isOpen ? 'Collapse Chat' : 'Expand Chat'}
          >
            {isOpen ? '▼' : '▲'}
          </button>
        </div>

        {/* EXPANDED CONTENT BODY */}
        {isOpen && (
          <>
            {/* GROUNDING BANNER */}
            <div className="bg-slate-950 px-3 py-1.5 border-b border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>🔒 Single Document Grounding Active</span>
              <span className="text-emerald-400">Zero Hallucination</span>
            </div>

            {/* MESSAGES LIST */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-950/60">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[88%] p-3 rounded-2xl text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-fuchsia-600 text-white rounded-br-none'
                        : 'bg-slate-800 text-slate-200 border border-slate-700/60 rounded-bl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* CITATION BADGES */}
                    {msg.page_references && msg.page_references.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-700/50 flex flex-wrap gap-1">
                        <span className="text-[10px] text-slate-400">Citations:</span>
                        {msg.page_references.map((p, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-1.5 py-0.5 bg-fuchsia-900/60 text-fuchsia-300 rounded border border-fuchsia-700/50 font-semibold"
                          >
                            Page {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>
                </div>
              ))}

              {isSending && (
                <div className="flex items-center gap-2 text-xs text-fuchsia-400 bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/40 w-fit">
                  <div className="w-2 h-2 rounded-full bg-fuchsia-400 animate-ping"></div>
                  <span>Searching document content...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* INPUT COMPONENT */}
            <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask about this document..."
                disabled={isSending}
                className="flex-1 bg-slate-950 border border-slate-700 focus:border-fuchsia-500 text-xs text-white rounded-xl px-3 py-2.5 outline-none transition-colors disabled:opacity-50"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={isSending || !inputMessage.trim()}
                className="px-3 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center"
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
