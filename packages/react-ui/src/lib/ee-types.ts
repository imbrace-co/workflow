/**
 * Community edition: type/enum shims for enterprise-only UI features.
 *
 * These features (billing, git sync, custom domains, alerts, API keys, signing
 * keys, project roles/members, audit logs, platform admin) are not available in
 * the community edition, but their UI components remain in the tree. This module
 * re-declares the types/enums those components reference so the frontend builds
 * without depending on the enterprise `@activepieces/ee-shared` package.
 *
 * Enterprise-only vocabulary is intentionally kept minimal here; the runtime
 * values match upstream so the (inactive) UI still renders coherently.
 */
import { Static, Type } from '@sinclair/typebox'

// Re-export the symbols that now live in @activepieces/shared.
export {
    ApplicationEventName,
    GitPushOperationType,
    CreatePlatformProjectRequest,
    ListProjectRequestForPlatformQueryParams,
} from '@activepieces/shared'

// ── Enums (runtime values preserved) ────────────────────────────────────────
export enum GitBranchType {
    PRODUCTION = 'PRODUCTION',
    DEVELOPMENT = 'DEVELOPMENT',
}

export enum ApSubscriptionStatus {
    ACTIVE = 'active',
    CANCELED = 'canceled',
}

export enum CustomDomainStatus {
    ACTIVE = 'ACTIVE',
    PENDING = 'PENDING',
}

export enum AlertChannel {
    EMAIL = 'EMAIL',
}

// ── Constants / helpers ──────────────────────────────────────────────────────
export const PRICE_PER_EXTRA_ACTIVE_FLOWS = 5

export const isCloudPlanButNotEnterprise = (_plan?: string): boolean => false

export const summarizeApplicationEvent = (_event: unknown): string => ''

// ── Types (kept loose; these features are inactive in community) ─────────────
export type Alert = { id: string, channel: AlertChannel, receiver: string, [k: string]: unknown }
export type CreateAlertParams = { channel: AlertChannel, receiver: string, projectId: string }
export type ListAlertsParams = { projectId: string, limit?: number, cursor?: string }

export type CustomDomain = { id: string, domain: string, platformId: string, status: CustomDomainStatus, [k: string]: unknown }
export type AddDomainRequest = { domain: string }

type BaseFields = { id: string, created: string, updated: string }

export type SigningKey = BaseFields & { displayName: string, publicKey: string, generatedBy?: string, algorithm?: string, [k: string]: unknown }
export type SigningKeyId = string
export const AddSigningKeyRequestBody = Type.Object({
    displayName: Type.String(),
})
export type AddSigningKeyRequestBody = Static<typeof AddSigningKeyRequestBody>
export type AddSigningKeyResponse = SigningKey & { privateKey: string }

export type ApiKeyResponseWithValue = BaseFields & { displayName: string, value: string, [k: string]: unknown }
export type ApiKeyResponseWithoutValue = BaseFields & { displayName: string, truncatedValue?: string, lastUsedAt?: string, [k: string]: unknown }
export type CreateApiKeyRequest = { displayName: string }

export type OAuthApp = { id: string, pieceName: string, clientId: string, [k: string]: unknown }
export type UpsertOAuth2AppRequest = { pieceName: string, clientId: string, clientSecret: string }
export type ListOAuth2AppRequest = { limit?: number, cursor?: string }

export type GitRepo = { id: string, remoteUrl: string, branch: string, branchType: GitBranchType, slug?: string, sshPrivateKey?: string, [k: string]: unknown }

// These are used both as types and as typebox schemas (form resolvers).
export const ConfigureRepoRequest = Type.Object({
    projectId: Type.Optional(Type.String()),
    remoteUrl: Type.String(),
    branch: Type.String(),
    slug: Type.String(),
    branchType: Type.Enum(GitBranchType),
    sshPrivateKey: Type.Optional(Type.String()),
})
export type ConfigureRepoRequest = Static<typeof ConfigureRepoRequest>

export const PushFlowsGitRepoRequest = Type.Object({
    type: Type.String(),
    commitMessage: Type.String(),
    flowIds: Type.Optional(Type.Array(Type.String())),
    externalFlowIds: Type.Optional(Type.Array(Type.String())),
    tableIds: Type.Optional(Type.Array(Type.String())),
    externalTableIds: Type.Optional(Type.Array(Type.String())),
})
export type PushFlowsGitRepoRequest = Static<typeof PushFlowsGitRepoRequest>

export const PushTablesGitRepoRequest = Type.Object({
    type: Type.String(),
    commitMessage: Type.String(),
    tableIds: Type.Optional(Type.Array(Type.String())),
    externalTableIds: Type.Optional(Type.Array(Type.String())),
})
export type PushTablesGitRepoRequest = Static<typeof PushTablesGitRepoRequest>

export const PushEverythingGitRepoRequest = Type.Object({
    commitMessage: Type.String(),
})
export type PushEverythingGitRepoRequest = Static<typeof PushEverythingGitRepoRequest>

export type PushGitRepoRequest = PushFlowsGitRepoRequest

export type ProjectMemberWithUser = {
    id: string
    projectRole: { name: string, [k: string]: unknown }
    project: { id: string, displayName: string, [k: string]: unknown }
    user: { id: string, firstName: string, lastName: string, email: string }
    [k: string]: unknown
}
export type ListProjectMembersRequestQuery = { projectId: string, limit?: number, cursor?: string }
export type UpdateProjectMemberRoleRequestBody = { role: string }

export type CreateFlowTemplateRequest = {
    template: { displayName?: string, description?: string, tags?: string[], [k: string]: unknown }
    displayName?: string
    description?: string
    blogUrl?: string
    tags?: string[]
    [k: string]: unknown
}

export type ApplicationEvent = {
    id: string
    created: string
    updated: string
    action: string
    data: { project?: { displayName?: string }, [k: string]: unknown }
    platformId: string
    projectId?: string
    projectDisplayName?: string
    userId?: string
    userEmail?: string
    ip?: string
}
export type ListAuditEventsRequest = { limit?: number, cursor?: string, [k: string]: unknown }

export type CreateSubscriptionParams = { [k: string]: unknown }
export type SetAiCreditsOverageLimitParams = { limit: number }
export type ToggleAiCreditsOverageEnabledParams = { enabled?: boolean, state?: unknown, [k: string]: unknown }
export type UpdateActiveFlowsAddonParams = { [k: string]: unknown }
export type CreateFlowTemplateRequestValue = { template: { displayName?: string, description?: string, tags?: string[], [k: string]: unknown } }

// typebox schema helper (rarely used at runtime in community)
export const AlertChannelSchema = Type.Enum(AlertChannel)
export type AlertChannelStatic = Static<typeof AlertChannelSchema>
