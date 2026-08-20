import { createAction, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { apwfApiRequest, buildResponse, buildErrorResponse } from '../common/api';

export const getPieceDetails = createAction({
  name: 'get_piece_details',
  displayName: 'Get Piece Details',
  description:
    'Get full metadata for a specific piece including all available actions, triggers, and their property schemas. Use the full piece name (e.g., @activepieces/piece-slack).',
  props: {
    pieceName: Property.ShortText({
      displayName: 'Piece Name',
      description:
        'Full piece name (e.g., @activepieces/piece-slack) or short name (e.g., piece-slack)',
      required: true,
    }),
  },
  async run(context) {
    const { pieceName } = context.propsValue;
    const organizationId = context.project.orgId || '';

    try {
      // Handle scoped names like @activepieces/piece-slack
      let path: string;
      if (pieceName.includes('/')) {
        const parts = pieceName.split('/');
        const scope = encodeURIComponent(parts[0]);
        const name = encodeURIComponent(parts.slice(1).join('/'));
        path = `/v1/pieces/${scope}/${name}`;
      } else {
        path = `/v1/pieces/${encodeURIComponent(pieceName)}`;
      }

      const data = await apwfApiRequest({
        method: HttpMethod.GET,
        path,
        organizationId,
        accessToken: context.server.imbraceToken,
      });

      const actions = data.actions ? Object.keys(data.actions) : [];
      const triggers = data.triggers ? Object.keys(data.triggers) : [];
      const actionNames =
        actions.length > 5
          ? actions.slice(0, 5).join(', ') + `, ... (${actions.length} total)`
          : actions.join(', ');
      const triggerNames =
        triggers.length > 5
          ? triggers.slice(0, 5).join(', ') +
            `, ... (${triggers.length} total)`
          : triggers.join(', ');
      const authType = data.auth?.type || 'NONE';

      return buildResponse(
        'get_piece_details',
        data,
        `Piece "${data.displayName || pieceName}" v${data.version || '?'}. Actions: ${actionNames || 'none'} (${actions.length} total). Triggers: ${triggerNames || 'none'} (${triggers.length} total). Auth: ${authType}.`,
        [
          'Use action names and their props when calling "Apply Flow Operation" with ADD_ACTION or UPDATE_ACTION',
          'Use trigger names when calling "Apply Flow Operation" with UPDATE_TRIGGER',
          'Each action/trigger has a "props" object describing required and optional input fields',
          `Use "List Connections" with pieceName "${pieceName}" to check available connections for this piece`,
        ]
      );
    } catch (error) {
      return buildErrorResponse('get_piece_details', error);
    }
  },
});
