import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Header({ user, theme, setTheme }) {
  const [authError, setAuthError] = useState(null);
  const [authMessage, setAuthMessage] = useState(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setAuthError(null);
    setAuthMessage(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });

    setLoading(false);

    if (error) {
      console.error(error);
      setAuthError(error.message || 'Google sign-in failed.');
      return;
    }

    setAuthMessage('Redirecting to Google…');
    if (data?.url) {
      window.location.href = data.url;
    }
  }

  async function sendMagicLink() {
    setAuthError(null);
    setAuthMessage(null);

    if (!email.trim()) {
      setAuthError('Please enter your email address.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    });
    setLoading(false);

    if (error) {
      console.error(error);
      setAuthError(error.message || 'Magic link delivery failed.');
      return;
    }

    setAuthMessage(`Magic link sent to ${email}. Check your inbox.`);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  return (
    <header className="site-header" role="banner" aria-label="Application header">
      <div className="brand">
        <div className="logo" aria-hidden="true" />
        <div>
          <div className="title">DeeCash</div>
          <div className="subtitle">Ledger & bookkeeping with premium polish</div>
        </div>
      </div>

      <div className="controls">
        <div className="theme-switch">
          <label className="sr-only" htmlFor="theme-select">Theme mode</label>
          <select id="theme-select" aria-label="Theme mode" value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div className="auth-area">
          {user ? (
            <div className="signed-in">
              <div className="signed-text">Signed in as <span>{user.email}</span></div>
              <button type="button" className="btn primary" onClick={signOut} disabled={loading}>Sign out</button>
            </div>
          ) : (
            <>
              <div className="auth-grid">
                <button type="button" className="btn google" onClick={signInWithGoogle} disabled={loading} aria-busy={loading}>
                  {loading ? 'Opening Google…' : 'Sign in with Google'}
                </button>
                <div className="magic-link">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    aria-label="Email address"
                    autoComplete="email"
                  />
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={sendMagicLink}
                    disabled={loading || !email.trim()}
                  >
                    {loading ? 'Sending…' : 'Send magic link'}
                  </button>
                </div>
              </div>
              <div className="hint">Prefer a password-free login? Magic links are secure and fast.</div>
            </>
          )}

          {(authMessage || authError) && (
            <div
              className={`auth-note ${authError ? 'error' : 'success'}`}
              role="status"
              aria-live="polite"
            >
              {authError ?? authMessage}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .site-header { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; padding:24px 28px; border-bottom:1px solid rgba(255,255,255,0.08); background:rgba(7,12,33,0.84); backdrop-filter:blur(18px); position:sticky; top:0; z-index:20; }
        .brand { display:flex; gap:14px; align-items:center; }
        .logo { width:58px; height:58px; border-radius:18px; background:linear-gradient(135deg,#0ea5ff,#2563eb); box-shadow:0 32px 60px rgba(14,165,255,0.2), inset 0 0 0 1px rgba(255,255,255,0.08); }
        .title { font-size:1.45rem; font-weight:800; letter-spacing:-0.02em; }
        .subtitle { margin-top:4px; font-size:0.92rem; color:var(--muted); }
        .controls { display:flex; gap:20px; align-items:flex-end; flex-wrap:wrap; justify-content:flex-end; min-width:320px; }
        .theme-switch { min-width:155px; }
        .auth-area { display:grid; gap:10px; min-width:300px; }
        .signed-in { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
        .signed-text { font-size:0.95rem; color:var(--muted); }
        .signed-text span { color:var(--text); font-weight:600; }
        .auth-grid { display:grid; gap:12px; }
        .magic-link { display:grid; gap:10px; }
        input { width:100%; min-width:0; border-radius:14px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.08); color:var(--text); padding:12px 14px; font-size:0.95rem; outline:none; transition: border-color 180ms ease, box-shadow 180ms ease; }
        input:focus { border-color: rgba(56,189,248,0.75); box-shadow:0 0 0 4px rgba(56,189,248,0.12); }
        .btn { min-height:44px; font-weight:700; border:none; border-radius:14px; padding:12px 18px; cursor:pointer; transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease; }
        .btn:hover { transform: translateY(-1px); box-shadow:0 18px 40px rgba(14,165,255,0.16); }
        .btn:disabled { opacity:0.7; cursor:not-allowed; transform:none; box-shadow:none; }
        .btn.primary { background:linear-gradient(135deg,#0ea5ff,#2563eb); color:#fff; }
        .btn.google { background:linear-gradient(135deg,#4285f4,#1a73e8); color:#fff; }
        .btn.secondary { background: rgba(255,255,255,0.08); color:var(--text); border:1px solid rgba(255,255,255,0.14); }
        .hint { font-size:0.88rem; color:var(--muted); }
        .auth-note { border-radius:14px; padding:12px 14px; font-size:0.9rem; line-height:1.4; }
        .auth-note.success { background:rgba(56,189,248,0.14); color:#d2f3ff; }
        .auth-note.error { background:rgba(248,113,113,0.16); color:#ffd4d4; }
        select { width:100%; appearance:none; border-radius:14px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.08); color:var(--text); padding:12px 14px; font-size:0.95rem; }
        .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }

        @media (max-width:900px) {
          .site-header { flex-direction:column; align-items:stretch; padding:20px 22px; gap:18px; }
          .controls { justify-content:stretch; min-width:auto; width:100%; }
          .theme-switch { width:100%; }
          .auth-area { min-width:auto; }
          .auth-grid { display:grid; gap:14px; }
          .magic-link { grid-template-columns:1fr; }
        }

        @media (max-width:600px) {
          .site-header { padding:18px 18px; }
          .brand { width:100%; }
          .controls { gap:14px; }
          .btn { width:100%; }
          .signed-in { justify-content:space-between; }
        }
      `}</style>
    </header>
  );
}
