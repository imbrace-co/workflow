import { FastifyBaseLogger } from 'fastify'

// Community edition: transactional email (SMTP) is an enterprise feature. These
// are no-ops; SMTP always reports as not configured so email steps are skipped.
export const emailService = (_log: FastifyBaseLogger) => ({
    async sendInvitation(_params: unknown): Promise<void> {
        // no-op
    },
    async sendIssueCreatedNotification(_params: unknown): Promise<void> {
        // no-op
    },
    async sendIssuesSummary(_params: unknown): Promise<void> {
        // no-op
    },
    async sendOtp(_params: unknown): Promise<void> {
        // no-op
    },
})

export const smtpEmailSender = (_log: FastifyBaseLogger) => ({
    isSmtpConfigured(_platform: unknown): boolean {
        return false
    },
    async validateOrThrow(_smtp: unknown): Promise<void> {
        // no-op: nothing to validate when SMTP is unavailable
    },
})
