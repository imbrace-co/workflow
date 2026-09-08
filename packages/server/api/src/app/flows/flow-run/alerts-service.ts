import { FastifyBaseLogger } from 'fastify'

// Community edition: alerts are an enterprise feature. This is a no-op and is
// never invoked in community (guarded by a paid-edition check at the call site).
export const alertsService = (_log: FastifyBaseLogger) => ({
    async sendAlertOnRunFinish(_params: unknown): Promise<void> {
        // no-op
    },
})
