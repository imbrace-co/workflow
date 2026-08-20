import { authenticationSession } from './authentication-session';
import { ApStorage } from './ap-browser-storage';
import i18n from '../i18n';

const ACCESS_TOKEN_KEY = 'imbrace-access-token';
const ORGANIZATION_ID_KEY = 'organization_id';
const USER_ID_KEY = 'user_id';


const initializeFromUrlParams = () => {
  const handleMessage = (event: MessageEvent) => {
    console.log("AP LISTENING LANGUAGE", event);
    if (event.data?.action === 'SET_LANGUAGE' && event.data?.data?.language) {
      let language = event.data.data.language;
      if (i18n.language === language) {
        return;
      }
      i18n.changeLanguage(language);
    }
  };
  window.addEventListener('message', handleMessage);

  if (typeof window !== 'undefined') {

    console.log('Dashboard auto-login: initializeFromUrlParams() called');
    console.log('Dashboard auto-login: Current URL:', window.location.href);
    console.log('Dashboard auto-login: Current search params:', window.location.search);

    const urlParams = new URLSearchParams(window.location.search);
    let dashboardToken = urlParams.get('token');
    let organizationId = urlParams.get('organizationId');
    let userId = urlParams.get('userId');
    const lang = urlParams.get('lang');

    if (lang) {
      i18n.changeLanguage(lang);
    }

    console.log('Dashboard auto-login: Module initialization - Direct URL params check:', {
      url: window.location.search,
      dashboardToken: dashboardToken ? `${dashboardToken.substring(0, 10)}...` : null,
      organizationId,
      userId: userId ? `${userId.substring(0, 10)}...` : null
    });

    // If not found in direct params, check the 'from' parameter (URL encoded)
    if (!dashboardToken) {
      const fromParam = urlParams.get('from');
      if (fromParam) {
        try {
          const decodedFrom = decodeURIComponent(fromParam);
          const fromUrl = new URL(decodedFrom, window.location.origin);
          dashboardToken = fromUrl.searchParams.get('token');
          organizationId = fromUrl.searchParams.get('organizationId');
          userId = fromUrl.searchParams.get('userId');

        } catch (error) {
          console.log('Dashboard auto-login: Error parsing from parameter:', error);
        }
      }
    }

    if (dashboardToken && dashboardToken.startsWith('acc_')) {
      console.log('Dashboard auto-login: Valid token found, storing in localStorage');
      ApStorage.getInstance().setItem(ACCESS_TOKEN_KEY, dashboardToken);

      if (organizationId) {
        ApStorage.getInstance().setItem(ORGANIZATION_ID_KEY, organizationId);
        console.log('Dashboard auto-login: Organization ID stored:', organizationId);
      }

      if (userId) {
        ApStorage.getInstance().setItem(USER_ID_KEY, userId);
        console.log('Dashboard auto-login: User ID stored:', userId ? `${userId.substring(0, 10)}...` : null);
      }

      // Verify storage
      const storedToken = ApStorage.getInstance().getItem(ACCESS_TOKEN_KEY);
      const storedOrgId = ApStorage.getInstance().getItem(ORGANIZATION_ID_KEY);
      const storedUserId = ApStorage.getInstance().getItem(USER_ID_KEY);
      console.log('Dashboard auto-login: Immediately stored values:', {
        token: storedToken ? `${storedToken.substring(0, 10)}...` : null,
        orgId: storedOrgId,
        userId: storedUserId ? `${storedUserId.substring(0, 10)}...` : null
      });
    } else {
      console.log('Dashboard auto-login: No valid token found in URL params:', {
        dashboardToken,
        startsWithAcc: dashboardToken ? dashboardToken.startsWith('acc_') : false
      });
    }


    // -----------------------------------------------------

  }
};

// Initialize immediately when module loads
initializeFromUrlParams();

export const dashboardAutoLogin = {
  async checkAndAutoLogin(): Promise<boolean> {
    console.log('Dashboard auto-login: Starting checkAndAutoLogin()');

    // For gateway-based auth, check if we have stored external tokens instead of JWT
    // Note: userId is optional for backward compatibility during transition
    const hasExternalAuth = this.getAccessToken() && this.getOrganizationId();
    console.log("hasExternalAuth in checkAndAutoLogin(): ", hasExternalAuth);

    if (hasExternalAuth) {
      return true;
    }

    // Check if already logged in with traditional JWT
    if (authenticationSession.isLoggedIn()) {
      console.log('Dashboard auto-login: Already logged in with JWT, skipping');
      return true;
    }

    // Check if we have stored dashboard token (from module initialization)
    const dashboardToken = this.getAccessToken();
    const organizationId = this.getOrganizationId();
    const userId = this.getUserId();

    console.log('Dashboard auto-login: Checking stored tokens:', {
      dashboardToken: dashboardToken ? `${dashboardToken.substring(0, 10)}...` : null,
      organizationId,
      userId: userId ? `${userId.substring(0, 10)}...` : null,
      tokenStartsWithAcc: dashboardToken?.startsWith('acc_')
    });

    if (!dashboardToken || !dashboardToken.startsWith('acc_')) {
      console.log('Dashboard auto-login: No valid dashboard token found, skipping');
      return false;
    }

    console.log('Dashboard auto-login: Found dashboard token, using gateway-based authentication');

    // With gateway-based authentication, we don't need to call dashboard-signin API
    // The tokens are already stored and will be sent as headers to the gateway
    // The gateway will handle validation and user creation

    // Clean up the URL by removing token parameters
    const newUrl = window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);

    return true;
  },

  getAccessToken(): string | null {
    const token = ApStorage.getInstance().getItem(ACCESS_TOKEN_KEY);
    return token;
  },

  getOrganizationId(): string | null {
    const orgId = ApStorage.getInstance().getItem(ORGANIZATION_ID_KEY);
    return orgId;
  },

  getUserId(): string | null {
    const userId = ApStorage.getInstance().getItem(USER_ID_KEY);
    return userId;
  },

  clearAccessTokenInfo() {
    ApStorage.getInstance().removeItem(ACCESS_TOKEN_KEY);
    ApStorage.getInstance().removeItem(ORGANIZATION_ID_KEY);
    ApStorage.getInstance().removeItem(USER_ID_KEY);
  },
};
