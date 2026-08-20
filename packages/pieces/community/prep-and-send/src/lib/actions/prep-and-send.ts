import { createAction, Property, ActionContext } from '@activepieces/pieces-framework';
import { getLabelId, resolveConfig, setRedisHash, getAllLabels, removeLabel } from '../utils/general-function';
import { errorMessages, handleWorkflowError } from '../utils/error';

export const prepAndSendAction = createAction({
  // auth: check https://www.activepieces.com/docs/developers/piece-reference/authentication,
  name: 'prepAndSend',
  displayName: 'Prep And Send',
  description: 'Gather the defined label and paired data for next connector',
  props: {
    label: Property.ShortText({
      displayName: 'Labels To Be Displayed',
      description: 'Please enter all the label to be displayed (separated with comma).',
      required: true,
    }),
    allowMissingLabels: Property.Checkbox({
      displayName: 'Allow Missing Labels',
      description: 'Default value: Disabled\nIf disabled, the connector will cause the workflow to fail with an error if any of the labels does not have a value.\nIf enabled, the connector will not cause the workflow to fail, but may return a result with some labels missing.',
      required: true,
      defaultValue: false,
    }),
  },
  async run(ctx: ActionContext) {
    const { propsValue, triggerCtx } = ctx;
    const { label, allowMissingLabels } = propsValue;
    type Content = {
      text?: string;
      url?: string;
      [key: string]: any;
    };

    type SourceDetails = {
      conversation_id: string;
      position?: string;
      organization_id?: string;
      content?: Content;
      from?: string;
      type?: string;
      immediate?: boolean;
      workflow_id?: string;
      config?: any;
    };

    const sourceDetails = triggerCtx as SourceDetails;
    let data: Record<string, any> = {};
    if (!sourceDetails) {
      console.error("No body found in source");
      return data;
    }

    const labelsArray = label.trim().split(',');
    console.log('labelArr', labelsArray);
    
    const nodeName = 'prep-and-send'; 
    let { conversation_id, position, immediate, config } = sourceDetails;

    config = await resolveConfig(config, conversation_id);

    // Handle position - it might be a JSON string or already parsed
    let actualPosition = position;
    if (position && typeof position === 'string' && position.startsWith('{')) {
      try {
        const positionJson = JSON.parse(position);
        actualPosition = positionJson?.nodeName || '';
      } catch (err) {
        console.warn(`[${nodeName}] Failed to parse position JSON: ${err}`);
      }
    }

    if (immediate) {
      for (let i = 0; i < labelsArray.length; i++) {
        const labelItem = labelsArray[i].trim();
        const labelLowerCase = labelItem.toLowerCase();
        const result = await getLabelId(conversation_id, labelLowerCase);

        if (result) {
          console.log(`[${nodeName}] Successfully get label answer`);
          data[labelItem] = result;
          // Delete the label after successful retrieval to prevent stale data
          await removeLabel(conversation_id, labelLowerCase);
        } else {
          const availableKeys = await getAllLabels(conversation_id);
          const debugMsg = `Missing label answer: ${labelLowerCase}. Available keys: ${availableKeys.join(', ')}`;

          if (allowMissingLabels) {
            console.log(`[${nodeName}] ${debugMsg}`);
          } else {
            console.error(`[${nodeName}] ${debugMsg}`);
            throw new Error(`[${nodeName}] ${debugMsg}`);
          }
        }
      }

      console.log('prep data', data);
      console.log('All retrieved labels:', Object.keys(data).filter(k => k !== 'immediate' && k !== 'position'));
      
      Object.assign(data, {
        immediate: true,
        position: null,
      });

      await setRedisHash('removeWorkflowPosition', conversation_id, 'position', '');

      return data;
    } else if (actualPosition !== nodeName) {
      console.log(`[${nodeName}] Immediate is set to false, it will pass to next connector.`);
      return data;
    } else {
      await handleWorkflowError(ctx, errorMessages.positionNonRetrievableError, data, nodeName);
      return data;
    }
  },
});
