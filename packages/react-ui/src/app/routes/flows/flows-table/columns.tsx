import { ColumnDef } from '@tanstack/react-table';
import { t } from 'i18next';
import { EllipsisVertical } from 'lucide-react';
import { Dispatch, SetStateAction } from 'react';

import FlowActionMenu from '@/app/components/flow-actions-menu';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RowDataWithActions } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table/data-table-column-header';
import { FlowStatusToggle } from '@/features/flows/components/flow-status-toggle';
import { formatUtils } from '@/lib/utils';
import { CHANNEL_TYPE_OPTIONS } from '@/lib/imbrace/channel';
import { PopulatedFlow } from '@activepieces/shared';

type FlowsTableColumnsProps = {
  refetch: () => void;
  refresh: number;
  setRefresh: Dispatch<SetStateAction<number>>;
  selectedRows: PopulatedFlow[];
  setSelectedRows: Dispatch<SetStateAction<PopulatedFlow[]>>;
};

export const flowsTableColumns = ({
  refetch,
  refresh,
  setRefresh,
  selectedRows,
  setSelectedRows,
}: FlowsTableColumnsProps): (ColumnDef<RowDataWithActions<PopulatedFlow>> & {
  accessorKey: string;
})[] => [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() || table.getIsSomePageRowsSelected()
        }
        variant="secondary"
        onCheckedChange={(value) => {
          const isChecked = !!value;
          table.toggleAllPageRowsSelected(isChecked);

          if (isChecked) {
            const allRowIds = table
              .getRowModel()
              .rows.map((row) => row.original);

            const newSelectedRowIds = [...allRowIds, ...selectedRows];

            const uniqueRowIds = Array.from(
              new Map(newSelectedRowIds.map((item) => [item.id, item])).values()
            );

            setSelectedRows(uniqueRowIds);
          } else {
            const filteredRowIds = selectedRows.filter((row) => {
              return !table
                .getRowModel()
                .rows.some((r) => r.original.version.id === row.version.id);
            });
            setSelectedRows(filteredRowIds);
          }
        }}
      />
    ),
    cell: ({ row }) => {
      const isChecked = selectedRows.some(
        (selectedRow) =>
          selectedRow.id === row.original.id &&
          selectedRow.status === row.original.status
      );
      return (
        <Checkbox
          variant="secondary"
          checked={isChecked}
          onCheckedChange={(value) => {
            const isChecked = !!value;
            let newSelectedRows = [...selectedRows];
            if (isChecked) {
              const exists = newSelectedRows.some(
                (selectedRow) => selectedRow.id === row.original.id
              );
              if (!exists) {
                newSelectedRows.push(row.original);
              }
            } else {
              newSelectedRows = newSelectedRows.filter(
                (selectedRow) => selectedRow.id !== row.original.id
              );
            }
            setSelectedRows(newSelectedRows);
            row.toggleSelected(!!value);
          }}
        />
      );
    },
    accessorKey: 'select',
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('Name')} />
    ),
    cell: ({ row }) => {
      const displayName = row.original.version.displayName;
      const isNew =
        Date.now() - new Date(row.original.created).getTime() <
        24 * 60 * 60 * 1000;
      return (
        <div className="text-left">
          <div className="flex items-center gap-2">
            <span>{displayName}</span>
            {isNew && (
              <div
                style={{
                  width: '40px',
                  height: '20px',
                  backgroundColor: '#FA9917',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: 'white',
                }}
              >
                New
              </div>
            )}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: 'channel',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('Channel')} />
    ),
    cell: ({ row }) => {
      // Access tags from the flow's metadata or version metadata
      const metadataTags =
        (row.original as any).metadata?.tags ||
        (row.original.version as any).metadata?.tags ||
        [];

      // Extract tag names from the tags array (tags are objects with id and name)
      const tagNames = Array.isArray(metadataTags)
        ? metadataTags
            .filter((tag) => tag !== null && tag !== undefined) // Filter out null/undefined tags
            .map((tag) => (typeof tag === 'string' ? tag : tag?.name))
            .filter((name) => name !== null && name !== undefined) // Filter out null/undefined names
        : [];

      const channelTag = CHANNEL_TYPE_OPTIONS.find((option) =>
        tagNames.includes(option.id)
      );

      return (
        <div className="text-left">
          {channelTag ? (
            <div className="flex items-center gap-2">
              <img
                src={channelTag.icon}
                alt={channelTag.name}
                className="w-5 h-5"
              />
              <span className="text-sm">{channelTag.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('Status')} />
    ),
    cell: ({ row }) => {
      return (
        <div
          className="flex items-center space-x-2"
          onClick={(e) => e.stopPropagation()}
        >
          <FlowStatusToggle flow={row.original}></FlowStatusToggle>
        </div>
      );
    },
  },
  {
    accessorKey: 'updated',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('Last modified')} />
    ),
    cell: ({ row }) => {
      const updated = row.original.updated;
      return (
        <div className="text-left font-medium min-w-[150px]">
          {formatUtils.formatDate(new Date(updated))}
        </div>
      );
    },
  },
  {
    accessorKey: 'actions',
    header: ({ column }) => <DataTableColumnHeader column={column} title="" />,
    cell: ({ row }) => {
      const flow = row.original;
      return (
        <div onClick={(e) => e.stopPropagation()}>
          <FlowActionMenu
            insideBuilder={false}
            flow={flow}
            readonly={false}
            flowVersion={flow.version}
            onRename={() => {
              setRefresh(refresh + 1);
              refetch();
            }}
            onMoveTo={() => {
              setRefresh(refresh + 1);
              refetch();
            }}
            onDuplicate={() => {
              setRefresh(refresh + 1);
              refetch();
            }}
            onDelete={() => {
              setRefresh(refresh + 1);
              refetch();
            }}
          >
            <Button variant="ghost" size="icon" className="mr-8">
              <EllipsisVertical className="h-4 w-4" />
            </Button>
          </FlowActionMenu>
        </div>
      );
    },
  },
];
