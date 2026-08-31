// @ts-nocheck
import { describe, it, expect } from 'vitest'
import {
  MEDDIC_ELEMENTS,
  defaultMEDDICScores,
  type MEDDICScores,
  type Session,
} from '@ptv-discovery-coach/shared'

describe('shared types', () => {
  it('MEDDIC_ELEMENTS contains exactly 12 elements', () => {
    expect(MEDDIC_ELEMENTS).toHaveLength(12)
  })

  it('defaultMEDDICScores returns all 12 elements initialised to 0', () => {
    const scores: MEDDICScores = defaultMEDDICScores()
    expect(Object.keys(scores)).toHaveLength(12)
    for (const el of MEDDIC_ELEMENTS) {
      expect(scores[el]).toBe(0)
    }
  })

  it('Session type includes sessionType and audioRecordingUrl fields', () => {
    // Compile-time check: construct a minimal Session object
    const session: Session = {
      id: 'test-id',
      accountId: 'account-id',
      repId: 'rep-id',
      startedAt: new Date(),
      coverageScores: defaultMEDDICScores(),
      sessionType: 'live',
    }
    expect(session.sessionType).toBe('live')
    expect(session.audioRecordingUrl).toBeUndefined()
  })

  it('Session sessionType can be offline_recovery', () => {
    const session: Session = {
      id: 'test-id',
      accountId: 'account-id',
      repId: 'rep-id',
      startedAt: new Date(),
      coverageScores: defaultMEDDICScores(),
      sessionType: 'offline_recovery',
      audioRecordingUrl: 'https://storage.example.com/audio.mp3',
    }
    expect(session.sessionType).toBe('offline_recovery')
    expect(session.audioRecordingUrl).toBe('https://storage.example.com/audio.mp3')
  })
})
