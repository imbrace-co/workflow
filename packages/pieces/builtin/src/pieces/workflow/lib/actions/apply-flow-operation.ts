import { createAction, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { apwfApiRequest, buildResponse, buildErrorResponse } from '../common/api';

function countActions(trigger: any): number {
  let count = 0;
  let current = trigger?.nextAction;
  while (current) {
    count++;
    current = current.nextAction;
  }
  return count;
}

export const applyFlowOperation = createAction({
  name: 'apply_flow_operation',
  displayName: 'Apply Flow Operation',
  description: `Apply an operation to a flow. Supports 20 operation types:
- ADD_ACTION: Add a new action step to the flow
- UPDATE_ACTION: Update an existing action's settings (CODE, LOOP_ON_ITEMS, PIECE, ROUTER)
- DELETE_ACTION: Remove one or more actions from the flow
- UPDATE_TRIGGER: Set or update the flow trigger (EMPTY or PIECE_TRIGGER)
- CHANGE_NAME: Rename the flow
- CHANGE_STATUS: Enable or disable the flow
- LOCK_AND_PUBLISH: Lock the flow version and publish it
- IMPORT_FLOW: Import a full flow definition from JSON
- LOCK_FLOW: Lock the flow version (prevent edits)
- USE_AS_DRAFT: Copy a published version as a new draft
- MOVE_ACTION: Move an action to a different position
- DUPLICATE_ACTION: Create a copy of an action
- CHANGE_FOLDER: Move flow to a different folder
- ADD_BRANCH: Add a conditional branch to a router action
- DELETE_BRANCH: Remove a conditional branch
- DUPLICATE_BRANCH: Copy a conditional branch
- MOVE_BRANCH: Reorder branches in a router
- SET_SKIP_ACTION: Mark actions to skip during execution
- UPDATE_METADATA: Update flow metadata
- SAVE_SAMPLE_DATA: Save sample data for testing

The operationBody must be a JSON object matching the schema for the selected operation type.`,
  props: {
    flowId: Property.ShortText({
      displayName: 'Flow ID',
      description: 'The ID of the flow to apply the operation on',
      required: true,
    }),
    operationType: Property.StaticDropdown({
      displayName: 'Operation Type',
      description: 'The type of operation to apply',
      required: true,
      options: {
        options: [
          { label: 'Add Action', value: 'ADD_ACTION' },
          { label: 'Update Action', value: 'UPDATE_ACTION' },
          { label: 'Delete Action', value: 'DELETE_ACTION' },
          { label: 'Update Trigger', value: 'UPDATE_TRIGGER' },
          { label: 'Change Name', value: 'CHANGE_NAME' },
          { label: 'Change Status', value: 'CHANGE_STATUS' },
          { label: 'Lock and Publish', value: 'LOCK_AND_PUBLISH' },
          { label: 'Import Flow', value: 'IMPORT_FLOW' },
          { label: 'Lock Flow', value: 'LOCK_FLOW' },
          { label: 'Use As Draft', value: 'USE_AS_DRAFT' },
          { label: 'Move Action', value: 'MOVE_ACTION' },
          { label: 'Duplicate Action', value: 'DUPLICATE_ACTION' },
          { label: 'Change Folder', value: 'CHANGE_FOLDER' },
          { label: 'Add Branch', value: 'ADD_BRANCH' },
          { label: 'Delete Branch', value: 'DELETE_BRANCH' },
          { label: 'Duplicate Branch', value: 'DUPLICATE_BRANCH' },
          { label: 'Move Branch', value: 'MOVE_BRANCH' },
          { label: 'Set Skip Action', value: 'SET_SKIP_ACTION' },
          { label: 'Update Metadata', value: 'UPDATE_METADATA' },
          { label: 'Save Sample Data', value: 'SAVE_SAMPLE_DATA' },
        ],
      },
    }),
    operationBody: Property.Json({
      displayName: 'Operation Body',
      description:
        'The operation-specific request body as a JSON object. The schema varies by operation type.',
      required: true,
    }),
  },
  async run(context) {
    const { flowId, operationType, operationBody } = context.propsValue;
    const organizationId = context.project.orgId || '';

    try {
      const data = await apwfApiRequest({
        method: HttpMethod.POST,
        path: `/v1/flows/${flowId}`,
        organizationId,
        accessToken: context.server.imbraceToken,
        body: {
          type: operationType,
          request: operationBody,
        },
      });

      const version = data.version;
      const displayName = version?.displayName || flowId;
      const actionCount = countActions(version?.trigger);
      const valid = version?.valid ? 'true' : 'false';
      const state = version?.state || 'DRAFT';

      const nextSteps: string[] = [];

      if (valid === 'false') {
        nextSteps.push(
          'Flow is not valid. Use "Get Flow" to inspect which steps need configuration'
        );
        nextSteps.push(
          'Use "Apply Flow Operation" with UPDATE_ACTION to configure invalid steps'
        );
      }
      if (state === 'DRAFT') {
        nextSteps.push(
          'When all steps are valid, use LOCK_AND_PUBLISH to publish the flow'
        );
      }
      nextSteps.push('Use "Get Flow" to review the current flow state');

      return buildResponse(
        'apply_flow_operation',
        { ...data, operationType },
        `Applied ${operationType} to flow "${displayName}". Actions: ${actionCount}. State: ${state}. Valid: ${valid}.`,
        nextSteps
      );
    } catch (error) {
      return buildErrorResponse('apply_flow_operation', error);
    }
  },
});
