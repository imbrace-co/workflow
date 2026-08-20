import { ActivepiecesError, apId, assertNotNullOrUndefined, EnginePrincipal, ErrorCode, isNil, PlatformId, PlatformRole, Principal, PrincipalType, ProjectId, ProjectType, UserIdentityProvider, UserStatus, WorkerPrincipal } from '@activepieces/shared'
import dayjs from 'dayjs'
import { jwtUtils } from '../../helper/jwt-utils'
import { system } from '../../helper/system/system'
import { userRepo, userService } from '../../user/user-service'
import { userIdentityService } from '../user-identity/user-identity-service'
import { AppSystemProp, environmentVariables } from 'packages/server/shared/src/lib/system-props'
import { projectService } from '../../project/project-service'

export const accessTokenManager = {
    async generateToken(principal: Principal, expiresInSeconds: number = dayjs.duration(7, 'day').asSeconds()): Promise<string> {
        const secret = await jwtUtils.getJwtSecret()
        return jwtUtils.sign({
            payload: principal,
            key: secret,
            expiresInSeconds,
        })
    },

    async generateEngineToken({ jobId, projectId, platformId }: GenerateEngineTokenParams): Promise<string> {
        const enginePrincipal: EnginePrincipal = {
            id: jobId ?? apId(),
            type: PrincipalType.ENGINE,
            projectId,
            platform: {
                id: platformId,
            },
        }

        const secret = await jwtUtils.getJwtSecret()

        return jwtUtils.sign({
            payload: enginePrincipal,
            key: secret,
            expiresInSeconds: dayjs.duration(100, 'year').asSeconds(),
        })
    },

    async generateWorkerToken(): Promise<string> {
        const workerPrincipal: WorkerPrincipal = {
            id: apId(),
            type: PrincipalType.WORKER,
        }

        const secret = await jwtUtils.getJwtSecret()

        return jwtUtils.sign({
            payload: workerPrincipal,
            key: secret,
            expiresInSeconds: dayjs.duration(100, 'year').asSeconds(),
        })
    },

    async findOrCreateProject(organizationId: string, platformId: string, ownerId: string) {
        // Try to find existing project by organization ID using external ID
        let project = await projectService.getByPlatformIdAndExternalId({
            platformId,
            externalId: organizationId,
        })

        if (isNil(project)) {
            // Create new project for this organization
            console.log('Dashboard Gateway Auth: Creating new project for organization', organizationId)

            const projectDisplayName = `Organization ${organizationId}`
            project = await projectService.create({
                ownerId: ownerId, // First user from organization becomes the project owner
                displayName: projectDisplayName,
                platformId: platformId,
                externalId: organizationId, // Store organization ID as external ID for mapping,
                type: ProjectType.TEAM,
            })
        }

        return project
    },

    async findOrCreateUserById(externalUserId: string, platformId: string) {
        // Try to find existing user by external user ID using the userRepo query pattern
        const existingUser = await userRepo().findOneBy({
            externalId: externalUserId,
            platformId
        })

        if (existingUser) {
            return existingUser
        }

        // Create new user identity first
        console.log('Dashboard Gateway Auth: Creating new user identity for external user ID', externalUserId)

        const userIdentity = await userIdentityService(system.globalLogger()).create({
            email: `${externalUserId}@external.local`, // Placeholder email
            firstName: 'Dashboard',
            lastName: 'User',
            trackEvents: true,
            newsLetter: false,
            password: '', // No password for external users
            provider: UserIdentityProvider.JWT,
            verified: true, // External users are pre-verified by dashboard
        })

        // Create new user in the shared platform
        console.log('Dashboard Gateway Auth: Creating new user in shared platform', { externalUserId, platformId })

        const user = await userService.create({
            identityId: userIdentity.id,
            platformRole: PlatformRole.MEMBER, // Dashboard users are members, not admins
            platformId,
            externalId: externalUserId,
        })

        return user
    },


    async verifyPrincipal(token: string, org_id?: string): Promise<Principal> {

        if (org_id) {
            const platformId = environmentVariables.getEnvironment(AppSystemProp.SHARED_PLATFORM_ID) ?? "";

            const effectiveUserId = `org-user-${org_id}`
            console.log('Dashboard Gateway Auth: Finding or creating user for ID', effectiveUserId)
            const user = await this.findOrCreateUserById(effectiveUserId, platformId)

            // Find or create project for the organization
            console.log('Dashboard Gateway Auth: Finding or creating project for organization', org_id)
            const project = await this.findOrCreateProject(org_id, platformId, user.id)
            const principal: Principal = {
                id: user.id,
                type: PrincipalType.USER,
                projectId: project.id,
                platform: {
                    id: platformId,
                },
            }

            return principal;
        }


        const secret = await jwtUtils.getJwtSecret()

        try {
            const decoded = await jwtUtils.decodeAndVerify<Principal>({
                jwt: token,
                key: secret,
            })
            assertNotNullOrUndefined(decoded.type, 'decoded.type')
            await assertUserSession(decoded)
            return decoded
        }
        catch (e) {
            if (e instanceof ActivepiecesError) {
                throw e
            }
            throw new ActivepiecesError({
                code: ErrorCode.INVALID_BEARER_TOKEN,
                params: {
                    message: 'invalid access token or session expired',
                },
            })
        }
    },
}

async function assertUserSession(decoded: Principal): Promise<void> {
    if (decoded.type !== PrincipalType.USER) return

    const user = await userService.getOneOrFail({ id: decoded.id })
    const identity = await userIdentityService(system.globalLogger()).getOneOrFail({ id: user.identityId })
    const isExpired = (identity.tokenVersion ?? null) !== (decoded.tokenVersion ?? null)
    if (isExpired || user.status === UserStatus.INACTIVE || !identity.verified) {
        throw new ActivepiecesError({
            code: ErrorCode.SESSION_EXPIRED,
            params: {
                message: 'The session has expired or the user is not verified.',
            },
        })
    }
}

type GenerateEngineTokenParams = {
    projectId: ProjectId
    jobId?: string
    platformId: PlatformId
}
