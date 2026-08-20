import './instrumentation'

import { FastifyInstance } from 'fastify'
import { appPostBoot } from './app/app'
import { initializeDatabaseConnection } from './app/database'
import { system } from './app/helper/system/system'
import { setupServer } from './app/server'
import { workerPostBoot } from './app/worker'
import { startKafkaIfEnabled, stopKafka } from './app/kafka'

const start = async (app: FastifyInstance): Promise<void> => {
    try {
        await app.listen({
            host: '0.0.0.0',
            port: 3000,
        })
        if (system.isWorker()) {
            await workerPostBoot(app)
        }
        if (system.isApp()) {
            await appPostBoot(app)
        }
    }
    catch (err) {
        app.log.error(err)
        process.exit(1)
    }
}

// This might be needed as it can be called twice
let shuttingDown = false


const stop = async (app: FastifyInstance): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true

    try {
        await stopKafka().catch((e: unknown) => app.log.error(e, 'Error stopping Kafka'))
        await app.close()
        process.exit(0)
    }
    catch (err) {
        app.log.error('Error stopping server')
        app.log.error(err)
        process.exit(1)
    }
}

function setupTimeZone(): void {
    // It's important to set the time zone to UTC when working with dates in PostgreSQL.
    // If the time zone is not set to UTC, there can be problems when storing dates in UTC but not considering the UTC offset when converting them back to local time. This can lead to incorrect fields being displayed for the created
    // https://stackoverflow.com/questions/68240368/typeorm-find-methods-returns-wrong-timestamp-time
    process.env.TZ = 'UTC'
}


const main = async (): Promise<void> => {
    setupTimeZone()
    await initializeDatabaseConnection()
    const app = await setupServer()
    app.log.info('Server setup completed')

    // Kafka module is registered as part of setupServer()->setupApp().
    // Start Kafka after the server/plugins are ready.
    try {
        await startKafkaIfEnabled()
        app.log.info('Kafka init from main.ts completed')
    }
    catch (e) {
        app.log.error(e, 'Kafka init from main.ts failed')
    }

    process.on('SIGINT', async () => {
        await stop(app).catch((e) => system.globalLogger().error(e, '[Main#stop]'))
    })

    process.on('SIGTERM', async () => {
        await stop(app).catch((e) => system.globalLogger().error(e, '[Main#stop]'))
    })

    await start(app)
}

main().catch((e) => {
    system.globalLogger().error(e, '[Main#main]')
    process.exit(1)
})

