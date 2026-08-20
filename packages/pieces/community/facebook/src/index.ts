import { PieceAuth, createPiece } from '@activepieces/pieces-framework';

import { PieceCategory } from '@activepieces/shared';
import { createPhotoPost } from './lib/actions/create-photo-post';
import { createPost } from './lib/actions/create-post';
import { createVideoPost } from './lib/actions/create-video-post';
import { deletePagePost } from './lib/actions/delete-page-post';
import { getPageInfo } from './lib/actions/get-page-info';
import { getPagePosts } from './lib/actions/get-page-posts';
import { getPostDetail } from './lib/actions/get-post-detail';
import { getPostComments } from './lib/actions/get-post-comments';
import { replyPostComment } from './lib/actions/reply-post-comment';
import { likePost } from './lib/actions/like-post';
import { likeComment } from './lib/actions/like-comment';
import { deleteComment } from './lib/actions/delete-comment';
import { getPageConversations } from './lib/actions/get-page-conversations';
import { getConversationMessages } from './lib/actions/get-conversation-messages';
import { sendPageMessage } from './lib/actions/send-page-message';
import { getPageInsights } from './lib/actions/get-page-insights';
import { getPostInsights } from './lib/actions/get-post-insights';
import { getAdCampaigns } from './lib/actions/get-ad-campaigns';
import { getAdSets } from './lib/actions/get-ad-sets';
import { getAds } from './lib/actions/get-ads';
import { getUserProfile } from './lib/actions/get-user-profile';
import { getUserPages } from './lib/actions/get-user-pages';
import { initVideoUpload } from './lib/actions/init-video-upload';
import { uploadVideoChunk } from './lib/actions/upload-video-chunk';
import { cancelVideoUpload } from './lib/actions/cancel-video-upload';
const markdown = `
To Obtain a Client ID and Client Secret:

1. Go to https://developers.facebook.com/
2. Register for a Facebook Developer account.
3. Once login, click "Make a new app" button.
4. Select "Other" for use cases.
5. Choose "Business" as the type of app.
6. Provide application details: custom name and associated email.
7. Once your application is created, you need to add a new "product".
8. Configure a new product of type "Facebook Login Settings".
9. Default settings should be fine, you only need to provide the Redirect URL in "Valid OAuth Redirect URIs" and your domain name in "Allowed Domains for the JavaScript SDK".
10. Finally, get your application ID and application secret from your app dashboard in Settings > Basic.
`;

export const facebookGraphAuth = PieceAuth.OAuth2({
  description: markdown,
  authUrl: 'https://graph.facebook.com/oauth/authorize',
  tokenUrl: 'https://graph.facebook.com/oauth/access_token',
  required: true,
  scope: [
    'pages_show_list',
    'pages_manage_posts',
    'business_management',
    'pages_read_engagement',
    'pages_manage_engagement',
    'pages_messaging',
    'pages_read_user_content',
    'read_insights',
    'ads_read',
    'ads_management'
  ],
});

export const facebookGraph = createPiece({
  displayName: 'Facebook',
  description: 'Interact with Facebook Graph API to manage Pages, Posts, and more',

  minimumSupportedRelease: '0.30.0',
  logoUrl: 'https://cdn.activepieces.com/pieces/facebook.png',
  categories: [PieceCategory.MARKETING],
  authors: ["kishanprmr","MoShizzle","khaledmashaly","abuaboud"],
  auth: facebookGraphAuth,
  actions: [
    createPost,
    createPhotoPost,
    createVideoPost,
    getPageInfo,
    getPagePosts,
    deletePagePost,
    getPostDetail,
    getPostComments,
    replyPostComment,
    likePost,
    likeComment,
    deleteComment,
    getPageConversations,
    getConversationMessages,
    sendPageMessage,
    getPageInsights,
    getPostInsights,
    getAdCampaigns,
    getAdSets,
    getAds,
    getUserProfile,
    getUserPages,
    initVideoUpload,
    uploadVideoChunk,
    cancelVideoUpload,
  ],
  triggers: [],
});
