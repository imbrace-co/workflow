import { FastifyBaseLogger } from 'fastify'
import { webhookService } from '../webhooks/webhook.service'
import { WebhookFlowVersionToRun } from '../webhooks/webhook-handler'
import { EventPayload, isMultipartFile } from '@activepieces/shared'
import { KafkaMessage, KafkaMessagePayload, KafkaProcessingResult } from './types'
import { stepFileService } from '../file/step-file/step-file.service'
import { projectService } from '../project/project-service'

export class KafkaMessageProcessor {
    private logger: FastifyBaseLogger

    constructor(logger: FastifyBaseLogger) {
        this.logger = logger
    }

    async processMessage(kafkaMessage: KafkaMessage): Promise<KafkaProcessingResult> {
        const startTime = Date.now()
        
        try {
            this.logger.info({
                messageId: kafkaMessage.metadata.messageId,
                flowId: kafkaMessage.flowId,
                projectId: kafkaMessage.projectId,
                async: kafkaMessage.metadata.async,
                execute: kafkaMessage.metadata.execute,
                docName: kafkaMessage.metadata.docName,
                organizationId: kafkaMessage.metadata.organizationId,
                // Additional logging for conversation messages
                conversationId: kafkaMessage.metadata.conversationId,
                action: kafkaMessage.metadata.action,
                messageType: kafkaMessage.metadata.messageType,
                fromContact: kafkaMessage.metadata.fromContact,
                isBot: kafkaMessage.metadata.isBot,
                channelId: kafkaMessage.metadata.channelId
            }, 'Processing Kafka message')

            // Determine flow version to run based on message metadata
            const flowVersionToRun = this.determineFlowVersionToRun(kafkaMessage)
            
            // Determine if we need to save sample data
            const saveSampleData = kafkaMessage.metadata.saveSampleData || 
                                   kafkaMessage.metadata.source === 'test' ||
                                   flowVersionToRun === WebhookFlowVersionToRun.LATEST

            // Create data function that matches webhook controller pattern
            const dataFunction = (projectId: string) => this.convertKafkaToEventPayload(kafkaMessage, projectId)

            const payload = await this.convertKafkaToEventPayload(kafkaMessage, kafkaMessage.projectId ?? "default_project")

            // Use the existing webhook service to process the message (matching webhook controller logic)
            const response = await webhookService.handleWebhook({
                data: dataFunction,
                logger: this.logger,
                flowId: kafkaMessage.flowId,
                async: kafkaMessage.metadata.async ?? false, // Default to true if not specified
                saveSampleData,
                flowVersionToRun,
                execute: kafkaMessage.metadata.execute ?? true, // Default to true if not specified
                parentRunId: this.validateParentRunId(kafkaMessage.metadata.parentRunId),
                failParentOnFailure: kafkaMessage.metadata.failParentOnFailure ?? false,
            })

            const processingTime = Date.now() - startTime

            this.logger.info({
                messageId: kafkaMessage.metadata.messageId,
                flowId: kafkaMessage.flowId,
                status: response.status,
                processingTimeMs: processingTime
            }, 'Successfully processed Kafka message')

            return {
                success: true,
                messageId: kafkaMessage.metadata.messageId,
                flowId: kafkaMessage.flowId,
                processingTimeMs: processingTime
            }

        } catch (error) {
            const processingTime = Date.now() - startTime
            
            this.logger.error({
                error,
                messageId: kafkaMessage.metadata.messageId,
                flowId: kafkaMessage.flowId,
                processingTimeMs: processingTime
            }, 'Failed to publish Kafka message')

            return {
                success: false,
                messageId: kafkaMessage.metadata.messageId,
                flowId: kafkaMessage.flowId,
                error: error as Error,
                processingTimeMs: processingTime
            }
        }
    }

    private async convertKafkaToEventPayload(
        kafkaMessage: KafkaMessage,
        projectId: string
    ): Promise<EventPayload> {
        // Handle both legacy and new message structures
        const payload = kafkaMessage.payload
        
        // For new message structure, the entire payload is the data
        if (!payload.method && !payload.headers && !payload.body) {
            // New structure: use the entire payload as the body
            return {
                method: 'POST', // Default method
                headers: {}, // Default headers
                body: payload, // Entire payload becomes the body
                queryParams: {}, // Default query params
                rawBody: JSON.stringify(payload), // Raw version of the payload
            }
        }
        
        // Legacy structure: use existing payload structure
        return {
            method: payload.method || 'POST',
            headers: payload.headers || {},
            body: await this.convertKafkaBody(kafkaMessage, projectId),
            queryParams: payload.queryParams || {},
            rawBody: payload.rawBody,
        }
    }

    private async convertKafkaBody(
        kafkaMessage: KafkaMessage,
        projectId: string
    ): Promise<unknown> {
        const payload = kafkaMessage.payload
        
        // For new message structure, use the entire payload as body
        if (!payload.method && !payload.headers && !payload.body) {
            // Check if the new structure has multipart files (unlikely but handle it)
            if (payload && typeof payload === 'object' && !Array.isArray(payload) && this.hasMultipartFiles(payload as Record<string, unknown>)) {
                return await this.processMultipartFiles(payload as Record<string, unknown>, kafkaMessage.flowId, projectId)
            }
            return payload
        }
        
        // Legacy structure: process the body field
        const body = payload.body

        // Handle multipart file processing similar to webhook controller
        if (body && typeof body === 'object' && !Array.isArray(body) && this.hasMultipartFiles(body as Record<string, unknown>)) {
            return await this.processMultipartFiles(body as Record<string, unknown>, kafkaMessage.flowId, projectId)
        }

        return body
    }

    private async processMultipartFiles(
        body: Record<string, unknown>,
        flowId: string,
        projectId: string
    ): Promise<Record<string, unknown>> {
        const jsonResult: Record<string, unknown> = {}
        const bodyEntries = Object.entries(body)

        try {
            const platformId = await projectService.getPlatformId(projectId)

            for (const [key, value] of bodyEntries) {
                if (isMultipartFile(value)) {
                    const file = await stepFileService(this.logger).saveAndEnrich({
                        data: value.data as Buffer,
                        fileName: value.filename,
                        stepName: 'kafka-trigger',
                        flowId: flowId,
                        contentLength: value.data.length,
                        platformId,
                        projectId,
                    })
                    jsonResult[key] = file.url
                } else {
                    jsonResult[key] = value
                }
            }
        } catch (error) {
            this.logger.warn({
                error,
                projectId,
                flowId
            }, 'Failed to process multipart files, returning original body')
            
            // If file processing fails, return the original body
            return body
        }
        
        return jsonResult
    }

    private hasMultipartFiles(body: Record<string, unknown>): boolean {
        return Object.values(body).some(value => isMultipartFile(value))
    }

    private determineFlowVersionToRun(kafkaMessage: KafkaMessage): WebhookFlowVersionToRun {
        // Match webhook controller logic:
        // - If source is 'test' or saveSampleData is true, use LATEST (like /draft endpoints)
        // - Otherwise use LOCKED_FALL_BACK_TO_LATEST (like normal endpoints)
        
        // if (kafkaMessage.metadata.source === 'test' || 
        //     kafkaMessage.metadata.saveSampleData === true) {
        //     return WebhookFlowVersionToRun.LATEST
        // }
        
        // // For new message structure, if no specific flags are set, use LATEST by default
        // // This ensures new channel messages are processed with the latest flow version
        // if (kafkaMessage.metadata.docName && 
        //     kafkaMessage.metadata.saveSampleData === undefined &&
        //     kafkaMessage.metadata.source === 'kafka-consumer') {
        //     return WebhookFlowVersionToRun.LATEST
        // }
        
        // Default behavior matches the main webhook endpoints
        return WebhookFlowVersionToRun.LOCKED_FALL_BACK_TO_LATEST
    }

    async batchProcessMessages(messages: KafkaMessage[]): Promise<KafkaProcessingResult[]> {
        this.logger.info({ messageCount: messages.length }, 'Processing batch of Kafka messages')
        
        const results: KafkaProcessingResult[] = []
        
        // Process messages in parallel with concurrency control
        const batchSize = parseInt(process.env.KAFKA_BATCH_SIZE ?? '10')
        const batches = this.chunkArray(messages, batchSize)
        
        for (const batch of batches) {
            const batchPromises = batch.map(message => this.processMessage(message))
            const batchResults = await Promise.allSettled(batchPromises)
            
            for (let i = 0; i < batchResults.length; i++) {
                const result = batchResults[i]
                if (result.status === 'fulfilled') {
                    results.push(result.value)
                } else {
                    // Handle rejected promises
                    const message = batch[i]
                    results.push({
                        success: false,
                        messageId: message.metadata.messageId,
                        flowId: message.flowId,
                        error: new Error(result.reason),
                        processingTimeMs: 0
                    })
                }
            }
        }
        
        const successCount = results.filter(r => r.success).length
        const failureCount = results.filter(r => !r.success).length
        
        this.logger.info({
            totalMessages: messages.length,
            successCount,
            failureCount
        }, 'Completed batch processing of Kafka messages')
        
        return results
    }

    private chunkArray<T>(array: T[], chunkSize: number): T[][] {
        const chunks: T[][] = []
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize))
        }
        return chunks
    }

    validateMessage(kafkaMessage: any): kafkaMessage is KafkaMessage {
        if (!kafkaMessage) return false
        
        // Check required top-level fields
        if (!kafkaMessage.flowId || typeof kafkaMessage.flowId !== 'string') return false
        if (!kafkaMessage.payload || typeof kafkaMessage.payload !== 'object') return false
        if (!kafkaMessage.metadata || typeof kafkaMessage.metadata !== 'object') return false
        
        // Check metadata structure (updated for flexible types)
        const metadata = kafkaMessage.metadata
        if (!metadata.messageId || typeof metadata.messageId !== 'string') return false
        if (!metadata.timestamp || (typeof metadata.timestamp !== 'number' && typeof metadata.timestamp !== 'string')) return false
        if (!metadata.source || typeof metadata.source !== 'string') return false
        if (!metadata.version || (typeof metadata.version !== 'string' && typeof metadata.version !== 'number')) return false
        
        // Optional boolean fields - check if present and validate type
        if (metadata.async !== undefined && typeof metadata.async !== 'boolean') return false
        if (metadata.saveSampleData !== undefined && typeof metadata.saveSampleData !== 'boolean') return false
        if (metadata.execute !== undefined && typeof metadata.execute !== 'boolean') return false
        if (metadata.failParentOnFailure !== undefined && typeof metadata.failParentOnFailure !== 'boolean') return false
        
        // Optional fields for new message structure
        if (metadata.docName !== undefined && typeof metadata.docName !== 'string') return false
        if (metadata.organizationId !== undefined && metadata.organizationId !== null && typeof metadata.organizationId !== 'string') return false
        if (metadata.businessUnitId !== undefined && metadata.businessUnitId !== null && typeof metadata.businessUnitId !== 'string') return false
        if (metadata.botId !== undefined && metadata.botId !== null && typeof metadata.botId !== 'string') return false
        if (metadata.channelId !== undefined && metadata.channelId !== null && typeof metadata.channelId !== 'string') return false
        if (metadata.credentialId !== undefined && metadata.credentialId !== null && typeof metadata.credentialId !== 'string') return false
        if (metadata.isInit !== undefined && typeof metadata.isInit !== 'boolean') return false
        if (metadata.isActive !== undefined && typeof metadata.isActive !== 'boolean') return false
        if (metadata.isDeleted !== undefined && typeof metadata.isDeleted !== 'boolean') return false
        if (metadata.isReplace !== undefined && typeof metadata.isReplace !== 'boolean') return false
        
        // Optional fields for conversation messages
        if (metadata.conversationId !== undefined && metadata.conversationId !== null && typeof metadata.conversationId !== 'string') return false
        if (metadata.messageType !== undefined && metadata.messageType !== null && typeof metadata.messageType !== 'string') return false
        if (metadata.action !== undefined && metadata.action !== null && typeof metadata.action !== 'string') return false
        if (metadata.fromContact !== undefined && metadata.fromContact !== null && typeof metadata.fromContact !== 'string') return false
        if (metadata.isBot !== undefined && typeof metadata.isBot !== 'boolean') return false
        
        // Validate parentRunId length if present
        if (metadata.parentRunId && typeof metadata.parentRunId === 'string' && metadata.parentRunId.length > 21) {
            this.logger.warn(`Parent run ID "${metadata.parentRunId}" is too long (${metadata.parentRunId.length} chars, max 21). It will be truncated.`)
        }
        
        // Validate projectId (now nullable)
        if (kafkaMessage.projectId !== null && kafkaMessage.projectId !== undefined && typeof kafkaMessage.projectId !== 'string') {
            return false
        }
        
        return true
    }

    private validateParentRunId(parentRunId: string | null | undefined): string | undefined {
        if (!parentRunId) {
            return undefined
        }

        // Database field is varchar(21), so we need to ensure it fits
        // If it's too long, we'll truncate it and log a warning
        const maxLength = 21
        if (parentRunId.length > maxLength) {
            this.logger.warn({
                originalParentRunId: parentRunId,
                truncatedLength: maxLength
            }, 'Parent run ID too long, truncating to fit database constraint')
            
            return parentRunId.substring(0, maxLength)
        }

        return parentRunId
    }
}
