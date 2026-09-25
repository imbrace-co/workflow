import { assertNotNullOrUndefined, PrincipalType, UserWithMetaInformationAndProject } from '@activepieces/shared'
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { StatusCodes } from 'http-status-codes'
import { userIdentityService } from '../../authentication/user-identity/user-identity-service'
import { userService } from '../user-service'

// Community port of the enterprise-only GET /v1/users/me (previously
// packages/server/api/src/app/ee/users/users-controller.ts). The dashboard
// embedding flow used by iMBrace's own frontend (dashboard-auto-login.ts /
// DashboardAccessTokenAuthnHandler) calls this to resolve the current
// principal's platformId/projectId — it isn't an enterprise-gated feature,
// just code that lived under app/ee/ and was stripped along with the rest of
// that directory when the OSS edition was cut, orphaning this call site.
export const meController: FastifyPluginAsyncTypebox = async (app) => {
    app.get('/me', GetCurrentUserRequest, async (req): Promise<UserWithMetaInformationAndProject> => {
        const userId = req.principal.id
        assertNotNullOrUndefined(userId, 'userId')

        const user = await userService.getOneOrFail({ id: userId })
        const identity = await userIdentityService(app.log).getOneOrFail({ id: user.identityId })

        return {
            id: user.id,
            platformRole: user.platformRole,
            status: user.status,
            externalId: user.externalId,
            created: user.created,
            updated: user.updated,
            platformId: user.platformId,
            firstName: identity.firstName,
            lastName: identity.lastName,
            email: identity.email,
            trackEvents: identity.trackEvents,
            newsLetter: identity.newsLetter,
            verified: identity.verified,
            projectId: req.principal.projectId,
        }
    })
}

const GetCurrentUserRequest = {
    schema: {
        response: {
            [StatusCodes.OK]: UserWithMetaInformationAndProject,
        },
    },
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
    },
}
