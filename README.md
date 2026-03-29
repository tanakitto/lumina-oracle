# Lumina — AI-Powered Personal Oracle

> More than divination — a tool for self-reflection.

**Live:** [lumina-oracle.com](https://lumina-oracle.com)

---

## What is Lumina?

Lumina is a free web-based oracle application that uses Claude AI (Anthropic) to deliver personalized tarot card readings, 3-card spreads, and Elder Futhark rune readings — based on what the user actually expresses, not generic templates.

The core thesis: **the symbol you draw reflects what you're already thinking.** Lumina reads that symbol alongside your words, acting as a mirror rather than a fortune-teller.

---

## Key Features

- **Personalized readings** — Claude interprets cards based on the user's exact input, not pre-written templates
- **Session memory** — returning users get context-aware readings that reference past themes (stored as abstract summaries, not raw text)
- **Privacy-first storage** — prompts are never stored verbatim; Claude summarizes them into abstract themes (e.g. "relationship uncertainty") before saving
- **3 reading modes** — Single card · 3-Card Spread (Past/Present/Future) · Elder Futhark Runes
- **Multilingual** — Thai / English / Japanese, full UI and AI response translation
- **No account required** — works as guest; email optional for memory features

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS + Tailwind CDN |
| Hosting | Netlify (static + serverless functions) |
| AI Engine | Claude Sonnet (Anthropic API) |
| Database | Airtable (session metadata only) |
| Fonts | Anuphan (Google Fonts) |

---

## Architecture

```
User Browser
     │
     ▼
index.html / session.html        ← This repo (frontend only)
     │
     ▼
Netlify Functions (serverless)   ← Private repo
  ├── reading.js    → Claude API → generates reading
  ├── resonance.js  → Airtable  → saves feedback
  └── history.js    → Airtable  → fetches session themes
     │
     ▼
Airtable (metadata only)
  ├── abstract_theme  (e.g. "relationship uncertainty")
  ├── card_drawn      (e.g. "The Tower (Reversed)")
  ├── resonance_score (user feedback)
  └── session_date
```

**Note:** Backend functions and API keys are in a private repo. This public repo contains frontend files only.

---

## Privacy Design

A key design decision was **not storing raw user input** in the database:

1. User types: *"รู้สึกเคว้งๆ ไม่รู้เพราะอะไร"*
2. Claude generates the reading (never stored)
3. A second lightweight Claude call summarizes the prompt → `"vague existential unease"`
4. Only the abstract theme is saved to Airtable

This preserves the **session memory feature** (users get context-aware returning greetings) while ensuring sensitive emotional content is never stored verbatim.

---

## Prompt Design

The reading system prompt follows this structure:

```
You are Lumina, a personal oracle. Philosophy: clarity over comfort.

[Past session themes if returning user]

Rules:
- Connect the symbol directly to what the user expressed
- [Reversed/upright card note]
- Never say "you should" — use "perhaps..." or "this symbol invites..."
- End with exactly one question
- [Language instruction: TH/EN/JP]

Respond ONLY in JSON: {"reading": "...", "question": "..."}
```

The two-call pattern (reading + summarization) adds ~$0.003 per session but enables memory without privacy trade-offs.

---

## Day 1 Stats (first 12 hours)

- **46 sessions** from organic Twitter/X + social posts
- **6.5% email conversion** (3 registered users)
- **Top themes:** relationship (39%), vague unease (26%), career/change (18%)
- **Reading mode split:** ~50% 3-card spread, ~35% single card, ~15% rune

---

## Running Locally

This is a static frontend — no local server needed for the UI.

```bash
git clone https://github.com/tanakitto/lumina-oracle
cd lumina-oracle
# Open index.html in browser
# Note: AI features require backend (Netlify Functions + API keys)
```

To run with full functionality, deploy to Netlify and set:
```
CLAUDE_API_KEY=your_anthropic_key
AIRTABLE_TOKEN=your_airtable_token
```

---

## What's Next

- [ ] Celtic Cross (10-card spread)
- [ ] I Ching reading mode
- [ ] Omikuji (Japanese fortune style)
- [ ] PWA / Android app via TWA
- [ ] Lumina Plus subscription tier

---

## License

MIT — free to use, fork, and build on.

---

*Built with Claude AI by Anthropic · Hosted on Netlify · lumina-oracle.com*
