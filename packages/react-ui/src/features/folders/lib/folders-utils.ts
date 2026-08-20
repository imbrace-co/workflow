import { FolderDto } from '@activepieces/shared';
import { foldersApi } from './folders-api';
import { authenticationSession } from '@/lib/authentication-session';
import { toast } from '@/components/ui/use-toast';
import { t } from 'i18next';

const CHANNEL_WORKFLOW = 'Channel Workflow';
const AI_AGENT_WORKFLOW = 'AI Agent Workflow';
const BOARD_AUTOMATION = 'Board Automation';
const AI_AGENT_CAPABILITIES = 'AI Agent Capabilities';
const OTHERS = 'Others';

export const PREDEFINED_FOLDERS = [
  {
    name: CHANNEL_WORKFLOW,
    order: 0,
  },
  // {
  //   name: AI_AGENT_WORKFLOW,
  //   tag: ['agent', 'workflow'],
  //   order: 1,
  // },
  {
    name: BOARD_AUTOMATION,
    tag: ['board', 'automation'],
    order: 2,
  },
  {
    name: AI_AGENT_CAPABILITIES,
    tag: ['agent', 'capabilities'],
    order: 3,
  },
  {
    name: OTHERS,
    tag: ['others'],
    order: 4,
  },
];

/**
 * Automatically create predefined folders
 * Skip if folder already exists
 * Can be called from anywhere in the application
 */

export const createPredefinedFolders = async (): Promise<FolderDto[]> => {
  try {
    // Get current folder list
    const existingFolders = await foldersApi.list();
    const existingFolderNames = new Set(
      existingFolders.map(folder => folder.displayName.toLowerCase())
    );

    const createdFolders: FolderDto[] = [];
    const skippedFolders: string[] = [];
    const projectId = authenticationSession.getProjectId()!;

    // Create folders that don't exist yet
    for (const predefinedFolder of PREDEFINED_FOLDERS) {
      const folderNameLower = predefinedFolder.name.toLowerCase();
      
      // Skip if folder already exists
      if (existingFolderNames.has(folderNameLower)) {
        skippedFolders.push(predefinedFolder.name);
        continue;
      }

      try {
        const newFolder = await foldersApi.create({
          displayName: predefinedFolder.name,
          projectId: projectId,
        });
        createdFolders.push(newFolder);
      } catch (error) {
        console.error(`Error creating folder "${predefinedFolder.name}":`, error);
      }
    }
    return createdFolders;
  } catch (error) {
    console.error('Error creating predefined folders:', error);
    return [];
  }
};

export const foldersUtils = {
  extractUncategorizedFlows: (
    allFlowsCount?: number,
    folders?: FolderDto[],
  ) => {
    let uncategorizedCount = allFlowsCount ?? 0;

    folders?.forEach((folder) => {
      uncategorizedCount = uncategorizedCount - folder.numberOfFlows;
    });

    return uncategorizedCount;
  },

  /**
   * Automatically create predefined folders
   * Skip if folder already exists
   */
  createPredefinedFolders,
};
