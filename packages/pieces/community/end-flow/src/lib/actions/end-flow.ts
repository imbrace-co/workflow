import { 
    ActionContext, 
    createAction, 
    Property 
} from '@activepieces/pieces-framework';
import { outboundTextMessage, finishWorkflow } from '../utils/end-flow';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

export const endFlow = createAction({
  // auth: check https://www.activepieces.com/docs/developers/piece-reference/authentication,
  name: 'endFlow',
  displayName: 'End flow',
  description: 'End flow',
  isEndPiece: true,
  props: {
    endMessage: Property.LongText({
            displayName: "End Message",
            required: true,
            description: "Enter the message you want to say before conversation ended",
        }),
  },
  async run(ctx: ActionContext) {
        const propsValue = ctx.propsValue as any;
        
        const { 
            endMessage, 
            triggerCtx, 
        } = propsValue;
        
        const conversation_id = propsValue['conversation_id'] || (triggerCtx as any)?.payload?.conversation_id;
        const nodeName = 'endFlow';

        // 1. Send End Message
        if (endMessage && endMessage.trim() !== '') {
            await outboundTextMessage(endMessage, conversation_id);
        }
        
        // . Finish Workflow
        await finishWorkflow(conversation_id, nodeName);

        return {
            success: true,
        };
    },
});
