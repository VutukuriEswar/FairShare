import React from 'react';
import { motion } from 'framer-motion';
import { avatarFor, fmtPct, fmtLines, rankEmoji, STAGE_EMOJI } from '../utils/share';

export default function ContributorCard({ person, totals, index = 0 }) {
  const stages = Object.entries(person.stages || {}).sort((a, b) => b[1] - a[1]);
  const grad = `linear-gradient(90deg, ${person.color}, ${person.color}88)`;
  const codeChurn = Number(person.code_churn || 0);
  const docsChurn = Number(person.docs_churn || 0);
  const churnTotal = codeChurn + docsChurn;
  const codeShare = churnTotal ? (100 * codeChurn) / churnTotal : 0;
  const topFiles = (person.top_files || []).slice(0, 3);

  return (
    <motion.article
      className={`contrib-card rank-${person.rank <= 3 ? person.rank : 'x'}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.06, 0.4) }}
      aria-label={`Contributor ${person.login}, rank ${person.rank}, ${fmtPct(person.effortPct)} effort`}
      style={{ '--rank-grad': grad }}
    >
      <div className="contrib-top" />
      <div className="contrib-head">
        <span className="contrib-avatar" aria-hidden="true">{avatarFor(person.login)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '1.05rem' }}>@{person.login}</strong>
            <span className="rank-badge">{rankEmoji(person.rank)} rank #{person.rank}</span>
          </div>
          <div className="muted" style={{ fontSize: '.85rem' }}>
            💻 <strong>{fmtPct(person.commitPct)}</strong> commits · {fmtLines(person)} lines · effort <strong style={{ color: person.color }}>{Math.round(Number(person.effort || 0))} pts</strong>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="big-pct" style={{ color: person.color }}>{fmtPct(person.effortPct)}</div>
          <div className="muted" style={{ fontSize: '.75rem', fontWeight: 800 }}>TRUE EFFORT</div>
        </div>
      </div>

      <div className="stat-mini">
        <div><b>💻 {person.commits}</b><span>{fmtPct(person.commitPct)} commits</span></div>
        <div><b>📝 {fmtLines(person)}</b><span>lines +/−</span></div>
        <div><b>⚙️ {person.code_files || 0}💻/{person.docs_files || 0}📝</b><span>code/docs files</span></div>
        <div><b>🤝 {person.prs}</b><span>PRs · 💬 {person.issues}</span></div>
      </div>

      <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
        {[
          ['⚡ Effort share', person.effortPct, 'WHAT×HOW MUCH: file weight × lines'],
          ['💻 Commit share', person.commitPct, 'raw count only — can mislead'],
          ['🧠 Code churn', person.codePct, 'share of real code lines (docs excluded)'],
        ].map(([label, v, tip]) => (
          <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'center' }} title={tip}>
            <span className="muted" style={{ width: 130, fontSize: '.78rem', fontWeight: 700 }}>{label}</span>
            <div className="neon-bar" style={{ flex: 1 }} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin="0" aria-valuemax="100" aria-label={`${person.login} ${label}`}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, v)}%` }} transition={{ duration: 0.7, delay: index * 0.05 }} style={{ background: grad }} />
            </div>
            <strong className="ring-num" style={{ width: 52, textAlign: 'right', fontSize: '.85rem' }}>{fmtPct(v)}</strong>
          </div>
        ))}
      </div>

      {churnTotal > 0 && (
        <div style={{ marginTop: 8 }} title="Code lines vs docs lines — README work counts, but code dominates">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem' }} className="muted">
            <span>💻 code {fmtPct(codeShare, 0)}</span><span>📝 docs {fmtPct(100 - codeShare, 0)}</span>
          </div>
          <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,.1)', marginTop: 4 }}>
            <div style={{ width: `${codeShare}%`, background: person.color }} />
            <div style={{ width: `${100 - codeShare}%`, background: 'rgba(255,201,60,.7)' }} />
          </div>
        </div>
      )}

      {!!topFiles.length && (
        <div className="stage-chips" title="Files this person moved the most (by weighted effort)">
          {topFiles.map((t) => (
            <span key={t.file} className="stage-chip">📄 {t.file.split('/').pop()} <strong>{Math.round(t.effort)}</strong></span>
          ))}
        </div>
      )}

      {!!stages.length && (
        <div className="stage-chips">
          {stages.map(([k, v]) => {
            const pct = person.stageTotal ? (100 * v) / person.stageTotal : 0;
            return (
              <span key={k} className="stage-chip" title={`${v} ${k} signals`}>
                {STAGE_EMOJI[k] || '📌'} {k} <strong>{v}</strong> <span className="muted">{fmtPct(pct, 0)}</span>
              </span>
            );
          })}
        </div>
      )}
      <div className="muted" style={{ fontSize: '.8rem', marginTop: 6 }}>
        📁 {person.files_touched || 0} files · 📅 {person.active_days} days
        {(person.docs_files || 0) > 0 && (person.code_files || 0) === 0 ? ' · 📝 docs-only — counts, but weighed 4× less than code' : ''}
      </div>
    </motion.article>
  );
}
