import './instrumentation'

import { runMigrationsAndSeeds } from './app/database'
import { databaseConnection } from './app/database/database-connection'
import { system } from './app/helper/system/system'

async function main(): Promise<void> {
    const log = system.globalLogger()
    log.info('[Migrate] Starting migrations + seeds')
    await runMigrationsAndSeeds()
    log.info('[Migrate] Done')
    await databaseConnection().destroy()
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        system.globalLogger().error(err, '[Migrate] Failed')
        process.exit(1)
    })
