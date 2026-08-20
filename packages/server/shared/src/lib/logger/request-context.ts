import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import { LoggerOptions } from 'pino'

/**
 * Request/job correlation context for the canonical imbrace log schema.
 *
 * Workflow logs via pino (Fastify's loggerInstance + a global logger). We
 * keep the library (pino) but reshape its stdout output to the canonical
 * single-line JSON every imbrace service emits, and inject the per-request
 * correlation fields from this AsyncLocalStorage store.
 */

export const REQUEST_ID_HEADER = 'x-request-id'
export const PROXY_HEADER = 'x-proxy'

export type RequestContext = {
    requestId: string
    ip: string
    method: string
    path: string
    proxy: string
    startTime: number
}

const als = new AsyncLocalStorage<RequestContext>()

export const getContext = (): RequestContext | undefined => als.getStore()

/** Bind a context for the rest of the current async chain (Fastify hooks). */
export const bindContext = (ctx: RequestContext): void => als.enterWith(ctx)

/** Run a non-HTTP unit of work (cron/queue/consumer) with a minted context. */
export const runWithJobContext = <T>(
    jobName: string,
    fn: () => T,
    opts?: { incomingRequestId?: string },
): T =>
    als.run(
        {
            requestId: opts?.incomingRequestId ?? randomUUID(),
            ip: '',
            method: 'JOB',
            path: jobName,
            proxy: 'cron',
            startTime: Date.now(),
        },
        fn,
    )

const SERVICE_NAME = process.env['SERVICE_NAME'] ?? 'ap-workflow'

const normalizeEnv = (raw: string | undefined): string => {
    const v = (raw ?? '').toLowerCase()
    if (v.includes('prod')) return 'prodv2'
    if (v.includes('stag') || v === 'stg') return 'staging'
    if (v.includes('dev') || v.includes('local')) return 'dev'
    return v || 'dev'
}

const ENV =
    process.env['DEPLOY_ENV'] ??
    normalizeEnv(process.env['AP_ENVIRONMENT'] ?? process.env['NODE_ENV'])

const LEVEL_MAP: Record<string, string> = {
    trace: 'debug',
    debug: 'debug',
    info: 'info',
    warn: 'warn',
    error: 'error',
    fatal: 'error',
}

/**
 * pino instance options that reshape every line to the canonical schema:
 *   ip, request_id, date_time, time, method_request, request_path, service_name,
 *   env, type_of_entity, function_of_code, description_message, response_time,
 *   status_code, proxy, level
 * Applies regardless of transport (stdout / loki / hyperdx).
 */
export const canonicalPinoOptions = (): LoggerOptions => ({
    base: { service_name: SERVICE_NAME, env: ENV },
    messageKey: 'description_message',
    timestamp: () =>
        `,"date_time":"${new Date().toISOString()}","time":${Date.now()}`,
    formatters: {
        level: (label: string) => ({ level: LEVEL_MAP[label] ?? label }),
        // Map Fastify's built-in request/response log fields onto the canonical
        // names, and drop its verbose req/res objects.
        log: (obj: Record<string, unknown>) => {
            const out: Record<string, unknown> = { ...obj }
            const res = out['res'] as { statusCode?: number } | undefined
            if (res && typeof res === 'object') {
                out['status_code'] = res.statusCode
                delete out['res']
            }
            if (typeof out['responseTime'] === 'number') {
                out['response_time'] = Math.round(out['responseTime'])
                delete out['responseTime']
            }
            delete out['req']
            return out
        },
    },
    mixin() {
        const ctx = als.getStore()
        return {
            ip: ctx?.ip ?? '',
            request_id: ctx?.requestId ?? '',
            method_request: ctx?.method ?? '',
            request_path: ctx?.path ?? '',
            type_of_entity: 'EMPTY',
            function_of_code: '',
            proxy: ctx?.proxy ?? '',
        }
    },
})
