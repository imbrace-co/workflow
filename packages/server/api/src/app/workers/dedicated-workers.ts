import { PlatformPlan } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'

// Community edition: dedicated workers are an enterprise (cloud) feature, so
// this is a no-op that reports none configured.
export const dedicatedWorkers = (_log: FastifyBaseLogger) => ({
    async getPlatformIds(): Promise<string[]> {
        return []
    },
    async isEnabledForPlatform(_platformId: string): Promise<boolean> {
        return false
    },
    async getWorkerConfig(_platformId: string): Promise<PlatformPlan['dedicatedWorkers']> {
        return null
    },
})
