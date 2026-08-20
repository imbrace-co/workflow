import { createAction, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { privateApiRequest, buildResponse, buildErrorResponse } from '../common/api';

export const getBoard = createAction({
  name: 'get_board',
  displayName: 'List Boards',
  description: `List all boards with optional filters.

Filters (all optional):
- hidden: filter by hidden status
- isDefault: filter by default boards
- types: filter by board types (General, System, KnowledgeHub)

Use "Get Board Details" to retrieve a single board's full schema including fields.`,
  props: {
    hidden: Property.StaticDropdown({
      displayName: 'Hidden Filter',
      description: 'Filter boards by hidden status',
      required: false,
      options: {
        options: [
          { label: 'Show visible only', value: 'false' },
          { label: 'Show hidden only', value: 'true' },
        ],
      },
    }),
    isDefault: Property.StaticDropdown({
      displayName: 'Is Default Filter',
      description: 'Filter by default board status',
      required: false,
      options: {
        options: [
          { label: 'Default boards', value: 'true' },
          { label: 'Non-default boards', value: 'false' },
        ],
      },
    }),
    types: Property.Array({
      displayName: 'Board Types',
      description: 'Filter by board types. Values: General, System, KnowledgeHub',
      required: false,
    }),
  },
  async run(context) {
    const { hidden, isDefault, types } = context.propsValue;
    const organizationId = context.project.orgId || '';

    try {
      const queryParams: Record<string, string> = {};
      if (hidden !== undefined && hidden !== null) {
        queryParams['hidden'] = hidden;
      }
      if (isDefault !== undefined && isDefault !== null) {
        queryParams['is_default'] = isDefault;
      }

      const headers: Record<string, string> = {};
      if (organizationId) {
        headers['x-organization-id'] = organizationId;
      }

      let url = '/api/boards';
      if (Array.isArray(types) && types.length > 0) {
        const typesQuery = types.map((t) => `types[]=${encodeURIComponent(String(t))}`).join('&');
        const baseQuery = new URLSearchParams(queryParams).toString();
        const fullQuery = [baseQuery, typesQuery].filter(Boolean).join('&');
        if (fullQuery) url += `?${fullQuery}`;
        const data = await privateApiRequest(HttpMethod.GET, url, undefined, undefined, headers);
        const count = Array.isArray(data?.data) ? data.data.length : (Array.isArray(data) ? data.length : 0);
        return buildResponse(
          'get_board',
          data,
          `Retrieved ${count} boards.`,
          [
            'Use "Get Board Details" with a boardId to see full field schema',
            'Use "Create Board" to create a new board',
          ],
        );
      }

      const data = await privateApiRequest(HttpMethod.GET, url, undefined, queryParams, headers);
      const count = Array.isArray(data?.data) ? data.data.length : (Array.isArray(data) ? data.length : 0);

      return buildResponse(
        'get_board',
        data,
        `Retrieved ${count} boards.`,
        [
          'Use "Get Board Details" with a boardId to see full field schema',
          'Use "Create Board" to create a new board',
        ],
      );
    } catch (error) {
      return buildErrorResponse('get_board', error);
    }
  },
});
