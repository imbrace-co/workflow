export type KafkaMessage = {
    flowId: string
    projectId: string | null // Allow null for new message structure
    payload: any // Make more flexible to handle different payload structures
    metadata: KafkaMessageMetadata
    retryConfig?: KafkaRetryConfig
}

export type KafkaMessagePayload = {
    method?: string
    headers?: Record<string, string>
    body?: unknown
    queryParams?: Record<string, string>
    rawBody?: string | Buffer
    // Allow additional fields for the new message structure
    [key: string]: any
}

export type KafkaMessageMetadata = {
    messageId: string
    timestamp: string | number // Allow both string and number timestamps
    source: string
    version: string | number // Allow both string and number versions
    priority?: number
    parentRunId?: string
    failParentOnFailure?: boolean
    async?: boolean
    saveSampleData?: boolean
    execute?: boolean
    // Additional fields for new message structure
    docName?: string
    organizationId?: string | null
    businessUnitId?: string | null
    botId?: string | null
    channelId?: string | null
    credentialId?: string | null
    isInit?: boolean
    isActive?: boolean
    isDeleted?: boolean
    isReplace?: boolean
    // Additional fields for conversation messages
    conversationId?: string | null
    messageType?: string | null
    action?: string | null
    fromContact?: string | null
    isBot?: boolean
}

export type KafkaRetryConfig = {
    maxRetries: number
    retryDelayMs: number
    exponentialBackoff?: boolean
    backoffMultiplier?: number
}

export type KafkaConsumerConfig = {
    groupId: string
    topics: string[]
    brokers: string[]
    autoCommit: boolean
    maxBytesPerPartition: number
    fromBeginning: boolean
    region: string
    isAWSKafka: boolean
    kafka_aws_method: string
    sessionTimeout?: number
    heartbeatInterval?: number
}

export type KafkaProcessingResult = {
    success: boolean
    messageId: string
    flowId: string
    error?: Error
    processingTimeMs: number
}

export type KafkaHealthStatus = {
    connected: boolean
    lastProcessedMessage?: number
    consumerLag?: number
    errorCount: number
}

export type BoardField = {
    _id: string
    name: string
    type: string
    data: unknown[]
    is_deprecated?: boolean
    is_unique_identifier?: boolean
    is_default?: boolean
    hidden?: boolean
    hidden_on_record?: boolean
    is_identifier?: boolean
}

export type BoardItem = {
    _id: string
    id: string
    public_id: string
    doc_name: string
    business_unit_id: string
    organization_id: string
    board_id: string
    related_board_item_list: unknown[]
    created_by: string
    created_type: string
    fields: Record<string, unknown>
    conversation_ids: string[]
    created_at: string
    updated_at?: string
    [key: string]: unknown
}

export type Board = {
    _id: string
    id: string
    public_id: string
    doc_name: string
    business_unit_id: string
    organization_id: string
    name: string
    type: string
    fields: BoardField[]
    is_child_table: boolean
    order: number
    hidden: boolean
    managers: unknown[]
    show_id: boolean
    created_at: string
    updated_at?: string
    description?: string
    team_ids: string[]
    [key: string]: unknown
}

export type CrmPayload = {
    boardId: string
    type: 'create' | 'update' | 'delete' | 'schedule'
    board_item?: BoardItem
    board?: Board
    workflow_id: string
    updateData?: Record<string, unknown>
    is_knowledge_base?: boolean
    file?: Record<string, any>
    [key: string]: unknown
}
