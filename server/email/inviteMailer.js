import nodemailer from "nodemailer";

export function createInviteMailer(env = process.env, logger = console) {
  const from = env.INVITE_EMAIL_FROM ?? env.SMTP_FROM ?? "Northwatch <no-reply@northwatch.app>";
  const hasSmtp = Boolean(env.SMTP_HOST);
  const transporter = hasSmtp
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: Number(env.SMTP_PORT ?? 587),
        secure: env.SMTP_SECURE === "true",
        auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
      })
    : null;

  return {
    async sendTeamInvite({ to, teamName, inviterName, role, acceptUrl }) {
      const subject = `${inviterName} invited you to ${teamName} on Northwatch`;
      const text = [
        `${inviterName} invited you to join ${teamName} as ${role}.`,
        "",
        `Accept the invite: ${acceptUrl}`,
        "",
        "This invite expires after 48 hours."
      ].join("\n");
      const html = [
        `<p>${escapeHtml(inviterName)} invited you to join <strong>${escapeHtml(teamName)}</strong> as <strong>${escapeHtml(role)}</strong>.</p>`,
        `<p><a href="${escapeHtml(acceptUrl)}">Accept invite</a></p>`,
        "<p>This invite expires after 48 hours.</p>"
      ].join("");

      if (!transporter) {
        logger.info(`[northwatch] Team invite email for ${to}: ${acceptUrl}`);
        return { delivered: false, logged: true, reason: "not_configured" };
      }

      await transporter.sendMail({ from, to, subject, text, html });
      return { delivered: true, logged: false, reason: "sent" };
    }
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
