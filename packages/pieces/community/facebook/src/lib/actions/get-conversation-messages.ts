import { createAction, Property } from '@activepieces/pieces-framework';
import { facebookGraphCommon, FacebookPageDropdown } from '../common/common';
import { facebookGraphAuth } from '../..';

export const getConversationMessages = createAction({
  auth: facebookGraphAuth,
  name: 'get_conversation_messages',
  displayName: 'Get Conversation Messages',
  description: 'Get messages from a Facebook Page conversation',
  props: {
    page: facebookGraphCommon.page,
    conversationId: Property.ShortText({
      displayName: 'Conversation ID',
      description: 'The ID of the conversation to get messages from',
      required: true,
    }),
    limit: Property.Number({
      displayName: 'Limit',
      description: 'The maximum number of messages to retrieve',
      required: false,
      defaultValue: 25,
    }),
  },
  async run(context) {
    try {
      const page = context.propsValue.page as FacebookPageDropdown;
      const conversationId = context.propsValue.conversationId;
      const limit = context.propsValue.limit || 25;

      const result = await facebookGraphCommon.getConversationMessages(page, conversationId, limit);

      return result;
    } catch (error) {
      console.error('Error in get_conversation_messages action:', error);
      throw error;
    }
  },
});
