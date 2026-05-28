import { useEffect, useState } from 'react';
import axios from 'axios';
import { supabase } from '../lib/supabaseClient';

export default function Ledger({ user }) {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({ entry_type: 'expense', amount: '', description: '', category: '', entry_date: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) fetchEntries();
  }, [user]);

  async function fetchEntries() {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await axios.get('/api/ledger', { headers: { Authorization: `Bearer ${token}` } });
      setEntries(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function createEntry(e) {
    e.preventDefault();
    if (!user) return alert('Sign in first');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const payload = { ...form, amount: parseFloat(form.amount) };
      await axios.post('/api/ledger', payload, { headers: { Authorization: `Bearer ${token}` } });
      setForm({ entry_type: 'expense', amount: '', description: '', category: '', entry_date: '' });
      fetchEntries();
    } catch (err) {
      console.error(err);
      alert('Error creating entry');
    }
  }

  async function deleteEntry(id) {
    if (!confirm('Delete this entry?')) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      await axios.delete('/api/ledger', { params: { id }, headers: { Authorization: `Bearer ${token}` } });
      fetchEntries();
    } catch (err) {
      console.error(err);
      alert('Delete failed');
    }
  }

  return (
    <section>
      {!user ? (
        <div className="card">Sign in to manage your ledger.</div>
      ) : (
        <>
          <div className="card">
            <form onSubmit={createEntry} className="entry-form">
              <label>
                Type
                <select value={form.entry_type} onChange={(e) => setForm({ ...form, entry_type: e.target.value })}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfer</option>
                </select>
              </label>

              <label>
                Amount
                <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
              </label>

              <label>
                Category
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </label>

              <label>
                Date
                <input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} required />
              </label>

              <label>
                Description
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>

              <div className="form-actions">
                <button className="btn-primary" type="submit">Add entry</button>
              </div>
            </form>
          </div>

          <div className="card">
            <h3>Recent entries</h3>
            {loading ? <p>Loading...</p> : entries.length === 0 ? <p>No entries yet</p> : (
              <table className="entries-table">
                <thead>
                  <tr><th>Date</th><th>Type</th><th>Category</th><th>Amount</th><th></th></tr>
                </thead>
                <tbody>
                  {entries.map((r) => (
                    <tr key={r.id}>
                      <td>{new Date(r.entry_date).toLocaleDateString()}</td>
                      <td>{r.entry_type}</td>
                      <td>{r.category}</td>
                      <td>{r.amount}</td>
                      <td><button className="btn-sm" onClick={() => deleteEntry(r.id)}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <style jsx>{`
        .card { background: rgba(255,255,255,0.02); padding:18px; border-radius:14px; margin-bottom:18px; border:1px solid rgba(255,255,255,0.04); }
        .entry-form { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap:12px; }
        label { display:flex; flex-direction:column; font-size:0.92rem; color:var(--muted); }
        input, select { padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.06); background:transparent; color:var(--text); }
        .form-actions { grid-column: 1 / -1; display:flex; justify-content:flex-end; }
        .btn-primary { background:linear-gradient(135deg,#0ea5ff,#2563eb); color:#fff; padding:10px 14px; border-radius:10px; border:none; cursor:pointer; }
        .entries-table { width:100%; border-collapse:collapse; }
        th, td { padding:10px 8px; text-align:left; }
        tr { border-bottom:1px solid rgba(255,255,255,0.03); }
        .btn-sm { background:transparent; border:1px solid rgba(255,255,255,0.06); color:var(--text); padding:6px 8px; border-radius:8px; cursor:pointer; }
      `}</style>
    </section>
  );
}
