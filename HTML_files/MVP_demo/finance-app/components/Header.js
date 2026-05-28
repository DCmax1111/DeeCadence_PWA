import { supabase } from '../lib/supabaseClient';

export default function Header({ user, theme, setTheme }) {
  async function signIn() {
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) console.error(error);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  return (
    <header className="site-header">
      <div className="brand">
        <div className="logo" />
        <div>
          <div className="title">DeeCash</div>
          <div className="subtitle">Ledger & bookkeeping</div>
        </div>
      </div>

      <div className="controls">
        <div className="theme-switch">
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div>
          {user ? (
            <button className="btn" onClick={signOut}>Sign out</button>
          ) : (
            <button className="btn" onClick={signIn}>Sign in</button>
          )}
        </div>
      </div>

      <style jsx>{`
        .site-header { display:flex; align-items:center; justify-content:space-between; padding:18px 24px; border-bottom:1px solid rgba(255,255,255,0.04); }
        .brand { display:flex; gap:12px; align-items:center; }
        .logo { width:52px; height:52px; border-radius:10px; background:linear-gradient(135deg,#0ea5ff,#3b82f6); box-shadow:0 8px 24px rgba(59,130,246,0.18); }
        .title { font-weight:700; }
        .subtitle { font-size:0.85rem; color:var(--muted); }
        .controls { display:flex; gap:12px; align-items:center; }
        .btn { background:linear-gradient(135deg,#0ea5ff,#2563eb); color:#fff; border:none; padding:10px 12px; border-radius:8px; cursor:pointer; }
        select { padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.06); background:transparent; color:var(--text); }
      `}</style>
    </header>
  );
}
