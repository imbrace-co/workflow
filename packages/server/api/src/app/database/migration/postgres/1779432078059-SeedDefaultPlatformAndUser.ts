import { AppSystemProp } from '@activepieces/server-shared'
import { MigrationInterface, QueryRunner } from 'typeorm'
import { system } from '../../../helper/system/system'

const DEFAULT_PLATFORM_ID = 'hVQYqpHY8OpeQbL7FJGnE'
const IDENTITY_ID = 'H9RJkUZZg9DRAHrKhBHHp'
const USER_ID = 'ChI8glRHAEmj7CBlMVmt3'

/**
 * Seeds the default platform, user and user_identity rows that the deployment
 * requires on a fresh environment. Replaces the manual init_db.sh script.
 *
 * The platform id is read from AP_SHARED_PLATFORM_ID so it matches the value the
 * dashboard auth handler resolves per-environment. The user/identity ids reuse
 * the exact values from init_db.sh so the inserts are idempotent (ON CONFLICT DO
 * NOTHING) and never create a duplicate admin on environments that were already
 * seeded manually by the script.
 */
export class SeedDefaultPlatformAndUser1779432078059 implements MigrationInterface {
    name = 'SeedDefaultPlatformAndUser1779432078059'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const log = system.globalLogger()
        const platformId = system.get(AppSystemProp.SHARED_PLATFORM_ID) ?? DEFAULT_PLATFORM_ID
        log.info({ name: this.name, platformId }, 'seeding default platform/user')

        // 1. user_identity (no FK deps). ON CONFLICT DO NOTHING covers id + unique email.
        await queryRunner.query(`
            INSERT INTO public.user_identity
              (id, created, updated, email, password, "trackEvents", "newsLetter",
               verified, "firstName", "lastName", "tokenVersion", provider)
            VALUES ($1, now(), now(), 'agent01@imbrace.co',
              '$2b$10$c/gG3flXo4pDQzPxhEwhhuzIc32viH6PJOwMxr0CMpx5Foa2X7SA.',
              true, false, true, 'Michael', 'Wong', 'NoC1FLJeClTNbc67t7Sem', 'EMAIL')
            ON CONFLICT DO NOTHING
        `, [IDENTITY_ID])

        // 2. user (identityId FK -> user_identity). platformId is a plain column (no FK).
        await queryRunner.query(`
            INSERT INTO public."user"
              (id, created, updated, status, "externalId", "platformId",
               "platformRole", "identityId")
            VALUES ($1, now(), now(), 'ACTIVE', null, $2, 'ADMIN', $3)
            ON CONFLICT DO NOTHING
        `, [USER_ID, platformId, IDENTITY_ID])

        // 3. platform (ownerId FK -> user). Only insert if absent.
        await queryRunner.query(`
            INSERT INTO public.platform
              (id, created, updated, "ownerId", name, "primaryColor", "logoIconUrl",
               "fullLogoUrl", "favIconUrl", "cloudAuthEnabled", "filteredPieceNames",
               "filteredPieceBehavior", "allowedAuthDomains", "enforceAllowedAuthDomains",
               "emailAuthEnabled", "federatedAuthProviders", smtp, "pinnedPieces")
            VALUES ($1, now(), now(), $2, 'Imbrace', '#6e41e2',
              'https://cdn.activepieces.com/brand/logo.svg',
              'https://cdn.activepieces.com/brand/full-logo.png',
              'https://cdn.activepieces.com/brand/favicon.ico',
              true, '{}', 'BLOCKED', '{}', false, true, '{}', null, '{}')
            ON CONFLICT (id) DO NOTHING
        `, [platformId, USER_ID])
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const platformId = system.get(AppSystemProp.SHARED_PLATFORM_ID) ?? DEFAULT_PLATFORM_ID
        await queryRunner.query('DELETE FROM public.platform WHERE id = $1', [platformId])
        await queryRunner.query('DELETE FROM public."user" WHERE id = $1', [USER_ID])
        await queryRunner.query('DELETE FROM public.user_identity WHERE id = $1', [IDENTITY_ID])
    }
}
