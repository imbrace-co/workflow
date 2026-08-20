import { createAction, Property, PropertyContext } from '@activepieces/pieces-framework';
import { callImbracePrivateApi, imbraceApiRequest } from '../common/api';
import { HttpMethod } from '@activepieces/pieces-common';
import { IBoard } from '../common/types';
import { relations } from '../utils/board';

let cachedImbraceToken: string | undefined;
let cachedOrganizationId: string | undefined;

export const recordLinkerAction = createAction({
  // auth: check https://www.activepieces.com/docs/developers/piece-reference/authentication,
  name: 'recordLinker',
  displayName: 'Record Linker',
  description: 'Link record(s) to a specified board',
  props: {
    organizationId: Property.ShortText({
      displayName: 'Organization ID',
      required: true,
    }),
    action: Property.StaticDropdown({
      displayName: 'Action',
      required: true,
      options: {
        placeholder: 'Click to select',
        options: [
          {
            label: 'Link Existing Record',
            value: 'link',
          },
          {
            label: 'Remove Association',
            value: 'unlink',
          },
        ],
      },
      defaultValue: 'link',
    }),
    sourceBoardId: Property.Dropdown({
      displayName: 'Data Board',
      description: 'Available for CRM boards',
      required: true,
      refreshers: [],
      options: async (propsValue: Record<string, unknown>,
        ctx: PropertyContext) => {
        cachedImbraceToken = ctx.server.imbraceToken;
        console.log('cachedImbraceToken', cachedImbraceToken);

        // Fetch organization_id if not already cached
        if (cachedImbraceToken && !cachedOrganizationId) {
          try {
            const selectedOrg = await imbraceApiRequest(
              HttpMethod.GET,
              `/platform/v1/account`,
              {},
              false,
              cachedImbraceToken
            );
            cachedOrganizationId = selectedOrg?.organization_id;
          } catch (e) {
            console.error('Failed to fetch organization:', e);
          }
        }
        if (!cachedImbraceToken) {
          return {
            disabled: true,
            options: [],
            placeholder: 'Connect your account first',
          };
        }

        try {
          // TODO: Replace with actual API client call
          const endpoint = '/data-board/boards?limit=0&is_default=true';
          const organizationId = (propsValue['organizationId'] as string) || cachedOrganizationId;
          const boardData = await imbraceApiRequest(HttpMethod.GET, endpoint, undefined, false, cachedImbraceToken, {
            'x-organization-id': organizationId || '',
          });

          // Placeholder - implement with your API client
          if (!boardData?.data) return { disabled: false, options: [] };

          // Return sorted options: getSortedOptions(boardData.data, 'name', '_id', 'description')
          return {
            disabled: false,
            options: [
              ...boardData.data.map((board: IBoard) => ({
                label: board.name,
                value: board._id,
              })),
            ],
            placeholder: 'Click to select',
          };
        } catch (error) {
          console.error('Error fetching source boards:', error);
          return {
            disabled: true,
            options: [],
            placeholder: 'Error loading boards',
          };
        }
      },
    }),
    sourceRecordId: Property.ShortText({
      displayName: 'Record ID',
      required: true,
    }),
    targetBoardId: Property.Dropdown({
      displayName: 'Target Data Board',
      description: 'Available for CRM boards',
      required: true,
      refreshers: ['sourceBoardId'],
      options: async (propsValue: Record<string, unknown>,
        ctx: PropertyContext) => {
          cachedImbraceToken = ctx.server.imbraceToken;
        if (!cachedImbraceToken || !propsValue['sourceBoardId']) {
          return {
            disabled: true,
            options: [],
            placeholder: 'Connect your account first and select source board',
          };
        }

        try {
          // TODO: Replace with actual API client call
          const endpoint = '/data-board/boards?limit=0&is_default=true';
          const organizationId = (propsValue['organizationId'] as string) || cachedOrganizationId;
          const boardData = await imbraceApiRequest(HttpMethod.GET, endpoint, undefined, false, cachedImbraceToken, {
            'x-organization-id': organizationId || '',
          });

          // Placeholder - implement with your API client
          if (!boardData?.data) return { disabled: false, options: [] };

          // Find the source board to get its type
          const sourceBoard = boardData.data.find((board: IBoard) => board._id === propsValue['sourceBoardId']);

          // Filter boards based on relations mapping
          const relationBoards = boardData.data.filter((board: IBoard) =>
            relations[sourceBoard.type].includes(board.type)
          ) || [];

          // Return sorted options: getSortedOptions(relationBoards, 'name', '_id', 'description')
          return {
            disabled: false,
            options: [
              // Example format:
              ...relationBoards.map((board: IBoard) => ({
                label: board.name,
                value: board._id,
              })),
            ],
            placeholder: 'Click to select',
          };
        } catch (error) {
          console.error('Error fetching target boards:', error);
          return {
            disabled: true,
            options: [],
            placeholder: 'Error loading boards',
          };
        }
      },
    }),
    targetRecordIds: Property.ShortText({
      displayName: 'Target Record IDs',
      description: 'Multiple record IDs can be separated by comma, eg: bi_1, bi_2, bi_3, ...',
      required: true,
    }),
  },
  async run(context) {
    const { action, sourceBoardId, sourceRecordId, targetBoardId, targetRecordIds, organizationId } = context.propsValue;

    // Parse comma-separated target record IDs and filter out empty strings
    const targetIds = targetRecordIds
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);

    try {
      const responses = await Promise.all(
        targetIds.map(async (targetRecId) => {
          const method = action === 'link' ? HttpMethod.POST : HttpMethod.DELETE;
          const endpoint = `/data-board/boards/${sourceBoardId}/items/${sourceRecordId}/related`;
          const body = {
            related_board_id: targetBoardId,
            related_board_item_id: targetRecId,
          };
          return callImbracePrivateApi(method, endpoint, body, {
            'x-organization-id': organizationId || context.project.orgId || '',
          });
        })
      );

      return {
        success: true,
        action,
        sourceBoardId,
        sourceRecordId,
        targetBoardId,
        targetRecordIds: targetIds,
        responses,
      };
    } catch (error) {
      // Handle API errors
      console.error(`[Record Linker] Error:`, error);
      throw new Error(`Failed to ${action} records: ${error}`);
    }
  },
});
