/**
 * PDIFSession — The live coaching session experience
 *
 * Design philosophy: "Invisible Consultant"
 * - The rep should feel like an experienced consultant beside them
 * - Every element reduces cognitive load while increasing insight
 * - Glanceable in 0.5 seconds during conversation
 * - Never interrupts or demands attention
 *
 * Three zones:
 *   Zone 1 (Primary) — Phase indicator, recording status, timer
 *   Zone 2 (Glanceable) — 2-3 question suggestions with "why"
 *   Zone 3 (Background) — Confidence meters, recent discoveries
 *
 * PDIF V1 Task 3.2
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PDIFSessionProps {
  accountId: string;
  accountName: string;
  onEnd: () => void;
  apiBase: string;
  token: string;
}

interface Suggestion {
  text: string;
  whyItMatters: string;
  pdifPhase: string;
  topic: string;
  score: number;
  source: string;
}

interface ConfidenceScore {
  category: string;
  label: string;
  score: number;
}

type Phase = 'discover' | 'diagnose' | 'design' | 'demonstrate' | 'deliver';

// ─── Phase Display Config ─────────────────────────────────────────────────────

const PHASE_CONFIG: Record<Phase, { label: string; icon: string; color: string }> = {
  discover: { label: 'Discover', icon: '🔍', color: '#3b82f6' },
  diagnose: { label: 'Diagnose', icon: '🔬', color: '#f59e0b' },
  design: { label: 'Design', icon: '✏️', color: '#8b5cf6' },
  demonstrate: { label: 'Demonstrate', icon: '🎯', color: '#10b981' },
  deliver: { label: 'Deliver', icon: '🚀', color: '#ef4444' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function PDIFSession({ accountId, accountName, onEnd, apiBase, token }: PDIFSessionProps) {
  // Session state
  const [, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [phase, setPhase] = useState<Phase>('discover');
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [awaitingStart, setAwaitingStart] = useState(false); // waiting for user tap to start mic

  // Coaching state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [confidence, setConfidence] = useState<ConfidenceScore[]>([]);
  const [overallConfidence, setOverallConfidence] = useState(0);

  // Transcript state
  const [transcript, setTranscript] = useState<Array<{ text: string; speaker: string }>>([]);
  const [liveText, setLiveText] = useState('');
  const [recentDiscovery, setRecentDiscovery] = useState('');

  // UI state
  const [suggestionPulse, setSuggestionPulse] = useState(false);
  const [starting, setStarting] = useState(true);
  const [ending, setEnding] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [error, setError] = useState<string | null>(null);

  // Offline detection
  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  // Refs
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // ─── API Helpers ──────────────────────────────────────────────────────

  const apiCall = useCallback(async (path: string, options?: RequestInit) => {
    const res = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options?.headers,
      },
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  }, [apiBase, token]);

  // ─── Start Session ────────────────────────────────────────────────────

  useEffect(() => {
    async function startSession() {
      try {
        const session = await apiCall('/api/pdif/sessions', {
          method: 'POST',
          body: JSON.stringify({ accountId }),
        });
        setSessionId(session.id);
        sessionIdRef.current = session.id;
        setPhase(session.currentPhase || 'discover');
        setStarting(false);
        setAwaitingStart(true); // Wait for user tap to start mic
        startTimer();
        // Load initial suggestions
        refreshSuggestions(session.id);
      } catch (err: any) {
        console.error('Failed to start session:', err);
        setStarting(false);
        setError(err?.message || 'Could not start session. Is the backend running on port 4000?');
      }
    }
    startSession();

    return () => {
      stopRecording();
      if (timerRef.current) clearInterval(timerRef.current);
      if (periodicRef.current) clearInterval(periodicRef.current);
    };
  }, []);

  // ─── Timer ────────────────────────────────────────────────────────────

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds(s => s + 1);
    }, 1000);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ─── Speech Recognition ───────────────────────────────────────────────

  const [micError, setMicError] = useState<string | null>(null);

  const startRecording = async () => {
    setMicError(null);

    // Step 1: Request microphone permission explicitly
    // This forces Chrome to show the "Allow microphone" prompt
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Got permission — stop the stream (we only needed it to trigger the prompt)
      stream.getTracks().forEach(track => track.stop());
    } catch (err: any) {
      console.error('Microphone permission denied:', err);
      setMicError('Microphone access denied. Click the lock icon in the address bar → set Microphone to "Allow" → reload the page.');
      return;
    }

    // Step 2: Start Speech Recognition
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setMicError('Speech Recognition is not supported in this browser. Please use Chrome.');
      return;
    }

    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';

    r.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          const segment = { text: t, speaker: 'unknown' };
          setTranscript(prev => [...prev, segment]);
          setLiveText('');
          // Send to backend for processing — use ref for current sessionId
          if (sessionIdRef.current) processTranscript(t);
        } else {
          interim += t;
        }
      }
      setLiveText(interim);
    };

    r.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setMicError('Microphone blocked. Click the lock icon → Allow microphone → reload.');
        setIsRecording(false);
      } else if (event.error === 'no-speech') {
        // No speech detected — just restart, don't show error
        setTimeout(() => { try { r.start(); } catch {} }, 300);
      } else {
        setTimeout(() => { try { r.start(); } catch {} }, 500);
      }
    };

    r.onend = () => {
      // Auto-restart if still supposed to be recording
      if (recognitionRef.current === r) {
        setTimeout(() => { try { r.start(); } catch {} }, 200);
      }
    };

    try {
      r.start();
      recognitionRef.current = r;
      setIsRecording(true);
      setAwaitingStart(false);
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setMicError(`Could not start recording: ${err.message || 'Unknown error'}`);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  };

  // ─── Process Transcript → Backend ─────────────────────────────────────

  const [segmentsSent, setSegmentsSent] = useState(0);

  const processTranscript = async (text: string) => {
    const sid = sessionIdRef.current;
    if (!sid || !text.trim()) return;

    try {
      const result = await apiCall(`/api/pdif/sessions/${sid}/transcript`, {
        method: 'POST',
        body: JSON.stringify({
          text,
          speaker: 'customer', // V1 simplification: assume customer speaking
          startMs: 0,
          endMs: 10000,
        }),
      });

      setSegmentsSent(prev => prev + 1);

      // Show discovery notification if entities were extracted
      if (result.entitiesExtracted > 0) {
        setRecentDiscovery(`+${result.entitiesExtracted} new fact${result.entitiesExtracted > 1 ? 's' : ''} captured`);
        setTimeout(() => setRecentDiscovery(''), 4000);
      }

      // Refresh suggestions after processing (debounced)
      scheduleSuggestionRefresh();

      // Update confidence if changed
      if (result.confidenceUpdates?.length > 0) {
        refreshConfidence();
      }
    } catch (err) {
      console.error('Transcript processing failed:', err);
      setRecentDiscovery('⚠ Failed to process — check console');
      setTimeout(() => setRecentDiscovery(''), 4000);
    }
  };

  // ─── Suggestion Refresh — periodic + after each transcript ────────────

  const lastRefreshRef = useRef<number>(0);
  const periodicRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start periodic refresh when session begins
  useEffect(() => {
    if (sessionIdRef.current && !starting && !awaitingStart) {
      periodicRef.current = setInterval(() => {
        const sid = sessionIdRef.current;
        if (sid) refreshSuggestions(sid);
      }, 15000); // Every 15 seconds
    }
    return () => {
      if (periodicRef.current) clearInterval(periodicRef.current);
    };
  }, [starting, awaitingStart]);

  const scheduleSuggestionRefresh = () => {
    // Refresh immediately, but throttle to max once every 8 seconds
    const now = Date.now();
    if (now - lastRefreshRef.current < 8000) {
      // Schedule for when the throttle window expires
      if (refreshRef.current) clearTimeout(refreshRef.current);
      refreshRef.current = setTimeout(() => {
        const sid = sessionIdRef.current;
        if (sid) refreshSuggestions(sid);
      }, 8000 - (now - lastRefreshRef.current));
      return;
    }
    const sid = sessionIdRef.current;
    if (sid) refreshSuggestions(sid);
  };

  const refreshSuggestions = async (sid: string) => {
    lastRefreshRef.current = Date.now();
    try {
      const data = await apiCall(`/api/pdif/sessions/${sid}/suggestions`);
      if (data.suggestions?.length > 0) {
        setSuggestions(data.suggestions);
        setSuggestionPulse(true);
        setTimeout(() => setSuggestionPulse(false), 2000);
      }
    } catch (err) {
      console.warn('Suggestion refresh failed:', err);
    }
  };

  const refreshConfidence = async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      const data = await apiCall(`/api/pdif/sessions/${sid}/confidence`);
      setConfidence(data.categories || []);
      setOverallConfidence(data.overall || 0);
    } catch {}
  };

  // ─── Mark Question as Asked ────────────────────────────────────────────

  const markAsked = async (questionText: string) => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      await apiCall(`/api/pdif/sessions/${sid}/question-asked`, {
        method: 'POST',
        body: JSON.stringify({ questionText }),
      });
    } catch {}
    // Remove from suggestions and refresh
    setSuggestions(prev => prev.filter(s => s.text !== questionText));
    scheduleSuggestionRefresh();
  };

  // ─── End Session ──────────────────────────────────────────────────────

  const endSession = async () => {
    setEnding(true);
    stopRecording();
    if (timerRef.current) clearInterval(timerRef.current);
    if (periodicRef.current) clearInterval(periodicRef.current);

    const sid = sessionIdRef.current;
    if (sid) {
      try {
        await apiCall(`/api/pdif/sessions/${sid}/end`, { method: 'POST' });
      } catch {}
    }
    onEnd();
  };

  // ─── Auto-scroll transcript ────────────────────────────────────────────

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, liveText]);

  // ─── Loading state ─────────────────────────────────────────────────────

  if (starting) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 32 }}>🎙</div>
        <p style={{ fontSize: 14, color: '#666' }}>Starting session...</p>
      </div>
    );
  }

  // ─── Error state ───────────────────────────────────────────────────────

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <p style={{ fontSize: 14, color: '#dc2626', fontWeight: 500 }}>Session failed to start</p>
        <p style={{ fontSize: 12, color: '#6b7280', maxWidth: 400, textAlign: 'center' }}>{error}</p>
        <button onClick={onEnd} style={{ marginTop: 8, padding: '8px 20px', fontSize: 13, background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' }}>
          ← Back to Account
        </button>
      </div>
    );
  }

  // ─── Awaiting user tap to start microphone ─────────────────────────────

  if (awaitingStart) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 48 }}>🎙</div>
        <p style={{ fontSize: 16, color: '#374151', fontWeight: 500 }}>Session ready for {accountName}</p>
        <p style={{ fontSize: 13, color: '#6b7280', maxWidth: 320, textAlign: 'center', lineHeight: 1.5 }}>
          Tap the button below to start your microphone. Chrome will ask for permission — click "Allow".
        </p>
        <button
          onClick={startRecording}
          style={{
            padding: '14px 32px',
            fontSize: 16,
            fontWeight: 600,
            background: '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            transition: 'transform 0.1s',
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          🎤 Start Recording
        </button>
        {micError && (
          <div style={{ marginTop: 8, padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, maxWidth: 400, textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>⚠️ {micError}</p>
          </div>
        )}
        <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Timer is running — tap when you're ready to speak</p>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────

  const phaseConfig = PHASE_CONFIG[phase];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)', gap: 12 }}>

      {/* ═══ ZONE 1: Header Bar (always visible) ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Recording indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: isRecording ? '#ef4444' : '#9ca3af', animation: isRecording ? 'pulse 1.5s infinite' : 'none' }} />
            <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{formatTime(elapsedSeconds)}</span>
          </div>

          {/* Phase indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 12, background: `${phaseConfig.color}15`, border: `1px solid ${phaseConfig.color}30` }}>
            <span style={{ fontSize: 12 }}>{phaseConfig.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: phaseConfig.color }}>{phaseConfig.label}</span>
          </div>

          {/* Overall confidence */}
          <span style={{ fontSize: 11, color: '#6b7280' }}>{overallConfidence}% confidence</span>
          {/* Debug: segments sent */}
          <span style={{ fontSize: 10, color: segmentsSent > 0 ? '#059669' : '#9ca3af', fontFamily: 'monospace' }}>
            {segmentsSent > 0 ? `✓ ${segmentsSent} sent` : '0 sent'}
          </span>
        </div>

        {/* End session button */}
        <button onClick={endSession} disabled={ending} style={{ padding: '6px 14px', fontSize: 11, background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>
          {ending ? 'Ending...' : '⏹ End Session'}
        </button>
      </div>

      {/* ═══ MAIN CONTENT: Two columns ═══ */}
      {offline && (
        <div style={{ padding: '6px 12px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 6, fontSize: 11, color: '#92400e', textAlign: 'center' }}>
          ⚠️ Offline — transcription continues locally. AI suggestions paused until reconnected.
        </div>
      )}
      <div style={{ display: 'flex', flex: 1, gap: 16, overflow: 'hidden' }}>

        {/* LEFT: Transcript + Discovery */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>

          {/* Live Transcript */}
          <div style={{ flex: 1, overflow: 'auto', padding: 12, background: '#fafafa', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live Transcript</div>
            {transcript.length === 0 && !liveText && (
              <p style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>Listening... speak to begin</p>
            )}
            {transcript.map((t, i) => (
              <div key={i} style={{ fontSize: 12, color: '#374151', marginBottom: 6, lineHeight: 1.5 }}>{t.text}</div>
            ))}
            {liveText && <div style={{ fontSize: 12, color: '#3b82f6', fontStyle: 'italic' }}>{liveText}</div>}
            <div ref={transcriptEndRef} />
          </div>

          {/* Recent Discovery Notification */}
          {recentDiscovery && (
            <div style={{ padding: '6px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 6, fontSize: 11, color: '#065f46', fontWeight: 500, textAlign: 'center' }}>
              🧠 {recentDiscovery}
            </div>
          )}

          {/* Confidence Meters (compact) */}
          <div style={{ padding: 10, background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Discovery Confidence</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {confidence.map(c => (
                <div key={c.category} style={{ flex: '1 1 45%', minWidth: 120 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 10, color: '#6b7280' }}>{c.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: c.score >= 60 ? '#059669' : c.score >= 30 ? '#d97706' : '#6b7280' }}>{c.score}%</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: '#e5e7eb', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${c.score}%`, background: c.score >= 60 ? '#10b981' : c.score >= 30 ? '#f59e0b' : '#d1d5db', borderRadius: 2, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Question Suggestions */}
        <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            padding: 14,
            borderRadius: 12,
            border: `2px solid ${suggestionPulse ? '#10b981' : '#e5e7eb'}`,
            background: suggestionPulse ? '#f0fdf4' : '#fff',
            transition: 'border-color 0.5s, background 0.5s',
            flex: 1,
            overflow: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 14 }}>💡</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>Suggested Questions</span>
            </div>

            {suggestions.length === 0 ? (
              <p style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>Listening to the conversation...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {suggestions.map((q, i) => (
                  <button
                    key={`${q.text.substring(0, 20)}-${i}`}
                    onClick={() => markAsked(q.text)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      background: i === 0 ? '#eff6ff' : '#fff',
                      border: `1px solid ${i === 0 ? '#bfdbfe' : '#e5e7eb'}`,
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                  >
                    {i === 0 && (
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#059669', marginBottom: 3, textTransform: 'uppercase' }}>⭐ Recommended</div>
                    )}
                    <p style={{ fontSize: 13, color: '#111827', margin: 0, lineHeight: 1.4, fontWeight: i === 0 ? 500 : 400 }}>{q.text}</p>
                    <p style={{ fontSize: 10, color: '#6b7280', margin: '4px 0 0', lineHeight: 1.3 }}>→ {q.whyItMatters}</p>
                  </button>
                ))}
              </div>
            )}

            <p style={{ fontSize: 9, color: '#9ca3af', marginTop: 10, textAlign: 'center' }}>Tap a question when you've asked it</p>
          </div>

          {/* Account name + session info */}
          <div style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{accountName}</div>
            <div style={{ fontSize: 10, color: '#9ca3af' }}>Session active</div>
          </div>
        </div>
      </div>

      {/* CSS for pulse animation */}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
}
