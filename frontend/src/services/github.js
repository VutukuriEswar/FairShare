import { API_BASE } from './api';
export async function continueWithGithub(inviteEmail = '') {
  const qs = inviteEmail ? `?invite_email=${encodeURIComponent(inviteEmail)}` : '';
  const r = await fetch(API_BASE + '/auth/github/login' + qs);
  const j = await r.json();
  if (!r.ok) throw new Error(j.detail || 'GitHub login failed.');
  if (j.manual) throw new Error(j.message || 'GitHub OAuth not configured. Set GITHUB_CLIENT_ID/SECRET or link manually in Settings.');
  window.location.href = j.url;
}
