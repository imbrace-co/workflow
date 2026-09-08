import { FastifyBaseLogger } from 'fastify'

// Community edition: federated authentication (SSO third-party providers) is an
// enterprise feature. No third-party login is configured.
export const federatedAuthnService = (_log: FastifyBaseLogger) => ({
    async getThirdPartyRedirectUrl(_platformId: string | undefined): Promise<string | undefined> {
        return undefined
    },
})
