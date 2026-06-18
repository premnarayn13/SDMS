/**
 * DockyChat Component
 * Professional AI assistant for intelligent document management.
 * Matches DocMatrix design system with Indigo/Navy color scheme.
 * Integrates with AppContext to perform real file operations.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { executeAutonomous, getChatHistory, clearChatHistory, getAgentRealtimeWebSocketUrl } from '../utils/dockyApi';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { useApp } from '../context/AppContext';
import { documentOpsApi } from '../utils/documentApi';
import * as pdfTools from '../utils/pdfPowerTools';
import AllFeaturesPanel from './AllFeaturesPanel';

const DOCKY_SAFE_MODE_KEY = 'docky_safe_mode_enabled';
const DOCKY_TTS_KEY = 'docky_voice_output_enabled';
const DOCKY_REALTIME_KEY = 'docky_realtime_mode_enabled';
const DOCKY_INTERACTIVE_VOICE_KEY = 'docky_interactive_voice_mode_enabled';

const STOP_LISTENING_REGEX = /\b(stop listening|stop conversation|stop talking|enough|stop now|that's all|that is all|later if any need i call|i will call you later|bye docky|stop interactive mode)\b/i;
const PAUSE_ACTION_REGEX = /\b(pause|hold on|wait|stop this|stop action|abort|cancel|cancel it|cancel that|pause this)\b/i;
const INTERRUPT_ACTION_REGEX = /\b(stop|cancel|abort|pause|wait)\b/i;
const CHANGE_PLAN_REGEX = /\b(change plan|change action|new plan|different action|do this instead)\b/i;

export default function DockyChat({ onOpenFile, onShowAnalytics, onNotify }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [safeModeEnabled, setSafeModeEnabled] = useState(() => localStorage.getItem(DOCKY_SAFE_MODE_KEY) === 'true');
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(() => localStorage.getItem(DOCKY_TTS_KEY) === 'true');
  const [realtimeModeEnabled, setRealtimeModeEnabled] = useState(() => localStorage.getItem(DOCKY_REALTIME_KEY) === 'true');
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [realtimeStatusText, setRealtimeStatusText] = useState('');
  const [ttsSupported, setTtsSupported] = useState(false);
  const [interactiveVoiceModeEnabled, setInteractiveVoiceModeEnabled] = useState(() => localStorage.getItem(DOCKY_INTERACTIVE_VOICE_KEY) === 'true');
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  const [ttsSpeaking, setTtsSpeaking] = useState(false);
  const [showVoiceGuide, setShowVoiceGuide] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const realtimeSocketRef = useRef(null);
  const realtimePendingRef = useRef({});
  const realtimePingRef = useRef(null);
  const activeExecutionRef = useRef({ mode: null, requestId: null, abortController: null });
  const autoVoiceSubmitLockRef = useRef(false);
  const lastVoiceFinalRef = useRef('');
  const pendingInputRef = useRef('');
  const ttsVoicesRef = useRef([]);
  const ttsGuardUntilRef = useRef(0);
  const resumeListeningAfterSpeechRef = useRef(false);
  const spokenEchoHistoryRef = useRef([]);
  const sessionStoppedByVoiceRef = useRef(false);
  const lastInteractivePromptAtRef = useRef(0);
  
  const {
    isListening,
    transcript,
    finalTranscript,
    isSupported: voiceSupported,
    startListening,
    stopListening,
    resetTranscript,
    clearFinalTranscript
  } = useVoiceRecognition({
    continuous: interactiveVoiceModeEnabled,
    autoRestart: interactiveVoiceModeEnabled,
    interimResults: true,
    language: 'en-US'
  });

  // Get app context for performing real actions
  const { state, actions } = useApp();
  const items = state?.items || [];
  
  // Debug log actions availability
  useEffect(() => {
    console.log('🔧 DockyChat actions available:', Object.keys(actions || {}));
    console.log('📁 Items loaded:', items.length);
    if (items.length > 0) {
      console.log('📄 Sample items:', items.slice(0, 3).map(i => ({ id: i.id, name: i.name, type: i.type })));
    }
  }, [actions, items.length]);

  useEffect(() => {
    localStorage.setItem(DOCKY_SAFE_MODE_KEY, String(safeModeEnabled));
  }, [safeModeEnabled]);

  useEffect(() => {
    localStorage.setItem(DOCKY_TTS_KEY, String(voiceOutputEnabled));
  }, [voiceOutputEnabled]);

  useEffect(() => {
    localStorage.setItem(DOCKY_REALTIME_KEY, String(realtimeModeEnabled));
  }, [realtimeModeEnabled]);

  useEffect(() => {
    localStorage.setItem(DOCKY_INTERACTIVE_VOICE_KEY, String(interactiveVoiceModeEnabled));
  }, [interactiveVoiceModeEnabled]);

  useEffect(() => {
    setTtsSupported(typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window);
  }, []);

  const normalizeSpeechText = useCallback((value) => {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const isStopListeningPhrase = useCallback((value) => {
    return STOP_LISTENING_REGEX.test(String(value || ''));
  }, []);

  const isPauseActionPhrase = useCallback((value) => {
    return PAUSE_ACTION_REGEX.test(String(value || ''));
  }, []);

  const isInterruptActionPhrase = useCallback((value) => {
    return INTERRUPT_ACTION_REGEX.test(String(value || ''));
  }, []);

  const isPlanChangePhrase = useCallback((value) => {
    return CHANGE_PLAN_REGEX.test(String(value || ''));
  }, []);

  const isLikelyEchoTranscript = useCallback((value) => {
    const normalized = normalizeSpeechText(value);
    if (!normalized) return false;

    const words = normalized.split(' ').filter(Boolean);
    if (words.length < 3) return false;

    const history = spokenEchoHistoryRef.current;
    for (const spoken of history) {
      if (!spoken) continue;
      if (normalized.includes(spoken) || spoken.includes(normalized)) {
        return true;
      }

      const spokenWords = new Set(spoken.split(' ').filter(Boolean));
      const overlap = words.filter(w => spokenWords.has(w)).length;
      if (overlap >= Math.max(3, Math.floor(words.length * 0.65))) {
        return true;
      }
    }
    return false;
  }, [normalizeSpeechText]);

  useEffect(() => {
    if (!ttsSupported) return;
    const synth = window.speechSynthesis;

    const pickPreferredVoice = () => {
      const voices = synth.getVoices() || [];
      ttsVoicesRef.current = voices;
      if (!voices.length) return;

      const preferred =
        voices.find(v => /microsoft/i.test(v.name) && /^en/i.test(v.lang)) ||
        voices.find(v => /google/i.test(v.name) && /^en/i.test(v.lang)) ||
        voices.find(v => /^en/i.test(v.lang)) ||
        voices[0];

      if (preferred?.name) {
        setSelectedVoiceName(preferred.name);
      }
    };

    pickPreferredVoice();
    synth.onvoiceschanged = pickPreferredVoice;

    return () => {
      synth.onvoiceschanged = null;
    };
  }, [ttsSupported]);

  const stopSpeaking = useCallback((opts = {}) => {
    if (!ttsSupported) return;
    const { allowAutoResume = false } = opts;
    if (!allowAutoResume) resumeListeningAfterSpeechRef.current = false;
    try {
      window.speechSynthesis.cancel();
    } catch (_) {
      // noop
    }
    setTtsSpeaking(false);
    // Short guard – just enough to avoid immediate echo pickup
    ttsGuardUntilRef.current = Date.now() + 400;
  }, [ttsSupported]);

  const interruptActiveExecution = useCallback(async (reason = 'User interruption') => {
    // Allow mic auto-resume after interruption so interactive loop continues
    stopSpeaking({ allowAutoResume: true });

    const active = activeExecutionRef.current;
    if (!active?.mode) return;

    if (active.mode === 'http' && active.abortController) {
      active.abortController.abort();
    }

    if (active.mode === 'realtime' && active.requestId && realtimeSocketRef.current?.readyState === WebSocket.OPEN) {
      realtimeSocketRef.current.send(JSON.stringify({
        type: 'interrupt',
        target_request_id: active.requestId,
      }));

      if (realtimePendingRef.current[active.requestId]) {
        realtimePendingRef.current[active.requestId].reject(new Error(reason));
        delete realtimePendingRef.current[active.requestId];
      }
    }

    activeExecutionRef.current = { mode: null, requestId: null, abortController: null };
    setRealtimeStatusText('Interrupted. Listening for next instruction...');
  }, [stopSpeaking]);

  const buildInteractiveSpokenResponse = useCallback((response, fallbackText) => {
    const actions = Array.isArray(response?.actions_executed) ? response.actions_executed : [];
    const successfulActions = actions.filter(action => action?.success);

    if (successfulActions.length > 0) {
      const spokenParts = successfulActions.slice(0, 3).map((action) => {
        const fn = String(action.function_name || '').toLowerCase();
        const data = action.data || {};

        if (fn === 'open_file') {
          return `I opened ${data.filename || data.name || 'the file'}.`;
        }
        if (fn === 'download_file') {
          return `I started downloading ${data.filename || data.name || 'the file'}.`;
        }
        if (fn === 'move_file') {
          return `I moved ${data.filename || 'the file'}.`;
        }
        if (fn === 'rename_file') {
          return `I renamed the file.`;
        }
        if (fn === 'delete_file') {
          return `I moved the file to trash.`;
        }
        if (fn === 'search_files') {
          const total = data.total || (Array.isArray(data.results) ? data.results.length : null);
          return total ? `I found ${total} matching files.` : 'I completed the search.';
        }
        return `I completed ${fn.replace(/_/g, ' ')}.`;
      });

      return `${spokenParts.join(' ')} What would you like next?`;
    }

    const concise = String(fallbackText || '').split('\n')[0].trim();
    if (!concise) return 'Done. What would you like next?';
    return `${concise} What would you like next?`;
  }, []);

  const buildActionDataPreview = useCallback((action) => {
    const data = action?.data || {};
    const functionName = String(action?.function_name || '');

    if (Array.isArray(data.files)) {
      const fileNames = data.files
        .slice(0, 5)
        .map((file) => (file?.name || file?.original_filename || file?.filename || '').trim())
        .filter(Boolean);

      if (fileNames.length > 0) {
        const suffix = data.files.length > fileNames.length ? ', …' : '';
        return `${data.count ?? data.files.length} file${(data.count ?? data.files.length) !== 1 ? 's' : ''}: ${fileNames.join(', ')}${suffix}`;
      }
    }

    if (Array.isArray(data.folders)) {
      const folderNames = data.folders
        .slice(0, 5)
        .map((folder) => (folder?.name || '').trim())
        .filter(Boolean);

      if (folderNames.length > 0) {
        const suffix = data.folders.length > folderNames.length ? ', …' : '';
        return `${data.count ?? data.folders.length} folder${(data.count ?? data.folders.length) !== 1 ? 's' : ''}: ${folderNames.join(', ')}${suffix}`;
      }
    }

    if (functionName === 'get_storage_info' && data.storage) {
      const storage = data.storage;
      return `${storage.used_readable || '0 B'} / ${storage.total_readable || '0 B'} used`;
    }

    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message.trim();
    }

    const compact = JSON.stringify(data);
    return compact.length > 80 ? `${compact.substring(0, 80)}...` : compact;
  }, []);

  const speakAssistantResponse = useCallback((text) => {
    // In interactive voice mode, always speak responses regardless of voiceOutputEnabled toggle
    const shouldSpeak = interactiveVoiceModeEnabled || voiceOutputEnabled;
    if (!shouldSpeak || !ttsSupported || !text) return;
    try {
      const synth = window.speechSynthesis;
      synth.cancel();

      ttsGuardUntilRef.current = Date.now() + 250;
      resumeListeningAfterSpeechRef.current = false;
      if (interactiveVoiceModeEnabled && isListening) {
        resumeListeningAfterSpeechRef.current = true;
        stopListening();
      }

      const clean = String(text)
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const normalizedSpoken = normalizeSpeechText(clean);
      if (normalizedSpoken) {
        const nextHistory = [normalizedSpoken, ...spokenEchoHistoryRef.current].slice(0, 6);
        spokenEchoHistoryRef.current = nextHistory;
      }

      const chunks = clean
        .match(/[^.!?]+[.!?]?/g)
        ?.map(segment => segment.trim())
        .filter(Boolean) || [clean];

      const selectedVoice = ttsVoicesRef.current.find(v => v.name === selectedVoiceName)
        || ttsVoicesRef.current.find(v => /^en/i.test(v.lang))
        || null;

      setTtsSpeaking(true);
      chunks.forEach((chunk, index) => {
        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.rate = 0.92;
        utterance.pitch = 1;
        utterance.volume = 1;
        if (selectedVoice) utterance.voice = selectedVoice;

        if (index === chunks.length - 1) {
          utterance.onend = () => {
            setTtsSpeaking(false);
            // Short guard – prevents echo but lets mic restart quickly
            ttsGuardUntilRef.current = Date.now() + 600;
            if (interactiveVoiceModeEnabled && resumeListeningAfterSpeechRef.current && !sessionStoppedByVoiceRef.current) {
              resumeListeningAfterSpeechRef.current = false;
              setTimeout(() => {
                if (sessionStoppedByVoiceRef.current) return;
                try { startListening(); } catch (e) { console.warn('Resume after TTS failed:', e); }
              }, 250);
            }
          };
          utterance.onerror = () => {
            setTtsSpeaking(false);
            ttsGuardUntilRef.current = Date.now() + 400;
            if (interactiveVoiceModeEnabled && resumeListeningAfterSpeechRef.current && !sessionStoppedByVoiceRef.current) {
              resumeListeningAfterSpeechRef.current = false;
              setTimeout(() => {
                if (sessionStoppedByVoiceRef.current) return;
                try { startListening(); } catch (e) { console.warn('Resume after TTS error:', e); }
              }, 250);
            }
          };
        }
        synth.speak(utterance);
      });
    } catch (error) {
      console.error('TTS failed:', error);
      setTtsSpeaking(false);
      ttsGuardUntilRef.current = Date.now() + 400;
      if (interactiveVoiceModeEnabled && resumeListeningAfterSpeechRef.current && !sessionStoppedByVoiceRef.current) {
        resumeListeningAfterSpeechRef.current = false;
        setTimeout(() => {
          if (sessionStoppedByVoiceRef.current) return;
          try { startListening(); } catch (_) { /* noop */ }
        }, 250);
      }
    }
  }, [voiceOutputEnabled, ttsSupported, selectedVoiceName, interactiveVoiceModeEnabled, isListening, stopListening, startListening, normalizeSpeechText]);

  // Find a file in local items by name (fuzzy match)
  const findLocalFile = useCallback((filename) => {
    if (!filename) return null;
    const query = filename.toLowerCase().replace(/['"]/g, '').trim();
    
    // Exact match first
    let found = items.find(i => i.name?.toLowerCase() === query);
    if (found) return found;
    
    // Contains match
    found = items.find(i => i.name?.toLowerCase().includes(query));
    if (found) return found;
    
    // Partial match (query words in filename)
    const words = query.split(/[\s._-]+/).filter(w => w.length > 1);
    found = items.find(i => {
      const name = i.name?.toLowerCase() || '';
      return words.every(w => name.includes(w));
    });
    if (found) return found;
    
    // Fuzzy: allow 1-2 char differences
    found = items.find(i => {
      const name = i.name?.toLowerCase() || '';
      if (Math.abs(name.length - query.length) > 3) return false;
      let diff = 0;
      for (let j = 0; j < Math.min(name.length, query.length); j++) {
        if (name[j] !== query[j]) diff++;
        if (diff > 2) return false;
      }
      return diff <= 2;
    });
    return found || null;
  }, [items]);

  const isChatOnlyInput = useCallback((text) => {
    const message = String(text || '').trim().toLowerCase();
    if (!message) return true;

    const actionVerbs = [
      'open', 'download', 'rename', 'move', 'delete', 'trash', 'tag', 'favorite', 'favourite',
      'star', 'create folder', 'rename folder', 'move folder', 'delete folder', 'set folder color',
      'share', 'unshare', 'remove share', 'duplicate', 'restore', 'upload',
      'convert', 'extract', 'extract text', 'extract entities', 'extract keywords',
      'detect language', 'text stats', 'find duplicates', 'find similar', 'search files',
      'list recent', 'list files', 'list folders', 'folder tree', 'filter', 'analytics', 'storage',
      'activity log', 'version history', 'preferences', 'batch move', 'batch tag', 'batch delete'
    ];
    if (actionVerbs.some(v => message.includes(v))) return false;

    const filePattern = /\b[A-Za-z0-9 _-]+\.(pdf|docx?|xlsx?|pptx?|txt|csv|md|png|jpe?g|gif|bmp|webp)\b/i;
    if (filePattern.test(message)) return false;

    const chatMarkers = [
      'hi', 'hello', 'hey', 'who are you', 'what is your name', 'what can you do', 'how can you help',
      'how could you help', 'help me', 'can you chat', 'talk to me', 'thank you', 'thanks', 'how are you'
    ];
    if (chatMarkers.some(marker => message.includes(marker))) return true;

    return message.includes('?') && message.split(/\s+/).length <= 30;
  }, []);

  const buildChatOnlyFallback = useCallback((text) => {
    const message = String(text || '').trim().toLowerCase();
    if (message.includes('name') || message.includes('who are you')) {
      return 'I’m Docky, your AI assistant in DocMatrix. I can chat with you and help with file actions when you ask.';
    }
    if (message.includes('help') || message.includes('what can you do') || message.includes('how can you help') || message.includes('how could you help')) {
      return 'I can chat naturally and also perform file actions like search, rename, move, tag, favorite, and conversion when requested.';
    }
    if (message.includes('hi') || message.includes('hello') || message.includes('hey') || message.includes('how are you')) {
      return 'Hi! I’m here and ready to help. You can chat with me or ask me to run a document action.';
    }
    return 'I understand. I’m here to chat and help. If you want an action, tell me exactly what file operation to run.';
  }, []);

  // Execute a Docky action on the frontend
  const executeAction = useCallback(async (response) => {
    const { command_type, results, action_data } = response;
    const data = action_data || {};
    
    console.log('🎯 Executing action:', { command_type, data, items_count: items.length });
    
    if (command_type === 'open') {
      const filename = data.filename || results?.file_name || results?.results?.[0]?.filename;
      const directViewUrl = data.view_url || data.download_url || results?.view_url || results?.download_url;
      const file = (data.file_id && items.find(i => i.id === data.file_id)) || findLocalFile(filename);
      console.log('📂 Open action:', { file_found: !!file, file_id: data.file_id, filename });
      if (file && onOpenFile) {
        try {
          await Promise.resolve(onOpenFile(file.id));
          return `✅ Opening "${file.name}" in viewer...`;
        } catch (error) {
          console.error('❌ Open failed:', error);
          return `❌ Failed to open: ${error.message}`;
        }
      } else if (directViewUrl) {
        try {
          window.open(directViewUrl, '_blank', 'noopener,noreferrer');
          return `✅ Opened "${filename || 'file'}"`;
        } catch (error) {
          console.error('❌ URL open failed:', error);
          return `❌ Failed to open file URL: ${error.message}`;
        }
      } else if (file && actions.selectItem) {
        // Select the file so user can open it
        actions.selectItem(file.id);
        return `✅ Found "${file.name}". Click on it to open.`;
      } else {
        return `❌ Could not find file to open: ${filename || 'Unknown'}`;
      }
    }
    
    if (command_type === 'rename' && data.file_id) {
      const file = items.find(i => i.id === data.file_id) || findLocalFile(data.old_name);
      console.log('🔄 Rename action:', { file_found: !!file, file_id: data.file_id, new_name: data.new_name, file_name: file?.name });
      if (file && data.new_name && actions.renameItem) {
        console.log('📝 Calling renameItem action...');
        try {
          await actions.renameItem(file.id, data.new_name);
          return `✅ Renamed "${file.name}" to "${data.new_name}"`;
        } catch (error) {
          console.error('❌ Rename failed:', error);
          return `❌ Failed to rename: ${error.message}`;
        }
      } else {
        return `❌ Could not find file to rename: ${data.old_name || data.filename || 'Unknown'}`;
      }
    }
    
    if (command_type === 'delete' && data.file_id) {
      const file = items.find(i => i.id === data.file_id) || findLocalFile(data.filename);
      console.log('🗑️ Delete action:', { file_found: !!file, file_id: data.file_id });
      if (file && actions.moveToTrash) {
        try {
          await actions.moveToTrash(file.id);
          return `✅ Moved "${file.name}" to trash`;
        } catch (error) {
          console.error('❌ Delete failed:', error);
          return `❌ Failed to delete: ${error.message}`;
        }
      } else {
        return `❌ Could not find file to delete: ${data.filename || 'Unknown'}`;
      }
    }
    
    if (command_type === 'favorite') {
      const file = (data.file_id && items.find(i => i.id === data.file_id)) || findLocalFile(data.filename);
      console.log('⭐ Favorite action:', { file_found: !!file, file_id: data.file_id, file_name: file?.name });
      if (file && actions.toggleFavorite) {
        try {
          await actions.toggleFavorite(file.id);
          return `✅ ${file.favorite ? 'Removed from' : 'Added to'} favorites: "${file.name}"`;
        } catch (error) {
          console.error('❌ Favorite failed:', error);
          return `❌ Failed to toggle favorite: ${error.message}`;
        }
      } else {
        return `❌ Could not find file to favorite: ${data.filename || 'Unknown'}`;
      }
    }

    if (command_type === 'download') {
      const file = (data.file_id && items.find(i => i.id === data.file_id)) || findLocalFile(data.filename);
      const directDownloadUrl = data.download_url || data.view_url || results?.download_url || results?.view_url;
      console.log('📥 Download action:', { file_found: !!file, file_id: data.file_id });
      if (file && file.id) {
        try {
          const blob = await documentOpsApi.downloadDocument(file.id);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          a.click();
          URL.revokeObjectURL(url);
          return `✅ Downloading "${file.name}"...`;
        } catch (error) {
          console.error('❌ Download error:', error);
          return `❌ Failed to download: ${error.message}`;
        }
      } else if (directDownloadUrl) {
        try {
          window.open(directDownloadUrl, '_blank', 'noopener,noreferrer');
          return `✅ Download started for "${data.filename || 'file'}"`;
        } catch (error) {
          console.error('❌ Download URL error:', error);
          return `❌ Failed to start download: ${error.message}`;
        }
      } else {
        return `❌ Could not find file to download: ${data.filename || 'Unknown'}`;
      }
    }

    if (command_type === 'tag' && data.tag) {
      const file = (data.file_id && items.find(i => i.id === data.file_id)) || findLocalFile(data.filename);
      console.log('🏷️ Tag action:', { file_found: !!file, file_id: data.file_id, tag: data.tag });
      if (file && actions.addTag) {
        try {
          await actions.addTag(file.id, data.tag);
          return `✅ Added tag "${data.tag}" to "${file.name}"`;
        } catch (error) {
          console.error('❌ Tag failed:', error);
          return `❌ Failed to add tag: ${error.message}`;
        }
      } else {
        return `❌ Could not find file to tag: ${data.filename || 'Unknown'}`;
      }
    }

    if (command_type === 'move' && data.destination) {
      const file = (data.file_id && items.find(i => i.id === data.file_id)) || findLocalFile(data.filename);
      const folder = items.find(i => i.type === 'folder' && i.name?.toLowerCase().includes(data.destination.toLowerCase()));
      console.log('📦 Move action:', { file_found: !!file, folder_found: !!folder });
      if (file && folder && actions.moveItem) {
        try {
          await actions.moveItem(file.id, folder.id);
          return `✅ Moved "${file.name}" to "${folder.name}"`;
        } catch (error) {
          console.error('❌ Move failed:', error);
          return `❌ Failed to move: ${error.message}`;
        }
      } else if (!folder) {
        return `❌ Could not find destination folder: ${data.destination}`;
      } else {
        return `❌ Could not find file to move: ${data.filename || 'Unknown'}`;
      }
    }

    if (command_type === 'upload') {
      // Trigger the upload dialog
      try {
        const uploadBtn = document.querySelector('[data-upload-trigger]') || document.querySelector('input[type="file"]');
        if (uploadBtn) {
          uploadBtn.click();
          return '✅ Opening upload dialog...';
        } else {
          return '❌ Upload button not found. Please use the upload button in the toolbar.';
        }
      } catch (error) {
        console.error('❌ Upload error:', error);
        return `❌ Failed to open upload: ${error.message}`;
      }
    }

    if (command_type === 'analytics') {
      // Open analytics dashboard
      console.log('📊 Analytics action');
      if (onShowAnalytics) {
        try {
          await Promise.resolve(onShowAnalytics());
          return '✅ Opening analytics dashboard...';
        } catch (error) {
          console.error('❌ Analytics error:', error);
          return `❌ Failed to open analytics: ${error.message}`;
        }
      } else {
        return '❌ Analytics dashboard not available';
      }
    }

    if (command_type === 'power_tool') {
      const operation = String(data.operation || '').toLowerCase();
      const targetFormat = String(data.target_format || '').toLowerCase();
      const saveToStorage = data.save_to_storage !== false;
      const shouldExport = data.export !== false;
      const pageNumbersInput = data.page_numbers || data.pages || '';
      const rangesInput = data.ranges || [];
      const copies = Math.max(1, parseInt(data.copies || 1, 10) || 1);
      const rotationDegrees = parseInt(data.rotation_degrees || 0, 10) || 0;
      const outputName = data.output_name || 'merged.pdf';
      const file = (data.file_id && items.find(i => i.id === data.file_id)) || findLocalFile(data.filename);

      const parsePageNumbers = (value) => {
        if (Array.isArray(value)) {
          return value.map(v => parseInt(v, 10) - 1).filter(v => !isNaN(v));
        }
        const text = String(value || '').trim();
        if (!text) return [];
        const parts = text.split(',');
        const results = [];
        parts.forEach(part => {
          const token = part.trim();
          if (!token) return;
          if (token.includes('-')) {
            const [startRaw, endRaw] = token.split('-');
            const start = parseInt(startRaw, 10);
            const end = parseInt(endRaw, 10);
            if (isNaN(start) || isNaN(end)) return;
            const minVal = Math.min(start, end);
            const maxVal = Math.max(start, end);
            for (let i = minVal; i <= maxVal; i += 1) {
              results.push(i - 1);
            }
          } else {
            const num = parseInt(token, 10);
            if (!isNaN(num)) results.push(num - 1);
          }
        });
        return results;
      };

      if (!file) {
        return `❌ Could not find file for power tool action: ${data.filename || data.file_id || 'Unknown'}`;
      }

      const sourceName = file.name || data.filename || 'file';
      const sourceExt = sourceName.includes('.') ? sourceName.split('.').pop().toLowerCase() : '';

      const ensureFileBlob = async (targetFile) => {
        const candidate = targetFile || file;
        if (!candidate) throw new Error('Cannot access file content');
        if (candidate.dataUrl) {
          return await fetch(candidate.dataUrl).then(r => r.blob());
        }
        if (candidate.id) {
          return await documentOpsApi.downloadDocument(candidate.id);
        }
        throw new Error('Cannot access file content');
      };

      const ensureFileById = async (fileId) => {
        const match = items.find(i => i.id === fileId);
        if (match) return match;
        if (!fileId) return null;
        const blob = await documentOpsApi.downloadDocument(fileId);
        return new File([blob], `${fileId}.pdf`, { type: blob.type || 'application/pdf' });
      };

      if (operation !== 'convert') {
        const pageNumbers = parsePageNumbers(pageNumbersInput);

        if (operation === 'add_pages') {
          if (!actions.addPDFPages) return '❌ Add pages is not available.';
          const count = Math.max(1, parseInt(data.count || 1, 10) || 1);
          const position = data.position || 'end';
          const size = data.size || 'A4';
          await actions.addPDFPages(file.id, { position, count, size });
          return `✅ Added ${count} page(s).`;
        }

        if (operation === 'delete_pages') {
          if (!actions.removePDFPages) return '❌ Remove pages is not available.';
          if (!pageNumbers.length) return '❌ Provide page numbers to delete.';
          await actions.removePDFPages(file.id, pageNumbers);
          return `✅ Deleted ${pageNumbers.length} page(s).`;
        }

        if (operation === 'insert_pages') {
          if (!actions.insertPDFPagesFromPDF) return '❌ Insert pages is not available.';
          const insertFileId = data.insert_file_id || data.insertFileId;
          const insertFile = await ensureFileById(insertFileId);
          if (!insertFile) return '❌ Provide insert_file_id to insert pages.';
          const position = data.position || 'end';
          await actions.insertPDFPagesFromPDF(file.id, insertFile, { position });
          return '✅ Inserted pages from another PDF.';
        }

        if (operation === 'duplicate_pages') {
          if (!actions.duplicatePDFPages) return '❌ Duplicate pages is not available.';
          if (!pageNumbers.length) return '❌ Provide page numbers to duplicate.';
          await actions.duplicatePDFPages(file.id, pageNumbers, copies);
          return `✅ Duplicated ${pageNumbers.length} page(s).`;
        }

        if (operation === 'extract_pages') {
          if (!actions.extractPDFPages) return '❌ Extract pages is not available.';
          if (!pageNumbers.length) return '❌ Provide page numbers to extract.';
          await actions.extractPDFPages(file.id, pageNumbers);
          return `✅ Extracted ${pageNumbers.length} page(s).`;
        }

        if (operation === 'split_pages') {
          if (!actions.splitPDFToSinglePages) return '❌ Split to single pages is not available.';
          await actions.splitPDFToSinglePages(file.id);
          return '✅ Split into single-page PDFs.';
        }

        if (operation === 'split_ranges') {
          if (!actions.splitPDFByRange) return '❌ Split ranges is not available.';
          const ranges = Array.isArray(rangesInput) ? rangesInput : [];
          if (!ranges.length) return '❌ Provide ranges to split.';
          await actions.splitPDFByRange(file.id, ranges);
          return `✅ Split into ${ranges.length} range(s).`;
        }

        if (operation === 'reorder_pages') {
          if (!actions.reorderPDFPages) return '❌ Reorder pages is not available.';
          if (!pageNumbers.length) return '❌ Provide new page order.';
          await actions.reorderPDFPages(file.id, pageNumbers);
          return '✅ Reordered pages.';
        }

        if (operation === 'rotate_pages') {
          if (!actions.rotatePDFPages) return '❌ Rotate pages is not available.';
          await actions.rotatePDFPages(file.id, rotationDegrees || 90, pageNumbers.length ? pageNumbers : null);
          return `✅ Rotated pages ${rotationDegrees || 90}°.`;
        }

        if (operation === 'compress_pdf') {
          if (!actions.compressPDF) return '❌ Compress PDF is not available.';
          await actions.compressPDF(file.id);
          return '✅ Compressed PDF.';
        }

        if (operation === 'merge_pdfs') {
          if (!actions.mergePDFs) return '❌ Merge PDFs is not available.';
          const fileIds = Array.isArray(data.file_ids) ? data.file_ids : [];
          if (fileIds.length < 2) return '❌ Provide at least 2 file ids to merge.';
          await actions.mergePDFs(fileIds, outputName);
          return '✅ Merged PDFs.';
        }

        if (operation === 'extract_tables') {
          if (!actions.extractPDFTables) return '❌ Extract tables is not available.';
          await actions.extractPDFTables(file.id);
          return '✅ Extracted tables to CSV.';
        }

        if (operation === 'extract_fonts') {
          if (!actions.extractPDFFonts) return '❌ Extract fonts is not available.';
          await actions.extractPDFFonts(file.id);
          return '✅ Extracted embedded fonts list.';
        }

        if (operation === 'password_protect') {
          if (!actions.passwordProtectPDF) return '❌ Password protect is not available.';
          const userPassword = data.user_password || data.password || '1234';
          const ownerPassword = data.owner_password || data.password || userPassword;
          await actions.passwordProtectPDF(file.id, { userPassword, ownerPassword });
          return '✅ Password protection applied.';
        }

        if (operation === 'remove_password') {
          if (!actions.removePasswordPDF) return '❌ Remove password is not available.';
          const password = data.password || data.user_password || '';
          if (!password) return '❌ Provide password to unlock the PDF.';
          await actions.removePasswordPDF(file.id, password);
          return '✅ Password removed from PDF.';
        }

        if (operation === 'pdf_to_text') {
          if (!actions.pdfToText) return '❌ PDF to text is not available.';
          await actions.pdfToText(file.id);
          return '✅ Converted PDF to text.';
        }

        if (operation === 'pdf_to_images') {
          if (!actions.pdfToImages) return '❌ PDF to images is not available.';
          const generated = await actions.pdfToImages(file.id);
          return `✅ Converted PDF to ${Array.isArray(generated) ? generated.length : 0} image(s).`;
        }

        if (operation === 'images_to_pdf') {
          if (!actions.imagesToPDF) return '❌ Images to PDF is not available.';
          const imageIds = Array.isArray(data.file_ids) && data.file_ids.length ? data.file_ids : [file.id];
          await actions.imagesToPDF(imageIds, outputName || 'images.pdf');
          return '✅ Converted images to PDF.';
        }

        if (operation === 'doc_to_pdf') {
          if (!actions.docToPDF) return '❌ DOC to PDF is not available.';
          await actions.docToPDF(file.id);
          return '✅ Converted document to PDF.';
        }

        return `❌ Unsupported power tool operation: ${operation || 'unknown'}`;
      }

      try {
        let outputName = sourceName;
        let outputMime = 'application/octet-stream';
        let outputBytes = null;
        let outputBlob = null;

        if (sourceExt === 'pdf' && (targetFormat === 'doc' || targetFormat === 'docx')) {
          outputName = sourceName.replace(/\.pdf$/i, '.doc');
          outputMime = 'application/msword';
          const sourceBlob = await ensureFileBlob();
          const sourceUrl = file.dataUrl || URL.createObjectURL(sourceBlob);
          outputBlob = await pdfTools.pdfToDoc(sourceUrl);
          if (!file.dataUrl) URL.revokeObjectURL(sourceUrl);
        } else if (sourceExt === 'pdf' && (targetFormat === 'txt' || targetFormat === 'text')) {
          outputName = sourceName.replace(/\.pdf$/i, '.txt');
          outputMime = 'text/plain;charset=utf-8';
          const sourceBlob = await ensureFileBlob();
          const sourceUrl = file.dataUrl || URL.createObjectURL(sourceBlob);
          const extracted = await pdfTools.pdfToText(sourceUrl);
          if (!file.dataUrl) URL.revokeObjectURL(sourceUrl);
          outputBlob = new Blob([extracted], { type: outputMime });
        } else if ((sourceExt === 'doc' || sourceExt === 'docx') && targetFormat === 'pdf') {
          outputName = sourceName.replace(/\.(docx?)$/i, '.pdf');
          outputMime = 'application/pdf';
          const sourceBlob = await ensureFileBlob();
          const sourceFile = new File([sourceBlob], sourceName, { type: file.mimeType || sourceBlob.type || 'application/octet-stream' });
          outputBytes = await pdfTools.docToPDF(sourceFile);
        } else if ((sourceExt === 'txt' || sourceExt === 'md' || sourceExt === 'csv' || sourceExt === 'log') && targetFormat === 'pdf') {
          outputName = sourceName.replace(/\.[^.]+$/, '.pdf');
          outputMime = 'application/pdf';
          const sourceBlob = await ensureFileBlob();
          const sourceFile = new File([sourceBlob], sourceName, { type: file.mimeType || sourceBlob.type || 'text/plain' });
          outputBytes = await pdfTools.txtToPDF(sourceFile);
        } else if ((sourceExt === 'ppt' || sourceExt === 'pptx') && targetFormat === 'pdf') {
          outputName = sourceName.replace(/\.(pptx?)$/i, '.pdf');
          outputMime = 'application/pdf';
          const sourceBlob = await ensureFileBlob();
          const sourceFile = new File([sourceBlob], sourceName, { type: file.mimeType || sourceBlob.type || 'application/octet-stream' });
          outputBytes = await pdfTools.pptToPDF(sourceFile);
        } else if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'].includes(sourceExt) && targetFormat === 'pdf') {
          outputName = sourceName.replace(/\.[^.]+$/, '.pdf');
          outputMime = 'application/pdf';
          const sourceBlob = await ensureFileBlob();
          const sourceUrl = file.dataUrl || URL.createObjectURL(sourceBlob);
          outputBytes = await pdfTools.imagesToPDF([sourceUrl], { pageSize: 'A4', orientation: 'portrait' });
          if (!file.dataUrl) URL.revokeObjectURL(sourceUrl);
        } else if (sourceExt === 'pdf' && (targetFormat === 'images' || targetFormat === 'png' || targetFormat === 'jpg' || targetFormat === 'jpeg')) {
          const sourceBlob = await ensureFileBlob();
          const sourceUrl = file.dataUrl || URL.createObjectURL(sourceBlob);
          const images = await pdfTools.pdfToImages(sourceUrl, { format: targetFormat === 'jpg' ? 'jpeg' : 'png', scale: 2 });
          if (!file.dataUrl) URL.revokeObjectURL(sourceUrl);

          if (saveToStorage && actions.uploadFile) {
            for (const img of images) {
              const imgBlob = await fetch(img.dataUrl).then(r => r.blob());
              const convertedFile = new File([imgBlob], img.name, { type: imgBlob.type || 'image/png' });
              await actions.uploadFile(convertedFile, file.parentId ?? null);
            }
          }

          if (shouldExport) {
            for (const img of images) {
              const link = document.createElement('a');
              link.href = img.dataUrl;
              link.download = img.name;
              link.click();
            }
          }

          return `✅ Power tool conversion complete: ${sourceName} → ${images.length} image(s)`;
        } else {
          return `❌ Conversion not supported yet: ${sourceExt || 'unknown'} → ${targetFormat || 'unknown'}`;
        }

        const finalBlob = outputBlob || new Blob([outputBytes], { type: outputMime });

        if (saveToStorage && actions.uploadFile) {
          const convertedFile = new File([finalBlob], outputName, { type: outputMime });
          await actions.uploadFile(convertedFile, file.parentId ?? null);
        }

        if (shouldExport) {
          const downloadBlob = outputBlob || new Blob([outputBytes], { type: outputMime });
          const url = URL.createObjectURL(downloadBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = outputName;
          a.click();
          URL.revokeObjectURL(url);
        }

        return `✅ Power tool conversion complete: ${sourceName} → ${outputName}`;
      } catch (error) {
        console.error('❌ Power tool conversion failed:', error);
        return `❌ Power tool conversion failed: ${error.message}`;
      }
    }

    // Return null if no action was executed
    console.log('ℹ️ No action executed for command:', command_type);
    return null;
  }, [items, actions, findLocalFile, onOpenFile, onShowAnalytics, isChatOnlyInput, buildChatOnlyFallback]);

  // Load chat history on mount
  useEffect(() => {
    loadChatHistory();
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Handle voice transcript
  useEffect(() => {
    if (transcript) {
      const transcriptText = String(transcript || '').trim();
      if (!transcriptText) return;

      if (isStopListeningPhrase(transcriptText)) {
        sessionStoppedByVoiceRef.current = true;
        stopListening();
        stopSpeaking();
        interruptActiveExecution('Stopped by voice command');
        setRealtimeStatusText('Interactive listening stopped by your voice command.');
        return;
      }

      const shouldInterruptCurrent = isPauseActionPhrase(transcriptText) || isPlanChangePhrase(transcriptText) || isInterruptActionPhrase(transcriptText);
      if (shouldInterruptCurrent && (isLoading || ttsSpeaking)) {
        interruptActiveExecution('Paused by voice command');
        setRealtimeStatusText('Paused. I am listening for your next instruction...');
        return;
      }

      if (ttsSpeaking || Date.now() < ttsGuardUntilRef.current) {
        return;
      }

      if (isLikelyEchoTranscript(transcriptText)) {
        return;
      }

      setInputValue(transcriptText);
      pendingInputRef.current = transcriptText;

      if (
        realtimeModeEnabled
        && realtimeConnected
        && realtimeSocketRef.current
        && realtimeSocketRef.current.readyState === WebSocket.OPEN
      ) {
        realtimeSocketRef.current.send(JSON.stringify({
          type: 'transcript_partial',
          transcript: transcriptText,
          request_id: `tr_${Date.now()}`
        }));
      }
    }
  }, [transcript, realtimeModeEnabled, realtimeConnected, ttsSpeaking, isLikelyEchoTranscript, isStopListeningPhrase, isPauseActionPhrase, isPlanChangePhrase, isInterruptActionPhrase, isLoading, stopListening, stopSpeaking, interruptActiveExecution]);

  useEffect(() => {
    if (!interactiveVoiceModeEnabled) return;
    if (!finalTranscript) return;

    if (ttsSpeaking || Date.now() < ttsGuardUntilRef.current) {
      clearFinalTranscript();
      return;
    }

    const normalized = finalTranscript.trim();
    if (!normalized) {
      clearFinalTranscript();
      return;
    }

    if (isLikelyEchoTranscript(normalized)) {
      clearFinalTranscript();
      return;
    }

    if (isStopListeningPhrase(normalized)) {
      sessionStoppedByVoiceRef.current = true;
      stopListening();
      stopSpeaking();
      interruptActiveExecution('Stopped by voice command');
      setMessages(prev => [...prev, {
        role: 'assistant',
        message: '✅ Okay. I stopped interactive listening. Call me anytime when needed.',
        timestamp: new Date().toISOString()
      }]);
      setRealtimeStatusText('Interactive listening stopped by your voice command.');
      setInputValue('');
      pendingInputRef.current = '';
      clearFinalTranscript();
      return;
    }

    if ((isPauseActionPhrase(normalized) || isPlanChangePhrase(normalized) || isInterruptActionPhrase(normalized)) && (isLoading || ttsSpeaking)) {
      interruptActiveExecution('Paused by voice command');
      setMessages(prev => [...prev, {
        role: 'assistant',
        message: '⏸️ Paused. I am listening. Tell me what to do next.',
        timestamp: new Date().toISOString()
      }]);
      setRealtimeStatusText('Paused. Listening for next instruction...');
      clearFinalTranscript();
      return;
    }

    if (normalized === lastVoiceFinalRef.current) {
      clearFinalTranscript();
      return;
    }

    lastVoiceFinalRef.current = normalized;
    setInputValue(normalized);
    pendingInputRef.current = normalized;

    const trigger = async () => {
      if (autoVoiceSubmitLockRef.current) return;
      autoVoiceSubmitLockRef.current = true;
      try {
        await handleSendMessage(normalized, 'voice-auto');
      } finally {
        autoVoiceSubmitLockRef.current = false;
        clearFinalTranscript();
      }
    };

    trigger();
  }, [interactiveVoiceModeEnabled, finalTranscript, clearFinalTranscript, ttsSpeaking, isLikelyEchoTranscript, isStopListeningPhrase, isPauseActionPhrase, isPlanChangePhrase, isInterruptActionPhrase, stopListening, stopSpeaking, interruptActiveExecution, isLoading]);

  // Auto-restart mic whenever interactive mode is on and nothing else is happening
  // Depends on isLoading so it re-evaluates after execution completes
  useEffect(() => {
    if (!interactiveVoiceModeEnabled || sessionStoppedByVoiceRef.current) return;
    if (!isOpen || !voiceSupported) return;
    if (isListening || ttsSpeaking || isLoading) return;
    if (Date.now() < ttsGuardUntilRef.current) return;

    const now = Date.now();
    if (now - lastInteractivePromptAtRef.current < 600) return;
    lastInteractivePromptAtRef.current = now;

    const timer = setTimeout(() => {
      if (sessionStoppedByVoiceRef.current) return;
      try {
        startListening();
      } catch (_) {
        // noop
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [interactiveVoiceModeEnabled, isOpen, voiceSupported, isListening, ttsSpeaking, isLoading, startListening]);

  useEffect(() => {
    if (!isOpen || !realtimeModeEnabled) {
      if (realtimeSocketRef.current) {
        try {
          realtimeSocketRef.current.close();
        } catch (_) {
          // noop
        }
        realtimeSocketRef.current = null;
      }
      setRealtimeConnected(false);
      setRealtimeStatusText('');
      if (realtimePingRef.current) {
        clearInterval(realtimePingRef.current);
        realtimePingRef.current = null;
      }
      return;
    }

    let socket;
    try {
      socket = new WebSocket(getAgentRealtimeWebSocketUrl());
    } catch (error) {
      console.error('Realtime websocket init failed:', error);
      setRealtimeConnected(false);
      return;
    }

    realtimeSocketRef.current = socket;

    socket.onopen = () => {
      setRealtimeConnected(true);
      setRealtimeStatusText('Realtime channel connected');
      if (realtimePingRef.current) clearInterval(realtimePingRef.current);
      realtimePingRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 20000);
    };

    socket.onclose = () => {
      setRealtimeConnected(false);
      if (realtimePingRef.current) {
        clearInterval(realtimePingRef.current);
        realtimePingRef.current = null;
      }
      Object.values(realtimePendingRef.current).forEach((entry) => {
        try {
          entry.reject(new Error('Realtime channel disconnected'));
        } catch (_) {
          // noop
        }
      });
      realtimePendingRef.current = {};
      activeExecutionRef.current = { mode: null, requestId: null, abortController: null };
    };

    socket.onerror = (event) => {
      console.error('Realtime websocket error:', event);
      setRealtimeConnected(false);
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const requestId = payload.request_id;

        if (payload.type === 'status') {
          const stageMap = {
            planning: 'Planning steps…',
            executing: 'Executing actions…'
          };
          setRealtimeStatusText(stageMap[payload.stage] || 'Working…');
        }

        if (payload.type === 'action') {
          const actionState = payload.success ? 'completed' : 'failed';
          setRealtimeStatusText(`Action ${payload.index + 1}: ${payload.function_name} ${actionState}`);
        }

        if (payload.type === 'final' && requestId && realtimePendingRef.current[requestId]) {
          realtimePendingRef.current[requestId].resolve(payload.response);
          delete realtimePendingRef.current[requestId];
          setRealtimeStatusText('Done');
        }

        if (payload.type === 'error' && requestId && realtimePendingRef.current[requestId]) {
          realtimePendingRef.current[requestId].reject(new Error(payload.message || 'Realtime execution failed'));
          delete realtimePendingRef.current[requestId];
        }

        if (payload.type === 'interrupted' && requestId && realtimePendingRef.current[requestId]) {
          realtimePendingRef.current[requestId].reject(new Error(payload.message || 'Execution interrupted'));
          delete realtimePendingRef.current[requestId];
          setRealtimeStatusText('Interrupted. Listening for next instruction...');
        }
      } catch (error) {
        console.error('Realtime payload parse failed:', error);
      }
    };

    return () => {
      if (realtimePingRef.current) {
        clearInterval(realtimePingRef.current);
        realtimePingRef.current = null;
      }

      if (socket) {
        try {
          socket.close();
        } catch (_) {
          // noop
        }
      }
      realtimeSocketRef.current = null;
      setRealtimeConnected(false);
    };
  }, [isOpen, realtimeModeEnabled]);

  const executeViaRealtime = useCallback((message, includeContext, options = {}) => {
    return new Promise((resolve, reject) => {
      const socket = realtimeSocketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        reject(new Error('Realtime channel unavailable'));
        return;
      }

      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      realtimePendingRef.current[requestId] = {
        resolve: (response) => {
          if (activeExecutionRef.current.requestId === requestId) {
            activeExecutionRef.current = { mode: null, requestId: null, abortController: null };
          }
          resolve(response);
        },
        reject: (error) => {
          if (activeExecutionRef.current.requestId === requestId) {
            activeExecutionRef.current = { mode: null, requestId: null, abortController: null };
          }
          reject(error);
        }
      };

      activeExecutionRef.current = { mode: 'realtime', requestId, abortController: null };

      socket.send(JSON.stringify({
        type: 'execute',
        request_id: requestId,
        message,
        include_context: includeContext,
        safe_mode: Boolean(options.safeMode),
        confirmed: Boolean(options.confirmed),
      }));

      setTimeout(() => {
        if (realtimePendingRef.current[requestId]) {
          delete realtimePendingRef.current[requestId];
          reject(new Error('Realtime request timed out.'));
        }
      }, 100000);
    });
  }, []);

  const loadChatHistory = async () => {
    try {
      const history = await getChatHistory();
      if (history && history.length > 0) {
        setMessages(history);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const handleSendMessage = async (overrideMessage = null, source = 'text') => {
    const candidate = typeof overrideMessage === 'string' ? overrideMessage : inputValue;
    const userMessage = String(candidate || '').trim();
    if (!userMessage) return;

    if (isStopListeningPhrase(userMessage)) {
      sessionStoppedByVoiceRef.current = true;
      setInteractiveVoiceModeEnabled(false);
      setShowVoiceGuide(false);
      stopListening();
      stopSpeaking();
      await interruptActiveExecution('Stopped by command');
      setInputValue('');
      pendingInputRef.current = '';
      setMessages(prev => [...prev,
        {
          role: 'user',
          message: userMessage,
          timestamp: new Date().toISOString()
        },
        {
          role: 'assistant',
          message: '✅ Done. I stopped listening. Say or type when you need me again.',
          timestamp: new Date().toISOString()
        }
      ]);
      setRealtimeStatusText('Interactive listening stopped.');
      return;
    }

    if (isPauseActionPhrase(userMessage) || isPlanChangePhrase(userMessage) || isInterruptActionPhrase(userMessage)) {
      if (isLoading || ttsSpeaking) {
        await interruptActiveExecution('Interrupted by command');
        setInputValue('');
        pendingInputRef.current = '';
        setMessages(prev => [...prev,
          {
            role: 'user',
            message: userMessage,
            timestamp: new Date().toISOString()
          },
          {
            role: 'assistant',
            message: '⏹️ Stopped current task. I am ready for your next instruction.',
            timestamp: new Date().toISOString()
          }
        ]);
        setRealtimeStatusText('Interrupted. Ready for next instruction.');
        return;
      }

      setInputValue('');
      pendingInputRef.current = '';
      setMessages(prev => [...prev,
        {
          role: 'user',
          message: userMessage,
          timestamp: new Date().toISOString()
        },
        {
          role: 'assistant',
          message: 'No active task right now. Tell me what you want me to do next.',
          timestamp: new Date().toISOString()
        }
      ]);
      return;
    }

    if (isLoading) {
      await interruptActiveExecution('Interrupted by new instruction');
    }

    if (ttsSpeaking) {
      stopSpeaking();
    }

    setInputValue('');
    resetTranscript();
    setShowSuggestions(false);
    
    // Add user message immediately
    const newMessage = {
      role: 'user',
      message: userMessage,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newMessage]);
    setIsLoading(true);
    setRealtimeStatusText(source === 'voice-auto' ? 'Listening and executing…' : 'Executing…');

    try {
      // Call realtime channel when enabled; fallback to existing HTTP endpoint
      let rawResponse;
      if (realtimeModeEnabled && realtimeConnected) {
        rawResponse = await executeViaRealtime(userMessage, true, { safeMode: safeModeEnabled, confirmed: false });
      } else {
        const requestAbortController = new AbortController();
        activeExecutionRef.current = { mode: 'http', requestId: null, abortController: requestAbortController };
        rawResponse = await executeAutonomous(userMessage, true, {
          safeMode: safeModeEnabled,
          confirmed: false,
          signal: requestAbortController.signal
        });
        activeExecutionRef.current = { mode: null, requestId: null, abortController: null };
      }

      if (rawResponse?.confirmation_required) {
        const confirmRun = window.confirm(
          `${rawResponse.message}\n\nSelect OK to continue, or Cancel to stop.`
        );

        if (!confirmRun) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            message: 'Safety mode kept this action blocked. No destructive operation was executed.',
            timestamp: new Date().toISOString()
          }]);
          setIsLoading(false);
          return;
        }

        if (realtimeModeEnabled && realtimeConnected) {
          rawResponse = await executeViaRealtime(userMessage, true, { safeMode: safeModeEnabled, confirmed: true });
        } else {
          const requestAbortController = new AbortController();
          activeExecutionRef.current = { mode: 'http', requestId: null, abortController: requestAbortController };
          rawResponse = await executeAutonomous(userMessage, true, {
            safeMode: safeModeEnabled,
            confirmed: true,
            signal: requestAbortController.signal
          });
          activeExecutionRef.current = { mode: null, requestId: null, abortController: null };
        }
      }

      console.log('🤖 Autonomous agent response:', rawResponse);

      const chatOnly = isChatOnlyInput(userMessage);
      const response = {
        ...rawResponse,
        actions_executed: Array.isArray(rawResponse?.actions_executed) ? rawResponse.actions_executed : []
      };

      if (chatOnly && response.actions_executed.length > 0) {
        console.warn('🛡️ Suppressing accidental action payload for chat-only input');
        response.actions_executed = [];
        response.tool_calls_count = 0;
        response.successful_count = 0;
        response.no_tools_needed = true;
        if (!response.message || /action completed|executed\s+\d+\s+action/i.test(response.message)) {
          response.message = buildChatOnlyFallback(userMessage);
        }
      }
      
      // Build response message with action execution details
      let responseMessage = response.message || (chatOnly ? buildChatOnlyFallback(userMessage) : 'Task completed successfully.');

      if (interactiveVoiceModeEnabled && source === 'voice-auto' && response.status !== 'error') {
        responseMessage += '\n\n🎙️ I\'m still listening. Say your next instruction, or say "stop listening" to pause me.';
      }
      
      // If actions were executed, show details
      if (response.actions_executed && response.actions_executed.length > 0) {
        const actionSummary = response.actions_executed.map((action, idx) => {
          const emoji = action.success ? '✅' : '❌';
          const status = action.success ? 'Success' : 'Failed';
          return `${emoji} Step ${idx + 1}: ${action.function_name} - ${status}`;
        }).join('\n');
        
        // Execute frontend-only actions (avoid re-running backend mutations here)
        const frontendOnlyFunctions = new Set(['open_file', 'download_file', 'get_analytics', 'run_power_tool']);
        for (const action of response.actions_executed) {
          if (action.success && action.data && frontendOnlyFunctions.has(action.function_name)) {
            // Map backend function names to frontend actions
            const frontendAction = mapBackendActionToFrontend(action, action.data);
            if (frontendAction) {
              const result = await executeAction(frontendAction);
              console.log('🎯 Frontend action result:', result);
            }
          }
        }
        
        // Add action summary if multi-step
        if (response.actions_executed.length > 1) {
          responseMessage += '\n\n📋 Actions performed:\n' + actionSummary;
        }
      }
      
      // Add assistant response with full details
      setMessages(prev => [...prev, {
        role: 'assistant',
        message: responseMessage,
        actions_executed: response.actions_executed,
        tool_calls_count: response.tool_calls_count,
        status: response.status,
        timestamp: new Date().toISOString()
      }]);
      // In interactive mode, always use action-focused spoken summary regardless of submit source
      const spokenText = interactiveVoiceModeEnabled
        ? buildInteractiveSpokenResponse(response, responseMessage)
        : responseMessage;
      speakAssistantResponse(spokenText);
      if (onNotify) {
        const statusType = response.status === 'error'
          ? 'error'
          : response.status === 'partial'
            ? 'warning'
            : 'success';
        onNotify(responseMessage, statusType);
      }

      // Trigger refresh if items were modified
      if (response.actions_executed?.some(a => a.success && 
        ['rename_file', 'move_file', 'delete_file', 'add_tag', 'remove_tag', 'toggle_favorite', 'restore_file',
         'create_folder', 'rename_folder', 'move_folder', 'delete_folder', 'set_folder_color', 'duplicate_file',
         'batch_move', 'batch_tag', 'batch_delete', 'share_file', 'remove_share', 'run_power_tool'].includes(a.function_name))) {
        console.log('📁 Triggering items refresh...');
        if (actions.refreshItems) {
          await actions.refreshItems();
        }
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      console.error('Error details:', error.message);

      const isInterrupt = /interrupted/i.test(String(error?.message || ''));
      if (isInterrupt) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          message: '⏹️ Stopped. I am listening for your next instruction.',
          timestamp: new Date().toISOString()
        }]);
        return;
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        message: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        timestamp: new Date().toISOString()
      }]);
      if (onNotify) {
        onNotify(error.message || 'Docky request failed', 'error');
      }
    } finally {
      activeExecutionRef.current = { mode: null, requestId: null, abortController: null };
      setRealtimeStatusText('');
      setIsLoading(false);

      // Delayed mic resume as a safety net (auto-restart effect also handles this)
      if (interactiveVoiceModeEnabled && !sessionStoppedByVoiceRef.current) {
        setTimeout(() => {
          if (sessionStoppedByVoiceRef.current) return;
          if (window.speechSynthesis && window.speechSynthesis.speaking) return;
          try {
            startListening();
          } catch (_) {
            // noop
          }
        }, 350);
      }
    }
  };

  // Map backend action data to frontend action format
  const mapBackendActionToFrontend = (action, data) => {
    // Map function names to command types
    const functionToCommandMap = {
      'open_file': 'open',
      'rename_file': 'rename',
      'delete_file': 'delete',
      'add_tag': 'tag',
      'add_tag_to_file': 'tag',
      'toggle_favorite': 'favorite',
      'move_file': 'move',
      'download_file': 'download',
      'run_power_tool': 'power_tool',
      'get_analytics': 'analytics'
    };

    const commandType = functionToCommandMap[action.function_name];
    if (!commandType) return null;

    return {
      command_type: commandType,
      action_data: data,
      results: data
    };
  };

  const handleClearHistory = async () => {
    if (window.confirm('Clear all chat history?')) {
      try {
        await clearChatHistory();
        setMessages([]);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Failed to clear history:', error);
      }
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInputValue(suggestion);
    inputRef.current?.focus();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickCommands = [
    'Search for budget.pdf, open it, and add tag "reviewed"',
    'Find all contracts and move them to Legal folder',
    'Show recent files and their storage usage',
    'Open presentation.pptx and mark as favorite',
    'Search for invoice documents from last month',
    'Create Reports folder and move all PDF files there'
  ];

  return (
    <>
      {/* Floating Assistant Button - Professional Design */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 w-48 h-48 bg-transparent transition-all duration-300 flex items-center justify-center z-50 group ${
          isOpen ? 'scale-0' : 'scale-100'
        }`}
        aria-label="Open Docky Assistant"
      >
        <div className="relative w-42 h-42 flex items-center justify-center">
          <img 
            src="/docky-avatar.png" 
            alt="Docky" 
            className="w-42 h-42 object-contain"
          />
        </div>
        {/* Removed background pulse to avoid blue halo */}
        
        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Ask Docky
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
        </div>
      </button>

      {/* Professional Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[500px] h-[650px] bg-white rounded-xl shadow-2xl flex flex-col z-50 border border-slate-200 overflow-hidden">
          {/* Professional Header - Matches App Theme */}
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 py-3.5 flex justify-between items-center shadow-md">
            <div className="flex items-center space-x-3">
              <div className="w-20 h-20 flex items-center justify-center">
                <img 
                  src="/docky-avatar.png" 
                  alt="Docky" 
                  className="w-16 h-16 object-contain"
                />
              </div>
              <div>
                <h3 className="font-semibold text-base">Docky Assistant</h3>
                <p className="text-xs text-indigo-100 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                  Online - Ready to help
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setShowAllFeatures(true)}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-xs font-medium flex items-center gap-1.5"
                title="Show all 80+ features"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                All Features
              </button>
              <button
                onClick={handleClearHistory}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Clear chat history"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRealtimeModeEnabled(v => !v)}
                className={`px-2 py-1 rounded border transition-colors ${realtimeModeEnabled ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}`}
                title="Realtime websocket status updates"
              >
                Realtime {realtimeConnected ? '●' : ''}
              </button>
              <button
                onClick={() => setSafeModeEnabled(v => !v)}
                className={`px-2 py-1 rounded border transition-colors ${safeModeEnabled ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-300'}`}
                title="Require confirmation for destructive operations"
              >
                Safe Mode
              </button>
              <button
                onClick={() => setVoiceOutputEnabled(v => !v)}
                disabled={!ttsSupported}
                className={`px-2 py-1 rounded border transition-colors disabled:opacity-50 ${voiceOutputEnabled ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300'}`}
                title={ttsSupported ? 'Read Docky responses aloud' : 'Browser TTS not supported'}
              >
                Voice Output
              </button>
              <button
                onClick={() => {
                  setInteractiveVoiceModeEnabled(v => {
                    const next = !v;
                    if (next) {
                      // Auto-enable voice output + realtime for full interactive experience
                      if (ttsSupported) setVoiceOutputEnabled(true);
                      setRealtimeModeEnabled(true);
                      sessionStoppedByVoiceRef.current = false;
                      setTimeout(() => {
                        try {
                          startListening();
                        } catch (_) {
                          // noop
                        }
                      }, 120);
                    } else {
                      sessionStoppedByVoiceRef.current = true;
                      setShowVoiceGuide(false);
                      stopListening();
                      stopSpeaking();
                    }
                    return next;
                  });
                }}
                disabled={!voiceSupported}
                className={`px-2 py-1 rounded border transition-colors disabled:opacity-50 ${interactiveVoiceModeEnabled ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-300'}`}
                title="Continuous hands-free voice mode with auto-run and interruption"
              >
                Interactive Voice
              </button>
              {interactiveVoiceModeEnabled && (
                <button
                  onClick={() => setShowVoiceGuide(v => !v)}
                  className={`px-2 py-1 rounded border transition-colors ${showVoiceGuide ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-white text-slate-600 border-slate-300'}`}
                  title="Show interactive voice tips"
                >
                  {showVoiceGuide ? 'Hide Tips' : 'Voice Tips'}
                </button>
              )}
            </div>
            <span className="text-slate-500">
              {ttsSpeaking
                ? `Speaking${selectedVoiceName ? ` (${selectedVoiceName})` : ''}`
                : realtimeModeEnabled
                  ? (realtimeConnected ? 'Live channel connected' : 'Connecting live channel...')
                  : 'Live channel off'}
            </span>
          </div>

          {(interactiveVoiceModeEnabled || isListening || ttsSpeaking || isLoading) && (
            <div className="px-4 py-2 bg-white border-b border-slate-200 flex flex-wrap items-center gap-2 text-[11px]">
              <span className={`px-2 py-1 rounded-full border ${interactiveVoiceModeEnabled ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                Interactive {interactiveVoiceModeEnabled ? 'On' : 'Off'}
              </span>
              <span className={`px-2 py-1 rounded-full border ${isListening ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                Mic {isListening ? 'Listening' : 'Idle'}
              </span>
              <span className={`px-2 py-1 rounded-full border ${ttsSpeaking ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                Voice {ttsSpeaking ? 'Speaking' : 'Silent'}
              </span>
              <span className={`px-2 py-1 rounded-full border ${isLoading ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                Agent {isLoading ? 'Working' : 'Ready'}
              </span>
              {realtimeModeEnabled && (
                <span className={`px-2 py-1 rounded-full border ${realtimeConnected ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  Realtime {realtimeConnected ? 'Connected' : 'Connecting'}
                </span>
              )}
              {sessionStoppedByVoiceRef.current && interactiveVoiceModeEnabled && (
                <span className="px-2 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                  Paused by voice command
                </span>
              )}
            </div>
          )}

          {interactiveVoiceModeEnabled && showVoiceGuide && (
            <div className="px-4 py-3 bg-purple-50 border-b border-purple-100 text-[11px] text-purple-900">
              <p className="font-semibold mb-1">Interactive Voice Tips</p>
              <ul className="space-y-1 text-purple-800">
                <li>• Speak naturally; final phrases auto-submit without pressing send.</li>
                <li>• Say “pause”, “stop action”, or “change plan” to interrupt current work.</li>
                <li>• Say “stop listening” or “bye docky” to end continuous listening.</li>
              </ul>
            </div>
          )}

          {/* Messages Area - Professional Styling */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {messages.length === 0 && showSuggestions && (
              <div className="space-y-3">
                {/* Welcome Message */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-24 h-24 flex items-center justify-center">
                      <img 
                        src="/docky-avatar.png" 
                        alt="Docky" 
                        className="w-20 h-20 object-contain"
                      />
                    </div>
                    <div className="flex-1 pt-1">
                      <h4 className="font-semibold text-slate-900 mb-1.5">Hi, this is Docky! 👋</h4>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Your autonomous AI assistant. I understand natural language and can execute 
                        multi-step commands automatically. Try: <span className="font-medium text-indigo-600">"Search for budget.pdf, tag it as urgent, and move to Finance folder"</span>
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Quick Actions */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Quick Actions</p>
                  
                  {/* Show All Features Button - Prominent */}
                  <button
                    onClick={() => setShowAllFeatures(true)}
                    className="w-full text-left px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-lg text-sm font-medium transition-all shadow-md hover:shadow-lg flex items-center justify-between mb-3"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      🚀 Show All 80+ Features
                    </span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  
                  <div className="space-y-2">
                    {quickCommands.map((cmd, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSuggestionClick(cmd)}
                        className="w-full text-left px-3 py-2.5 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-lg text-sm transition-all border border-slate-200 hover:border-indigo-200 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        {cmd}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md'
                      : 'bg-white text-slate-800 shadow-sm border border-slate-200'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.message}</p>

                  {/* Multi-step Action Execution Progress */}
                  {msg.actions_executed && msg.actions_executed.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                      <p className="text-xs font-semibold text-slate-600 mb-2">
                        🤖 Executed {msg.actions_executed.length} action{msg.actions_executed.length !== 1 ? 's' : ''}:
                      </p>
                      {msg.actions_executed.map((action, idx) => (
                        <div
                          key={idx}
                          className={`flex items-start gap-2 p-2 rounded-lg text-xs ${
                            action.success
                              ? 'bg-emerald-50 border border-emerald-200'
                              : 'bg-red-50 border border-red-200'
                          }`}
                        >
                          <span className="text-base flex-shrink-0 mt-0.5">
                            {action.success ? '✅' : '❌'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium ${action.success ? 'text-emerald-700' : 'text-red-700'}`}>
                              Step {idx + 1}: {action.function_name.replace(/_/g, ' ')}
                            </p>
                            {action.error && (
                              <p className="text-red-600 text-[10px] mt-0.5">{action.error}</p>
                            )}
                            {action.success && action.data && (
                              <p className="text-slate-600 text-[10px] mt-0.5 break-words">
                                {buildActionDataPreview(action)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Search Results */}
                  {msg.results && msg.command_type === 'search' && msg.results.results && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200">
                      <p className="text-xs font-medium text-slate-600 mb-2">
                        Found {msg.results.total} files
                      </p>
                      {msg.results.results.slice(0, 5).map((file, i) => {
                        const localFile = findLocalFile(file.filename);
                        return (
                          <div key={i} className="text-xs py-1.5 flex items-center justify-between text-slate-700">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <svg className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span className="truncate">{file.filename}</span>
                            </div>
                            {localFile && onOpenFile && (
                              <button
                                onClick={() => onOpenFile(localFile.id)}
                                className="ml-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] hover:bg-indigo-100 hover:text-indigo-700 transition-colors flex-shrink-0"
                              >
                                Open
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Open File Results */}
                  {msg.results && msg.command_type === 'open' && msg.results.results && msg.results.results.length > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200">
                      <p className="text-xs font-medium text-slate-600 mb-2">
                        Found {msg.results.total} matching file{msg.results.total !== 1 ? 's' : ''}
                      </p>
                      {msg.results.results.slice(0, 3).map((file, i) => {
                        const localFile = findLocalFile(file.filename);
                        return (
                          <div key={i} className="text-xs py-1.5 flex items-center justify-between text-slate-700">
                            <div className="flex items-center gap-2">
                              <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span>{file.filename}</span>
                            </div>
                            {localFile && onOpenFile && (
                              <button
                                onClick={() => onOpenFile(localFile.id)}
                                className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium hover:bg-indigo-200 transition-colors"
                              >
                                Open
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Action Confirmation */}
                  {msg.action_data && ['rename', 'delete', 'favorite', 'tag', 'move', 'download'].includes(msg.command_type) && (
                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Action executed</span>
                      </div>
                    </div>
                  )}

                  {/* Recent Files */}
                  {msg.results && msg.command_type === 'recent' && msg.results.files && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200">
                      <p className="text-xs font-medium text-slate-600 mb-2">
                        {msg.results.count} recent files
                      </p>
                      {msg.results.files.slice(0, 5).map((file, i) => {
                        const localFile = findLocalFile(file.filename);
                        return (
                          <div key={i} className="text-xs py-1 flex items-center justify-between text-slate-700">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <svg className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span className="truncate">{file.filename}</span>
                            </div>
                            {localFile && onOpenFile && (
                              <button
                                onClick={() => onOpenFile(localFile.id)}
                                className="ml-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] hover:bg-indigo-100 hover:text-indigo-700 transition-colors flex-shrink-0"
                              >
                                Open
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Analytics Results */}
                  {msg.results && msg.command_type === 'analytics' && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200 text-xs">
                      {msg.results.file_stats && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-slate-700">
                            <span>Total Files:</span>
                            <span className="font-medium">{msg.results.file_stats.total_files || 0}</span>
                          </div>
                          <div className="flex justify-between text-slate-700">
                            <span>Total Size:</span>
                            <span className="font-medium">{msg.results.file_stats.total_size_readable || '0 B'}</span>
                          </div>
                          {msg.results.file_stats.by_type && Object.entries(msg.results.file_stats.by_type).slice(0, 4).map(([type, count]) => (
                            <div key={type} className="flex justify-between text-slate-600">
                              <span>{type}:</span>
                              <span>{count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Help Results */}
                  {msg.results && msg.command_type === 'help' && msg.results.commands && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200 text-xs">
                      {msg.results.total_features && (
                        <div className="mb-3 p-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                          <p className="text-indigo-700 font-semibold text-center">
                            🚀 {msg.results.total_features} features available across {msg.results.feature_categories} categories
                          </p>
                        </div>
                      )}
                      {msg.results.commands.slice(0, 4).map((cat, i) => (
                        <div key={i} className="mb-2">
                          <p className="font-semibold text-slate-700 mb-1">{cat.category}</p>
                          {cat.commands.slice(0, 3).map((cmd, j) => (
                            <button
                              key={j}
                              onClick={() => handleSuggestionClick(cmd)}
                              className="block text-indigo-600 hover:text-indigo-700 py-0.5 hover:underline text-left"
                            >
                              • {cmd}
                            </button>
                          ))}
                          {cat.commands.length > 3 && (
                            <p className="text-slate-400 text-[10px] ml-2 mt-0.5">
                              +{cat.commands.length - 3} more...
                            </p>
                          )}
                        </div>
                      ))}
                      {msg.results.commands.length > 4 && (
                        <p className="text-slate-400 text-[10px] text-center mt-2">
                          +{msg.results.commands.length - 4} more categories...
                        </p>
                      )}
                      <button
                        onClick={() => setShowAllFeatures(true)}
                        className="w-full mt-3 px-3 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-lg font-medium text-sm transition-all shadow-sm flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        View All {msg.results.total_features || '80+'} Features
                      </button>
                    </div>
                  )}
                  
                  {/* Storage Results */}
                  {msg.results && msg.command_type === 'storage' && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200 text-xs">
                      <div className="space-y-1.5">
                        {msg.results.drives?.map((drive, i) => (
                          <div key={i} className="flex items-center gap-2 text-slate-700">
                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                            </svg>
                            <span className="font-medium">{drive.drive_name}:</span> {drive.used_gb} GB / {drive.allocated_gb} GB
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Duplicate Results */}
                  {msg.results && msg.command_type === 'duplicates' && msg.results.duplicates && msg.results.duplicates.length > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200 text-xs">
                      <p className="font-medium text-slate-600 mb-2">
                        {msg.results.total_groups} duplicate group(s) found
                        {msg.results.space_wasted_readable && ` — ${msg.results.space_wasted_readable} wasted`}
                      </p>
                      {msg.results.duplicates.slice(0, 5).map((group, i) => (
                        <div key={i} className="mb-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                          <p className="text-[10px] text-slate-500 mb-1">{group.file_count} files {group.match_type === 'similar_name' ? '(similar names)' : '(exact match)'}</p>
                          {group.files?.map((f, j) => (
                            <div key={j} className="flex items-center gap-1.5 py-0.5 text-slate-700">
                              <svg className="w-3 h-3 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2" />
                              </svg>
                              <span className="truncate">{f.filename}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Suggestions */}
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200">
                      <p className="text-xs font-medium text-slate-600 mb-1.5">Related actions:</p>
                      <div className="space-y-1">
                        {msg.suggestions.slice(0, 3).map((sug, i) => (
                          <button
                            key={i}
                            onClick={() => handleSuggestionClick(sug)}
                            className="block text-xs text-indigo-600 hover:text-indigo-700 hover:underline py-0.5"
                          >
                            → {sug}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                    <span className="text-xs text-slate-500 ml-2">Analyzing and executing...</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    🤖 AI agent is planning and running your tasks
                  </p>
                  {realtimeModeEnabled && realtimeStatusText && (
                    <p className="text-[10px] text-indigo-600 mt-1 font-medium">
                      ⚡ {realtimeStatusText}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Professional Input Area */}
          <div className="p-4 bg-white border-t border-slate-200">
            {isListening && (
              <div className="mb-2 flex items-center space-x-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-red-700">
                  {interactiveVoiceModeEnabled ? 'Interactive mode: listening continuously…' : 'Listening to your voice...'}
                </span>
              </div>
            )}
            
            <div className="flex items-end space-x-2">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => {
                  if (ttsSpeaking) stopSpeaking();
                  setInputValue(e.target.value);
                  pendingInputRef.current = e.target.value;
                }}
                onKeyPress={handleKeyPress}
                placeholder="Type your question or command..."
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm placeholder-slate-400"
                rows="1"
                disabled={isListening && !interactiveVoiceModeEnabled}
              />
              
              {voiceSupported && (
                <button
                  onClick={async () => {
                    if (isListening) {
                      stopListening();
                      return;
                    }

                    if (isLoading) {
                      await interruptActiveExecution('Interrupted by voice input');
                    }
                    if (ttsSpeaking) {
                      stopSpeaking();
                    }
                    sessionStoppedByVoiceRef.current = false;
                    startListening();
                  }}
                  className={`p-2.5 rounded-lg transition-all flex-shrink-0 ${
                    isListening
                      ? 'bg-red-500 hover:bg-red-600 text-white shadow-md'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300'
                  }`}
                  title={isListening ? 'Stop listening' : 'Voice input'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              )}
              
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim()}
                className="p-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white rounded-lg transition-all shadow-sm disabled:shadow-none flex-shrink-0"
                title="Send message"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>

              {(isLoading || ttsSpeaking) && (
                <button
                  onClick={() => interruptActiveExecution('Interrupted by stop button')}
                  className="p-2.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-300 transition-all flex-shrink-0"
                  title="Interrupt current action"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6h12v12H6z" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Keyboard Hint */}
            <p className="text-xs text-slate-400 mt-2 text-center">
              {interactiveVoiceModeEnabled
                ? 'Interactive voice is active • You can speak commands or type anytime'
                : 'Press Enter to send • Shift+Enter for new line'}
            </p>
          </div>
        </div>
      )}

      {/* All Features Panel */}
      <AllFeaturesPanel
        isOpen={showAllFeatures}
        onClose={() => setShowAllFeatures(false)}
        onCommandSelect={(cmd) => {
          setInputValue(cmd);
          setIsOpen(true);
        }}
      />
    </>
  );
}
