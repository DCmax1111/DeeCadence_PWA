import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { supabase } from '../lib/supabaseClient';
import AccountPanel from './AccountPanel';

export default function Ledger({ user }) {
  const [entries, setEntries] = useState([]);
  const [editEntry, setEditEntry] = useState(null);
  const [errors, setErrors] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;
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
      // fallback: show demo data so the UI remains useful during local development
      setEntries(getDemoEntries());
    } finally {
      setLoading(false);
    }
  }

  async function createEntry(e) {
    e.preventDefault();
    setFormErrors({});
    if (!user) return alert('Sign in first');

    const nextErrors = {};
    if (!form.amount || Number(form.amount) <= 0 || Number.isNaN(Number(form.amount))) {
      nextErrors.amount = 'Enter a valid positive amount';
    }
    if (!form.entry_date || Number.isNaN(Date.parse(form.entry_date))) {
      nextErrors.entry_date = 'Select a valid date';
    }
    if (Object.keys(nextErrors).length) {
      setFormErrors(nextErrors);
      return;
    }

    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const payload = { ...form, amount: parseFloat(form.amount) };
      await axios.post('/api/ledger', payload, { headers: { Authorization: `Bearer ${token}` } });
      setForm({ entry_type: 'expense', amount: '', description: '', category: '', entry_date: '' });
      setToast({ type: 'success', message: 'Entry added successfully' });
      setTimeout(() => setToast(null), 4000);
      fetchEntries();
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: 'Error creating entry' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setLoading(false);
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
      alert('Delete failed — showing demo data instead');
      setEntries(getDemoEntries());
    }
  }

  async function openEdit(entry) {
    // clone to avoid mutating list item directly
    setErrors({});
    setEditEntry({ ...entry, amount: String(Math.abs(Number(entry.amount) || 0)) });
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editEntry) return;
    if (!user) return alert('Sign in first');
    // validation
    const nextErrors = {};
    if (!editEntry.amount || Number(editEntry.amount) <= 0 || Number.isNaN(Number(editEntry.amount))) nextErrors.amount = 'Amount must be a positive number';
    if (!editEntry.entry_date || Number.isNaN(Date.parse(editEntry.entry_date))) nextErrors.entry_date = 'Enter a valid date';
    if (!['income','expense','transfer'].includes(editEntry.entry_type)) nextErrors.entry_type = 'Invalid type';
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    // if demo entry (local-only), update locally
    if (String(editEntry.id).startsWith('d')) {
      setEntries((prev) => prev.map((r) => (r.id === editEntry.id ? { ...r, ...editEntry, amount: Number(editEntry.amount) } : r)));
      setToast({ type: 'success', message: 'Entry updated (local demo)' });
      setTimeout(() => setToast(null), 3000);
      setEditEntry(null);
      return;
    }
    // optimistic update
    const prevEntries = entries.slice();
    const updated = { ...editEntry, amount: parseFloat(editEntry.amount) };
    setEntries((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setEditEntry(null);
    setToast({ type: 'info', message: 'Saving...' });
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      await axios.put('/api/ledger', updated, { headers: { Authorization: `Bearer ${token}` } });
      setToast({ type: 'success', message: 'Entry updated' });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error(err);
      // revert
      setEntries(prevEntries);
      setToast({ type: 'error', message: 'Update failed — changes reverted' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setLoading(false);
    }
  }

  function getDemoEntries() {
    return [
      { id: 'd1', entry_date: new Date().toISOString(), entry_type: 'income', category: 'Salary', amount: 2500, description: 'Demo salary' },
      { id: 'd2', entry_date: new Date().toISOString(), entry_type: 'expense', category: 'Groceries', amount: -120.5, description: 'Grocery run' },
      { id: 'd3', entry_date: new Date().toISOString(), entry_type: 'expense', category: 'Utilities', amount: -60, description: 'Electricity' }
    ];
  }

  function exportToCSV() {
    if (entries.length === 0) {
      setToast({ type: 'error', message: 'No entries to export' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    const headers = ['Date', 'Type', 'Category', 'Description', 'Amount'];
    const rows = entries.map(e => [
      new Date(e.entry_date).toLocaleDateString(),
      e.entry_type,
      e.category || '',
      e.description || '',
      e.amount
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ledger-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    setToast({ type: 'success', message: 'Ledger exported as CSV' });
    setTimeout(() => setToast(null), 3000);
  }

  const totals = useMemo(() => {
    const income = entries.filter(e => e.entry_type === 'income').reduce((s, e) => s + Number(e.amount || 0), 0);
    const expense = entries.filter(e => e.entry_type === 'expense').reduce((s, e) => s + Number(e.amount || 0), 0);
    const balance = income + expense; // assume expenses are negative if stored so
    return { income, expense, balance };
  }, [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(e => {
      if (filterType !== 'all' && e.entry_type !== filterType) return false;
      if (!q) return true;
      return (String(e.description || '').toLowerCase().includes(q) || String(e.category || '').toLowerCase().includes(q));
    });
  }, [entries, query, filterType]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  return (
    <section role="region" aria-labelledby="ledger-heading">
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
                <input
                  aria-label="amount"
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                  aria-invalid={formErrors.amount ? 'true' : 'false'}
                  aria-describedby={formErrors.amount ? 'entry-amount-error' : undefined}
                />
                {formErrors.amount && <span id="entry-amount-error" className="error">{formErrors.amount}</span>}
              </label>

              <label>
                Category
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </label>

              <label>
                Date
                <input
                  aria-label="date"
                  type="date"
                  value={form.entry_date}
                  onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
                  required
                  aria-invalid={formErrors.entry_date ? 'true' : 'false'}
                  aria-describedby={formErrors.entry_date ? 'entry-date-error' : undefined}
                />
                {formErrors.entry_date && <span id="entry-date-error" className="error">{formErrors.entry_date}</span>}
              </label>

              <label>
                Description
                <input aria-label="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>

              <div className="form-actions">
                <button aria-label="add-entry" className="btn-primary" type="submit" disabled={loading}>
                  {loading ? 'Saving…' : 'Add entry'}
                </button>
              </div>
            </form>
          </div>

          <AccountPanel user={user} entries={entries} />

          <div className="card">
            <div className="ledger-summary">
              <div>
                <div className="sum-label">Total income</div>
                <div className="sum-amount">${totals.income.toFixed(2)}</div>
              </div>
              <div>
                <div className="sum-label">Total expenses</div>
                <div className="sum-amount">${Math.abs(totals.expense).toFixed(2)}</div>
              </div>
              <div>
                <div className="sum-label">Balance</div>
                <div className="sum-amount">${totals.balance.toFixed(2)}</div>
              </div>
            </div>

            <div className="entries-toolbar">
              <h3 id="ledger-heading" style={{margin:0}}>Recent entries</h3>
              <div className="toolbar-controls">
                <input aria-label="Search entries" placeholder="Search description or category" value={query} onChange={(e)=>{ setQuery(e.target.value); setPage(1); }} />
                <label className="sr-only" htmlFor="entry-filter">Filter by entry type</label>
                <select id="entry-filter" value={filterType} onChange={(e)=>{ setFilterType(e.target.value); setPage(1); }}>
                  <option value="all">All</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="transfer">Transfer</option>
                </select>
                <button className="btn-sm" onClick={exportToCSV} title="Download ledger as CSV">📥 Export CSV</button>
              </div>
            </div>
            {loading ? (
              <div className="empty-state"><p>Loading entries…</p></div>
            ) : entries.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📝</div>
                <h4>No transactions yet</h4>
                <p>Start by adding your first income or expense entry above. Track every transaction to stay on top of your finances.</p>
              </div>
            ) : (
              <div className="entries-list">
                {paged.map((r) => (
                  <div className="entry-row" key={r.id}>
                    <div className="entry-left">
                      <div className="entry-date">{new Date(r.entry_date).toLocaleDateString()}</div>
                      <div className="entry-desc">{r.description}</div>
                      <div className="entry-meta">{r.entry_type} • {r.category}</div>
                    </div>
                    <div className="entry-right">
                      <div className={`entry-amount ${r.entry_type === 'income' ? 'pos' : 'neg'}`}>${Number(r.amount).toFixed(2)}</div>
                      <div className="entry-actions">
                        <button className="btn-sm" onClick={() => openEdit(r)}>Edit</button>
                        <button className="btn-sm" onClick={() => deleteEntry(r.id)}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="pagination-row">
              <div className="result-count">Showing {filtered.length} results</div>
              <div className="pagination-controls">
                <button className="btn-sm" onClick={()=>setPage(Math.max(1, page-1))} disabled={page===1} aria-label="Previous page">Prev</button>
                <div className="page-indicator" aria-live="polite">{page} / {totalPages}</div>
                <button className="btn-sm" onClick={()=>setPage(Math.min(totalPages, page+1))} disabled={page===totalPages} aria-label="Next page">Next</button>
              </div>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className={`toast ${toast.type}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}

      {/* Edit modal */}
      {editEntry && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-entry-title">
          <div className="modal">
            <h4 id="edit-entry-title">Edit entry</h4>
            <form onSubmit={saveEdit} className="edit-form">
              <label>
                Type
                <select aria-label="Entry type" value={editEntry.entry_type} onChange={(e) => setEditEntry({ ...editEntry, entry_type: e.target.value })}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfer</option>
                </select>
              </label>

              <label>
                Amount
                <input aria-label="Edit amount" type="number" step="0.01" value={editEntry.amount} onChange={(e) => setEditEntry({ ...editEntry, amount: e.target.value })} required aria-invalid={errors.amount ? 'true' : 'false'} aria-describedby={errors.amount ? 'edit-amount-error' : undefined} />
                {errors.amount && <span id="edit-amount-error" className="error">{errors.amount}</span>}
              </label>

              <label>
                Category
                <input value={editEntry.category || ''} onChange={(e) => setEditEntry({ ...editEntry, category: e.target.value })} />
              </label>

              <label>
                Date
                <input aria-label="Edit date" type="date" value={new Date(editEntry.entry_date).toISOString().slice(0,10)} onChange={(e) => setEditEntry({ ...editEntry, entry_date: e.target.value })} required aria-invalid={errors.entry_date ? 'true' : 'false'} aria-describedby={errors.entry_date ? 'edit-date-error' : undefined} />
                {errors.entry_date && <span id="edit-date-error" className="error">{errors.entry_date}</span>}
              </label>

              <label>
                Description
                <input value={editEntry.description || ''} onChange={(e) => setEditEntry({ ...editEntry, description: e.target.value })} />
              </label>

              <div className="form-actions">
                <button type="button" className="btn-sm" onClick={() => setEditEntry(null)}>Cancel</button>
                <button className="btn-primary" type="submit">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .card { background: rgba(255,255,255,0.02); padding:18px; border-radius:14px; margin-bottom:18px; border:1px solid rgba(255,255,255,0.04); }
        .entry-form { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap:12px; }
        .toast { position:fixed; right:20px; bottom:20px; padding:10px 14px; border-radius:10px; color:#fff; z-index:1200; box-shadow:0 6px 20px rgba(0,0,0,0.4); }
        .toast.info { background:linear-gradient(90deg,#60a5fa,#3b82f6); }
        .toast.success { background:linear-gradient(90deg,#34d399,#10b981); }
        .toast.error { background:linear-gradient(90deg,#fb7185,#ef4444); }
        label { display:flex; flex-direction:column; font-size:0.92rem; color:var(--muted); }
        input, select { padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.06); background:transparent; color:var(--text); }
        .form-actions { grid-column: 1 / -1; display:flex; justify-content:flex-end; }
        .btn-primary { background:linear-gradient(135deg,#0ea5ff,#2563eb); color:#fff; padding:10px 14px; border-radius:10px; border:none; cursor:pointer; }
        .entries-table { width:100%; border-collapse:collapse; }
        th, td { padding:10px 8px; text-align:left; }
        tr { border-bottom:1px solid rgba(255,255,255,0.03); }
        .btn-sm { background:transparent; border:1px solid rgba(255,255,255,0.06); color:var(--text); padding:6px 8px; border-radius:8px; cursor:pointer; }
        .entries-list { display:flex; flex-direction:column; gap:10px; }
        .entry-row { display:flex; justify-content:space-between; align-items:center; padding:12px; border-radius:10px; background:linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.00)); }
        .entry-left { display:flex; flex-direction:column; }
        .entry-amount { font-weight:700; }
        .entry-amount.pos { color: #10b981; }
        .entry-amount.neg { color: #ef4444; }
        .entries-toolbar { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:16px; flex-wrap:wrap; }
        .toolbar-controls { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
        .toolbar-controls input,
        .toolbar-controls select { min-width:180px; padding:10px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.06); background:transparent; color:var(--text); }
        .pagination-row { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-top:10px; flex-wrap:wrap; }
        .result-count { color:var(--muted); }
        .pagination-controls { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
        .page-indicator { padding:6px 10px; border-radius:8px; background:rgba(255,255,255,0.02); }

        @media (max-width:760px) {
          .entry-row { flex-direction:column; align-items:flex-start; }
          .entry-right { width:100%; display:flex; justify-content:space-between; align-items:center; margin-top:12px; }
          .entries-toolbar { flex-direction:column; align-items:stretch; }
          .toolbar-controls { width:100%; }
          .pagination-row { flex-direction:column; align-items:stretch; }
          .page-indicator { margin-left:auto; }
        }

        @media (max-width:520px) {
          .entry-form { grid-template-columns: 1fr; }
          .form-actions { justify-content:center; }
          .edit-form { grid-template-columns: 1fr; }
          .modal { width: calc(100% - 32px); }
        }

        /* modal */
        .modal-backdrop { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.5); z-index:999; }
        .modal { background:var(--card-bg, #0b1220); padding:18px; border-radius:12px; width:min(760px, 96%); border:1px solid rgba(255,255,255,0.04); }
        .edit-form { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px,1fr)); gap:10px; }
        .error { color: #ffbaba; font-size:0.85rem; margin-top:6px; }
        .toast { position:fixed; right:20px; bottom:20px; padding:10px 14px; border-radius:10px; color:#fff; z-index:1200; box-shadow:0 6px 20px rgba(0,0,0,0.4); }
        .toast.info { background:linear-gradient(90deg,#60a5fa,#3b82f6); }
        .toast.success { background:linear-gradient(90deg,#34d399,#10b981); }
        .toast.error { background:linear-gradient(90deg,#fb7185,#ef4444); }
        .empty-state { text-align:center; padding:60px 20px; }
        .empty-icon { font-size:3rem; margin-bottom:14px; }
        .empty-state h4 { font-size:1.25rem; font-weight:700; margin:14px 0 8px; }
        .empty-state p { font-size:0.95rem; color:var(--muted); max-width:400px; margin:0 auto; line-height:1.6; }
      `}</style>
    </section>
  );
}
