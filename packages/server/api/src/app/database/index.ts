import { databaseConnection } from './database-connection'
import { databaseSeeds } from './seeds'

export async function initializeDatabaseConnection(): Promise<void> {
    await databaseConnection().initialize()
}

export async function runMigrationsAndSeeds(): Promise<void> {
    await databaseConnection().initialize()
    await databaseConnection().runMigrations()
    await databaseSeeds.run()
}
