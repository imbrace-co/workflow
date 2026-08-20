import { t } from 'i18next';
import { useQuery } from '@tanstack/react-query';
import { EllipsisVertical, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { PermissionNeededTooltip } from '@/components/custom/permission-needed-tooltip';
import { ConfirmationDeleteDialog } from '@/components/delete-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthorization } from '@/hooks/authorization-hooks';
import { cn } from '@/lib/utils';
import { FolderDto, Permission, FlowOperationStatus } from '@activepieces/shared';

import { foldersApi } from '../lib/folders-api';
import { flowsApi } from '@/features/flows/lib/flows-api';
import { PREDEFINED_FOLDERS } from '../lib/folders-utils';

import { RenameFolderDialog } from './rename-folder-dialog';

type FolderActionsProps = {
  folder: FolderDto;
  hideFlowCount?: boolean;
  hideDropdown?: boolean;
  refetch: () => void;
};

export const FolderActions = ({
  folder,
  refetch,
  hideFlowCount,
  hideDropdown,
}: FolderActionsProps) => {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const { checkAccess } = useAuthorization();
  const userHasPermissionToUpdateFolders = checkAccess(Permission.WRITE_FOLDER);

  const showFlowCount = !hideFlowCount;
  const showDropdown = userHasPermissionToUpdateFolders && !hideDropdown;
  const hasOverlayBehavior = showFlowCount && showDropdown;

  // Use flows count API so sidebar numbers match FlowsTable filters (folder + tags, excluding DELETING)
  const predefinedFolder = PREDEFINED_FOLDERS.find(
    (pf) => pf.name === folder.displayName,
  );
  const defaultTags = predefinedFolder?.tag;

  const { data: countedFlows } = useQuery({
    queryKey: ['folderFlowCount', folder.id, defaultTags],
    queryFn: () =>
      flowsApi.count({
        folderId: folder.id,
        tags: defaultTags,
        operationStatus: [
          FlowOperationStatus.ENABLING,
          FlowOperationStatus.DISABLING,
          FlowOperationStatus.NONE,
        ],
      }),
  });

  const flowCountToDisplay = countedFlows ?? folder.numberOfFlows;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="flex items-center justify-center relative ml-auto"
    >
      {showFlowCount && (
        <span
          className={cn(
            'text-muted-foreground !text-xs !font-semibold self-end transition-opacity duration-150',
            buttonVariants({ size: 'icon', variant: 'ghost' }),
            {
              'opacity-100 group-hover/item:opacity-0':
                hasOverlayBehavior && !isActionMenuOpen,
              'opacity-0': hasOverlayBehavior && isActionMenuOpen,
              'opacity-100': !hasOverlayBehavior,
            },
          )}
        >
          {flowCountToDisplay}
        </span>
      )}

      {showDropdown && (
        <DropdownMenu onOpenChange={setIsActionMenuOpen} modal={true}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'transition-opacity duration-150',
                hasOverlayBehavior ? 'absolute inset-0' : '',
                {
                  'opacity-0 group-hover/item:opacity-100':
                    (hasOverlayBehavior && !isActionMenuOpen) ||
                    !hasOverlayBehavior,
                  'opacity-100': hasOverlayBehavior && isActionMenuOpen,
                },
              )}
            >
              <EllipsisVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <PermissionNeededTooltip
              hasPermission={userHasPermissionToUpdateFolders}
            >
              <RenameFolderDialog
                folderId={folder.id}
                name={folder.displayName}
                onRename={() => refetch()}
              >
                <DropdownMenuItem
                  disabled={!userHasPermissionToUpdateFolders}
                  onSelect={(e) => e.preventDefault()}
                >
                  <div className="flex flex-row gap-2 items-center">
                    <Pencil className="h-4 w-4" />
                    <span>{t('Rename')}</span>
                  </div>
                </DropdownMenuItem>
              </RenameFolderDialog>
            </PermissionNeededTooltip>

            <PermissionNeededTooltip
              hasPermission={userHasPermissionToUpdateFolders}
            >
              <ConfirmationDeleteDialog
                title={t('Delete {folderName}', {
                  folderName: folder.displayName,
                })}
                message={t(
                  'If you delete this folder, we will keep its flows and move them to Uncategorized.',
                )}
                mutationFn={async () => {
                  await foldersApi.delete(folder.id);
                  refetch();
                }}
                entityName={folder.displayName}
              >
                <DropdownMenuItem
                  disabled={!userHasPermissionToUpdateFolders}
                  onSelect={(e) => e.preventDefault()}
                >
                  <div className="flex flex-row gap-2 items-center">
                    <Trash2 className="h-4 w-4 text-destructive" />
                    <span className="text-destructive">{t('Delete')}</span>
                  </div>
                </DropdownMenuItem>
              </ConfirmationDeleteDialog>
            </PermissionNeededTooltip>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
