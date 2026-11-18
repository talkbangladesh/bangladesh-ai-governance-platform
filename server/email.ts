type InviteEmailInput = { to: string; assessmentTitle: string; inviteUrl: string; expiresAt: Date; scope: string };

export async function sendReviewerInviteEmail(input: InviteEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { status: "EMAIL_NOT_CONFIGURED" as const };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `Bangladesh AI Readiness Assessment reviewer invitation — ${input.assessmentTitle}`,
      html: `<p>You have been invited to review <strong>${escapeHtml(input.assessmentTitle)}</strong> in Bangladesh AI Readiness Assessment.</p><p>Scope: ${escapeHtml(input.scope)}</p><p><a href="${escapeHtml(input.inviteUrl)}">Open secure review invitation</a></p><p>This one-time invitation expires on ${input.expiresAt.toISOString()}.</p>`,
    }),
  });
  if (!response.ok) return { status: "EMAIL_FAILED" as const, detail: await response.text() };
  return { status: "EMAIL_SENT" as const };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char);
}
