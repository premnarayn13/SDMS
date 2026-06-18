/**
 * Voice Recognition Hook – Robust Interactive Mode
 * Uses browser's Web Speech API for voice input (no backend cost!)
 *
 * Key design:
 *  - recognition lives in a ref (not state) to avoid stale closures
 *  - isListeningRef mirrors state so callbacks always see the truth
 *  - transient errors (no-speech, network) auto-restart with small delay
 *  - stopListening reliably prevents any pending restart
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export function useVoiceRecognition(config = {}) {
  const {
    continuous = false,
    autoRestart = false,
    interimResults = true,
    language = 'en-US'
  } = config;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef(null);
  const shouldAutoRestartRef = useRef(false);
  const isListeningRef = useRef(false);
  const restartTimerRef = useRef(null);

  // keep ref synced
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      console.warn('Web Speech API not supported in this browser');
      return;
    }
    setIsSupported(true);

    // tear down previous instance
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (_) { /* noop */ }
      recognitionRef.current = null;
    }

    const inst = new SpeechRecognition();
    inst.continuous = Boolean(continuous);
    inst.interimResults = Boolean(interimResults);
    inst.lang = language;
    inst.maxAlternatives = 1;

    inst.onresult = (event) => {
      let liveText = '';
      let committedText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const t = r?.[0]?.transcript || '';
        if (!t) continue;
        if (r.isFinal) { committedText += `${t} `; } else { liveText += `${t} `; }
      }
      const cleanLive = liveText.trim();
      const cleanFinal = committedText.trim();
      if (cleanLive) setTranscript(cleanLive);
      else if (cleanFinal) setTranscript(cleanFinal);
      if (cleanFinal) setFinalTranscript(cleanFinal);
    };

    inst.onend = () => {
      setIsListening(false);
      isListeningRef.current = false;
      if (autoRestart && shouldAutoRestartRef.current) {
        restartTimerRef.current = setTimeout(() => {
          if (!shouldAutoRestartRef.current) return;
          try {
            inst.start();
            setIsListening(true);
            isListeningRef.current = true;
          } catch (err) {
            console.warn('Voice auto-restart failed:', err);
          }
        }, 180);
      }
    };

    inst.onerror = (event) => {
      const errType = event?.error || '';
      console.warn('Speech recognition error:', errType);
      const transient = ['network', 'no-speech', 'audio-capture', 'aborted'];
      if (transient.includes(errType) && autoRestart && shouldAutoRestartRef.current) {
        // onend fires after onerror – it will handle the restart
        return;
      }
      setIsListening(false);
      isListeningRef.current = false;
      shouldAutoRestartRef.current = false;
    };

    recognitionRef.current = inst;

    return () => {
      shouldAutoRestartRef.current = false;
      if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
      try { inst.abort(); } catch (_) { /* noop */ }
      recognitionRef.current = null;
    };
  }, [continuous, interimResults, language, autoRestart]);

  const startListening = useCallback(() => {
    if (isListeningRef.current) return;
    const rec = recognitionRef.current;
    if (!rec) return;
    if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
    setTranscript('');
    setFinalTranscript('');
    shouldAutoRestartRef.current = true;
    try {
      rec.start();
      setIsListening(true);
      isListeningRef.current = true;
    } catch (err) {
      if (/already started/i.test(String(err))) {
        setIsListening(true);
        isListeningRef.current = true;
      } else {
        console.warn('startListening failed:', err);
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    shouldAutoRestartRef.current = false;
    if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
    const rec = recognitionRef.current;
    if (rec) { try { rec.stop(); } catch (_) { /* noop */ } }
    setIsListening(false);
    isListeningRef.current = false;
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setFinalTranscript('');
  }, []);

  const clearFinalTranscript = useCallback(() => {
    setFinalTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    finalTranscript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    clearFinalTranscript
  };
}
