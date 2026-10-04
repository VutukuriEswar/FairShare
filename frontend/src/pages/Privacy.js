import React from 'react';
export default function Privacy(){
  return (<div className="card"><div style={{fontSize:'2rem'}}>📜</div><h2>Privacy — plain language 💛</h2>
  <p><span className="pill">🔒 We never collect your browsing. Only what you type.</span></p>
  <ul><li>📦 <strong>Collected (only what you submit):</strong> log entries you type yourself — topic label 🏷️, category 📚, minutes ⏱️, evidence link 🔗, notes 📝, timestamps 📅 — plus public GitHub data 💻 from your linked repo.</li>
  <li>🚫 <strong>Never collected:</strong> browsing history 🔍, raw URLs, page titles, search queries, page content 📄. There is no tracker, no background collection, no silent logging. 🛡️</li><li>🤝 <strong>Consent:</strong> logs are 🔒 private by default; you review a weekly summary 📅, can 🗑️ delete entries (no editing ✏️🚫), then Share 🌿. ⏰ Auto-share after 48h with a reminder — stated in the UI.</li>
  <li>🧹 <strong>Retention:</strong> deleting removes server copies permanently. 🗑️</li>
  <li>👀 <strong>Visibility:</strong> team data only visible to members; reports identical for all 🤝. Account deletion wipes all your data. 🧹</li></ul></div>);
}
export function Ethics(){return null;}
