import { createAction, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { privateApiRequest, buildResponse, buildErrorResponse } from '../common/api';

export const updateBoard = createAction({
  name: 'update_board',
  displayName: 'Update Board Fields',
  description: `Add new fields or update existing fields on a board. Uses PUT /v1/board/:id/multiple_board_fields.

The "fields" property is a JSON array. Each entry can be a new field or an update to an existing field:

New field (no field_id):
- "name" (string, required): Field display name
- "type" (string, required): One of: ShortText, LongText, SingleSelection, MultipleSelection, Number, Time, Date, Datetime, Link, Priority, Assignee, MultipleAssignee, Email, Phone, RichText, Country, Notes, Origin, Attachment, Currency, Checkbox, MapToBoard, TableInTable
- "is_default" (boolean, optional)
- "is_identifier" (boolean, optional)
- "description" (string, optional)
- "data" (array, optional): Required for SingleSelection/MultipleSelection. Array of { "value": "Option Name" }
- "settings" (object, optional): Phone: { "default_country_code": "+66" }, Time/Datetime: { "time_zone": "Asia/Bangkok", "enable_timezone": true }
- "fields" (array, optional): Sub-fields for TableInTable type

Update existing field (with field_id):
- "field_id" (string, required): The ID of the existing field to update
- "name" (string, optional): Updated name
- "type" (string, optional): Updated type
- "description" (string, optional): Updated description

Example:
[
  { "name": "New Text Field", "type": "ShortText" },
  { "name": "Status", "type": "SingleSelection", "data": [{ "value": "Open" }, { "value": "Closed" }] },
  { "field_id": "abc123", "name": "Renamed Field", "description": "Updated desc" },
  { "name": "Sub Table", "type": "TableInTable", "fields": [{ "name": "Col 1", "type": "ShortText", "is_identifier": true }, { "name": "Col 2", "type": "Number" }] }
]`,
  props: {
    boardId: Property.ShortText({
      displayName: 'Board ID',
      description: 'The ID of the board to update',
      required: true,
    }),
    fields: Property.Json({
      displayName: 'Fields',
      description: 'JSON array of field definitions to add or update (see action description for schema)',
      required: true,
    }),
  },
  async run(context) {
    const { boardId, fields: fieldsRaw } = context.propsValue;
    const organizationId = context.project.orgId || '';

    try {
      const parsedFields = typeof fieldsRaw === 'string' ? JSON.parse(fieldsRaw) : fieldsRaw;
      if (!Array.isArray(parsedFields)) {
        throw new Error('Fields must be a JSON array of field definitions');
      }

      const headers: Record<string, string> = {};
      if (organizationId) {
        headers['x-organization-id'] = organizationId;
      }

      const data = await privateApiRequest(
        HttpMethod.PUT,
        `/api/boards/${boardId}/fields/bulk`,
        { fields: parsedFields },
        undefined,
        headers,
      );

      const newCount = parsedFields.filter((f: any) => !f.field_id).length;
      const updateCount = parsedFields.filter((f: any) => f.field_id).length;
      const parts = [];
      if (newCount > 0) parts.push(`${newCount} new`);
      if (updateCount > 0) parts.push(`${updateCount} updated`);

      return buildResponse(
        'update_board',
        data,
        `Updated board ${boardId} fields (${parts.join(', ')}).`,
        [
          'Use "Get Board Details" to verify the changes',
        ],
      );
    } catch (error) {
      return buildErrorResponse('update_board', error);
    }
  },
});
