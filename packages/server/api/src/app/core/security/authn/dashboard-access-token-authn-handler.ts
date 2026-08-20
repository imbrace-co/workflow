import { ActivepiecesError, ErrorCode, isNil, Principal, PrincipalType, PlatformRole, UserIdentityProvider, ProjectType } from '@activepieces/shared'
import { environmentVariables, AppSystemProp } from '@activepieces/server-shared'
import { FastifyRequest } from 'fastify'
import { userService, userRepo } from '../../../user/user-service'
import { userIdentityService } from '../../../authentication/user-identity/user-identity-service'
import { projectService } from '../../../project/project-service'
import { BaseSecurityHandler } from '../security-handler'
import { system } from '../../../helper/system/system'

export class DashboardAccessTokenAuthnHandler extends BaseSecurityHandler {
    private static readonly USER_ID_HEADER = 'x-user-id'
    private static readonly ORGANIZATION_ID_HEADER = 'x-organization-id'
    // Strict shape so CSV-joined headers ("X, X") and other malformed values
    // can't silently create duplicate/orphan projects via findOrCreateProject.
    private static readonly ORGANIZATION_ID_PATTERN = /^org_[A-Za-z0-9_-]{1,96}$/

    private getSharedPlatformId(): string {
        const platformId = environmentVariables.getEnvironment(AppSystemProp.SHARED_PLATFORM_ID)
        if (!platformId) {
            throw new Error('SHARED_PLATFORM_ID environment variable is required')
        }
        return platformId
    }

    protected async canHandle(request: FastifyRequest): Promise<boolean> {
        const userId = request.headers[DashboardAccessTokenAuthnHandler.USER_ID_HEADER]
        const organizationId = request.headers[DashboardAccessTokenAuthnHandler.ORGANIZATION_ID_HEADER]
        const skipAuth = request.routeOptions.config?.skipAuth ?? false

        // Only handle if we have organization ID (userId is optional for backward compatibility)
        return !isNil(organizationId) && !skipAuth && typeof organizationId === 'string'
    }

    protected async doHandle(request: FastifyRequest): Promise<void> {
        const userId = request.headers[DashboardAccessTokenAuthnHandler.USER_ID_HEADER] as string | undefined
        const organizationId = request.headers[DashboardAccessTokenAuthnHandler.ORGANIZATION_ID_HEADER] as string

        if (!DashboardAccessTokenAuthnHandler.ORGANIZATION_ID_PATTERN.test(organizationId)) {
            throw new ActivepiecesError({
                code: ErrorCode.VALIDATION,
                params: {
                    message: 'invalid x-organization-id header',
                },
            })
        }

        console.log('Dashboard Gateway Auth: Processing headers', {
            userId: userId ? userId.substring(0, 10) + '...' : 'not provided',
            organizationId: organizationId?.substring(0, 15) + '...'
        })

        try {
            // No token validation needed - gateway already authenticated the user
            // Use the user ID directly from gateway headers
            const sharedPlatformId = this.getSharedPlatformId()

            console.log('Dashboard Gateway Auth: Using gateway user data', {
                userId: userId || 'fallback to org-based user',
                organizationId,
                platformId: sharedPlatformId
            })

            // Find or create user directly by ID (fallback to organization-based user if no userId)
            const effectiveUserId = userId || `org-user-${organizationId}`
            console.log('Dashboard Gateway Auth: Finding or creating user for ID', effectiveUserId)
            const user = await this.findOrCreateUserById(effectiveUserId, sharedPlatformId)

            // Find or create project for the organization
            console.log('Dashboard Gateway Auth: Finding or creating project for organization', organizationId)
            const project = await this.findOrCreateProject(organizationId, sharedPlatformId, user.id)

            // Create principal for the authenticated user
            const principal: Principal = {
                id: user.id,
                type: PrincipalType.USER,
                projectId: project.id,
                platform: {
                    id: sharedPlatformId,
                },
            }

            request.principal = principal
            console.log('Dashboard Gateway Auth: Authentication successful', {
                userId: user.id,
                platformId: sharedPlatformId,
                projectId: project.id,
                organizationId,
                externalUserId: userId ? userId.substring(0, 10) + '...' : 'fallback user'
            })
        } catch (error) {
            console.error(error)
            throw error
        }
    }

    private async findOrCreateProject(organizationId: string, platformId: string, ownerId: string) {
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
                externalId: organizationId, // Store organization ID as external ID for mapping
                type: ProjectType.TEAM,
            })
        }

        return project
    }

    private async findOrCreateUserById(externalUserId: string, platformId: string) {
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
    }

}
