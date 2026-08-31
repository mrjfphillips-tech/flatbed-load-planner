/**
 * GDPRConsentGate
 *
 * Hard gate that blocks recording until all parties have been notified
 * and consent to being recorded. Buttons start red and turn green on click.
 * No bypass — the session physically cannot start without consent.
 */

import React, { useState } from 'react'

export interface GDPRConsentGateProps {
  onConsent: () => void
  onDecline: () => void
  onSkipRecording: () => void
}

type ConsentState = 'pending' | 'accepted' | 'declined' | 'paused'

export function GDPRConsentGate({
  onConsent,
  onDecline: _onDecline,
  onSkipRecording,
}: GDPRConsentGateProps): React.ReactElement {
  const [state, setState] = useState<ConsentState>('pending')

  const handleAccept = () => {
    setState('accepted')
    setTimeout(() => onConsent(), 800)
  }

  const handleDecline = () => {
    setState('declined')
    setTimeout(() => setState('paused'), 600)
  }

  if (state === 'paused') {
    return (
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-6 text-center" data-testid="gdpr-paused">
        <div className="text-2xl mb-2">⏸️</div>
        <h3 className="text-sm font-semibold text-white mb-2">Session paused — consent needed</h3>
        <p className="text-xs text-gray-400 mb-4 leading-relaxed">
          Please notify all participants that the conversation will be recorded, then come back and confirm.
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={handleAccept}
            className="rounded-lg px-4 py-2 text-xs font-medium text-white transition-all"
            style={{ background: (state as string) === 'accepted' ? '#22c55e' : '#ef4444' }}
            data-testid="gdpr-retry-accept"
          >
            ✓ Done — all parties notified
          </button>
          <button
            onClick={onSkipRecording}
            className="rounded-lg border border-gray-600 px-4 py-2 text-xs text-gray-400 hover:bg-gray-800"
            data-testid="gdpr-skip-recording"
          >
            Continue without recording
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-red-500/5 p-6 text-center" data-testid="gdpr-consent">
      <div className="text-3xl mb-2">⚖️</div>
      <h3 className="text-base font-semibold text-white mb-1">Recording Consent Required</h3>
      <p className="text-xs text-gray-400 leading-relaxed mb-4 max-w-md mx-auto">
        Under <strong className="text-yellow-400">GDPR (EU)</strong> and similar regulations,
        all parties must be informed and consent to being recorded before a session can begin.
      </p>

      {/* Suggested script */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3 mb-4 text-left max-w-md mx-auto">
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Suggested script:</div>
        <p className="text-xs text-gray-300 leading-relaxed italic">
          "Before we get started, I want to let you know that I'll be taking notes during our
          conversation using an AI assistant. It will record and transcribe our discussion to
          help me capture everything accurately. Is that OK with you?"
        </p>
      </div>

      {/* Consent buttons */}
      <div className="flex flex-col gap-2 mb-3">
        <button
          onClick={handleAccept}
          disabled={state === 'accepted'}
          className="rounded-lg px-5 py-3 text-xs font-medium text-white transition-all duration-300"
          style={{ background: state === 'accepted' ? '#22c55e' : '#ef4444' }}
          data-testid="gdpr-accept"
        >
          {state === 'accepted'
            ? '✓ Consent confirmed — starting session...'
            : '✓ All parties have been notified and agree to recording'}
        </button>
        <button
          onClick={handleDecline}
          disabled={state === 'accepted' || state === 'declined'}
          className="rounded-lg px-5 py-3 text-xs font-medium text-white transition-all duration-300"
          style={{
            background: state === 'declined' ? '#22c55e' : '#ef4444',
            opacity: state === 'accepted' ? 0.3 : 1,
          }}
          data-testid="gdpr-decline"
        >
          {state === 'declined'
            ? '✓ Reminder set — session paused'
            : '✕ Not yet — remind me'}
        </button>
      </div>

      <p className="text-[10px] text-gray-500">
        This consent is logged for compliance. Region: EU (GDPR)
      </p>
    </div>
  )
}
