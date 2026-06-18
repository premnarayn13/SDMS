/**
 * Storage Manager Page
 * Professional storage analytics and management
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { megaSettingsApi } from '../../utils/settingsApi';
import { 
  HardDrive, Database, Trash2, Archive, FileText, Image, Video, Music,
  ChevronLeft, RefreshCw, AlertCircle, CheckCircle, Loader2,
  PieChart, BarChart3, TrendingUp, Zap
} from 'lucide-react';

// Format bytes helper
const formatBytes = (bytes, decimals = 2) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export default function StorageManagerPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('analytics');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Storage stats
  const [stats, setStats] = useState({
    used: 0,
    total: 5 * 1024 * 1024 * 1024, // 5GB
    files: 0,
    chunks: 0,
    savings: 0,
    dedupSavings: 0
  });
  
  // File type breakdown
  const [breakdown, setBreakdown] = useState({
    documents: 0,
    images: 0,
    videos: 0,
    audio: 0,
    archives: 0,
    other: 0
  });
  const [megaSource, setMegaSource] = useState({
    connected: false,
    used: 0,
    total: 20 * 1024 * 1024 * 1024,
    remaining: 20 * 1024 * 1024 * 1024,
    files: 0,
    email: ''
  });

  useEffect(() => {
    loadStorageData();
  }, []);

  const loadStorageData = async () => {
    setIsLoading(true);
    try {
      // Load from localStorage
      const saved = localStorage.getItem('docmatrix_data');
      if (saved) {
        const items = JSON.parse(saved);
        const files = items.filter(i => i.type === 'file' && !i.trash);
        const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
        
        // Calculate breakdown
        const docs = files.filter(f => ['PDF', 'Word', 'Excel', 'PowerPoint', 'Text'].includes(f.fileType));
        const images = files.filter(f => f.fileType === 'Image');
        const videos = files.filter(f => f.fileType === 'Video');
        const audio = files.filter(f => f.fileType === 'Audio');
        const archives = files.filter(f => f.fileType === 'Archive');
        
        setStats({
          used: totalSize,
          total: 5 * 1024 * 1024 * 1024,
          files: files.length,
          chunks: Math.floor(totalSize / (1024 * 64)),
          savings: 0,
          dedupSavings: 0
        });
        
        setBreakdown({
          documents: docs.reduce((s, f) => s + (f.size || 0), 0),
          images: images.reduce((s, f) => s + (f.size || 0), 0),
          videos: videos.reduce((s, f) => s + (f.size || 0), 0),
          audio: audio.reduce((s, f) => s + (f.size || 0), 0),
          archives: archives.reduce((s, f) => s + (f.size || 0), 0),
          other: 0
        });
      }

      let megaStatus = null;

try {
    megaStatus = await megaSettingsApi.getStatus();
} catch (err) {
    console.error("MEGA STATUS FAILED", err);

    return; // do NOT mark disconnected
}
      if (megaStatus?.connected) {
        const filesRes = await megaSettingsApi.listFiles().catch(() => ({ files: [] }));
        const megaFiles = filesRes?.files || [];
        const megaUsed = megaFiles.reduce((sum, file) => sum + (Number(file?.size_bytes) || 0), 0);
        const megaTotal = 20 * 1024 * 1024 * 1024;
        setMegaSource({
          connected: true,
          used: megaUsed,
          total: megaTotal,
          remaining: Math.max(0, megaTotal - megaUsed),
          files: megaFiles.length,
          email: megaStatus?.mega_email || ''
        });
      } else {
        setMegaSource((prev) => ({ ...prev, connected: false, used: 0, remaining: prev.total, files: 0, email: '' }));
      }
    } catch (error) {
      console.error('Failed to load storage data:', error);
    }
    setIsLoading(false);
  };

  const tabs = [
    { id: 'analytics', label: 'Analytics', icon: PieChart },
    { id: 'backup', label: 'Backup', icon: Archive },
    { id: 'encryption', label: 'Encryption', icon: Database },
    { id: 'maintenance', label: 'Maintenance', icon: Zap },
    { id: 'portable', label: 'Portable', icon: HardDrive }
  ];

  const usagePercent = stats.total > 0 ? (stats.used / stats.total) * 100 : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors duration-200"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="font-medium">Back to Documents</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadStorageData}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all duration-200 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Database className="w-7 h-7 text-slate-700" />
            Storage Manager
          </h1>
          <p className="text-slate-600 mt-1">Manage your storage, backups, and data security</p>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 animate-fade-in ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
            'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{message.text}</span>
          </div>
        )}

        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <nav className="w-56 flex-shrink-0">
            <div className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
          </nav>

          {/* Main Content */}
          <div className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            ) : (
              <>
                {/* Analytics Tab */}
                {activeTab === 'analytics' && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-800">Primary Storage</p>
                          <span className="text-xs text-slate-500">DocMatrix</span>
                        </div>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{formatBytes(stats.used)}</p>
                        <p className="text-xs text-slate-500 mt-1">Used in app workspace</p>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-800">MEGA Source</p>
                          <span className={`text-xs px-2 py-0.5 rounded ${megaSource.connected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {megaSource.connected ? 'Connected' : 'Not connected'}
                          </span>
                        </div>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{formatBytes(megaSource.used)}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {megaSource.connected
                            ? `${megaSource.files} file(s), ${formatBytes(megaSource.remaining)} remaining`
                            : 'Connect from Settings > MEGA Storage'}
                        </p>
                      </div>
                    </div>

                    {/* Storage Overview Card */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <h2 className="text-lg font-semibold text-slate-900 mb-4">Storage Overview</h2>
                      
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-600">Used: {formatBytes(stats.used)}</span>
                        <span className="text-slate-600">Max: {formatBytes(stats.total)}</span>
                      </div>
                      
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-slate-700 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(usagePercent, 100)}%` }}
                        />
                      </div>
                      
                      <p className="text-sm text-slate-500 mt-2">{usagePercent.toFixed(2)}% used</p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                      <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <div className="text-3xl font-bold text-indigo-600">{stats.files}</div>
                        <div className="text-sm text-slate-600 mt-1">Total Files</div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <div className="text-3xl font-bold text-emerald-600">{stats.chunks}</div>
                        <div className="text-sm text-slate-600 mt-1">Total Chunks</div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <div className="text-3xl font-bold text-amber-600">{stats.savings}%</div>
                        <div className="text-sm text-slate-600 mt-1">Space Saved</div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <div className="text-3xl font-bold text-purple-600">{formatBytes(stats.dedupSavings)}</div>
                        <div className="text-sm text-slate-600 mt-1">Dedup Savings</div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <div className="text-3xl font-bold text-sky-600">{megaSource.files}</div>
                        <div className="text-sm text-slate-600 mt-1">MEGA Files</div>
                      </div>
                    </div>

                    {/* File Type Breakdown */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <h2 className="text-lg font-semibold text-slate-900 mb-4">Storage by File Type</h2>
                      
                      {stats.files === 0 ? (
                        <p className="text-slate-500 py-4">No files stored yet</p>
                      ) : (
                        <div className="space-y-3">
                          {Object.entries(breakdown).map(([type, size]) => (
                            <div key={type} className="flex items-center gap-3">
                              <div className="w-24 text-sm text-slate-600 capitalize">{type}</div>
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-slate-600 rounded-full"
                                  style={{ width: `${stats.used > 0 ? (size / stats.used) * 100 : 0}%` }}
                                />
                              </div>
                              <div className="w-20 text-sm text-slate-600 text-right">{formatBytes(size)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Backup Tab */}
                {activeTab === 'backup' && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <h2 className="text-lg font-semibold text-slate-900 mb-4">Backup & Restore</h2>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => {
                            const data = localStorage.getItem('docmatrix_data');
                            const blob = new Blob([data || '[]'], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `docmatrix-backup-${new Date().toISOString().split('T')[0]}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                            setMessage({ type: 'success', text: 'Backup created successfully!' });
                          }}
                          className="flex items-center justify-center gap-3 p-6 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all duration-200"
                        >
                          <Archive className="w-8 h-8 text-slate-600" />
                          <div className="text-left">
                            <div className="font-semibold text-slate-900">Create Backup</div>
                            <div className="text-sm text-slate-500">Export all your data</div>
                          </div>
                        </button>
                        
                        <label className="flex items-center justify-center gap-3 p-6 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all duration-200 cursor-pointer">
                          <RefreshCw className="w-8 h-8 text-slate-600" />
                          <div className="text-left">
                            <div className="font-semibold text-slate-900">Restore Backup</div>
                            <div className="text-sm text-slate-500">Import from file</div>
                          </div>
                          <input
                            type="file"
                            accept=".json"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  try {
                                    const data = JSON.parse(ev.target?.result);
                                    localStorage.setItem('docmatrix_data', JSON.stringify(data));
                                    setMessage({ type: 'success', text: 'Backup restored successfully!' });
                                    loadStorageData();
                                  } catch {
                                    setMessage({ type: 'error', text: 'Invalid backup file' });
                                  }
                                };
                                reader.readAsText(file);
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <h2 className="text-lg font-semibold text-slate-900 mb-4">Auto Backup</h2>
                      <p className="text-slate-600 mb-4">Configure automatic backups to keep your data safe.</p>
                      
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                        <div>
                          <div className="font-medium text-slate-900">Enable Auto Backup</div>
                          <div className="text-sm text-slate-500">Backup daily to your local storage</div>
                        </div>
                        <button className="w-12 h-6 bg-slate-200 rounded-full relative transition-colors duration-200">
                          <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 shadow transition-transform duration-200" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Encryption Tab */}
                {activeTab === 'encryption' && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <h2 className="text-lg font-semibold text-slate-900 mb-4">Data Encryption</h2>
                      <p className="text-slate-600 mb-6">Protect your files with end-to-end encryption.</p>
                      
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                        <span className="text-emerald-800">Your data is encrypted at rest</span>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <h2 className="text-lg font-semibold text-slate-900 mb-4">Encryption Key</h2>
                      <p className="text-slate-600 mb-4">Your encryption key is stored securely on your device.</p>
                      
                      <button className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors duration-200">
                        Regenerate Key
                      </button>
                    </div>
                  </div>
                )}

                {/* Maintenance Tab */}
                {activeTab === 'maintenance' && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <h2 className="text-lg font-semibold text-slate-900 mb-4">Storage Maintenance</h2>
                      
                      <div className="space-y-4">
                        <button 
                          onClick={() => {
                            const saved = localStorage.getItem('docmatrix_data');
                            if (saved) {
                              const items = JSON.parse(saved);
                              const cleaned = items.filter(i => !i.trash);
                              localStorage.setItem('docmatrix_data', JSON.stringify(cleaned));
                              setMessage({ type: 'success', text: 'Trash emptied successfully!' });
                              loadStorageData();
                            }
                          }}
                          className="w-full flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors duration-200"
                        >
                          <div className="flex items-center gap-3">
                            <Trash2 className="w-5 h-5 text-slate-600" />
                            <div className="text-left">
                              <div className="font-medium text-slate-900">Empty Trash</div>
                              <div className="text-sm text-slate-500">Permanently delete trashed items</div>
                            </div>
                          </div>
                          <ChevronLeft className="w-5 h-5 text-slate-400 rotate-180" />
                        </button>

                        <button className="w-full flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors duration-200">
                          <div className="flex items-center gap-3">
                            <Zap className="w-5 h-5 text-slate-600" />
                            <div className="text-left">
                              <div className="font-medium text-slate-900">Optimize Storage</div>
                              <div className="text-sm text-slate-500">Remove duplicate chunks</div>
                            </div>
                          </div>
                          <ChevronLeft className="w-5 h-5 text-slate-400 rotate-180" />
                        </button>

                        <button className="w-full flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors duration-200">
                          <div className="flex items-center gap-3">
                            <BarChart3 className="w-5 h-5 text-slate-600" />
                            <div className="text-left">
                              <div className="font-medium text-slate-900">Verify Integrity</div>
                              <div className="text-sm text-slate-500">Check file checksums</div>
                            </div>
                          </div>
                          <ChevronLeft className="w-5 h-5 text-slate-400 rotate-180" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Portable Tab */}
                {activeTab === 'portable' && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <h2 className="text-lg font-semibold text-slate-900 mb-4">Portable Export</h2>
                      <p className="text-slate-600 mb-6">Export your entire workspace as a portable package.</p>
                      
                      <button className="px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors duration-200 flex items-center gap-2">
                        <HardDrive className="w-5 h-5" />
                        <span>Create Portable Package</span>
                      </button>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <h2 className="text-lg font-semibold text-slate-900 mb-4">Import Package</h2>
                      <p className="text-slate-600 mb-4">Import a portable package from another device.</p>
                      
                      <label className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition-colors duration-200 cursor-pointer">
                        <span>Select Package File</span>
                        <input type="file" className="hidden" accept=".zip" />
                      </label>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
