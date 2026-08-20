import { createAction, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { apwfApiRequest, buildErrorResponse } from '../common/api';


export const getPieceOptions = createAction({
  name: 'get_piece_options',
  displayName: 'Get Piece Options',
  description:
    'Fetch dynamic dropdown options for a specific property of a piece action or trigger. ' +
    'Some piece properties (e.g., selecting a Gmail label, a Slack channel, or a Google Calendar) are dynamic dropdowns that load their options at runtime. ' +
    'Use this action to retrieve those options so the AI agent can select the correct value when configuring a flow step.',
  props: {
    pieceName: Property.ShortText({
      displayName: 'Piece Name',
      description:
        'Full piece name (e.g., @activepieces/piece-gmail)',
      required: true,
    }),
    pieceVersion: Property.ShortText({
      displayName: 'Piece Version',
      description:
        'Piece version (e.g., 0.10.0). Use "Get Piece Details" to find the current version.',
      required: true,
    }),
    actionOrTriggerName: Property.ShortText({
      displayName: 'Action or Trigger Name',
      description:
        'The name of the action or trigger whose property options to fetch (e.g., send_email, new_email)',
      required: true,
    }),
    propertyName: Property.ShortText({
      displayName: 'Property Name',
      description:
        'The property name to fetch options for (e.g., label, channel, calendarId)',
      required: true,
    }),
    flowId: Property.ShortText({
      displayName: 'Flow ID',
      description: 'The flow ID that this piece step belongs to',
      required: true,
    }),
    flowVersionId: Property.ShortText({
      displayName: 'Flow Version ID',
      description: 'The flow version ID. Obtain from "Get Flow" response.',
      required: true,
    }),
    input: Property.Json({
      displayName: 'Input',
      description:
        'Current input values for the action/trigger. Pass already-configured property values (e.g., auth connection ID) so the backend can resolve dependent dropdowns.',
      required: false,
      defaultValue: {},
    }),
    imbraceToken: Property.ShortText({
      displayName: 'Imbrace Token',
      description:
        'The Imbrace authentication token required for fetching piece options',
      required: true,
    }),
    searchValue: Property.ShortText({
      displayName: 'Search Value',
      description:
        'Optional search/filter string for the dropdown options',
      required: false,
    }),
  },
  async run(context) {
    const {
      pieceName,
      pieceVersion,
      actionOrTriggerName,
      propertyName,
      flowId,
      flowVersionId,
      input,
      imbraceToken,
      searchValue,
    } = context.propsValue;
    const organizationId = context.project.orgId || '';

    try {
      const body: Record<string, unknown> = {
        pieceName,
        pieceVersion,
        actionOrTriggerName,
        propertyName,
        flowId,
        flowVersionId,
        input: input ?? {},
        imbraceToken,
      };
      if (searchValue) body['searchValue'] = searchValue;

      const data = await apwfApiRequest({
        method: HttpMethod.POST,
        path: '/v1/pieces/options',
        organizationId,
        accessToken: imbraceToken ?? context.server.imbraceToken,
        body,
      });

      return data;
    } catch (error) {
      return buildErrorResponse('get_piece_options', error);
    }
  },
});
