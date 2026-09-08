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

export type SigningKey = { id: string, displayName: string, publicKey: string, [k: string]: unknown }
export type SigningKeyId = string
export type AddSigningKeyRequestBody = { displayName: string }
export type AddSigningKeyResponse = SigningKey & { privateKey: string }

export type ApiKeyResponseWithValue = { id: string, displayName: string, value: string, [k: string]: unknown }
export type ApiKeyResponseWithoutValue = { id: string, displayName: string, [k: string]: unknown }
export type CreateApiKeyRequest = { displayName: string }

export type OAuthApp = { id: string, pieceName: string, clientId: string, [k: string]: unknown }
export type UpsertOAuth2AppRequest = { pieceName: string, clientId: string, clientSecret: string }
export type ListOAuth2AppRequest = { limit?: number, cursor?: string }

export type GitRepo = { id: string, remoteUrl: string, branch: string, branchType: GitBranchType, [k: string]: unknown }
export type ConfigureRepoRequest = { remoteUrl: string, branch: string, slug: string, branchType: GitBranchType }
export type PushGitRepoRequest = { type: string, commitMessage: string, [k: string]: unknown }
export type PushFlowsGitRepoRequest = PushGitRepoRequest
export type PushTablesGitRepoRequest = PushGitRepoRequest
export type PushEverythingGitRepoRequest = { commitMessage: string }

export type ProjectMemberWithUser = {
    id: string
    projectRole: { name: string, [k: string]: unknown }
    user: { id: string, firstName: string, lastName: string, email: string }
    [k: string]: unknown
}
export type ListProjectMembersRequestQuery = { projectId: string, limit?: number, cursor?: string }
export type UpdateProjectMemberRoleRequestBody = { role: string }

export type CreateFlowTemplateRequest = { template: unknown, [k: string]: unknown }

export type ApplicationEvent = { action: string, data: unknown, [k: string]: unknown }
export type ListAuditEventsRequest = { limit?: number, cursor?: string, [k: string]: unknown }

export type CreateSubscriptionParams = { [k: string]: unknown }
export type SetAiCreditsOverageLimitParams = { limit: number }
export type ToggleAiCreditsOverageEnabledParams = { enabled: boolean }
export type UpdateActiveFlowsAddonParams = { [k: string]: unknown }

// typebox schema helper (rarely used at runtime in community)
export const AlertChannelSchema = Type.Enum(AlertChannel)
export type AlertChannelStatic = Static<typeof AlertChannelSchema>
