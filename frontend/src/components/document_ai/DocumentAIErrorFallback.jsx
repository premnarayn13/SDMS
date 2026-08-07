// Document AI Error Fallback Component
import React from 'react';
export default function DocumentAIErrorFallback({ error, onRetry }) { return (<div className='p-6 bg-red-50 text-red-900 rounded-2xl border border-red-200 text-center'><p className='font-bold'>Analysis Error</p><p className='text-xs mt-1'>{String(error)}</p><button onClick={onRetry} className='mt-3 px-4 py-1.5 bg-red-600 text-white text-xs font-bold rounded-xl'>Retry</button></div>); }
