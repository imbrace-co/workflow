import { createAction } from '@activepieces/pieces-framework';
import { facebookGraphCommon, FacebookPageDropdown } from '../common/common';
import { facebookGraphAuth } from '../..';

export const getPageInfo = createAction({
  auth: facebookGraphAuth,
  name: 'get_page_info',
  displayName: 'Get Page Information',
  description: 'Get detailed information about a Facebook Page',
  props: {
    page: facebookGraphCommon.page,
  },
  async run(context) {
    try {
      const page = context.propsValue.page as FacebookPageDropdown;

      const result = await facebookGraphCommon.getPageInfo(page);

      return result;
    } catch (error) {
      console.error('Error in get_page_info action:', error);
      throw error;
    }
  },
});
