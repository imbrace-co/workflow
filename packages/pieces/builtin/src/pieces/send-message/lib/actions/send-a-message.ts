import { ActionContext, createAction, Property } from '@activepieces/pieces-framework';
import { outboundTextMessage, setRedisHash } from '../utils/message';

export const sendAMessage = createAction({
  // auth: check https://www.activepieces.com/docs/developers/piece-reference/authentication,
  name: 'send-message',
  displayName: 'Send a message',
  description: 'Send a message without waiting for reply to continue',
  props: {
    message: Property.LongText({
      displayName: "Message",
      required: true,
      description: "Please enter the message to send",
    }),

  },
  async run(ctx: ActionContext) {
    try {
      console.log("<send-a-message> Action started", ctx); 
      const { propsValue, triggerCtx } = ctx;
      const { message } = propsValue;
      // console.debug("Trigger context:", triggerCtx);

      type SourceDetails = {
        conversation_id?: string;
        position?: string;
        content?: string;
        from?: string;
        type?: string;
        immediate?: boolean;
        workflow_id?: string;
        config?: any;
      };

      const sourceDetails = triggerCtx as SourceDetails;
      if (!sourceDetails) {
        console.error("No body found in source");
        return message;
      }
      const { conversation_id, position, content, from, type, immediate = true, workflow_id, config } = sourceDetails;

      console.debug("Source details:",
        conversation_id,
        position,
        content,
        from,
        type,
        immediate,
        workflow_id,
        config
      );
      console.debug("Message sent:", message);
      if (immediate && conversation_id) {
        await outboundTextMessage(message, conversation_id);
        await setRedisHash('removeWorkflowPosition', conversation_id, 'position', '');
      }
      return message;
    } catch (error) {
      console.error("Error in send a message action:", error);
      throw error;
    }
  },
});