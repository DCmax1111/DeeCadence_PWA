import { createClient } from '@supabase/supabase-js';
import { withStrictRateLimit } from '../../../lib/rateLimit.js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const VALID_OUTCOMES = new Set(['succeeded', 'failed']);

function isOwnerRequest(req) {
  const expectedToken = process.env.OWNER_ADMIN_TOKEN;
  const receivedToken = req.headers['x-owner-token'];
  return Boolean(expectedToken && receivedToken && receivedToken === expectedToken);
}

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

async function listPayments(req, res) {
  const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
  const allowedStatuses = ['pending', 'succeeded', 'failed', 'expired'];
  const safeStatus = allowedStatuses.includes(status) ? status : 'pending';

  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('id, user_id, provider_transaction_id, amount, currency, status, metadata, created_at, updated_at')
    .eq('provider', 'manual_bank')
    .eq('transaction_type', 'subscription')
    .eq('status', safeStatus)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('List manual payments failed', error);
    return res.status(500).json({ error: 'Unable to list payments' });
  }

  return res.status(200).json({ payments: data || [] });
}

async function activateSubscription(transaction, ownerNote) {
  const metadata = transaction.metadata || {};
  const planSlug = metadata.plan_id;

  const { data: plan, error: planError } = await supabaseAdmin
    .from('plans')
    .select('id, tier')
    .eq('product', 'finance')
    .eq('tier', planSlug)
    .maybeSingle();

  if (planError || !plan) {
    return {
      activated: false,
      warning: 'Payment marked succeeded, but no matching finance plan exists in public.plans.',
    };
  }

  await supabaseAdmin
    .from('profiles')
    .upsert({ id: transaction.user_id, subscription_plan: plan.tier }, { onConflict: 'id' });

  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const { error: subscriptionError } = await supabaseAdmin
    .from('subscriptions')
    .upsert(
      {
        user_id: transaction.user_id,
        plan_id: plan.id,
        status: 'active',
        provider: 'manual_bank',
        provider_subscription_id: `manual-${transaction.provider_transaction_id}`,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        metadata: {
          source_transaction_id: transaction.id,
          owner_note: ownerNote || null,
          confirmed_at: periodStart.toISOString(),
        },
        updated_at: periodStart.toISOString(),
      },
      { onConflict: 'provider,provider_subscription_id' }
    );

  if (subscriptionError) {
    console.error('Manual subscription activation failed', subscriptionError);
    return {
      activated: false,
      warning: 'Payment marked succeeded, but subscription activation failed.',
    };
  }

  return { activated: true };
}

async function verifyPayment(req, res) {
  const { paymentId, status, ownerNote } = req.body || {};
  const safeNote = typeof ownerNote === 'string' ? ownerNote.slice(0, 500) : '';

  if (!paymentId || !VALID_OUTCOMES.has(status)) {
    return res.status(400).json({ error: 'paymentId and a valid status are required' });
  }

  const { data: transaction, error: fetchError } = await supabaseAdmin
    .from('transactions')
    .select('*')
    .eq('id', paymentId)
    .eq('provider', 'manual_bank')
    .maybeSingle();

  if (fetchError || !transaction) {
    return res.status(404).json({ error: 'Payment not found' });
  }

  const now = new Date().toISOString();
  const metadata = {
    ...(transaction.metadata || {}),
    owner_verification: {
      status,
      note: safeNote || null,
      verified_at: now,
    },
  };

  const { error: updateError } = await supabaseAdmin
    .from('transactions')
    .update({
      status,
      metadata,
      error_message: status === 'failed' ? safeNote || 'Manual verification failed' : null,
      updated_at: now,
    })
    .eq('id', paymentId)
    .eq('provider', 'manual_bank');

  if (updateError) {
    console.error('Manual payment verification failed', updateError);
    return res.status(500).json({ error: 'Unable to update payment' });
  }

  let activation = { activated: false };
  if (status === 'succeeded') {
    activation = await activateSubscription(transaction, safeNote);
  }

  return res.status(200).json({ ok: true, status, activation });
}

export default withStrictRateLimit(async function handler(req, res) {
  if (!isOwnerRequest(req)) {
    return unauthorized(res);
  }

  if (req.method === 'GET') {
    return listPayments(req, res);
  }

  if (req.method === 'POST') {
    return verifyPayment(req, res);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method not allowed' });
});
