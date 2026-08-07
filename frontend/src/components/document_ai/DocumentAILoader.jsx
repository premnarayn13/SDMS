import React, { useState, useEffect } from 'react';

export default function DocumentAILoader({ documentName = 'Document' }) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { label: 'Reading document layout & structure...', icon: 'ðŸ“„' },
    { label: 'Running Document AI OCR & extraction...', icon: 'âš¡' },
    { label: 'Analyzing entities, dates & monetary values...', icon: 'ðŸ”' },
    { label: 'Detecting action items, clauses & risks...', icon: 'ðŸ›¡ï¸' },
    { label: 'Generating Executive Intelligence Workspace...', icon: 'âœ¨' }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 1600);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center p-8 bg-gradient-to-br from-blue-50/90 via-indigo-50/40 to-white text-slate-900 rounded-3xl border border-blue-200/80 shadow-2xl backdrop-blur-xl relative overflow-hidden my-6">
      {/* 3D Background Glowing Blue Aura */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-400/20 rounded-full blur-3xl animate-pulse delay-700"></div>

      <div className="relative z-10 flex flex-col items-center max-w-lg text-center w-full">
        
        {/* 3D Holographic Radar Scanner Container */}
        <div className="relative mb-8 flex items-center justify-center">
          {/* Outer Pulsing Blue Wave Ring */}
          <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping duration-1000 scale-125"></div>
          
          {/* Rotating 3D Gradient Ring */}
          <div className="w-28 h-28 rounded-3xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-cyan-400 p-1 shadow-[0_0_35px_rgba(37,99,235,0.4)] animate-spin-slow transform rotate-12">
            <div className="w-full h-full bg-white rounded-[22px] flex items-center justify-center shadow-inner relative overflow-hidden">
              {/* Laser Scan Line Beam Effect */}
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#38bdf8] animate-laser-scan"></div>
              <span className="text-4xl transform hover:scale-110 transition-transform">ðŸ¤–</span>
            </div>
          </div>

          <div className="absolute -bottom-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[11px] font-extrabold px-3 py-0.5 rounded-full shadow-lg border border-blue-400/40 tracking-wider uppercase">
            AI Document AI Scan
          </div>
        </div>

        {/* Title & Document Badge */}
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">
          Analyzing Document Intelligence
        </h2>
        <p className="text-xs font-semibold text-blue-700 bg-blue-100/80 px-3.5 py-1 rounded-full border border-blue-200 mb-8 truncate max-w-xs shadow-sm">
          ðŸ“„ {documentName}
        </p>

        {/* Step Progress Container with 3D Glass Layout */}
        <div className="w-full space-y-3 bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-blue-100 shadow-xl text-left">
          {steps.map((step, idx) => {
            const isDone = idx < currentStep;
            const isCurrent = idx === currentStep;
            return (
              <div
                key={idx}
                className={`flex items-center gap-3.5 transition-all duration-300 p-2 rounded-xl ${
                  isCurrent
                    ? 'bg-blue-50/90 text-blue-900 font-bold shadow-sm translate-x-1 border-l-4 border-blue-600'
                    : isDone
                    ? 'text-emerald-700 opacity-90'
                    : 'text-slate-400'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs flex-shrink-0 font-bold transition-all shadow-sm ${
                    isDone
                      ? 'bg-emerald-500 text-white shadow-emerald-200'
                      : isCurrent
                      ? 'bg-blue-600 text-white animate-bounce shadow-blue-300'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {isDone ? 'âœ“' : step.icon}
                </div>
                <span className="text-xs font-medium truncate">{step.label}</span>
              </div>
            );
          })}
        </div>

        {/* Security Footnote */}
        <p className="text-[11px] font-medium text-slate-500 mt-6 flex items-center gap-1.5 bg-white/60 px-4 py-1.5 rounded-full border border-slate-200 shadow-xs">
          <span>ðŸ”’</span> Ephemeral Cloud Session â€¢ Powered by Google Document AI & Gemini
        </p>
      </div>
    </div>
  );
}

