import {
  PlatformWithoutSensitiveData,
  UpdatePlatformRequestBody,
} from '@activepieces/shared';

import { api } from './api';
import { authenticationSession } from './authentication-session';
import { dashboardAutoLogin } from './dashboard-auto-login';
import { userApi } from './user-api';

export const platformApi = {
  deleteAccount() {
    return api.delete<void>(
      `/v1/platforms/${authenticationSession.getPlatformId()}`,
    );
  },
  async getCurrentPlatform() {
     // For external authentication, get platform ID from current user
    const organizationId = dashboardAutoLogin.getOrganizationId();
    if (organizationId) {
      console.log('Platform API: External auth detected, fetching user info to get platform ID');
      try {
        const currentUser = await userApi.getCurrentUser();
        const platformId = currentUser.platformId;
        const projectId = currentUser.projectId;

        // Cache the IDs for future use if they exist
        if (platformId && projectId) {
          authenticationSession.cacheExternalIds(platformId, projectId);
        }

        if (!platformId) {
          throw new Error('No platform ID found in user data for external authentication');
        }

        console.log('Platform API: Using platform ID from user info:', platformId);
        return api.get<PlatformWithoutSensitiveData>(`/v1/platforms/${platformId}`);
      } catch (error) {
        console.error('Platform API: Failed to get current user for external auth:', error);
        throw error;
      }
    }

    const platformId = authenticationSession.getPlatformId();
    if (!platformId) {
      throw Error('No platform id found');
    }
    return api.get<PlatformWithoutSensitiveData>(`/v1/platforms/${platformId}`);
  },

  async verifyLicenseKey(licenseKey: string) {
    // For external authentication, get platform ID from current user
     const organizationId = dashboardAutoLogin.getOrganizationId();
    if (organizationId) {
      const currentUser = await userApi.getCurrentUser();
      const platformId = currentUser.platformId;
      return api.post<void>(`/v1/license-keys/verify`, {
        platformId,
        licenseKey,
      });
    }


    // For JWT authentication, use platform ID from token
    const platformId = authenticationSession.getPlatformId();
    if (!platformId) {
      throw Error('No platform id found');
    }
    return api.post<void>(`/v1/license-keys/verify`, {
      platformId,
      licenseKey,
    });
  },

  update(req: UpdatePlatformRequestBody, platformId: string) {
    return api.post<PlatformWithoutSensitiveData>(
      `/v1/platforms/${platformId}`,
      req,
    );
  },
};
