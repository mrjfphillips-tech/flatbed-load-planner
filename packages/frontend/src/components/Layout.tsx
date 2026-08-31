/**
 * Responsive layout shell for PTV Discovery Coach.
 * Supports viewports from 375px (mobile) to 1920px (desktop).
 * Provides consistent header, sidebar navigation, and content area.
 */
import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAppStore } from '../store';

const NAV_ITEMS = [
  { path: '/', label: 'Accounts', icon: '\u{1F4CB}' },
  { path: '/session', label: 'Live Session', icon: '\u{1F399}' },
  { path: '/manager', label: 'Manager', icon: '\u{1F4C8}' },
  { path: '/admin', label: 'Admin', icon: '\u2699\uFE0F' },
];

export function Layout(): React.ReactElement {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const location = useLocation();
  const isOnline = useAppStore((s) => s.isOnline);
  const discreetMode = useAppStore((s) => s.discreetMode);

  return (
    <div className="layout-shell">
      {!isOnline && (
        <div className="offline-banner" role="alert">
          <span>Offline Mode - coaching continues with limited features</span>
        </div>
      )}

      <header className="layout-header">
        <button
          className="menu-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle navigation"
        >
          &#9776;
        </button>
        <div className="header-brand">
          <span className="brand-badge">PTV</span>
          <span className="brand-title">Discovery Coach</span>
        </div>
        {discreetMode && <span className="discreet-indicator">Discreet</span>}
      </header>

      <div className="layout-body">
        {sidebarOpen && (
          <div
            className="sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <nav
          className={`layout-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}
          aria-label="Main navigation"
        >
          <div className="sidebar-brand">
            <span className="brand-badge">PTV</span>
            <div>
              <div className="brand-title">Discovery Coach</div>
              <div className="brand-subtitle">PTV Logistics</div>
            </div>
          </div>
          <ul className="nav-list">
            {NAV_ITEMS.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`nav-item ${location.pathname === item.path ? 'nav-item-active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main className="layout-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
