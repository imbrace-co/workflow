// src/lib/actions/autoDataBoard.ts
import {
  createAction,
  DynamicPropsValue,
  InputPropertyMap,
  Property,
  ActionContext,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import moment from 'moment';

// 🔗 Local helpers
import {
  fetchBoardList,
  getCurrencies,
  callImbracePrivateApi,
  getBoardDetailsApi,
  getBoardFieldForIdentifier,
  imbraceApiRequest,
  imbraceApiRequestPrivateService,
} from '../common/api';
import { originalSources } from '../common/constants';
import type { IBoard, IBoardField } from '../common/types';
import {
  checkIfAdditionalFieldsExists,
  getTableInTableFields,
  errorMessages,
  handleOperationError,
  processItemFields,
  handleString,
  validEmptyString,
  isObject,
} from '../common/general-functions';
import {
  checkAndFormatFieldValue,
  getBoardFieldById,
  getIdentifierField,
  getFilterName,
  validateFilterValue,
  splitOriginTypeString,
  convertDateToISOString,
  isDate,
  setWorkflowOutputHistory,
} from '../utils/board';
import {
  getSortedOptions,
  formatPhoneNumberWithCountryCallingCode,
} from '../utils/index';
import { countries } from '../../constants/contryData';

type ChooseAction =
  | 'create'
  | 'update'
  | 'deleteRecord'
  | 'getAll'
  | 'search'
  | 'boardDetails';

type InputMethod = 'field' | 'json';
type Identifier = 'fieldsOnBoard' | 'recordId';

// JSON input mode maps content keys to board fields by name but passes the
// values RAW — unlike field mode, which formats each value via
// checkAndFormatFieldValue. data-board parses Date/Datetime/Time fields with
// new Date(v).toISOString(), so a non-parseable value throws a 500
// "Invalid time value" that aborts the WHOLE record (real case: SWIFT LC field
// 44C "Latest Date of Shipment" = "SEE FIELD 45A" in a Date column).
// Coerce ONLY an INVALID temporal value to null (matching field mode); VALID
// values pass through raw so data-board's own parsing is unchanged (avoids any
// moment-vs-UTC date shift), and every other field type keeps its raw value too.
// Nested TIT/MapToBoard rows are structured arrays and are skipped.
const TEMPORAL_FIELD_TYPES = new Set(['Date', 'Datetime', 'Time']);

function sanitizeTemporalFields(
  itemFields: any[],
  board: IBoard,
  tableInTableFieldMap: { [key: string]: IBoard }
): any[] {
  return itemFields.map((f) => {
    const fieldId = f.board_field_id ?? f.key;
    if (tableInTableFieldMap[fieldId]) return f;
    const boardField = getBoardFieldById(board, fieldId);
    if (!boardField || !TEMPORAL_FIELD_TYPES.has(boardField.type)) return f;
    if (f.value === null || f.value === undefined || f.value === '') return f;
    return isDate(f.value) ? f : { ...f, value: null };
  });
}

// Builds Meilisearch filter strings (one per field) from {field, value} pairs,
// handling every board field type. Shared by the `search` action and the
// filtered `getAll` path so both stay in lockstep. Pairs missing a field or
// value are skipped. The output strings are joined with ' AND ' by callers.
function buildMeilisearchFilters(
  actionPairs: Array<Record<string, any>>,
  board: IBoard,
  extras: {
    boardFieldType?: any;
    originalSource?: any;
    currencyCode?: any;
  } = {}
): string[] {
  const filters: string[] = [];

  for (const pair of actionPairs) {
    const fieldId = pair['field'];
    const fieldValue = pair['value'];

    if (!fieldId || !fieldValue) {
      continue; // Skip empty pairs
    }

    const searchField: Record<string, any> = {
      field: fieldId,
      value: fieldValue,
      boardFieldType: extras.boardFieldType,
      originalSource: extras.originalSource,
      currencyCode: extras.currencyCode,
    };

    // Process the single search field
    if (!searchField['field']) continue;

    const boardField = getBoardFieldById(board, searchField['field']);

    // Handle different field types for search
    if (boardField?.type === 'Number' && searchField['value'] === '') {
      searchField['value'] = '0';
    }

    if (typeof searchField['value'] === 'string')
      searchField['value'] = validEmptyString(searchField['value'], false);

    if (boardField?.type === 'MultipleSelection') {
      let searchValues: string[] = [];
      searchValues = Array.isArray(searchField['value'])
        ? searchField['value']
        : handleString(searchField['value'], false)
            .split(',')
            .map((item) => item.trim());
      searchValues.forEach((valueItem: string) => {
        filters.push(`fields.${searchField['field']} IN ['${valueItem}']`);
      });

      const notFilterValues = boardField.data
        .filter((option) => !searchValues.includes(option._id))
        .map((option) => `'${option._id}'`);
      filters.push(
        `fields.${searchField['field']} NOT IN [${notFilterValues}]`
      );
    } else if (boardField?.type === 'MultipleAssignee') {
      let searchValues: string[] = [];
      // Handle array of assignee objects
      if (
        Array.isArray(searchField['value']) &&
        searchField['value'].length > 0 &&
        typeof searchField['value'][0] === 'object'
      ) {
        searchValues = searchField['value'].map(
          (assignee: { _id: string; display_name: string }) => assignee._id
        );
      } else {
        // Handle string input (comma-separated or single value)
        searchValues = handleString(searchField['value'], false)
          .split(',')
          .map((item) => item.trim());
      }

      // For each value, check if it's an ID or display name
      searchValues.forEach((value: string) => {
        if (value.startsWith('u_')) {
          filters.push(`fields.${searchField['field']}._id = '${value}'`);
        } else {
          filters.push(
            `fields.${searchField['field']}.display_name = '${value}'`
          );
        }
      });
    } else if (boardField?.type === 'Assignee') {
      if (
        typeof searchField['value'] === 'string' &&
        searchField['value'].startsWith('u_')
      ) {
        // if enter id (single selection)
        filters.push(
          `fields.${searchField['field']}._id = '${searchField['value']}'`
        );
      } else {
        // if enter display_name (string, expression)
        filters.push(
          `fields.${searchField['field']}.display_name = '${searchField['value']}'`
        );
      }
    } else if (boardField?.type === 'Date' && isDate(searchField['value'])) {
      const startDateISO = convertDateToISOString(searchField['value']);
      const endDateISO = moment(startDateISO).add(1, 'day').utc().format();

      const startDateTimestamp = new Date(startDateISO).getTime() / 1000;
      const endDateTimestamp = new Date(endDateISO).getTime() / 1000;

      filters.push(
        `fields_timestamp.${searchField['field']} ${startDateTimestamp} TO ${endDateTimestamp}`
      );
    } else if (
      (boardField?.type === 'Time' || boardField?.type === 'Datetime') &&
      isDate(searchField['value'])
    ) {
      const searchDateTimeStamp =
        new Date(searchField['value']).getTime() / 1000;

      filters.push(
        `fields_timestamp.${searchField['field']} = ${searchDateTimeStamp}`
      );
    } else if (boardField?.type === 'Phone') {
      const formattedPhoneNumber = formatPhoneNumberWithCountryCallingCode(
        searchField['value']
      );
      filters.push(
        `fields.${searchField['field']}.calling_code_with_number = '${formattedPhoneNumber}'`
      );
    } else if (boardField?.type === 'Country') {
      if (
        typeof searchField['value'] === 'string' &&
        searchField['value'].length === 2
      ) {
        filters.push(
          `fields.${searchField['field']}.country_code = '${searchField['value']}'`
        );
      } else {
        filters.push(
          `fields.${searchField['field']}.country_name = '${searchField['value']}'`
        );
      }
    } else if (boardField?.type === 'Origin') {
      const { sourceCategory } = splitOriginTypeString(
        searchField['originalSource']
      );
      const typeString = `fields.${searchField['field']}.type = '${sourceCategory}'`;
      const valueKey = sourceCategory === 'customized' ? 'name' : 'id';
      const valueString = `fields.${searchField['field']}.data.${valueKey} = '${searchField['value']}'`;
      filters.push(`${typeString} AND ${valueString}`);
    } else if (boardField?.type === 'Checkbox') {
      const isChecked = searchField['value'] === 'is_checked';
      if (isChecked) {
        filters.push(`fields.${searchField['field']} = ${isChecked}`);
      } else {
        const checkboxFieldId = `fields.${searchField['field']}`;
        filters.push(
          `${checkboxFieldId} IS EMPTY OR ${checkboxFieldId} IS NULL OR ${checkboxFieldId} NOT EXISTS OR ${checkboxFieldId} = false`
        );
      }
    } else if (boardField?.type === 'Attachment') {
      let filterStr = searchField['value']
        .split(',')
        .map((url: string) => `'${url.trim()}'`)
        .join(',');

      if (
        typeof searchField['value'] === 'string' &&
        searchField['value'].startsWith('http')
      ) {
        // if value starts from http
        filters.push(
          `fields.${searchField['field']}.data.url IN [${filterStr}]`
        );
      } else {
        // if values are jpg, png, ...
        // due to package conversion, whether it is .jpg or .jepg, the file extension name is .jepg.
        filterStr = filterStr.replace(/'jpg'$/i, "'jpeg'");
        filters.push(
          `fields.${searchField['field']}.data.extension IN [${filterStr}]`
        );
      }
    } else if (boardField?.type === 'Currency') {
      const typeString = `fields.${searchField['field']}.currency_code = '${searchField['currencyCode']}'`;
      const valueString = `fields.${searchField['field']}.amounts = '${searchField['value']}'`;
      filters.push(`${typeString} AND ${valueString}`);
    } else {
      // Default handling for other field types
      filters.push(`fields.${searchField['field']} = '${searchField['value']}'`);
    }
  }

  return filters;
}

let cachedImbraceToken: string | undefined;
let cachedOrganizationId: string | undefined;

// Import hiddenFieldTypes from constants
import { hiddenFieldTypes } from '../common/constants';
import { PieceCategory } from '@activepieces/shared';

export const autoDataBoard = createAction({
  name: 'auto_data_board',
  displayName: 'Automate Data Board',
  description:
    'Create/Update/Delete/Clear/Search/Get records or board details in a Data Board',
  props: {


    workflowName: Property.ShortText({
      displayName: 'Workflow Name',
      required: false,
      defaultValue: 'Automate Data Board',
    }),
    version: Property.StaticDropdown({
      displayName: 'Version',
      required: true,
      defaultValue: '1',
      options: {
        options: [
          { label: 'Version 1', value: '1' },
          { label: 'Version 2', value: '2' },
        ],
      },
    }),
    boardId: Property.Dropdown({
      displayName: 'Data Board',
      required: true,
      refreshers: [],
      options: async (propsValue, ctx) => {
        try {
          // Cache the token for later use in run function
          cachedImbraceToken = ctx?.server?.imbraceToken ?? cachedImbraceToken;
          console.log('token from board', cachedImbraceToken);

          // Fetch and cache organization_id
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

          // Use the imbraceApiRequest equivalent for Workflow
          // limit=0 → return every board (no pagination cap) so the dropdown
          // lists all boards, not just the first default page.
          const boardData = await imbraceApiRequest(
            HttpMethod.GET,
            `/data-board/boards?limit=0`,
            {},
            false,
            cachedImbraceToken,
            { 'x-organization-id': cachedOrganizationId || '' }
          );

          const list = (boardData as any)?.data ?? [];
          return {
            disabled: false,
            options: list.map((b: any) => ({
              label: b.name,
              value: b._id,
              description: b.description,
            })),
          };
        } catch (err) {
          console.error('fetchBoardList error', err);
          return {
            disabled: true,
            options: [],
          };
        }
      },
    }),

    chooseAction: Property.StaticDropdown({
      displayName: 'Action',
      required: true,
      options: {
        options: [
          { label: 'Create a record', value: 'create' },
          { label: 'Update fields', value: 'update' },
          { label: 'Delete a record', value: 'deleteRecord' },
          { label: 'Clear fields', value: 'clearFields' },
          { label: 'Get all records', value: 'getAll' },
          { label: 'Get single record', value: 'search' },
          { label: 'Get board details', value: 'boardDetails' },
        ],
      },
    }),
    outputData: Property.DynamicProperties({
      displayName: 'Output Data (for Get All Records)',
      required: false,
      refreshers: ['chooseAction'], // 👈 Add the refresher here
      props: async (
        propsValue
        // 👇 Add the explicit return type here
      ): Promise<InputPropertyMap> => {
        const { chooseAction } = propsValue as { chooseAction?: string };

        if (chooseAction === 'getAll') {
          // This object matches the InputPropertyMap type
          return {
            outputData: Property.StaticDropdown({
              displayName: 'Output Data',
              required: true, // Recommended to make it required if shown
              options: {
                options: [
                  { label: 'All Data (Raw JSON)', value: 'allData' },
                  {
                    label: 'List Records in Table',
                    value: 'listRecords',
                  },
                ],
              },
            }),
          };
        }

        // An empty object also matches the InputPropertyMap type
        return {};
      },
    }),
    // Filters for "Get all records" — field/value pairs combined with AND.
    // Reuses the same Meilisearch builder as "Get single record", so every
    // board field type is supported. When set, getAll routes to POST /search.
    getAllFilters: Property.DynamicProperties({
      displayName: 'Filters (for Get All Records)',
      required: false,
      refreshers: ['chooseAction', 'boardId'],
      props: async (propsValue, ctx): Promise<InputPropertyMap> => {
        cachedImbraceToken = ctx?.server?.imbraceToken ?? cachedImbraceToken;
        const { chooseAction, boardId } = propsValue as {
          chooseAction?: string;
          boardId?: string;
        };

        if (chooseAction !== 'getAll' || !boardId) return {};

        let boardFields: { label: string; value: string }[] = [];
        try {
          const boardData = await imbraceApiRequest(
            HttpMethod.GET,
            `/data-board/boards/${boardId}`,
            {},
            false,
            cachedImbraceToken,
            { 'x-organization-id': cachedOrganizationId || '' }
          );
          const board = (boardData as any)?.data ?? {};
          if (board?.fields) {
            boardFields = board.fields
              .filter(
                (field: IBoardField) =>
                  !hiddenFieldTypes.otherAction.includes(field.type)
              )
              .map((f: IBoardField) => ({ label: f.name, value: f._id }));
          }
        } catch (e) {
          console.error('getAll filter fields error', e);
        }

        return {
          filters: Property.Array({
            displayName: 'Filters (matched with AND)',
            required: false,
            properties: {
              field: Property.StaticDropdown({
                displayName: 'Field',
                required: true,
                options: {
                  options: boardFields.length
                    ? boardFields
                    : [{ label: 'Select a board first', value: '' }],
                },
              }),
              value: Property.LongText({
                displayName: 'Value',
                required: true,
                description:
                  'Value to match. For multi-value fields, separate values with commas.',
              }),
            },
          }),
        };
      },
    }),
    getAllPagination: Property.DynamicProperties({
      displayName: 'Pagination (for Get All Records)',
      required: false,
      refreshers: ['chooseAction'],
      props: async (propsValue): Promise<InputPropertyMap> => {
        const { chooseAction } = propsValue as { chooseAction?: string };
        if (chooseAction !== 'getAll') return {};
        return {
          limit: Property.Number({
            displayName: 'Limit',
            required: false,
            defaultValue: 100,
            description:
              'Max records to return (1–100). Returns up to 100 records; use Skip to page through more.',
          }),
          skip: Property.Number({
            displayName: 'Skip',
            required: false,
            defaultValue: 0,
            description: 'Number of records to skip (offset).',
          }),
        };
      },
    }),
    getAllSort: Property.DynamicProperties({
      displayName: 'Sort (for Get All Records)',
      required: false,
      refreshers: ['chooseAction', 'boardId'],
      props: async (propsValue, ctx): Promise<InputPropertyMap> => {
        cachedImbraceToken = ctx?.server?.imbraceToken ?? cachedImbraceToken;
        const { chooseAction, boardId } = propsValue as {
          chooseAction?: string;
          boardId?: string;
        };
        if (chooseAction !== 'getAll') return {};

        let sortOptions: { label: string; value: string }[] = [
          { label: 'Created at', value: 'created_at' },
          { label: 'Updated at', value: 'updated_at' },
        ];
        if (boardId) {
          try {
            const boardData = await imbraceApiRequest(
              HttpMethod.GET,
              `/data-board/boards/${boardId}`,
              {},
              false,
              cachedImbraceToken,
              { 'x-organization-id': cachedOrganizationId || '' }
            );
            const board = (boardData as any)?.data ?? {};
            if (board?.fields) {
              sortOptions = sortOptions.concat(
                board.fields
                  .filter(
                    (field: IBoardField) =>
                      !hiddenFieldTypes.otherAction.includes(field.type)
                  )
                  .map((f: IBoardField) => ({
                    label: f.name,
                    value: `fields.${f._id}`,
                  }))
              );
            }
          } catch (e) {
            console.error('getAll sort fields error', e);
          }
        }

        return {
          sortField: Property.StaticDropdown({
            displayName: 'Sort field',
            required: false,
            options: { options: sortOptions },
          }),
          sortDirection: Property.StaticDropdown({
            displayName: 'Sort direction',
            required: false,
            defaultValue: 'asc',
            options: {
              options: [
                { label: 'Ascending', value: 'asc' },
                { label: 'Descending', value: 'desc' },
              ],
            },
          }),
        };
      },
    }),
    inputMethod: Property.DynamicProperties({
      displayName: 'Input Method',
      required: false,
      refreshers: ['chooseAction'],
      props: async (propsValue): Promise<InputPropertyMap> => {
        const { chooseAction } = propsValue as { chooseAction?: string };

        if (chooseAction === 'create' || chooseAction === 'update') {
          return {
            inputMethod: Property.StaticDropdown({
              displayName: 'Input Method',
              required: true,
              options: {
                options: [
                  { label: 'Using Fields (JSON Pairs)', value: 'field' },
                  { label: 'Using JSON Data', value: 'json' },
                ],
              },
            }),
          };
        }

        // hide if action not create/update
        return {};
      },
    }),

    identifier: Property.DynamicProperties({
      displayName: 'Identifier',
      required: false,
      refreshers: ['chooseAction', 'boardId'],
      props: async (propsValue, ctx): Promise<InputPropertyMap> => {
        // Cache the token for later use in run function
        cachedImbraceToken = ctx?.server?.imbraceToken ?? cachedImbraceToken;

        const { chooseAction, boardId } = propsValue as {
          chooseAction?: string;
          boardId?: string;
        };

        // Actions that use Identifier logic
        if (['deleteRecord', 'update', 'clearFields', 'search'].includes(chooseAction || '')) {
          const schema: any = {
            identifier: Property.StaticDropdown({
              displayName: 'Identifier',
              required: true,
              options: {
                options: [
                  { label: 'Fields on the board', value: 'fieldsOnBoard' },
                  { label: 'Record ID', value: 'recordId' },
                ],
              },
            }),
          };

          return schema;
        }

        return {};
      },
    }),

    identifierNested: Property.DynamicProperties({
      displayName: 'Identifier Fields',
      required: false,
      refreshers: ['identifier', 'boardId', 'chooseAction'],
      props: async (propsValue, ctx) => {
        cachedImbraceToken = ctx?.server?.imbraceToken ?? cachedImbraceToken;
        const { identifier, boardId, chooseAction } = propsValue as any;
        const id = identifier?.identifier ?? identifier;

        if (id === 'fieldsOnBoard' && boardId) {
          let boardFields: { label: string; value: string }[] = [];
          try {
            const boardData = await imbraceApiRequest(
              HttpMethod.GET,
              `/data-board/boards/${boardId}`,
              {},
              false,
              cachedImbraceToken,
              { 'x-organization-id': cachedOrganizationId || '' }
            );
            const board = (boardData as any)?.data ?? {};
            if (board?.fields) {
              const filteredFields = board.fields.filter(
                (field: IBoardField) => !hiddenFieldTypes.identifier.includes(field.type)
              );
              boardFields = filteredFields.map((f: IBoardField) => ({
                label: f.name,
                value: f._id,
              }));
            }
          } catch (e) {
            console.error(e);
          }

          const properties: any = {
            field: Property.StaticDropdown({
              displayName: 'Select the field',
              required: true,
              options: {
                options: boardFields.length
                  ? boardFields
                  : [{ label: 'Select a board first', value: '' }],
              },
            }),
            value: Property.LongText({
              displayName: 'Field value',
              required: true,
              description: 'Value to identify the record.',
            }),
          };

          if (chooseAction === 'search') {
            return {
              additionalFields: Property.Array({
                displayName: 'Search Fields',
                required: true,
                properties,
              }),
            } as any;
          } else {
            // update, deleteRecord, clearFields use single field pair directly
            return properties as any;
          }
        }
        return {};
      },
    }),


    // Content JSON for create/update actions
    contentJson: Property.DynamicProperties({
      displayName: 'Content (JSON)',
      required: false,
      refreshers: ['chooseAction', 'inputMethod'],
      props: async (propsValue): Promise<InputPropertyMap> => {
        const { chooseAction, inputMethod } = propsValue as {
          chooseAction?: string;
          inputMethod?: any;
        };
        const im = inputMethod?.inputMethod ?? inputMethod;

        if (
          (chooseAction === 'create' || chooseAction === 'update') &&
          im === 'json'
        ) {
          return {
            contentJson: Property.Json({
              displayName: 'Content (JSON)',
              required: true,
              description:
                'Enter data in JSON format: {"field_name": "value"} or {"field_id": "value"}',
            }),
          };
        }
        return {};
      },
    }),

    // Record ID for record-based operations
    recordId: Property.DynamicProperties({
      displayName: 'Record ID',
      required: false,
      refreshers: ['chooseAction', 'identifier'],
      props: async (propsValue): Promise<InputPropertyMap> => {
        const { chooseAction, identifier } = propsValue as {
          chooseAction?: string;
          identifier?: any;
        };
        const id = identifier?.identifier ?? identifier;

        if (id === 'recordId') {
          return {
            recordId: Property.ShortText({
              displayName: 'Record ID',
              required: true,
              description: 'ID of the record.',
            }),
          };
        }
        return {};
      },
    }),
    // Action pairs for field-based input (Payload / Fields to Clear)
    additionalFields: Property.DynamicProperties({
      displayName: 'Fields',
      required: false,
      refreshers: ['chooseAction', 'inputMethod', 'boardId'],
      props: async (propsValue, ctx): Promise<InputPropertyMap> => {
        // Cache the token for later use in run function
        cachedImbraceToken = ctx?.server?.imbraceToken ?? cachedImbraceToken;

        const { chooseAction, inputMethod, boardId } = propsValue as {
          chooseAction?: string;
          inputMethod?: any;
          boardId?: string;
        };
        const im = inputMethod?.inputMethod ?? inputMethod;

        if (
          ((chooseAction === 'create' || chooseAction === 'update') &&
            im === 'field') ||
          chooseAction === 'clearFields'
        ) {
          let boardFields: { label: string; value: string }[] = [];
          if (boardId) {
            try {
              console.log('cToken', cachedImbraceToken);

              const boardData = await imbraceApiRequest(
                HttpMethod.GET,
                `/data-board/boards/${boardId}`,
                {},
                false,
                cachedImbraceToken,
                { 'x-organization-id': cachedOrganizationId || '' }
              );
              const board = (boardData as any)?.data ?? {};
              if (board?.fields) {
                const filteredFields = board.fields.filter(
                  (field: IBoardField) => {
                    if (chooseAction === 'create') {
                      return true;
                    } else {
                      return !hiddenFieldTypes.otherAction.includes(field.type);
                    }
                  }
                );
                boardFields = filteredFields.map((f: IBoardField) => ({
                  label: f.name,
                  value: f._id,
                }));
              }
            } catch (err) {
              console.error('Error fetching board fields:', err);
            }
          }

          const properties: any = {
            field: Property.StaticDropdown({
              displayName: 'Field',
              required: true,
              options: {
                options: boardFields.length
                  ? boardFields
                  : [{ label: 'Select a board first', value: '' }],
              },
            }),
          };

          if (chooseAction !== 'clearFields') {
            properties.value = Property.LongText({
              displayName: 'Value',
              required: true,
              description: 'Value for the selected field.',
            });
          }

          return {
            actionPairs: Property.Array({
              displayName: chooseAction === 'clearFields' ? 'Fields to Clear' : 'Add Field',
              required: false,
              properties,
            }),
          };
        }
        return {};
      },
    }),


    testing_organization_id: Property.DynamicProperties({
      displayName: 'Testing Organization ID',
      required: false,
      refreshers: ['boardId'],
      props: async (_propsValue: Record<string, unknown>, ctx: any) => {
        const imbraceToken = ctx?.server?.imbraceToken;
        if (!cachedOrganizationId) {
          try {
            const selectedOrg = await imbraceApiRequest(
              HttpMethod.GET,
              '/platform/v1/account',
              {},
              false,
              imbraceToken
            );
            cachedOrganizationId = selectedOrg?.organization_id;
          } catch (e) {
            console.error('Failed to fetch organization:', e);
          }
        }
        const orgId = cachedOrganizationId ?? '';
        console.log('🔎 testing_organization_id resolved → orgId:', orgId);
        return {
          testing_organization_id: Property.ShortText({
            displayName: 'Organization ID',
            required: false,
            defaultValue: orgId,
            description: 'Auto-resolved organization ID',
          }),
        };
      },
    }),
  },

  async run(context: ActionContext) {
    try {
      const { propsValue, triggerCtx, project } = context;
      const {
        boardId,
        chooseAction,
        workflowName,
        version,
        inputMethod,
        identifier,
        identifierNested,
        recordId,
        contentJson,
        additionalFields,
        outputData,
        getAllFilters,
        getAllPagination,
        getAllSort,
      } = propsValue;

      // Get the token from cache or context
      console.log('tokenq:', {
        cachedImbraceToken,
        contextImbraceToken: context.server.imbraceToken,
      });

      const imbraceToken = cachedImbraceToken || context.server.imbraceToken;
      
      // if (!imbraceToken) {
      //   handleOperationError('Missing Imbrace token. Please reconnect or refresh the piece.');
      // }
      // Update cache with current token
      cachedImbraceToken = imbraceToken;

      type Content = {
        text?: string;
        url?: string;
        [key: string]: any;
      };
      type SourceDetails = {
        conversation_id: string;
        position?: string;
        organization_id: string;
        content?: Content;
        from?: string;
        type?: string;
        immediate?: boolean;
        workflow_id?: string;
        config?: any;
      };

      const sourceDetails = triggerCtx as SourceDetails;
      console.log('src Details:', sourceDetails);

      const ctxBoardRaw = (sourceDetails as any)?.board;
      const ctxBoardId = ctxBoardRaw?._id ?? ctxBoardRaw?.id;
      const ctxBoard: IBoard | undefined =
        ctxBoardRaw?.fields && ctxBoardId === boardId
          ? (ctxBoardRaw as IBoard)
          : undefined;

      let conversation_id: string | undefined, content: any, from: any, type: any, workflow_id: any, config: any, immediate: boolean | undefined;
      let organization_id: string | undefined = project?.orgId;

      if (sourceDetails) {
        ({
          conversation_id,
          content,
          from,
          type,
          workflow_id,
          config,
          immediate
        } = sourceDetails);
      } else {
        console.error("No body found in source");
      }

      console.log(`[${workflowName}] run log:`, {
        boardId,
        chooseAction,
        organization_id,
      });

      if (!organization_id) throw new Error('organization_id is required but cannot be found in trigger context or props');

      const appName = (workflowName ?? 'Automate Data Board').toString();
      const nodeName = appName;

      if (!boardId || !chooseAction) {
        handleOperationError('Please select a board and action');
      }

      let method: HttpMethod = HttpMethod.GET;
      // Items live under /api/boards/:id/items on data-board; this base is
      // the prefix for every `endpoint += /items/...` append below. Board
      // metadata fetches use `boardMetadataEndpoint` instead — data-board
      // only exposes the legacy bare-shape board doc at /v1/board/:id (see
      // data-board's legacy-board.router.ts).
      let endpoint = `/api/boards/${boardId}`;
      const boardMetadataEndpoint = `/v1/board/${boardId}`;
      let boardBody: any = {};

      // Helper function to make API requests with cached token
      const authorizedRequest = async <T = unknown>(
        reqMethod: HttpMethod,
        reqEndpoint: string,
        body: Record<string, unknown> = {},
        oldApi = true
      ): Promise<T> =>
        imbraceApiRequestPrivateService(reqMethod, reqEndpoint, body, {
          'x-organization-id': organization_id || '',
        }) as Promise<T>;

      const handleApiError = async (error: any) => {
        if (conversation_id) {
          await setWorkflowOutputHistory(conversation_id, nodeName, '1');
        }
        console.error(`[${nodeName}] Error:`, error);
        return {
          success: false,
          error: error?.message || 'Unknown error',
          details: error,
        };
      };

      // Helper function to get unwrapped values from dynamic properties
      const getUnwrappedValue = (prop: any, key: string) => {
        return prop?.[key] ?? prop;
      };


      const unwrappedInputMethod = getUnwrappedValue(
        inputMethod,
        'inputMethod'
      );
      const unwrappedIdentifier = getUnwrappedValue(identifier, 'identifier');
      // const unwrappedField = getUnwrappedValue(field, 'field');
      // const unwrappedValue = getUnwrappedValue(value, 'value');
      const unwrappedRecordId = getUnwrappedValue(recordId, 'recordId');
      const unwrappedContentJson = getUnwrappedValue(
        contentJson,
        'contentJson'
      );
      const unwrappedBoardFieldType = undefined as any; // getUnwrappedValue(boardFieldType, 'boardFieldType');
      const unwrappedOriginalSource = undefined as any; // getUnwrappedValue(originalSource, 'originalSource');
      const unwrappedCurrencyCode = undefined as any; // getUnwrappedValue(currencyCode, 'currencyCode');

      // Only execute if immediate or no conversation_id
      if (!conversation_id || immediate) {
        let responseData: any;

        console.log(`[${nodeName}]`, { boardId, chooseAction });

        // -------- Actions --------
        if (chooseAction === 'getAll') {
          const filtersRaw = (getAllFilters as any)?.filters ?? [];
          const pag = (getAllPagination as any) ?? {};
          const sortCfg = (getAllSort as any) ?? {};

          // Drop half-filled rows so a blank value never yields a bogus clause.
          const activeFilters = Array.isArray(filtersRaw)
            ? filtersRaw.filter(
                (f: any) => f?.field && f?.value !== '' && f?.value != null
              )
            : [];

          const rawLimit = Number(pag.limit);
          const limit = Number.isFinite(rawLimit)
            ? Math.min(Math.max(rawLimit, 1), 100)
            : 100; // cap at 100
          const skip =
            Number.isFinite(Number(pag.skip)) && Number(pag.skip) >= 0
              ? Number(pag.skip)
              : 0;
          const sortArr = sortCfg.sortField
            ? [
                `${sortCfg.sortField}:${
                  sortCfg.sortDirection === 'desc' ? 'desc' : 'asc'
                }`,
              ]
            : undefined;

          if (activeFilters.length > 0) {
            // FILTERED → POST /search (all field types via shared builder).
            let board: IBoard;
            try {
              board =
                ctxBoard ??
                (await authorizedRequest(HttpMethod.GET, boardMetadataEndpoint));
            } catch (error) {
              return await handleApiError(error);
            }

            const filterString = buildMeilisearchFilters(
              activeFilters,
              board
            ).join(' AND ');

            boardBody = {
              filter: filterString,
              limit,
              offset: skip,
              ...(sortArr && { sort: sortArr }),
            };
            endpoint = `/api/search/${boardId}`;
            method = HttpMethod.POST;
          } else {
            // NO FILTER → GET /items (preserves existing response shape).
            const params = new URLSearchParams();
            params.set('limit', String(limit));
            params.set('skip', String(skip));
            if (sortCfg.sortField) {
              params.set(
                'sort',
                `${sortCfg.sortDirection === 'desc' ? '-' : ''}${
                  sortCfg.sortField
                }`
              );
            }
            endpoint += `/items?${params.toString()}`;
            method = HttpMethod.GET;
          }
        }

        if (chooseAction === 'create') {
          let board: IBoard;
          try {
            board = ctxBoard ?? await authorizedRequest<IBoard>(HttpMethod.GET, boardMetadataEndpoint);
          } catch (error) {
            return await handleApiError(error);
          }

          let itemFields: any[] = [];

          const tableInTableFields = getTableInTableFields(board);
          const tableInTableFieldMap: { [key: string]: IBoard } = {};

          const boardPromises = tableInTableFields.map(async (pair) => {
            try {
              const childBoard = await authorizedRequest<IBoard>(
                HttpMethod.GET,
                `/v1/board/${pair.childBoardId}`
              );
              return {
                fieldId: pair.fieldId,
                board: childBoard,
              };
            } catch (err) {
              // A deleted/inaccessible child board must not abort the whole
              // operation — drop this TIT field's nested formatting instead.
              console.warn(
                `[${nodeName}] Failed to fetch child board ${pair.childBoardId} for TIT field ${pair.fieldId}; skipping nested formatting`,
                err
              );
              return null;
            }
          });

          const results = (await Promise.all(boardPromises)).filter(
            (r): r is { fieldId: string; board: IBoard } => r !== null
          );
          results.forEach((result) => {
            tableInTableFieldMap[result.fieldId] = result.board;
          });

          if (unwrappedInputMethod === 'json') {
            try {
              itemFields = processItemFields(
                unwrappedContentJson,
                board,
                chooseAction,
                tableInTableFieldMap
              );
            } catch (error) {
              handleOperationError(
                'Invalid JSON format: ' + (error as Error).message
              );
            }
            itemFields = sanitizeTemporalFields(
              itemFields,
              board,
              tableInTableFieldMap
            );
          } else {
            const addFields = additionalFields as {
              actionPairs?: Record<string, string>[];
            };

            checkIfAdditionalFieldsExists(addFields);

            const fields = await Promise.all(
              addFields.actionPairs!.map(async (item) => {
                if (!item['field'])
                  handleOperationError(errorMessages.needToAddValue);

                const fieldId = item['field'];

                if (tableInTableFieldMap[fieldId]) {
                  let value = item['value'];
                  if (typeof value === 'string') {
                    try {
                      value = JSON.parse(value);
                    } catch (e) {
                      // ignore
                    }
                  }

                  if (Array.isArray(value)) {
                    const childRows = value.map((row: any) => {
                      const rowFields = processItemFields(
                        row,
                        tableInTableFieldMap[fieldId],
                        chooseAction,
                        tableInTableFieldMap
                      );
                      return rowFields.reduce((acc: any, curr: any) => {
                        acc[curr.board_field_id || curr.key] = curr.value;
                        return acc;
                      }, {});
                    });

                    return {
                      board_field_id: fieldId,
                      value: childRows
                    };
                  }
                }

                return {
                  board_field_id: fieldId,
                  value: await checkAndFormatFieldValue(item, true, {
                    board,
                    organization_id: organization_id ?? "",
                  }),
                };
              })
            );

            itemFields = fields.reduce((acc: any[], field) => {
              const boardField = getBoardFieldById(board, field.board_field_id);
              if (boardField?.type === 'Notes') {
                const existingField = acc.find(
                  (f) => f.board_field_id === field.board_field_id
                );
                if (
                  existingField &&
                  Array.isArray(field.value) &&
                  field.value[0]
                ) {
                  existingField.value = existingField.value.concat(field.value);
                } else {
                  acc.push(field);
                }
              } else {
                acc.push(field);
              }
              return acc;
            }, []);

            const identifierField = getIdentifierField(board);
            if (identifierField) {
              const identifierData = itemFields.find(
                (field) => field.board_field_id === identifierField?._id
              );
              if (!identifierData?.value)
                handleOperationError(
                  errorMessages.fieldIsRequired(identifierField.name)
                );
            }
          }

          boardBody = {
            fields: itemFields,
            app_name: appName,
            ...(conversation_id && { conversation_id }),
          };
          endpoint += '/items';
          method = HttpMethod.POST;
        }

        if (chooseAction === 'update') {
          let board: IBoard;
          try {
            board = ctxBoard ?? await authorizedRequest<IBoard>(HttpMethod.GET, boardMetadataEndpoint);
          } catch (error) {
            return await handleApiError(error);
          }

          let itemFields: any[] = [];

          const tableInTableFields = getTableInTableFields(board);
          const tableInTableFieldMap: { [key: string]: IBoard } = {};

          const boardPromises = tableInTableFields.map(async (pair) => {
            try {
              const childBoard = await authorizedRequest<IBoard>(
                HttpMethod.GET,
                `/v1/board/${pair.childBoardId}`
              );
              return {
                fieldId: pair.fieldId,
                board: childBoard,
              };
            } catch (err) {
              // A deleted/inaccessible child board must not abort the whole
              // operation — drop this TIT field's nested formatting instead.
              console.warn(
                `[${nodeName}] Failed to fetch child board ${pair.childBoardId} for TIT field ${pair.fieldId}; skipping nested formatting`,
                err
              );
              return null;
            }
          });

          const results = (await Promise.all(boardPromises)).filter(
            (r): r is { fieldId: string; board: IBoard } => r !== null
          );
          results.forEach((result) => {
            tableInTableFieldMap[result.fieldId] = result.board;
          });

          if (unwrappedInputMethod === 'json') {
            try {
              itemFields = processItemFields(
                unwrappedContentJson,
                board,
                chooseAction,
                tableInTableFieldMap
              );
            } catch (error) {
              handleOperationError(
                'Invalid JSON format: ' + (error as Error).message
              );
            }
            itemFields = sanitizeTemporalFields(
              itemFields,
              board,
              tableInTableFieldMap
            );
          } else {
            const addFields = additionalFields as {
              actionPairs?: Record<string, string>[];
            };
            if (!addFields?.actionPairs || addFields.actionPairs.length === 0) {
              handleOperationError(errorMessages.needToAddValue);
            }

            itemFields = await Promise.all(
              addFields.actionPairs!.map(async (item) => {
                if (!item['field']) handleOperationError(errorMessages.needToAddValue);

                const fieldId = item['field'];

                if (tableInTableFieldMap[fieldId]) {
                  let value = item['value'];
                  if (typeof value === 'string') {
                    try {
                      value = JSON.parse(value);
                    } catch (e) {
                      // ignore
                    }
                  }

                  if (Array.isArray(value)) {
                    const childRows = value.map((row: any) => {
                      const rowFields = processItemFields(
                        row,
                        tableInTableFieldMap[fieldId],
                        chooseAction,
                        tableInTableFieldMap
                      );
                      return rowFields.reduce((acc: any, curr: any) => {
                        acc[curr.board_field_id || curr.key] = curr.value;
                        return acc;
                      }, {});
                    });

                    return {
                      key: fieldId,
                      value: childRows
                    };
                  }
                }

                return {
                  key: fieldId,
                  value: await checkAndFormatFieldValue(item, true, {
                    board,
                    organization_id: organization_id ?? "",
                  }),
                };
              })
            );

            const identifierField = getIdentifierField(board);
            if (identifierField) {
              const identifierData = itemFields.find(
                (field) => field.key === identifierField._id
              );
              if (identifierData && !identifierData.value)
                handleOperationError(
                  errorMessages.fieldIsRequired(identifierField.name)
                );
            }
          }

          if (unwrappedIdentifier === 'recordId') {
            const recId = validEmptyString(unwrappedRecordId as string);
            boardBody = {
              data: itemFields,
              app_name: appName,
              ...(conversation_id && { conversation_id }),
            };
            endpoint += `/items/${recId}`;
            method = HttpMethod.PATCH;
          } else {
            // Extract from nested identifierNested.field/value
            const nested = identifierNested as {
              field?: string;
              value?: string;
            };

            const fieldId = nested?.field;
            const fieldValue = nested?.value;

            if (!fieldId || !fieldValue) {
              handleOperationError('Please provide a field and value to identify the record');
            }

            const validatedValue = validateFilterValue({
              field: fieldId!,
              value: fieldValue!,
            });

            const inputData = {
              field: fieldId!,
              value: validatedValue,
              boardFieldType: unwrappedBoardFieldType,
              originalSource: unwrappedOriginalSource,
              currencyCode: unwrappedCurrencyCode,
            };

            const formattedValue = await checkAndFormatFieldValue(
              inputData,
              false,
              {
                board,
                organization_id: organization_id ?? "",
              }
            );

            const filters = [{
              key: getFilterName(board, fieldId!),
              value: formattedValue,
            }];

            boardBody = {
              data: itemFields,
              filter: filters,
              app_name: appName,
              ...(conversation_id && { conversation_id }),
            };
            endpoint += `/items/bulk-update`;
            method = HttpMethod.PATCH;
          }
        }

        if (chooseAction === 'deleteRecord') {
          if (unwrappedIdentifier === 'recordId') {
            const recId = validEmptyString(unwrappedRecordId as string);
            endpoint += `/items/${recId}`;
            method = HttpMethod.DELETE;
          } else if (unwrappedIdentifier === 'fieldsOnBoard') {
            // Extract from nested identifierNested.field/value
            const nested = identifierNested as {
              field?: string;
              value?: string;
            };

            const fieldId = nested?.field;
            const fieldValue = nested?.value;

            if (!fieldId || !fieldValue) {
              handleOperationError('Both field and value are required to identify the record to delete');
            }

            const validatedValue = validateFilterValue({
              field: fieldId!,
              value: fieldValue!,
            });

            let board: IBoard;
            try {
              board = ctxBoard ?? await authorizedRequest(HttpMethod.GET, boardMetadataEndpoint);
            } catch (error) {
              return await handleApiError(error);
            }

            const inputData = {
              field: fieldId,
              value: validatedValue,
              boardFieldType: unwrappedBoardFieldType,
              originalSource: unwrappedOriginalSource,
              currencyCode: unwrappedCurrencyCode,
            };

            const formattedValue = await checkAndFormatFieldValue(
              inputData,
              false,
              {
                board,
                organization_id: organization_id ?? "",
              }
            );

            const filter = [
              {
                key: getFilterName(board, fieldId!),
                value: formattedValue,
              },
            ];

            boardBody = {
              filter,
            };
            endpoint += `/items/bulk-delete`;
            method = HttpMethod.DELETE;
          }
        }

        if (chooseAction === 'clearFields') {
          const addFields = additionalFields as {
            actionPairs?: Record<string, string>[];
          };
          if (!addFields?.actionPairs || addFields.actionPairs.length === 0) {
            handleOperationError(errorMessages.needToAddValue);
          }

          let board: IBoard;
          try {
            board = ctxBoard ?? await authorizedRequest(HttpMethod.GET, boardMetadataEndpoint);
          } catch (error) {
            return await handleApiError(error);
          }

          const data = addFields.actionPairs!.map((item) => {
            if (!item['field'])
              handleOperationError(errorMessages.needToAddValue);
            return {
              key: item['field'],
              value: null,
            };
          });

          const identifierField = getIdentifierField(board);
          if (identifierField) {
            const hasIdentifierField = data.some(
              (field) => field.key === identifierField?._id
            );
            if (hasIdentifierField)
              handleOperationError(
                errorMessages.fieldIsRequired(identifierField.name)
              );
          }

          if (unwrappedIdentifier === 'recordId') {
            const recId = validEmptyString(unwrappedRecordId as string);
            boardBody = {
              data,
            };
            endpoint += `/items/${recId}`;
            method = HttpMethod.PATCH;
          } else {
            // Extract from nested identifierNested.field/value
            const nested = identifierNested as {
              field?: string;
              value?: string;
            };

            const fieldId = nested?.field;
            const fieldValue = nested?.value;

            if (!fieldId || !fieldValue) {
              handleOperationError('Please provide a field and value to identify the record');
            }

            const validatedValue = validateFilterValue({
              field: fieldId!,
              value: fieldValue!,
            });

            const inputData = {
              field: fieldId!,
              value: validatedValue,
              boardFieldType: unwrappedBoardFieldType,
              originalSource: unwrappedOriginalSource,
              currencyCode: unwrappedCurrencyCode,
            };

            const formattedValue = await checkAndFormatFieldValue(
              inputData,
              false,
              {
                board,
                organization_id: organization_id ?? "",
              }
            );

            const filters = [{
              key: getFilterName(board, fieldId!),
              value: formattedValue,
            }];

            boardBody = {
              data,
              filter: filters,
            };
            endpoint += `/items/bulk-update`;
            method = HttpMethod.PATCH;
          }
        }

        if (chooseAction === 'search') {
          if (unwrappedIdentifier === 'recordId') {
            const recId = validEmptyString(unwrappedRecordId as string);
            endpoint += `/items/${recId}`;
            method = HttpMethod.GET;
          } else {
            // Extract from identifierNested.additionalFields
            const nested = identifierNested as any;
            console.log('identifierNested:', JSON.stringify(nested, null, 2));

            const actionPairs = nested?.additionalFields?.actionPairs ?? nested?.additionalFields;

            if (!actionPairs || !Array.isArray(actionPairs) || actionPairs.length === 0) {
              handleOperationError('Please provide at least one field and value for search');
            }

            let board: IBoard;
            try {
              board = ctxBoard ?? await authorizedRequest(HttpMethod.GET, boardMetadataEndpoint);
            } catch (error) {
              return await handleApiError(error);
            }

            const filters = buildMeilisearchFilters(actionPairs!, board, {
              boardFieldType: unwrappedBoardFieldType,
              originalSource: unwrappedOriginalSource,
              currencyCode: unwrappedCurrencyCode,
            });

            console.log(`[${nodeName}] filters:`, filters);
            const filterString = filters.join(' AND ');
            console.log(`[${nodeName}] filterString:`, filterString);

            boardBody = {
              limit: 10000,
              matchingStrategy: 'all',
              filter: filterString ?? '',
            };
            endpoint = `/api/search/${boardId}`;
            method = HttpMethod.POST;
          } // Close else
        } // Close if (search)

        // -------- Call API --------
        // The /search endpoint (used by `search` and the filtered `getAll`)
        // wraps results as { message: { hits, limit, offset, estimatedTotalHits } }.
        // Capture that pagination metadata for getAll before unwrapping down to
        // the bare hits array (other actions only consume the hits).
        let searchMeta:
          | { limit?: number; offset?: number; total?: number }
          | null = null;
        try {
          responseData = await authorizedRequest(
            method,
            endpoint,
            boardBody
          );

          if (responseData?.message?.hits) {
            const msg = responseData.message;
            searchMeta = {
              limit: msg.limit,
              offset: msg.offset,
              total: msg.estimatedTotalHits,
            };
            responseData = msg.hits;
          }
        } catch (error) {
          return await handleApiError(error);
        }

        let outputIndex: number;
        const notNullResult =
          responseData && Object.keys(responseData).length > 0;

        const unwrappedOutputData = getUnwrappedValue(
          outputData,
          'outputData'
        );

        if (chooseAction === 'getAll') {
          const outVal = unwrappedOutputData;
          // Filtered getAll (POST /search) returns a bare hits array after the
          // message.hits unwrap above; unfiltered (GET /items) returns { data }.
          const records = Array.isArray(responseData)
            ? responseData
            : responseData?.data;
          const hasData = Array.isArray(records) && records.length > 0;

          // Normalised pagination metadata so getAll always exposes
          // count/skip/limit/totalPages, whether the data came from /search
          // (searchMeta) or /items (the { data, count, ... } envelope).
          const meta = searchMeta
            ? {
                count: searchMeta.total,
                skip: searchMeta.offset,
                limit: searchMeta.limit,
                totalPages:
                  searchMeta.limit && searchMeta.limit > 0
                    ? Math.ceil((searchMeta.total ?? 0) / searchMeta.limit)
                    : 1,
              }
            : Array.isArray(responseData)
            ? {}
            : {
                count: responseData?.count,
                skip: responseData?.skip,
                limit: responseData?.limit,
                totalPages: responseData?.totalPages,
              };

          if (outVal === 'listRecords' && hasData) {
            if (version === '2') {
              let board: IBoard;
              try {
                board = ctxBoard ?? await authorizedRequest(
                  HttpMethod.GET,
                  `/v1/board/${boardId}`,
                  {}
                );
              } catch (error) {
                return await handleApiError(error);
              }

              const mappedData = records.map(
                (record: IBoardField) => {
                  const mapped: Record<string, any> = {};
                  board.fields.forEach((field) => {
                    const fieldId = field._id;
                    const recordFields = (record as any)['fields'];
                    const fieldValue =
                      recordFields &&
                        typeof recordFields === 'object' &&
                        recordFields[fieldId] !== undefined
                        ? recordFields[fieldId]
                        : (record as any)[fieldId];
                    if (fieldValue !== null && fieldValue !== undefined) {
                      mapped[field.name] = { value: fieldValue, ...field };
                    }
                  });
                  const originalData = record as unknown as Record<string, any>;
                  return {
                    ...mapped,
                    public_id: originalData['public_id'],
                    created_at: originalData['created_at'],
                    _id: originalData['_id'],
                    id: originalData['id'],
                    doc_name: originalData['doc_name'],
                    business_unit_id: originalData['business_unit_id'],
                    organization_id: originalData['organization_id'],
                    board_id: originalData['board_id'],
                  };
                }
              );

              return { data: mappedData, ...meta };
            } else {
              return { data: records, ...meta };
            }
          } else {
            // allData (or no rows): expose records + pagination metadata in a
            // consistent envelope for both the /search and /items paths.
            return {
              boardResponse: { data: records ?? [], ...meta },
            };
          }
        } else {
          return {
            boardResponse: responseData,
          };
        }
      } else {
        // Handle non-immediate execution (workflow state management)
        // This would be for cases where position !== nodeName
        return {
          message: 'Workflow execution deferred',
          workflow_id,
          conversation_id,
          position: '',
        };
      }
    } catch (err: any) {
      console.error('AutoDataBoard Error:', err);
      return {
        error: true,
        message: err?.message || 'Unknown error',
        stack: err?.stack,
      };
    }
  },
});
