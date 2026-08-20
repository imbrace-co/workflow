import { createAction, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { privateApiRequest, buildResponse, buildErrorResponse } from '../common/api';

export const getBoardDetails = createAction({
  name: 'get_board_details',
  displayName: 'Get Board Details',
  description: `Get a single board's full schema by ID, including all field definitions.

Returns the board object with:
- name, description, type, hidden, organization_id
- fields: array of field objects with name, type, data, settings, is_default, is_identifier, etc.

Use this to inspect the board schema before creating or updating records.`,
  props: {
    boardId: Property.ShortText({
      displayName: 'Board ID',
      description: 'The ID of the board to retrieve',
      required: true,
    }),
  },
  async run(context) {
    const { boardId } = context.propsValue;

    try {
      const data = await privateApiRequest(
        HttpMethod.GET,
        `/api/boards/${boardId}`,
      );

      const fieldCount = Array.isArray(data?.fields) ? data.fields.length : 0;

      return buildResponse(
        'get_board_details',
        data,
        `Retrieved board "${data?.name || boardId}" with ${fieldCount} fields.`,
        [
          'Use "Update Board" to modify this board',
          'Use "Create Board" to create a new board',
        ],
      );
    } catch (error) {
      return buildErrorResponse('get_board_details', error);
    }
  },
});
