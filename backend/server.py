import asyncio
import hashlib
import json
import os
import re
import secrets
import smtplib
import sqlite3
import threading
import time
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any, Dict, List, Optional

import bcrypt
import httpx
import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field, field_validator

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default)

JWT_SECRET = _env("JWT_SECRET", "dev-secret-change-me")
JWT_EXPIRE_MINUTES = int(_env("JWT_EXPIRE_MINUTES", "10080") or "10080")
CORS_ORIGINS = [o.strip() for o in _env("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
FRONTEND_URL = _env("FRONTEND_URL", "http://localhost:3000")
PORT = int(_env("PORT", "8000") or "8000")
SMTP_HOST = _env("SMTP_HOST", "")
SMTP_PORT = int(_env("SMTP_PORT", "587") or "587")
SMTP_USER = _env("SMTP_USER", "")
SMTP_PASSWORD = _env("SMTP_PASSWORD", "")
SMTP_FROM = _env("SMTP_FROM", "FairShare <noreply@fairshare.local>")
SMTP_USE_TLS = _env("SMTP_USE_TLS", "true").lower() in ("1", "true", "yes")
GITHUB_TOKEN = _env("GITHUB_TOKEN", "")
GITHUB_CLIENT_ID = _env("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = _env("GITHUB_CLIENT_SECRET", "")
GITHUB_OAUTH_REDIRECT = _env("GITHUB_OAUTH_REDIRECT", "http://localhost:3000/auth/callback")
_oauth_states: Dict[str, Dict[str, Any]] = {}
GRACE_HOURS_AUTOSHARE = int(_env("GRACE_HOURS_AUTOSHARE", "48") or "48")
DATA_DIR = _env("DATA_DIR", str(Path(__file__).parent / "data"))
SQLITE_PATH = _env("SQLITE_PATH", str(Path(DATA_DIR) / "fairshare.db"))

os.makedirs(DATA_DIR, exist_ok=True)

_lock = threading.Lock()
_conn: Optional[sqlite3.Connection] = None

def db() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = sqlite3.connect(SQLITE_PATH, check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.execute("PRAGMA journal_mode=WAL;")
        _conn.execute("PRAGMA foreign_keys=ON;")
    return _conn

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
  name TEXT NOT NULL, github_login TEXT, github_verified INTEGER DEFAULT 0,
  email_verified INTEGER DEFAULT 0,
  created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS email_codes(
  email TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at TEXT NOT NULL,
  attempts INTEGER DEFAULT 0, last_sent_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS teams(
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '',
  repo_url TEXT NOT NULL, repo_owner TEXT NOT NULL, repo_name TEXT NOT NULL,
  deadline TEXT, creator_id TEXT NOT NULL, status TEXT DEFAULT 'pending',
  keyword_profile TEXT DEFAULT '[]', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS memberships(
  id TEXT PRIMARY KEY, team_id TEXT NOT NULL, user_id TEXT,
  email TEXT NOT NULL, status TEXT DEFAULT 'invited',
  invite_token_hash TEXT, invite_expires_at TEXT, accepted_at TEXT,
  extension_connected INTEGER DEFAULT 0, github_login TEXT,
  UNIQUE(team_id, email));
CREATE INDEX IF NOT EXISTS idx_mem_team ON memberships(team_id);
CREATE INDEX IF NOT EXISTS idx_mem_user ON memberships(user_id);
CREATE TABLE IF NOT EXISTS activity_records(
  id TEXT PRIMARY KEY, team_id TEXT NOT NULL, user_id TEXT NOT NULL,
  local_id TEXT NOT NULL, topic TEXT NOT NULL, category TEXT DEFAULT 'other',
  minutes REAL NOT NULL, relevance REAL DEFAULT 0.5, confidence REAL DEFAULT 0.5,
  keyword_pred INTEGER DEFAULT 1, embed_pred INTEGER DEFAULT 1,
  started_at TEXT NOT NULL, ended_at TEXT NOT NULL, status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL, week_start TEXT NOT NULL,
  link_url TEXT DEFAULT '', link_domain TEXT DEFAULT '', link_title TEXT DEFAULT '',
  link_signals TEXT DEFAULT '{}', link_verified INTEGER DEFAULT 0, multiplier REAL DEFAULT 1.0,
  immutable INTEGER DEFAULT 1,
  UNIQUE(team_id, user_id, local_id));
CREATE TABLE IF NOT EXISTS confirmations(
  id TEXT PRIMARY KEY, record_id TEXT NOT NULL, team_id TEXT NOT NULL,
  confirmer_id TEXT NOT NULL, decision TEXT NOT NULL, note TEXT DEFAULT '',
  created_at TEXT NOT NULL, UNIQUE(record_id, confirmer_id));
CREATE TABLE IF NOT EXISTS analyses(
  id TEXT PRIMARY KEY, owner TEXT NOT NULL, repo TEXT NOT NULL, sha TEXT DEFAULT '',
  result TEXT DEFAULT '{}', fetched_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_rec_teamuser ON activity_records(team_id, user_id);
CREATE TABLE IF NOT EXISTS github_snapshots(
  id TEXT PRIMARY KEY, team_id TEXT NOT NULL, fetched_at TEXT NOT NULL,
  etag TEXT DEFAULT '', data TEXT DEFAULT '{}');
CREATE TABLE IF NOT EXISTS weekly_summaries(
  id TEXT PRIMARY KEY, team_id TEXT NOT NULL, user_id TEXT NOT NULL,
  week_start TEXT NOT NULL, status TEXT DEFAULT 'pending_review',
  review_deadline TEXT NOT NULL, UNIQUE(team_id, user_id, week_start));
CREATE TABLE IF NOT EXISTS identity_links(
  id TEXT PRIMARY KEY, team_id TEXT NOT NULL, git_author_name TEXT NOT NULL,
  git_email TEXT DEFAULT '', user_id TEXT,
  UNIQUE(team_id, git_author_name, git_email));
CREATE TABLE IF NOT EXISTS labels(
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, team_id TEXT NOT NULL,
  record_local_id TEXT NOT NULL, label TEXT NOT NULL,
  UNIQUE(user_id, team_id, record_local_id));
"""

def init_db():
    c = db()
    with _lock:
        c.executescript(SCHEMA)
        c.commit()
        try:
            ucols = [r[1] for r in c.execute("PRAGMA table_info(users)").fetchall()]
            if "email_verified" not in ucols:
                c.execute("ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0")
            c.execute("UPDATE users SET email_verified=1 WHERE email_verified IS NULL OR email_verified=0")
            c.commit()
        except Exception:
            pass
        try:
            cols = [r[1] for r in c.execute("PRAGMA table_info(activity_records)").fetchall()]
            for col, ddl in [
                ("link_url", "ALTER TABLE activity_records ADD COLUMN link_url TEXT DEFAULT ''"),
                ("link_domain", "ALTER TABLE activity_records ADD COLUMN link_domain TEXT DEFAULT ''"),
                ("link_title", "ALTER TABLE activity_records ADD COLUMN link_title TEXT DEFAULT ''"),
                ("link_signals", "ALTER TABLE activity_records ADD COLUMN link_signals TEXT DEFAULT '{}'"),
                ("link_verified", "ALTER TABLE activity_records ADD COLUMN link_verified INTEGER DEFAULT 0"),
                ("multiplier", "ALTER TABLE activity_records ADD COLUMN multiplier REAL DEFAULT 1.0"),
                ("immutable", "ALTER TABLE activity_records ADD COLUMN immutable INTEGER DEFAULT 1"),
            ]:
                if col not in cols:
                    c.execute(ddl)
            c.commit()
        except Exception:
            pass

try:
    init_db()
except Exception:
    pass

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def uid(prefix: str = "id") -> str:
    return f"{prefix}_{secrets.token_hex(8)}"

def q_all(sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    with _lock:
        cur = db().execute(sql, params)
        return [dict(r) for r in cur.fetchall()]

def q_one(sql: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
    rows = q_all(sql, params)
    return rows[0] if rows else None

def q_exec(sql: str, params: tuple = ()):
    with _lock:
        db().execute(sql, params)
        db().commit()

def week_start_of(dt: datetime) -> str:
    d = dt.astimezone(timezone.utc).date()
    monday = d - timedelta(days=d.weekday())
    return monday.isoformat()

def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def check_pw(pw: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), h.encode())
    except Exception:
        return False

def make_jwt(user_id: str, minutes: int = JWT_EXPIRE_MINUTES, scope: str = "app") -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    return jwt.encode({"sub": user_id, "exp": exp, "scope": scope}, JWT_SECRET, algorithm="HS256")

def decode_jwt(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired. Please log in again.")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token. Please log in again.")

def current_user(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    payload = decode_jwt(authorization[7:])
    u = q_one("SELECT * FROM users WHERE id=?", (payload.get("sub"),))
    if not u:
        raise HTTPException(status_code=401, detail="Account not found.")
    return u

def optional_user(authorization: Optional[str] = Header(default=None)) -> Optional[Dict[str, Any]]:
    try:
        if not authorization or not authorization.startswith("Bearer "):
            return None
        payload = decode_jwt(authorization[7:])
        return q_one("SELECT * FROM users WHERE id=?", (payload.get("sub"),))
    except Exception:
        return None

_hits: Dict[str, List[float]] = {}
def rate_limit(max_calls: int, window_s: int):
    async def dep(request: Request):
        key = f"{request.client.host if request.client else 'x'}:{request.url.path}"
        t = time.time()
        arr = _hits.get(key, [])
        arr = [x for x in arr if t - x < window_s]
        if len(arr) >= max_calls:
            raise HTTPException(status_code=429, detail="Too many requests. Please slow down and try again.")
        arr.append(t)
        _hits[key] = arr
    return dep

def send_invite_email(to_email: str, team_name: str, inviter: str, accept_link: str) -> Optional[str]:
    subject = f"You are invited to {team_name} on FairShare"
    text = (
        f"Hi,\n\n{inviter} invited you to join '{team_name}' on FairShare.\n\n"
        f"Step 1: Accept the invite: {accept_link}\n"
        f"Step 2: Log work with optional evidence links (any platform) — teammates confirm, logs are permanent.\n\n"
        f"Logs are immutable: check the preview before submitting. No edit, no delete.\n"
        f"Privacy: {FRONTEND_URL}/privacy\n\n— FairShare: Proof of effort, without the arguments."
    )
    html = (
        f"<h2>You are invited to {team_name}</h2><p>{inviter} invited you to join on FairShare.</p>"
        f"<p><a href='{accept_link}' style='padding:10px 16px;background:#00B894;color:#fff;border-radius:8px;text-decoration:none'>Accept the invite</a></p>"
        f"<p><em>Logs are permanent after preview — no edit, no delete. Any 1 teammate confirm counts.</em></p>"
        f"<p><a href='{FRONTEND_URL}/privacy'>Privacy policy</a></p>"
    )
    if not SMTP_HOST:
        _safe_print(f"\n===== FAIRSHARE EMAIL (SMTP not configured) =====\nTo: {to_email}\nSubject: {subject}\n\n{text}\nAccept link: {accept_link}\n==================================================\n")
        return accept_link
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = to_email
        msg.attach(MIMEText(text, "plain"))
        msg.attach(MIMEText(html, "html"))
        s = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15)
        if SMTP_USE_TLS:
            s.starttls()
        if SMTP_USER:
            s.login(SMTP_USER, SMTP_PASSWORD)
        s.sendmail(SMTP_FROM, [to_email], msg.as_string())
        s.quit()
        return None
    except Exception as e:
        _safe_print(f"[email] SMTP failed ({e}); falling back to console link: {accept_link}")
        return accept_link

CODE_TTL_MIN = 10
CODE_RESEND_S = 60
CODE_MAX_ATTEMPTS = 5

def _safe_print(s: str):
    try:
        print(s, flush=True)
    except UnicodeEncodeError:
        print(s.encode("ascii", "backslashreplace").decode(), flush=True)

def _send_email_text(to_email: str, subject: str, text: str, html: str) -> bool:
    if not SMTP_HOST:
        _safe_print(f"\n===== FAIRSHARE EMAIL (SMTP not configured) =====\nTo: {to_email}\nSubject: {subject}\n\n{text}\n==================================================\n")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = to_email
        msg.attach(MIMEText(text, "plain"))
        msg.attach(MIMEText(html, "html"))
        s = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15)
        if SMTP_USE_TLS:
            s.starttls()
        if SMTP_USER:
            s.login(SMTP_USER, SMTP_PASSWORD)
        s.sendmail(SMTP_FROM, [to_email], msg.as_string())
        s.quit()
        return True
    except Exception as e:
        _safe_print(f"[email] SMTP failed ({e}); console fallback for {to_email}")
        return False

def issue_email_code(email: str) -> tuple[str, bool]:
    email = email.lower().strip()
    ex = q_one("SELECT * FROM email_codes WHERE email=?", (email,))
    if ex and ex["last_sent_at"]:
        try:
            if (datetime.now(timezone.utc) - datetime.fromisoformat(ex["last_sent_at"])).total_seconds() < CODE_RESEND_S:
                raise HTTPException(status_code=429, detail=f"Code just sent — wait {CODE_RESEND_S}s before resending. 📨")
        except HTTPException:
            raise
        except Exception:
            pass
    code = f"{secrets.randbelow(900000) + 100000}"
    ch = hashlib.sha256(code.encode()).hexdigest()
    exp = (datetime.now(timezone.utc) + timedelta(minutes=CODE_TTL_MIN)).isoformat()
    q_exec("INSERT OR REPLACE INTO email_codes(email,code_hash,expires_at,attempts,last_sent_at) VALUES(?,?,?,?,?)",
           (email, ch, exp, 0, now_iso()))
    subject = f"Your FairShare verification code: {code}"
    text = f"Hi,\n\nYour FairShare verification code is: {code}\nIt expires in {CODE_TTL_MIN} minutes.\n\n— FairShare 🎓"
    html = f"<h2>🎓 FairShare verification</h2><p style='font-size:28px;font-weight:800;letter-spacing:4px'>{code}</p><p>Expires in {CODE_TTL_MIN} minutes.</p>"
    sent = _send_email_text(email, subject, text, html)
    if not sent:
        _safe_print(f"[verify] DEV CODE for {email}: {code} (SMTP not configured)")
    return code, sent

_gh_etags: Dict[str, str] = {}
async def gh_get(path: str, params: Dict[str, Any] | None = None) -> tuple[Any, dict]:
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "FairShare/1.0"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    if path in _gh_etags and _gh_etags[path]:
        headers["If-None-Match"] = _gh_etags[path]
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get(f"https://api.github.com{path}", headers=headers, params=params)
        if r.status_code == 304:
            return None, dict(r.headers)
        if r.status_code == 403 and "rate limit" in r.text.lower():
            reset = r.headers.get("X-RateLimit-Reset", "")
            raise HTTPException(status_code=502, detail=f"GitHub rate limit reached. Try again later (resets {reset}). Add GITHUB_TOKEN to raise the limit.")
        if r.status_code == 404:
            raise HTTPException(status_code=400, detail="GitHub repo not found. Check owner/name.")
        if r.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"GitHub API error {r.status_code}.")
        if r.headers.get("ETag"):
            _gh_etags[path] = r.headers["ETag"]
        return r.json(), dict(r.headers)

def parse_repo_url(url: str) -> tuple[str, str]:
    m = re.match(r"^\s*https?://github\.com/([A-Za-z0-9_.\-]+)/([A-Za-z0-9_.\-]+?)(?:\.git)?/?\s*$", url or "")
    if not m:
        raise HTTPException(status_code=400, detail="Repo URL must look like https://github.com/owner/repo.")
    return m.group(1), m.group(2)

def noreply_login(email: str) -> Optional[str]:
    m = re.match(r"^\d+\+([A-Za-z0-9_\-]+)@users\.noreply\.github\.com$", (email or "").strip())
    return m.group(1) if m else None

BOT_RE = re.compile(r"(\[bot\]|dependabot|renovate|github-actions)", re.I)
IGNORE_PATH_RE = re.compile(r"(node_modules|vendor|dist/|build/|lock|\.lock$|package-lock|yarn\.lock|\.min\.js)", re.I)

STAGE_PATTERNS = {
    "Data": [r"read_csv", r"load_dataset", r"train_test_split", r"fillna", r"augment", r"ImageFolder", r"DataLoader", r"dataset", r"imread"],
    "Model": [r"nn\.Module", r"Sequential", r"from transformers", r"pretrained", r"resnet|efficientnet|bert|gpt", r"torch\.nn", r"keras.*Model"],
    "Training": [r"\.fit\(", r"loss\.backward", r"optimizer", r"scheduler", r"for epoch", r"train_step", r"model\.fit"],
    "Evaluation": [r"accuracy_score", r"confusion_matrix", r"classification_report", r"Grad-?CAM|LIME|SHAP", r"f1_score", r"roc_auc"],
    "Docs": [r"^README", r"^docs/", r"\.md$"],
}
METRIC_RE = re.compile(r"(loss|accuracy|acc|f1|precision|recall|auc)\s*[:=]\s*([0-9]*\.?[0-9]+)", re.I)
HP_RE = re.compile(r"(lr|learning_rate|epochs|batch_size|optimizer|dropout|weight_decay)\s*[:=]\s*([A-Za-z0-9_.\-]+)", re.I)

def classify_stages(text: str) -> List[str]:
    out = []
    for stage, pats in STAGE_PATTERNS.items():
        for p in pats:
            if re.search(p, text or "", re.I):
                out.append(stage)
                break
    return out or ["Other"]

def extract_metrics(text: str) -> Dict[str, float]:
    d: Dict[str, float] = {}
    for k, v in METRIC_RE.findall(text or ""):
        try:
            d[k.lower()] = float(v)
        except Exception:
            pass
    return d

def extract_hps(text: str) -> Dict[str, str]:
    return {k: v for k, v in HP_RE.findall(text or "")}

def is_ignored_commit(msg: str, files: List[str]) -> bool:
    if msg and msg.strip().lower().startswith("merge "):
        return True
    if files and all(IGNORE_PATH_RE.search(f or "") for f in files):
        return True
    return False

PER_FILE_CHURN_CAP = 2000
CODE_EXT = {"py", "ipynb", "js", "ts", "tsx", "jsx", "java", "cpp", "c", "h", "rs", "go"}
DOCS_EXT = {"md", "rst", "txt"}
CONFIG_NAMES = ("dockerfile", "docker-compose", ".yaml", ".yml", "requirements", "pyproject.toml", "setup.py", "makefile")
MEANINGFUL_SIG_RE = re.compile(r"(nn\.Module|\.fit\(|loss\.backward|optimizer|DataLoader|read_csv|load_dataset|accuracy_score|f1_score|torch\.nn|from transformers|for epoch|train_step|confusion_matrix|resnet|efficientnet|bert|gpt)", re.I)
TRIVIAL_MSG_RE = re.compile(r"^(typo|fix typo|update readme|minor|wip)\b", re.I)

def file_category(filename: str) -> str:
    fn = (filename or "").lower()
    if IGNORE_PATH_RE.search(filename or ""):
        return "junk"
    if fn.endswith(".md") or fn.endswith(".rst") or fn.endswith(".txt") or fn.startswith("readme") or fn.startswith("docs/"):
        return "docs"
    ext = fn.rsplit(".", 1)[-1] if "." in fn else ""
    if ext in CODE_EXT:
        return "code"
    if ext in ("csv", "parquet", "jsonl", "db", "sqlite") or fn.startswith("data/") or "dataset" in fn:
        return "data"
    if any(k in fn for k in CONFIG_NAMES):
        return "config"
    return "other"

FILE_WEIGHT = {"code": 1.0, "data": 0.8, "config": 0.4, "docs": 0.25, "other": 0.5, "junk": 0.0}

def score_file_impact(filename: str, patch: str | None, additions: int, deletions: int, msg: str = "") -> tuple[float, int, str]:
    cat = file_category(filename)
    if cat == "junk":
        return 0.0, 0, cat
    churn = max(0, int(additions or 0) + int(deletions or 0))
    if churn == 0:
        churn = 4 if cat == "code" else (2 if cat == "docs" else 3)
    capped = min(churn, PER_FILE_CHURN_CAP)
    w = FILE_WEIGHT.get(cat, 0.5)
    mult = 1.0
    blob = (patch or "")[:4000]
    if blob:
        if MEANINGFUL_SIG_RE.search(blob) or MEANINGFUL_SIG_RE.search(msg or ""):
            mult = 1.2
        else:
            code_lines = [l for l in blob.splitlines() if l.startswith(("+", "-")) and l[1:].strip() and not l[1:].strip().startswith(("#", "//", "<!--"))]
            if len(code_lines) <= 2 or (TRIVIAL_MSG_RE.search((msg or "").strip().lower()) and cat == "docs"):
                mult = 0.3
    else:
        mult = 0.5
    return round(capped * w * mult, 1), capped, cat

async def fetch_repo_evidence(owner: str, repo: str) -> Dict[str, Any]:
    try:
        repo_json, _ = await gh_get(f"/repos/{owner}/{repo}")
    except HTTPException as e:
        raise e
    if repo_json.get("private"):
        raise HTTPException(status_code=400, detail="Repo must be PUBLIC. Make it public or pick another repo.")
    commits, _ = await gh_get(f"/repos/{owner}/{repo}/commits", {"per_page": 100})
    pulls, _ = await gh_get(f"/repos/{owner}/{repo}/pulls", {"state": "all", "per_page": 50})
    issues, _ = await gh_get(f"/repos/{owner}/{repo}/issues", {"state": "all", "per_page": 50})
    authors: Dict[str, Dict[str, Any]] = {}
    def person(login: str):
        if login not in authors:
            authors[login] = {"login": login, "commits": 0, "active_days": set(), "files": [], "prs": 0, "reviews": 0, "issues": 0, "stages": {},
                              "metrics": [], "hps": [], "effort": 0.0, "code_churn": 0, "docs_churn": 0,
                              "lines_added": 0, "lines_removed": 0, "code_files": 0, "docs_files": 0, "top_files": {}}
        return authors[login]
    for c in (commits or []):
        login = ((c.get("author") or {}).get("login")) or (c.get("commit", {}).get("author") or {}).get("name") or "unknown"
        email = (c.get("commit", {}).get("author") or {}).get("email") or ""
        nl = noreply_login(email)
        if nl:
            login = nl
        if BOT_RE.search(login or ""):
            continue
        msg = (c.get("commit") or {}).get("message", "")
        sha = c.get("sha", "")
        files: List[str] = []
        text_blob = msg
        _file_impacts: List[tuple] = []
        try:
            det, _ = await gh_get(f"/repos/{owner}/{repo}/commits/{sha}")
            files = [f.get("filename", "") for f in (det or {}).get("files", [])]
            for f in (det or {}).get("files", []):
                text_blob += "\n" + (f.get("patch") or "")[:4000]
                try:
                    _eff, _churn, _cat = score_file_impact(f.get("filename", ""), f.get("patch"), int(f.get("additions", 0) or 0), int(f.get("deletions", 0) or 0), msg)
                except Exception:
                    _eff, _churn, _cat = 0.0, 0, "other"
                _file_impacts.append((f.get("filename", ""), _eff, _churn, _cat, int(f.get("additions", 0) or 0), int(f.get("deletions", 0) or 0)))
                if (f.get("filename") or "").endswith(".ipynb"):
                    try:
                        raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{sha}/{f.get('filename','')}"
                        async with httpx.AsyncClient(timeout=15) as hc:
                            rr = await hc.get(raw_url)
                            if rr.status_code == 200:
                                nb = json.loads(rr.text)
                                for cell in nb.get("cells", [])[:40]:
                                    src = "".join(cell.get("source", []))
                                    for outp in cell.get("outputs", [])[:10]:
                                        t = outp.get("text") or outp.get("data", {}).get("text/plain") or []
                                        s = "".join(t) if isinstance(t, list) else str(t)
                                        s = re.sub(r'"data:image/[^"]+"', '""', s)
                                        text_blob += "\n" + s[:2000]
                                    text_blob += "\n" + src[:3000]
                    except Exception:
                        pass
        except Exception:
            pass
        if is_ignored_commit(msg, files):
            continue
        p = person(login)
        p["commits"] += 1
        day = ((c.get("commit", {}).get("author") or {}).get("date") or "")[:10]
        if day:
            p["active_days"].add(day)
        p["files"].extend([f for f in files if not IGNORE_PATH_RE.search(f)])
        for _fn, _eff, _churn, _cat, _add, _del in _file_impacts:
            p["effort"] = round(p.get("effort", 0.0) + _eff, 1)
            p["lines_added"] = p.get("lines_added", 0) + _add
            p["lines_removed"] = p.get("lines_removed", 0) + _del
            if _cat == "docs":
                p["docs_churn"] = p.get("docs_churn", 0) + _churn
                p["docs_files"] = p.get("docs_files", 0) + 1
            elif _cat == "junk":
                pass
            else:
                p["code_churn"] = p.get("code_churn", 0) + _churn
                if _cat == "code":
                    p["code_files"] = p.get("code_files", 0) + 1
            if _fn and _eff > 0:
                tf = p.setdefault("top_files", {})
                tf[_fn] = round(tf.get(_fn, 0.0) + _eff, 1)
        for st in classify_stages(text_blob):
            p["stages"][st] = p["stages"].get(st, 0) + 1
        m = extract_metrics(text_blob)
        h = extract_hps(text_blob)
        if m:
            prev = p["metrics"][-1]["values"] if p["metrics"] else {}
            delta = {k: round(v - prev.get(k, v), 4) for k, v in m.items()}
            p["metrics"].append({"sha": sha[:7], "values": m, "delta": delta, "date": day})
        if h:
            p["hps"].append({"sha": sha[:7], "changes": h, "date": day})
    for pr in (pulls or []):
        login = ((pr.get("user") or {}).get("login")) or "unknown"
        if BOT_RE.search(login):
            continue
        person(login)["prs"] += 1
    for iss in (issues or []):
        if "pull_request" in (iss or {}):
            continue
        login = ((iss.get("user") or {}).get("login")) or "unknown"
        if BOT_RE.search(login):
            continue
        person(login)["issues"] += 1
    for v in authors.values():
        v["active_days"] = sorted(v["active_days"])
        v["files_touched"] = len(set(v["files"]))
        v["file_types"] = sorted(set((f.split(".")[-1] if "." in f else "nofile") for f in set(v["files"])))[:12]
        tf = v.get("top_files", {}) or {}
        v["top_files"] = sorted([{"file": k, "effort": val} for k, val in tf.items()], key=lambda x: -x["effort"])[:5]
        v["effort"] = round(float(v.get("effort", 0.0)), 1)
        del v["files"]
    return {"repo": {"owner": owner, "name": repo, "stars": (repo_json or {}).get("stargazers_count", 0), "description": (repo_json or {}).get("description", "") or ""}, "authors": authors}

SCORING_WEIGHTS = {
    "commit": 10.0, "pr": 15.0, "review": 8.0, "issue": 4.0,
    "file_touched": 0.5, "active_day": 3.0, "stage_covered": 6.0,
    "metric_improvement": 12.0, "docs_file": 5.0,
    "research_per_min": 0.35, "research_cap_day": 24.0, "research_cap_topic": 12.0,
    "review_coord_per_pr": 4.0,
    "log_base_per_min": 0.5, "log_cap_day": 30.0, "log_cap_item": 15.0,
    "mult_verified_inside": 2.0, "mult_verified_generic": 1.5, "mult_unverified": 1.0, "mult_mismatch": 0.5,
}
import math
def score_person(gh: Dict[str, Any], minutes_by_day_topic: Dict[str, Dict[str, float]], shared_minutes: float, confirmed_logs: List[Dict[str, Any]] | None = None) -> Dict[str, float]:
    code = gh.get("commits", 0) * SCORING_WEIGHTS["commit"] + gh.get("prs", 0) * SCORING_WEIGHTS["pr"] + gh.get("files_touched", 0) * SCORING_WEIGHTS["file_touched"] + len(gh.get("active_days", [])) * SCORING_WEIGHTS["active_day"]
    docs = sum(1 for t in gh.get("file_types", []) if t in ("md", "rst", "txt")) * SCORING_WEIGHTS["docs_file"] + gh.get("stages", {}).get("Docs", 0) * 2.0
    review = gh.get("prs", 0) * SCORING_WEIGHTS["review_coord_per_pr"] + gh.get("issues", 0) * 2.0
    research = 0.0
    for _day, topics in (minutes_by_day_topic or {}).items():
        day_total = 0.0
        for _t, mins in topics.items():
            capped = min(mins, SCORING_WEIGHTS["research_cap_topic"])
            research += math.log1p(capped) * 4.0 * SCORING_WEIGHTS["research_per_min"] * 4.0
            day_total += capped
        research += min(day_total, SCORING_WEIGHTS["research_cap_day"]) * 0.05
    log_pts = 0.0
    for r in (confirmed_logs or []):
        mins = min(float(r.get("minutes", 0) or 0), SCORING_WEIGHTS["log_cap_item"])
        mult = float(r.get("multiplier", 1.0) or 1.0)
        log_pts += math.log1p(mins) * 5.0 * SCORING_WEIGHTS["log_base_per_min"] * mult
    research += log_pts
    consistency_days = len(minutes_by_day_topic or {}) + len(gh.get("active_days", []))
    consistency = min(consistency_days, 14) * 2.0
    if gh.get("metrics"):
        last = gh["metrics"][-1]
        for k, v in (last.get("delta") or {}).items():
            if ("acc" in k or "f1" in k) and v > 0:
                code += v * 100 * 0.5 + SCORING_WEIGHTS["metric_improvement"] * 0.3
    total = code + docs + review + research + consistency
    return {"Code": round(code, 1), "Docs": round(docs, 1), "Review": round(review, 1), "Research": round(research, 1), "Consistency": round(consistency, 1), "total": round(total, 1)}

NOT_DETECTABLE = [
    "Dataset searching on another device", "Offline reading and notes",
    "Calls and whiteboard sessions", "Local runs that were never pushed",
    "Discarded experiments", "Presenting and demo prep",
]

app = FastAPI(title="FairShare API")
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS + ["http://localhost:3000"], allow_origin_regex=r"https?://.*", allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class RegisterIn(BaseModel):
    email: EmailStr; password: str = Field(min_length=6); name: str = Field(min_length=1, max_length=80)
class LoginIn(BaseModel):
    email: EmailStr; password: str
class VerifyIn(BaseModel):
    email: EmailStr; code: str = Field(min_length=4, max_length=12)
class ResendIn(BaseModel):
    email: EmailStr
class TeamIn(BaseModel):
    name: str = Field(min_length=2, max_length=120); description: str = Field(default="", max_length=2000)
    repo_url: str; deadline: Optional[str] = None; member_emails: List[EmailStr] = Field(default_factory=list)
    @field_validator("member_emails")
    @classmethod
    def dedupe(cls, v):
        seen, out = set(), []
        for e in v:
            el = str(e).lower()
            if el not in seen:
                seen.add(el); out.append(e)
        if len(out) > 20:
            raise ValueError("Max 20 teammates.")
        return out
class LogIn(BaseModel):
    team_id: str; topic: str = Field(min_length=3, max_length=140); category: str = "other"
    minutes: float = Field(gt=0, le=960); link_url: str = Field(default="", max_length=2000)
    notes: str = Field(default="", max_length=2000); started_at: Optional[str] = None
class ConfirmIn(BaseModel):
    decision: str = "confirm"; note: str = Field(default="", max_length=500)
class GithubPatch(BaseModel):
    github_login: Optional[str] = None
    github_url: Optional[str] = None

def parse_github_profile_link(link: str) -> str:
    s = (link or "").strip()
    if not s:
        return ""
    if re.match(r"^[A-Za-z0-9_\-]+$", s.lstrip("@")) and "/" not in s and "." not in s:
        return s.lstrip("@")
    m = re.match(r"^\s*https?://(?:www\.)?github\.com/([A-Za-z0-9_\-]+)(?:[/?#].*)?\s*$", s, re.I)
    if not m:
        raise HTTPException(status_code=400, detail="Paste a GitHub profile link like https://github.com/octocat 🔗")
    return m.group(1)

LINK_FAMILIES = {
    "training": ["colab.research.google", "kaggle.com/code", "kaggle.com/notebooks", "huggingface.co/spaces", "paperspace", "sagemaker", "wandb.ai", "mlflow"],
    "dataset": ["kaggle.com/datasets", "huggingface.co/datasets", "openml.org", "data.world", "zenodo.org", "archive.ics.uci", "dataset"],
    "paper": ["arxiv.org", "paperswithcode", "aclanthology", "doi.org", "neurips", "openreview", "medium.com", "towardsdatascience", "coursera.org", "edx.org", "udacity", "youtube.com", "youtu.be"],
    "docs": ["readthedocs", "github.com", "stackoverflow.com", "dev.to", "docs.python.org", "pytorch.org/docs"],
    "design": ["figma.com", "excalidraw", "miro.com", "mural", "canva.com", "streamlit", "gradio", "huggingface.co/spaces"],
    "coordination": ["notion.so", "docs.google", "trello.com", "atlassian", "linear.app", "discord.com", "slack.com", "gist.github"],
}
CATEGORY_TO_FAMILY = {"training": "training", "dataset": "dataset", "paper": "paper", "docs": "docs", "tutorial": "paper", "debugging": "docs", "other": "docs"}
CODE_SIGNALS = [r"\.fit\(", r"epoch", r"optimizer", r"loss\.backward", r"DataLoader", r"read_csv", r"load_dataset", r"accuracy_score", r"f1_score", r"nn\.Module", r"transformers", r"train_test_split"]

async def verify_link(url: str, claimed_category: str = "other", claimed_topic: str = "") -> Dict[str, Any]:
    url = (url or "").strip()
    if not url:
        return {"verified": False, "domain": "", "title": "", "family": CATEGORY_TO_FAMILY.get(claimed_category, "docs"),
                "signals": {}, "multiplier": 1.0, "note": "No link — base self-claim, capped."}
    if not re.match(r"^https?://", url):
        return {"verified": False, "domain": "", "title": "", "family": "docs", "signals": {}, "multiplier": 1.0, "note": "Link must start with http(s). Logged as unverified."}
    try:
        domain = re.sub(r"^www\.", "", (httpx.URL(url).host or "").lower())
    except Exception:
        domain = ""
    family = "docs"
    for fam, doms in LINK_FAMILIES.items():
        if any(d in domain or d in url.lower() for d in doms):
            family = fam
            break
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers={"User-Agent": "FairShare/1.0"}) as c:
            r = await c.get(url)
            if r.status_code >= 400:
                return {"verified": False, "domain": domain, "title": "", "family": family, "signals": {}, "multiplier": 0.5, "note": f"Link returned {r.status_code} — flagged as unreachable, scores low."}
            text = r.text[:60000]
            m = re.search(r"<title[^>]*>(.*?)</title>", text, re.I | re.S)
            title = re.sub(r"\s+", " ", (m.group(1) if m else "")).strip()[:140]
            code_hits = sorted({p for p in CODE_SIGNALS if re.search(p, text, re.I)})[:8]
            blob = (title + " " + text[:8000]).lower()
            topic_words = [w for w in re.findall(r"[a-z]{3,}", (claimed_topic or "").lower()) if len(w) > 3][:6]
            overlap = sum(1 for w in topic_words if w in blob)
            signals = {"code_hits": code_hits, "topic_overlap": overlap, "bytes": len(text)}
            if code_hits or overlap >= 2 or title:
                mult = 2.0 if (code_hits and overlap >= 1) else (1.5 if (code_hits or overlap >= 2 or title) else 1.2)
                return {"verified": True, "domain": domain, "title": title or domain, "family": family, "signals": signals, "multiplier": mult, "note": f"Verified inside {domain}: {len(code_hits)} code signals, {overlap} topic matches."}
            return {"verified": True, "domain": domain, "title": title or domain, "family": family, "signals": signals, "multiplier": 1.2, "note": "Link reachable, generic content match."}
    except Exception as e:
        return {"verified": False, "domain": domain, "title": "", "family": family, "signals": {}, "multiplier": 0.5, "note": f"Could not fetch link ({str(e)[:80]}) — flagged, scores low."}

def team_or_404(tid: str) -> Dict[str, Any]:
    t = q_one("SELECT * FROM teams WHERE id=?", (tid,))
    if not t:
        raise HTTPException(status_code=404, detail="Team not found.")
    return t

def must_be_member(team_id: str, user: Dict[str, Any]) -> Dict[str, Any]:
    m = q_one("SELECT * FROM memberships WHERE team_id=? AND user_id=?", (team_id, user["id"]))
    if not m:
        t = team_or_404(team_id)
        if t["creator_id"] == user["id"]:
            return {"team_id": team_id, "user_id": user["id"], "email": user["email"], "status": "accepted"}
        raise HTTPException(status_code=403, detail="Only team members can view this.")
    if m["status"] != "accepted":
        raise HTTPException(status_code=403, detail="Invite not accepted yet.")
    return m

def ensure_weekly(team_id: str, user_id: str):
    ws = week_start_of(datetime.now(timezone.utc))
    ex = q_one("SELECT * FROM weekly_summaries WHERE team_id=? AND user_id=? AND week_start=?", (team_id, user_id, ws))
    if not ex:
        dl = (datetime.now(timezone.utc) + timedelta(hours=GRACE_HOURS_AUTOSHARE)).isoformat()
        q_exec("INSERT INTO weekly_summaries(id,team_id,user_id,week_start,status,review_deadline) VALUES(?,?,?,?,?,?)",
               (uid("ws"), team_id, user_id, ws, "pending_review", dl))

@app.get("/api/health")
async def health():
    return {"ok": True, "time": now_iso()}

@app.post("/api/auth/register", dependencies=[Depends(rate_limit(20, 300))])
async def register(body: RegisterIn):
    email = body.email.lower()
    ex = q_one("SELECT * FROM users WHERE email=?", (email,))
    if ex and ex.get("email_verified"):
        raise HTTPException(status_code=400, detail="Email already registered. Try logging in. 🔑")
    if ex and not ex.get("email_verified"):
        q_exec("UPDATE users SET password_hash=?, name=? WHERE id=?", (hash_pw(body.password), body.name, ex["id"]))
        code, sent = issue_email_code(email)
        out: Dict[str, Any] = {"pendingVerification": True, "email": email, "message": "✉️ Code sent! Enter the 6-digit code to verify."}
        if not sent:
            out["devCode"] = code
        return out
    u = {"id": uid("u"), "email": email, "password_hash": hash_pw(body.password), "name": body.name, "created_at": now_iso()}
    q_exec("INSERT INTO users(id,email,password_hash,name,email_verified,created_at) VALUES(?,?,?,?,?,?)",
           (u["id"], u["email"], u["password_hash"], u["name"], 0, u["created_at"]))
    code, sent = issue_email_code(email)
    out = {"pendingVerification": True, "email": email, "message": "✉️ Code sent! Enter the 6-digit code to verify."}
    if not sent:
        out["devCode"] = code
    return out

@app.post("/api/auth/verify", dependencies=[Depends(rate_limit(20, 300))])
async def verify_email(body: VerifyIn):
    email = str(body.email).lower().strip()
    row = q_one("SELECT * FROM email_codes WHERE email=?", (email,))
    if not row:
        raise HTTPException(status_code=400, detail="No code found — press Resend. 📨")
    if row["expires_at"] and row["expires_at"] < now_iso():
        raise HTTPException(status_code=410, detail="Code expired — press Resend for a fresh one. ⏰")
    if int(row["attempts"] or 0) >= CODE_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many wrong tries — press Resend for a fresh code. 🔒")
    if hashlib.sha256(re.sub(r"\D", "", body.code).encode()).hexdigest() != row["code_hash"]:
        q_exec("UPDATE email_codes SET attempts=attempts+1 WHERE email=?", (email,))
        left = CODE_MAX_ATTEMPTS - int(row["attempts"] or 0) - 1
        raise HTTPException(status_code=400, detail=f"Wrong code — {max(left,0)} tries left. 🔍")
    u = q_one("SELECT * FROM users WHERE email=?", (email,))
    if not u:
        raise HTTPException(status_code=404, detail="Account not found — register first. ✏️")
    q_exec("UPDATE users SET email_verified=1 WHERE id=?", (u["id"],))
    q_exec("DELETE FROM email_codes WHERE email=?", (email,))
    for m in q_all("SELECT * FROM memberships WHERE email=? AND user_id IS NULL", (email,)):
        q_exec("UPDATE memberships SET user_id=? WHERE id=?", (u["id"], m["id"]))
    u = q_one("SELECT * FROM users WHERE id=?", (u["id"],))
    return {"token": make_jwt(u["id"]), "user": {"id": u["id"], "email": u["email"], "name": u["name"], "email_verified": True, "github_login": u["github_login"]}}

@app.post("/api/auth/resend-code", dependencies=[Depends(rate_limit(10, 300))])
async def resend_code(body: ResendIn):
    email = str(body.email).lower().strip()
    u = q_one("SELECT * FROM users WHERE email=?", (email,))
    if not u:
        raise HTTPException(status_code=404, detail="Account not found — register first. ✏️")
    if u.get("email_verified"):
        raise HTTPException(status_code=400, detail="Already verified — just log in. 🔑")
    code, sent = issue_email_code(email)
    out: Dict[str, Any] = {"ok": True, "message": "📨 Fresh code sent!"}
    if not sent:
        out["devCode"] = code
    return out

@app.post("/api/auth/login", dependencies=[Depends(rate_limit(20, 300))])
async def login(body: LoginIn):
    u = q_one("SELECT * FROM users WHERE email=?", (body.email.lower(),))
    if not u or not check_pw(body.password, u["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not u.get("email_verified"):
        try:
            code, sent = issue_email_code(u["email"])
            out: Dict[str, Any] = {"verify_required": True, "email": u["email"], "message": "✉️ Verify your email first — fresh code sent!"}
            if not sent:
                out["devCode"] = code
        except HTTPException:
            out = {"verify_required": True, "email": u["email"], "message": "✉️ Verify your email first — check your inbox for the code! 📨"}
        raise HTTPException(status_code=403, detail=out)
    return {"token": make_jwt(u["id"]), "user": {"id": u["id"], "email": u["email"], "name": u["name"], "github_login": u["github_login"]}}

@app.get("/api/users/me")
async def me(user: Dict[str, Any] = Depends(current_user)):
    gh_extra: Dict[str, Any] = {}
    if user["github_login"]:
        gh_extra = {"github_url": f"https://github.com/{user['github_login']}"}
    return {"id": user["id"], "email": user["email"], "name": user["name"], "email_verified": bool(user.get("email_verified", 1)),
            "github_login": user["github_login"], "github_verified": bool(user["github_verified"]), **gh_extra}

@app.delete("/api/users/me")
async def delete_me(user: Dict[str, Any] = Depends(current_user)):
    for tbl in ("labels", "activity_records", "weekly_summaries"):
        q_exec(f"DELETE FROM {tbl} WHERE user_id=?", (user["id"],))
    q_exec("UPDATE memberships SET user_id=NULL, status='declined' WHERE user_id=?", (user["id"],))
    q_exec("DELETE FROM users WHERE id=?", (user["id"],))
    return {"ok": True, "deleted": True}

@app.patch("/api/users/me/github")
async def link_github(body: GithubPatch, user: Dict[str, Any] = Depends(current_user)):
    raw = (body.github_url or body.github_login or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Paste your GitHub profile link, e.g. https://github.com/octocat 🔗")
    login_v = parse_github_profile_link(raw)
    try:
        prof, _ = await gh_get(f"/users/{login_v}")
        if not prof or not prof.get("login"):
            raise HTTPException(status_code=400, detail=f"No GitHub profile @{login_v} found — check the link. 🔍")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=502, detail="Could not reach GitHub — try again. 🌐")
    q_exec("UPDATE users SET github_login=?, github_verified=0 WHERE id=?", (prof.get("login", login_v), user["id"]))
    q_exec("UPDATE memberships SET github_login=? WHERE user_id=?", (prof.get("login", login_v), user["id"]))
    return {"ok": True, "github_login": prof.get("login", login_v), "github_url": f"https://github.com/{prof.get('login', login_v)}",
            "avatar_url": prof.get("avatar_url", ""), "public_repos": prof.get("public_repos", 0),
            "verified": False, "message": "🔗 Linked! Use 🐙 Verify with GitHub for the ✅ verified badge."}

@app.delete("/api/users/me/github")
async def unlink_github(user: Dict[str, Any] = Depends(current_user)):
    q_exec("UPDATE users SET github_login=NULL, github_verified=0 WHERE id=?", (user["id"],))
    return {"ok": True}

@app.get("/api/auth/github/login", dependencies=[Depends(rate_limit(20, 300))])
async def gh_login(next: str = Query(default=""), invite_email: str = Query(default="")):
    if not GITHUB_CLIENT_ID:
        return {"manual": True, "message": "OAuth not configured. Link your GitHub login manually in Settings."}
    import urllib.parse
    state = secrets.token_urlsafe(24)
    _oauth_states[state] = {"exp": time.time() + 600, "next": (next or "")[:500], "invite_email": (invite_email or "").lower()[:254]}
    for k in [k for k, v in _oauth_states.items() if v["exp"] < time.time()]:
        _oauth_states.pop(k, None)
    params = {"client_id": GITHUB_CLIENT_ID, "redirect_uri": GITHUB_OAUTH_REDIRECT, "scope": "read:user user:email", "state": state}
    return {"manual": False, "url": "https://github.com/login/oauth/authorize?" + urllib.parse.urlencode(params), "state": state}

@app.get("/api/auth/github/callback", dependencies=[Depends(rate_limit(20, 300))])
async def gh_callback(code: str = Query(default=""), state: str = Query(default="")):
    if not code or not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=400, detail="OAuth not configured. Set GITHUB_CLIENT_ID/SECRET or link manually in Settings.")
    st = _oauth_states.pop(state, None) if state else None
    if not state or not st:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state. Please try 'Continue with GitHub' again.")
    if st["exp"] < time.time():
        raise HTTPException(status_code=400, detail="OAuth session expired. Please try again.")
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post("https://github.com/login/oauth/access_token",
                         data={"client_id": GITHUB_CLIENT_ID, "client_secret": GITHUB_CLIENT_SECRET, "code": code, "redirect_uri": GITHUB_OAUTH_REDIRECT},
                         headers={"Accept": "application/json"})
        tok = r.json().get("access_token", "")
        if not tok:
            raise HTTPException(status_code=400, detail="GitHub denied the login. Please try again or use email.")
        me = (await c.get("https://api.github.com/user", headers={"Authorization": f"Bearer {tok}", "Accept": "application/vnd.github+json"})).json()
        emails = (await c.get("https://api.github.com/user/emails", headers={"Authorization": f"Bearer {tok}", "Accept": "application/vnd.github+json"})).json()
    gh_login_name = (me.get("login") or "").strip()
    if not gh_login_name:
        raise HTTPException(status_code=502, detail="Could not read your GitHub profile.")
    primary_email = ""
    if isinstance(emails, list):
        verified = [e for e in emails if e.get("verified")]
        primary = next((e for e in verified if e.get("primary")), verified[0] if verified else None)
        if primary:
            primary_email = (primary.get("email") or "").lower().strip()
    if not primary_email:
        primary_email = f"{gh_login_name}@users.noreply.github.com"
    display_name = (me.get("name") or gh_login_name)[:80]
    u = q_one("SELECT * FROM users WHERE lower(github_login)=?", (gh_login_name.lower(),))
    if not u and "@users.noreply.github.com" not in primary_email:
        u = q_one("SELECT * FROM users WHERE email=?", (primary_email,))
    is_new = False
    if not u:
        u = {"id": uid("u"), "email": primary_email, "password_hash": hash_pw(secrets.token_urlsafe(24)), "name": display_name, "created_at": now_iso()}
        q_exec("INSERT INTO users(id,email,password_hash,name,github_login,github_verified,created_at) VALUES(?,?,?,?,?,?,?)",
               (u["id"], u["email"], u["password_hash"], u["name"], gh_login_name, 1, u["created_at"]))
        u = q_one("SELECT * FROM users WHERE id=?", (u["id"],))
        is_new = True
    else:
        q_exec("UPDATE users SET github_login=?, github_verified=1 WHERE id=?", (gh_login_name, u["id"]))
        u = q_one("SELECT * FROM users WHERE id=?", (u["id"],))
    linked_teams: List[str] = []
    invite_email = (st.get("invite_email") or "").lower()
    targets = q_all("SELECT * FROM memberships WHERE email=? OR lower(github_login)=?", (u["email"], gh_login_name.lower()))
    if invite_email:
        targets += [m for m in q_all("SELECT * FROM memberships WHERE email=?", (invite_email,)) if m["id"] not in {t["id"] for t in targets}]
    for m in targets:
        if not m["user_id"]:
            q_exec("UPDATE memberships SET user_id=?, github_login=? WHERE id=?", (u["id"], gh_login_name, m["id"]))
        else:
            q_exec("UPDATE memberships SET github_login=? WHERE id=?", (gh_login_name, m["id"]))
        fresh = q_one("SELECT * FROM memberships WHERE id=?", (m["id"],))
        if fresh and fresh["status"] == "invited" and (fresh["email"].lower() == u["email"].lower() or (fresh["github_login"] or "").lower() == gh_login_name.lower() or (invite_email and fresh["email"].lower() == invite_email)):
            q_exec("UPDATE memberships SET status='accepted', accepted_at=?, invite_token_hash=NULL WHERE id=?", (now_iso(), m["id"]))
        linked_teams.append(m["team_id"])
    token = make_jwt(u["id"])
    return {"token": token, "isNew": is_new,
            "user": {"id": u["id"], "email": u["email"], "name": u["name"], "github_login": gh_login_name, "github_verified": True},
            "linked_teams": sorted(set(linked_teams)), "next": st.get("next") or ""}

@app.post("/api/teams", dependencies=[Depends(rate_limit(10, 300))])
async def create_team(body: TeamIn, user: Dict[str, Any] = Depends(current_user)):
    owner, repo = parse_repo_url(body.repo_url)
    repo_json, _ = await gh_get(f"/repos/{owner}/{repo}")
    if (repo_json or {}).get("private"):
        raise HTTPException(status_code=400, detail="Repo must be PUBLIC.")
    tid = uid("t")
    q_exec("INSERT INTO teams(id,name,description,repo_url,repo_owner,repo_name,deadline,creator_id,status,keyword_profile,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            (tid, body.name.strip(), body.description.strip(), body.repo_url.strip(), owner, repo, body.deadline or "", user["id"], "active", json.dumps([]), now_iso()))
    q_exec("INSERT INTO memberships(id,team_id,user_id,email,status,accepted_at,github_login) VALUES(?,?,?,?,?,?,?)",
           (uid("m"), tid, user["id"], user["email"], "accepted", now_iso(), user["github_login"] or ""))
    links: Dict[str, str] = {}
    all_emails = list(dict.fromkeys([str(e).lower() for e in body.member_emails if str(e).lower() != user["email"].lower()]))
    for em in all_emails:
        token = secrets.token_urlsafe(24)
        th = hashlib.sha256(token.encode()).hexdigest()
        exp = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        ex_user = q_one("SELECT * FROM users WHERE email=?", (em,))
        q_exec("INSERT INTO memberships(id,team_id,user_id,email,status,invite_token_hash,invite_expires_at) VALUES(?,?,?,?,?,?,?)",
               (uid("m"), tid, ex_user["id"] if ex_user else None, em, "invited", th, exp))
        link = f"{FRONTEND_URL}/invite/{token}"
        fb = send_invite_email(em, body.name, user["name"], link)
        links[em] = fb or link
    t = team_or_404(tid)
    return {"team": {"id": t["id"], "name": t["name"], "status": t["status"]}, "inviteLinks": links,
            "message": "Team created. Invite emails sent (or copy links if SMTP is off)." if all_emails else "Team created."}

@app.get("/api/teams")
async def list_teams(user: Dict[str, Any] = Depends(current_user)):
    mems = q_all("SELECT * FROM memberships WHERE user_id=? OR email=?", (user["id"], user["email"]))
    tids = list({m["team_id"] for m in mems})
    out = []
    for tid in tids:
        t = q_one("SELECT * FROM teams WHERE id=?", (tid,))
        if not t:
            continue
        ms = q_all("SELECT * FROM memberships WHERE team_id=?", (tid,))
        out.append({"id": t["id"], "name": t["name"], "description": t["description"], "status": t["status"],
                    "repo_url": t["repo_url"], "deadline": t["deadline"],
                    "accepted": sum(1 for m in ms if m["status"] == "accepted"), "total": len(ms)})
    return {"teams": out}

@app.get("/api/teams/{tid}")
async def get_team(tid: str, user: Dict[str, Any] = Depends(current_user)):
    t = team_or_404(tid)
    must_be_member(tid, user)
    ms = q_all("SELECT id,team_id,user_id,email,status,accepted_at,github_login FROM memberships WHERE team_id=?", (tid,))
    return {"team": {k: v for k, v in t.items() if k != "keyword_profile"}, "members": ms}

@app.post("/api/teams/{tid}/invites/resend", dependencies=[Depends(rate_limit(10, 300))])
async def resend(tid: str, user: Dict[str, Any] = Depends(current_user)):
    t = team_or_404(tid)
    if t["creator_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the creator can resend invites.")
    links = {}
    for m in q_all("SELECT * FROM memberships WHERE team_id=? AND status='invited'", (tid,)):
        token = secrets.token_urlsafe(24)
        th = hashlib.sha256(token.encode()).hexdigest()
        exp = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        q_exec("UPDATE memberships SET invite_token_hash=?, invite_expires_at=? WHERE id=?", (th, exp, m["id"]))
        link = f"{FRONTEND_URL}/invite/{token}"
        links[m["email"]] = send_invite_email(m["email"], t["name"], user["name"], link) or link
    return {"inviteLinks": links}

@app.delete("/api/teams/{tid}/invites/{mid}")
async def revoke(tid: str, mid: str, user: Dict[str, Any] = Depends(current_user)):
    t = team_or_404(tid)
    if t["creator_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the creator can revoke invites.")
    q_exec("DELETE FROM memberships WHERE id=? AND team_id=?", (mid, tid))
    return {"ok": True}

@app.get("/api/invites/{token}")
async def invite_info(token: str):
    th = hashlib.sha256(token.encode()).hexdigest()
    m = q_one("SELECT * FROM memberships WHERE invite_token_hash=?", (th,))
    if not m:
        raise HTTPException(status_code=404, detail="Invalid invite link.")
    if m["invite_expires_at"] and m["invite_expires_at"] < now_iso():
        raise HTTPException(status_code=410, detail="Invite expired. Ask the creator to resend.")
    t = team_or_404(m["team_id"])
    return {"team_name": t["name"], "description": t["description"], "email": m["email"], "status": m["status"], "repo_url": t["repo_url"]}

@app.post("/api/invites/{token}/accept")
async def invite_accept(token: str, body: Dict[str, Any] = {}):
    th = hashlib.sha256(token.encode()).hexdigest()
    m = q_one("SELECT * FROM memberships WHERE invite_token_hash=?", (th,))
    if not m:
        raise HTTPException(status_code=404, detail="Invalid invite link.")
    if m["invite_expires_at"] and m["invite_expires_at"] < now_iso():
        raise HTTPException(status_code=410, detail="Invite expired.")
    email = (body.get("email") or m["email"]).lower()
    name = body.get("name") or email.split("@")[0]
    pw = body.get("password") or secrets.token_urlsafe(12)
    u = q_one("SELECT * FROM users WHERE email=?", (email,))
    if not u:
        if not body.get("password"):
            raise HTTPException(status_code=400, detail="Please register with a password to accept.")
        u = {"id": uid("u"), "email": email, "password_hash": hash_pw(pw), "name": name, "created_at": now_iso()}
        q_exec("INSERT INTO users(id,email,password_hash,name,email_verified,created_at) VALUES(?,?,?,?,?,?)", (u["id"], u["email"], u["password_hash"], u["name"], 1, u["created_at"]))
    q_exec("UPDATE memberships SET user_id=?, status='accepted', accepted_at=?, invite_token_hash=NULL WHERE id=?", (u["id"], now_iso(), m["id"]))
    for mm in q_all("SELECT * FROM memberships WHERE email=? AND user_id IS NULL", (u["email"],)):
        q_exec("UPDATE memberships SET user_id=? WHERE id=?", (u["id"], mm["id"]))
    return {"token": make_jwt(u["id"]), "team_id": m["team_id"]}

@app.post("/api/invites/{token}/decline")
async def invite_decline(token: str):
    th = hashlib.sha256(token.encode()).hexdigest()
    m = q_one("SELECT * FROM memberships WHERE invite_token_hash=?", (th,))
    if not m:
        raise HTTPException(status_code=404, detail="Invalid invite link.")
    q_exec("UPDATE memberships SET status='declined', invite_token_hash=NULL WHERE id=?", (m["id"],))
    return {"ok": True}

@app.get("/api/me/records")
async def my_records(team_id: str = Query(""), user: Dict[str, Any] = Depends(current_user)):
    if team_id:
        rows = q_all("SELECT * FROM activity_records WHERE team_id=? AND user_id=? ORDER BY started_at DESC LIMIT 500", (team_id, user["id"]))
    else:
        rows = q_all("SELECT * FROM activity_records WHERE user_id=? ORDER BY started_at DESC LIMIT 500", (user["id"],))
    return {"records": [{**r, "id": r["local_id"]} for r in rows]}

@app.delete("/api/me/records/{rid}")
async def del_record(rid: str):
    raise HTTPException(status_code=410, detail="Logs are immutable once submitted — check the 🔍 preview before logging. No edit or delete.")

@app.post("/api/logs/preview", dependencies=[Depends(rate_limit(20, 300))])
async def log_preview(body: LogIn, user: Dict[str, Any] = Depends(current_user)):
    must_be_member(body.team_id, user)
    v = await verify_link(body.link_url, body.category, body.topic)
    base = math.log1p(min(float(body.minutes), SCORING_WEIGHTS["log_cap_item"])) * 5.0 * SCORING_WEIGHTS["log_base_per_min"]
    predicted = round(base * v["multiplier"], 1)
    return {"preview": True, "immutable_warning": "⚠️ Logs are permanent — no edit, no delete. Is this correct?",
            "parsed": {"domain": v["domain"], "title": v["title"], "family": v["family"], "signals": v["signals"]},
            "multiplier": v["multiplier"], "predicted_points": predicted, "verification_note": v["note"]}

@app.post("/api/logs", dependencies=[Depends(rate_limit(20, 300))])
async def create_log(body: LogIn, user: Dict[str, Any] = Depends(current_user)):
    must_be_member(body.team_id, user)
    if body.category not in ("dataset", "paper", "docs", "training", "debugging", "tutorial", "other"):
        raise HTTPException(status_code=400, detail="Invalid category.")
    v = await verify_link(body.link_url, body.category, body.topic)
    lid = "log_" + secrets.token_hex(6)
    now = now_iso()
    ws = week_start_of(datetime.now(timezone.utc))
    q_exec("""INSERT INTO activity_records(id,team_id,user_id,local_id,topic,category,minutes,relevance,confidence,
              started_at,ended_at,status,created_at,week_start,link_url,link_domain,link_title,link_signals,link_verified,multiplier,immutable)
              VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
           (uid("r"), body.team_id, user["id"], lid, body.topic.strip()[:140], body.category, float(body.minutes),
            0.8, 0.7, body.started_at or now, now, "pending", now, ws,
            body.link_url.strip()[:2000], v["domain"], v["title"], json.dumps(v["signals"]), 1 if v["verified"] else 0, v["multiplier"], 1))
    ensure_weekly(body.team_id, user["id"])
    return {"id": lid, "status": "pending", "multiplier": v["multiplier"], "verification_note": v["note"],
            "message": "🔒 Logged permanently — awaiting any 1 teammate confirmation to count."}

@app.get("/api/teams/{tid}/inbox")
async def confirm_inbox(tid: str, user: Dict[str, Any] = Depends(current_user)):
    must_be_member(tid, user)
    rows = q_all("SELECT ar.*, u.name as author_name FROM activity_records ar JOIN users u ON u.id=ar.user_id WHERE ar.team_id=? AND ar.status='pending' AND ar.user_id!=? ORDER BY ar.created_at DESC LIMIT 100", (tid, user["id"]))
    out = []
    for r in rows:
        c = q_all("SELECT * FROM confirmations WHERE record_id=?", (r["local_id"],))
        out.append({**{k: r[k] for k in ("local_id", "topic", "category", "minutes", "link_url", "link_domain", "link_title", "multiplier", "created_at")}, "author": r["author_name"], "confirmations": len(c)})
    return {"pending": out}

@app.post("/api/logs/{lid}/confirm", dependencies=[Depends(rate_limit(30, 300))])
async def confirm_log(lid: str, body: ConfirmIn, user: Dict[str, Any] = Depends(current_user)):
    r = q_one("SELECT * FROM activity_records WHERE local_id=?", (lid,))
    if not r:
        raise HTTPException(status_code=404, detail="Log not found.")
    must_be_member(r["team_id"], user)
    if r["user_id"] == user["id"]:
        raise HTTPException(status_code=400, detail="You cannot confirm your own log — ask a teammate. 🤝")
    if r["status"] == "confirmed":
        return {"ok": True, "status": "confirmed", "message": "Already confirmed."}
    try:
        q_exec("INSERT INTO confirmations(id,record_id,team_id,confirmer_id,decision,note,created_at) VALUES(?,?,?,?,?,?,?)",
               (uid("c"), lid, r["team_id"], user["id"], body.decision, body.note[:500], now_iso()))
    except Exception:
        raise HTTPException(status_code=400, detail="You already reviewed this log.")
    if body.decision == "confirm":
        q_exec("UPDATE activity_records SET status='confirmed' WHERE local_id=?", (lid,))
        return {"ok": True, "status": "confirmed", "message": "✅ Confirmed — now counts in the report."}
    q_exec("UPDATE activity_records SET status='flagged' WHERE local_id=?", (lid,))
    return {"ok": True, "status": "flagged", "message": "🚩 Flagged with context — still visible, scores low."}

@app.post("/api/logs/{lid}/flag", dependencies=[Depends(rate_limit(30, 300))])
async def flag_log(lid: str, body: ConfirmIn, user: Dict[str, Any] = Depends(current_user)):
    return await confirm_log(lid, ConfirmIn(decision="flag", note=body.note), user)

@app.post("/api/analyze", dependencies=[Depends(rate_limit(10, 300))])
async def instant_analyze(body: Dict[str, Any]):
    url = (body.get("repo_url") or "").strip()
    owner, repo = parse_repo_url(url)
    ev = await fetch_repo_evidence(owner, repo)
    aid = uid("a")
    q_exec("INSERT INTO analyses(id,owner,repo,result,fetched_at) VALUES(?,?,?,?,?)", (aid, owner, repo, json.dumps(ev), now_iso()))
    people = [{"login": login, "commits": a.get("commits", 0), "prs": a.get("prs", 0), "issues": a.get("issues", 0),
               "active_days": len(a.get("active_days", [])), "stages": a.get("stages", {}),
               "files_touched": a.get("files_touched", 0),
               "effort": a.get("effort", 0.0), "code_churn": a.get("code_churn", 0), "docs_churn": a.get("docs_churn", 0),
               "lines_added": a.get("lines_added", 0), "lines_removed": a.get("lines_removed", 0),
               "code_files": a.get("code_files", 0), "docs_files": a.get("docs_files", 0),
               "file_types": a.get("file_types", []), "top_files": a.get("top_files", [])} for login, a in (ev.get("authors") or {}).items()]
    people.sort(key=lambda x: (-x["effort"], -x["commits"]))
    return {"analysis_id": aid, "repo": ev.get("repo"), "people": people,
            "note": "💬 Instant preview — sign up + create a team for confirmed logs, link-verified credit and share links."}

@app.get("/api/me/summaries")
async def my_summaries(user: Dict[str, Any] = Depends(current_user)):
    return {"summaries": q_all("SELECT * FROM weekly_summaries WHERE user_id=? ORDER BY week_start DESC", (user["id"],)), "grace_hours": GRACE_HOURS_AUTOSHARE}

@app.post("/api/me/summaries/{week}/share")
async def share_week(week: str, body: Dict[str, Any] = {}, user: Dict[str, Any] = Depends(current_user)):
    tid = body.get("team_id", "")
    q_exec("UPDATE activity_records SET status='shared' WHERE team_id=? AND user_id=? AND week_start=?", (tid, user["id"], week))
    q_exec("UPDATE weekly_summaries SET status='shared' WHERE team_id=? AND user_id=? AND week_start=?", (tid, user["id"], week))
    return {"ok": True, "shared": True}

@app.post("/api/teams/{tid}/github/refresh")
async def gh_refresh(tid: str, user: Dict[str, Any] = Depends(current_user)):
    t = team_or_404(tid); must_be_member(tid, user)
    ev = await fetch_repo_evidence(t["repo_owner"], t["repo_name"])
    q_exec("INSERT INTO github_snapshots(id,team_id,fetched_at,data) VALUES(?,?,?,?)", (uid("g"), tid, now_iso(), json.dumps(ev)))
    return {"ok": True, "authors": list((ev.get("authors") or {}).keys())}

@app.get("/api/teams/{tid}/identities")
async def get_ident(tid: str, user: Dict[str, Any] = Depends(current_user)):
    must_be_member(tid, user)
    snap = q_one("SELECT * FROM github_snapshots WHERE team_id=? ORDER BY fetched_at DESC LIMIT 1", (tid,))
    authors = list((json.loads(snap["data"]) if snap else {}).get("authors", {}).keys()) if snap else []
    links = q_all("SELECT * FROM identity_links WHERE team_id=?", (tid,))
    members = q_all("SELECT user_id,email FROM memberships WHERE team_id=? AND status='accepted'", (tid,))
    return {"authors": authors, "links": links, "members": members}

@app.put("/api/teams/{tid}/identities")
async def put_ident(tid: str, body: Dict[str, Any], user: Dict[str, Any] = Depends(current_user)):
    must_be_member(tid, user)
    for link in body.get("links", []) or []:
        q_exec("INSERT OR REPLACE INTO identity_links(id,team_id,git_author_name,git_email,user_id) VALUES(?,?,?,?,?)",
               (uid("i"), tid, link.get("git_author_name", ""), link.get("git_email", ""), link.get("user_id")))
    return {"ok": True}

def resolve_members(tid: str):
    mems = q_all("SELECT * FROM memberships WHERE team_id=?", (tid,))
    users = {u["id"]: u for u in q_all("SELECT * FROM users WHERE id IN (%s)" % ",".join("?" * len({m['user_id'] for m in mems if m['user_id']}) or "'x'"), tuple({m["user_id"] for m in mems if m["user_id"]}) or ())} if any(m["user_id"] for m in mems) else {}
    links = q_all("SELECT * FROM identity_links WHERE team_id=?", (tid,))
    return mems, users, links

@app.get("/api/teams/{tid}/report")
async def report(tid: str, user: Dict[str, Any] = Depends(current_user)):
    t = team_or_404(tid); must_be_member(tid, user)
    mems, users, links = resolve_members(tid)
    snap = q_one("SELECT * FROM github_snapshots WHERE team_id=? ORDER BY fetched_at DESC LIMIT 1", (tid,))
    gh_data = (json.loads(snap["data"]) if snap else {"authors": {}, "repo": {}})
    authors: Dict[str, Any] = gh_data.get("authors", {})
    login_to_uid: Dict[str, str] = {}
    for m in mems:
        u = users.get(m["user_id"] or "")
        gl = (m["github_login"] or (u["github_login"] if u else "") or "").lower()
        if m["user_id"] and gl:
            login_to_uid[gl] = m["user_id"]
    for l in links:
        if l["user_id"]:
            login_to_uid[(l["git_author_name"] or "").lower()] = l["user_id"]
    cards = []
    for m in mems:
        u = users.get(m["user_id"] or "")
        name = (u["name"] if u else m["email"].split("@")[0])
        ghs = [a for login, a in authors.items() if login_to_uid.get(login.lower()) == m["user_id"] or login.lower() == (m["github_login"] or "").lower() or login.lower() == m["email"].split("@")[0].lower()]
        gh = {"commits": 0, "prs": 0, "issues": 0, "active_days": [], "files_touched": 0, "file_types": [], "stages": {}, "metrics": [], "hps": []}
        for g in ghs:
            gh["commits"] += g.get("commits", 0); gh["prs"] += g.get("prs", 0); gh["issues"] += g.get("issues", 0)
            gh["active_days"] = sorted(set(gh["active_days"]) | set(g.get("active_days", [])))
            gh["files_touched"] += g.get("files_touched", 0)
            gh["file_types"] = sorted(set(gh["file_types"]) | set(g.get("file_types", [])))
            for k, v in (g.get("stages") or {}).items():
                gh["stages"][k] = gh["stages"].get(k, 0) + int(v)
            gh["metrics"].extend(g.get("metrics", [])); gh["hps"].extend(g.get("hps", []))
        shared = q_all("SELECT * FROM activity_records WHERE team_id=? AND user_id=? AND status='confirmed'", (tid, m["user_id"] or "x"))
        pending_n = q_one("SELECT COUNT(*) as n FROM activity_records WHERE team_id=? AND user_id=? AND status='pending'", (tid, m["user_id"] or "x"))["n"] if m["user_id"] else 0
        by_day_topic: Dict[str, Dict[str, float]] = {}
        for r in shared:
            day = (r["started_at"] or "")[:10]
            by_day_topic.setdefault(day, {})
            by_day_topic[day][r["topic"]] = by_day_topic[day].get(r["topic"], 0) + float(r["minutes"] or 0)
        shared_mins = sum(float(r["minutes"] or 0) for r in shared)
        scores = score_person(gh, by_day_topic, shared_mins, confirmed_logs=shared)
        link_items = [{"topic": r["topic"], "url": r["link_url"] or "", "domain": r["link_domain"] or "", "title": r["link_title"] or "",
                       "multiplier": r["multiplier"] or 1.0, "verified": bool(r["link_verified"])} for r in shared if (r["link_url"] or "")][:10]
        accepted = m["status"] == "accepted"
        if not accepted or (not shared and gh["commits"] == 0):
            browser_label = "not available"
        elif not shared:
            browser_label = "not available"
        else:
            browser_label = f"{round(shared_mins)} min shared"
        flags = []
        if shared_mins > 120 and gh["commits"] == 0 and gh["prs"] == 0:
            flags.append({"type": "activity_without_output", "text": "Lots of logged work, no commits/PRs yet — maybe notes or offline work."})
        if gh["commits"] > 0 and shared_mins == 0:
            flags.append({"type": "output_without_logs", "text": "Output without confirmed logs — neutral: work may be unlogged."})
        crunch = False
        if t["deadline"]:
            try:
                dl = datetime.fromisoformat(t["deadline"])
                if dl.tzinfo is None:
                    dl = dl.replace(tzinfo=timezone.utc)
                late = sum(float(r["minutes"] or 0) for r in shared if (r["started_at"] or "") >= (dl - timedelta(hours=48)).isoformat())
                crunch = shared_mins > 0 and (late / shared_mins) > 0.7
            except Exception:
                pass
        conf = "high" if (gh["commits"] > 0 and shared_mins > 0) else ("medium" if (gh["commits"] > 0 or shared_mins > 0) else "low")
        conf_note = "GitHub + confirmed logs" if conf == "high" else ("only GitHub available, low confidence" if (gh["commits"] > 0 and shared_mins == 0) else ("only logs available" if shared_mins > 0 else "no signals yet"))
        cards.append({
            "user_id": m["user_id"], "email": m["email"], "name": name, "status": m["status"],
            "github_login": m["github_login"] or "",
            "scores": scores, "github": {**gh, "metrics": gh["metrics"][-8:], "hps": gh["hps"][-8:]},
            "browser": {"shared_minutes": round(shared_mins, 1), "label": browser_label, "by_day_topic": by_day_topic},
            "logs": {"confirmed_minutes": round(shared_mins, 1), "pending": pending_n, "links": link_items},
            "flags": flags, "crunch": crunch, "confidence": conf, "confidence_note": conf_note,
            "summary": f"{name}: {gh['commits']} commits, {gh['prs']} PRs, {round(shared_mins)} min confirmed logs. {conf_note}.",
        })
    stages_all = sorted({s for c in cards for s in (c["github"].get("stages") or {}).keys()})
    timeline = []
    for c in cards:
        for day, topics in (c["browser"].get("by_day_topic") or {}).items():
            timeline.append({"day": day, "person": c["name"], "minutes": round(sum(topics.values()), 1)})
    timeline.sort(key=lambda x: x["day"])
    return {"team": {"id": t["id"], "name": t["name"], "status": t["status"], "deadline": t["deadline"], "repo_url": t["repo_url"]},
            "people": cards, "stages": stages_all, "timeline": timeline,
            "not_detectable": NOT_DETECTABLE, "fetched_at": (snap["fetched_at"] if snap else None),
            "note": "Evidence for a fair conversation, not a verdict. Relevance scoring has errors; offline work is invisible."}

@app.post("/api/demo/seed")
async def demo_seed(user: Optional[Dict[str, Any]] = Depends(optional_user)):
    if not user:
        email = "demo@fairshare.local"
        user = q_one("SELECT * FROM users WHERE email=?", (email,))
        if not user:
            user = {"id": uid("u"), "email": email, "password_hash": hash_pw("demo1234"), "name": "Demo Owner", "created_at": now_iso()}
            q_exec("INSERT INTO users(id,email,password_hash,name,created_at) VALUES(?,?,?,?,?)", (user["id"], user["email"], user["password_hash"], user["name"], user["created_at"]))
        token = make_jwt(user["id"])
    else:
        token = None
    tid = uid("t")
    dl = (datetime.now(timezone.utc) + timedelta(days=6)).isoformat()
    q_exec("INSERT INTO teams(id,name,description,repo_url,repo_owner,repo_name,deadline,creator_id,status,keyword_profile,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
           (tid, "CIFAR-10 Classifier", "CNN image classifier with PyTorch: ResNet, augmentation, Grad-CAM eval.", "https://github.com/pytorch/examples", "pytorch", "examples", dl, user["id"], "active", json.dumps([]), now_iso()))
    people = [(user["id"], user["email"], user["name"], "demo-owner"), ("dx1", "priya@demo.local", "Priya", "priya-dev"), ("dx2", "sam@demo.local", "Sam", "sam-ml")]
    for pidx, (puid, email, name, gh) in enumerate(people):
        if puid.startswith("dx"):
            if not q_one("SELECT id FROM users WHERE id=?", (puid,)):
                q_exec("INSERT INTO users(id,email,password_hash,name,github_login,created_at) VALUES(?,?,?,?,?,?)", (puid, email, hash_pw("demo1234"), name, gh, now_iso()))
        q_exec("INSERT INTO memberships(id,team_id,user_id,email,status,accepted_at,github_login) VALUES(?,?,?,?,?,?,?)",
               (uid("m"), tid, puid, email, "accepted", now_iso(), gh))
    base = datetime.now(timezone.utc) - timedelta(days=9)
    topics = [("CIFAR-10 augmentation docs", "docs", 42, "https://pytorch.org/docs/stable/data.html", 1.5), ("ResNet paper (arxiv)", "paper", 35, "https://arxiv.org/abs/1512.03385", 2.0), ("Colab training run", "training", 95, "https://colab.research.google.com", 2.0), ("StackOverflow CUDA fix", "debugging", 28, "", 1.0), ("HuggingFace dataset card", "dataset", 31, "https://huggingface.co/datasets/cifar10", 1.5), ("Grad-CAM tutorial", "tutorial", 26, "https://arxiv.org/abs/1610.02391", 1.5)]
    for i, (topic, cat, mins, link, mult) in enumerate(topics):
        owner_idx = i % 3
        puid = [people[0][0], people[1][0], people[2][0]][owner_idx]
        s = (base + timedelta(days=i)).isoformat()
        e = (base + timedelta(days=i, minutes=mins)).isoformat()
        dom = ""
        try:
            dom = re.sub(r"^www\.", "", (httpx.URL(link).host or "")) if link else ""
        except Exception:
            dom = ""
        q_exec("""INSERT OR REPLACE INTO activity_records(id,team_id,user_id,local_id,topic,category,minutes,relevance,confidence,keyword_pred,embed_pred,started_at,ended_at,status,created_at,week_start,link_url,link_domain,link_title,link_signals,link_verified,multiplier,immutable)
                  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
               (uid("r"), tid, puid, f"demo-{i}", topic, cat, mins, 0.85, 0.8, 1, 1, s, e, "confirmed", now_iso(), week_start_of(base + timedelta(days=i)), link, dom, topic, '{}', 1 if link else 0, mult, 1))
        ensure_weekly(tid, puid)
    gh_demo = {"repo": {"owner": "pytorch", "name": "examples", "stars": 24000, "description": "PyTorch examples"}, "authors": {
        "demo-owner": {"login": "demo-owner", "commits": 14, "active_days": sorted([(base + timedelta(days=d)).date().isoformat() for d in [0, 1, 3, 5, 7]]), "files_touched": 22, "file_types": ["py", "md", "ipynb"], "prs": 4, "reviews": 2, "issues": 3, "stages": {"Data": 5, "Model": 9, "Training": 11, "Evaluation": 6, "Docs": 3}, "metrics": [{"sha": "a1b2c3d", "values": {"accuracy": 0.82}, "delta": {"accuracy": 0.04}, "date": (base + timedelta(days=5)).date().isoformat()}], "hps": [{"sha": "a1b2c3d", "changes": {"lr": "0.001", "epochs": "20"}, "date": (base + timedelta(days=5)).date().isoformat()}]},
        "priya-dev": {"login": "priya-dev", "commits": 11, "active_days": sorted([(base + timedelta(days=d)).date().isoformat() for d in [0, 2, 4, 6]]), "files_touched": 17, "file_types": ["py", "ipynb"], "prs": 3, "reviews": 3, "issues": 1, "stages": {"Data": 7, "Model": 5, "Training": 6, "Evaluation": 2}, "metrics": [{"sha": "e4f5g6h", "values": {"accuracy": 0.78}, "delta": {"accuracy": 0.03}, "date": (base + timedelta(days=4)).date().isoformat()}], "hps": [{"sha": "e4f5g6h", "changes": {"batch_size": "128"}, "date": (base + timedelta(days=4)).date().isoformat()}]},
        "sam-ml": {"login": "sam-ml", "commits": 6, "active_days": sorted([(base + timedelta(days=d)).date().isoformat() for d in [6, 7]]), "files_touched": 8, "file_types": ["md", "py"], "prs": 1, "reviews": 0, "issues": 4, "stages": {"Docs": 4, "Evaluation": 3}, "metrics": [], "hps": []}}}
    q_exec("INSERT INTO github_snapshots(id,team_id,fetched_at,data) VALUES(?,?,?,?)", (uid("g"), tid, now_iso(), json.dumps(gh_demo)))
    return {"team_id": tid, "token": token, "message": "Demo team ready. Open the report to see a finished example."}

async def auto_share_loop():
    while True:
        try:
            rows = q_all("SELECT * FROM weekly_summaries WHERE status='pending_review'")
            for r in rows:
                try:
                    if r["review_deadline"] and r["review_deadline"] < now_iso():
                        q_exec("UPDATE activity_records SET status='shared' WHERE team_id=? AND user_id=? AND week_start=? AND status='private'", (r["team_id"], r["user_id"], r["week_start"]))
                        q_exec("UPDATE weekly_summaries SET status='auto_shared' WHERE id=?", (r["id"],))
                except Exception:
                    pass
        except Exception:
            pass
        await asyncio.sleep(3600)

@app.on_event("startup")
async def on_startup():
    init_db()
    asyncio.create_task(auto_share_loop())

@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})

if __name__ == "__main__":
    import uvicorn
    init_db()
    uvicorn.run("server:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=True)
