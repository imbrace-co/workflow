import { createAction, Property } from '@activepieces/pieces-framework';
import { facebookGraphCommon, FacebookPageDropdown } from '../common/common';
import { facebookGraphAuth } from '../..';

export const initVideoUpload = createAction({
  auth: facebookGraphAuth,
  name: 'init_video_upload',
  displayName: 'Initialize Video Upload',
  description: 'Initialize a resumable video upload session for large video files',
  props: {
    page: facebookGraphCommon.page,
    title: Property.ShortText({
      displayName: 'Title',
      description: 'The title of the video',
      required: false,
    }),
    description: Property.LongText({
      displayName: 'Description',
      description: 'The description of the video',
      required: false,
    }),
    fileSize: Property.Number({
      displayName: 'File Size',
      description: 'The total size of the video file in bytes',
      required: true,
    }),
  },
  async run(context) {
    try {
      const page = context.propsValue.page as FacebookPageDropdown;
      const title = context.propsValue.title;
      const description = context.propsValue.description;
      const fileSize = context.propsValue.fileSize;

      const result = await facebookGraphCommon.initVideoUpload(
        page,
        fileSize,
        title,
        description
      );

      return result;
    } catch (error) {
      console.error('Error in init_video_upload action:', error);
      throw error;
    }
  },
});
