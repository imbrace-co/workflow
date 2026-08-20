import { pinoLogging } from '@activepieces/server-shared'
import { generateAuthToken } from 'aws-msk-iam-sasl-signer-js'
import { FastifyBaseLogger } from 'fastify'
import { Admin, Consumer, Kafka, KafkaConfig, logLevel } from 'kafkajs'
import { TOPICS } from './constants'
import { TopicEventEmitter } from './topic-event-emitter'
import { KafkaConsumerConfig, KafkaHealthStatus, KafkaMessage } from './types'

const BASE_RECONNECT_DELAY_MS = 2000
const MAX_RECONNECT_DELAY_MS = 60000

export class KafkaService {
    private kafka: Kafka
    private consumer: Consumer | null = null
    private admin: Admin | null = null
    private logger: FastifyBaseLogger
    private isConnected = false
    private lastProcessedMessage = 0
    private errorCount = 0
    private config: KafkaConsumerConfig
    private isRunning = false
    private reconnectAttempts = 0
    private reconnectTimer: NodeJS.Timeout | null = null
    private reconnectStartedAt: number | null = null
    private kafkajsInternalRestart = false
    private isRebalancing = false
    private rebalanceTimeout: NodeJS.Timeout | null = null
    private readonly maxReconnectAttempts: number
    private readonly topicEmitter = new TopicEventEmitter<string, KafkaMessage>()

    constructor(logger: FastifyBaseLogger) {
        this.logger = pinoLogging.createRunContextLog({
            log: logger,
            runId: 'kafka-service',
            webhookId: '',
            flowId: '',
            flowVersionId: '',
        })

        this.maxReconnectAttempts = parseInt(process.env.KAFKA_MAX_RECONNECT_ATTEMPTS ?? '0') // 0 = unlimited
        this.config = this.loadConfig()
        this.kafka = this.createKafkaClient()
    }

    private loadConfig(): KafkaConsumerConfig {
        const topics = process.env.KAFKA_TOPIC ?
            process.env.KAFKA_TOPIC.split(',').map(topic => topic.trim()) :
            ['AP_INCOMING_MESSAGE']

        return {
            groupId: process.env.KAFKA_CONSUMER_GROUP_ID ?? 'activepieces-flows',
            sessionTimeout: 30000, // 60 seconds
            heartbeatInterval: 3000, // 3 seconds (must be < sessionTimeout / 3)
            topics,
            brokers: (process.env.KAFKA_ENDPOINT ?? 'localhost:9092').split(',').map(broker => broker.trim()),
            autoCommit: (process.env.KAFKA_AUTO_COMMIT ?? 'false') === 'true',
            maxBytesPerPartition: parseInt(process.env.KAFKA_MAX_BYTES_PER_PARTITION ?? '1048576'), // 1MB
            fromBeginning: (process.env.KAFKA_FROM_BEGINNING ?? 'false') === 'true',
            region: process.env.KAFKA_AWS_REGION ?? 'ap-east-1',
            isAWSKafka: (process.env.KAFKA_IS_AWS_KAFKA ?? 'false') === 'true',
            kafka_aws_method: process.env.KAFKA_AWS_METHOD ?? 'IAM',
        }
    }

    private async oauthBearerTokenProvider(region: string) {
        try {
            // Uses AWS Default Credentials Provider Chain to fetch credentials
            const authTokenResponse = await generateAuthToken({ region })
            this.logger.info({ authTokenResponse }, 'AWS Kafka auth token generated successfully')
            return {
                value: authTokenResponse.token,
            }
        }
        catch (error) {
            this.logger.error({ error }, 'Failed to generate AWS Kafka auth token')
            throw error
        }
    }

    private createKafkaClient(): Kafka {
        // Get SSL and SASL configuration from environment
        const ssl = process.env.KAFKA_USE_SSL === 'true'
        const sasl = process.env.KAFKA_USE_SASL === 'true'
        const saslMechanism = process.env.KAFKA_SASL_MECHANISM ?? 'plain'
        const username = process.env.KAFKA_SASL_USERNAME
        const password = process.env.KAFKA_SASL_PASSWORD
        const clientId = process.env.KAFKA_CLIENT_ID ?? 'activepieces-consumer'
        const rejectUnauthorized = process.env.KAFKA_SSL_REJECT_UNAUTHORIZED

        // Base Kafka configuration
        let kafkaConfig: KafkaConfig = {
            clientId,
            brokers: this.config.brokers,
            logLevel: logLevel.ERROR,
            retry: {
                initialRetryTime: 100,
                retries: 10, // Increased retries like in KafkaController
                maxRetryTime: 30000,
                factor: 2,
                multiplier: 2,
                restartOnFailure: async (e) => {
                    this.logger.error({ error: e }, 'Kafka restart required')
                    return true
                },
            },
            connectionTimeout: 3000,
            requestTimeout: 30000,
        }

        // Add SSL configuration (using logic from KafkaController)
        if (ssl) {
            if (rejectUnauthorized === 'false') {
                kafkaConfig.ssl = {
                    rejectUnauthorized: false,
                }
            }
            else {
                kafkaConfig.ssl = true
            }
        }

        // Add SASL configuration if enabled (using logic from KafkaController)
        if (sasl) {
            if (!(username && password)) {
                throw new Error(
                    'Kafka SASL is activated but no username and password got defined. Please set KAFKA_SASL_USERNAME and KAFKA_SASL_PASSWORD environment variables.',
                )
            }
            kafkaConfig.sasl = {
                username,
                password,
                mechanism: saslMechanism as any, // KafkaJS supports 'plain', 'scram-sha-256', 'scram-sha-512'
            }
        }

        if (this.config.isAWSKafka) {
            kafkaConfig = {
                clientId,
                brokers: this.config.brokers,
                logLevel: logLevel.ERROR,
                retry: {
                    initialRetryTime: 100,
                    retries: 10, // Increased retries like in KafkaController
                    maxRetryTime: 30000,
                    factor: 2,
                    multiplier: 2,
                    restartOnFailure: async (e) => {
                        this.logger.error({ error: e }, 'Kafka restart required')
                        return true
                    },
                },
                connectionTimeout: 3000,
                requestTimeout: 30000,
                ssl: true,
                sasl: {
                    mechanism: 'oauthbearer',
                    oauthBearerProvider: () => this.oauthBearerTokenProvider(this.config.region),
                },
            }
        }

        this.logger.info({
            clientId,
            brokers: this.config.brokers,
            ssl: ssl ? 'enabled' : 'disabled',
            sasl: sasl ? 'enabled' : 'disabled',
            saslMechanism: sasl ? saslMechanism : undefined,
        }, 'Kafka client configuration')

        return new Kafka(kafkaConfig)
    }

    async connect(): Promise<void> {
        try {
            this.logger.info('Connecting to Kafka...')

            // Create consumer using config values for session/heartbeat
            this.consumer = this.kafka.consumer({
                groupId: this.config.groupId,
                sessionTimeout: this.config.sessionTimeout ?? 60000,
                heartbeatInterval: this.config.heartbeatInterval ?? 3000,
                maxWaitTimeInMs: 5000, // 5 seconds
                rebalanceTimeout: 60000, // 60 seconds
                maxBytesPerPartition: this.config.maxBytesPerPartition,
                retry: {
                    initialRetryTime: 100,
                    retries: 8,
                },
            })

            this.consumer.on('consumer.crash', async (event) => {
                this.logger.error({ event }, 'Kafka consumer CRASHED')
                this.isConnected = false

                // If kafkajs is handling restart internally (restartOnFailure returned true),
                // skip app-level reconnect to avoid double-reconnect conflicts
                if ((event.payload as any)?.restart) {
                    this.logger.info('KafkaJS is handling restart internally — skipping app-level reconnect')
                    this.kafkajsInternalRestart = true
                    return
                }

                // Only auto-reconnect if the consumer is supposed to be running
                if (this.isRunning) {
                    await this.scheduleReconnect()
                }
            })

            this.consumer.on('consumer.disconnect', async (event) => {
                this.logger.warn({ event, isRebalancing: this.isRebalancing, kafkajsInternalRestart: this.kafkajsInternalRestart }, 'Kafka consumer DISCONNECTED')
                this.isConnected = false

                // During rebalance or KafkaJS-managed restart, don't trigger app-level reconnect
                if (this.isRebalancing) {
                    this.logger.info('Skipping reconnect — rebalance in progress, KafkaJS will rejoin')
                    return
                }
                if (this.kafkajsInternalRestart) {
                    this.logger.info('Skipping reconnect — KafkaJS internal restart in progress')
                    return
                }

                // Only auto-reconnect if the consumer is supposed to be running
                if (this.isRunning) {
                    await this.scheduleReconnect()
                }
            })

            this.consumer.on('consumer.stop', (event) => {
                this.logger.info({ event }, 'Kafka consumer STOPPED')
                this.isConnected = false
            })

            // Track rebalancing — fires when the consumer group starts a rebalance
            this.consumer.on('consumer.rebalancing', (event) => {
                this.logger.info({ event }, 'Kafka consumer REBALANCING')
                this.isRebalancing = true

                // Safety timeout: if rebalance doesn't complete within rebalanceTimeout + buffer,
                // clear the flag and let health monitoring trigger reconnect if needed
                if (this.rebalanceTimeout) clearTimeout(this.rebalanceTimeout)
                this.rebalanceTimeout = setTimeout(() => {
                    if (this.isRebalancing) {
                        this.logger.warn('Rebalance did not complete within timeout — clearing rebalance flag')
                        this.isRebalancing = false
                    }
                }, 90000) // 90s = rebalanceTimeout(60s) + 30s buffer
            })

            // Track successful group joins — this fires after both internal and app-level reconnects
            this.consumer.on('consumer.group_join', (event) => {
                this.logger.info({ event }, 'Kafka consumer GROUP_JOIN')
                this.isConnected = true
                this.isRebalancing = false
                this.kafkajsInternalRestart = false
                this.reconnectAttempts = 0
                this.reconnectStartedAt = null
                if (this.rebalanceTimeout) {
                    clearTimeout(this.rebalanceTimeout)
                    this.rebalanceTimeout = null
                }
            })

            // Create admin client for health checks
            this.admin = this.kafka.admin()

            // Connect consumer and admin
            await this.consumer.connect()
            await this.admin.connect()

            // Subscribe to topic
            await this.consumer.subscribe({
                topics: this.config.topics,
                fromBeginning: this.config.fromBeginning,
            })

            this.isConnected = true
            this.logger.info({
                topics: this.config.topics,
                groupId: this.config.groupId,
                brokers: this.config.brokers,
                fromBeginning: this.config.fromBeginning,
                autoCommit: this.config.autoCommit,
            }, 'Connected to Kafka')

        }
        catch (error) {
            this.isConnected = false
            this.errorCount++
            this.logger.error({ error }, 'Failed to connect to Kafka')
            throw error
        }
    }

    private isCoordinatorError(error: unknown): boolean {
        const msg = error instanceof Error ? error.message : String(error)
        return (
            msg.includes('coordinator is not aware of this member') ||
            msg.includes('The coordinator is not aware of this member') ||
            msg.includes('UNKNOWN_MEMBER_ID') ||
            msg.includes('NOT_COORDINATOR') ||
            msg.includes('REBALANCE_IN_PROGRESS')
        )
    }

    /**
     * Commit the offset for a specific topic/partition after successful processing.
     * The committed offset is message.offset + 1 (next offset to read).
     */
    private async commitOffset(consumer: Consumer, topic: string, partition: number, offset: string): Promise<void> {
        const maxRetries = 3
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                await consumer.commitOffsets([
                    {
                        topic,
                        partition,
                        offset: (BigInt(offset) + 1n).toString(),
                    },
                ])
                return
            }
            catch (error) {
                if (this.isCoordinatorError(error) && attempt < maxRetries - 1) {
                    this.logger.warn({ topic, partition, offset, attempt }, 'Coordinator error during offset commit — retrying')
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
                    continue
                }
                if (this.isCoordinatorError(error)) {
                    this.logger.error({ topic, partition, offset, error }, 'Offset commit failed after retries — triggering reconnect')
                    this.isConnected = false
                    if (this.isRunning) {
                        await this.scheduleReconnect()
                    }
                }
                else {
                    this.logger.error({ topic, partition, offset, error }, 'Failed to commit offset')
                }
                return
            }
        }
    }

    /**
     * Schedule a reconnect attempt with exponential backoff.
     * This is the key mechanism that keeps the consumer alive after
     * session timeouts, network failures, or rebalance-induced disconnects.
     */
    private async scheduleReconnect(): Promise<void> {
        if (this.reconnectTimer) {
            return // reconnect already scheduled
        }

        if (this.maxReconnectAttempts > 0 && this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.error(
                { attempts: this.reconnectAttempts, maxAttempts: this.maxReconnectAttempts },
                'Max reconnect attempts reached — Kafka consumer will remain disconnected. Server continues running.',
            )
            return
        }

        if (this.reconnectStartedAt === null) {
            this.reconnectStartedAt = Date.now()
        }

        const delay = Math.min(
            BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts),
            MAX_RECONNECT_DELAY_MS,
        )
        this.reconnectAttempts++

        // Log every attempt at info level for first 5, then only every 10 attempts to reduce noise
        if (this.reconnectAttempts <= 5 || this.reconnectAttempts % 10 === 0) {
            const elapsedSec = Math.round((Date.now() - this.reconnectStartedAt) / 1000)
            this.logger.warn(
                { attempt: this.reconnectAttempts, delayMs: delay, elapsedSeconds: elapsedSec },
                'Scheduling Kafka consumer reconnect',
            )
        }

        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null
            try {
                // Tear down existing consumer / admin
                if (this.consumer) {
                    try { await this.consumer.disconnect() }
                    catch { /* already disconnected */ }
                    this.consumer = null
                }
                if (this.admin) {
                    try { await this.admin.disconnect() }
                    catch { /* already disconnected */ }
                    this.admin = null
                }

                // Recreate the Kafka client to clear stale TCP state
                this.kafka = this.createKafkaClient()

                // Reconnect and resume
                await this.connect()
                await this.startConsuming()
                this.reconnectAttempts = 0
                this.reconnectStartedAt = null
                this.logger.info('Kafka consumer reconnected successfully')
            }
            catch (error) {
                this.logger.error({ error, attempt: this.reconnectAttempts }, 'Reconnect attempt failed')
                // Try again
                await this.scheduleReconnect()
            }
        }, delay)
    }

    /**
     * Trigger a reconnect if the consumer is disconnected and no reconnect is already in progress.
     * Used by health monitoring as a safety net.
     */
    triggerReconnectIfNeeded(): void {
        if (this.kafkajsInternalRestart) {
            this.logger.info('Skipping health-check reconnect — kafkajs internal restart is in progress')
            return
        }
        if (!this.isConnected && !this.reconnectTimer && this.isRunning) {
            this.logger.warn('Health check detected disconnected consumer with no pending reconnect — triggering reconnect')
            this.scheduleReconnect()
        }
    }

    /**
     * Register a handler for a given Kafka topic.
     * Note: handlers are invoked from the consumer loop; ensure they are fast and handle errors.
     */
    onTopic(topic: string, handler: (message: KafkaMessage) => Promise<void> | void): void {
        this.topicEmitter.addListener(topic, handler)
    }

    async startConsuming(): Promise<void> {
        if (!this.consumer) {
            throw new Error('Consumer not initialized. Call connect() first.')
        }

        if (!this.isConnected) {
            throw new Error('Not connected to Kafka. Call connect() first.')
        }

        this.isRunning = true
        this.reconnectAttempts = 0
        this.logger.info('Starting Kafka message consumption')

        const consumer = this.consumer

        try {
            await consumer.run({
                autoCommit: this.config.autoCommit,
                eachMessage: async ({ topic, partition, message, heartbeat }) => {
                    const startTime = Date.now()
                    let parsedMessage: KafkaMessage | null = null

                    // Send periodic heartbeats during processing to prevent
                    // session timeout eviction when handlers take >60s
                    const heartbeatTimer = setInterval(async () => {
                        try {
                            await heartbeat()
                        }
                        catch (e) {
                            this.logger.warn({ topic, partition, offset: message.offset }, 'Heartbeat failed during message processing')
                        }
                    }, this.config.heartbeatInterval ?? 3000)

                    this.logger.info({
                        topic,
                        partition,
                    }, '====== Received Kafka message')

                    try {
                        if (!message.value) {
                            this.logger.warn({ topic, partition, offset: message.offset }, 'Received empty message')
                            // Commit even empty messages so the consumer advances
                            if (!this.config.autoCommit) {
                                await this.commitOffset(consumer, topic, partition, message.offset)
                            }
                            return
                        }

                        parsedMessage = topic === TOPICS.ROUTER_OUTGOING_CRM_EVENT
                            ? this.parseCRMMessage(message.value.toString())
                            : this.parseMessage(message.value.toString())

                        this.logger.info({
                            topic,
                            partition,
                            offset: message.offset,
                        }, 'Emitting Kafka message')

                        // Await the handler to ensure processing completes before committing
                        await this.topicEmitter.emitAsync(topic, parsedMessage)

                        this.lastProcessedMessage = Date.now()
                        const processingTime = Date.now() - startTime

                        this.logger.info({
                            messageId: parsedMessage.metadata.messageId,
                            flowId: parsedMessage.flowId,
                            processingTimeMs: processingTime,
                        }, 'Successfully consumed Kafka message')

                        // Manually commit offset after successful processing
                        if (!this.config.autoCommit) {
                            await this.commitOffset(consumer, topic, partition, message.offset)
                        }

                    }
                    catch (error) {
                        const processingTime = Date.now() - startTime

                        this.logger.error({
                            error,
                            messageId: parsedMessage?.metadata.messageId,
                            flowId: parsedMessage?.flowId,
                            topic,
                            partition,
                            offset: message.offset,
                            processingTimeMs: processingTime,
                        }, 'Failed to consume Kafka message')

                        // Still commit the offset to avoid getting stuck on a poison message.
                        // In production you may want to send to a dead-letter topic instead.
                        if (!this.config.autoCommit) {
                            await this.commitOffset(consumer, topic, partition, message.offset)
                        }
                    }
                    finally {
                        clearInterval(heartbeatTimer)
                    }
                },
            })
        }
        catch (error) {
            this.logger.error({ error }, 'Error starting Kafka consumer')
            throw error

        }

    }

    async processMessage(messageValue: string): Promise<void> {
        const startTime = Date.now()
        let parsedMessage: KafkaMessage | null = null

        try {
            parsedMessage = this.parseMessage(messageValue)

            this.logger.info({
                messageId: parsedMessage.metadata.messageId,
                flowId: parsedMessage.flowId,
                topics: this.config.topics,
            }, 'Processing Kafka message')

            // Emit using the first topic as a default for manual processing.
            this.topicEmitter.emit(this.config.topics[0], parsedMessage)

            this.lastProcessedMessage = Date.now()
            const processingTime = Date.now() - startTime

            this.logger.info({
                messageId: parsedMessage.metadata.messageId,
                flowId: parsedMessage.flowId,
                processingTimeMs: processingTime,
            }, 'Successfully processed Kafka message')

        }
        catch (error) {
            this.errorCount++
            const processingTime = Date.now() - startTime

            this.logger.error({
                error,
                messageId: parsedMessage?.metadata.messageId,
                flowId: parsedMessage?.flowId,
                topics: this.config.topics,
                processingTimeMs: processingTime,
            }, 'Failed to process Kafka message')

            await this.handleProcessingError(error, parsedMessage)
            throw error
        }
    }

    private parseCRMMessage(messageValue: string): KafkaMessage {
        try {
            this.logger.info({ messageValue }, 'parseCRMMessage - messageValue')
            const parsed = JSON.parse(messageValue)

            // this.logger.info({ parsed }, 'Parsed Kafka message')

            // Handle new message structure - detect by presence of new structure fields
            // Check for workflow_id (number), workflow_id_str (string), or other new structure indicators
            const workflowId = parsed.workflow_id
            this.logger.info({ workflowId }, '===== workflowId')
            if (workflowId && workflowId?.length > 10) {
                // Generate a message ID from available identifiers
                const messageId = parsed._id ||
                    parsed.id ||
                    parsed.conversation_id ||
                    `msg_${workflowId || 'unknown'}_${Date.now()}`

                // New structure: transform to expected KafkaMessage format
                const transformedMessage: KafkaMessage = {
                    flowId: workflowId ? workflowId.toString() : `fallback_${parsed.organization_id || 'unknown'}_${Date.now()}`, // Convert workflow_id or workflow_id_str to flowId
                    projectId: parsed?.board?.organization_id || parsed?.board_item?.organization_id || null, // Use organization_id as projectId
                    payload: parsed, // The entire message becomes the payload
                    metadata: {
                        messageId,
                        timestamp: parsed.updated_at || parsed.created_at || new Date().toISOString(),
                        source: 'kafka-consumer',
                        version: parsed.version || 1,
                        // Handle different message types
                        docName: parsed.doc_name || parsed.object_name || 'message',
                        organizationId: parsed?.board?.organization_id || parsed?.board_item?.organization_id || null,
                        businessUnitId: parsed?.board?.business_unit_id || parsed?.board_item?.business_unit_id || null,
                        botId: parsed.bot_id || null,
                        channelId: parsed.channel_id || parsed.public_id || null,
                        credentialId: parsed.credential_id || null,
                        // Handle conversation message fields
                        conversationId: parsed.conversation_id || null,
                        messageType: parsed.type || null,
                        action: parsed.action || null,
                        fromContact: parsed.from || null,
                        isBot: parsed.is_bot || false,
                        // Handle channel message fields  
                        isInit: parsed.is_init || false,
                        isActive: parsed.active !== undefined ? parsed.active : true, // Default to true if not specified
                        isDeleted: parsed.is_deleted || false,
                        isReplace: parsed.is_replace || false,
                        // Workflow execution settings
                        failParentOnFailure: false,
                        async: true,
                        saveSampleData: false,
                        execute: true,
                    },
                    retryConfig: {
                        maxRetries: 3,
                        retryDelayMs: 1000,
                        exponentialBackoff: true,
                        backoffMultiplier: 2,
                    },
                }

                this.logger.info({
                    transformedMessage,
                }, 'Transformed message from new structure')

                return transformedMessage
            }

            // Legacy structure: validate required fields
            if (!parsed.flowId || !parsed.payload || !parsed.metadata) {
                throw new Error('Invalid message format: missing required fields (flowId, payload, metadata)')
            }

            return parsed as KafkaMessage
        }
        catch (error) {
            this.logger.error({ error, messageValue }, 'Failed to parse Kafka message')
            throw new Error(`Invalid JSON message: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    private parseMessage(messageValue: string): KafkaMessage {
        try {
            const parsed = JSON.parse(messageValue)

            // this.logger.info({ parsed }, 'Parsed Kafka message')

            // Handle new message structure - detect by presence of new structure fields
            // Check for workflow_id (number), workflow_id_str (string), or other new structure indicators
            const workflowId = parsed.workflow_id_str
            this.logger.info({ workflowId }, '===== workflowId')
            const isNewStructure = workflowId ||
                (parsed.organization_id && parsed.object_name) ||
                (parsed.conversation_id && parsed.action)

            if (workflowId && workflowId?.length > 10) {
                // Generate a message ID from available identifiers
                const messageId = parsed._id ||
                    parsed.id ||
                    parsed.conversation_id ||
                    `msg_${workflowId || 'unknown'}_${Date.now()}`

                // New structure: transform to expected KafkaMessage format
                const transformedMessage: KafkaMessage = {
                    flowId: workflowId ? workflowId.toString() : `fallback_${parsed.organization_id || 'unknown'}_${Date.now()}`, // Convert workflow_id or workflow_id_str to flowId
                    projectId: parsed.organization_id || parsed.project_id || null, // Use organization_id as projectId
                    payload: parsed, // The entire message becomes the payload
                    metadata: {
                        messageId,
                        timestamp: parsed.updated_at || parsed.created_at || new Date().toISOString(),
                        source: 'kafka-consumer',
                        version: parsed.version || 1,
                        // Handle different message types
                        docName: parsed.doc_name || parsed.object_name || 'message',
                        organizationId: parsed.organization_id || null,
                        businessUnitId: parsed.business_unit_id || null,
                        botId: parsed.bot_id || null,
                        channelId: parsed.channel_id || parsed.public_id || null,
                        credentialId: parsed.credential_id || null,
                        // Handle conversation message fields
                        conversationId: parsed.conversation_id || null,
                        messageType: parsed.type || null,
                        action: parsed.action || null,
                        fromContact: parsed.from || null,
                        isBot: parsed.is_bot || false,
                        // Handle channel message fields  
                        isInit: parsed.is_init || false,
                        isActive: parsed.active !== undefined ? parsed.active : true, // Default to true if not specified
                        isDeleted: parsed.is_deleted || false,
                        isReplace: parsed.is_replace || false,
                        // Workflow execution settings
                        failParentOnFailure: false,
                        async: true,
                        saveSampleData: false,
                        execute: true,
                    },
                    retryConfig: {
                        maxRetries: 3,
                        retryDelayMs: 1000,
                        exponentialBackoff: true,
                        backoffMultiplier: 2,
                    },
                }

                // this.logger.info({
                //     originalWorkflowId: parsed.workflow_id,
                //     originalWorkflowIdStr: parsed.workflow_id_str,
                //     resolvedWorkflowId: workflowId,
                //     transformedFlowId: transformedMessage.flowId,
                //     messageId: transformedMessage.metadata.messageId,
                //     docName: transformedMessage.metadata.docName,
                //     organizationId: transformedMessage.metadata.organizationId,
                //     projectId: transformedMessage.projectId,
                //     messageType: parsed.object_name || 'unknown',
                // }, 'Transformed message from new structure')

                return transformedMessage
            }

            // Legacy structure: validate required fields
            if (!parsed.flowId || !parsed.payload || !parsed.metadata) {
                throw new Error('Invalid message format: missing required fields (flowId, payload, metadata)')
            }

            return parsed as KafkaMessage
        }
        catch (error) {
            this.logger.error({ error, messageValue }, 'Failed to parse Kafka message')
            throw new Error(`Invalid JSON message: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    private async handleProcessingError(error: any, message: KafkaMessage | null): Promise<void> {
        const shouldRetry = this.shouldRetryMessage(error)

        if (shouldRetry && message?.retryConfig) {
            this.logger.info({
                messageId: message.metadata.messageId,
                retryConfig: message.retryConfig,
            }, 'Message will be retried')

            // In a real implementation, you would re-queue the message
            // or use Kafka's built-in retry mechanisms
        }

        const shouldPause = this.shouldPauseOnError(error)
        if (shouldPause) {
            this.logger.warn('Pausing consumer due to critical error')

            // Implement pause logic - in production this would pause the Kafka consumer
            setTimeout(() => {
                this.logger.info('Resumed consumer after error')
            }, 30000) // 30 second pause
        }
    }

    private shouldRetryMessage(error: any): boolean {
        const retryableErrors = [
            'NETWORK_ERROR',
            'TIMEOUT',
            'SERVICE_UNAVAILABLE',
        ]

        const errorMessage = error?.message || error?.toString() || ''
        return retryableErrors.some(retryableError => errorMessage.includes(retryableError))
    }

    private shouldPauseOnError(error: any): boolean {
        const criticalErrors = [
            'ECONNREFUSED',
            'TIMEOUT',
            'Database connection lost',
            'QUOTA_EXCEEDED',
        ]

        const errorMessage = error?.message || error?.toString() || ''
        return criticalErrors.some(criticalError => errorMessage.includes(criticalError))
    }

    async disconnect(): Promise<void> {
        try {
            this.isRunning = false

            // Cancel any pending reconnect
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer)
                this.reconnectTimer = null
            }

            // Cancel any pending rebalance timeout
            if (this.rebalanceTimeout) {
                clearTimeout(this.rebalanceTimeout)
                this.rebalanceTimeout = null
            }
            this.isRebalancing = false

            if (this.consumer) {
                await this.consumer.disconnect()
                this.consumer = null
            }

            if (this.admin) {
                await this.admin.disconnect()
                this.admin = null
            }

            this.isConnected = false
            this.logger.info('Disconnected from Kafka')
        }
        catch (error) {
            this.logger.error({ error }, 'Error disconnecting from Kafka')
            throw error
        }
    }

    async getHealthStatus(): Promise<KafkaHealthStatus> {
        const lag = await this.getConsumerLag()

        return {
            connected: this.isConnected && this.isRunning,
            lastProcessedMessage: this.lastProcessedMessage || undefined,
            consumerLag: lag >= 0 ? lag : undefined,
            errorCount: this.errorCount,
        }
    }

    async getConsumerLag(): Promise<number> {
        if (!this.admin) {
            return -1
        }

        try {
            const offsets = await this.admin.fetchOffsets({
                groupId: this.config.groupId,
                topics: this.config.topics,
            })

            // Calculate total lag across all partitions
            let totalLag = 0
            for (const topicOffset of offsets) {
                for (const partition of topicOffset.partitions) {
                    const lag = parseInt(partition.offset)
                    if (!isNaN(lag)) {
                        totalLag += lag
                    }
                }
            }

            return totalLag
        }
        catch (error) {
            this.logger.error({ error }, 'Failed to fetch consumer lag')
            return -1
        }
    }

    getConfig(): KafkaConsumerConfig {
        return { ...this.config }
    }
}
