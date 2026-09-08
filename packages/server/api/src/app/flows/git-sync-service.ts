import { GitPushOperationType } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'

// Community edition: git sync (project releases) is an enterprise feature. Core
// only invokes `onDeleted` (to mirror deletions into a connected repo), which is
// a no-op when git sync is unavailable.
export const gitRepoService = (_log: FastifyBaseLogger) => ({
    async onDeleted(_params: {
        type: GitPushOperationType
        externalId: string
        userId: string
        projectId: string
        platformId: string
        log: FastifyBaseLogger
    }): Promise<void> {
        // no-op
    },
})
