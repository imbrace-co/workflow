import { PlatformUsage, SeekPage } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'

// Community edition: usage metering (AI credits, quotas) is an enterprise
// feature. Nothing is metered, so usage always reads as zero.
const EMPTY_PAGE: SeekPage<unknown> = { data: [], next: null, previous: null }

export const platformUsageService = (_log: FastifyBaseLogger) => ({
    async getAllPlatformUsage(_platformId: string): Promise<PlatformUsage> {
        return { aiCredits: 0, activeFlows: 0 }
    },
    async resetPlatformUsage(_platformId: string): Promise<void> {
        // no-op
    },
    async increaseAiCreditUsage(_params: unknown): Promise<{ projectAiCreditUsage: number, platformAiCreditUsage: number }> {
        return { projectAiCreditUsage: 0, platformAiCreditUsage: 0 }
    },
    async getPlatformUsage(_params: unknown): Promise<number> {
        return 0
    },
    async getProjectUsage(_params: unknown): Promise<number> {
        return 0
    },
    async listAICreditsUsage(_params: unknown): Promise<SeekPage<unknown>> {
        return EMPTY_PAGE
    },
})
