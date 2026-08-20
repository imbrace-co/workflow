import { createAction, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { apwfApiRequest, buildResponse, buildErrorResponse } from '../common/api';

export const listPieces = createAction({
  name: 'list_pieces',
  displayName: 'List Pieces',
  description:
    'List all available pieces (integrations) with summary metadata including display name, description, logo, and categories. Use searchQuery to filter by name.',
  props: {
    searchQuery: Property.ShortText({
      displayName: 'Search Query',
      description: 'Filter pieces by name or keyword',
      required: false,
    }),
    includeTags: Property.Checkbox({
      displayName: 'Include Tags',
      description: 'Include tags in the response',
      required: false,
      defaultValue: false,
    }),
  },
  async run(context) {
    const { searchQuery, includeTags } = context.propsValue;
    const organizationId = context.project.orgId || '';

    try {
      const data = await apwfApiRequest({
        method: HttpMethod.GET,
        path: '/v1/pieces',
        organizationId,
        accessToken: context.server.imbraceToken,
        queryParams: {
          searchQuery: searchQuery ?? undefined,
          includeTags: includeTags ? 'true' : undefined,
        },
      });

      const pieces = Array.isArray(data) ? data : data.data || data;
      const count = pieces.length;

      const topPieces = pieces
        .slice(0, 5)
        .map((p: any) => {
          const actionCount = p.actions
            ? Object.keys(p.actions).length
            : 0;
          const triggerCount = p.triggers
            ? Object.keys(p.triggers).length
            : 0;
          return `${p.displayName} (${actionCount} actions, ${triggerCount} triggers)`;
        })
        .join(', ');

      const searchNote = searchQuery
        ? ` matching "${searchQuery}"`
        : '';

      return buildResponse(
        'list_pieces',
        data,
        `Found ${count} piece(s)${searchNote}.${topPieces ? ` Top results: ${topPieces}.` : ''}`,
        [
          'Use "Get Piece Details" with a pieceName to see all actions, triggers, and their property schemas',
          'Use piece names when configuring flow triggers and actions via "Apply Flow Operation"',
          'Use "List Connections" with a pieceName to check if the user has connections for a specific piece',
        ]
      );
    } catch (error) {
      return buildErrorResponse('list_pieces', error);
    }
  },
});
