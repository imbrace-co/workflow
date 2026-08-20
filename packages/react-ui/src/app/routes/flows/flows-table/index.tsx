import { useQuery } from '@tanstack/react-query';
import { t } from 'i18next';
import { CheckIcon, Workflow } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useEmbedding } from '@/components/embed-provider';
import { DataTable, DataTableFilters } from '@/components/ui/data-table';
import { appConnectionsQueries } from '@/features/connections/lib/app-connections-hooks';
import { flowsApi } from '@/features/flows/lib/flows-api';
import { useFlowsBulkActions } from '@/features/flows/lib/use-flows-bulk-actions';
import {
  FolderFilterList,
  folderIdParamName,
} from '@/features/folders/component/folder-filter-list';
import { piecesHooks } from '@/features/pieces/lib/pieces-hooks';
import { authenticationSession } from '@/lib/authentication-session';
import { useNewWindow } from '@/lib/navigation-utils';
import { formatUtils } from '@/lib/utils';
import {
  FlowStatus,
  FlowOperationStatus,
  PopulatedFlow,
  UncategorizedFolderId,
} from '@activepieces/shared';

import { flowsTableColumns } from './columns';
import { foldersHooks } from '@/features/folders/lib/folders-hooks';
import { CreateFlowDropdown } from '@/features/flows/lib/create-flow-dropdown';

type FlowsTableProps = {
  refetch?: () => void;
};
export const FlowsTable = ({ refetch: parentRefetch }: FlowsTableProps) => {
  const { embedState } = useEmbedding();
  const openNewWindow = useNewWindow();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [refresh, setRefresh] = useState(0);
  const [selectedRows, setSelectedRows] = useState<Array<PopulatedFlow>>([]);
  
  // Project ID is now auto-resolved from organization context on backend
  const { folders } = foldersHooks.useFolders();


  const { data, isLoading, refetch } = useQuery({
    queryKey: ['flow-table', searchParams.toString(), refresh],
    staleTime: 0,
    queryFn: () => {
      const name = searchParams.get('name');
      const status = searchParams.getAll('status') as FlowStatus[];
      const cursor = searchParams.get('cursor');
      const limit = searchParams.get('limit')
        ? parseInt(searchParams.get('limit')!)
        : 10;
      const tags = searchParams.get('tags')?.split(',') ?? undefined;
      const folderId = searchParams.get(folderIdParamName) ?? undefined;
      const connectionExternalId =
        searchParams.getAll('connectionExternalId') ?? undefined;

      return flowsApi.list({
        cursor: cursor ?? undefined,
        limit,
        name: name ?? undefined,
        status,
        folderId,
        tags,
        operationStatus: [FlowOperationStatus.ENABLING, FlowOperationStatus.DISABLING, FlowOperationStatus.NONE],
      });
    },
  });


  const handleRefetch = useCallback(() => {
    refetch();
    if (parentRefetch) {
      parentRefetch();
    }
  }, [refetch, parentRefetch]);

  const columns = useMemo(() => {
    return flowsTableColumns({
      refetch: handleRefetch,
      refresh,
      setRefresh,
      selectedRows,
      setSelectedRows,
    });
  }, [refresh, selectedRows]);

  const filters: DataTableFilters<
    keyof PopulatedFlow | 'connectionExternalId' | 'name'
  >[] = [
    {
      type: 'input',
      title: t('Flow name'),
      accessorKey: 'name',
      icon: CheckIcon,
    },
    {
      type: 'select',
      title: t('Status'),
      accessorKey: 'status',
      options: Object.values(FlowStatus).map((status) => {
        return {
          label: t(formatUtils.convertEnumToHumanReadable(status)),
          value: status,
        };
      }),
      icon: CheckIcon,
    } as const,
  ];

  const bulkActions = useFlowsBulkActions({
    selectedRows,
    refresh,
    setSelectedRows,
    setRefresh,
    refetch: handleRefetch,
    folderId: searchParams.get(folderIdParamName) ?? UncategorizedFolderId,
  });

  const customActions = [
    <CreateFlowDropdown key="new-flow-button" refetch={handleRefetch} />
  ];

  let descriptionNode = null;
  const selectedFolderId = searchParams.get('folderId');
  const selectedFolder = folders?.find((f) => f.id === selectedFolderId);
  const name = selectedFolder?.displayName;
  let text = '';
  if (name === 'Channel Workflow') {
    text = t('Triggered by cross-channel activities (WhatsApp, WeChat, Line, Facebook, Instagram, etc.)');
  } else if (name === 'Board Automation') {
    text = t('Workflows that connect and automate records between boards.');
  } else if (name === 'AI Agent Capabilities') {
    text = t("Extend your AI Agents' functions, like responding or syncing data.");
  } else if (name === 'Others') {
    text = t("Miscellaneous workflows that don't fit the above categories.");
  }

  if (name) {
      descriptionNode = (
        <span>
          <span style={{ fontSize: '14px', fontWeight: 'bold' }} className="font-semibold text-black dark:text-white">{t(name)}</span>
          <span style={{ fontSize: '14px', color: '#828282' }} className="ml-2">{text}</span>
        </span>
      );
  }

  return (
    <div className="flex flex-row gap-8" style={{ height: 'calc(100vh - 200px)' }}>
      {!embedState.hideFolders && (
        <FolderFilterList key="folder-filter" refresh={refresh} />
      )}
      <div className="overflow-hidden w-full h-full flex flex-col">
        <DataTable
          emptyStateTextTitle={t('No flows found')}
          emptyStateTextDescription={t('Create a workflow to start automating')}
          emptyStateIcon={<Workflow className="size-14" />}
          description={descriptionNode}
          columns={columns.filter(
            (column) =>
              !embedState.hideFolders || column.accessorKey !== 'folderId',
          )}
          page={data}
          isLoading={isLoading}
          filters={filters}
          bulkActions={bulkActions}
          onRowClick={(row, newWindow) => {
            if (newWindow) {
              openNewWindow(
                authenticationSession.appendProjectRoutePrefix(
                  `/flows/${row.id}`,
                ),
              );
            } else {
              navigate(
                authenticationSession.appendProjectRoutePrefix(
                  `/flows/${row.id}`,
                ),
              );
            }
          }}
        />
      </div>
    </div>
  );
};
