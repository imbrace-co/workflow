import { ActivepiecesError, ErrorCode, ProjectRole } from '@activepieces/shared'

// Community edition: custom project roles are an enterprise feature (gated off
// by `projectRolesEnabled: false`). These are never reached in community; they
// throw defensively so any accidental call surfaces clearly.
function notAvailable(): never {
    throw new ActivepiecesError({
        code: ErrorCode.FEATURE_DISABLED,
        params: { message: 'Project roles are an enterprise feature' },
    })
}

export const projectRoleService = {
    async getOneOrThrowById(_params: { id: string }): Promise<ProjectRole> {
        return notAvailable()
    },
    async getOneOrThrow(_params: { name: string, platformId: string }): Promise<ProjectRole> {
        return notAvailable()
    },
}
