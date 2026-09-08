import { FastifyBaseLogger, FastifyRequest } from 'fastify'

// Community edition: role-based access control is an enterprise feature. There
// is a single owner user, so all permission checks pass.
export const rbacMiddleware = async (_req: FastifyRequest): Promise<void> => {
    // no-op: community has no project roles
}

export async function assertUserHasPermissionToFlow(
    _principal: unknown,
    _operationType: unknown,
    _log: FastifyBaseLogger,
): Promise<void> {
    // no-op: community has no project roles
}

export async function assertRoleHasPermission(
    _principal: unknown,
    _permission: unknown,
    _log: FastifyBaseLogger,
): Promise<void> {
    // no-op: community has no project roles
}
