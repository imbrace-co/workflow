import { FastifyBaseLogger } from 'fastify'

// Community edition: Stripe billing is an enterprise feature. No-op.
export const stripeHelper = (_log: FastifyBaseLogger) => ({
    async deleteCustomer(_subscriptionId: string): Promise<void> {
        // no-op
    },
})
