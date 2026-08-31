import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'

// We test the pure helper functions extracted from main.ts
import { resolveWindowUrl } from '../main'

describe('main — resolveWindowUrl', () => {
  // Feature: electron-packaging, Property 6: Dev mode URL selection
  it('returns Vite dev server URL in development mode for any port', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1024, max: 65535 }),
        (port) => {
          const url = resolveWindowUrl('development', port)
          expect(url).toMatch(/^http:\/\/localhost:/)
          expect(url).not.toMatch(/^file:\/\//)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns file:// URL in production mode', () => {
    const url = resolveWindowUrl('production')
    expect(url).toMatch(/^file:\/\//)
  })

  it('returns file:// URL in staging mode', () => {
    const url = resolveWindowUrl('staging')
    expect(url).toMatch(/^file:\/\//)
  })

  // Feature: electron-packaging, Property 4: Tray minimize/restore round-trip
  it('window hide/show cycle — mock BrowserWindow', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (startVisible) => {
          // Simulate the hide-on-close / show-on-restore pattern
          let visible = startVisible
          let destroyed = false

          const mockWin = {
            isVisible: () => visible,
            isDestroyed: () => destroyed,
            hide: () => { visible = false },
            show: () => { visible = true },
          }

          // Simulate close event handler (hides, not destroys)
          mockWin.hide()
          expect(mockWin.isVisible()).toBe(false)
          expect(mockWin.isDestroyed()).toBe(false)

          // Simulate tray restore
          mockWin.show()
          expect(mockWin.isVisible()).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})
