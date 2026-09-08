import { apDayjs } from '@activepieces/server-shared'
import { apId, OPEN_SOURCE_PLAN, PlatformPlan, PlatformUsageMetric } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'

// Community edition: billing/plans are an enterprise feature. Every platform
// runs on the fixed open-source plan, so this returns static limits and treats
// all limit checks as unlimited. No database row or Stripe customer is created.
function openSourcePlanFor(platformId: string): PlatformPlan {
    const now = apDayjs()
    return {
        id: apId(),
        created: now.toISOString(),
        updated: now.toISOString(),
        platformId,
        stripeSubscriptionStartDate: now.startOf('month').unix(),
        stripeSubscriptionEndDate: now.endOf('month').unix(),
        projectsLimit: null,
        activeFlowsLimit: null,
        ...OPEN_SOURCE_PLAN,
    }
}

export const platformPlanService = (_log: FastifyBaseLogger) => ({
    async getOrCreateForPlatform(platformId: string): Promise<PlatformPlan> {
        return openSourcePlanFor(platformId)
    },
    async getBillingDates(platformPlan: PlatformPlan): Promise<{ startDate: number, endDate: number }> {
        const startDate = platformPlan.stripeSubscriptionStartDate ?? apDayjs().startOf('month').unix()
        const endDate = platformPlan.stripeSubscriptionEndDate ?? apDayjs().endOf('month').unix()
        return { startDate, endDate }
    },
    async update(params: { platformId: string } & Record<string, unknown>): Promise<PlatformPlan> {
        return openSourcePlanFor(params.platformId)
    },
    async getNextBillingAmount(): Promise<number> {
        return 0
    },
    async isCloudNonEnterprisePlan(): Promise<boolean> {
        return false
    },
    checkActiveFlowsExceededLimit: async (_platformId: string, _metric: PlatformUsageMetric): Promise<void> => {
        // Community: no active-flow limit.
    },
})
