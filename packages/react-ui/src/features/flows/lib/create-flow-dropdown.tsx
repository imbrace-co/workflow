import { t } from 'i18next';
import { ChevronDown, Plus, Upload } from 'lucide-react';
import { useState } from 'react';

import { PermissionNeededTooltip } from '@/components/custom/permission-needed-tooltip';
import { useEmbedding } from '@/components/embed-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { foldersApi } from '@/features/folders/lib/folders-api';
import { useAuthorization } from '@/hooks/authorization-hooks';
import { cn } from '@/lib/utils';
import { Permission, Metadata } from '@activepieces/shared';
import { tags } from '@/lib/imbrace/channel';
import {
  AI_AGENT_CAPABILITIES,
  CHANNEL_WORKFLOW_FOLDER,
} from '@/features/folders/lib/category-utils';

import { ImportFlowDialog } from '../components/import-flow-dialog';
import {
  CreateFlowSettingsDialog,
  CreateFlowSettingsResult,
} from '../components/create-flow-settings-dialog';

import { folderIdParamName } from '@/features/folders/component/folder-filter-list';
import { flowsHooks } from './flows-hooks';

type CreateFlowDropdownProps = {
  refetch: () => void | null;
  variant?: 'default' | 'small';
  className?: string;
  folderId?: string;
};

export const CreateFlowDropdown = ({
  refetch,
  variant = 'default',
  className,
  folderId,
}: CreateFlowDropdownProps) => {
  const { checkAccess } = useAuthorization();
  const doesUserHavePermissionToWriteFlow = checkAccess(Permission.WRITE_FLOW);
  const [refresh, setRefresh] = useState(0);
  const { embedState } = useEmbedding();
  const { mutate: createWebhookFlow, isPending: isCreateWebhookFlowPending } =
    flowsHooks.useCreateWebhookFlow();

  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [pendingFolderName, setPendingFolderName] = useState('');

  const handleCreateFromScratch = async () => {
    // Read fresh searchParams from current URL to avoid stale closures
    const currentUrl = new URL(window.location.href);
    const freshFolderId = currentUrl.searchParams.get(folderIdParamName);
    const freshTags =
      currentUrl.searchParams.get('tags')?.split(',') || [];

    // Prefer folderId from URL (current view); fallback to prop
    const effectiveFolderId = freshFolderId ?? folderId;
    const folder =
      effectiveFolderId && effectiveFolderId !== 'NULL'
        ? await foldersApi.get(effectiveFolderId)
        : undefined;

    // If folder is AI Agent Capabilities, show the settings dialog
    if (folder?.displayName === AI_AGENT_CAPABILITIES) {
      setPendingFolderName(folder.displayName);
      setSettingsDialogOpen(true);
      return;
    }

    // Otherwise, create flow directly (existing logic)
    const flowTags = freshTags.map((tag) => {
      const existing = tags.find((t) => t.name === tag);
      return existing ?? { name: tag };
    });

    let metaData: Metadata = {};
    if (flowTags.length > 0) {
      metaData.tags = flowTags as any;
    }

    createWebhookFlow({
      folderName: folder?.displayName,
      metadata:
        Object.keys(metaData).length > 0 ? metaData : undefined,
    });
  };

  const handleSettingsConfirm = (result: CreateFlowSettingsResult) => {
    createWebhookFlow({
      folderName: result.folderName,
      metadata:
        Object.keys(result.metadata).length > 0
          ? result.metadata
          : undefined,
    });
  };

  return (
    <PermissionNeededTooltip hasPermission={doesUserHavePermissionToWriteFlow}>
      <DropdownMenu modal={false}>
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger
              disabled={!doesUserHavePermissionToWriteFlow}
              asChild
              className={cn(className)}
            >
              <Button
                disabled={!doesUserHavePermissionToWriteFlow}
                variant={variant === 'small' ? 'ghost' : 'default'}
                size={variant === 'small' ? 'icon' : 'default'}
                loading={isCreateWebhookFlowPending}
                onClick={(e) => e.stopPropagation()}
                data-testid="new-flow-button"
              >
                {variant === 'small' ? (
                  <Plus className="h-4 w-4" />
                ) : (
                  <>
                    <span>{t('New Flow')}</span>
                    <ChevronDown className="h-4 w-4 ml-2 " />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side={variant === 'small' ? 'right' : 'bottom'}>
            {t('New flow')}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent>
          <DropdownMenuItem
            onSelect={async (e) => {
              e.preventDefault();
              handleCreateFromScratch();
            }}
            disabled={isCreateWebhookFlowPending}
            data-testid="new-flow-from-scratch-button"
          >
            <Plus className="h-4 w-4 me-2" />
            <span>{t('From scratch')}</span>
          </DropdownMenuItem>
          {!embedState.hideExportAndImportFlow && (
            <ImportFlowDialog
              insideBuilder={false}
              onRefresh={() => {
                setRefresh(refresh + 1);
                if (refetch) refetch();
              }}
            >
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                disabled={!doesUserHavePermissionToWriteFlow}
              >
                <Upload className="h-4 w-4 me-2" />
                {t('From local file')}
              </DropdownMenuItem>
            </ImportFlowDialog>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateFlowSettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        defaultCategory={pendingFolderName}
        onConfirm={handleSettingsConfirm}
      />
    </PermissionNeededTooltip>
  );
};
