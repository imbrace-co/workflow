export { KafkaController } from './controller'
export { KafkaService } from './kafka.service'
export { KafkaMessageProcessor } from './kafka-message-processor'
export { CrmMessageProcessor } from './crm-message-processor'
export { kafkaModule, getKafkaController, startKafkaIfEnabled, stopKafka } from './kafka-module'
export * from './types'

// Utility functions for creating Kafka messages
export const createKafkaMessage = (params: {
    flowId: string
    projectId: string
    payload: {
        method?: string
        headers?: Record<string, string>
        body: unknown
        queryParams?: Record<string, string>
        rawBody?: string | Buffer
    }
    options?: {
        messageId?: string
        source?: string
        priority?: number
        parentRunId?: string
        failParentOnFailure?: boolean
        async?: boolean
        saveSampleData?: boolean
        execute?: boolean
        retryConfig?: {
            maxRetries: number
            retryDelayMs: number
            exponentialBackoff: boolean
        }
    }
}) => {
    const {
        flowId,
        projectId,
        payload,
        options = {},
    } = params

    return {
        flowId,
        projectId,
        payload: {
            method: payload.method || 'POST',
            headers: payload.headers || {},
            body: payload.body,
            queryParams: payload.queryParams || {},
            rawBody: payload.rawBody,
        },
        metadata: {
            messageId: options.messageId || `kafka-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            source: options.source || 'kafka',
            version: '1.0',
            priority: options.priority || 1,
            parentRunId: options.parentRunId,
            failParentOnFailure: options.failParentOnFailure || false,
            async: options.async !== undefined ? options.async : true,
            saveSampleData: options.saveSampleData || false,
            execute: options.execute !== undefined ? options.execute : true,
        },
        retryConfig: options.retryConfig,
    }
}

// Utility function to validate environment configuration
export const validateKafkaEnvironment = (): { 
    isValid: boolean
    missingVars: string[]
    warnings: string[]
} => {
    const requiredVars = [
        'KAFKA_BROKERS',
    ]
    
    const optionalVars = [
        'KAFKA_TOPIC',
        'KAFKA_CONSUMER_GROUP_ID',
        'KAFKA_AUTO_COMMIT',
        'KAFKA_MAX_BYTES_PER_PARTITION',
        'KAFKA_FROM_BEGINNING',
        'KAFKA_ENABLED',
        'KAFKA_BATCH_SIZE',
        'KAFKA_HEALTH_CHECK_INTERVAL_MS',
    ]

    const missingVars: string[] = []
    const warnings: string[] = []

    // Check required variables
    for (const varName of requiredVars) {
        if (!process.env[varName]) {
            missingVars.push(varName)
        }
    }

    // Check optional variables and provide warnings
    for (const varName of optionalVars) {
        if (!process.env[varName]) {
            warnings.push(`${varName} not set, using default value`)
        }
    }

    return {
        isValid: missingVars.length === 0,
        missingVars,
        warnings,
    }
}