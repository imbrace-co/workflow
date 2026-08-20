import { createAction, Property } from '@activepieces/pieces-framework';
import { facebookGraphCommon, FacebookPageDropdown } from '../common/common';
import { facebookGraphAuth } from '../..';

export const sendPageMessage = createAction({
  auth: facebookGraphAuth,
  name: 'send_page_message',
  displayName: 'Send Page Message',
  description: 'Send a message from a Facebook Page to a user',
  props: {
    page: facebookGraphCommon.page,
    recipientId: Property.ShortText({
      displayName: 'Recipient ID',
      description: 'The ID of the user to send the message to',
      required: true,
    }),
    message: Property.LongText({
      displayName: 'Message',
      description: 'The message content to send',
      required: true,
    }),
  },
  async run(context) {
    try {
      const page = context.propsValue.page as FacebookPageDropdown;
      const recipientId = context.propsValue.recipientId;
      const message = context.propsValue.message;

      const result = await facebookGraphCommon.sendPageMessage(page, recipientId, message);

      return result;
    } catch (error) {
      console.error('Error in send_page_message action:', error);
      throw error;
    }
  },
});
