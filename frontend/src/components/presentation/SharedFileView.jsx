import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/api';
import { API_V1 } from '../../utils/documentApi';
import PublicLayout from './PublicLayout';
import { FileText, Download, Loader2, AlertCircle } from 'lucide-react';

export default function SharedFileView() {
  const { token } = useParams();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFile = async () => {
      try {
        const response = await api.get(`/v1/documents/public/${token}`);
        setFile(response.data);
      } catch (err) {
        setError('Invalid or expired share link.');
      } finally {
        setLoading(false);
      }
    };
    fetchFile();
  }, [token]);

  const handleDownload = () => {
    if (!file || !token) return;
    const downloadUrl = `${API_V1}/documents/public/${token}/download`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', file.name || file.display_name || 'shared-document');
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-[80vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
        </div>
      </PublicLayout>
    );
  }

  if (error || !file) {
    return (
      <PublicLayout>
        <div className="min-h-[80vh] flex items-center justify-center flex-col gap-4 text-slate-400">
          <AlertCircle className="w-12 h-12 text-red-500/80" />
          <h2 className="text-xl font-semibold text-white">Access Denied</h2>
          <p>{error}</p>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-24">
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl backdrop-blur-sm text-center">
          <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <FileText className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">{file.name}</h1>
          <p className="text-slate-400 mb-8">This file has been securely shared with you.</p>
          
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-full font-semibold hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg"
          >
            <Download className="w-5 h-5" /> Download File
          </button>
        </div>
      </div>
    </PublicLayout>
  );
}
