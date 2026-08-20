import { createAction, Property } from '@activepieces/pieces-framework';
import { facebookGraphCommon, FacebookPageDropdown } from '../common/common';
import { facebookGraphAuth } from '../..';

export const uploadVideoChunk = createAction({
  auth: facebookGraphAuth,
  name: 'upload_video_chunk',
  displayName: 'Upload Video Chunk',
  description: 'Upload a chunk of video data to a resumable upload session',
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
    startOffset: Property.Number({
      displayName: 'Start Offset',
      description: 'The byte offset where this chunk starts',
      required: true,
    }),
    videoFileChunk: Property.ShortText({
      displayName: 'Video File Chunk URL',
      description: 'URL to the video chunk file to upload',
      required: true,
    }),
  },
  async run(context) {
    try {
      const page = context.propsValue.page as FacebookPageDropdown;
      const videoId = context.propsValue.videoId;
      const uploadSessionId = context.propsValue.uploadSessionId;
      const startOffset = context.propsValue.startOffset;
      const videoFileChunk = context.propsValue.videoFileChunk;

      const result = await facebookGraphCommon.uploadVideoChunk(
        page,
        videoId,
        uploadSessionId,
        startOffset,
        videoFileChunk
      );

      return result;
    } catch (error) {
      console.error('Error in upload_video_chunk action:', error);
      throw error;
    }
  },
});
