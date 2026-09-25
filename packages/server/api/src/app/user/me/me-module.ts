import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { meController } from './me-controller'

// Registered at the same /v1/users prefix as platformUserModule, but as a
// separate plugin: platformUserModule's platformMustBeOwnedByCurrentUser
// preHandler must not gate /me, since any authenticated user (not just the
// platform owner) needs to be able to fetch their own info.
export const meModule: FastifyPluginAsyncTypebox = async (app) => {
    await app.register(meController, { prefix: '/v1/users' })
}
