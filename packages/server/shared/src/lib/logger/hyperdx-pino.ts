import * as HyperDX from '@hyperdx/node-opentelemetry'
import { Level, Logger, LoggerOptions, pino, transport, TransportTargetOptions } from 'pino'

export type HyperDXCredentials = {
    token: string | undefined
}

export const createHyperDXTransport = (level: Level, targets: TransportTargetOptions[], hyperdx?: HyperDXCredentials, baseOptions: LoggerOptions = {}): Logger | null => {
    if (!hyperdx) {
        return null
    }
    const token = hyperdx.token
    if (!token) {
        return null
    }
    HyperDX.init({
        apiKey: token,
        service: 'activepieces',
    })

    return pino(
        // Canonical shape (base/messageKey/timestamp/formatters), but keep
        // HyperDX's own mixin so its OTel trace correlation still works.
        { ...baseOptions, level, mixin: HyperDX.getPinoMixinFunction },
        transport({
            targets: [
                HyperDX.getPinoTransport(level, {
                    detectResources: true,
                    queueSize: 1000,
                }),
                ...targets,
            ],
        }),
    )
} 