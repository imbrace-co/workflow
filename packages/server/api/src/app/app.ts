import { PieceMetadata } from '@activepieces/pieces-framework'
import { AppSystemProp, exceptionHandler, rejectedPromiseHandler } from '@activepieces/server-shared'
import { ApEnvironment, AppConnectionWithoutSensitiveData, Flow, FlowRun, FlowTemplate, Folder, McpWithTools, ProjectRelease, ProjectWithLimits, spreadIfDefined, UserInvitation, UserWithMetaInformation } from '@activepieces/shared'
import swagger from '@fastify/swagger'
import { createAdapter } from '@socket.io/redis-adapter'
import { FastifyInstance, FastifyRequest, HTTPMethods } from 'fastify'
import fastifySocketIO from 'fastify-socket'
import { Socket } from 'socket.io'
import { aiProviderModule } from './ai/ai-provider.module'
import { appConnectionModule } from './app-connection/app-connection.module'
import { authenticationModule } from './authentication/authentication.module'
import { rateLimitModule } from './core/security/rate-limit'
import { securityHandlerChain } from './core/security/security-handler-chain'
import { websocketService } from './core/websockets.service'
import { distributedLock, redisConnections } from './database/redis-connections'
import { rbacMiddleware } from './core/security/rbac-middleware'
import { domainHelper } from './helper/domain-helper'
import { fileModule } from './file/file.module'
import { flagModule } from './flags/flag.module'
import { flagHooks } from './flags/flags.hooks'
import { flowService } from './flows/flow/flow.service'
import { humanInputModule } from './flows/flow/human-input/human-input.module'
import { flowRunModule } from './flows/flow-run/flow-run-module'
import { flowModule } from './flows/flow.module'
import { folderModule } from './flows/folder/folder.module'
import { communityFlowTemplateModule } from './flows/templates/community-flow-template.module'
import { kafkaModule } from './kafka/kafka-module'
import { openapiModule } from './helper/openapi/openapi.module'
import { system } from './helper/system/system'
import { SystemJobName } from './helper/system-jobs/common'
import { systemJobHandlers } from './helper/system-jobs/job-handlers'
import { systemJobsSchedule } from './helper/system-jobs/system-job'
import { validateEnvPropsOnStartup } from './helper/system-validator'
import { mcpModule } from './mcp/mcp-module'
import { communityPiecesModule } from './pieces/community-piece-module'
import { pieceModule } from './pieces/metadata/piece-metadata-controller'
import { pieceMetadataService } from './pieces/metadata/piece-metadata-service'
import { pieceSyncService } from './pieces/piece-sync-service'
import { tagsModule } from './pieces/tags/tags-module'
import { platformModule } from './platform/platform.module'
import { projectHooks } from './project/project-hooks'
import { projectModule } from './project/project-module'
import { storeEntryModule } from './store-entry/store-entry.module'
import { tablesModule } from './tables/tables.module'
import { todoActivityModule } from './todos/activity/todos-activity.module'
import { todoModule } from './todos/todo.module'
import { appEventRoutingModule } from './trigger/app-event-routing/app-event-routing.module'
import { triggerModule } from './trigger/trigger.module'
import { platformUserModule } from './user/platform/platform-user-module'
import { invitationModule } from './user-invitations/user-invitation.module'
import { webhookModule } from './webhooks/webhook-module'
import { engineResponseWatcher } from './workers/engine-response-watcher'
import { queueMetricsModule } from './workers/queue/metrics/queue-metrics.module'
import { migrateQueuesAndRunConsumers, workerModule } from './workers/worker-module'

export const setupApp = async (app: FastifyInstance): Promise<FastifyInstance> => {

    app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, async (_request: FastifyRequest, payload: unknown) => {
        return payload as Buffer
    })

    await app.register(swagger, {
        hideUntagged: true,
        openapi: {
            servers: [
                {
                    url: 'https://cloud.activepieces.com/api',
                    description: 'Production Server',
                },
            ],
            components: {
                securitySchemes: {
                    apiKey: {
                        type: 'http',
                        description: 'Use your api key generated from the admin console',
                        scheme: 'bearer',
                    },
                },
                schemas: {
                    'flow-template': FlowTemplate,
                    'folder': Folder,
                    'user': UserWithMetaInformation,
                    'user-invitation': UserInvitation,
                    project: ProjectWithLimits,
                    flow: Flow,
                    'flow-run': FlowRun,
                    'app-connection': AppConnectionWithoutSensitiveData,
                    piece: PieceMetadata,
                    'project-release': ProjectRelease,
                    'global-connection': AppConnectionWithoutSensitiveData,
                    'mcp': McpWithTools,
                },
            },
            info: {
                title: 'Activepieces Documentation',
                version: '0.0.0',
            },
            externalDocs: {
                url: 'https://www.activepieces.com/docs',
                description: 'Find more info here',
            },
        },
    })


    await app.register(rateLimitModule)
    app.addHook('onResponse', async (request, reply) => {
        // eslint-disable-next-line
        reply.header('x-request-id', request.id)
    })
    app.addHook('onRequest', async (request, reply) => {
        // Log incoming requests (especially webhooks)
        if (request.url.includes('/webhooks/')) {
            request.log.info({
                method: request.method,
                url: request.url,
                headers: request.headers,
                query: request.query,
                requestId: request.id,
            }, 'Incoming webhook request')
        }
        
        const route = app.hasRoute({
            method: request.method as HTTPMethods,
            url: request.routeOptions.url!,
        })
        if (!route) {
            return reply.code(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'Route not found',
            })
        }
    })

    app.addHook('preHandler', securityHandlerChain)
    app.addHook('preHandler', rbacMiddleware)
    await systemJobsSchedule(app.log).init()
    await app.register(fileModule)
    await app.register(flagModule)
    await app.register(storeEntryModule)
    await app.register(folderModule)
    await pieceSyncService(app.log).setup()
    await pieceMetadataService(app.log).setup()
    await app.register(pieceModule)
    await app.register(flowModule)
    await app.register(flowRunModule)
    await app.register(webhookModule)
    await app.register(appConnectionModule)
    await app.register(openapiModule)
    await app.register(appEventRoutingModule)
    await app.register(authenticationModule)
    await app.register(triggerModule)
    await app.register(platformModule)
    await app.register(humanInputModule)
    await app.register(tagsModule)
    await app.register(mcpModule)
    await app.register(kafkaModule)
    await pieceSyncService(app.log).setup()
    await pieceMetadataService(app.log).setup()
    await app.register(platformUserModule)
    await app.register(alertsModule)
    await app.register(invitationModule)
    await app.register(workerModule)
    await app.register(aiProviderModule)
    await app.register(licenseKeysModule)
    await app.register(tablesModule)
    await app.register(userModule)
    await app.register(todoModule)
    await app.register(todoActivityModule)
    await app.register(solutionsModule)
    systemJobHandlers.registerJobHandler(SystemJobName.DELETE_FLOW, (data) => flowService(app.log).backgroundDeleteHandler(data))

    app.get(
        '/redirect',
        async (
            request: FastifyRequest<{ Querystring: { code: string } }>,
            reply,
        ) => {
            const params = {
                code: request.query.code,
            }
            if (!params.code) {
                return reply.send('The code is missing in url')
            }
            else {
                return reply
                    .type('text/html')
                    .send(
                        `<script>if(window.opener){window.opener.postMessage({ 'code': '${encodeURIComponent(
                            params.code,
                        )}' },'*')}</script> <html>Redirect succuesfully, this window should close now</html>`,
                    )
            }
        },
    )
    await app.register(fastifySocketIO, {
        cors: {
            origin: '*',
        },
        maxHttpBufferSize: 1e8,
        ...spreadIfDefined('adapter', await getAdapter()),
        transports: ['websocket'],
    })
    app.io.use((socket: Socket, next: (err?: Error) => void) => {
        websocketService
            .verifyPrincipal(socket)
            .then(() => next())
            .catch(() => next(new Error('Authentication error')))
    })

    app.io.on('connection', (socket: Socket) => rejectedPromiseHandler(websocketService.init(socket, app.log), app.log))
    app.io.on('disconnect', (socket: Socket) => rejectedPromiseHandler(websocketService.onDisconnect(socket), app.log))

    await validateEnvPropsOnStartup(app.log)

    // Community edition only.
    await app.register(projectModule)
    await app.register(communityPiecesModule)
    await app.register(communityFlowTemplateModule)
    await app.register(queueMetricsModule)

    app.addHook('onClose', async () => {
        app.log.info('Shutting down')
        await systemJobsSchedule(app.log).close()
        await redisConnections.destroy()
        await distributedLock(app.log).destroy()
        await engineResponseWatcher(app.log).shutdown()
    })

    return app
}



async function getAdapter() {
    const redisConnectionInstance = await redisConnections.useExisting()
    const sub = redisConnectionInstance.duplicate()
    const pub = redisConnectionInstance.duplicate()
    return createAdapter(pub, sub, {
        requestsTimeout: 30000,
    })
}


export async function appPostBoot(app: FastifyInstance): Promise<void> {

    app.log.info(`
             _____   _______   _____  __      __  ______   _____    _____   ______    _____   ______    _____
    /\\      / ____| |__   __| |_   _| \\ \\    / / |  ____| |  __ \\  |_   _| |  ____|  / ____| |  ____|  / ____|
   /  \\    | |         | |      | |    \\ \\  / /  | |__    | |__) |   | |   | |__    | |      | |__    | (___
  / /\\ \\   | |         | |      | |     \\ \\/ /   |  __|   |  ___/    | |   |  __|   | |      |  __|    \\___ \\
 / ____ \\  | |____     | |     _| |_     \\  /    | |____  | |       _| |_  | |____  | |____  | |____   ____) |
/_/    \\_\\  \\_____|    |_|    |_____|     \\/     |______| |_|      |_____| |______|  \\_____| |______| |_____/

The application started on ${await domainHelper.getPublicApiUrl({ path: '' })}, as specified by the AP_FRONTEND_URL variables.`)

    const environment = system.get(AppSystemProp.ENVIRONMENT)
    const pieces = process.env.AP_DEV_PIECES

    await migrateQueuesAndRunConsumers(app)
    app.log.info('Queues migrated and consumers run')
    if (environment === ApEnvironment.DEVELOPMENT) {
        app.log.warn(
            `[WARNING]: The application is running in ${environment} mode.`,
        )
        app.log.warn(
            `[WARNING]: This is only shows pieces specified in AP_DEV_PIECES ${pieces} environment variable.`,
        )
    }
}
