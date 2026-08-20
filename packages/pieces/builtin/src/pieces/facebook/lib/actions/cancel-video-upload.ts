import { createAction, Property } from '@activepieces/pieces-framework';
import { facebookGraphCommon, FacebookPageDropdown } from '../common/common';
import { facebookGraphAuth } from '../..';

export const cancelVideoUpload = createAction({
  auth: facebookGraphAuth,
  name: 'cancel_video_upload',
  displayName: 'Cancel Video Upload',
  description: 'Cancel an in-progress resumable video upload session',
  props: {
    page: facebookGraphCommon.page,
    videoId: Property.ShortText({
      displayName: 'Video ID',
      description: 'The video ID returned from init_video_upload',
      required: true,
    }),
    uploadSessionId: Property.ShortText({
      displayName: 'Upload Session ID',
      description: 'The upload_session_id returned from init_video_upload',
      required: true,
    }),
  },
  async run(context) {
    try {
      const page = context.propsValue.page as FacebookPageDropdown;
      const videoId = context.propsValue.videoId;
      const uploadSessionId = context.propsValue.uploadSessionId;

      const result = await facebookGraphCommon.cancelVideoUpload(
        page,
        videoId,
        uploadSessionId
      );

      return result;
    } catch (error) {
      console.error('Error in cancel_video_upload action:', error);
      throw error;
    }
  },
});
