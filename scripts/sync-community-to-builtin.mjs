/**
 * Sync Community Pieces to Builtin Package (src/pieces structure)
 *
 * This script copies source code from community pieces into packages/pieces/builtin/src/pieces/
 * and consolidates their dependencies into the builtin package.json.
 *
 * Usage:
 *   node scripts/sync-community-to-builtin.mjs sample               # Sync sample pieces only
 *   node scripts/sync-community-to-builtin.mjs all                  # Sync all pieces
 *   node scripts/sync-community-to-builtin.mjs piece1 piece2 ...    # Sync specific pieces by name
 */

import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import semver from 'semver'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const COMMUNITY_DIR = path.join(ROOT_DIR, 'packages/pieces/community')
const BUILTIN_SRC_DIR = path.join(ROOT_DIR, 'packages/pieces/builtin/src')
const BUILTIN_PIECES_DIR = path.join(BUILTIN_SRC_DIR, 'pieces')
const BUILTIN_PACKAGE_JSON = path.join(ROOT_DIR, 'packages/pieces/builtin/package.json')

// Pieces to sync in 'sample' mode
const SAMPLE_PIECES = [
    'framework',
    'common',
    'common-ai',
    'webhook',
    'http',
    'send-message'
]

// Pieces to always ignore during sync (define directly here)
// Note: names must match folder names under packages/pieces/community/
const IGNORED_PIECES = [
    'facebook-pages',
    'agent',
    'afforai',
    'aianswer',
    'chatbase',
    'chatnode',
    'apitable',
    'agentx',
    'assemblyai',
    'clarifai',
    'camb-ai',
    'campaign-monitor',
    'claude',
    'activecampaign',
    'cloutly',
    'chaindesk',
    'cometapi',
    'chat-aid',
    'google-gemini',
    'flowise',
    'firecrawl',
    'image-router',
    'aminos',
    'comfyicu',
    'contextual-ai',
    'contiguity',
    'copy-ai',
    'dappier',
    'deepgram',
    'devin',
    'docsbot',
    'doctly',
    'documentpro',
    'dumpling-ai',
    'eden-ai',
    'elevenlabs',
    'eth-name-service',
    'exa',
    'extracta-ai',
    'formspark',
    'gamma',
    'generatebanners',
    'gistly',
    'gladia',
    'gravityforms',
    'greip',
    'griptape',
    'grok-xai',
    'groq',
    'guidelite',
    'harvest',
    'hedy',
    'help-scout',
    'heygen',
    'hugging-face',
    'hume-ai',
    'image-ai',
    'insighto-ai',
    'instabase',
    'instasent',
    'invoiceninja',
    'jina-ai',
    'jogg-ai',
    'kallabot-ai',
    'kimai',
    'krisp-call',
    'linka',
    'llmrails',
    'localai',
    'magical-api',
    'magicslides',
    'mailchain',
    'mailer-lite',
    'manus',
    'mautic',
    'mcp',
    'medullar',
    'mistral-ai',
    'murf-api',
    'omni-co',
    'open-phone',
    'open-router',
    'openai',
    'opportify',
    'orimon',
    'pastefy',
    'pdf-co',
    'peekshot',
    'perplexity-ai',
    'personal-ai',
    'pinecone',
    'poper',
    'predict-leads',
    'presenton',
    'promptmate',
    'quickzu',
    'rabbitmq',
    'rapidtext-ai',
    'reachinbox',
    'recall-ai',
    'reoon-verifier',
    'resend',
    'respaid',
    'respond-io',
    'retune',
    'returning-ai',
    'robolly',
    'rss',
    'runware',
    'runway',
    'saastic',
    'saleor',
    'scenario',
    'scrapegrapghai',
    'scrapeless',
    'sendinblue',
    'sendpulse',
    'serp-api',
    'service-now',
    'sessions-us',
    'seven',
    'short-io',
    'simplepdf',
    'sitespeakai',
    'slidespeak',
    'smaily',
    'sperse',
    'square',
    'stability-ai',
    'stable-diffusion-webui',
    'straico',
    'supadata',
    'tally',
    'tarvent',
    'tavily',
    'text-ai',
    'textcortex-ai',
    'thankster',
    'tidycal',
    'toggl-track',
    'totalcms',
    'twin-labs',
    'typeform',
    'utility-ai',
    'vadoo-ai',
    'vbout',
    'video-ai',
    'videoask',
    'village',
    'vlm-run',
    'webling',
    'webscraping-ai',
    'wedof',
    'what-converts',
    'whatsable',
    'wonderchat',
    'wootric',
    'workable',
    'wrike',
    'writesonic-bulk',
    'youform',
    'zuora',
    'deepl',
    'deepseek',
    'denser-ai',
    'activepieces',
    'actualbudget',
    'acuity-scheduling',
    'acumbamail',
    'aidbase',
    'aircall',
    'airparser',
    'airtable',
    'airtop',
    'apify',
    'apitemplate-io',
    'apollo',
    'appfollow',
    'asana',
    'ashby',
    'assembled',
    'attio',
    'autocalls',
    'avoma',
    'azure-communication-services',
    'azure-openai',
    'backblaze',
    'bamboohr',
    'bannerbear',
    'baserow',
    'beamer',
    'beehiiv',
    'bettermode',
    'bexio',
    'bigcommerce',
    'bigin-by-zoho',
    'bika',
    'binance',
    'bitly',
    'blockscout',
    'bluesky',
    'bolna',
    'bonjoro',
    'brilliant-directories',
    'browse-ai',
    'browserless',
    'bubble',
    'bumpups',
    'capsule-crm',
    'captain-data',
    'cartloom',
    'cashfree-payments',
    'certopus',
    'chainalysis-api',
    'chargekeep',
    'chat-data',
    'chatsistant',
    'checkout',
    'circle',
    'clearout',
    'clickfunnels',
    'clicksend',
    'clockify',
    'clockodo',
    'close',
    'cloudconvert',
    'cloudinary',
    'coda',
    'cody',
    'cognito-forms',
    'constant-contact',
    'contentful',
    'convertkit',
    'copper',
    'crisp',
    'customer-io',
    'cyberark',
    'datafuel',
    'datocms',
    'dimo',
    'discourse',
    'dittofeed',
    'drip',
    'drupal',
    'dust',
    'emailoctopus',
    'famulor',
    'fathom',
    'fillout-forms',
    'fireberry',
    'fireflies-ai',
    'fliqr-ai',
    'flowlu',
    'folk',
    'foreplay-co',
    'formbricks',
    'formstack',
    'fountain',
    'freshdesk',
    'freshsales',
    'front',
    'gameball',
    'gcloud-pubsub',
    'ghostcms',
    'gotify',
    'grist',
    'hackernews',
    'heartbeat',
    'housecall-pro',
    'hubspot',
    'hunter',
    'ibm-cognose',
    'insightly',
    'instantly-ai',
    'intercom',
    'jotform',
    'kissflow',
    'kizeo-forms',
    'knack',
    'kommo',
    'lemlist',
    'lever',
    'linear',
    'lusha',
    'maileroo',
    'mailjet',
    'manychat',
    'mastodon',
    'matomo',
    'matrix',
    'mattermost',
    'meistertask',
    'mempool-space',
    'messagebird',
    'mindee',
    'missive',
    'mixpanel',
    'mollie',
    'monday',
    'moxie-crm',
    'mycase-piece',
    'netlify',
    'nifty',
    'ninox',
    'nocodb',
    'ntfy',
    'nuelink',
    'onfleet',
    'openmic-ai',
    'opnform',
    'pandadoc',
    'paperform',
    'parseur',
    'pastebin',
    'pdfmonkey',
    'phantombuster',
    'photoroom',
    'pipedrive',
    'placid',
    'podio',
    'posthog',
    'productboard',
    'prompthub',
    'pushbullet',
    'pushover',
    'pylon',
    'qdrant',
    'quickbase',
    'quickbooks',
    'razorpay',
    'retable',
    'retell-ai',
    'segment',
    'sender',
    'sendfox',
    'sendgrid',
    'sendy',
    'serpstat',
    'shippo',
    'simpliroute',
    'simplybookme',
    'skyvern',
    'smartsheet',
    'smartsuite',
    'smoove',
    'snowflake',
    'socialkit',
    'softr',
    'spotify',
    'supabase',
    'surrealdb',
    'systeme-io',
    'tableau',
    'talkable',
    'taskade',
    'teamleader',
    'teamwork',
    'ticktick',
    'timelines-ai',
    'todoist',
    'truelayer',
    'twilio',
    'upgradechat',
    'uscreen',
    'vimeo',
    'vtex',
    'vtiger',
    'wealthbox',
    'wufoo',
    'xero',
    'zagomail',
    'zendesk',
    'zendesk-sell',
    'zerobounce',
    'zoho-bookings',
    'zoho-books',
    'zoho-campaigns',
    'zoho-crm',
    'zoho-desk',
    'zoho-invoice',
    'zoho-mail',
    'zoom',
    'zoo',
]

// Special handling for core packages
// These are not "pieces" in the sense of having an index.ts with a Piece export
// They are libraries. We might need to put them in a different place or keep them in pieces/
// but not export them in the main pieces index.
const CORE_PACKAGES = ['framework', 'common', 'common-ai']

async function fixImports(dir) {
    const files = await fs.readdir(dir)
    for (const file of files) {
        const filePath = path.join(dir, file)
        const stat = await fs.stat(filePath)
        if (stat.isDirectory()) {
            await fixImports(filePath)
        } else if (file.endsWith('.ts')) {
            let content = await fs.readFile(filePath, 'utf-8')
            if (content.includes('../src/')) {
                // Replace ../src/ with ./ to handle flattened structure
                // E.g. ../src/lib/common/auth -> ./lib/common/auth
                content = content.replace(/\.\.\/src\//g, './')
                await fs.writeFile(filePath, content, 'utf-8')
                console.log(`  Fixed imports in ${file}`)
            }
        }
    }
}

async function syncPieces() {
    const args = process.argv.slice(2)

    let piecesToSync
    let mode

    if (args.length === 0 || args[0] === 'sample') {
        mode = 'sample'
        piecesToSync = SAMPLE_PIECES
    } else if (args[0] === 'all') {
        mode = 'all'
        piecesToSync = await fs.readdir(COMMUNITY_DIR)
    } else {
        mode = 'specific'
        piecesToSync = args
    }

    // Apply ignore list
    if (IGNORED_PIECES.length > 0) {
        const ignoredSet = new Set(IGNORED_PIECES)
        const before = piecesToSync
        piecesToSync = piecesToSync.filter(p => !ignoredSet.has(p))
        const ignored = before.filter(p => ignoredSet.has(p))
        if (ignored.length > 0) {
            console.log(`Ignoring pieces: ${ignored.join(', ')}`)
        }
    }

    console.log(`Syncing pieces in ${mode} mode to src/pieces...`)
    if (mode === 'specific') {
        console.log(`Pieces to sync: ${piecesToSync.join(', ')}`)
    }

    // Prepare builtin/src/pieces directory
    // NOTE: We should NOT wipe this directory completely if it contains manual builtin pieces (like test-builtin)
    // But for now, we assume we are populating it.
    // Let's ensure it exists.
    await fs.ensureDir(BUILTIN_PIECES_DIR)

    // Cleanup legacy community folder if it exists
    const legacyCommunityDir = path.join(BUILTIN_SRC_DIR, 'community')
    if (await fs.pathExists(legacyCommunityDir)) {
        console.log('Cleaning up legacy src/community folder...')
        await fs.remove(legacyCommunityDir)
    }

    // Read builtin package.json
    const builtinPkg = await fs.readJson(BUILTIN_PACKAGE_JSON)
    const allDependencies = { ...builtinPkg.dependencies }

    const exportedPieces = []

    for (const pieceName of piecesToSync) {
        const sourceDir = path.join(COMMUNITY_DIR, pieceName)
        if (!await fs.pathExists(sourceDir)) {
            console.warn(`Piece ${pieceName} not found in ${COMMUNITY_DIR}`)
            continue
        }

        console.log(`Syncing ${pieceName}...`)

        // 1. Copy Source Code
        // If it's a core package, maybe we should put it in src/lib/{name}?
        // For now, let's put everything in src/pieces/{name} to match the user request "migrate... to builtin/pieces"
        // But we need to be careful about imports.

        const targetDir = path.join(BUILTIN_PIECES_DIR, pieceName)

        // Clean target dir for this piece
        await fs.emptyDir(targetDir)

        await fs.copy(path.join(sourceDir, 'src'), targetDir)

        // Copy package.json so imports like ../../package.json work
        await fs.copy(path.join(sourceDir, 'package.json'), path.join(targetDir, 'package.json'))

        // Fix imports that reference ../src/ (legacy structure artifact)
        await fixImports(targetDir)

        // 2. Merge Dependencies
        const piecePkg = await fs.readJson(path.join(sourceDir, 'package.json'))
        if (piecePkg.dependencies) {
            for (const [dep, version] of Object.entries(piecePkg.dependencies)) {
                if (dep.startsWith('@activepieces/')) continue

                if (!allDependencies[dep]) {
                    allDependencies[dep] = version
                } else if (allDependencies[dep] !== version) {
                    const currentVer = allDependencies[dep].replace(/[\^~]/g, '')
                    const newVer = version.replace(/[\^~]/g, '')

                    if (semver.valid(currentVer) && semver.valid(newVer) && semver.gt(newVer, currentVer)) {
                        console.log(`  Upgrading ${dep}: ${allDependencies[dep]} -> ${version}`)
                        allDependencies[dep] = version
                    }
                }
            }
        }

        // Track for export, excluding core packages
        if (!CORE_PACKAGES.includes(pieceName)) {
            exportedPieces.push(pieceName)
        }
    }


    // 3. Write updated package.json
    builtinPkg.dependencies = allDependencies
    await fs.writeJson(BUILTIN_PACKAGE_JSON, builtinPkg, { spaces: 2 })
    console.log('Updated packages/pieces/builtin/package.json')

    // 4. Generate index.ts for pieces
    // We need to read the existing index.ts or create a new one.
    // If we overwrite, we lose 'test-builtin'.
    // Let's read the directory to find ALL pieces (synced + existing)
    const allPieceDirs = await fs.readdir(BUILTIN_PIECES_DIR)
    const validPieceDirs = []

    for (const dir of allPieceDirs) {
        if (CORE_PACKAGES.includes(dir)) continue // Don't export core packages as pieces

        const stats = await fs.stat(path.join(BUILTIN_PIECES_DIR, dir))
        if (stats.isDirectory() && await fs.pathExists(path.join(BUILTIN_PIECES_DIR, dir, 'index.ts'))) {
            validPieceDirs.push(dir)
        }
    }

    const indexContent = validPieceDirs
        .map(p => `export * as ${p.replace(/-/g, '_')} from './${p}'`)
        .join('\n')

    await fs.writeFile(path.join(BUILTIN_PIECES_DIR, 'index.ts'), indexContent)
    console.log(`Updated packages/pieces/builtin/src/pieces/index.ts with ${validPieceDirs.length} pieces`)

    // 5. Generate versions.ts
    // We need to map piece name (directory name) to version.
    // We already have exportedPieces (validPieceDirs now essentially).
    // Let's re-scan or use what we collected if we tracked it.
    // We'll read package.json from source or use what we synced.

    const versions = {}
    for (const dir of validPieceDirs) {
        // Try to read package.json from source for version
        // COMMUNITY_DIR/{dir}/package.json might exist.
        // OR BUILTIN_PIECES_DIR/{dir} -- wait we deleted package.json there!
        // So we must read from source (COMMUNITY_DIR) or we should have tracked it.

        let version = '0.0.0'
        const communityPkgPath = path.join(COMMUNITY_DIR, dir, 'package.json')

        // Also check if it's a manual builtin piece that is NOT in community (e.g. test-builtin)
        // For test-builtin, we don't have a source package.json?
        // Maybe we just default to 0.0.0 for those.

        if (await fs.pathExists(communityPkgPath)) {
            const pkg = await fs.readJson(communityPkgPath)
            version = pkg.version || '0.0.0'
        }

        versions[dir] = version
    }

    const versionsContent = `export const pieceVersions: Record<string, string> = ${JSON.stringify(versions, null, 4)}`
    await fs.writeFile(path.join(BUILTIN_SRC_DIR, 'versions.ts'), versionsContent)
    console.log(`Generated packages/pieces/builtin/src/versions.ts`)

    console.log('Sync complete.')
}

syncPieces().catch(console.error)
