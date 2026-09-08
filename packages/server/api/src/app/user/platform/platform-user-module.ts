import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { platformMustBeOwnedByCurrentUser } from '../../core/security/authorization'
import { platformUserController } from './platform-user-controller'

export const platformUserModule: FastifyPluginAsyncTypebox = async (app) => {
    app.addHook('preHandler', platformMustBeOwnedByCurrentUser)
    await app.register(platformUserController, { prefix: '/v1/users' })
}
