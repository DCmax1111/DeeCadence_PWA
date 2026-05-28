export async function logAudit(supabaseAdmin, record) {
  if (!supabaseAdmin || !record) return;
  try {
    await supabaseAdmin.from('audit_logs').insert([record]);
  } catch (err) {
    // Non-fatal: keep the main request alive even if audit logging fails.
    console.error('Audit log failed', err?.message || err);
  }
}

export function buildAuditRecord({ userId, entityType, entityId, action, oldValues, newValues, req }) {
  return {
    user_id: userId,
    entity_type: entityType,
    entity_id: entityId,
    action,
    old_values: oldValues || null,
    new_values: newValues || null,
    ip_address: req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.socket?.remoteAddress || null,
    user_agent: req?.headers?.['user-agent'] || null,
    created_at: new Date().toISOString()
  };
}
