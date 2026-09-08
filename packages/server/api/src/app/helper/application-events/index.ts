import { ApplicationEventName } from '@activepieces/shared'
import { Type } from '@sinclair/typebox'
import { FastifyRequest } from 'fastify'
import { hooksFactory } from '../hooks-factory'

// Community edition: audit logging is an enterprise feature. The event schema is
// kept generic (action + free-form data) so audit hooks compile as no-ops.
export const AuditEventParam = Type.Object({
    action: Type.Enum(ApplicationEventName),
    data: Type.Unknown(),
})
export type AuditEventParam = {
    action: ApplicationEventName
    data: unknown
}


export const eventsHooks = hooksFactory.create<ApplicationEventHooks>(() => {
    return {
        async sendUserEvent(_requestInformation, _params) {
            return
        },
        async sendUserEventFromRequest(_request, _params) {
            return
        },
        async sendWorkerEvent(_params) {
            return
        },
    }
})

export type ApplicationEventHooks = {
    sendUserEvent(requestInformation: MetaInformation, params: AuditEventParam): void
    sendUserEventFromRequest(request: FastifyRequest, params: AuditEventParam): void
    sendWorkerEvent(projectId: string, params: AuditEventParam): void
}

type MetaInformation = {
    platformId: string
    userId: string
    projectId: string
    ip: string
}
