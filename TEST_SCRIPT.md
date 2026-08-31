# PTV Discovery Coach — Smoke Test Script

**URL:** http://localhost:3000  
**Login:** `rep@ptv.com` / `demo123`  
**Admin:** `admin@ptv.com` / `admin123`

---

## 1. Login

| # | Step | Expected Result | Pass? |
|---|------|-----------------|-------|
| 1.1 | Open http://localhost:3000 | Login screen appears with PTV branding | ☐ |
| 1.2 | Enter wrong password, click Login | Error message: "Invalid email or password" | ☐ |
| 1.3 | Enter `rep@ptv.com` / `demo123`, click Login | Redirects to main app (Accounts home screen) | ☐ |

---

## 2. Accounts

| # | Step | Expected Result | Pass? |
|---|------|-----------------|-------|
| 2.1 | Look at the Accounts home screen | List of accounts (may be empty on first run) | ☐ |
| 2.2 | Click "+ New Account" | New account form appears (name, industry selector) | ☐ |
| 2.3 | Enter "Acme Logistics" as name, select an industry, submit | Account created, appears in the list | ☐ |
| 2.4 | Click into the new account | Account overview page loads | ☐ |

---

## 3. Live Discovery Session

| # | Step | Expected Result | Pass? |
|---|------|-----------------|-------|
| 3.1 | From the account, click "Start Session" or "Live Session" | Session controller opens with MEDDIC dashboard | ☐ |
| 3.2 | Check the MEDDIC dashboard | 12 elements visible, all starting at 0% or low | ☐ |
| 3.3 | See question suggestions | At least one suggested question appears | ☐ |
| 3.4 | Click "Accept" on a suggested question | Question is marked as asked, new suggestion appears | ☐ |
| 3.5 | Click "Skip" on a question | Question is replaced with another | ☐ |
| 3.6 | End the session | Session saves, summary appears or returns to account | ☐ |

---

## 4. ROI Calculator

| # | Step | Expected Result | Pass? |
|---|------|-----------------|-------|
| 4.1 | Navigate to ROI Calculator (from account or nav) | ROI calculator loads with value streams | ☐ |
| 4.2 | Enter some numbers in the inputs | Calculated savings/ROI updates in real-time | ☐ |
| 4.3 | Toggle miles/km or currency if available | Units change appropriately | ☐ |

---

## 5. Contacts & Business Card Scanner

| # | Step | Expected Result | Pass? |
|---|------|-----------------|-------|
| 5.1 | Navigate to Contacts for the account | Contact list (may be empty) | ☐ |
| 5.2 | Click "Add Contact" | Form appears with name, title, email, phone | ☐ |
| 5.3 | Fill in a contact and save | Contact appears in the list | ☐ |
| 5.4 | Open Business Card Scanner | Camera/upload interface appears | ☐ |
| 5.5 | Upload a test image (any image) | OCR attempts to extract text | ☐ |

---

## 6. Question Bank

| # | Step | Expected Result | Pass? |
|---|------|-----------------|-------|
| 6.1 | Navigate to Question Bank (admin or settings) | List of discovery questions appears | ☐ |
| 6.2 | Browse questions by MEDDIC element | Questions are grouped/filterable by element | ☐ |
| 6.3 | Star/prefer a question | Question is marked as preferred | ☐ |

---

## 7. Leexi Integration

| # | Step | Expected Result | Pass? |
|---|------|-----------------|-------|
| 7.1 | Navigate to Leexi import | Shows "Leexi integration not configured" or call list | ☐ |
| 7.2 | (If configured) See available calls | List of recent Leexi calls appears | ☐ |

---

## 8. Discreet Mode

| # | Step | Expected Result | Pass? |
|---|------|-----------------|-------|
| 8.1 | Find the discreet mode toggle | Toggle button visible (usually in session view) | ☐ |
| 8.2 | Activate discreet mode | UI collapses to minimal/hidden state | ☐ |
| 8.3 | Deactivate discreet mode | Full UI returns | ☐ |

---

## 9. Export

| # | Step | Expected Result | Pass? |
|---|------|-----------------|-------|
| 9.1 | After a session, look for export options | Export panel with Salesforce, M365, email options | ☐ |
| 9.2 | Click SMS/Email export | Share dialog or mailto link opens | ☐ |

---

## 10. Admin Features (login as admin@ptv.com / admin123)

| # | Step | Expected Result | Pass? |
|---|------|-----------------|-------|
| 10.1 | Log out, then log in as admin | Admin UI loads (may have extra nav items) | ☐ |
| 10.2 | Navigate to User Management | List of users appears (rep, admin) | ☐ |
| 10.3 | Invite a new user | Form for email/name/role, generates temp password | ☐ |
| 10.4 | View question usage stats | Stats/analytics about question usage | ☐ |

---

## 11. Offline Recovery

| # | Step | Expected Result | Pass? |
|---|------|-----------------|-------|
| 11.1 | Navigate to Offline Recovery | Upload interface for audio files | ☐ |
| 11.2 | Upload a test audio file (or see the interface) | Shows upload progress or "queued" status | ☐ |

---

## 12. Logout

| # | Step | Expected Result | Pass? |
|---|------|-----------------|-------|
| 12.1 | Find the logout button | Visible in nav/header | ☐ |
| 12.2 | Click Logout | Returns to login screen | ☐ |
| 12.3 | Try to access http://localhost:3000 | Redirects to login (not auto-logged-in) | ☐ |

---

## Notes / Issues Found

| Test # | Issue Description | Severity |
|--------|-------------------|----------|
| | | |
| | | |
| | | |

---

## Summary

- **Total tests:** 38
- **Passed:** __ / 38
- **Failed:** __
- **Blocked:** __

**Tester:** _______________  
**Date:** _______________
