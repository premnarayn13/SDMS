import React, { useState } from 'react';
import Modal from './Modal';
import { formatSize, formatDate, Icons } from '../utils/helpers';

// Icon component for SVG rendering
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

const CATEGORIES = ['Documents', 'Spreadsheets', 'Presentations', 'Images', 'Videos', 'Audio', 'Archives', 'Code', 'Other'];
const STATUSES = ['draft', 'final', 'archived'];
const SENSITIVITIES = ['public', 'internal', 'confidential'];
const PRIORITIES = ['low', 'medium', 'high'];

export default function ItemPropertiesModal({ isOpen, onClose, item, onSave }) {
  const [activeTab, setActiveTab] = useState('general');
  const [category, setCategory] = useState(item?.category || '');
  const [status, setStatus] = useState(item?.status || '');
  const [sensitivity, setSensitivity] = useState(item?.sensitivity || '');
  const [priority, setPriority] = useState(item?.priority || 'medium');
  const [tags, setTags] = useState(item?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [description, setDescription] = useState(item?.description || '');
  const [notes, setNotes] = useState(item?.notes || '');

  const handleSave = () => {
    onSave(item.id, { 
      category, 
      status, 
      sensitivity, 
      priority,
      tags,
      description,
      notes
    });
    onClose();
  };

  const handleAddTag = (e) => {
    e.preventDefault();
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  if (!item) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Item Properties" icon="settings">
      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-navy-200">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'general' 
              ? 'text-navy-900 border-b-2 border-navy-900' 
              : 'text-navy-500 hover:text-navy-700'
          }`}
        >
          <Icon name="file" size={14} />
          General
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'system' 
              ? 'text-navy-900 border-b-2 border-navy-900' 
              : 'text-navy-500 hover:text-navy-700'
          }`}
        >
          <Icon name="settings" size={14} />
          System Properties
        </button>
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="space-y-4 mb-6 max-h-[500px] overflow-y-auto">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input"
            >
              <option value="">-- No Category --</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1.5">Status</label>
            <div className="flex gap-2">
              {STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`
                    flex-1 py-2 px-3 rounded-lg text-sm font-medium capitalize transition-all
                    ${status === s 
                      ? s === 'draft' ? 'bg-yellow-500 text-white' 
                        : s === 'final' ? 'bg-green-500 text-white'
                        : 'bg-gray-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1.5">Priority</label>
            <div className="flex gap-2">
              {PRIORITIES.map(p => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`
                    flex-1 py-2 px-3 rounded-lg text-sm font-medium capitalize transition-all
                    ${priority === p 
                      ? p === 'low' ? 'bg-blue-500 text-white' 
                        : p === 'medium' ? 'bg-orange-500 text-white'
                        : 'bg-red-500 text-white'
                      : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
                    }
                  `}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Sensitivity */}
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1.5">Sensitivity Level</label>
            <div className="flex gap-2">
              {SENSITIVITIES.map(s => (
                <button
                  key={s}
                  onClick={() => setSensitivity(s)}
                  className={`
                    flex-1 py-2 px-3 rounded-lg text-sm font-medium capitalize transition-all
                    ${sensitivity === s 
                      ? s === 'public' ? 'bg-green-500 text-white' 
                        : s === 'internal' ? 'bg-orange-500 text-white'
                        : 'bg-red-500 text-white'
                      : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
                    }
                  `}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1.5">Tags</label>
            <form onSubmit={handleAddTag} className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add tag..."
                className="input flex-1"
              />
              <button
                type="submit"
                className="btn-primary"
              >
                Add
              </button>
            </form>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-navy-100 text-navy-700 rounded-full text-sm"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-navy-900"
                  >
                    <Icon name="close" size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1.5">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              className="input"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows="4"
              className="input resize-none"
            />
          </div>
        </div>
      )}

      {/* System Properties Tab */}
      {activeTab === 'system' && (
        <div className="space-y-3 mb-6 max-h-[500px] overflow-y-auto">
          <div className="bg-navy-50 p-4 rounded-lg space-y-3">
            <div>
              <span className="text-xs font-medium text-navy-500">File Name</span>
              <p className="text-sm text-navy-900 mt-1">{item.name}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-navy-500">Type</span>
              <p className="text-sm text-navy-900 mt-1 capitalize">{item.type}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-navy-500">Size</span>
              <p className="text-sm text-navy-900 mt-1">{formatSize(item.size || 0)}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-navy-500">MIME Type</span>
              <p className="text-sm text-navy-900 mt-1 font-mono">{item.mimeType || 'application/octet-stream'}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-navy-500">Full Path</span>
              <p className="text-sm text-navy-900 mt-1 font-mono break-all">{item.fullPath || '/'}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-navy-500">File Hash (SHA-256)</span>
              <p className="text-xs text-navy-900 mt-1 font-mono break-all">{item.fileHash || 'N/A'}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-navy-500">Created</span>
              <p className="text-sm text-navy-900 mt-1">{formatDate(item.created || item.date)}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-navy-500">Modified</span>
              <p className="text-sm text-navy-900 mt-1">{formatDate(item.date)}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-navy-500">Last Accessed</span>
              <p className="text-sm text-navy-900 mt-1">{formatDate(item.lastAccessed || item.date)}</p>
            </div>
            {item.owner && (
              <div>
                <span className="text-xs font-medium text-navy-500">Owner</span>
                <p className="text-sm text-navy-900 mt-1">{item.owner}</p>
              </div>
            )}
            {item.version && (
              <div>
                <span className="text-xs font-medium text-navy-500">Version</span>
                <p className="text-sm text-navy-900 mt-1">{item.version}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="btn-secondary flex-1"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="btn-primary flex-1 flex items-center justify-center gap-2"
        >
          <Icon name="save" size={16} />
          Save Properties
        </button>
      </div>
    </Modal>
  );
}
