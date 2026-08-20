import { FastifyPluginAsync } from 'fastify'
import { KafkaController } from './controller'

let kafkaController: KafkaController | null = null

export const kafkaModule: FastifyPluginAsync = async (app) => {
    // Initialize Kafka controller
    kafkaController = new KafkaController(app.log)

    // NOTE: Kafka start/stop is controlled from main.ts now.
    // We keep only the endpoints here.

    // Health check endpoint
    app.get('/health/kafka', async (request, reply) => {
        if (!kafkaController) {
            return reply.status(503).send({
                status: 'disabled',
                message: 'Kafka controller not initialized'
            })
        }

        try {
            const health = await kafkaController.getHealthStatus()
            const status = health.connected ? 200 : 503

            return reply.status(status).send({
                status: health.connected ? 'healthy' : 'unhealthy',
                ...health
            })
        } catch (error) {
            app.log.error({ error }, 'Failed to get Kafka health status')
            return reply.status(503).send({
                status: 'error',
                message: 'Failed to get health status'
            })
        }
    })

    // Configuration endpoint (for debugging)
    app.get('/kafka/config', {
        schema: {
            response: {
                200: {
                    type: 'object',
                    properties: {
                        isInitialized: { type: 'boolean' },
                        config: {
                            type: 'object',
                            properties: {
                                groupId: { type: 'string' },
                                topic: { type: 'string' },
                                brokers: {
                                    type: 'array',
                                    items: { type: 'string' }
                                },
                                autoCommit: { type: 'boolean' },
                                maxBytesPerPartition: { type: 'number' },
                                fromBeginning: { type: 'boolean' }
                            }
                        }
                    }
                }
            }
        }
    }, async (request, reply) => {
        if (!kafkaController) {
            return reply.status(503).send({
                error: 'Kafka controller not initialized'
            })
        }

        return kafkaController.getConfiguration()
    })

    // Manual message processing endpoint (for testing)
    app.post('/kafka/process-message', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    message: { type: 'string' }
                },
                required: ['message']
            }
        }
    }, async (request, reply) => {
        if (!kafkaController) {
            return reply.status(503).send({
                error: 'Kafka controller not initialized'
            })
        }

        try {
            const { message } = request.body as { message: string }
            const result = await kafkaController.processMessage(message)
            
            return reply.send({
                success: true,
                result
            })
        } catch (error) {
            app.log.error({ error }, 'Failed to process manual message')
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    })

    // Batch processing endpoint
    app.post('/kafka/process-batch', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    messages: {
                        type: 'array',
                        items: { type: 'object' }
                    }
                },
                required: ['messages']
            }
        }
    }, async (request, reply) => {
        if (!kafkaController) {
            return reply.status(503).send({
                error: 'Kafka controller not initialized'
            })
        }

        try {
            const { messages } = request.body as { messages: any[] }
            
            // Validate all messages first
            const invalidMessages = messages.filter((msg, index) => {
                const isValid = kafkaController!.validateMessage(msg)
                if (!isValid) {
                    app.log.warn({ messageIndex: index, message: msg }, 'Invalid message in batch')
                }
                return !isValid
            })

            if (invalidMessages.length > 0) {
                return reply.status(400).send({
                    success: false,
                    error: `${invalidMessages.length} invalid messages in batch`,
                    invalidCount: invalidMessages.length,
                    totalCount: messages.length
                })
            }

            const results = await kafkaController.processBatch(messages)
            
            const successCount = results.filter(r => r.success).length
            const failureCount = results.filter(r => !r.success).length
            
            return reply.send({
                success: true,
                summary: {
                    total: results.length,
                    successful: successCount,
                    failed: failureCount
                },
                results
            })
        } catch (error) {
            app.log.error({ error }, 'Failed to process message batch')
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    })
}

// Export the controller for external access
export const getKafkaController = (): KafkaController | null => {
    return kafkaController
}

export const startKafkaIfEnabled = async (): Promise<void> => {
    const controller = getKafkaController()
    const kafkaEnabled = process.env.KAFKA_ENABLED === 'true'

    if (!controller) {
        throw new Error('Kafka controller not initialized. Ensure kafkaModule is registered before starting Kafka.')
    }

    if (!kafkaEnabled) {
        return
    }

    const maxInitRetries = parseInt(process.env.KAFKA_INIT_MAX_RETRIES ?? '0') // 0 = unlimited
    const baseDelay = 2000
    const maxDelay = 60000
    let attempt = 0

    const tryInitialize = async (): Promise<void> => {
        while (true) {
            try {
                await controller.initialize()
                return
            }
            catch (error) {
                attempt++
                if (maxInitRetries > 0 && attempt >= maxInitRetries) {
                    console.error(`[Kafka] Initialization failed after ${attempt} attempts, giving up. Server continues without Kafka.`)
                    return
                }
                const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)
                console.warn(`[Kafka] Initialization attempt ${attempt} failed, retrying in ${delay}ms...`)
                await new Promise(resolve => setTimeout(resolve, delay))
            }
        }
    }

    // Run initialization in the background so the server can start handling non-Kafka traffic
    tryInitialize().catch((error) => {
        console.error('[Kafka] Unexpected error during initialization retry loop:', error)
    })
}

export const stopKafka = async (): Promise<void> => {
    const controller = getKafkaController()
    if (!controller) {
        return
    }
    await controller.shutdown()
}
