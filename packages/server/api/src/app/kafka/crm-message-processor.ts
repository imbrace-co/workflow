import { pinoLogging } from '@activepieces/server-shared'
import { EventPayload, Flow, FlowId } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { flowService } from '../flows/flow/flow.service'
import { WebhookFlowVersionToRun } from '../webhooks/webhook-handler'
import { webhookService } from '../webhooks/webhook.service'
import { TOPICS } from './constants'
import { CrmPayload, KafkaMessage, KafkaProcessingResult } from './types'

export class CrmMessageProcessor {
    private logger: FastifyBaseLogger

    constructor(logger: FastifyBaseLogger) {
        this.logger = logger
    }

    async processMessage(kafkaMessage: KafkaMessage): Promise<KafkaProcessingResult> {
        const startTime = Date.now()

        try {
            this.logger.info({
                ...kafkaMessage.metadata,
                messageId: kafkaMessage.metadata.messageId,
                workflowId: kafkaMessage.flowId,
                projectId: kafkaMessage.projectId,
                topic: TOPICS.ROUTER_OUTGOING_CRM_EVENT,
            }, 'Processing CRM Kafka message')

            // Extract workflowId and payload from message
            const workflowId = kafkaMessage.flowId
            const payload = kafkaMessage.payload as CrmPayload
            const isKnowledgeBase = !!payload.is_knowledge_base
            payload.boardId = kafkaMessage.payload?.board?.id ?? kafkaMessage.payload?.folder?._id ?? kafkaMessage.payload?.file?.folder_id ?? ''

            this.logger.info({ workflowId, isKnowledgeBase }, 'CRM workflowId')
            this.logger.info({ payload }, 'CRM payload')

            if (!workflowId) {
                throw new Error('Missing workflowId in CRM message')
            }

            if (!payload.boardId && !isKnowledgeBase) {
                throw new Error('Missing boardId in CRM payload')
            }

            // Validate type
            if (!payload.type || !['create', 'update', 'delete', 'schedule'].includes(payload.type)) {
                throw new Error(`Invalid type: ${payload.type}. Must be 'create', 'update', or 'delete'`)
            }

            // Find flow by workflowId (which maps to flowId)
            const flow = await this.findFlowByWorkflowId(workflowId)
            if (!flow) {
                this.logger.warn({
                    workflowId,
                    messageId: kafkaMessage.metadata.messageId,
                }, 'Flow not found for workflowId')
                return {
                    success: true,
                    messageId: kafkaMessage.metadata.messageId,
                    flowId: workflowId,
                    processingTimeMs: Date.now() - startTime,
                }
            }

            this.logger.info(flow, 'Flow found for workflowId')

            // Process based on type
            if (payload.type === 'update' && (payload.updateData || isKnowledgeBase)) {
                await this.processUpdateEvent(flow, payload, kafkaMessage)
            }
            else if (payload.type === 'create') {
                await this.processCreateEvent(flow, payload, kafkaMessage)
            }
            else if (payload.type === 'delete') {
                await this.processDeleteEvent(flow, payload, kafkaMessage)
            }
            else if (payload.type === 'schedule') {
                await this.processScheduleEvent(flow, payload, kafkaMessage)
            }

            const processingTime = Date.now() - startTime

            this.logger.info({
                messageId: kafkaMessage.metadata.messageId,
                workflowId,
                flowId: flow.id,
                boardId: payload.boardId,
                type: payload.type,
                processingTimeMs: processingTime,
            }, 'Successfully processed CRM message')

            return {
                success: true,
                messageId: kafkaMessage.metadata.messageId,
                flowId: workflowId,
                processingTimeMs: processingTime,
            }

        }
        catch (error) {
            const processingTime = Date.now() - startTime

            this.logger.error({
                err: error,
                messageId: kafkaMessage.metadata.messageId,
                workflowId: kafkaMessage.flowId,
                processingTimeMs: processingTime,
            }, 'Failed to process CRM message')

            return {
                success: false,
                messageId: kafkaMessage.metadata.messageId,
                flowId: kafkaMessage.flowId,
                error: error as Error,
                processingTimeMs: processingTime,
            }
        }
    }

    private async findFlowByWorkflowId(workflowId: string): Promise<Flow | null> {
        // First try to find by exact workflowId
        const flow = await flowService(this.logger).getOneById(workflowId)

        if (!flow) {
            // If not found, try to find flows that might have this workflowId in metadata
            // This is a fallback for cases where workflowId might be stored differently
            this.logger.info({ workflowId }, 'Flow not found by direct lookup, checking metadata')
            // Note: This would require additional implementation based on how workflowId is stored
        }

        return flow
    }

    private async processUpdateEvent(flow: Flow, payload: CrmPayload, kafkaMessage: KafkaMessage): Promise<void> {
        this.logger.info({
            flowId: flow.id,
            boardId: payload.boardId,
            updateData: payload.updateData,
        }, 'Processing CRM update event')

        // Convert CRM payload to webhook payload format
        const webhookPayload = this.convertCrmPayloadToWebhookPayload(payload, 'update')

        // Execute webhook using existing webhook service
        await this.executeWebhook(flow, webhookPayload, kafkaMessage)
    }

    private async processCreateEvent(flow: Flow, payload: CrmPayload, kafkaMessage: KafkaMessage): Promise<void> {
        this.logger.info({
            flowId: flow.id,
            boardId: payload.boardId,
        }, 'Processing CRM create event')

        const webhookPayload = this.convertCrmPayloadToWebhookPayload(payload, 'create')
        this.logger.info({ webhookPayload }, 'Webhook payload')
        await this.executeWebhook(flow, webhookPayload, kafkaMessage)
    }

    private async processDeleteEvent(flow: Flow, payload: CrmPayload, kafkaMessage: KafkaMessage): Promise<void> {
        this.logger.info({
            flowId: flow.id,
            boardId: payload.boardId,
        }, 'Processing CRM delete event')

        const webhookPayload = this.convertCrmPayloadToWebhookPayload(payload, 'delete')
        await this.executeWebhook(flow, webhookPayload, kafkaMessage)
    }

    private async processScheduleEvent(flow: Flow, payload: CrmPayload, kafkaMessage: KafkaMessage): Promise<void> {
        this.logger.info({
            flowId: flow.id,
            boardId: payload.boardId,
        }, 'Processing CRM schedule event')

        const webhookPayload = this.convertCrmPayloadToWebhookPayload(payload, 'schedule')
        await this.executeWebhook(flow, webhookPayload, kafkaMessage)
    }

    private convertCrmPayloadToWebhookPayload(payload: CrmPayload, eventType: string): EventPayload {
        const basePayload = {
            boardId: payload.boardId,
            type: payload.type,
            eventType,
            timestamp: new Date().toISOString(),
            board_item: payload.board_item,
            board: payload.board,
            workflow_id: payload.workflow_id,
            is_knowledge_base: payload.is_knowledge_base,
            file: payload.file,
            presigned_url: payload.file?.presigned_url,
        }

        // Include updateData only for update events
        if (eventType === 'update' && payload.updateData) {
            return {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CRM-Event': eventType,
                    'X-Board-ID': payload.boardId,
                    'X-Workflow-ID': payload.workflow_id,
                },
                body: {
                    ...basePayload,
                    updateData: payload.updateData,
                },
                queryParams: {},
                rawBody: JSON.stringify({
                    ...basePayload,
                    updateData: payload.updateData,
                }),
            }
        }

        // For create, delete and schedule events
        return {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CRM-Event': eventType,
                'X-Board-ID': payload.boardId,
                'X-Workflow-ID': payload.workflow_id,
            },
            body: basePayload,
            queryParams: {},
            rawBody: JSON.stringify(basePayload),
        }
    }

    private async executeWebhook(flow: Flow, payload: EventPayload, kafkaMessage: KafkaMessage): Promise<void> {
        try {
            this.logger.info({
                flow,
                payload,
                kafkaMessage,
            },
            'executeWebhook',
            )
            const response = await webhookService.handleWebhook({
                data: () => Promise.resolve(payload),
                logger: this.logger,
                flowId: flow.id,
                async: true,
                saveSampleData: false,
                flowVersionToRun: WebhookFlowVersionToRun.LOCKED_FALL_BACK_TO_LATEST,
                payload,
                execute: flow.status === 'ENABLED',
                parentRunId: kafkaMessage.metadata.parentRunId,
                failParentOnFailure: kafkaMessage.metadata.failParentOnFailure || false,
            })

            this.logger.info({
                flowId: flow.id,
                webhookStatus: response.status,
                boardId: (payload.body as { boardId: string }).boardId,
                eventType: (payload.body as { eventType: string }).eventType,
            }, 'CRM webhook executed successfully')

        }
        catch (error) {
            this.logger.error({
                error,
                flowId: flow.id,
                boardId: (payload.body as { boardId: string }).boardId,
                eventType: (payload.body as { eventType: string }).eventType,
            }, 'Failed to execute CRM webhook')

            throw error
        }
    }
}
