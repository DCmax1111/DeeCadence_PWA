import { withStrictRateLimit } from '../../lib/rateLimit.js';
import { logAudit, buildAuditRecord } from '../../lib/auditLog.js';
import {
  getAuthenticatedUserFromRequest,
  getServerSupabase,
  hasServerSupabaseConfig
} from '../../lib/serverSupabase.js';

const ENTRY_TYPES = new Set(['income', 'expense', 'transfer']);

function sanitizeEntry(input, userId) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be a positive number');
  }
  if (!ENTRY_TYPES.has(input.entry_type)) {
    throw new Error('Invalid entry type');
  }
  if (!input.entry_date || Number.isNaN(Date.parse(input.entry_date))) {
    throw new Error('Invalid entry date');
  }
  return {
    user_id: userId,
    entry_type: input.entry_type,
    amount,
    currency: input.currency || 'NGN',
    description: input.description || null,
    category: input.category || null,
    entry_date: input.entry_date,
    notes: input.notes || null,
    tags: Array.isArray(input.tags) ? input.tags : []
  };
}

async function handler(req, res) {
  try {
    if (!hasServerSupabaseConfig()) {
      return res.status(500).json({ error: 'Supabase server environment is not configured' });
    }

    const user = await getAuthenticatedUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const supabaseAdmin = getServerSupabase();
    const { method } = req;
    if (method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('ledger_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ data });
    }

    if (method === 'POST') {
      const payload = sanitizeEntry(req.body || {}, user.id);
      const { data, error } = await supabaseAdmin.from('ledger_entries').insert([payload]).select();
      if (error) throw error;
      await logAudit(supabaseAdmin, buildAuditRecord({
        userId: user.id,
        entityType: 'ledger_entry',
        entityId: data?.[0]?.id || null,
        action: 'create',
        newValues: data?.[0] || null,
        req
      }));
      return res.status(201).json({ data });
    }

    if (method === 'PUT') {
      const payload = req.body;
      if (!payload.id) return res.status(400).json({ error: 'Missing id' });
      const { id, ...rest } = payload;
      const existing = await supabaseAdmin
        .from('ledger_entries')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing.error || !existing.data) {
        return res.status(404).json({ error: 'Ledger entry not found' });
      }

      const sanitized = sanitizeEntry(rest, user.id);
      const { data, error } = await supabaseAdmin
        .from('ledger_entries')
        .update(sanitized)
        .eq('id', id)
        .eq('user_id', user.id)
        .select();
      if (error) throw error;
      await logAudit(supabaseAdmin, buildAuditRecord({
        userId: user.id,
        entityType: 'ledger_entry',
        entityId: id,
        action: 'update',
        oldValues: existing.data,
        newValues: data?.[0] || null,
        req
      }));
      return res.status(200).json({ data });
    }

    if (method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing id' });

      const existing = await supabaseAdmin
        .from('ledger_entries')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing.error || !existing.data) {
        return res.status(404).json({ error: 'Ledger entry not found' });
      }

      const { data, error } = await supabaseAdmin
        .from('ledger_entries')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .select();
      if (error) throw error;
      await logAudit(supabaseAdmin, buildAuditRecord({
        userId: user.id,
        entityType: 'ledger_entry',
        entityId: id,
        action: 'delete',
        oldValues: existing.data,
        req
      }));
      return res.status(200).json({ data });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${method} Not Allowed`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
}

export default withStrictRateLimit(handler);
