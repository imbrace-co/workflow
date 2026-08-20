import { PREDEFINED_FOLDERS } from './folders-utils';
import { tags as tagDefinitions } from '@/lib/imbrace/channel';

export const AI_AGENT_CAPABILITIES = 'AI Agent Capabilities';
export const CHANNEL_WORKFLOW_FOLDER = 'Channel Workflow';

/**
 * Build tag objects for a given category name based on PREDEFINED_FOLDERS.
 * Falls back to { name: tagName } when a tag is not found in tagDefinitions.
 */
export function buildTagsForCategory(
  categoryName: string,
): Array<{ id?: string; name: string }> {
  const predefinedFolder = PREDEFINED_FOLDERS.find(
    (pf) => pf.name.toLowerCase() === categoryName.toLowerCase(),
  );
  if (predefinedFolder && 'tag' in predefinedFolder && predefinedFolder.tag) {
    return predefinedFolder.tag.map((tagName: string) => {
      const existing = tagDefinitions.find((td) => td.name === tagName);
      return existing ?? { name: tagName };
    });
  }
  return [];
}

/**
 * Check if a category name corresponds to AI Agent Capabilities.
 */
export function isAiAgentCategory(categoryName: string): boolean {
  return categoryName === AI_AGENT_CAPABILITIES;
}

/**
 * Check if a category name corresponds to Channel Workflow.
 */
export function isChannelWorkflowCategory(categoryName: string): boolean {
  return categoryName === CHANNEL_WORKFLOW_FOLDER;
}

/**
 * Build updated metadata for a category change.
 * - Sets tags based on the target category
 * - Merges AI config if provided and target is AI category
 * - Removes AI settings if moving away from AI category
 */
export function buildCategoryMetadata(
  categoryName: string,
  existingMetadata: any,
  aiConfig?: {
    description: string;
    settings: { ai: any };
  },
): any {
  const metadata: any = { ...(existingMetadata || {}) };
  metadata.tags = buildTagsForCategory(categoryName);

  if (isAiAgentCategory(categoryName) && aiConfig) {
    metadata.description = aiConfig.description;
    metadata.settings = {
      ...(existingMetadata?.settings || {}),
      ai: aiConfig.settings.ai,
    };
  } else if (!isAiAgentCategory(categoryName)) {
    // Remove AI settings when moving away from AI category
    if (metadata.settings?.ai) {
      metadata.settings = { ...metadata.settings, ai: undefined };
    }
  }

  return metadata;
}
