import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownZA,
  ArrowUpAz,
  Folder,
  Shapes,
  TableProperties,
  ChevronRight,
} from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

import { PermissionNeededTooltip } from '@/components/custom/permission-needed-tooltip';
import { Button, buttonVariants } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { TextWithIcon } from '@/components/ui/text-with-icon';
import { flowsApi } from '@/features/flows/lib/flows-api';
import { useAuthorization } from '@/hooks/authorization-hooks';
import { authenticationSession } from '@/lib/authentication-session';
import { cn } from '@/lib/utils';
import {
  FolderDto,
  FlowOperationStatus,
  isNil,
  Permission,
  UncategorizedFolderId,
} from '@activepieces/shared';

import { foldersHooks } from '../lib/folders-hooks';
import { foldersUtils, PREDEFINED_FOLDERS } from '../lib/folders-utils';

import { CreateFolderDialog } from './create-folder-dialog';
import { FolderActions } from './folder-actions';
import { CHANNEL_TYPE_OPTIONS } from '@/lib/imbrace/channel';

const FolderIcon = () => {
  return <Folder className="w-4 h-4" />;
};


type FolderItemProps = {
  folder: FolderDto;
  refetch: () => void;
  handleFolderClick: (folder: FolderDto) => void;
  selectedFolderId: string | null;
  showChannelSubmenu: boolean;
  setShowChannelSubmenu: (show: boolean) => void;
  setChannelFolderPosition: (position: { top: number; left: number } | null) => void;
  submenuHoverTimeout: NodeJS.Timeout | null;
  setSubmenuHoverTimeout: (timeout: NodeJS.Timeout | null) => void;
};

const FolderItem = ({
  folder,
  refetch,
  handleFolderClick,
  selectedFolderId,
  showChannelSubmenu,
  setShowChannelSubmenu,
  setChannelFolderPosition,
  submenuHoverTimeout,
  setSubmenuHoverTimeout,
}: FolderItemProps) => {
  const { t } = useTranslation();
  const isChannelWorkflow = folder.displayName === 'Channel Workflow';

  return (
    <div
      key={folder.id}
      className="group relative"
      onMouseEnter={(e) => {
        if (isChannelWorkflow) {
          // Clear any existing timeout
          if (submenuHoverTimeout) {
            clearTimeout(submenuHoverTimeout);
            setSubmenuHoverTimeout(null);
          }
          const rect = e.currentTarget.getBoundingClientRect();
          setChannelFolderPosition({
            top: rect.top,
            left: rect.left + rect.width
          });
          setShowChannelSubmenu(true);
        }
      }}
      onMouseLeave={() => {
        if (isChannelWorkflow) {
          // Add a small delay before hiding the submenu
          const timeout = setTimeout(() => {
            setShowChannelSubmenu(false);
            setChannelFolderPosition(null);
          }, 150);
          setSubmenuHoverTimeout(timeout);
        }
      }}
    >
      <Button
        variant="ghost"
        className={cn(
          'w-full items-center justify-start group/item gap-2 pl-4 pr-0',
          {
            'bg-accent dark:bg-accent/50': selectedFolderId === folder.id,
          },
        )}
        onClick={() => handleFolderClick(folder)}
      >
        <TextWithIcon
          className="flex-grow"
          icon={<Shapes className="w-4 h-4" />}
          text={
            <div
              className={cn(
                'flex-grow max-w-[150px] text-start truncate whitespace-nowrap overflow-hidden',
                {
                  'font-medium': selectedFolderId === folder.id,
                },
              )}
            >
              {t(folder.displayName)}
            </div>
          }
        >
          {isChannelWorkflow ? (
            <div className="flex items-center justify-center relative ml-auto">
              <span
                className={cn(
                  'text-muted-foreground !text-xs !font-semibold self-end transition-opacity duration-150',
                  buttonVariants({ size: 'icon', variant: 'ghost' }),
                )}
              >
                <ChevronRight className="w-4 h-4" />
              </span>
            </div>
          ) : (
            <FolderActions folder={folder} refetch={refetch} hideDropdown={true} />
          )}
        </TextWithIcon>
      </Button>
    </div>
  );
};

const FolderFilterList = ({ refresh }: { refresh: number }) => {
  const location = useLocation();
  const { checkAccess } = useAuthorization();
  const userHasPermissionToUpdateFolders = checkAccess(Permission.WRITE_FOLDER);
  const [searchParams, setSearchParams] = useSearchParams(location.search);
  const selectedFolderId = searchParams.get(folderIdParamName);
  const currentTags = searchParams.get('tags')?.split(',') || [];
  const [
    sortedAlphabeticallyIncreasingly,
    setSortedAlphabeticallyIncreasingly,
  ] = useState(true);
  const [showChannelSubmenu, setShowChannelSubmenu] = useState(false);
  const [channelFolderPosition, setChannelFolderPosition] = useState<{ top: number; left: number } | null>(null);
  const [submenuHoverTimeout, setSubmenuHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const { t } = useTranslation();

  const updateSearchParams = (folderId: string | undefined, tags?: string[]) => {
    const newQueryParameters: URLSearchParams = new URLSearchParams(
      searchParams,
    );
    if (folderId) {
      newQueryParameters.set(folderIdParamName, folderId);
    } else {
      newQueryParameters.delete(folderIdParamName);
    }

    // Handle tags
    if (tags && tags.length > 0) {
      newQueryParameters.set('tags', tags.join(','));
    } else {
      newQueryParameters.delete('tags');
    }

    newQueryParameters.delete('cursor');

    setSearchParams(newQueryParameters);
  };

  const handleSubmenuMouseEnter = () => {
    if (submenuHoverTimeout) {
      clearTimeout(submenuHoverTimeout);
      setSubmenuHoverTimeout(null);
    }
  };

  const handleSubmenuMouseLeave = () => {
    const timeout = setTimeout(() => {
      setShowChannelSubmenu(false);
      setChannelFolderPosition(null);
    }, 150); // Small delay to allow moving mouse back
    setSubmenuHoverTimeout(timeout);
  };

  const handleFolderClick = (folder: FolderDto) => {
    // Check if folder is a predefined folder
    const predefinedFolder = PREDEFINED_FOLDERS.find(pf => pf.name === folder.displayName);

    if (predefinedFolder) {
      if (folder.displayName === 'Channel Workflow') {
        // For Channel Workflow, auto-select web submenu
        const tags = ['web'];
        updateSearchParams(folder.id, tags);
      } else {
        // For other predefined folders, use their tags
        updateSearchParams(folder.id, predefinedFolder.tag);
      }
    } else {
      // For non-predefined folders, no tags
      updateSearchParams(folder.id);
    }
  };

  const handleSubmenuClick = (submenuId: string) => {
    // Find Channel Workflow folder
    const channelWorkflowFolder = folders?.find(f => f.displayName === 'Channel Workflow');
    if (channelWorkflowFolder) {
      const predefinedFolder = PREDEFINED_FOLDERS.find(pf => pf.name === 'Channel Workflow');
      if (predefinedFolder) {
        // Combine folder tag with submenu id
        const tags = predefinedFolder.tag ? [...predefinedFolder.tag, submenuId] : [submenuId];
        updateSearchParams(channelWorkflowFolder.id, tags);
      }
    }
    // Hide submenu after selection
    setShowChannelSubmenu(false);
    setChannelFolderPosition(null);
  };

  // Check if Channel Workflow is selected and get current submenu option
  const getChannelWorkflowStatus = () => {
    const channelWorkflowFolder = folders?.find(f => f.displayName === 'Channel Workflow');
    if (!channelWorkflowFolder || selectedFolderId !== channelWorkflowFolder.id) {
      return { isSelected: false, selectedOption: null };
    }

    const predefinedFolder = PREDEFINED_FOLDERS.find(pf => pf.name === 'Channel Workflow');
    if (!predefinedFolder) {
      return { isSelected: true, selectedOption: null };
    }

    // Check if any submenu option is selected
    const submenuOptions = ['web', 'facebook', 'whatsapp', 'line', 'wechat', 'instagram'];
    const selectedOption = submenuOptions.find(option =>
      currentTags.includes(option)
    );

    return {
      isSelected: true,
      selectedOption: selectedOption || 'web' // Default to web if no specific option selected
    };
  };

  const {
    folders,
    isLoading,
    refetch: refetchFolders,
  } = foldersHooks.useFolders();

  const { data: allFlowsCount, refetch: refetchAllFlowsCount } = useQuery({
    queryKey: ['flowsCount', authenticationSession.getProjectId()],
    queryFn: () =>
      flowsApi.count({
        folderId: undefined,
      }),
  });

  // Query to count flows for each channel type within Channel Workflow folder
  const { data: channelFlowCounts } = useQuery({
    queryKey: ['channelFlowCounts', authenticationSession.getProjectId(), refresh, folders],
    queryFn: async () => {
      const counts: Record<string, number> = {};

      // Find the Channel Workflow folder
      const channelWorkflowFolder = folders?.find(f => f.displayName === 'Channel Workflow');

      // Fetch flow count for each channel type
      for (const option of CHANNEL_TYPE_OPTIONS) {
        const count = await flowsApi.count({
          folderId: channelWorkflowFolder?.id,
          tags: [option.id],
          operationStatus: [
            FlowOperationStatus.ENABLING,
            FlowOperationStatus.DISABLING,
            FlowOperationStatus.NONE,
          ],
        });
        counts[option.id] = count;
      }

      return counts;
    },
    enabled: !!folders,
  });

  const sortedFolders = useMemo(() => {
    return folders?.sort((a, b) => {
      // Check if both folders are predefined folders
      const aPredefined = PREDEFINED_FOLDERS.find(pf => pf.name === a.displayName);
      const bPredefined = PREDEFINED_FOLDERS.find(pf => pf.name === b.displayName);

      // If both are predefined folders, sort by their order
      if (aPredefined && bPredefined) {
        return aPredefined.order - bPredefined.order;
      }

      // If only one is predefined, predefined folder comes first
      if (aPredefined && !bPredefined) {
        return -1;
      }
      if (!aPredefined && bPredefined) {
        return 1;
      }

      // If neither is predefined, sort alphabetically
      if (sortedAlphabeticallyIncreasingly) {
        return a.displayName.localeCompare(b.displayName);
      } else {
        return b.displayName.localeCompare(a.displayName);
      }
    });
  }, [folders, sortedAlphabeticallyIncreasingly]);

  useEffect(() => {
    refetchFolders();
    refetchAllFlowsCount();
  }, [refresh]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (submenuHoverTimeout) {
        clearTimeout(submenuHoverTimeout);
      }
    };
  }, [submenuHoverTimeout]);

  const isInUncategorized = selectedFolderId === UncategorizedFolderId;
  const isInAllFlows = isNil(selectedFolderId);

  return (
    <div className="mt-4">
      <div className="flex flex-row items-center mb-2">
        <span className="flex">{t('Categories')}</span>
        <div className="grow"></div>
        {/* Hidden buttons - Sort A->Z and New Folder */}
        {/* <div className="flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setSortedAlphabeticallyIncreasingly(
                !sortedAlphabeticallyIncreasingly,
              )
            }
          >
            {sortedAlphabeticallyIncreasingly ? (
              <ArrowUpAz className="w-4 h-4"></ArrowUpAz>
            ) : (
              <ArrowDownZA className="w-4 h-4"></ArrowDownZA>
            )}
          </Button>
          <PermissionNeededTooltip
            hasPermission={userHasPermissionToUpdateFolders}
          >
            <CreateFolderDialog
              refetchFolders={refetchFolders}
              updateSearchParams={updateSearchParams}
            />
          </PermissionNeededTooltip>
        </div> */}
      </div>
      <div className="flex w-[250px] h-full flex-col gap-y-1">
        <Button
          variant="accent"
          className={cn('flex w-full justify-start bg-background pl-4 pr-0', {
            'bg-muted': isInAllFlows,
          })}
          onClick={() => updateSearchParams(undefined)}
        >
          <TextWithIcon
            icon={<TableProperties className="w-4 h-4"></TableProperties>}
            text={
              <div className="flex-grow whitespace-break-spaces break-all text-start truncate">
                {t('All flows')}
              </div>
            }
          />
          <div className="grow"></div>
          <div className="flex flex-row -space-x-4">
            <span className="size-9 flex items-center justify-center text-muted-foreground">
              {allFlowsCount}
            </span>
          </div>
        </Button>
        {/* <Button
          variant="ghost"
          className={cn('flex w-full justify-start bg-background pl-4 pr-0', {
            'bg-accent dark:bg-accent/50': isInUncategorized,
          })}
          onClick={() => updateSearchParams(UncategorizedFolderId)}
        >
          <TextWithIcon
            icon={<Shapes className="w-4 h-4"></Shapes>}
            text={
              <div className="flex-grow whitespace-break-spaces break-all text-start truncate">
                {t('Uncategorized')}
              </div>
            }
          />
          <div className="grow"></div>
          <div className="flex flex-row -space-x-4">
            <span className="size-9 flex items-center justify-center text-muted-foreground">
              {foldersUtils.extractUncategorizedFlows(allFlowsCount, folders)}
            </span>
          </div>
        </Button> */}
        <Separator />
        <ScrollArea type="auto">
          <div className="flex flex-col w-full gap-y-1 max-h-[590px]">
            {isLoading && (
              <div className="flex flex-col gap-2">
                {Array.from(Array(5)).map((_, index) => (
                  <Skeleton key={index} className="rounded-md w-full h-8" />
                ))}
              </div>
            )}
            {sortedFolders &&
              sortedFolders.map((folder) => {
                return (
                  <Fragment key={folder.id}>
                    <FolderItem
                      key={folder.id}
                      folder={folder}
                      refetch={refetchFolders}
                      selectedFolderId={selectedFolderId}
                      handleFolderClick={handleFolderClick}
                      showChannelSubmenu={showChannelSubmenu}
                      setShowChannelSubmenu={setShowChannelSubmenu}
                      setChannelFolderPosition={setChannelFolderPosition}
                      submenuHoverTimeout={submenuHoverTimeout}
                      setSubmenuHoverTimeout={setSubmenuHoverTimeout}
                    />
                    <Separator />
                  </Fragment>
                );
              })}
          </div>
        </ScrollArea>

        {/* Channel Workflow Submenu */}
        {showChannelSubmenu && channelFolderPosition && (
          <div
            className="fixed bg-background border border-border rounded-md shadow-lg z-[100] w-[150px] py-1"
            style={{
              top: `${channelFolderPosition.top}px`,
              left: `${channelFolderPosition.left + 8}px`,
            }}
            onMouseEnter={handleSubmenuMouseEnter}
            onMouseLeave={handleSubmenuMouseLeave}
          >
            {CHANNEL_TYPE_OPTIONS.map((option) => {
              const channelStatus = getChannelWorkflowStatus();
              const isSelected = channelStatus.selectedOption === option.id;
              const flowCount = channelFlowCounts?.[option.id] ?? 0;

              return (
                <Button
                  key={option.name}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-2 px-3 py-2 h-auto text-sm hover:bg-accent",
                    {
                      "bg-accent": isSelected,
                      "font-medium": isSelected,
                    }
                  )}
                  onClick={() => handleSubmenuClick(option.id)}
                >
                  <img src={option.icon} alt={option.name} className="w-4 h-4" />
                  <span className="flex-grow text-start">{t(option.name)}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {flowCount}
                  </span>
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const folderIdParamName = 'folderId';
export { FolderFilterList, folderIdParamName };
