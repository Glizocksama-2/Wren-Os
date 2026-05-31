import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nodemailerMocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn()
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: nodemailerMocks.createTransport
  }
}));

import { createInviteMailer } from "./inviteMailer.js";

const invitePayload = {
  to: "teammate@example.com",
  teamName: "Gorosei",
  inviterName: "Sam",
  role: "member",
  acceptUrl: "https://northwatch.app/invite/11111111-1111-4111-8111-111111111111"
};

describe("createInviteMailer", () => {
  beforeEach(() => {
    nodemailerMocks.createTransport.mockReset();
    nodemailerMocks.sendMail.mockReset();
    nodemailerMocks.createTransport.mockReturnValue({ sendMail: nodemailerMocks.sendMail });
    nodemailerMocks.sendMail.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("logs invite links when no email provider is configured", async () => {
    const logger = { info: vi.fn() };
    const mailer = createInviteMailer({}, logger);

    const result = await mailer.sendTeamInvite(invitePayload);

    expect(result).toEqual({ delivered: false, logged: true, reason: "not_configured" });
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(invitePayload.acceptUrl));
    expect(nodemailerMocks.createTransport).not.toHaveBeenCalled();
  });

  it("sends through Resend when RESEND_API_KEY is configured without SMTP", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const mailer = createInviteMailer({
      RESEND_API_KEY: "resend-secret",
      INVITE_EMAIL_FROM: "Northwatch <no-reply@northwatch.app>"
    });

    const result = await mailer.sendTeamInvite(invitePayload);

    expect(result).toEqual({ delivered: true, logged: false, reason: "sent", provider: "resend" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer resend-secret",
          "Content-Type": "application/json"
        })
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({
      from: "Northwatch <no-reply@northwatch.app>",
      to: invitePayload.to,
      subject: "Sam invited you to Gorosei on Northwatch"
    });
    expect(body.html).toContain("Accept invite");
  });

  it("surfaces Resend failures so the invite route can show a delivery failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        statusText: "Unprocessable Entity",
        json: vi.fn().mockResolvedValue({ message: "domain is not verified" })
      })
    );
    const mailer = createInviteMailer({ RESEND_API_KEY: "resend-secret" });

    await expect(mailer.sendTeamInvite(invitePayload)).rejects.toThrow("domain is not verified");
  });

  it("keeps SMTP as the first delivery path when both SMTP and Resend are configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const mailer = createInviteMailer({
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_USER: "mailer@example.com",
      SMTP_PASS: "smtp-secret",
      RESEND_API_KEY: "resend-secret"
    });

    const result = await mailer.sendTeamInvite(invitePayload);

    expect(result).toEqual({ delivered: true, logged: false, reason: "sent", provider: "smtp" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(nodemailerMocks.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.example.com",
        port: 587,
        secure: false,
        auth: { user: "mailer@example.com", pass: "smtp-secret" }
      })
    );
    expect(nodemailerMocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: invitePayload.to }));
  });
});
