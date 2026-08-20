// UI-related constants for the flow builder

export const FLOW_BUILDER_CONSTANTS = {
  // Maximum number of branches allowed for MULTIPLE_CHOICE flow actions by channel type
  MAX_MULTIPLE_CHOICE_BRANCHES: {
    whatsapp: 8,
    webwidget: 10,
    facebook: 10,
    default: 5, // fallback for any other channel types
  },
} as const;
