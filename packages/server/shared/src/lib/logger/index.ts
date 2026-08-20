import { FastifyBaseLogger } from 'fastify'
import pino, { Level, Logger } from 'pino'
import 'pino-loki'
import { createHyperDXTransport, HyperDXCredentials } from './hyperdx-pino'
import { createLokiTransport, LokiCredentials } from './loki-pino'
import { canonicalPinoOptions } from './request-context'

export * from './request-context'

export const pinoLogging = {
    initLogger: (loggerLevel: Level | undefined, logPretty: boolean, loki: LokiCredentials, hyperdx: HyperDXCredentials): Logger => {
        const level: Level = loggerLevel ?? 'info'
        const pretty = logPretty ?? false

        if (pretty) {
            return pino({
                level,
                transport: {
                    target: 'pino-pretty',
                    options: {
                        translateTime: 'HH:MM:ss Z',
                        colorize: true,
                        ignore: 'pid,hostname',
                    },
                },
            })
        }
        
        const defaultTargets = [
            {
                target: 'pino/file',
                level,
                options: {},
            },
        ]

        // Canonical imbrace log schema applied to every transport path.
        const canonical = canonicalPinoOptions()

        const hyperdxLogger = createHyperDXTransport(level, defaultTargets, hyperdx, canonical)
        if (hyperdxLogger) {
            return hyperdxLogger
        }

        const lokiLogger = createLokiTransport(level, defaultTargets, loki, canonical)
        if (lokiLogger) {
            return lokiLogger
        }

        // Default logger (stdout). pino forbids a custom level formatter when
        // transport.targets is set (the formatter can't cross into the
        // transport worker thread), and the canonical schema defines one. A
        // transport-less pino writes to stdout (fd 1) — same destination as the
        // pino/file target — while keeping the full canonical schema
        // (level/log formatters + timestamp) working.
        return pino({
            ...canonical,
            level,
        })
    },
    createRunContextLog: ({ log, runId, webhookId, flowId, flowVersionId }: { log: FastifyBaseLogger, runId: string, webhookId: string | undefined, flowId: string, flowVersionId: string }) => {
        return log.child({ runId, webhookId, flowId, flowVersionId })
    },
    createWebhookContextLog: ({ log, webhookId, flowId }: { log: FastifyBaseLogger, webhookId: string, flowId: string }) => {
        return log.child({ webhookId, flowId })
    },
}
