import { ActionContext, createAction, Property } from '@activepieces/pieces-framework';
import { setLabelId, resolveConfig, removeWorkflowPosition } from '../utils/message';

export const clipAndCacheAction = createAction({
  name: 'clip-and-cache',
  displayName: 'Clip And Cache',
  description: 'Temporarily store data so Prep-and-send can retrieve it later',
  props: {
    label: Property.ShortText({
      displayName: 'Label',
      required: true,
      description: 'This label must match the label you enter in Prep-and-send',
    }),
    value: Property.ShortText({ 
      displayName: 'Value',
      required: true,
      description: 'The value you want to store in Redis (can be mapped from previous steps)',
    }),
    conversation_id: Property.ShortText({
      displayName: 'Conversation ID',
      required: false,
      description: 'If left empty, the piece will automatically take it from the trigger payload',
    }),
  },
  async run(ctx: ActionContext) {
    const { propsValue } = ctx;
    const { label, value } = propsValue;
    const nodeName = 'clip-and-cache';

    // 1. Get conversation_id (priority: props first, then trigger context)
    const anyCtx = ctx as any;
    const triggerCtx = anyCtx.triggerCtx;
    const payload = (triggerCtx && triggerCtx['body']) 
        ? { ...triggerCtx, ...triggerCtx['body'] } 
        : (triggerCtx || {});

    const conversation_id = propsValue['conversation_id'] || payload['conversation_id'];

    if (!conversation_id) {
        console.error(`[${nodeName}] Error: conversation_id is missing!`);
        throw new Error(`[${nodeName}] conversation_id is required to cache data.`);
    }

    console.log(
      `[${nodeName}] Start caching: Label=${label}, Value=${value} for Conv=${conversation_id}`
    );

    try {
        // 2. Save directly to Redis (using your standard helper)
        // Note: setLabelId internally calls setRedisHash
        await setLabelId(
          conversation_id,
          label.toLowerCase().trim(),
          String(value)
        );

        // 3. Clear workflow position (if any) to avoid being stuck in old Resume state
        await removeWorkflowPosition(conversation_id);

        // 4. Return output for immediate use in the flow if needed
        const result = {
            success: true,
            conversation_id,
            label: label.toLowerCase().trim(),
            value: value,
            timestamp: new Date().toISOString()
        };

        return result;
    } catch (error) {
        console.error(`[${nodeName}] Redis Error:`, error);
        throw new Error(`[${nodeName}] Failed to save data to Redis.`);
    }
  },
});
