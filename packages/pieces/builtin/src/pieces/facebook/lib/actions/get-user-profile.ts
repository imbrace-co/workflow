import { createAction, Property } from '@activepieces/pieces-framework';
import { facebookGraphCommon } from '../common/common';
import { facebookGraphAuth } from '../..';
import { OAuth2PropertyValue } from '@activepieces/pieces-framework';
import { getAccessTokenOrThrow } from '@activepieces/pieces-common';

export const getUserProfile = createAction({
  auth: facebookGraphAuth,
  name: 'get_user_profile',
  displayName: 'Get User Profile',
  description: 'Get the authenticated user profile information',
  props: {
    fields: Property.LongText({
      displayName: 'Fields',
      description: 'Optional comma-separated list of fields to retrieve (e.g., id,name,email,picture)',
      required: false,
    }),
  },
  async run(context) {
    try {
      const accessToken = getAccessTokenOrThrow(context.auth as OAuth2PropertyValue);
      const fields = context.propsValue.fields;

      const result = await facebookGraphCommon.getUserProfile(accessToken, fields);

      return result;
    } catch (error) {
      console.error('Error in get_user_profile action:', error);
      throw error;
    }
  },
});
