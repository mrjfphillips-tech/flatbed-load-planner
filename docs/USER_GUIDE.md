# PTV Discovery Intelligence Platform — User Guide (V1)

## What This Is

An AI-powered coaching platform that helps you conduct transportation consulting-quality discovery conversations. It listens to your meetings, understands what's being discussed, and suggests the next great question to ask.

**You are not using software. You have a senior transportation consultant sitting beside you.**

---

## Quick Start

1. Open the app (double-click **PTV Discovery Coach** on your desktop, or go to http://localhost:3000)
2. Log in with your credentials
3. Select or create an account
4. Click **Live Session** to begin coaching

---

## Before the Meeting (30 seconds)

When you click into an account, you'll see a **Pre-Session Briefing** with:
- What you already know about this customer
- What's still unknown (knowledge gaps)
- Suggested opening questions
- Last session's summary and action items

**Read this in the 30 seconds before your meeting starts.** You'll walk in prepared without doing any manual research.

---

## During the Meeting

### The Screen Layout

**Left side — Transcript**
Shows what's being said in real time. You don't need to look at this during the conversation — it's there for reference.

**Right side — Question Suggestions**
2-3 questions appear here. Each has:
- The question itself (large text, easy to glance at)
- "Why it matters" (one line explaining the value)
- A ⭐ Recommended badge on the top pick

**Top bar — Status**
- 🔴 Recording indicator (pulsing = active)
- Timer showing session duration
- Current PDIF phase (Discover/Diagnose/Design/Demonstrate/Deliver)
- Overall confidence percentage

### How to Use It

1. **Start talking normally.** The platform listens in the background.
2. **Glance at suggestions** when there's a natural pause in conversation.
3. **Tap a question** when you've asked it. This tells the platform to refresh.
4. **Don't look at the screen while the customer is talking.** The suggestions will be there when you need them.

### Tips
- Suggestions refresh automatically every 10 seconds after speech
- The platform gets smarter the more you talk — early suggestions may be generic, but they improve as it learns about the customer
- You don't have to use the suggested questions. They're prompts, not requirements.
- The ⭐ Recommended question targets the biggest knowledge gap

---

## After the Meeting

When you click **End Session**, the platform generates:
- **Summary** — Key discoveries from this session
- **Action Items** — What needs to happen next
- **Follow-Up Email** — Draft email you can customize and send
- **CRM Update** — Fields ready to push to Salesforce

This replaces the 30 minutes you'd normally spend on post-meeting admin.

---

## The 5 PDIF Phases

The platform tracks which phase your discovery is in:

| Phase | Focus | You're here when... |
|-------|-------|---------------------|
| 🔍 **Discover** | Understanding their business | First meeting, early conversations |
| 🔬 **Diagnose** | Identifying operational problems | You know the business, now finding pain |
| ✏️ **Design** | Mapping to outcomes | Pain is clear, now discussing what "fixed" looks like |
| 🎯 **Demonstrate** | Preparing demo/proof | Ready to show a solution |
| 🚀 **Deliver** | Getting to decision | Business case made, working toward close |

The platform automatically detects your phase and adjusts questions accordingly. You can manually change it if you disagree.

---

## Confidence Scores

Five meters show how well you understand the customer:
1. **Company & Operations** — Do you get how their business runs?
2. **Fleet & Network** — Do you know their vehicles, routes, geography?
3. **Technology & Data** — Do you know their current systems?
4. **Financial Drivers** — Do you know their costs and budget pressures?
5. **Buying Process** — Do you know who decides and how?

Scores only increase when the customer provides real information — not just when you ask a question.

---

## Known Limitations (V1)

- **Transcription uses your browser's speech recognition.** It works best in Chrome with clear audio. If accuracy is poor, speak more clearly toward the microphone.
- **AI suggestions take ~10 seconds to refresh.** They won't update instantly after every sentence.
- **Speaker identification is basic.** The system can't always tell who's speaking.
- **CRM export is manual in V1.** The system generates the data; you paste it into Salesforce.
- **Works best with one customer conversation at a time.** Don't switch tabs mid-session.

---

## Giving Feedback

See the **Feedback** button in the session view. Use it to:
- Report bugs ("something broke")
- Request features ("I wish it could...")
- Share praise ("this question was perfect")
- Note issues ("the suggestion didn't make sense here")

Every piece of feedback helps make V2 better.

---

## Getting Help

Contact your administrator or submit feedback through the app. Include:
- What you were doing
- What happened
- What you expected to happen
