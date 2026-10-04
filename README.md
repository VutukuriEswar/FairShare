## What is FairShare?

FairShare is a contribution tracker for student group projects (especially ML/AI) that turns "who did what?" arguments into a transparent, shared evidence report. A team creates a project, links a PUBLIC GitHub repo, and invites teammates by email — the team goes live instantly. Members log their work on the site with evidence links, teammates confirm with one click, and the backend scores GitHub effort by what was changed and how much (not just commit counts). The system is designed for student teams who need a fair record of per-person effort at demo and grading time. This is a website only — there is no browser extension, no background tracking, and no browsing data is ever collected.

## Key Features

👑 **Instant Effort-Weighted Analysis**
- Paste any PUBLIC GitHub URL and get a royal leaderboard in seconds with zero signup: effort %, commit %, donut chart, and 100% stacked team-split bar.
- Effort scoring weighs lines changed × file importance (core `.py`/`.ipynb` at 1.0, docs `.md` at 0.25, config at 0.4, data at 0.8) × content boosts for model/training signals — a README-only commit can never tie a full feature build.
- Toggle between True Effort and raw Commit Count to expose count-gaming, with per-card code-vs-docs bars, lines added/removed, and top files.

🤝 **Teams Live Instantly**
- Teams are active the moment they are created — no pending state, no waiting, no "Start Anyway".
- Enter-to-add teammate chips, live public-repo validation via the GitHub API, and HTML+text invite emails with an Accept button.
- Single-use hashed invite tokens with 7-day expiry; SMTP console fallback returns copy-paste links when mail is unconfigured.

📝 **Immutable Peer-Confirmed Logs**
- Two-minute log wizard with link verification across every platform (Colab, Kaggle, Hugging Face, arXiv, Figma, Notion, Trello) — verified-inside links multiply credit ×1.2–2.0, mismatches score ×0.5 and get flagged.
- Preview-before-submit with predicted points; any 1 teammate confirm makes a log count. No edit and no delete anywhere — permanence is the anti-spam mechanism.
- Weekly private review → Share flow with 48-hour auto-share; pending logs count zero so the report stays symmetric.

📊 **Rich Team Report**
- Per-person evidence cards with Code/Docs/Review/Research/Consistency radar charts, confidence badges, cross-check flags, and crunch detection (>70% of work in the final 48h).
- ML stage fingerprinting (Data/Model/Training/Evaluation/Docs), experiment ledger with metric deltas, hyperparameter trail, activity timeline, and a "Not Detectable" panel naming what the system cannot see.
- Identity merge maps multiple git author names to one teammate; printable/exportable layout where everyone sees the same numbers.

🎭 **Demo Mode**
- One-click demo seed builds a finished CIFAR-10 team (3 members, confirmed logs, GitHub snapshot, metrics) with zero setup.

## Tech Stack

**Backend:**
- **FastAPI** (Python async web framework, single-file `server.py`)
- **SQLite** (local file via `sqlite3` + WAL mode — no MongoDB, data stays with whoever hosts)
- **Pydantic v2** & **email-validator** for validated request models and auth flows
- **bcrypt** for password hashing and **PyJWT** for app tokens
- **httpx** for GitHub API access (ETag caching, rate-limit handling, noreply/bot/merge/lockfile filtering) and link-content verification
- **python-dotenv**-style env loading plus **smtplib** for invite emails
- **uvicorn** as the ASGI server

**Frontend:**
- **React 18** for UI components and routing
- **React Router v6** for client-side navigation (16 pages including Analyze, Report, TeamDetail, MyActivity)
- **Framer Motion** for staggered leaderboard entrances, animated share bars, and loading states
- **Vanilla CSS** with CSS custom properties for the full royal-neon design system (dark/light themes, glassmorphism, glow)
- **Hand-drawn SVG charts** (contribution donut, 100% stacked bar, skill radar, timelines — zero chart dependencies)

## Quick Start Guide

### Prerequisites
- Python 3.10+
- Node.js 18+ & npm
- No MongoDB needed — SQLite file lives at `backend/data/fairshare.db`

### Installation Steps

1. **Clone the repository**
```bash
git clone https://github.com/your-username/FairShare.git
cd FairShare
```

2. **Set up Python virtual environment**
```bash
cd backend
py -m venv venv
venv\Scripts\activate   # On Linux/macOS: source venv/bin/activate
```

3. **Install backend dependencies**
```bash
pip install -r requirements.txt
```

4. **Configure environment**

Copy `.env.example` to `.env` and fill in your values:
```bash
copy .env.example .env
```
```env
JWT_SECRET=change-me-to-a-long-random-secret
FRONTEND_URL=http://localhost:3000
GITHUB_TOKEN=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
SMTP_HOST=
```

5. **Run the backend server**
```bash
py server.py
```

Or with uvicorn from inside `backend/`:
```bash
uvicorn server:app --reload
```

The API will be available at `http://localhost:8000/api/health`.

6. **Install frontend dependencies & start**

Open a new terminal:
```bash
cd frontend
npm install
npm start
```

The app will be available at `http://localhost:3000` (set `REACT_APP_API_URL=http://localhost:8000/api` if needed).

7. **Try the demo**

Click **Load demo** on the landing page (calls `POST /api/demo/seed`) for a finished team report in seconds.

## API Endpoints

**Auth & Users:**
- `POST /auth/register` — Register (sends 6-digit email code), returns `pendingVerification`
- `POST /auth/verify` — Verify email with code; returns JWT
- `POST /auth/resend-code` — Resend verification code (cooldown-enforced)
- `POST /auth/login` — Login (gated until email verified)
- `GET /users/me` — Current profile including GitHub link state
- `DELETE /users/me` — Delete account and wipe all user data
- `PATCH /users/me/github` — Link GitHub via profile URL (existence-verified)
- `DELETE /users/me/github` — Unlink GitHub
- `GET /auth/github/login` — Start GitHub OAuth (or manual-link fallback)
- `GET /auth/github/callback` — OAuth callback (upgrades link to verified)

**Teams & Invites:**
- `POST /teams` — Create team (validates repo is PUBLIC via GitHub API, active immediately)
- `GET /teams` — List my teams with acceptance counts
- `GET /teams/{id}` — Team detail with members
- `POST /teams/{id}/invites/resend` — Resend pending invites (creator only)
- `DELETE /teams/{id}/invites/{id}` — Revoke an invite (creator only)
- `GET /invites/{token}` — Public invite preview (no auth)
- `POST /invites/{token}/accept` — Accept invite (auto-verifies email)
- `POST /invites/{token}/decline` — Decline invite

**Activity:**
- `GET /me/records` — My records with optional `team_id` filter
- `DELETE /me/records/{rid}` — Always 410: check the preview before logging
- `GET /me/summaries` — Weekly summaries with grace window
- `POST /me/summaries/{week}/share` — Share a week

**Logs & Confirmation:**
- `POST /logs/preview` — Preview with link verification, multiplier, and predicted points
- `POST /logs` — Submit permanent pending log
- `GET /teams/{id}/inbox` — Teammates' pending logs awaiting review
- `POST /logs/{id}/confirm` — Confirm a teammate's log (self-confirm rejected)
- `POST /logs/{id}/flag` — Flag with context (still visible, scores low)

**Analysis & Reports:**
- `POST /analyze` — Instant effort-weighted repo analysis (public, rate-limited)
- `POST /teams/{id}/github/refresh` — Refresh GitHub snapshot
- `GET /teams/{id}/report` — Full symmetric team report
- `GET /teams/{id}/identities` — List git-author → teammate mappings
- `PUT /teams/{id}/identities` — Map git author names to teammates

**Demo & Health:**
- `POST /demo/seed` — Seed the CIFAR-10 demo team
- `GET /health` — API liveness check

## Pipeline Architecture

```
GitHub Repo URL (must be PUBLIC)
    │
    ▼
Repo Validation (GitHub API)
    │  ─ rejects private/missing repos
    │  ─ ETag cache + rate-limit handling
    ▼
Evidence Fetch (last 100 commits + PRs + issues)
    │  ─ per-commit detail: additions/deletions per file
    │  ─ bot/merge/lockfile/vendor filtering + noreply resolution
    ▼
Effort Scoring (WHAT × HOW MUCH)
    │  ─ file weight: code 1.0, data 0.8, config 0.4, docs 0.25
    │  ─ content boost: model/training signals ×1.2, typo-only ×0.3
    │  ─ per-file cap 2000 lines, additions + deletions both count
    │  ─ stage fingerprinting + metric/HP extraction
    ▼
Team Formation (invite → accept, active instantly)
    │  ─ members log work on the site with evidence links
    │  ─ weekly review → share (48h auto-share)
    ▼
Peer-Confirmed Logs (link-verified multipliers ×1.2–2.0)
    │  ─ any-1-teammate confirm counts; permanent, no edit/delete
    ▼
Symmetric Report (same for everyone)
       ─ effort shares + radar charts + timeline + ledger + flags
```

## Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `DATA_DIR` | `./data` | Folder for the SQLite file |
| `SQLITE_PATH` | `./data/fairshare.db` | SQLite database path |
| `JWT_SECRET` | `dev-secret-change-me` | Secret for signing JWTs (change in production) |
| `JWT_EXPIRE_MINUTES` | `10080` | App token lifetime in minutes |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `FRONTEND_URL` | `http://localhost:3000` | Public frontend URL used in invite links |
| `PORT` | `8000` | Backend server port |
| `SMTP_HOST` | *(empty)* | SMTP host; empty enables console fallback + link return |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | *(empty)* | SMTP username |
| `SMTP_PASSWORD` | *(empty)* | SMTP password |
| `SMTP_FROM` | `FairShare <noreply@fairshare.local>` | Sender address for invite emails |
| `SMTP_USE_TLS` | `true` | Use STARTTLS for SMTP |
| `GITHUB_TOKEN` | *(empty)* | Personal access token (raises GitHub rate limit) |
| `GITHUB_CLIENT_ID` | *(empty)* | GitHub OAuth app ID (enables Continue with GitHub) |
| `GITHUB_CLIENT_SECRET` | *(empty)* | GitHub OAuth app secret |
| `GITHUB_OAUTH_REDIRECT` | `http://localhost:3000/auth/callback` | Must match OAuth app callback + frontend route |
| `GRACE_HOURS_AUTOSHARE` | `48` | Hours before a weekly summary auto-shares |

## Known Behaviours & Edge Cases

- **Effort Is a Proxy, Not a Grade:** Line counts measure volume × file importance, not quality — a 10-line bugfix can matter more than a 500-line dump. The report is evidence for a fair conversation, never a single verdict.
- **Stale Instant Cache:** The Analyze page caches results in `sessionStorage`; after backend scoring changes, use the Re-analyze button to fetch fresh effort fields instead of commit-only shares.
- **100-Commit Window:** Only the last 100 commits are analyzed per refresh, so very large histories are a recent-work snapshot rather than full history.
- **Binary Diffs:** Files without fetchable patches (images, weights, renames) get small fixed credit at ×0.5 since the work is real but unverifiable.
- **Unlogged Work Is Neutral:** Members with no confirmed logs simply show 0 minutes — never slacking — and offline work (calls, whiteboards, local runs) is explicitly listed as Not Detectable.
- **Immutable Everything:** Logs, confirmations, and weekly shares cannot be edited or deleted; a wrong log can only be flagged with context by a teammate.

## License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

© 2026 Eswar Vutukuri

## Acknowledgements

Thanks to the open-source ML community (PyTorch, Hugging Face, Kaggle, Colab, arXiv, Stack Overflow) whose docs, datasets, and papers make evidence-based contribution tracking possible. Thanks to [FastAPI](https://fastapi.tiangolo.com/), [React](https://react.dev/), and [Framer Motion](https://www.framer.com/motion/) for the modern full-stack foundations.