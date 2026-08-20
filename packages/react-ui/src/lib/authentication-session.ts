import dayjs from 'dayjs';
import { jwtDecode } from 'jwt-decode';

import {
  AuthenticationResponse,
  isNil,
  UserPrincipal,
} from '@activepieces/shared';

import { ApStorage } from './ap-browser-storage';
import { authenticationApi } from './authentication-api';
import { dashboardAutoLogin } from './dashboard-auto-login';
const tokenKey = 'token';
const imbraceTokenKey = "imbrace-access-token";
const orgIdKey = "organization_id";
const externalPlatformIdKey = 'external-platform-id';
const externalProjectIdKey = 'external-project-id';

export const authenticationSession = {
  saveResponse(response: AuthenticationResponse, isEmbedding: boolean) {
    if (isEmbedding) {
      ApStorage.setInstanceToSessionStorage();
    }
    ApStorage.getInstance().setItem(tokenKey, response.token);
    window.dispatchEvent(new Event('storage'));
  },
  isJwtExpired(token: string): boolean {
    if (!token) {
      return true;
    }
    try {
      const decoded = jwtDecode(token);
      if (decoded && decoded.exp && dayjs().isAfter(dayjs.unix(decoded.exp))) {
        return true;
      }
      return false;
    } catch (e) {
      return true;
    }
  },
  getToken(): string | null {
    return ApStorage.getInstance().getItem(tokenKey) ?? null;
  },
  getImbraceToken(): string | null {
    return ApStorage.getInstance().getItem(imbraceTokenKey) ?? null;
  },
  getOrganizationId(): string | null {
    return ApStorage.getInstance().getItem(orgIdKey) ?? null;
  },

  getProjectId(): string | null {
       return "";
  },
  getCurrentUserId(): string | null {
    const token = this.getToken();
    if (isNil(token)) {
      return null;
    }
    const decodedJwt = getDecodedJwt(token);
    return decodedJwt.id;
  },
  appendProjectRoutePrefix(path: string): string {
    // DEPRECATED: Project routes no longer need projectId prefix with org-based context
    // Return path as-is since project context is auto-resolved from organization
    return path;
  },
  getPlatformId(): string | null {
    // For external authentication, check if we have cached platform ID
    const organizationId = dashboardAutoLogin.getOrganizationId();
    if (organizationId) {
      const cachedPlatformId = ApStorage.getInstance().getItem(externalPlatformIdKey);
      if (cachedPlatformId) {
        return cachedPlatformId;
      }
      // If not cached, return null - the caller should use platform API to get and cache it
      return null;
    }

    // For JWT authentication, use platform ID from token
    const token = this.getToken();
    if (isNil(token)) {
      return null;
    }
    const decodedJwt = getDecodedJwt(token);
    return decodedJwt.platform.id;
  },
  async switchToPlatform(platformId: string) {
    if (authenticationSession.getPlatformId() === platformId) {
      return;
    }
    const result = await authenticationApi.switchPlatform({
      platformId,
    });
    ApStorage.getInstance().setItem(tokenKey, result.token);
    window.location.href = '/';
  },
  async switchToProject(projectId: string) {
    // DEPRECATED: Project switching not needed with org-based context
    // Projects are automatically resolved from organization authentication
    console.warn('switchToProject() is deprecated - projects are now auto-resolved from organization context');
  },
  isLoggedIn(): boolean {
    const token = this.getToken();
    if (isNil(token)) {
      // console.warn('AuthenticationSession: No token found, user is not logged in');
      return false;
    }
    return !this.isJwtExpired(token);
  },
  clearSession() {
    ApStorage.getInstance().removeItem(tokenKey);
    ApStorage.getInstance().removeItem(externalPlatformIdKey);
    ApStorage.getInstance().removeItem(externalProjectIdKey);
  },
  logOut() {
    this.clearSession();
    window.location.href = '/sign-in';
  },
  // Cache external platform ID for external authentication
  // Note: projectId no longer cached as it's auto-resolved from organization context
  cacheExternalIds(platformId: string, projectId?: string) {
    ApStorage.getInstance().setItem(externalPlatformIdKey, platformId);
    // Project ID caching removed - auto-resolved from organization context
  },
};

function getDecodedJwt(token: string): UserPrincipal {
  return jwtDecode<UserPrincipal>(token);
}
