import { createAction, Property } from '@activepieces/pieces-framework';
import { facebookGraphCommon, FacebookPageDropdown } from '../common/common';
import { facebookGraphAuth } from '../..';

export const getPageConversations = createAction({
  auth: facebookGraphAuth,
  name: 'get_page_conversations',
  displayName: 'Get Page Conversations',
  description: 'Get conversations from a Facebook Page inbox',
  props: {
    page: facebookGraphCommon.page,
    limit: Property.Number({
      displayName: 'Limit',
      description: 'The maximum number of conversations to retrieve',
      required: false,
      defaultValue: 25,
    }),
  },
  async run(context) {
    try {
      const page = context.propsValue.page as FacebookPageDropdown;
      const limit = context.propsValue.limit || 25;

      const result = await facebookGraphCommon.getPageConversations(page, limit);

      return result;
    } catch (error) {
      console.error('Error in get_page_conversations action:', error);
      throw error;
    }
  },
});
