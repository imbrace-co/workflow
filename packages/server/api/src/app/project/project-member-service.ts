import { SeekPage } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'

// Community edition: project members (multi-user projects) are an enterprise
// feature. Every project has a single owner, so there are no additional members.
const EMPTY_PAGE: SeekPage<never> = { data: [], next: null, previous: null }

export const projectMemberService = (_log: FastifyBaseLogger) => ({
    async list(_params: unknown): Promise<SeekPage<never>> {
        return EMPTY_PAGE
    },
    async getIdsOfProjects(_params: { platformId: string, userId: string }): Promise<string[]> {
        return []
    },
    async upsert(_params: unknown): Promise<void> {
        // no-op: community has no additional project members
    },
})

// Community edition: no additional project members exist. `find` always returns
// an empty list; this is only reached on the non-community branch.
export const projectMemberRepo = () => ({
    async find(_params: unknown): Promise<{ userId: string }[]> {
        return []
    },
})
