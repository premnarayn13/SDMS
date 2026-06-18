import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { sharingApi } from '../utils/api';

export default function ShareModal({ isOpen, onClose, item, onAddShare, onRemoveShare }) {
  const [email, setEmail] = useState('');
  const [shareLink, setShareLink] = useState('');
  useEffect(() => {
  if (!item) return;

  const generateLink = async () => {
    try {
      const response = await sharingApi.generateShareLink(item.id);

      setShareLink(
        response.data.url ||
        response.data.share_url ||
        response.data.link
      );
    } catch (err)  {
  console.error(
    'Share link generation failed:',
    err.response?.data || err
  );
}
  };

  generateLink();
  }, [item]);
  

  const handleAddShare = () => {
    if (!email.trim() || !email.includes('@')) return;
    onAddShare(item.id, email.trim());
    setEmail('');
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
  };

  const footer = (
    <button
      onClick={onClose}
      className="px-4 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-medium text-sm hover:bg-gray-200"
    >
      Done
    </button>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🔗 Share" footer={footer}>
      {/* Add People */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Add people</label>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="flex-1 p-3 border-2 border-gray-200 rounded-lg text-sm outline-none focus:border-blue-600"
            onKeyDown={(e) => e.key === 'Enter' && handleAddShare()}
          />
          <button
            onClick={handleAddShare}
            className="px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700"
          >
            Add
          </button>
        </div>
      </div>

      {/* People with access */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">People with access</label>
        <div className="max-h-[150px] overflow-y-auto">
          {item?.shared?.length > 0 ? (
            item.shared.map((s, idx) => (
              <div key={idx} className="flex items-center gap-2.5 p-2.5 rounded-lg mb-1.5 bg-gray-50">
                <div className="w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {s.email[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{s.email}</p>
                  <p className="text-xs text-gray-500">{s.permission}</p>
                </div>
                <button
                  onClick={() => onRemoveShare(item.id, s.email)}
                  className="bg-transparent border-none text-red-600 cursor-pointer text-base"
                >
                  ×
                </button>
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-center py-4 text-sm">No one has access yet</p>
          )}
        </div>
      </div>

      {/* Share Link */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Share Link</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={shareLink}
            readOnly
            className="flex-1 p-3 border-2 border-gray-200 rounded-lg text-sm outline-none bg-gray-50"
          />
          <button
            onClick={copyShareLink}
            className="px-4 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-medium text-sm hover:bg-gray-200"
          >
            📋 Copy
          </button>
        </div>
      </div>
    </Modal>
  );
}
