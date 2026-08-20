import { createAction, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { privateApiRequest, buildResponse, buildErrorResponse } from '../common/api';

export const createBoard = createAction({
  name: 'create_board',
  displayName: 'Create Board',
  description: `Create a new databoard with fields.

The "fields" property is a JSON array of field definitions. Each field object has:
- "name" (string, required): Field display name
- "type" (string, required): One of: ShortText, LongText, SingleSelection, MultipleSelection, Number, Time, Date, Datetime, Link, Priority, Assignee, MultipleAssignee, Email, Phone, RichText, Country, Notes, Origin, Attachment, Currency, Checkbox, MapToBoard, TableInTable
- "is_default" (boolean, optional): Whether this is a default field
- "is_identifier" (boolean, optional): Whether this field is the board identifier
- "data" (array, optional): Required for SingleSelection and MultipleSelection. Array of { "value": "Option Name" }
- "settings" (object, optional): Field-specific settings:
  - Phone: { "default_country_code": "+66" }
  - Time/Datetime: { "time_zone": "Asia/Bangkok", "enable_timezone": true }

Example fields:
[
  { "name": "Name", "type": "ShortText", "is_default": true, "is_identifier": true },
  { "name": "Status", "type": "SingleSelection", "data": [{ "value": "Open" }, { "value": "Closed" }] },
  { "name": "Count", "type": "Number" },
  { "name": "Due Date", "type": "Date" },
  { "name": "Phone", "type": "Phone", "settings": { "default_country_code": "+66" } }
]`,
  props: {
    name: Property.ShortText({
      displayName: 'Board Name',
      description: 'Name of the new board',
      required: true,
    }),
    description: Property.LongText({
      displayName: 'Description',
      description: 'Board description',
      required: false,
    }),
    type: Property.StaticDropdown({
      displayName: 'Board Type',
      description: 'Type of the board',
      required: false,
      defaultValue: 'General',
      options: {
        options: [
          { label: 'General', value: 'General' },
          { label: 'Knowledge Hub', value: 'KnowledgeHub' },
        ],
      },
    }),
    hidden: Property.Checkbox({
      displayName: 'Hidden',
      description: 'Whether the board is hidden',
      required: false,
      defaultValue: false,
    }),
    fields: Property.Json({
      displayName: 'Fields',
      description: 'JSON array of field definitions (see action description for schema)',
      required: true,
    }),
  },
  async run(context) {
    const { name, description, type, hidden, fields } = context.propsValue;
    const organizationId = context.project.orgId || '';

    try {
      const data = await privateApiRequest(
        HttpMethod.POST,
        '/api/boards',
        {
          name,
          description: description || undefined,
          type: type || 'General',
          hidden: hidden ?? false,
          fields,
        },
        undefined,
        {
          'x-organization-id': organizationId,
        },
      );

      const boardId = data?._id || data?.id || 'unknown';
      const fieldCount = Array.isArray(fields) ? fields.length : 0;

      return buildResponse(
        'create_board',
        data,
        `Created board "${name}" (${boardId}) with ${fieldCount} fields.`,
        [
          'Use "Get Board" to verify the board was created correctly',
          'Use "Update Board" to modify board settings',
        ],
      );
    } catch (error) {
      return buildErrorResponse('create_board', error);
    }
  },
});
