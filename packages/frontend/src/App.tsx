// @ts-nocheck
/**
 * App — Full Discovery Coach application
 * Ports the demo-v3 experience into the real React app.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { ROICalculator } from './components/ROICalculator'
import { PDIFSession } from './components/PDIFSession'
import {
  QUESTIONS as FULL_QUESTIONS,
  type QuestionEntry,
} from './questions'
import {
  analyzeAnswer,
  computeScoreDelta,
  pickNextQuestion,
  getCoachingNote,
  getTotalQuestionCount,
  getQuestionsByElement,
  MEDDIC_ELEMENTS,
  type SessionState,
} from './questionEngine'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Account {
  id: string
  name: string
  industry: string
  sessions: number
  lastCall: string
  health: Record<string, number>
  contactList: Contact[]
}

interface Contact {
  id: string
  name: string
  title: string
  email: string
  phone: string
  dealRole: string
}

type View = 'accounts' | 'overview' | 'session' | 'roi' | 'contacts' | 'leexi' | 'admin' | 'manager' | 'history'

const SEGMENTS = [
  { id: 'ThirdPartyLogistics', label: '3PL', icon: '🏭' },
  { id: 'BuildingSupply', label: 'Building Supply', icon: '🏗️' },
  { id: 'ManufacturingDistribution', label: 'Mfg & Distribution', icon: '⚙️' },
  { id: 'RetailEcommerce', label: 'Retail', icon: '🛒' },
  { id: 'FoodBeverageFMCG', label: 'Food & Bev', icon: '🥤' },
  { id: 'HealthcarePharma', label: 'Healthcare', icon: '💊' },
  { id: 'FieldServices', label: 'Field Services', icon: '🔧' },
  { id: 'Other', label: 'Other', icon: '📦' },
]

// Use the full 162-question bank from CSV
const QUESTIONS = FULL_QUESTIONS

const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'acme', name: 'Acme Logistics GmbH', industry: 'ManufacturingDistribution', sessions: 3, lastCall: 'Apr 4, 2026', health: { Goals: 85, Metrics: 72, EconomicBuyer: 38, Champion: 42, IdentifyPain: 81, DecisionProcess: 51 }, contactList: [
    { id: 'c1', name: 'Dr. Katharina Engel', title: 'COO Logistics', email: 'k.engel@acme.de', phone: '+49 40 8832 4710', dealRole: 'Economic Buyer' },
    { id: 'c2', name: 'Thomas Weber', title: 'VP Supply Chain', email: 't.weber@acme.de', phone: '+49 40 8832 4720', dealRole: 'Champion' },
  ] },
  { id: 'weber', name: 'Weber Spedition AG', industry: 'BuildingSupply', sessions: 1, lastCall: 'Mar 28, 2026', health: { Goals: 45, Metrics: 30, EconomicBuyer: 0, Champion: 0, IdentifyPain: 55, DecisionProcess: 20 }, contactList: [
    { id: 'c3', name: 'Hans Müller', title: 'Fleet Manager', email: 'h.muller@weber.de', phone: '+49 30 1234 5678', dealRole: 'Technical Buyer' },
  ] },
  { id: 'schmidt', name: 'Schmidt Cold Chain', industry: 'FoodBeverageFMCG', sessions: 0, lastCall: '—', health: { Goals: 0, Metrics: 0, EconomicBuyer: 0, Champion: 0, IdentifyPain: 0, DecisionProcess: 0 }, contactList: [] },
]

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  bg: '#f5f5f5', surface: '#ffffff', surface2: '#f2f2f2', border: '#e0e0e0',
  text: '#1a1a1a', text2: '#333333', text3: '#666666',
  accent: '#E31E24', green: '#4CAF50', red: '#E31E24', yellow: '#F26522', purple: '#7B1FA2',
  gradient: 'linear-gradient(135deg, #F26522 0%, #E31E24 35%, #C2185B 65%, #7B1FA2 100%)',
}

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'https://ptv-discovery-coach.onrender.com'

// ─── Auth Types ───────────────────────────────────────────────────────────────

interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  mustChangePassword: boolean
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App(): React.ReactElement {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('ptv_token'))
  const [authLoading, setAuthLoading] = useState(true)
  const [toast, setToast] = useState('')

  // Check stored token on mount
  useEffect(() => {
    const token = localStorage.getItem('ptv_token')
    if (token) {
      fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => { setAuthUser(data.user); setAuthToken(token) })
        .catch(() => { localStorage.removeItem('ptv_token'); setAuthToken(null) })
        .finally(() => setAuthLoading(false))
    } else {
      setAuthLoading(false)
    }
  }, [])

  const handleLogin = (token: string, user: AuthUser) => {
    localStorage.setItem('ptv_token', token)
    setAuthToken(token)
    setAuthUser(user)
  }

  const handleLogout = () => {
    localStorage.removeItem('ptv_token')
    setAuthToken(null)
    setAuthUser(null)
  }

  const handlePasswordChanged = (newToken: string) => {
    localStorage.setItem('ptv_token', newToken)
    setAuthToken(newToken)
    if (authUser) setAuthUser({ ...authUser, mustChangePassword: false })
  }

  if (authLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: S.bg, color: S.text3 }}>Loading…</div>
  }

  // Not logged in → show login screen
  if (!authUser || !authToken) {
    return (
      <div style={{ minHeight: '100vh', background: S.bg }}>
        <LoginPage onLogin={handleLogin} />
        {toast && <div className="ptv-toast">{toast}</div>}
      </div>
    )
  }

  // Must change password → force password change
  if (authUser.mustChangePassword) {
    return (
      <div style={{ minHeight: '100vh', background: S.bg }}>
        <ChangePasswordPage token={authToken} onChanged={handlePasswordChanged} />
      </div>
    )
  }

  // Logged in → render the main app
  return <MainApp authUser={authUser} authToken={authToken} onLogout={handleLogout} />
}

// ─── Main App (post-login) ────────────────────────────────────────────────────

function MainApp({ authUser, authToken: _authToken, onLogout }: { authUser: AuthUser; authToken: string; onLogout: () => void }): React.ReactElement {
  const [view, setView] = useState<View>('accounts')
  const [acct, setAcct] = useState<Account | null>(null)
  const [accounts, setAccounts] = useState<Account[]>(DEFAULT_ACCOUNTS)
  const [showNew, setShowNew] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2200) }

  // Load accounts from API on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/accounts`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.accounts?.length > 0) {
          const mapped: Account[] = data.accounts.map((a: any) => ({
            id: a.id, name: a.name, industry: a.industrySegment || 'Other',
            sessions: a.sessions?.length || 0,
            lastCall: a.sessions?.[0]?.startedAt ? new Date(a.sessions[0].startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
            health: a.sessions?.[0]?.coverageScores || { Goals: 0, Metrics: 0, EconomicBuyer: 0, Champion: 0, IdentifyPain: 0, DecisionProcess: 0 },
            contactList: [],
          }))
          setAccounts(prev => [...mapped, ...prev.filter(p => !mapped.some((m: Account) => m.name === p.name))])
        }
      })
      .catch(() => {}) // Fallback to DEFAULT_ACCOUNTS
  }, [])

  const selectAcct = (a: Account) => { setAcct(a); setView('overview') }
  const goHome = () => { setAcct(null); setView('accounts') }

  const addContact = useCallback((c: Contact) => {
    if (!acct) return
    const updated = { ...acct, contactList: [...acct.contactList, c] }
    setAcct(updated)
    setAccounts(prev => prev.map(a => a.id === updated.id ? updated : a))
  }, [acct])

  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: S.bg, color: S.text, fontSize: 14 }}>
      {/* Mobile overlay */}
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 9 }} />}

      {/* Sidebar */}
      <Sidebar view={view} acct={acct} onNav={(v) => { setView(v); setSidebarOpen(false) }} onHome={() => { goHome(); setSidebarOpen(false) }} mobileOpen={sidebarOpen} userName={authUser.name} userRole={authUser.role} onLogout={onLogout} />

      {/* Main */}
      <main style={{ flex: 1, marginLeft: 0, padding: '16px', overflowY: 'auto', minHeight: '100vh' }}>
        {/* Mobile header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${S.border}` }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="btn-ghost" style={{ padding: '6px 10px', fontSize: 16 }}>☰</button>
          <span style={{ fontSize: 14, fontWeight: 600, color: S.text }}>{acct ? acct.name : 'PTV Discovery Coach'}</span>
        </div>
        {view === 'accounts' && <AccountsPage accounts={accounts} onSelect={selectAcct} showNew={showNew} onToggleNew={() => setShowNew(!showNew)} onCreateAcct={(a) => {
          setAccounts([a, ...accounts]); setShowNew(false); selectAcct(a)
          // Persist to backend
          fetch(`${API_BASE}/api/accounts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: a.name, industrySegment: a.industry }) }).catch(() => {})
        }} showToast={showToast} />}
        {view === 'overview' && acct && <OverviewPage acct={acct} onNav={setView} showToast={showToast} onAddContact={addContact} />}
        {view === 'session' && acct && <PDIFSessionWrapper acct={acct} onNav={setView} showToast={showToast} />}
        {view === 'roi' && acct && <ROIPage acct={acct} />}
        {view === 'leexi' && acct && <LeexiPage acct={acct} showToast={showToast} />}
        {view === 'contacts' && acct && <ContactsPage acct={acct} onAddContact={addContact} showToast={showToast} />}
        {view === 'history' && acct && <SessionHistoryPage acct={acct} showToast={showToast} />}
        {view === 'admin' && <AdminPage showToast={showToast} />}
        {view === 'manager' && <ManagerDashboard accounts={accounts} showToast={showToast} />}
      </main>

      {/* Toast */}
      {toast && <div className="ptv-toast">{toast}</div>}
    </div>
  )
}


// ─── Login Page ───────────────────────────────────────────────────────────────

function LoginPage({ onLogin }: { onLogin: (token: string, user: AuthUser) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Login failed'); setLoading(false); return }
      onLogin(data.token, data.user)
    } catch (_e) { setError('Cannot reach server — it may be waking up (30s)') }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400, borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
        {/* Gradient header */}
        <div className="ptv-header" style={{ justifyContent: 'center', flexDirection: 'column', textAlign: 'center', padding: '1.75rem 2rem' }}>
          <div className="ptv-header-logo" style={{ marginBottom: '0.75rem' }}>PTV Logistics</div>
          <p className="ptv-header-title" style={{ fontSize: '1.4rem' }}>Discovery Coach</p>
          <p className="ptv-header-sub">Sign in to continue</p>
        </div>
        <div style={{ background: S.surface, padding: 32 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: S.text3, display: 'block', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus className="ptv-input" placeholder="you@ptvlogistics.com" />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: S.text3, display: 'block', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="ptv-input" placeholder="••••••••" />
          </div>
          {error && <div style={{ fontSize: 12, color: S.red, marginBottom: 12, padding: '8px 12px', background: '#fef2f2', borderRadius: 8, borderLeft: `3px solid ${S.red}` }}>{error}</div>}
          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '11px 0', fontSize: 14 }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        </div>
      </div>
    </div>
  )
}

// ─── Change Password Page ─────────────────────────────────────────────────────

function ChangePasswordPage({ token, onChanged }: { token: string; onChanged: (newToken: string) => void }) {
  const [newPw, setNewPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (newPw.length < 6) { setError('Password must be at least 6 characters'); return }
    if (newPw !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword: newPw }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed'); setLoading(false); return }
      onChanged(data.token)
    } catch { setError('Cannot reach server') }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400, borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
        <div className="ptv-header" style={{ justifyContent: 'center', flexDirection: 'column', textAlign: 'center', padding: '1.5rem 2rem' }}>
          <div className="ptv-header-logo" style={{ marginBottom: '0.6rem' }}>PTV Logistics</div>
          <p className="ptv-header-title" style={{ fontSize: '1.2rem' }}>Set Your Password</p>
          <p className="ptv-header-sub">You're using a temporary password. Please set a new one.</p>
        </div>
        <div style={{ background: S.surface, padding: 32 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: S.text3, display: 'block', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>New Password</label>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required autoFocus className="ptv-input" placeholder="At least 6 characters" />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: S.text3, display: 'block', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Confirm Password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required className="ptv-input" placeholder="Repeat password" />
          </div>
          {error && <div style={{ fontSize: 12, color: S.red, marginBottom: 12, padding: '8px 12px', background: '#fef2f2', borderRadius: 8, borderLeft: `3px solid ${S.red}` }}>{error}</div>}
          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '11px 0', fontSize: 14 }}>
            {loading ? 'Saving…' : 'Set Password & Continue'}
          </button>
        </form>
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ view, acct, onNav, onHome, mobileOpen, userName, userRole, onLogout }: { view: View; acct: Account | null; onNav: (v: View) => void; onHome: () => void; mobileOpen: boolean; userName?: string; userRole?: string; onLogout?: () => void }) {
  return (
    <aside style={{ width: 220, background: S.surface, borderRight: `1px solid ${S.border}`, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: mobileOpen ? 0 : -220, bottom: 0, zIndex: 10, transition: 'left .2s ease' }}>
      <div className="ptv-sidebar-brand" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 4, padding: '3px 7px', fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: '0.03em' }}>PTV</div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Discovery Coach</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>PTV Logistics</div>
          </div>
        </div>
      </div>
      {!acct ? (
        <nav style={{ flex: 1, padding: '8px 0' }}>
          <NavItem icon="📋" label="Accounts" active={view === 'accounts'} onClick={() => onNav('accounts')} />
          <div style={{ padding: '16px 20px 4px', fontSize: 10, fontWeight: 700, color: S.text3, textTransform: 'uppercase', letterSpacing: '.05em' }}>Tools</div>
          <NavItem icon="📈" label="Manager Dashboard" active={view === 'manager'} onClick={() => onNav('manager')} />
          <NavItem icon="⚙️" label="Admin" active={view === 'admin'} onClick={() => onNav('admin')} />
        </nav>
      ) : (
        <nav style={{ flex: 1, padding: '8px 0' }}>
          <button onClick={onHome} style={{ width: '100%', padding: '8px 20px', fontSize: 12, color: S.text2, background: 'none', border: 'none', borderBottom: `1px solid ${S.border}`, textAlign: 'left', cursor: 'pointer', marginBottom: 8 }}>← Back to Account History</button>
          <div style={{ padding: '4px 20px', fontSize: 13, fontWeight: 600, color: S.text }}>{acct.name}</div>
          <div style={{ marginTop: 8 }}>
            <NavItem icon="📁" label="Overview" active={view === 'overview'} onClick={() => onNav('overview')} />
            <NavItem icon="🎙" label="Live Session" active={view === 'session'} onClick={() => onNav('session')} />
            <NavItem icon="📊" label="ROI Calculator" active={view === 'roi'} onClick={() => onNav('roi')} />
            <NavItem icon="🔗" label="Leexi Import" active={view === 'leexi'} onClick={() => onNav('leexi')} />
            <NavItem icon="👥" label="Contacts" active={view === 'contacts'} onClick={() => onNav('contacts')} />
            <NavItem icon="📜" label="Session History" active={view === 'history'} onClick={() => onNav('history')} />
          </div>
          <div style={{ padding: '16px 20px 4px', fontSize: 10, fontWeight: 700, color: S.text3, textTransform: 'uppercase', letterSpacing: '.05em' }}>Tools</div>
          <NavItem icon="📈" label="Manager Dashboard" active={view === 'manager'} onClick={() => onNav('manager')} />
          <NavItem icon="⚙️" label="Admin" active={view === 'admin'} onClick={() => onNav('admin')} />
        </nav>
      )}
      <div style={{ padding: '12px 20px', borderTop: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: S.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>{(userName || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 500, color: S.text }}>{userName || 'User'}</div><div style={{ fontSize: 10, color: S.text3 }}>{userRole || 'Rep'}</div></div>
        {onLogout && <button onClick={onLogout} style={{ background: 'none', border: 'none', color: S.text3, fontSize: 10, cursor: 'pointer', padding: '2px 4px' }} title="Logout">⏻</button>}
      </div>
    </aside>
  )
}

function NavItem({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 16px', fontSize: 13,
      color: active ? S.red : S.text2,
      background: active ? '#fef2f2' : 'transparent',
      border: 'none', borderLeft: active ? `3px solid ${S.red}` : '3px solid transparent',
      cursor: 'pointer', textAlign: 'left', fontWeight: active ? 600 : 400,
      transition: 'background 0.12s, color 0.12s',
    }}>
      <span>{icon}</span><span>{label}</span>
    </button>
  )
}

// ─── Matrix Logo ──────────────────────────────────────────────────────────────

function MatrixLogo() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    const w = c.width, h = c.height, sz = 10
    const cols = Math.floor(w / sz)
    const drops: number[] = Array.from({ length: cols }, () => Math.random() * -6)
    const chars = '0123456789ABCDEF'
    let animId: number
    function draw() {
      ctx!.fillStyle = 'rgba(0,0,0,0.04)'
      ctx!.fillRect(0, 0, w, h)
      ctx!.font = `bold ${sz}px Consolas,monospace`
      for (let i = 0; i < drops.length; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)]
        ctx!.fillStyle = Math.random() > .3 ? 'rgba(230,51,18,1)' : 'rgba(230,51,18,.6)'
        ctx!.fillText(ch, i * sz, drops[i] * sz)
        if (drops[i] * sz > h && Math.random() > .93) drops[i] = 0
        drops[i] += 0.04 + Math.random() * 0.04
      }
      ctx!.font = 'bold 16px Segoe UI,sans-serif'
      ctx!.shadowColor = 'rgba(0,0,0,.8)'; ctx!.shadowBlur = 3
      ctx!.fillStyle = '#e63312'
      ctx!.fillText('PTV', 4, 22)
      ctx!.shadowBlur = 0
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animId)
  }, [])
  return <canvas ref={canvasRef} width={80} height={32} style={{ width: 40, height: 16, borderRadius: 4, background: '#000' }} />
}


// ─── Accounts Page ────────────────────────────────────────────────────────────

function AccountsPage({ accounts, onSelect, showNew, onToggleNew, onCreateAcct, showToast }: { accounts: Account[]; onSelect: (a: Account) => void; showNew: boolean; onToggleNew: () => void; onCreateAcct: (a: Account) => void; showToast: (m: string) => void }) {
  const [name, setName] = useState(''); const [seg, setSeg] = useState('')
  const [scanning, setScanning] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactTitle, setContactTitle] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactAddress, setContactAddress] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [detectingSeg, setDetectingSeg] = useState(false)
  const [customSegments, setCustomSegments] = useState<Array<{id: string; label: string; icon: string}>>(() => {
    try {
      const stored = localStorage.getItem('ptv_custom_segments')
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  })

  // Persist custom segments whenever they change
  useEffect(() => {
    localStorage.setItem('ptv_custom_segments', JSON.stringify(customSegments))
  }, [customSegments])
  const allSegments = [...SEGMENTS.filter(s => s.id !== 'Other'), ...customSegments, SEGMENTS.find(s => s.id === 'Other')!]

  const autoDetectSegment = async () => {
    if (!name.trim()) { showToast('Enter or scan a company name first'); return }
    setDetectingSeg(true)
    try {
      const token = localStorage.getItem('ptv_token') || ''
      const res = await fetch('http://localhost:4000/api/ai/detect-segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ companyName: name.trim(), title: contactTitle }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.isNew && data.segmentId && data.label && data.icon) {
          // Add new segment dynamically
          const exists = customSegments.find(s => s.id === data.segmentId)
          if (!exists) {
            setCustomSegments(prev => [...prev, { id: data.segmentId, label: data.label, icon: data.icon }])
          }
          setSeg(data.segmentId)
          showToast(`✓ New segment: ${data.icon} ${data.label}`)
        } else if (data.segmentId && data.segmentId !== 'Other' && [...SEGMENTS, ...customSegments].find(s => s.id === data.segmentId)) {
          setSeg(data.segmentId)
          const found = [...SEGMENTS, ...customSegments].find(s => s.id === data.segmentId)
          showToast(`✓ Detected: ${found?.label || data.segmentId}`)
        } else {
          showToast('⚠ Could not determine industry — select manually')
        }
      } else {
        showToast('⚠ Detection failed — select manually')
      }
    } catch {
      showToast('⚠ Detection failed — select manually')
    }
    setDetectingSeg(false)
  }

  const handleScanComplete = (text: string) => {
    setShowScanner(false)
    const cleaned = text.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim()
    if (!cleaned) { showToast('⚠ No text detected'); return }

    const lines = cleaned.split('\n').map((l: string) => l.trim()).filter(Boolean)
    
    let company = '', person = '', title = '', email = '', phone = '', address = ''
    
    const companyPatterns = /\b(inc|llc|ltd|gmbh|corp|ag|co\b|group|lubricants|logistics|solutions|services|technologies|systems|partners|consulting|transport|freight)\b/i
    const titlePatterns = /\b(manager|director|vp|president|ceo|coo|cfo|head|lead|chief|analyst|engineer|architect|coordinator|specialist|development|sales|marketing|operations|planner|dispatcher|supervisor)\b/i
    const personPattern = /^[A-Z][a-z]+ [A-Z][a-z]+(\s[A-Z][a-z]+)?$/
    
    for (const line of lines) {
      // Email
      const emailMatch = line.match(/[\w.-]+@[\w.-]+\.\w+/)
      if (emailMatch && !email) { email = emailMatch[0]; continue }
      
      // Phone (Tel, Mobile, Fax, or just a number pattern)
      if (line.match(/^(Tel|Mobile|Phone|Fax|Cell)/i) && !phone) {
        phone = line.replace(/^(Tel|Mobile|Phone|Fax|Cell)[:\s]*/i, '').trim()
        continue
      }
      if (!phone && line.match(/^\+?\d[\d\s\-().]{8,}/)) { phone = line; continue }
      
      // Address (has street number or city/state pattern)
      if (line.match(/\d+\s+\w+\s+(st|street|ave|avenue|rd|road|blvd|dr|drive|way|ln|lane)/i) || 
          line.match(/^P\.\s*O\.\s*Box/i) ||
          line.match(/(Houston|Dallas|Austin|Berlin|Munich|Frankfurt|New York|Chicago|London)/i)) {
        address = address ? address + ', ' + line : line
        continue
      }
      
      // Company name
      if (!company && companyPatterns.test(line)) { company = line; continue }
      
      // Job title
      if (!title && titlePatterns.test(line)) { title = line; continue }
      
      // Person name (2-3 capitalized words, no numbers, not already matched)
      if (!person && personPattern.test(line) && !titlePatterns.test(line)) { person = line; continue }
    }
    
    // Fallbacks
    if (!company && !person && lines.length >= 1) company = lines[0]
    
    if (company) setName(company)
    if (person) setContactName(person)
    if (title) setContactTitle(title)
    if (email) setContactEmail(email)
    if (phone) setContactPhone(phone)
    if (address) setContactAddress(address)
    
    const parts = [company, person].filter(Boolean)
    showToast(`✓ Card scanned: ${parts.join(' — ') || 'fields extracted'}`)
    
    // Auto-detect industry segment if we got a company name
    if (company) {
      setTimeout(() => autoDetectSegment(), 500)
    }
  }

  const handleImageFile = async (file: File) => {
    setScanning(true)
    showToast(`Processing ${file.name} (${(file.size/1024).toFixed(0)} KB)...`)
    try {
      const text = await ocrFromFile(file)
      console.log('[OCR] Result:', text)
      if (text) {
        handleScanComplete(text)
      } else {
        showToast('⚠ No text extracted — try a clearer image')
      }
    } catch (err) {
      console.error('[OCR] Error:', err)
      showToast('OCR error: ' + (err instanceof Error ? err.message : String(err)))
    }
    setScanning(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleImageFile(file)
    e.target.value = ''
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: S.text }}>Accounts</h1>
      <p style={{ fontSize: 13, color: S.text2, marginBottom: 16 }}>Select an account to start coaching</p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input style={{ flex: 1, background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: S.text, outline: 'none' }} placeholder="Search accounts..." />
        <button onClick={onToggleNew} style={{ background: S.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>+ New Account</button>
      </div>

      {showNew && (
        <div style={{ background: S.surface, border: `1px solid rgba(59,130,246,.3)`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 12 }}>Quick Account Capture</div>
          <div style={{ fontSize: 12, color: S.text3, marginBottom: 14 }}>Scan a business card to auto-fill, pick the industry, and start recording.</div>

          {/* Scan buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, padding: 12, background: 'rgba(59,130,246,.06)', border: '1px dashed rgba(59,130,246,.3)', borderRadius: 8, justifyContent: 'center' }}>
            <button onClick={() => setShowScanner(true)} style={{ background: S.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>📷 Camera</button>
            <button onClick={() => fileRef.current?.click()} style={{ background: 'none', color: S.text2, border: `1px solid ${S.border}`, borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>📁 Upload Image</button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
          </div>
          <p style={{ fontSize: 10, color: S.text3, textAlign: 'center', marginBottom: 16 }}>💡 Tip: For best OCR results on desktop, take a photo with your phone and use Upload</p>

          {/* Full-screen camera scanner */}
          {showScanner && <CameraScanner onCapture={handleScanComplete} onClose={() => setShowScanner(false)} />}

          {scanning && <MatrixScanOverlay />}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div><label style={{ fontSize: 11, color: S.text3 }}>Company Name *</label><input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', background: S.surface2, border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, color: S.text, outline: 'none', marginTop: 4 }} placeholder="e.g. Acme Logistics" /></div>
            <div><label style={{ fontSize: 11, color: S.text3 }}>Contact Name</label><input value={contactName} onChange={e => setContactName(e.target.value)} style={{ width: '100%', background: S.surface2, border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, color: S.text, outline: 'none', marginTop: 4 }} placeholder="e.g. Sarah Müller" /></div>
            <div><label style={{ fontSize: 11, color: S.text3 }}>Job Title</label><input value={contactTitle} onChange={e => setContactTitle(e.target.value)} style={{ width: '100%', background: S.surface2, border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, color: S.text, outline: 'none', marginTop: 4 }} placeholder="e.g. VP Supply Chain" /></div>
            <div><label style={{ fontSize: 11, color: S.text3 }}>Email</label><input value={contactEmail} onChange={e => setContactEmail(e.target.value)} style={{ width: '100%', background: S.surface2, border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, color: S.text, outline: 'none', marginTop: 4 }} placeholder="e.g. sarah@acme.com" /></div>
            <div><label style={{ fontSize: 11, color: S.text3 }}>Phone</label><input value={contactPhone} onChange={e => setContactPhone(e.target.value)} style={{ width: '100%', background: S.surface2, border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, color: S.text, outline: 'none', marginTop: 4 }} placeholder="e.g. +49 172 1234567" /></div>
            <div><label style={{ fontSize: 11, color: S.text3 }}>Address</label><input value={contactAddress} onChange={e => setContactAddress(e.target.value)} style={{ width: '100%', background: S.surface2, border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, color: S.text, outline: 'none', marginTop: 4 }} placeholder="e.g. 700 Milam St, Houston TX" /></div>
          </div>

          {/* Segment picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: S.text3 }}>Industry Segment *</span>
            <button onClick={autoDetectSegment} disabled={detectingSeg || !name.trim()} style={{ fontSize: 10, background: 'rgba(59,130,246,.1)', color: S.accent, border: `1px solid rgba(59,130,246,.3)`, borderRadius: 6, padding: '2px 8px', cursor: name.trim() ? 'pointer' : 'not-allowed', opacity: name.trim() ? 1 : 0.5 }}>
              {detectingSeg ? '⏳ Detecting...' : '🔍 Auto-detect'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6, marginBottom: 12 }}>
            {allSegments.map(s => (
              <button key={s.id} onClick={() => setSeg(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: seg === s.id ? 'rgba(59,130,246,.1)' : S.surface, border: `1px solid ${seg === s.id ? S.accent : S.border}`, borderRadius: 8, padding: 8, cursor: 'pointer', fontSize: 11, color: S.text }}>
                <span>{s.icon}</span><span>{s.label}</span>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { if (name.trim()) {
              const newContact = (contactName || contactEmail) ? {
                id: `c_${Date.now()}`,
                name: contactName || 'Unknown',
                title: contactTitle || '',
                email: contactEmail || '',
                phone: contactPhone || '',
                address: contactAddress || '',
                dealRole: '',
                persona: '',
              } : null
              onCreateAcct({ id: String(Date.now()), name: name.trim(), industry: seg || 'Other', sessions: 0, lastCall: 'Today', health: { Goals: 0, Metrics: 0, EconomicBuyer: 0, Champion: 0, IdentifyPain: 0, DecisionProcess: 0 }, contactList: newContact ? [newContact] : [] })
            }}} style={{ background: S.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Create & Start Session 🎙</button>
            <button onClick={onToggleNew} style={{ background: 'none', color: S.text2, border: `1px solid ${S.border}`, borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {accounts.map(a => (
          <button key={a.id} onClick={() => onSelect(a)} style={{ width: '100%', background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: 16, textAlign: 'left', cursor: 'pointer', transition: 'all .15s' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: S.text }}>{a.name}</div>
            <div style={{ fontSize: 12, color: S.text3, marginTop: 4 }}>{a.industry} · {a.sessions} sessions · Last: {a.lastCall}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Overview Page ────────────────────────────────────────────────────────────

function OverviewPage({ acct, onNav, showToast, onAddContact }: { acct: Account; onNav: (v: View) => void; showToast: (m: string) => void; onAddContact: (c: Contact) => void }) {
  const [showAddForm, setShowAddForm] = useState(false)
  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: S.text }}>{acct.name}</h1>
      <p style={{ fontSize: 13, color: S.text2, marginBottom: 16 }}>Account overview and discovery health</p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button onClick={() => onNav('session')} style={{ background: S.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>🎙 Start Session</button>
        <button onClick={() => onNav('roi')} style={{ background: 'none', color: S.text2, border: `1px solid ${S.border}`, borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>📊 ROI Calculator</button>
        <button onClick={() => onNav('history')} style={{ background: 'none', color: S.text2, border: `1px solid ${S.border}`, borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>📜 History</button>
      </div>

      {/* Leexi Sync */}
      <LeexiSyncCard showToast={showToast} />

      {/* Contacts on Overview */}
      <Card title={`Contacts (${acct.contactList.length})`}>
        {acct.contactList.map(c => <ContactRow key={c.id} contact={c} />)}
        {!showAddForm ? (
          <button onClick={() => setShowAddForm(true)} style={{ background: 'none', color: S.accent, border: `1px dashed ${S.border}`, borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', width: '100%', marginTop: 8 }}>+ Add Contact</button>
        ) : (
          <AddContactForm onAdd={(c) => { onAddContact(c); setShowAddForm(false); showToast('✓ Contact added') }} onCancel={() => setShowAddForm(false)} />
        )}
      </Card>

      {/* MEDDIC Health */}
      <Card title="MEDDIC Health">
        {Object.entries(acct.health).map(([k, v]) => (
          <MeterRow key={k} label={k.replace(/([A-Z])/g, ' $1').trim()} value={v} />
        ))}
      </Card>

      {/* Sessions */}
      <Card title="Recent Sessions">
        {acct.sessions === 0 ? <p style={{ fontSize: 12, color: S.text3 }}>No sessions yet. Start one to begin discovery.</p> : (
          <div style={{ fontSize: 12, color: S.text2 }}>{acct.sessions} session(s) · Last: {acct.lastCall}</div>
        )}
      </Card>
    </div>
  )
}


// ─── PDIF Session Wrapper ──────────────────────────────────────────────────────

function PDIFSessionWrapper({ acct, onNav, showToast }: { acct: Account; onNav: (v: View) => void; showToast: (m: string) => void }) {
  const token = localStorage.getItem('ptv_token') || '';
  const apiBase = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000';
  const [resolvedAccountId, setResolvedAccountId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);

  // Ensure account exists in backend before starting session
  useEffect(() => {
    async function ensureAccount() {
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      try {
        // Check if this account ID is a valid UUID that exists
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(acct.id);
        if (isUuid) {
          setResolvedAccountId(acct.id);
        } else {
          // Non-UUID ID means it's a hardcoded default — create in backend
          const res = await fetch(`${apiBase}/api/accounts`, {
            method: 'POST', headers,
            body: JSON.stringify({ name: acct.name, industrySegment: acct.industry }),
          });
          if (res.ok) {
            const created = await res.json();
            setResolvedAccountId(created.id);
          } else {
            // Try to find existing by listing accounts
            const listRes = await fetch(`${apiBase}/api/accounts`, { headers });
            if (listRes.ok) {
              const data = await listRes.json();
              const found = data.accounts?.find((a: any) => a.name === acct.name);
              if (found) {
                setResolvedAccountId(found.id);
              } else {
                showToast('Could not create account');
              }
            }
          }
        }
      } catch {
        showToast('Backend not reachable — is port 4000 running?');
      }
      setResolving(false);
    }
    ensureAccount();
  }, [acct.id, acct.name]);

  if (resolving) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 32 }}>🎙</div>
        <p style={{ fontSize: 14, color: '#666' }}>Preparing session...</p>
      </div>
    );
  }

  if (!resolvedAccountId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <p style={{ fontSize: 14, color: '#dc2626' }}>Could not connect to backend</p>
        <button onClick={() => onNav('overview')} style={{ padding: '8px 20px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>← Back</button>
      </div>
    );
  }

  return (
    <PDIFSession
      accountId={resolvedAccountId}
      accountName={acct.name}
      onEnd={() => { showToast('Session complete'); onNav('overview'); }}
      apiBase={apiBase}
      token={token}
    />
  );
}

// ─── Session Page (Continuous Coaching Flow) ──────────────────────────────────

function SessionPage({ acct, showToast, onNav }: { acct: Account; showToast: (m: string) => void; onNav: (v: View) => void }) {
  const [phase, setPhase] = useState<'gdpr' | 'active' | 'ended'>(() => {
    const EU_COUNTRIES = ['germany', 'france', 'netherlands', 'belgium', 'austria', 'switzerland', 'italy', 'spain', 'portugal', 'poland', 'czech', 'sweden', 'norway', 'denmark', 'finland', 'ireland', 'luxembourg', 'uk', 'united kingdom', 'great britain']
    const acctInfo = (acct.address || acct.country || acct.region || '').toLowerCase()
    const isEU = EU_COUNTRIES.some(c => acctInfo.includes(c)) || acctInfo.includes('eu') || acctInfo.includes('europe')
    const nameHints = (acct.name || '').toLowerCase()
    const hasEUHint = nameHints.includes('gmbh') || nameHints.includes(' ag') || nameHints.includes(' se') || nameHints.includes(' bv')
    return (isEU || hasEUHint) ? 'gdpr' : 'active'
  })
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const s: Record<string, number> = {}; for (const el of MEDDIC_ELEMENTS) s[el] = 0; return s
  })
  const [gdprState, setGdprState] = useState<'pending' | 'accepted'>('pending')
  const [transcript, setTranscript] = useState<string[]>([])
  const [liveText, setLiveText] = useState('')
  const [showCrmExport, setShowCrmExport] = useState(false)
  const recognitionRef = useRef<any>(null)
  const [suggestions, setSuggestions] = useState<Array<{ text: string; element: string; reason: string }>>(() =>
    QUESTIONS.slice(0, 3).map(q => ({ text: q.text, element: q.element, reason: q.note || '' }))
  )
  const [usedQuestions, setUsedQuestions] = useState<string[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [lastAnalysis, setLastAnalysis] = useState('')
  const [nudgePulse, setNudgePulse] = useState(false)
  const lastAnalyzedIdxRef = useRef(0)
  const analysisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { showToast('Speech recognition not supported'); return }
    const r = new SR(); r.continuous = true; r.interimResults = true; r.lang = 'en-US'
    r.onresult = (e: any) => { let interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) { setTranscript(p => [...p, t]); setLiveText('') } else { interim += t } }; setLiveText(interim) }
    r.onerror = () => { try { r.start() } catch {} }; r.onend = () => { try { r.start() } catch {} }
    r.start(); recognitionRef.current = r
  }, [showToast])
  const stopListening = useCallback(() => { if (recognitionRef.current) { recognitionRef.current.onend = null; recognitionRef.current.stop(); recognitionRef.current = null } }, [])

  const acceptGDPR = () => { setGdprState('accepted'); showToast('✓ Recording consent confirmed'); setTimeout(() => { setPhase('active') }, 800) }

  useEffect(() => { if (phase === 'active' && !recognitionRef.current) startListening() }, [phase, startListening])

  // Background AI analysis — triggers 8s after new speech arrives
  useEffect(() => {
    if (phase !== 'active' || transcript.length <= lastAnalyzedIdxRef.current) return
    if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current)
    analysisTimerRef.current = setTimeout(async () => {
      const newText = transcript.slice(lastAnalyzedIdxRef.current).join(' ')
      if (!newText.trim()) return
      lastAnalyzedIdxRef.current = transcript.length
      setAnalyzing(true)
      try {
        const token = localStorage.getItem('ptv_token') || ''
        const res = await fetch(`${API_BASE}/api/ai/analyze-answer`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ questionText: suggestions[0]?.text || 'discovery', element: suggestions[0]?.element || 'Goals', recentTranscript: newText, currentScores: scores, askedQuestionTexts: usedQuestions, accountIndustry: acct.industry }),
        })
        if (res.ok) {
          const result = await res.json()
          if (result.scoreDelta) setScores(prev => { const u = { ...prev }; for (const [el, d] of Object.entries(result.scoreDelta || {})) u[el] = Math.min(100, (u[el] || 0) + (d as number)); return u })
          if (result.nextQuestion) {
            const aiQ = result.nextQuestion
            const bankQs = QUESTIONS.filter(q => !usedQuestions.includes(q.text) && q.text !== aiQ.text).sort((a, b) => (scores[a.element] || 0) - (scores[b.element] || 0)).slice(0, 2).map(q => ({ text: q.text, element: q.element, reason: q.note || '' }))
            setSuggestions([aiQ, ...bankQs])
          }
          if (result.summary) setLastAnalysis(result.summary)
          setNudgePulse(true); setTimeout(() => setNudgePulse(false), 2000)
        } else {
          const a = analyzeAnswer(newText, suggestions[0]?.element || 'Goals'); const d = computeScoreDelta(a)
          setScores(prev => { const u = { ...prev }; for (const [el, v] of Object.entries(d)) u[el] = Math.min(100, (u[el] || 0) + v); return u })
          if (a.summary) setLastAnalysis(a.summary)
        }
      } catch {}
      setAnalyzing(false)
    }, 8000)
    return () => { if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current) }
  }, [transcript.length, phase])

  const useQuestion = (q: { text: string; element: string; reason: string }) => {
    setUsedQuestions(prev => [...prev, q.text]); trackUsage(q.text, q.element, 'accepted', 0)
    setSuggestions(prev => {
      const rest = prev.filter(s => s.text !== q.text)
      const next = QUESTIONS.filter(bq => !usedQuestions.includes(bq.text) && !rest.find(r => r.text === bq.text) && bq.text !== q.text).sort((a, b) => (scores[a.element] || 0) - (scores[b.element] || 0)).slice(0, 3 - rest.length).map(bq => ({ text: bq.text, element: bq.element, reason: bq.note || '' }))
      return [...rest, ...next].slice(0, 3)
    })
    showToast(`✓ ${q.element.replace(/([A-Z])/g, ' $1').trim()}`)
  }

  const endSession = () => {
    stopListening(); setPhase('ended'); showToast('Session complete')
    const session = { id: `s_${Date.now()}`, accountId: acct.id, accountName: acct.name, date: new Date().toISOString(), scores: { ...scores }, transcript: [...transcript], questionsAsked: usedQuestions.length, questionCount: usedQuestions.length, duration: 0 }
    try { const existing = JSON.parse(localStorage.getItem('ptv_sessions') || '[]'); existing.unshift(session); localStorage.setItem('ptv_sessions', JSON.stringify(existing.slice(0, 100))) } catch {}
    fetch(`${API_BASE}/api/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: acct.id, coverageScores: scores, transcript, durationSeconds: 0 }) }).catch(() => {})
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: S.text }}>Live Session</h1>
      <p style={{ fontSize: 13, color: S.text2, marginBottom: 16 }}>{acct.name} · Q{questionCount + 1}</p>

      {/* GDPR */}
      {phase === 'gdpr' && (
        <div style={{ background: 'linear-gradient(135deg,rgba(234,179,8,.05),rgba(239,68,68,.03))', border: '1px solid rgba(234,179,8,.3)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚖️</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: S.text, marginBottom: 6 }}>Recording Consent Required</div>
          <p style={{ fontSize: 12, color: S.text2, lineHeight: 1.6, marginBottom: 16, maxWidth: 400, margin: '0 auto 16px' }}>Under <strong style={{ color: S.yellow }}>GDPR (EU)</strong> and similar regulations, all parties must consent to being recorded.</p>
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: 12, marginBottom: 16, textAlign: 'left', maxWidth: 400, margin: '0 auto 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: S.text3, marginBottom: 4 }}>Suggested script:</div>
            <p style={{ fontSize: 12, color: S.text, lineHeight: 1.6, fontStyle: 'italic' }}>"Before we get started, I want to let you know that I'll be taking notes using an AI assistant. It will record and transcribe our discussion. Is that OK with you?"</p>
          </div>
          <button onClick={acceptGDPR} style={{ padding: '10px 28px', fontSize: 12, fontWeight: 500, color: '#fff', background: gdprState === 'accepted' ? S.green : S.red, border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'all .3s' }}>
            {gdprState === 'accepted' ? '✓ Consent confirmed — starting session...' : '✓ All parties have been notified and agree to recording'}
          </button>
        </div>
      )}

      {/* Active: Continuous coaching */}
      {phase === 'active' && (
        <div>
          <RecordingBar onEnd={endSession} />

          {/* Live Transcript */}
          <Card title="📝 Live Transcript">
            <div style={{ maxHeight: 150, overflowY: 'auto', fontSize: 12, color: S.text2, lineHeight: 1.6 }}>
              {transcript.length === 0 && !liveText && <span style={{ color: S.text3, fontStyle: 'italic' }}>Listening... speak to see transcription here</span>}
              {transcript.map((t, i) => <div key={i} style={{ marginBottom: 4 }}>{t}</div>)}
              {liveText && <div style={{ color: S.accent, fontStyle: 'italic' }}>{liveText}</div>}
            </div>
          </Card>

          {/* AI Insight */}
          {lastAnalysis && (
            <div style={{ background: 'rgba(34,197,94,.05)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 8, padding: 10, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 12 }}>🤖</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: S.green }}>AI Insight</span>
                {analyzing && <span style={{ fontSize: 9, color: S.text3, marginLeft: 'auto' }}>analyzing...</span>}
              </div>
              <p style={{ fontSize: 11, color: S.text2, lineHeight: 1.5, margin: 0 }}>{lastAnalysis}</p>
            </div>
          )}

          {/* Suggested Questions */}
          <div style={{ border: `2px solid ${nudgePulse ? S.green : S.border}`, borderRadius: 12, padding: 12, marginBottom: 12, transition: 'border-color 0.5s', background: nudgePulse ? 'rgba(34,197,94,.03)' : 'transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 12 }}>💡</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: S.text }}>Suggested Questions</span>
              <span style={{ fontSize: 9, color: S.text3, marginLeft: 'auto' }}>tap when asked</span>
            </div>
            {suggestions.map((q, i) => (
              <button key={q.text} onClick={() => useQuestion(q)} style={{ display: 'block', width: '100%', textAlign: 'left', background: i === 0 ? 'rgba(59,130,246,.06)' : 'transparent', border: `1px solid ${i === 0 ? 'rgba(59,130,246,.2)' : S.border}`, borderRadius: 8, padding: '8px 10px', marginBottom: 6, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 9, background: 'rgba(59,130,246,.15)', color: '#60a5fa', padding: '1px 6px', borderRadius: 8, fontWeight: 600 }}>{q.element.replace(/([A-Z])/g, ' $1').trim()}</span>
                  {i === 0 && <span style={{ fontSize: 9, color: S.green, fontWeight: 600 }}>⭐ Recommended</span>}
                </div>
                <p style={{ fontSize: 12, color: S.text, lineHeight: 1.4, margin: 0 }}>{q.text}</p>
              </button>
            ))}
          </div>

          {/* MEDDIC Coverage */}
          <Card title="MEDDIC Coverage">
            {MEDDIC_ELEMENTS.map(el => <MeterRow key={el} label={el.replace(/([A-Z])/g, ' $1').trim()} value={scores[el] || 0} />)}
          </Card>
        </div>
      )}

      {/* Session ended — Scorecard */}
      {phase === 'ended' && (
        <div>
          <Card title="📊 MEDDIC Scores — End of Session">
            {MEDDIC_ELEMENTS.map(el => <MeterRow key={el} label={el.replace(/([A-Z])/g, ' $1').trim()} value={scores[el] || 0} />)}
            <div style={{ fontSize: 11, color: S.text3, marginTop: 8 }}>{usedQuestions.length} questions asked</div>
          </Card>

          {/* Full Transcript */}
          {transcript.length > 0 && (
            <Card title="📝 Session Transcript">
              <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 12, color: S.text2, lineHeight: 1.6 }}>
                {transcript.map((t, i) => <div key={i} style={{ marginBottom: 4, paddingBottom: 4, borderBottom: `1px solid ${S.surface2}` }}>{t}</div>)}
              </div>
            </Card>
          )}

          {/* Email Summary */}
          <EmailSummaryCard acctName={acct.name} scores={scores} transcript={transcript} questionCount={questionCount} showToast={showToast} />

          {/* CRM Export */}
          {showCrmExport && <CRMExportPanel acctName={acct.name} acctIndustry={acct.industry} scores={scores} transcript={transcript} questionCount={questionCount} contacts={acct.contactList} showToast={showToast} onClose={() => setShowCrmExport(false)} />}

          {/* What's Next */}
          <div style={{ marginTop: 16, background: 'linear-gradient(135deg,rgba(59,130,246,.1),rgba(139,92,246,.05))', border: '2px solid rgba(59,130,246,.3)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>🚀 What's Next?</div>
            <p style={{ fontSize: 12, color: S.text2, marginBottom: 16 }}>Choose your next step.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <NextBtn icon="📁" title="View Account Overview" desc="See updated MEDDIC health" bg={S.accent} onClick={() => onNav('overview')} />
              <NextBtn icon="📊" title="Build ROI Calculator" desc="Quantify value for the customer" bg={S.green} onClick={() => onNav('roi')} />
              <NextBtn icon="🔄" title="Export to CRM" desc="Push to Salesforce or HubSpot" bg={S.purple} onClick={() => setShowCrmExport(true)} />
              <NextBtn icon="👥" title="Manage Contacts" desc="Update stakeholder map" bg="transparent" border onClick={() => onNav('contacts')} />
              <NextBtn icon="🎙" title="Start Another Session" desc="Continue discovery" bg="transparent" border onClick={() => {
                setPhase('active'); setTranscript([]); setUsedQuestions([]); setLastAnalysis(''); lastAnalyzedIdxRef.current = 0
                setSuggestions(QUESTIONS.slice(0, 3).map(q => ({ text: q.text, element: q.element, reason: q.note || '' })))
                const s: Record<string, number> = {}; for (const el of MEDDIC_ELEMENTS) s[el] = 0; setScores(s)
              }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NextBtn({ icon, title, desc, bg, border, onClick }: { icon: string; title: string; desc: string; bg: string; border?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: bg, color: border ? S.text2 : '#fff', border: border ? `1px solid ${S.border}` : 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontSize: 13 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span><strong>{title}</strong><br /><span style={{ fontSize: 11, opacity: .8 }}>{desc}</span></span>
    </button>
  )
}

/** Fire-and-forget question usage tracking */
function trackUsage(questionText: string, element: string, action: string, qualityScore: number) {
  fetch(`${API_BASE}/api/questions/track-usage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionText, element, action, qualityScore }),
  }).catch(() => {})
}

// ─── Post-Session Email Summary ───────────────────────────────────────────────

function EmailSummaryCard({ acctName, scores, transcript, questionCount, showToast }: {
  acctName: string; scores: Record<string, number>; transcript: string[]; questionCount: number; showToast: (m: string) => void
}) {
  const [emailText, setEmailText] = useState('')
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  const generateEmail = async () => {
    setLoading(true)
    const scoresStr = MEDDIC_ELEMENTS.map(el => `${el.replace(/([A-Z])/g, ' $1').trim()}: ${scores[el] || 0}/100`).join('\n')
    const transcriptStr = transcript.slice(-20).join('\n')

    try {
      const res = await fetch(`${API_BASE}/api/ai/analyze-answer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: '__EMAIL_SUMMARY__',
          element: 'Goals',
          recentTranscript: `GENERATE A POST-SESSION EMAIL SUMMARY.\n\nAccount: ${acctName}\nQuestions asked: ${questionCount}\n\nMEDDIC Scores:\n${scoresStr}\n\nTranscript highlights:\n${transcriptStr}\n\nWrite a professional email summary that a sales rep can send to their manager or the prospect. Include:\n1. Subject line\n2. Key findings organized by MEDDIC element (only elements with score > 0)\n3. Financial baseline data if mentioned\n4. Recommended next steps\n5. Action items with owners\n\nTone: professional, concise, actionable. Format as a ready-to-send email.`,
          currentScores: scores,
          askedQuestionTexts: [],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setEmailText(data.summary || buildLocalEmailSummary(acctName, scores, transcript, questionCount))
      } else {
        setEmailText(buildLocalEmailSummary(acctName, scores, transcript, questionCount))
      }
    } catch {
      setEmailText(buildLocalEmailSummary(acctName, scores, transcript, questionCount))
    }
    setGenerated(true)
    setLoading(false)
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(emailText).then(() => showToast('✓ Copied to clipboard')).catch(() => showToast('Copy failed'))
  }

  const openInEmail = () => {
    const subject = encodeURIComponent(`Discovery Session Summary — ${acctName}`)
    const body = encodeURIComponent(emailText)
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  if (!generated) {
    return (
      <Card title="📧 Email Summary">
        <p style={{ fontSize: 12, color: S.text3, marginBottom: 10 }}>Generate a polished email summary of this session to share with your team or the prospect.</p>
        <button onClick={generateEmail} disabled={loading} style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', opacity: loading ? .6 : 1 }}>
          {loading ? '🤖 Generating with AI...' : '📧 Generate Email Summary'}
        </button>
      </Card>
    )
  }

  return (
    <Card title="📧 Email Summary — Ready to Send">
      <textarea value={emailText} onChange={e => setEmailText(e.target.value)} style={{ width: '100%', minHeight: 250, background: S.surface2, border: `1px solid ${S.border}`, borderRadius: 8, padding: 12, fontSize: 12, color: S.text, lineHeight: 1.6, resize: 'vertical', outline: 'none', fontFamily: "'Segoe UI',sans-serif", boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={copyToClipboard} style={{ background: S.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>📋 Copy</button>
        <button onClick={openInEmail} style={{ background: S.green, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>📧 Open in Email</button>
        <button onClick={generateEmail} style={{ background: 'none', color: S.text2, border: `1px solid ${S.border}`, borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>↻ Regenerate</button>
      </div>
    </Card>
  )
}

function buildLocalEmailSummary(acctName: string, scores: Record<string, number>, transcript: string[], questionCount: number): string {
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const topElements = MEDDIC_ELEMENTS.filter(el => (scores[el] || 0) > 0).sort((a, b) => (scores[b] || 0) - (scores[a] || 0))
  const weakElements = MEDDIC_ELEMENTS.filter(el => (scores[el] || 0) < 30 && (scores[el] || 0) >= 0)

  let email = `Subject: Discovery Session Summary — ${acctName} (${date})\n\n`
  email += `Hi team,\n\nHere's a summary of today's discovery session with ${acctName}.\n\n`
  email += `Session: ${questionCount} questions asked | ${date}\n\n`
  email += `── MEDDIC Coverage ──\n`
  for (const el of topElements) {
    const score = scores[el] || 0
    const bar = score >= 60 ? '🟢' : score >= 30 ? '🟡' : '🔴'
    email += `${bar} ${el.replace(/([A-Z])/g, ' $1').trim()}: ${score}/100\n`
  }
  if (weakElements.length > 0) {
    email += `\n── Gaps to Address ──\n`
    for (const el of weakElements) {
      email += `⚠️ ${el.replace(/([A-Z])/g, ' $1').trim()} — needs more discovery\n`
    }
  }
  if (transcript.length > 0) {
    email += `\n── Key Quotes ──\n`
    for (const t of transcript.slice(-5)) {
      if (t.length > 20) email += `• "${t.substring(0, 150)}${t.length > 150 ? '...' : ''}"\n`
    }
  }
  email += `\n── Recommended Next Steps ──\n`
  email += `1. Schedule follow-up to address gaps in ${weakElements.slice(0, 2).map(el => el.replace(/([A-Z])/g, ' $1').trim()).join(' and ') || 'remaining MEDDIC elements'}\n`
  email += `2. Build ROI calculator with baseline data from this session\n`
  email += `3. Identify and engage the economic buyer\n\n`
  email += `Best regards,\nPTV Discovery Coach\n`
  return email
}

// ─── CRM Export Panel ─────────────────────────────────────────────────────────

function CRMExportPanel({ acctName, acctIndustry, scores, transcript, questionCount, contacts, showToast, onClose }: {
  acctName: string; acctIndustry: string; scores: Record<string, number>; transcript: string[]; questionCount: number; contacts: Contact[]; showToast: (m: string) => void; onClose: () => void
}) {
  const [crm, setCrm] = useState<'salesforce' | 'hubspot'>('salesforce')
  const [exporting, setExporting] = useState(false)

  const date = new Date().toISOString().split('T')[0]
  const avgScore = Math.round(MEDDIC_ELEMENTS.reduce((s, el) => s + (scores[el] || 0), 0) / MEDDIC_ELEMENTS.length)

  // Build Salesforce-formatted note
  const buildSalesforceNote = () => {
    let note = `=== PTV Discovery Coach — Session Export ===\n`
    note += `Account: ${acctName}\nIndustry: ${acctIndustry}\nDate: ${date}\nQuestions: ${questionCount}\nAvg MEDDIC Score: ${avgScore}/100\n\n`
    note += `--- MEDDIC Coverage ---\n`
    for (const el of MEDDIC_ELEMENTS) {
      if ((scores[el] || 0) > 0) note += `${el.replace(/([A-Z])/g, ' $1').trim()}: ${scores[el]}/100\n`
    }
    if (contacts.length > 0) {
      note += `\n--- Contacts ---\n`
      for (const c of contacts) note += `${c.name} — ${c.title} (${c.dealRole}) ${c.email}\n`
    }
    if (transcript.length > 0) {
      note += `\n--- Key Transcript ---\n`
      for (const t of transcript.slice(-8)) note += `• ${t.substring(0, 200)}\n`
    }
    note += `\n--- Next Steps ---\n`
    const weak = MEDDIC_ELEMENTS.filter(el => (scores[el] || 0) < 30)
    if (weak.length > 0) note += `Focus areas: ${weak.map(el => el.replace(/([A-Z])/g, ' $1').trim()).join(', ')}\n`
    return note
  }

  // Build HubSpot-formatted JSON
  const buildHubSpotPayload = () => ({
    properties: {
      dealname: `${acctName} — PTV Optiflow`,
      pipeline: 'default',
      dealstage: avgScore >= 60 ? 'qualifiedtobuy' : avgScore >= 30 ? 'presentationscheduled' : 'appointmentscheduled',
      description: buildSalesforceNote(),
      amount: '', // ROI would go here
      closedate: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
    },
    associations: contacts.map(c => ({ email: c.email, name: c.name, jobtitle: c.title })),
  })

  const copyForCRM = () => {
    const text = crm === 'salesforce' ? buildSalesforceNote() : JSON.stringify(buildHubSpotPayload(), null, 2)
    navigator.clipboard.writeText(text).then(() => showToast(`✓ ${crm === 'salesforce' ? 'Salesforce' : 'HubSpot'} data copied`)).catch(() => showToast('Copy failed'))
  }

  const pushToCRM = async () => {
    setExporting(true)
    // This would call the backend CRM integration endpoint when configured
    showToast(`⚠ Direct ${crm === 'salesforce' ? 'Salesforce' : 'HubSpot'} push requires API credentials — use Copy for now`)
    setExporting(false)
  }

  return (
    <Card title="🔄 CRM Export">
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button onClick={() => setCrm('salesforce')} style={{ flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 600, borderRadius: 8, border: `1px solid ${crm === 'salesforce' ? '#00A1E0' : S.border}`, background: crm === 'salesforce' ? 'rgba(0,161,224,.1)' : 'transparent', color: crm === 'salesforce' ? '#00A1E0' : S.text2, cursor: 'pointer' }}>☁️ Salesforce</button>
        <button onClick={() => setCrm('hubspot')} style={{ flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 600, borderRadius: 8, border: `1px solid ${crm === 'hubspot' ? '#FF7A59' : S.border}`, background: crm === 'hubspot' ? 'rgba(255,122,89,.1)' : 'transparent', color: crm === 'hubspot' ? '#FF7A59' : S.text2, cursor: 'pointer' }}>🟠 HubSpot</button>
      </div>

      {/* Preview */}
      <div style={{ background: S.surface2, borderRadius: 8, padding: 10, marginBottom: 10, maxHeight: 200, overflowY: 'auto' }}>
        <pre style={{ fontSize: 10, color: S.text2, lineHeight: 1.5, whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'Consolas,monospace' }}>
          {crm === 'salesforce' ? buildSalesforceNote() : JSON.stringify(buildHubSpotPayload(), null, 2)}
        </pre>
      </div>

      {/* Export data summary */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'rgba(59,130,246,.1)', color: S.accent }}>Score: {avgScore}/100</span>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'rgba(34,197,94,.1)', color: S.green }}>{contacts.length} contacts</span>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'rgba(167,139,250,.1)', color: S.purple }}>{transcript.length} transcript lines</span>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'rgba(234,179,8,.1)', color: S.yellow }}>Stage: {avgScore >= 60 ? 'Qualified' : avgScore >= 30 ? 'Presentation' : 'Discovery'}</span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={copyForCRM} style={{ flex: 1, background: crm === 'salesforce' ? '#00A1E0' : '#FF7A59', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>📋 Copy for {crm === 'salesforce' ? 'Salesforce' : 'HubSpot'}</button>
        <button onClick={pushToCRM} disabled={exporting} style={{ flex: 1, background: 'none', color: S.text2, border: `1px solid ${S.border}`, borderRadius: 8, padding: '8px 0', fontSize: 12, cursor: 'pointer', opacity: exporting ? .6 : 1 }}>⬆️ Push Direct</button>
        <button onClick={onClose} style={{ background: 'none', color: S.text3, border: `1px solid ${S.border}`, borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}>✕</button>
      </div>
    </Card>
  )
}


// ─── Leexi Types ──────────────────────────────────────────────────────────────

interface LeexiCall {
  id: string
  title: string
  date: string
  duration: number
  participants: string[]
  hasTranscript: boolean
  source: string
  summary: string | null
}

// ─── Leexi Sync Card (Overview page — compact) ───────────────────────────────

function LeexiSyncCard({ showToast }: { showToast: (m: string) => void }) {
  const [panel, setPanel] = useState<'none' | 'pull' | 'push'>('none')
  const [calls, setCalls] = useState<LeexiCall[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchCalls = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API_BASE}/api/leexi/calls?limit=5`)
      if (!res.ok) throw new Error(`${res.status}`)
      const json = await res.json()
      setCalls(json.calls ?? [])
    } catch (e: any) {
      setError(e.message || 'Failed to reach Leexi')
    }
    setLoading(false)
  }, [])

  const handleImport = async (call: LeexiCall) => {
    showToast(`Importing "${call.title}"...`)
    try {
      const res = await fetch(`${API_BASE}/api/leexi/import/${call.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: 'default' }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      showToast(`✓ Imported — ${call.title}`)
    } catch {
      showToast('⚠ Import failed — backend may be waking up, try again in 30s')
    }
  }

  return (
    <div style={{ background: 'linear-gradient(135deg,rgba(99,102,241,.08),rgba(59,130,246,.05))', border: '1px solid rgba(99,102,241,.25)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>🔗</span>
        <div><div style={{ fontSize: 14, fontWeight: 600, color: S.text }}>Leexi Audio Sync</div><div style={{ fontSize: 11, color: S.text3 }}>Pull transcripts or push recordings</div></div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: panel !== 'none' ? 12 : 0 }}>
        <button onClick={() => { setPanel(panel === 'pull' ? 'none' : 'pull'); if (panel !== 'pull') fetchCalls() }} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          <span style={{ fontSize: 18 }}>⬇️</span><span style={{ textAlign: 'left' }}><strong>Pull from Leexi</strong><br /><span style={{ fontSize: 10, opacity: .75 }}>Import transcripts</span></span>
        </button>
        <button onClick={() => setPanel(panel === 'push' ? 'none' : 'push')} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          <span style={{ fontSize: 18 }}>⬆️</span><span style={{ textAlign: 'left' }}><strong>Push to Leexi</strong><br /><span style={{ fontSize: 10, opacity: .75 }}>Send recordings</span></span>
        </button>
      </div>
      {panel === 'pull' && (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: S.text }}>⬇️ Recent Leexi Calls</div>
            <button onClick={fetchCalls} style={{ background: 'none', border: `1px solid ${S.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 10, color: S.text2, cursor: 'pointer' }}>↻ Refresh</button>
          </div>
          {loading && <div style={{ fontSize: 12, color: S.text3, padding: 8, textAlign: 'center' }}>⏳ Fetching from Leexi...</div>}
          {error && <div style={{ fontSize: 12, color: S.red, padding: 8 }}>⚠ {error} — backend may be waking up (free tier spins down after 15min)</div>}
          {!loading && !error && calls.length === 0 && <div style={{ fontSize: 12, color: S.text3, padding: 8, textAlign: 'center' }}>No calls found in Leexi</div>}
          {calls.map(c => <LeexiCallRow key={c.id} call={c} onImport={() => handleImport(c)} compact />)}
        </div>
      )}
      {panel === 'push' && (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: S.text, marginBottom: 8 }}>⬆️ Push Sessions to Leexi</div>
          <button onClick={() => showToast('✓ Audio uploaded to Leexi')} style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11, cursor: 'pointer' }}>⬆️ Push All Pending</button>
        </div>
      )}
    </div>
  )
}

// ─── ROI Page ─────────────────────────────────────────────────────────────────

function ROIPage({ acct }: { acct: Account }) {
  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: S.text }}>ROI Calculator</h1>
      <p style={{ fontSize: 13, color: S.text2, marginBottom: 16 }}>{acct.name}</p>
      <ROICalculator />
    </div>
  )
}

// ─── Leexi Page (full page with auto-poll) ───────────────────────────────────

function LeexiPage({ acct, showToast }: { acct: Account; showToast: (m: string) => void }) {
  const [calls, setCalls] = useState<LeexiCall[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState<string | null>(null)

  const fetchCalls = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API_BASE}/api/leexi/calls?limit=20`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setCalls(json.calls ?? [])
    } catch (e: any) {
      setError(e.message || 'Failed to reach backend')
    }
    setLoading(false)
  }, [])

  // Auto-poll on mount
  useEffect(() => { fetchCalls() }, [fetchCalls])

  const handleImport = async (call: LeexiCall) => {
    setImporting(call.id)
    showToast(`Importing "${call.title}"...`)
    try {
      const res = await fetch(`${API_BASE}/api/leexi/import/${call.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: acct.id }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const result = await res.json()
      showToast(`✓ Imported ${result.segmentsImported || 0} transcript segments`)
    } catch {
      showToast('⚠ Import failed — backend may be waking up (free tier), try again in 30s')
    }
    setImporting(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: S.text }}>Leexi Import</h1>
          <p style={{ fontSize: 13, color: S.text2 }}>{acct.name} — Pull call recordings & transcripts from Leexi</p>
        </div>
        <button onClick={fetchCalls} disabled={loading} style={{ background: S.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer', opacity: loading ? .6 : 1 }}>
          {loading ? '⏳ Loading...' : '↻ Refresh'}
        </button>
      </div>

      {/* Connection status */}
      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: error ? S.red : calls.length > 0 ? S.green : S.yellow }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: S.text }}>
            {error ? 'Connection Issue' : calls.length > 0 ? `Connected — ${calls.length} call(s) found` : loading ? 'Connecting to Leexi...' : 'No calls found'}
          </div>
          <div style={{ fontSize: 10, color: S.text3 }}>
            {error ? `${error} — Render free tier spins down after 15min inactivity. First request wakes it up (~30s).` : 'Polling your Leexi account via PTV backend'}
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div style={{ background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 12, padding: 16, marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 14, marginBottom: 6 }}>⚠️</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: S.text, marginBottom: 4 }}>Could not reach Leexi API</div>
          <div style={{ fontSize: 12, color: S.text2, marginBottom: 12, lineHeight: 1.5 }}>
            The backend on Render (free tier) spins down after 15 minutes of inactivity.<br />
            The first request wakes it up — this takes about 30 seconds.
          </div>
          <button onClick={fetchCalls} style={{ background: S.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 12, cursor: 'pointer' }}>Try Again</button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: 16, opacity: .5 }}>
              <div style={{ width: '60%', height: 14, background: S.surface2, borderRadius: 4, marginBottom: 8 }} />
              <div style={{ width: '40%', height: 10, background: S.surface2, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      )}

      {/* Call list */}
      {!loading && !error && calls.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {calls.map(c => (
            <LeexiCallRow key={c.id} call={c} onImport={() => handleImport(c)} importing={importing === c.id} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && calls.length === 0 && (
        <Card title="">
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🎙</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 4 }}>No recordings found</div>
            <div style={{ fontSize: 12, color: S.text3, lineHeight: 1.5 }}>
              Make a call using Leexi and it will appear here automatically.<br />
              You can also push recordings from a Live Session to Leexi.
            </div>
          </div>
        </Card>
      )}

      {/* Push section */}
      <div style={{ marginTop: 20 }}>
        <Card title="⬆️ Push to Leexi">
          <p style={{ fontSize: 12, color: S.text3, marginBottom: 10 }}>Send session recordings to Leexi for AI transcription and analysis.</p>
          <button onClick={() => showToast('Push requires a completed session with audio recording')} style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}>⬆️ Push Pending Sessions</button>
        </Card>
      </div>
    </div>
  )
}

// ─── Leexi Call Row ───────────────────────────────────────────────────────────

function LeexiCallRow({ call, onImport, compact, importing }: { call: LeexiCall; onImport: () => void; compact?: boolean; importing?: boolean }) {
  const mins = Math.round(call.duration / 60)
  const dateStr = call.date ? new Date(call.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 8 : 12, padding: compact ? '8px 10px' : '12px 16px', background: compact ? 'rgba(30,41,59,.7)' : S.surface, border: `1px solid ${compact ? 'rgba(71,85,105,.3)' : S.border}`, borderRadius: compact ? 8 : 12, marginBottom: compact ? 6 : 0 }}>
      <div style={{ width: compact ? 28 : 36, height: compact ? 28 : 36, borderRadius: '50%', background: call.hasTranscript ? 'rgba(34,197,94,.15)' : 'rgba(234,179,8,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: compact ? 12 : 14, flexShrink: 0 }}>
        {call.hasTranscript ? '✅' : '⏳'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: compact ? 12 : 13, fontWeight: 500, color: S.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{call.title}</div>
        <div style={{ fontSize: compact ? 10 : 11, color: S.text3 }}>
          {dateStr} · {mins}m{call.participants.length > 0 ? ` · ${call.participants.slice(0, 2).join(', ')}` : ''}{call.hasTranscript ? ' · ✓ Transcript ready' : ' · ⏳ Processing'}
        </div>
        {!compact && call.summary && (
          <div style={{ fontSize: 11, color: S.text2, marginTop: 4, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
            {call.summary}
          </div>
        )}
      </div>
      <button onClick={onImport} disabled={importing || !call.hasTranscript} style={{ background: call.hasTranscript ? '#6366f1' : S.surface2, color: call.hasTranscript ? '#fff' : S.text3, border: 'none', borderRadius: 6, padding: compact ? '4px 10px' : '6px 14px', fontSize: compact ? 10 : 11, cursor: call.hasTranscript ? 'pointer' : 'default', opacity: importing ? .6 : 1, flexShrink: 0 }}>
        {importing ? '⏳...' : 'Import'}
      </button>
    </div>
  )
}

// ─── Contacts Page ────────────────────────────────────────────────────────────

function ContactsPage({ acct, onAddContact, showToast }: { acct: Account; onAddContact: (c: Contact) => void; showToast: (m: string) => void }) {
  const [showAddForm, setShowAddForm] = useState(false)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: S.text }}>Contacts</h1>
          <p style={{ fontSize: 13, color: S.text2 }}>{acct.name} · {acct.contactList.length} contact(s)</p>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} style={{ background: S.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>+ Add Contact</button>
      </div>

      {showAddForm && (
        <div style={{ marginBottom: 16 }}>
          <AddContactForm onAdd={(c) => { onAddContact(c); setShowAddForm(false); showToast('✓ Contact added') }} onCancel={() => setShowAddForm(false)} />
        </div>
      )}

      {acct.contactList.length === 0 ? (
        <Card title=""><p style={{ fontSize: 12, color: S.text3, textAlign: 'center', padding: 20 }}>No contacts yet. Add one to start mapping the deal.</p></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {acct.contactList.map(c => (
            <Card key={c.id} title="">
              <ContactRow contact={c} />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Session History Page ─────────────────────────────────────────────────────

interface SavedSession {
  id: string
  accountId: string
  accountName: string
  date: string
  scores: Record<string, number>
  transcript: string[]
  questionsAsked: number
  questionCount: number
}

function SessionHistoryPage({ acct, showToast }: { acct: Account; showToast: (m: string) => void }) {
  const [sessions, setSessions] = useState<SavedSession[]>([])
  const [selected, setSelected] = useState<SavedSession | null>(null)

  useEffect(() => {
    try {
      const all = JSON.parse(localStorage.getItem('ptv_sessions') || '[]') as SavedSession[]
      setSessions(all.filter(s => s.accountId === acct.id))
    } catch { setSessions([]) }
  }, [acct.id])

  if (selected) {
    return (
      <div>
        <button onClick={() => setSelected(null)} style={{ background: 'none', color: S.text2, border: `1px solid ${S.border}`, borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer', marginBottom: 16 }}>← Back to History</button>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: S.text }}>Session Replay</h1>
        <p style={{ fontSize: 13, color: S.text2, marginBottom: 16 }}>{acct.name} · {new Date(selected.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>

        <Card title="📊 MEDDIC Scores">
          {MEDDIC_ELEMENTS.map(el => <MeterRow key={el} label={el.replace(/([A-Z])/g, ' $1').trim()} value={selected.scores[el] || 0} />)}
          <div style={{ fontSize: 11, color: S.text3, marginTop: 8 }}>{selected.questionCount} questions · {selected.questionsAsked} answered</div>
        </Card>

        {selected.transcript.length > 0 && (
          <Card title="📝 Full Transcript">
            <div style={{ maxHeight: 400, overflowY: 'auto', fontSize: 12, color: S.text2, lineHeight: 1.6 }}>
              {selected.transcript.map((t, i) => (
                <div key={i} style={{ marginBottom: 6, paddingBottom: 6, borderBottom: `1px solid ${S.surface2}` }}>
                  <span style={{ fontSize: 10, color: S.text3, marginRight: 6 }}>#{i + 1}</span>{t}
                </div>
              ))}
            </div>
          </Card>
        )}

        <EmailSummaryCard acctName={acct.name} scores={selected.scores} transcript={selected.transcript} questionCount={selected.questionCount} showToast={showToast} />
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: S.text }}>Session History</h1>
      <p style={{ fontSize: 13, color: S.text2, marginBottom: 16 }}>{acct.name} · {sessions.length} session(s)</p>

      {sessions.length === 0 ? (
        <Card title="">
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📜</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 4 }}>No sessions yet</div>
            <div style={{ fontSize: 12, color: S.text3 }}>Complete a live session and it will appear here for review.</div>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sessions.map(s => {
            const avg = Math.round(MEDDIC_ELEMENTS.reduce((sum, el) => sum + (s.scores[el] || 0), 0) / MEDDIC_ELEMENTS.length)
            const dateStr = new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            return (
              <button key={s.id} onClick={() => setSelected(s)} style={{ width: '100%', background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: 16, textAlign: 'left', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: avg >= 40 ? 'rgba(34,197,94,.15)' : 'rgba(234,179,8,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: avg >= 40 ? S.green : S.yellow, flexShrink: 0 }}>{avg}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{dateStr}</div>
                    <div style={{ fontSize: 11, color: S.text3 }}>{s.questionCount} questions · {s.transcript.length} transcript segments</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      {MEDDIC_ELEMENTS.filter(el => (s.scores[el] || 0) > 0).slice(0, 6).map(el => (
                        <span key={el} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: (s.scores[el] || 0) >= 60 ? 'rgba(34,197,94,.15)' : 'rgba(59,130,246,.15)', color: (s.scores[el] || 0) >= 60 ? S.green : S.accent }}>{el.substring(0, 4)} {s.scores[el]}</span>
                      ))}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: S.text3 }}>→</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Manager Dashboard ────────────────────────────────────────────────────────

function ManagerDashboard({ accounts, showToast: _showToast }: { accounts: Account[]; showToast: (m: string) => void }) {
  const [users, setUsers] = useState<any[]>([])
  const token = localStorage.getItem('ptv_token') || ''

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { users: [] })
      .then(d => setUsers(d.users || []))
      .catch(() => {})
  }, [token])

  // Aggregate MEDDIC health across all accounts
  const pipelineHealth: Record<string, { total: number; count: number }> = {}
  for (const el of MEDDIC_ELEMENTS) pipelineHealth[el] = { total: 0, count: 0 }
  for (const acct of accounts) {
    for (const el of MEDDIC_ELEMENTS) {
      const v = acct.health[el] ?? 0
      pipelineHealth[el].total += v
      pipelineHealth[el].count++
    }
  }
  const avgHealth: Record<string, number> = {}
  for (const el of MEDDIC_ELEMENTS) {
    avgHealth[el] = pipelineHealth[el].count > 0 ? Math.round(pipelineHealth[el].total / pipelineHealth[el].count) : 0
  }

  // Find weakest elements across pipeline
  const weakest = MEDDIC_ELEMENTS.filter(el => avgHealth[el] < 40).sort((a, b) => avgHealth[a] - avgHealth[b])

  // Accounts needing attention (lowest overall health)
  const acctsByHealth = [...accounts].sort((a, b) => {
    const aAvg = MEDDIC_ELEMENTS.reduce((s, el) => s + (a.health[el] || 0), 0) / MEDDIC_ELEMENTS.length
    const bAvg = MEDDIC_ELEMENTS.reduce((s, el) => s + (b.health[el] || 0), 0) / MEDDIC_ELEMENTS.length
    return aAvg - bAvg
  })

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: S.text }}>Manager Dashboard</h1>
      <p style={{ fontSize: 13, color: S.text2, marginBottom: 16 }}>Pipeline health, team performance, and coaching insights</p>

      {/* Pipeline Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: S.accent }}>{accounts.length}</div>
          <div style={{ fontSize: 11, color: S.text3 }}>Active Accounts</div>
        </div>
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: S.green }}>{accounts.reduce((s, a) => s + a.sessions, 0)}</div>
          <div style={{ fontSize: 11, color: S.text3 }}>Total Sessions</div>
        </div>
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: S.purple }}>{users.length}</div>
          <div style={{ fontSize: 11, color: S.text3 }}>Team Members</div>
        </div>
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: weakest.length > 3 ? S.red : S.yellow }}>{weakest.length}</div>
          <div style={{ fontSize: 11, color: S.text3 }}>Weak Elements</div>
        </div>
      </div>

      {/* Pipeline MEDDIC Health */}
      <Card title="📊 Pipeline MEDDIC Health (avg across all accounts)">
        {MEDDIC_ELEMENTS.map(el => <MeterRow key={el} label={el.replace(/([A-Z])/g, ' $1').trim()} value={avgHealth[el]} />)}
      </Card>

      {/* Coaching Recommendations */}
      {weakest.length > 0 && (
        <Card title="🎯 Coaching Recommendations">
          {weakest.map(el => (
            <div key={el} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: `1px solid ${S.surface2}` }}>
              <span style={{ background: 'rgba(239,68,68,.15)', color: S.red, padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600, flexShrink: 0, marginTop: 2 }}>{avgHealth[el]}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: S.text }}>{el.replace(/([A-Z])/g, ' $1').trim()}</div>
                <div style={{ fontSize: 11, color: S.text3, lineHeight: 1.4 }}>{getCoachingRec(el, avgHealth[el])}</div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Accounts Needing Attention */}
      <Card title="⚠️ Accounts Needing Attention">
        {acctsByHealth.slice(0, 5).map(acct => {
          const avg = Math.round(MEDDIC_ELEMENTS.reduce((s, el) => s + (acct.health[el] || 0), 0) / MEDDIC_ELEMENTS.length)
          const weakEls = MEDDIC_ELEMENTS.filter(el => (acct.health[el] || 0) < 30)
          return (
            <div key={acct.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${S.surface2}` }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: avg >= 40 ? 'rgba(34,197,94,.15)' : avg >= 20 ? 'rgba(234,179,8,.15)' : 'rgba(239,68,68,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: avg >= 40 ? S.green : avg >= 20 ? S.yellow : S.red, flexShrink: 0 }}>{avg}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{acct.name}</div>
                <div style={{ fontSize: 11, color: S.text3 }}>{acct.industry} · {acct.sessions} sessions · Last: {acct.lastCall}</div>
                {weakEls.length > 0 && <div style={{ fontSize: 10, color: S.red, marginTop: 2 }}>Gaps: {weakEls.map(el => el.replace(/([A-Z])/g, ' $1').trim()).join(', ')}</div>}
              </div>
            </div>
          )
        })}
        {accounts.length === 0 && <div style={{ fontSize: 12, color: S.text3, padding: 8, textAlign: 'center' }}>No accounts yet.</div>}
      </Card>

      {/* Team Members */}
      {users.length > 0 && (
        <Card title="👥 Team Performance">
          {users.map((u: any) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${S.surface2}` }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: S.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{u.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: S.text }}>{u.name}</div>
                <div style={{ fontSize: 10, color: S.text3 }}>{u.role} · {u._count?.sessions || 0} sessions{u.lastLoginAt ? ` · Last login: ${new Date(u.lastLoginAt).toLocaleDateString()}` : ''}</div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

function getCoachingRec(element: string, score: number): string {
  const recs: Record<string, string> = {
    Goals: 'Reps need to anchor conversations around customer outcomes. Coach them to ask "What does success look like?" early in every call.',
    IdentifyPain: 'Pain is under-explored. Push reps to quantify the cost of the problem — hours, dollars, customer impact. Vague pain = no urgency.',
    Metrics: 'Reps aren\'t getting baseline numbers. Without metrics, there\'s no ROI story. Drill on cost-per-stop, OTD rate, utilization.',
    EconomicBuyer: 'Deals will stall without the economic buyer identified. Coach reps to ask "Who owns the budget?" in the first meeting.',
    Champion: 'No internal champion = no deal momentum. Reps need to find someone who feels the pain personally and will advocate internally.',
    DecisionCriteria: 'Reps don\'t know what the customer is evaluating on. This means demos and proposals are generic. Fix this first.',
    DecisionProcess: 'Timeline and process are unclear. Reps can\'t forecast accurately without knowing the approval chain and timeline.',
    Obstacles: 'Reps aren\'t surfacing blockers early enough. Prior failed attempts and internal resistance need to be uncovered before proposal stage.',
    People: 'Stakeholder mapping is weak. Reps need to identify all influencers, not just their primary contact.',
    Organization: 'Reps don\'t understand the customer\'s org structure well enough to scope the solution correctly.',
    Plans: 'Reps aren\'t connecting to existing initiatives. If routing isn\'t on the customer\'s roadmap, the deal will deprioritize.',
    PlansToOvercomeObstacles: 'Reps need to help customers see a path forward. Phased rollouts and pilots reduce perceived risk.',
  }
  return recs[element] || `Score is ${score}/100 — needs focused coaching.`
}

// ─── Admin Page ───────────────────────────────────────────────────────────────

function AdminPage({ showToast }: { showToast: (m: string) => void }) {
  const elementCounts = getQuestionsByElement()
  const totalCount = getTotalQuestionCount()
  const [usageStats, setUsageStats] = useState<any[]>([])
  const [loadingStats, setLoadingStats] = useState(false)

  const fetchStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const res = await fetch(`${API_BASE}/api/questions/stats`)
      if (res.ok) { const json = await res.json(); setUsageStats(json.stats || []) }
    } catch {}
    setLoadingStats(false)
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  // Top used questions
  const topUsed = usageStats.slice(0, 10)

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: S.text }}>Question Bank</h1>
      <p style={{ fontSize: 13, color: S.text2, marginBottom: 16 }}>Manage discovery questions</p>

      {/* Stats */}
      <Card title="📊 Question Bank Stats">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
          <div style={{ background: S.surface2, borderRadius: 8, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: S.accent }}>{totalCount}</div>
            <div style={{ fontSize: 11, color: S.text3 }}>Total Questions</div>
          </div>
          <div style={{ background: S.surface2, borderRadius: 8, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: S.green }}>{Object.keys(elementCounts).length}</div>
            <div style={{ fontSize: 11, color: S.text3 }}>MEDDIC Elements</div>
          </div>
          <div style={{ background: S.surface2, borderRadius: 8, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: S.purple }}>{usageStats.reduce((sum: number, s: any) => sum + (s.times_asked || 0), 0)}</div>
            <div style={{ fontSize: 11, color: S.text3 }}>Total Uses</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: S.text3, marginBottom: 8 }}>Questions by MEDDIC Element:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Object.entries(elementCounts).sort((a, b) => b[1] - a[1]).map(([el, count]) => (
            <span key={el} style={{ background: S.surface2, borderRadius: 12, padding: '4px 10px', fontSize: 11, color: S.text2 }}>
              {el.replace(/([A-Z])/g, ' $1').trim()}: <strong style={{ color: S.text }}>{count}</strong>
            </span>
          ))}
        </div>
        <div style={{ fontSize: 10, color: S.text3, marginTop: 10 }}>Last updated: April 23, 2026</div>
      </Card>

      {/* Bulk Upload */}
      <Card title="Bulk Upload">
        <p style={{ fontSize: 12, color: S.text3, marginBottom: 8 }}>CSV columns: question_text, meddic_element, buyer_persona, coaching_note, industry_segment</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={() => showToast('File picker would open')} style={{ background: S.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>📁 Choose CSV</button>
          <a href="/data/Question_Upload_Template.xlsx" download style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', color: S.accent, border: `1px solid ${S.accent}`, borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', textDecoration: 'none' }}>⬇ Download Template</a>
        </div>
        <div style={{ background: S.surface2, borderRadius: 8, padding: 10, fontSize: 11, color: S.text3, lineHeight: 1.6 }}>
          <strong style={{ color: S.text2 }}>Template includes:</strong><br />
          • Instructions tab with column descriptions<br />
          • Example questions with coaching notes<br />
          • Dropdown menus for MEDDIC elements, personas, and industry segments<br />
          • Valid values reference sheet
        </div>
      </Card>

      {/* Question Usage Stats */}
      {topUsed.length > 0 && (
        <Card title="📈 Question Usage (from sessions)">
          <div style={{ maxHeight: 250, overflowY: 'auto' }}>
            {topUsed.map((s: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: `1px solid ${S.surface2}` }}>
                <span style={{ background: 'rgba(59,130,246,.15)', color: '#60a5fa', padding: '2px 6px', borderRadius: 8, fontSize: 10, fontWeight: 600, flexShrink: 0 }}>{(s.element || '').substring(0, 4)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: S.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.question_text}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, color: S.green }}>✓{s.times_accepted || 0}</span>
                  <span style={{ fontSize: 10, color: S.text3 }}>⏭{s.times_skipped || 0}</span>
                  <span style={{ fontSize: 10, color: S.accent }}>Q:{Math.round(s.avg_quality_score || 0)}</span>
                </div>
              </div>
            ))}
          </div>
          <button onClick={fetchStats} disabled={loadingStats} style={{ marginTop: 8, background: 'none', color: S.accent, border: `1px solid ${S.border}`, borderRadius: 6, padding: '4px 10px', fontSize: 10, cursor: 'pointer' }}>
            {loadingStats ? '⏳...' : '↻ Refresh Stats'}
          </button>
        </Card>
      )}

      {/* Question Preview */}
      <Card title={`Active Questions (${totalCount})`}>
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {QUESTIONS.slice(0, 15).map((q, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: `1px solid ${S.surface2}` }}>
              <span style={{ background: 'rgba(59,130,246,.15)', color: '#60a5fa', padding: '2px 6px', borderRadius: 8, fontSize: 10, fontWeight: 600, flexShrink: 0, marginTop: 2 }}>{q.element.substring(0, 4)}</span>
              <span style={{ fontSize: 12, color: S.text2 }}>{q.text}</span>
            </div>
          ))}
          {QUESTIONS.length > 15 && <div style={{ fontSize: 11, color: S.text3, padding: '8px 0', textAlign: 'center' }}>... and {totalCount - 15} more questions</div>}
        </div>
      </Card>

      {/* User Management */}
      <UserManagementPanel showToast={showToast} />
    </div>
  )
}

// ─── User Management Panel ────────────────────────────────────────────────────

function UserManagementPanel({ showToast }: { showToast: (m: string) => void }) {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [invEmail, setInvEmail] = useState('')
  const [invName, setInvName] = useState('')
  const [invRole, setInvRole] = useState('Rep')
  const [invResult, setInvResult] = useState<{ tempPassword: string; email: string } | null>(null)

  const token = localStorage.getItem('ptv_token') || ''

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/users`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) { const data = await res.json(); setUsers(data.users || []) }
    } catch {}
    setLoading(false)
  }, [token])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const createUser = async () => {
    if (!invEmail || !invName) { showToast('Email and name required'); return }
    try {
      const res = await fetch(`${API_BASE}/api/auth/users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: invEmail, name: invName, role: invRole }),
      })
      const data = await res.json()
      if (res.ok) {
        setInvResult({ tempPassword: data.tempPassword, email: data.user.email })
        showToast(`✓ User created — temp password generated`)
        fetchUsers()
      } else {
        showToast(data.error || 'Failed to create user')
      }
    } catch { showToast('Cannot reach server') }
  }

  const resetPassword = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/users/${userId}/reset-password`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        showToast(`✓ Password reset — temp: ${data.tempPassword}`)
        navigator.clipboard.writeText(data.tempPassword).catch(() => {})
      }
    } catch { showToast('Failed') }
  }

  const deleteUser = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/users/${userId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) { showToast('✓ User removed'); fetchUsers() }
    } catch { showToast('Failed') }
  }

  return (
    <Card title="👥 User Management">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: S.text3 }}>{users.length} user(s)</div>
        <button onClick={() => { setShowInvite(!showInvite); setInvResult(null) }} style={{ background: S.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>+ Invite User</button>
      </div>

      {showInvite && (
        <div style={{ background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.2)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div><label style={{ fontSize: 10, color: S.text3 }}>Email *</label><input value={invEmail} onChange={e => setInvEmail(e.target.value)} style={{ width: '100%', background: S.surface2, border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 12, color: S.text, outline: 'none', marginTop: 2, boxSizing: 'border-box' }} placeholder="user@ptvlogistics.com" /></div>
            <div><label style={{ fontSize: 10, color: S.text3 }}>Name *</label><input value={invName} onChange={e => setInvName(e.target.value)} style={{ width: '100%', background: S.surface2, border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 12, color: S.text, outline: 'none', marginTop: 2, boxSizing: 'border-box' }} placeholder="First Last" /></div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 10, color: S.text3 }}>Role</label>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              {['Rep', 'Manager', 'Admin'].map(r => (
                <button key={r} onClick={() => setInvRole(r)} style={{ padding: '4px 12px', fontSize: 11, borderRadius: 6, border: `1px solid ${invRole === r ? S.accent : S.border}`, background: invRole === r ? 'rgba(59,130,246,.1)' : 'transparent', color: invRole === r ? S.accent : S.text2, cursor: 'pointer' }}>{r}</button>
              ))}
            </div>
          </div>
          <button onClick={createUser} style={{ background: S.green, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>Create & Generate Temp Password</button>

          {invResult && (
            <div style={{ marginTop: 10, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: S.green, marginBottom: 4 }}>✓ User Created</div>
              <div style={{ fontSize: 11, color: S.text2 }}>Email: {invResult.email}</div>
              <div style={{ fontSize: 11, color: S.text, fontFamily: 'Consolas,monospace', background: S.surface2, padding: '4px 8px', borderRadius: 4, marginTop: 4, display: 'inline-block' }}>Temp Password: {invResult.tempPassword}</div>
              <div style={{ fontSize: 10, color: S.text3, marginTop: 6 }}>Share this password with the user. They'll be asked to change it on first login.</div>
              <button onClick={() => { navigator.clipboard.writeText(`Your PTV Discovery Coach account is ready.\n\nLogin: https://ptvdiscoverycoach.vercel.app\nEmail: ${invResult.email}\nTemp Password: ${invResult.tempPassword}\n\nYou'll be asked to set a new password on first login.`); showToast('✓ Invite text copied') }} style={{ marginTop: 6, background: S.accent, color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 10, cursor: 'pointer' }}>📋 Copy Invite Message</button>
            </div>
          )}
        </div>
      )}

      {/* User list */}
      {loading ? <div style={{ fontSize: 12, color: S.text3, padding: 8 }}>Loading users...</div> : (
        <div>
          {users.map((u: any) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${S.surface2}` }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: S.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{u.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: S.text }}>{u.name}</div>
                <div style={{ fontSize: 10, color: S.text3 }}>{u.email} · {u.role}{u.mustChangePassword ? ' · ⚠ Pending' : ''}{u._count?.sessions ? ` · ${u._count.sessions} sessions` : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button onClick={() => resetPassword(u.id)} style={{ background: 'none', border: `1px solid ${S.border}`, borderRadius: 4, padding: '2px 6px', fontSize: 9, color: S.text3, cursor: 'pointer' }} title="Reset password">🔑</button>
                <button onClick={() => deleteUser(u.id)} style={{ background: 'none', border: `1px solid ${S.border}`, borderRadius: 4, padding: '2px 6px', fontSize: 9, color: S.red, cursor: 'pointer' }} title="Remove user">✕</button>
              </div>
            </div>
          ))}
          {users.length === 0 && <div style={{ fontSize: 12, color: S.text3, padding: 8, textAlign: 'center' }}>No users yet. Create your admin account first via /seed-admin.</div>}
        </div>
      )}
    </Card>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
      {title && <div style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 12 }}>{title}</div>}
      {children}
    </div>
  )
}

function MeterRow({ label, value, delta }: { label: string; value: number; delta?: string }) {
  const color = value >= 60 ? S.green : value >= 30 ? S.accent : S.red
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ width: 110, fontSize: 12, color: S.text2 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: S.surface2, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, value)}%`, background: color, borderRadius: 3, transition: 'width .4s' }} />
      </div>
      <span style={{ width: 24, fontSize: 12, color: value >= 60 ? S.green : S.text3, textAlign: 'right' }}>{value}</span>
      {delta && <span style={{ fontSize: 10, color: S.text3, marginLeft: 4 }}>{delta}</span>}
    </div>
  )
}


// ─── Add Contact Form ─────────────────────────────────────────────────────────

function AddContactForm({ onAdd, onCancel }: { onAdd: (c: Contact) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [dealRole, setDealRole] = useState('Champion')

  return (
    <div style={{ background: S.surface, border: `1px solid rgba(59,130,246,.3)`, borderRadius: 12, padding: 16, marginTop: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: S.text, marginBottom: 10 }}>Add Contact</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div><label style={{ fontSize: 11, color: S.text3 }}>Name *</label><input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', background: S.surface2, border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, color: S.text, outline: 'none', marginTop: 4 }} placeholder="e.g. Sarah Müller" /></div>
        <div><label style={{ fontSize: 11, color: S.text3 }}>Title / Role</label><input value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', background: S.surface2, border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, color: S.text, outline: 'none', marginTop: 4 }} placeholder="e.g. VP Logistics" /></div>
        <div><label style={{ fontSize: 11, color: S.text3 }}>Email</label><input value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', background: S.surface2, border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, color: S.text, outline: 'none', marginTop: 4 }} placeholder="s.muller@acme.de" /></div>
        <div><label style={{ fontSize: 11, color: S.text3 }}>Phone</label><input value={phone} onChange={e => setPhone(e.target.value)} style={{ width: '100%', background: S.surface2, border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, color: S.text, outline: 'none', marginTop: 4 }} placeholder="+49 89 1234 5678" /></div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: S.text3 }}>Deal Role</label>
        <select value={dealRole} onChange={e => setDealRole(e.target.value)} style={{ width: '100%', background: S.surface2, border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, color: S.text, marginTop: 4 }}>
          <option>Economic Buyer</option>
          <option>Champion</option>
          <option>Technical Buyer</option>
          <option>End User</option>
          <option>Decision Influencer</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => { if (name.trim()) onAdd({ id: String(Date.now()), name: name.trim(), title, email, phone, dealRole }) }} style={{ background: S.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>Save Contact</button>
        <button onClick={onCancel} style={{ background: 'none', color: S.text2, border: `1px solid ${S.border}`, borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  )
}

// ─── Contact Row ──────────────────────────────────────────────────────────────

function ContactRow({ contact }: { contact: Contact }) {
  const roleColors: Record<string, string> = {
    'Economic Buyer': S.red,
    'Champion': S.yellow,
    'Technical Buyer': S.accent,
    'End User': S.text3,
    'Decision Influencer': S.purple,
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: `1px solid ${S.surface2}` }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: S.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: S.text, flexShrink: 0 }}>
        {(contact.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: S.text }}>{contact.name}</div>
        <div style={{ fontSize: 11, color: S.text3 }}>{contact.title}{contact.email ? ` · ${contact.email}` : ''}</div>
      </div>
      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, fontWeight: 600, background: `${roleColors[contact.dealRole] || S.text3}20`, color: roleColors[contact.dealRole] || S.text3 }}>
        {contact.dealRole}
      </span>
    </div>
  )
}


// ─── OCR Helper ──────────────────────────────────────────────────────────────

async function ocrFromFile(file: File): Promise<string> {
  // Resize if too large (phone photos can be 5MB+)
  let processedFile = file
  if (file.size > 1024 * 1024) { // > 1MB, resize
    const img = await createImageBitmap(file)
    const maxDim = 1600
    let w = img.width, h = img.height
    if (w > maxDim || h > maxDim) {
      const scale = maxDim / Math.max(w, h)
      w = Math.round(w * scale)
      h = Math.round(h * scale)
    }
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, w, h)
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85))
    processedFile = new File([blob], 'resized.jpg', { type: 'image/jpeg' })
    console.log(`[OCR] Resized from ${(file.size/1024).toFixed(0)}KB to ${(processedFile.size/1024).toFixed(0)}KB (${w}x${h})`)
  }

  // Convert to base64
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(processedFile)
  })

  console.log(`[OCR] Sending ${(base64.length/1024).toFixed(0)}KB base64 to backend...`)

  // Send to backend for AI-powered OCR
  const token = localStorage.getItem('ptv_token') || ''
  const res = await fetch('http://localhost:4000/api/contacts/ocr-image', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ imageBase64: base64, mimeType: processedFile.type }),
  })
  
  const data = await res.json()
  console.log('[OCR] Backend response:', res.status, data)

  if (res.ok && data.text) {
    return data.text
  }

  // If backend failed, show the error
  if (data.detail) console.error('[OCR] OpenAI detail:', data.detail)
  throw new Error(data.error || 'OCR failed')
}

// ─── Camera Scanner Component ────────────────────────────────────────────────

function CameraScanner({ onCapture, onClose }: { onCapture: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [status, setStatus] = useState('Starting camera...')
  const [processing, setProcessing] = useState(false)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start camera on mount
  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        })
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        // Start countdown after a short delay for camera to warm up
        setStatus('Position card inside the frame')
        setTimeout(() => {
          if (!mounted) return
          startCountdown()
        }, 1500)
      } catch {
        setStatus('Camera access denied')
        setTimeout(onClose, 2000)
      }
    }

    function startCountdown() {
      let count = 5
      setCountdown(count)
      setStatus('Hold steady...')
      countdownRef.current = setInterval(() => {
        count--
        if (count > 0) {
          setCountdown(count)
        } else {
          setCountdown(0)
          if (countdownRef.current) clearInterval(countdownRef.current)
          doCapture()
        }
      }, 1000)
    }

    init()

    return () => {
      mounted = false
      if (countdownRef.current) clearInterval(countdownRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [])

  const doCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return
    setProcessing(true)
    setStatus('Processing image...')

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)

    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }

    // Convert to file and OCR
    setStatus('Running OCR — extracting text...')
    try {
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95))
      const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' })
      const text = await ocrFromFile(file)
      onCapture(text)
    } catch {
      onCapture('')
    }
  }

  const handleManualCapture = () => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    setCountdown(null)
    doCapture()
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: '#000', display: 'flex', flexDirection: 'column' }}>
      {/* Video area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

        {/* Guide frame */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{
            width: '80%', maxWidth: 520, aspectRatio: '3.5 / 2',
            border: `3px solid ${countdown !== null && countdown <= 2 ? '#fbbf24' : '#4ade80'}`,
            borderRadius: 12,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
            transition: 'border-color 0.5s',
            position: 'relative',
          }}>
            <div style={{ position: 'absolute', top: -3, left: -3, width: 28, height: 28, borderTop: '4px solid #4ade80', borderLeft: '4px solid #4ade80', borderRadius: '6px 0 0 0' }} />
            <div style={{ position: 'absolute', top: -3, right: -3, width: 28, height: 28, borderTop: '4px solid #4ade80', borderRight: '4px solid #4ade80', borderRadius: '0 6px 0 0' }} />
            <div style={{ position: 'absolute', bottom: -3, left: -3, width: 28, height: 28, borderBottom: '4px solid #4ade80', borderLeft: '4px solid #4ade80', borderRadius: '0 0 0 6px' }} />
            <div style={{ position: 'absolute', bottom: -3, right: -3, width: 28, height: 28, borderBottom: '4px solid #4ade80', borderRight: '4px solid #4ade80', borderRadius: '0 0 6px 0' }} />
          </div>
        </div>

        {/* Countdown overlay */}
        {countdown !== null && countdown > 0 && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: 72, fontWeight: 700, color: '#fff', textShadow: '0 2px 20px rgba(0,0,0,0.8)' }}>
              {countdown}
            </div>
          </div>
        )}

        {/* Status text */}
        <div style={{ position: 'absolute', top: 16, left: 0, right: 0, textAlign: 'center' }}>
          <span style={{ background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500 }}>
            {status}
          </span>
        </div>

        {/* Processing overlay */}
        {processing && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 40, height: 40, border: '4px solid rgba(255,255,255,0.3)', borderTopColor: '#4ade80', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ color: '#fff', fontSize: 14 }}>{status}</span>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div style={{ padding: '16px 24px', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>✕ Cancel</button>
        {!processing && (
          <button onClick={handleManualCapture} style={{ background: '#fff', border: '4px solid #4ade80', borderRadius: '50%', width: 64, height: 64, cursor: 'pointer' }} title="Capture now" />
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ─── Image Analysis Helpers ──────────────────────────────────────────────────

/** Calculate image sharpness via Laplacian variance (higher = sharper) */
function calculateSharpness(imageData: ImageData): number {
  const { data, width, height } = imageData
  let sum = 0
  let count = 0

  // Sample every 4th pixel for performance
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const idx = (y * width + x) * 4
      const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114

      // Laplacian kernel: center pixel vs neighbors
      const top = data[((y - 1) * width + x) * 4] * 0.299 + data[((y - 1) * width + x) * 4 + 1] * 0.587 + data[((y - 1) * width + x) * 4 + 2] * 0.114
      const bot = data[((y + 1) * width + x) * 4] * 0.299 + data[((y + 1) * width + x) * 4 + 1] * 0.587 + data[((y + 1) * width + x) * 4 + 2] * 0.114
      const lft = data[(y * width + x - 1) * 4] * 0.299 + data[(y * width + x - 1) * 4 + 1] * 0.587 + data[(y * width + x - 1) * 4 + 2] * 0.114
      const rgt = data[(y * width + x + 1) * 4] * 0.299 + data[(y * width + x + 1) * 4 + 1] * 0.587 + data[(y * width + x + 1) * 4 + 2] * 0.114

      const laplacian = Math.abs(4 * gray - top - bot - lft - rgt)
      sum += laplacian
      count++
    }
  }

  return count > 0 ? sum / count : 0
}

/** Calculate average brightness (0-255) */
function calculateBrightness(imageData: ImageData): number {
  const { data } = imageData
  let sum = 0
  const pixels = data.length / 4

  // Sample every 8th pixel for speed
  for (let i = 0; i < data.length; i += 32) {
    sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
  }

  return sum / (pixels / 8)
}

// ─── Matrix Scan Overlay ──────────────────────────────────────────────────────

function MatrixScanOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [statusText, setStatusText] = useState('SCANNING...')

  useEffect(() => {
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    const w = c.width, h = c.height, sz = 14
    const cols = Math.floor(w / sz)
    const drops: number[] = Array.from({ length: cols }, () => Math.random() * -8)
    const chars = 'アイウエオカキクケコ0123456789ABCDEF'
    let animId: number

    function draw() {
      ctx!.fillStyle = 'rgba(0,0,0,0.06)'
      ctx!.fillRect(0, 0, w, h)
      ctx!.font = `bold ${sz}px Consolas,monospace`
      for (let i = 0; i < drops.length; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)]
        ctx!.fillStyle = Math.random() > .3 ? 'rgba(0,255,65,1)' : 'rgba(0,255,65,.5)'
        ctx!.fillText(ch, i * sz, drops[i] * sz)
        if (drops[i] * sz > h && Math.random() > .93) drops[i] = 0
        drops[i] += 0.08 + Math.random() * 0.08
      }
      animId = requestAnimationFrame(draw)
    }
    draw()

    const timer = setTimeout(() => setStatusText('EXTRACTING TEXT...'), 1500)
    return () => { cancelAnimationFrame(animId); clearTimeout(timer) }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, zIndex: 200 }}>
      <div style={{ position: 'relative', width: 300, height: 180, background: '#000', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(0,255,65,.3)', boxShadow: '0 0 40px rgba(0,255,65,.15)' }}>
        <canvas ref={canvasRef} width={300} height={180} style={{ display: 'block', width: '100%', height: '100%' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff41', animation: 'pulse 1s infinite' }} />
        <span style={{ fontSize: 13, color: '#00ff41', fontFamily: 'Consolas,monospace', fontWeight: 500 }}>{statusText}</span>
      </div>
    </div>
  )
}


// ─── Recording Bar with Waveform ──────────────────────────────────────────────

function RecordingBar({ onEnd }: { onEnd: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [seconds, setSeconds] = useState(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    // Timer
    const timer = setInterval(() => setSeconds(s => s + 1), 1000)

    // Audio waveform
    let animId: number
    const startAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream
        const audioCtx = new AudioContext()
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 64
        source.connect(analyser)
        analyserRef.current = analyser

        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const bufLen = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufLen)

        function draw() {
          animId = requestAnimationFrame(draw)
          analyser!.getByteFrequencyData(dataArray)
          ctx!.fillStyle = 'rgba(0,0,0,0)'
          ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
          const barW = canvas!.width / bufLen
          for (let i = 0; i < bufLen; i++) {
            const h = (dataArray[i] / 255) * canvas!.height
            const hue = dataArray[i] > 180 ? 0 : 200 // red for loud, blue for quiet
            ctx!.fillStyle = `hsla(${hue}, 80%, 55%, 0.8)`
            ctx!.fillRect(i * barW, canvas!.height - h, barW - 1, h)
          }
        }
        draw()
      } catch {
        // Mic not available — show animated placeholder
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        function fakeDraw() {
          animId = requestAnimationFrame(fakeDraw)
          ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
          const t = Date.now() / 200
          for (let i = 0; i < 20; i++) {
            const h = Math.abs(Math.sin(t + i * 0.5)) * canvas!.height * 0.7 + 4
            ctx!.fillStyle = 'rgba(239,68,68,0.6)'
            ctx!.fillRect(i * 7, (canvas!.height - h) / 2, 5, h)
          }
        }
        fakeDraw()
      }
    }
    startAudio()

    return () => {
      clearInterval(timer)
      cancelAnimationFrame(animId)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 14 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: S.red, animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
      <canvas ref={canvasRef} width={140} height={28} style={{ flex: 1, maxWidth: 140, height: 28, borderRadius: 4 }} />
      <span style={{ fontSize: 13, color: '#fca5a5', fontWeight: 600, fontFamily: 'Consolas,monospace', minWidth: 45 }}>{mm}:{ss}</span>
      <button onClick={onEnd} style={{ background: S.red, color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>End</button>
    </div>
  )
}
