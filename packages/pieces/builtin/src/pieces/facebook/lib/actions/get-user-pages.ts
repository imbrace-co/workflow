import { createAction, Property } from '@activepieces/pieces-framework';
import { facebookGraphCommon } from '../common/common';
import { facebookGraphAuth } from '../..';
import { OAuth2PropertyValue } from '@activepieces/pieces-framework';
import { getAccessTokenOrThrow } from '@activepieces/pieces-common';

export const getUserPages = createAction({
  auth: facebookGraphAuth,
  name: 'get_user_pages',
  displayName: 'Get User Pages',
  description: 'Get all Facebook Pages that the user manages',
  props: {
    limit: Property.Number({
      displayName: 'Limit',
      description: 'The maximum number of pages to retrieve',
      required: false,
      defaultValue: 25,
    }),
    fields: Property.LongText({
      displayName: 'Fields',
      description: 'Optional comma-separated list of fields to retrieve',
      required: false,
    }),
  },
  async run(context) {
    try {
      const accessToken = getAccessTokenOrThrow(context.auth as OAuth2PropertyValue);
      const limit = context.propsValue.limit || 25;
      const fields = context.propsValue.fields;

      const result = await facebookGraphCommon.getUserPages(accessToken, limit, fields);

      return result;
    } catch (error) {
      console.error('Error in get_user_pages action:', error);
      throw error;
    }
  },
});
