import { FastifyBaseLogger } from 'fastify'

// Community edition: OTP (email verification / password reset codes) is an
// enterprise feature. This is a no-op.
export const otpService = (_log: FastifyBaseLogger) => ({
    async createAndSend(_params: unknown): Promise<void> {
        // no-op
    },
})
