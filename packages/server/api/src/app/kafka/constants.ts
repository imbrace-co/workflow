export const TOPICS = {
    ROUTER_OUTGOING_CRM_EVENT: 'AP_OUTGOING_CRM_EVENT',
} as const

export type KafkaTopic = keyof typeof TOPICS