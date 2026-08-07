import React, { useState } from 'react';

export default function DocumentAIDashboard({ analysis, onOpenRomeoChat }) {
  const [chatPrompt, setChatPrompt] = useState('');

  if (!analysis) return null;

  const {
    executive_summary,
    key_highlights = [],
    important_dates = [],
    timeline = [],
    people_mentioned = [],
    organizations = [],
    locations = [],
    phone_numbers = [],
    email_addresses = [],
    monetary_values = [],
    invoice_numbers = [],
    identification_numbers = [],
    topics = [],
    keywords = [],
    action_items = [],
    obligations = [],
    risks = [],
    important_clauses = [],
    tables_detected = [],
    forms_detected = [],
    suggested_questions = [],
    statistics = {},
    document_category
  } = analysis;

  const hasEntities =
    (people_mentioned && people_mentioned.length > 0) ||
    (organizations && organizations.length > 0) ||
    (locations && locations.length > 0) ||
    (email_addresses && email_addresses.length > 0) ||
    (phone_numbers && phone_numbers.length > 0) ||
    (monetary_values && monetary_values.length > 0) ||
    (invoice_numbers && invoice_numbers.length > 0) ||
    (identification_numbers && identification_numbers.length > 0);

  const hasActionItems = action_items && action_items.length > 0;
  const hasRisks = risks && risks.length > 0;
  const hasClauses = important_clauses && important_clauses.length > 0;
  const hasTimeline = (timeline && timeline.length > 0) || (important_dates && important_dates.length > 0);
  const hasTopics = (topics && topics.length > 0) || (keywords && keywords.length > 0);

  const handleSubmitPrompt = (e) => {
    e.preventDefault();
    if (!chatPrompt.trim()) return;
    onOpenRomeoChat(chatPrompt.trim());
    setChatPrompt('');
  };

  return (
    <div className="space-y-6 pb-28 text-slate-800 font-sans">
      {/* 1. EXECUTIVE SUMMARY HERO CARD - ROYAL BLUE & VIBRANT WHITE 3D GLASS CARD */}
      <div className="bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-7 shadow-2xl border border-blue-700/50 relative overflow-hidden transform hover:-translate-y-0.5 transition-all duration-300">
        {/* Background Subtle Glowing Blue Orb */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-blue-500/25 text-blue-300 rounded-2xl text-xl font-bold border border-blue-400/30 shadow-md">✨</span>
            <div>
              <h3 className="text-xl font-extrabold text-white tracking-tight">Executive Intelligence Summary</h3>
              <p className="text-xs text-blue-300/80 font-medium">Grounded AI Analysis • Real-time OCR Extractions</p>
            </div>
          </div>
          {document_category && (
            <span className="text-xs px-3.5 py-1 bg-blue-500/30 text-blue-200 border border-blue-400/40 rounded-full font-bold shadow-sm uppercase tracking-wider">
              {document_category}
            </span>
          )}
        </div>

        {executive_summary && (
          <p className="text-sm text-slate-100 leading-relaxed mb-5 font-normal whitespace-pre-line relative z-10 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
            {executive_summary}
          </p>
        )}

        {key_highlights && key_highlights.length > 0 && (
          <div className="mt-4 pt-4 border-t border-blue-800/80 relative z-10">
            <h4 className="text-xs font-bold text-blue-300 uppercase tracking-wider mb-3">Key Highlights</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {key_highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-2.5 p-3 bg-blue-950/60 rounded-xl border border-blue-800/50 text-xs text-slate-100 hover:border-blue-500/60 transition-colors shadow-sm">
                  <span className="text-blue-400 font-bold text-base leading-none">•</span>
                  <span className="font-medium">{h}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. SUGGESTED QUESTIONS CHIPS */}
      {suggested_questions && suggested_questions.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-blue-100 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-2.5 mb-3.5">
            <span className="text-blue-600 text-lg font-bold">💬</span>
            <h4 className="text-sm font-bold text-slate-900">Suggested Questions</h4>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {suggested_questions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => onOpenRomeoChat(q)}
                className="text-xs font-semibold px-4 py-2.5 bg-blue-50/80 hover:bg-blue-600 text-blue-900 hover:text-white rounded-2xl border border-blue-200/80 transition-all duration-200 shadow-xs hover:shadow-md transform hover:-translate-y-0.5"
              >
                {q} →
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. DYNAMIC STRUCTURED ENTITIES GRID - 3D CARDS */}
      {hasEntities && (
        <div className="bg-white rounded-3xl p-6 border border-blue-100 shadow-lg">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="text-blue-600 text-lg font-bold">🏷️</span>
            <h4 className="text-sm font-bold text-slate-900">Extracted Document Entities</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {people_mentioned && people_mentioned.length > 0 && (
              <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 hover:border-blue-300 transition-all shadow-xs hover:shadow-md transform hover:-translate-y-0.5">
                <div className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">👤 People Mentioned</div>
                <div className="flex flex-wrap gap-1.5">
                  {people_mentioned.map((p, i) => (
                    <span key={i} className="text-xs font-medium bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-800 shadow-2xs">{p}</span>
                  ))}
                </div>
              </div>
            )}

            {organizations && organizations.length > 0 && (
              <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 hover:border-blue-300 transition-all shadow-xs hover:shadow-md transform hover:-translate-y-0.5">
                <div className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2">🏢 Organizations</div>
                <div className="flex flex-wrap gap-1.5">
                  {organizations.map((org, i) => (
                    <span key={i} className="text-xs font-medium bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-800 shadow-2xs">{org}</span>
                  ))}
                </div>
              </div>
            )}

            {locations && locations.length > 0 && (
              <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 hover:border-blue-300 transition-all shadow-xs hover:shadow-md transform hover:-translate-y-0.5">
                <div className="text-xs font-bold text-cyan-800 uppercase tracking-wider mb-2">📍 Locations</div>
                <div className="flex flex-wrap gap-1.5">
                  {locations.map((loc, i) => (
                    <span key={i} className="text-xs font-medium bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-800 shadow-2xs">{loc}</span>
                  ))}
                </div>
              </div>
            )}

            {monetary_values && monetary_values.length > 0 && (
              <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200 hover:border-emerald-300 transition-all shadow-xs transform hover:-translate-y-0.5">
                <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2">💵 Monetary Values</div>
                <div className="flex flex-wrap gap-1.5">
                  {monetary_values.map((val, i) => (
                    <span key={i} className="text-xs font-bold bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-lg border border-emerald-300">{val}</span>
                  ))}
                </div>
              </div>
            )}

            {invoice_numbers && invoice_numbers.length > 0 && (
              <div className="p-4 bg-purple-50/80 rounded-2xl border border-purple-200 hover:border-purple-300 transition-all shadow-xs transform hover:-translate-y-0.5">
                <div className="text-xs font-bold text-purple-800 uppercase tracking-wider mb-2">🧾 Invoice / ID Ref</div>
                <div className="flex flex-wrap gap-1.5">
                  {invoice_numbers.map((inv, i) => (
                    <span key={i} className="text-xs font-bold bg-purple-100 text-purple-900 px-2.5 py-1 rounded-lg border border-purple-300">{inv}</span>
                  ))}
                </div>
              </div>
            )}

            {identification_numbers && identification_numbers.length > 0 && (
              <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200 hover:border-amber-300 transition-all shadow-xs transform hover:-translate-y-0.5">
                <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">🆔 Official Identification</div>
                <div className="flex flex-wrap gap-1.5">
                  {identification_numbers.map((idNum, i) => (
                    <span key={i} className="text-xs font-bold bg-amber-100 text-amber-900 px-2.5 py-1 rounded-lg border border-amber-300">{idNum}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. DYNAMIC ACTION ITEMS & RISKS */}
      {(hasActionItems || hasRisks) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {hasActionItems && (
            <div className="bg-white rounded-3xl p-6 border border-blue-100 shadow-lg hover:shadow-xl transition-shadow">
              <div className="flex items-center gap-2 mb-3.5">
                <span className="text-blue-600 text-lg font-bold">✅</span>
                <h4 className="text-sm font-bold text-slate-900">Action Items & Obligations</h4>
              </div>
              <div className="space-y-2">
                {action_items.map((item, idx) => (
                  <div key={idx} className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs font-medium text-slate-800 flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>{typeof item === 'string' ? item : item.task || JSON.stringify(item)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasRisks && (
            <div className="bg-white rounded-3xl p-6 border border-red-100 shadow-lg hover:shadow-xl transition-shadow">
              <div className="flex items-center gap-2 mb-3.5">
                <span className="text-red-600 text-lg font-bold">⚠️</span>
                <h4 className="text-sm font-bold text-slate-900">Risk Assessment & Warnings</h4>
              </div>
              <div className="space-y-2">
                {risks.map((r, idx) => (
                  <div key={idx} className="p-3 bg-red-50/60 rounded-xl border border-red-100 text-xs font-medium text-red-900 flex items-start gap-2">
                    <span className="text-red-600 font-bold">•</span>
                    <span>{typeof r === 'string' ? r : r.description || JSON.stringify(r)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. TIMELINE & IMPORTANT DATES */}
      {hasTimeline && (
        <div className="bg-white rounded-3xl p-6 border border-blue-100 shadow-lg">
          <div className="flex items-center gap-2 mb-3.5">
            <span className="text-blue-600 text-lg font-bold">📅</span>
            <h4 className="text-sm font-bold text-slate-900">Timelines & Key Dates</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {important_dates.map((d, idx) => (
              <div key={idx} className="p-3.5 bg-blue-50/50 rounded-2xl border border-blue-100 text-xs font-semibold text-blue-950 flex items-center gap-2">
                <span className="text-blue-600">🗓️</span>
                <span>{d}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. BOTTOM PERSISTENT CHAT BAR */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 w-full max-w-4xl px-4 z-40">
        <form
          onSubmit={handleSubmitPrompt}
          className="bg-white/95 backdrop-blur-xl border border-blue-200 rounded-3xl p-2 shadow-2xl flex items-center gap-2 border-t-2 border-t-blue-500"
        >
          <div className="p-2.5 bg-blue-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center shadow-md">
            🤖
          </div>
          <input
            type="text"
            value={chatPrompt}
            onChange={(e) => setChatPrompt(e.target.value)}
            placeholder="Ask Romeo AI anything about this document..."
            className="flex-1 text-sm bg-transparent border-none outline-none px-2 text-slate-900 font-medium placeholder-slate-400"
          />
          <button
            type="submit"
            disabled={!chatPrompt.trim()}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02]"
          >
            Send →
          </button>
        </form>
      </div>
    </div>
  );
}
