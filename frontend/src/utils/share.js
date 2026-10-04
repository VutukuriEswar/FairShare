export const NEON_COLORS = [
  '#7C5CFF',
  '#55EFC4',
  '#FFC93C',
  '#FF6B9D',
  '#4DD8FF',
  '#B388FF',
  '#7BFFB2',
  '#FF9F43',
];

export const STAGE_EMOJI = {
  Data: '📦',
  Model: '🧠',
  Training: '🏋️',
  Evaluation: '🧪',
  Docs: '📝',
  Other: '📌',
};

export function impactScore(p = {}) {
  const effort = Number(p.effort || 0);
  const prs = Number(p.prs || 0);
  const issues = Number(p.issues || 0);
  const days = Number(p.active_days || 0);
  if (effort > 0 || p.code_churn != null) {
    return effort + prs * 15 + issues * 3 + days * 1;
  }
  const commits = Number(p.commits || 0);
  const files = Number(p.files_touched || 0);
  return commits * 3 + prs * 5 + issues * 1 + days * 2 + files * 0.5;
}

export function enrichPeople(rawPeople = []) {
  const totalCommits = rawPeople.reduce((s, p) => s + Number(p.commits || 0), 0);
  const totalPRs = rawPeople.reduce((s, p) => s + Number(p.prs || 0), 0);
  const totalIssues = rawPeople.reduce((s, p) => s + Number(p.issues || 0), 0);
  const totalFiles = rawPeople.reduce((s, p) => s + Number(p.files_touched || 0), 0);
  const totalEffort = rawPeople.reduce((s, p) => s + Number(p.effort || 0), 0);
  const totalCodeChurn = rawPeople.reduce((s, p) => s + Number(p.code_churn || 0), 0);
  const totalLines = rawPeople.reduce((s, p) => s + Number(p.lines_added || 0) + Number(p.lines_removed || 0), 0);

  const withScore = rawPeople.map((p) => ({ ...p, _score: impactScore(p) }));
  const totalScore = withScore.reduce((s, p) => s + p._score, 0);

  const enriched = withScore.map((p) => {
    const stageTotal = Object.values(p.stages || {}).reduce((s, v) => s + Number(v || 0), 0);
    const churn = Number(p.code_churn || 0) + Number(p.docs_churn || 0);
    const codeChurn = Number(p.code_churn || 0);
    return {
      ...p,
      commitPct: totalCommits ? (100 * Number(p.commits || 0)) / totalCommits : 0,
      prPct: totalPRs ? (100 * Number(p.prs || 0)) / totalPRs : 0,
      issuePct: totalIssues ? (100 * Number(p.issues || 0)) / totalIssues : 0,
      effortPct: totalEffort ? (100 * Number(p.effort || 0)) / totalEffort : 0,
      codePct: totalCodeChurn ? (100 * codeChurn) / totalCodeChurn : 0,
      impactPct: totalScore ? (100 * p._score) / totalScore : 0,
      docsShare: churn ? Number(p.docs_churn || 0) / churn : 0,
      stageTotal,
      _hasEffort: totalEffort > 0,
    };
  });

  enriched.sort((a, b) => b._score - a._score || b.effort - a.effort || b.commits - a.commits);
  enriched.forEach((p, i) => {
    p.rank = i + 1;
    p.color = NEON_COLORS[i % NEON_COLORS.length];
  });

  return {
    people: enriched,
    totals: {
      commits: totalCommits,
      prs: totalPRs,
      issues: totalIssues,
      files: totalFiles,
      score: totalScore,
      effort: totalEffort,
      codeChurn: totalCodeChurn,
      lines: totalLines,
      contributors: enriched.length,
      hasEffort: totalEffort > 0,
    },
  };
}

export function fmtPct(v, digits = 1) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  if (n === 0) return '0%';
  if (n < 0.05 && digits === 1) return '<0.1%';
  return `${n.toFixed(digits)}%`;
}

export function fmtNum(v) {
  const n = Number(v || 0);
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

export function fmtLines(p = {}) {
  const a = Number(p.lines_added || 0);
  const r = Number(p.lines_removed || 0);
  if (!a && !r) return '—';
  return `+${a} −${r}`;
}

const AVATARS = ['🦊', '🐼', '🦉', '🐸', '🦄', '🐝', '🦋', '🐢', '🦁', '🐯'];
export function avatarFor(name) {
  let h = 0;
  for (const c of name || '?') h = (h * 31 + c.charCodeAt(0)) % 997;
  return AVATARS[h % AVATARS.length];
}

export function rankEmoji(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

export function enrichReportPeople(cards = []) {
  const total = cards.reduce((s, c) => s + Number(c.scores?.total || 0), 0);
  const enriched = cards.map((c) => ({
    ...c,
    impactPct: total ? (100 * Number(c.scores?.total || 0)) / total : 0,
  }));
  enriched.sort((a, b) => Number(b.scores?.total || 0) - Number(a.scores?.total || 0));
  enriched.forEach((p, i) => {
    p.rank = i + 1;
    p.color = NEON_COLORS[i % NEON_COLORS.length];
  });
  return { people: enriched, total };
}
