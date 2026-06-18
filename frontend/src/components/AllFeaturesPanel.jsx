/**
 * All Features Panel
 * Comprehensive display of ALL 80+ Phase 1 & Phase 2 features
 * Makes all features easily discoverable and accessible
 */

import React, { useState } from 'react';

export default function AllFeaturesPanel({ isOpen, onClose, onCommandSelect }) {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // COMPREHENSIVE FEATURE LIST - Phase 1 & Phase 2
  const allFeatures = [
    {
      id: 'file-ops',
      category: 'File Operations',
      icon: '📁',
      color: 'blue',
      features: [
        { cmd: 'Open [filename]', desc: 'View file in viewer', example: 'Open report.pdf' },
        { cmd: 'View [filename]', desc: 'Display file content', example: 'View invoice.docx' },
        { cmd: 'Download [filename]', desc: 'Download file to computer', example: 'Download budget.xlsx' },
        { cmd: 'Upload a file', desc: 'Add new files', example: 'Upload a file' },
        { cmd: 'Delete [filename]', desc: 'Move to trash', example: 'Delete old_file.txt' },
        { cmd: 'Remove [filename]', desc: 'Delete permanently', example: 'Remove temp.pdf' },
        { cmd: 'Rename [old] to [new]', desc: 'Change filename', example: 'Rename report.pdf to final_report.pdf' },
        { cmd: 'Launch [filename]', desc: 'Open in external app', example: 'Launch presentation.pptx' },
        { cmd: 'Read [filename]', desc: 'Read file content', example: 'Read notes.txt' },
        { cmd: 'Display [filename]', desc: 'Show file details', example: 'Display contract.pdf' },
        { cmd: 'Get file [filename]', desc: 'Retrieve file', example: 'Get file report.docx' },
        { cmd: 'Export [filename]', desc: 'Export file', example: 'Export data.csv' }
      ]
    },
    {
      id: 'organization',
      category: 'Organization & Management',
      icon: '🗂️',
      color: 'purple',
      features: [
        { cmd: 'Favorite [filename]', desc: 'Mark as favorite', example: 'Favorite important.pdf' },
        { cmd: 'Unfavorite [filename]', desc: 'Remove from favorites', example: 'Unfavorite old.pdf' },
        { cmd: 'Star [filename]', desc: 'Add star rating', example: 'Star contract.docx' },
        { cmd: 'Unstar [filename]', desc: 'Remove star', example: 'Unstar draft.txt' },
        { cmd: 'Tag [file] with [tag]', desc: 'Add tags to files', example: 'Tag report.pdf with urgent' },
        { cmd: 'Add tag [tag] to [file]', desc: 'Label files', example: 'Add tag finance to budget.xlsx' },
        { cmd: 'Label [file] as [tag]', desc: 'Categorize files', example: 'Label invoice.pdf as paid' },
        { cmd: 'Move [file] to [folder]', desc: 'Organize into folders', example: 'Move report.pdf to Archive' },
        { cmd: 'Transfer [file] to [folder]', desc: 'Relocate files', example: 'Transfer docs to Projects' },
        { cmd: 'Organize my files', desc: 'Auto-organize by type', example: 'Organize my files' },
        { cmd: 'Clean up my files', desc: 'Sort and categorize', example: 'Clean up my files' },
        { cmd: 'Sort my files', desc: 'Arrange by criteria', example: 'Sort my files by date' }
      ]
    },
    {
      id: 'search',
      category: 'Search & Discovery',
      icon: '🔍',
      color: 'green',
      features: [
        { cmd: 'Search for [query]', desc: 'Find files by name/content', example: 'Search for invoice' },
        { cmd: 'Find [filename]', desc: 'Locate specific file', example: 'Find budget report' },
        { cmd: 'Look for [query]', desc: 'Search documents', example: 'Look for contract' },
        { cmd: 'Where is [filename]', desc: 'Find file location', example: 'Where is presentation.pptx' },
        { cmd: 'Show [query]', desc: 'Display matching files', example: 'Show all PDFs' },
        { cmd: 'Filter by [criteria]', desc: 'Apply filters', example: 'Filter by tag urgent' },
        { cmd: 'Show only [type]', desc: 'Filter by file type', example: 'Show only documents' },
        { cmd: 'Show files with tag [tag]', desc: 'Find tagged files', example: 'Show files with tag finance' },
        { cmd: 'Search by filename [query]', desc: 'Name-based search', example: 'Search by filename report' },
        { cmd: 'Search by content [query]', desc: 'Full-text search', example: 'Search by content invoice' },
        { cmd: 'Search by tags [query]', desc: 'Tag-based search', example: 'Search by tags urgent' },
        { cmd: 'Full-text search [query]', desc: 'Deep content search', example: 'Full-text search budget' },
        { cmd: 'Find exact match [query]', desc: 'Exact phrase match', example: 'Find exact match "Q4 report"' },
        { cmd: 'Find similar files', desc: 'Similarity search', example: 'Find similar files to report.pdf' },
        { cmd: 'Show all PDFs', desc: 'List all PDF files', example: 'Show all PDFs' },
        { cmd: 'Show all documents', desc: 'List all docs', example: 'Show all documents' }
      ]
    },
    {
      id: 'analytics',
      category: 'Analytics & Insights',
      icon: '📊',
      color: 'indigo',
      features: [
        { cmd: 'Show analytics', desc: 'View dashboard', example: 'Show analytics' },
        { cmd: 'Show analytics dashboard', desc: 'Open full dashboard', example: 'Show analytics dashboard' },
        { cmd: 'Show statistics', desc: 'Display file stats', example: 'Show statistics' },
        { cmd: 'Show stats', desc: 'Quick stats view', example: 'Show stats' },
        { cmd: 'What are my stats', desc: 'Personal statistics', example: 'What are my stats' },
        { cmd: 'How many files', desc: 'File count', example: 'How many files do I have' },
        { cmd: 'How much storage?', desc: 'Storage usage', example: 'How much storage am I using' },
        { cmd: 'Storage usage', desc: 'View storage details', example: 'Storage usage' },
        { cmd: 'Space used', desc: 'Check used space', example: 'Space used' },
        { cmd: 'Check storage', desc: 'Storage status', example: 'Check storage' },
        { cmd: 'Space available', desc: 'Available space', example: 'Space available' },
        { cmd: 'Storage breakdown', desc: 'By file type', example: 'Storage breakdown' }
      ]
    },
    {
      id: 'ai-nlp',
      category: 'AI & NLP Features',
      icon: '🤖',
      color: 'pink',
      features: [
        { cmd: 'Extract entities from [file]', desc: 'Find people, orgs, dates', example: 'Extract entities from contract.pdf' },
        { cmd: 'Find people in [file]', desc: 'Identify person names', example: 'Find people in meeting_notes.docx' },
        { cmd: 'Find organizations in [file]', desc: 'Extract company names', example: 'Find organizations in report.pdf' },
        { cmd: 'Find dates in [file]', desc: 'Extract date mentions', example: 'Find dates in schedule.docx' },
        { cmd: 'Extract keywords from [file]', desc: 'TF-IDF keywords', example: 'Extract keywords from article.pdf' },
        { cmd: 'What language is [file]', desc: 'Detect language', example: 'What language is document.pdf' },
        { cmd: 'Detect language [file]', desc: '55+ languages', example: 'Detect language texto.txt' },
        { cmd: 'Summarize [file]', desc: 'Generate summary', example: 'Summarize long_report.pdf' },
        { cmd: 'Get file statistics', desc: 'Word/char counts', example: 'Get file statistics for essay.docx' },
        { cmd: 'Count words in [file]', desc: 'Word count', example: 'Count words in article.txt' },
        { cmd: 'Analyze [file]', desc: 'Deep analysis', example: 'Analyze research.pdf' },
        { cmd: 'Get insights from [file]', desc: 'AI insights', example: 'Get insights from data.csv' },
        { cmd: 'Extract text from [file]', desc: 'OCR & extraction', example: 'Extract text from scan.pdf' },
        { cmd: 'Parse [file]', desc: 'Parse document', example: 'Parse invoice.pdf' },
        { cmd: 'Process [file]', desc: 'NLP processing', example: 'Process legal_doc.docx' }
      ]
    },
    {
      id: 'duplicates',
      category: 'Duplicate Management',
      icon: '🔄',
      color: 'orange',
      features: [
        { cmd: 'Find duplicates', desc: 'Hash-based detection', example: 'Find duplicates' },
        { cmd: 'Find duplicate files', desc: 'Show all duplicates', example: 'Find duplicate files' },
        { cmd: 'Show duplicates', desc: 'List duplicate groups', example: 'Show duplicates' },
        { cmd: 'Check for duplicates', desc: 'Scan for dupes', example: 'Check for duplicates' },
        { cmd: 'Remove duplicates', desc: 'Clean up dupes', example: 'Remove duplicates' },
        { cmd: 'Clean duplicate files', desc: 'Delete extras', example: 'Clean duplicate files' },
        { cmd: 'Find similar files', desc: 'Near-duplicates', example: 'Find similar files' },
        { cmd: 'Show space wasted', desc: 'Duplicate space', example: 'Show space wasted by duplicates' }
      ]
    },
    {
      id: 'recent',
      category: 'Recent & History',
      icon: '⏱️',
      color: 'cyan',
      features: [
        { cmd: 'Show recent files', desc: 'Recently accessed', example: 'Show recent files' },
        { cmd: 'Latest files', desc: 'Most recent', example: 'Latest files' },
        { cmd: 'What did I upload recently', desc: 'Recent uploads', example: 'What did I upload recently' },
        { cmd: 'Recently uploaded files', desc: 'Upload history', example: 'Recently uploaded files' },
        { cmd: 'My recent files', desc: 'Personal recent', example: 'My recent files' },
        { cmd: 'Show history', desc: 'Activity history', example: 'Show history' },
        { cmd: 'Recent activity', desc: 'Latest actions', example: 'Recent activity' }
      ]
    },
    {
      id: 'help',
      category: 'Help & Support',
      icon: '💬',
      color: 'gray',
      features: [
        { cmd: 'Help', desc: 'Show all commands', example: 'Help' },
        { cmd: 'What can you do', desc: 'Feature list', example: 'What can you do' },
        { cmd: 'Show commands', desc: 'Command list', example: 'Show commands' },
        { cmd: 'Show all features', desc: 'Full feature list', example: 'Show all features' },
        { cmd: 'How do I...', desc: 'Get help', example: 'How do I search files' },
        { cmd: 'Guide', desc: 'User guide', example: 'Guide' },
        { cmd: 'Documentation', desc: 'View docs', example: 'Documentation' },
        { cmd: 'Examples', desc: 'See examples', example: 'Examples' }
      ]
    }
  ];

  // Calculate total features
  const totalFeatures = allFeatures.reduce((sum, cat) => sum + cat.features.length, 0);

  // Filter features based on search
  const filteredFeatures = allFeatures.map(cat => ({
    ...cat,
    features: cat.features.filter(f =>
      f.cmd.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.example.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(cat => cat.features.length > 0);

  // Filter by active tab
  const displayFeatures = activeTab === 'all' 
    ? filteredFeatures 
    : filteredFeatures.filter(cat => cat.id === activeTab);

  const handleCommandClick = (example) => {
    if (onCommandSelect) {
      onCommandSelect(example);
    }
    onClose();
  };

  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    pink: 'bg-pink-50 border-pink-200 text-pink-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    cyan: 'bg-cyan-50 border-cyan-200 text-cyan-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700'
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">🚀 All Features</h2>
              <p className="text-indigo-100 text-sm mt-1">
                {totalFeatures} features across {allFeatures.length} categories • Phase 1 & Phase 2
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search features... (e.g., 'search', 'analytics', 'duplicate')"
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="px-6 py-3 border-b border-slate-200 overflow-x-auto">
          <div className="flex space-x-2 min-w-max">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({totalFeatures})
            </button>
            {allFeatures.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1 ${
                  activeTab === cat.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.category.split(' ')[0]}</span>
                <span className="opacity-70">({cat.features.length})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {displayFeatures.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M12 8h.01M12 16h.01M12 20h.01M9 20h.01M15 20h.01M9 8h.01M15 8h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-slate-500 text-lg">No features found</p>
              <p className="text-slate-400 text-sm mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="space-y-6">
              {displayFeatures.map(cat => (
                <div key={cat.id} className={`border-2 rounded-xl p-5 ${colorClasses[cat.color]}`}>
                  <h3 className="text-xl font-bold mb-4 flex items-center space-x-2">
                    <span className="text-2xl">{cat.icon}</span>
                    <span>{cat.category}</span>
                    <span className="text-sm font-normal opacity-70">({cat.features.length} features)</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {cat.features.map((feature, idx) => (
                      <div
                        key={idx}
                        className="bg-white rounded-lg p-3 border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer group"
                        onClick={() => handleCommandClick(feature.example)}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <code className="text-sm font-semibold text-slate-800 group-hover:text-indigo-600">
                            {feature.cmd}
                          </code>
                          <svg className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </div>
                        <p className="text-xs text-slate-600 mb-1">{feature.desc}</p>
                        <p className="text-xs text-indigo-600 font-medium">
                          ▸ {feature.example}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <div className="flex items-center space-x-4">
              <span>💡 Click any feature to use it</span>
              <span>•</span>
              <span>🎤 Voice commands supported</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
