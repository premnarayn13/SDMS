/**
 * Comprehensive Analytics Dashboard
 * Displays file statistics, activity analytics, and document intelligence
 * Powered by Docky's backend analytics service with NLP capabilities
 */

import React, { useState, useEffect } from 'react';
import { getAnalytics } from '../utils/dockyApi';
import { documentOpsApi } from '../utils/documentApi';
import { getIcon, formatSize, formatDate, Icons } from '../utils/helpers';

// Icon component
const Icon = ({ name, size = 16, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2"
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
    dangerouslySetInnerHTML={{ __html: Icons[name] || '' }}
  />
);

export default function AnalyticsDashboard({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [period, setPeriod] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadAnalytics();
    }
  }, [isOpen, period]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAnalytics(period);
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-lg p-2">
              <Icon name="bar-chart" size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Analytics Dashboard</h2>
              <p className="text-indigo-100 text-sm">Insights powered by Docky AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
          >
            <Icon name="x" size={24} />
          </button>
        </div>

        {/* Period Selector */}
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
          <div className="flex gap-2">
            {['24h', '7d', '30d', '90d', '1y', 'all'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  period === p
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {p === '24h' && 'Last 24 Hours'}
                {p === '7d' && 'Last 7 Days'}
                {p === '30d' && 'Last 30 Days'}
                {p === '90d' && 'Last 90 Days'}
                {p === '1y' && 'Last Year'}
                {p === 'all' && 'All Time'}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white px-6 border-b border-gray-200">
          <div className="flex gap-1">
            {[
              { id: 'overview', label: 'Overview', icon: 'bar-chart' },
              { id: 'files', label: 'Files', icon: 'file' },
              { id: 'activity', label: 'Activity', icon: 'activity' },
              { id: 'storage', label: 'Storage', icon: 'hard-drive' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600 font-medium'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon name={tab.icon} size={18} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin text-indigo-600 mb-4 flex justify-center">
                  <Icon name="refresh" size={40} />
                </div>
                <p className="text-gray-600">Loading analytics...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <Icon name="alert-circle" size={24} className="text-red-600 mx-auto mb-2" />
              <p className="text-red-800">{error}</p>
              <button
                onClick={loadAnalytics}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && analytics && (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <MetricCard
                      icon="file"
                      label="Total Files"
                      value={analytics.file_stats.total_files.toLocaleString()}
                      color="blue"
                    />
                    <MetricCard
                      icon="hard-drive"
                      label="Storage Used"
                      value={formatSize(analytics.file_stats.total_size)}
                      color="purple"
                    />
                    <MetricCard
                      icon="activity"
                      label="Total Actions"
                      value={analytics.activity_stats.total_actions.toLocaleString()}
                      color="green"
                    />
                    <MetricCard
                      icon="upload"
                      label="Uploads"
                      value={analytics.activity_stats.uploads.toLocaleString()}
                      color="indigo"
                    />
                  </div>

                  {/* File Type Distribution */}
                  {analytics.file_stats.by_type && Object.keys(analytics.file_stats.by_type).length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Icon name="pie-chart" size={20} className="text-indigo-600" />
                        File Type Distribution
                      </h3>
                      <div className="space-y-3">
                        {Object.entries(analytics.file_stats.by_type)
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 5)
                          .map(([type, count]) => (
                            <div key={type} className="flex items-center gap-3">
                              <div className="w-32 text-sm font-medium text-gray-700 capitalize">
                                {type.replace('application/', '').replace('text/', '')}
                              </div>
                              <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full flex items-center justify-end pr-2 text-xs text-white font-medium"
                                  style={{
                                    width: `${Math.min(
                                      (count / analytics.file_stats.total_files) * 100,
                                      100
                                    )}%`
                                  }}
                                >
                                  {count}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Top Files */}
                  {analytics.top_files && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Most Viewed */}
                      {analytics.top_files.most_viewed && analytics.top_files.most_viewed.length > 0 && (
                        <TopFilesList
                          title="Most Viewed"
                          icon="eye"
                          files={analytics.top_files.most_viewed}
                          valueKey="view_count"
                          valueLabel="views"
                        />
                      )}

                      {/* Recently Added */}
                      {analytics.top_files.recently_added && analytics.top_files.recently_added.length > 0 && (
                        <TopFilesList
                          title="Recently Added"
                          icon="clock"
                          files={analytics.top_files.recently_added}
                          valueKey="created_at"
                          isDate={true}
                        />
                      )}

                      {/* Largest Files */}
                      {analytics.top_files.largest_files && analytics.top_files.largest_files.length > 0 && (
                        <TopFilesList
                          title="Largest Files"
                          icon="hard-drive"
                          files={analytics.top_files.largest_files}
                          valueKey="size_bytes"
                          isSize={true}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Files Tab */}
              {activeTab === 'files' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <MetricCard
                      icon="file"
                      label="Total Files"
                      value={analytics.file_stats.total_files.toLocaleString()}
                      description={`Avg size: ${formatSize(analytics.file_stats.average_file_size || 0)}`}
                      color="blue"
                    />
                    <MetricCard
                      icon="folder"
                      label="File Types"
                      value={Object.keys(analytics.file_stats.by_type || {}).length}
                      description="Different formats"
                      color="purple"
                    />
                    <MetricCard
                      icon="database"
                      label="Storage Drives"
                      value={Object.keys(analytics.file_stats.by_drive || {}).length}
                      description="Connected drives"
                      color="green"
                    />
                  </div>

                  {/* Detailed File Type Breakdown */}
                  {analytics.file_stats.by_type && (
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">All File Types</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(analytics.file_stats.by_type)
                          .sort(([, a], [, b]) => b - a)
                          .map(([type, count]) => (
                            <div
                              key={type}
                              className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
                            >
                              <span className="text-sm font-medium text-gray-700 capitalize">
                                {type.replace('application/', '').replace('text/', '')}
                              </span>
                              <span className="text-sm font-semibold text-indigo-600">
                                {count} files
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Activity Tab */}
              {activeTab === 'activity' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <MetricCard
                      icon="activity"
                      label="Total Actions"
                      value={analytics.activity_stats.total_actions.toLocaleString()}
                      color="blue"
                    />
                    <MetricCard
                      icon="upload"
                      label="Uploads"
                      value={analytics.activity_stats.uploads.toLocaleString()}
                      color="green"
                    />
                    <MetricCard
                      icon="download"
                      label="Downloads"
                      value={analytics.activity_stats.downloads.toLocaleString()}
                      color="purple"
                    />
                    <MetricCard
                      icon="eye"
                      label="Views"
                      value={analytics.activity_stats.views.toLocaleString()}
                      color="indigo"
                    />
                  </div>

                  {/* Activity Timeline */}
                  {analytics.activity_stats.timeline && analytics.activity_stats.timeline.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Timeline</h3>
                      <div className="space-y-2">
                        {analytics.activity_stats.timeline.slice(0, 10).map((activity, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0"
                          >
                            <div className="text-sm text-gray-500 w-24">
                              {formatDate(activity.date)}
                            </div>
                            <div className="flex-1 flex gap-4 text-sm">
                              <span className="text-green-600">{activity.uploads || 0} uploads</span>
                              <span className="text-purple-600">{activity.downloads || 0} downloads</span>
                              <span className="text-blue-600">{activity.views || 0} views</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Storage Tab */}
              {activeTab === 'storage' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <MetricCard
                      icon="hard-drive"
                      label="Total Storage"
                      value={formatSize(analytics.file_stats.total_size)}
                      description={`${analytics.file_stats.total_files} files`}
                      color="blue"
                    />
                    <MetricCard
                      icon="database"
                      label="Average File Size"
                      value={formatSize(analytics.file_stats.average_file_size || 0)}
                      color="purple"
                    />
                  </div>

                  {/* Storage Breakdown */}
                  {analytics.storage_breakdown && (
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Storage Breakdown</h3>
                      <div className="space-y-3">
                        {Object.entries(analytics.storage_breakdown)
                          .sort(([, a], [, b]) => b.size - a.size)
                          .map(([name, data]) => (
                            <div key={name} className="flex items-center gap-3">
                              <div className="w-32 text-sm font-medium text-gray-700 capitalize">
                                {name}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm text-gray-600">
                                    {formatSize(data.size)}
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    {data.count} files
                                  </span>
                                </div>
                                <div className="bg-gray-100 rounded-full h-4 overflow-hidden">
                                  <div
                                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full"
                                    style={{
                                      width: `${Math.min(
                                        (data.size / analytics.file_stats.total_size) * 100,
                                        100
                                      )}%`
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Generated at {analytics?.generated_at ? new Date(analytics.generated_at).toLocaleString() : 'Now'}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard({ icon, label, value, description, color = 'blue' }) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
    green: 'from-green-500 to-green-600',
    indigo: 'from-indigo-500 to-indigo-600',
    red: 'from-red-500 to-red-600'
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className={`bg-gradient-to-r ${colorClasses[color]} rounded-lg p-2`}>
          <Icon name={icon} size={20} className="text-white" />
        </div>
        <span className="text-sm font-medium text-gray-600">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
      {description && <div className="text-xs text-gray-500">{description}</div>}
    </div>
  );
}

// Top Files List Component
function TopFilesList({ title, icon, files, valueKey, valueLabel, isDate, isSize }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Icon name={icon} size={16} className="text-indigo-600" />
        {title}
      </h3>
      <div className="space-y-2">
        {files.slice(0, 5).map((file, idx) => (
          <div
            key={file.id || idx}
            className="flex items-center gap-2 py-2 border-b border-gray-100 last:border-0"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {file.filename || file.name}
              </div>
              <div className="text-xs text-gray-500">
                {isDate && formatDate(file[valueKey])}
                {isSize && formatSize(file[valueKey])}
                {!isDate && !isSize && valueLabel && `${file[valueKey]} ${valueLabel}`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
