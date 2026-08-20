import { rejectedPromiseHandler } from '@activepieces/server-shared'
import { FastifyBaseLogger } from 'fastify'
import { TOPICS } from './constants'
import { CrmMessageProcessor } from './crm-message-processor'
import { KafkaMessageProcessor } from './kafka-message-processor'
import { KafkaService } from './kafka.service'
import { KafkaHealthStatus, KafkaMessage, KafkaProcessingResult } from './types'

export class KafkaController {
    private kafkaService: KafkaService
    private messageProcessor: KafkaMessageProcessor
    private crmMessageProcessor: CrmMessageProcessor
    private logger: FastifyBaseLogger
    private isInitialized = false
    private healthCheckInterval: NodeJS.Timeout | null = null
    private consecutiveUnhealthyChecks = 0

    constructor(logger: FastifyBaseLogger) {
        this.logger = logger
        this.kafkaService = new KafkaService(logger)
        this.messageProcessor = new KafkaMessageProcessor(logger)
        this.crmMessageProcessor = new CrmMessageProcessor(logger)
    }

    /**
     * Initialize the Kafka controller and start consuming messages
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            this.logger.warn('Kafka controller already initialized')
            return
        }

        try {
            this.logger.info('Initializing Kafka controller')

            // Connect to Kafka
            await this.kafkaService.connect()

            // Register topic handlers (event-emitter style)
            this.registerTopicHandlers()

            // Start consuming messages
            await this.kafkaService.startConsuming()

            // Start health monitoring
            this.startHealthMonitoring()

            this.isInitialized = true
            this.logger.info('Kafka controller initialized successfully')

        }
        catch (error) {
            this.logger.error({ error }, 'Failed to initialize Kafka controller')
            throw error
        }
    }

    private registerTopicHandlers(): void {
        // CRM topic
        this.kafkaService.onTopic(TOPICS.ROUTER_OUTGOING_CRM_EVENT, (message: KafkaMessage) =>
            this.handleMessage(message, TOPICS.ROUTER_OUTGOING_CRM_EVENT),
        )

        // Default handler for all other topics configured in KafkaService
        for (const topic of this.kafkaService.getConfig().topics) {
            if (topic === TOPICS.ROUTER_OUTGOING_CRM_EVENT) {
                continue
            }
            this.kafkaService.onTopic(topic, (message: KafkaMessage) => this.handleMessage(message, topic))
        }
    }

    /**
     * Handle incoming Kafka messages
     */
    private async handleMessage(message: KafkaMessage, topic: string): Promise<void> {
        try {
            // Route to appropriate processor based on topic
            if (topic === TOPICS.ROUTER_OUTGOING_CRM_EVENT) {
                const result = await this.crmMessageProcessor.processMessage(message)
                this.logger.info({
                    result,
                }, '====== handleMessage')
                if (!result.success) {
                    this.logger.error({
                        messageId: message.metadata.messageId,
                        flowId: message.flowId,
                        error: result.error,
                        topic,
                    }, 'CRM message processing failed')

                    // Handle retry logic based on message configuration
                    await this.handleMessageRetry(message, result)
                }
            }
            else {
                // Use regular message processor for other topics
                const result = await this.messageProcessor.processMessage(message)

                if (!result.success) {
                    this.logger.error({
                        messageId: message.metadata.messageId,
                        flowId: message.flowId,
                        error: result.error,
                        topic,
                    }, 'Message processing failed')

                    // Handle retry logic based on message configuration
                    await this.handleMessageRetry(message, result)
                }
            }

        }
        catch (error) {
            this.logger.error({
                error,
                messageId: message.metadata?.messageId,
                flowId: message.flowId,
                topic,
            }, 'Critical error handling Kafka message')

            // For critical errors, we might want to implement dead letter queue logic
            await this.handleCriticalError(message, error)
        }
    }

    /**
     * Handle message retry logic
     */
    private async handleMessageRetry(message: KafkaMessage, result: KafkaProcessingResult): Promise<void> {
        if (!message.retryConfig) {
            this.logger.info({
                messageId: message.metadata.messageId,
            }, 'No retry configuration found for failed message')
            return
        }

        const { maxRetries, retryDelayMs, exponentialBackoff } = message.retryConfig
        
        // In a production implementation, you would:
        // 1. Check current retry count (could be stored in message metadata)
        // 2. Calculate delay based on retry count and configuration
        // 3. Re-queue the message to Kafka or a retry topic
        
        this.logger.info({
            messageId: message.metadata.messageId,
            maxRetries,
            retryDelayMs,
            exponentialBackoff,
        }, 'Message queued for retry')
        
        // For now, we just log the retry attempt
        // In production, implement actual retry mechanism
    }

    /**
     * Handle critical errors that might require special handling
     */
    private async handleCriticalError(message: KafkaMessage, error: any): Promise<void> {
        this.logger.error({
            messageId: message.metadata?.messageId,
            flowId: message.flowId,
            error,
        }, 'Handling critical error for Kafka message')
        
        // In production, you might want to:
        // 1. Send message to dead letter queue
        // 2. Alert monitoring systems
        // 3. Increment error metrics
        
        // For now, we use the existing rejected promise handler
        rejectedPromiseHandler(
            Promise.reject(error),
            this.logger,
        )
    }

    /**
     * Process a single message (for testing or manual processing)
     */
    async processMessage(messageJson: string): Promise<KafkaProcessingResult> {
        try {
            await this.kafkaService.processMessage(messageJson)

            const parsedMessage = JSON.parse(messageJson) as KafkaMessage
            return {
                success: true,
                messageId: parsedMessage.metadata.messageId,
                flowId: parsedMessage.flowId,
                processingTimeMs: 0,
            }

        }
        catch (error) {
            this.logger.error({ error, messageJson }, 'Failed to process single message')
            throw error
        }
    }

    /**
     * Process multiple messages in batch
     */
    async processBatch(messages: KafkaMessage[]): Promise<KafkaProcessingResult[]> {
        this.logger.info({ messageCount: messages.length }, 'Processing message batch')
        
        try {
            return await this.messageProcessor.batchProcessMessages(messages)
        }
        catch (error) {
            this.logger.error({ error, messageCount: messages.length }, 'Failed to process message batch')
            throw error
        }
    }

    /**
     * Get health status of the Kafka system
     */
    async getHealthStatus(): Promise<KafkaHealthStatus> {
        const serviceHealth = await this.kafkaService.getHealthStatus()
        
        return {
            ...serviceHealth,
            connected: this.isInitialized && serviceHealth.connected,
        }
    }

    /**
     * Get configuration information
     */
    getConfiguration() {
        return {
            isInitialized: this.isInitialized,
            config: this.kafkaService.getConfig(),
        }
    }

    /**
     * Start health monitoring
     */
    private startHealthMonitoring(): void {
        const healthCheckIntervalMs = parseInt(process.env.KAFKA_HEALTH_CHECK_INTERVAL_MS ?? '30000')
        
        this.healthCheckInterval = setInterval(async () => {
            try {
                const health = await this.getHealthStatus()

                this.logger.debug({
                    health,
                }, 'Kafka health check')

                // Alert if error count is high
                if (health.errorCount > 100) {
                    this.logger.warn({
                        errorCount: health.errorCount,
                    }, 'High error count detected in Kafka consumer')
                }

                // Safety net: if disconnected for 2+ consecutive checks with no pending reconnect, trigger one
                if (!health.connected && this.isInitialized) {
                    this.consecutiveUnhealthyChecks++
                    if (this.consecutiveUnhealthyChecks >= 2) {
                        this.logger.warn(
                            { consecutiveUnhealthyChecks: this.consecutiveUnhealthyChecks },
                            'Kafka consumer unhealthy for multiple checks — triggering reconnect if needed',
                        )
                        this.kafkaService.triggerReconnectIfNeeded()
                    }
                }
                else {
                    this.consecutiveUnhealthyChecks = 0
                }
            }
            catch (error) {
                this.logger.error({ error }, 'Failed to get health status during monitoring')
            }

        }, healthCheckIntervalMs)
        
        this.logger.info({ 
            intervalMs: healthCheckIntervalMs, 
        }, 'Started Kafka health monitoring')
    }

    /**
     * Gracefully shutdown the Kafka controller
     */
    async shutdown(): Promise<void> {
        this.logger.info('Shutting down Kafka controller')
        
        try {
            // Stop health monitoring
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval)
                this.healthCheckInterval = null
            }
            
            // Disconnect from Kafka
            await this.kafkaService.disconnect()
            
            this.isInitialized = false
            this.logger.info('Kafka controller shutdown complete')
            
        }
        catch (error) {
            this.logger.error({ error }, 'Error during Kafka controller shutdown')
            throw error
        }
    }

    /**
     * Validate a Kafka message format
     */
    validateMessage(message: any): boolean {
        return this.messageProcessor.validateMessage(message)
    }
}