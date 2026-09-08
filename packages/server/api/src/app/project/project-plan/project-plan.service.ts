import { FastifyBaseLogger } from 'fastify'

// Community edition: per-project plan limits (AI credits, quotas) are an
// enterprise feature. Nothing is limited here.
export const projectLimitsService = (_log: FastifyBaseLogger) => ({
    async checkAICreditsExceededLimit(_params: { projectId: string, requestCostBeforeFiring: number }): Promise<boolean> {
        return false
    },
})
