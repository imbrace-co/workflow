import { Navigate, useLocation } from 'react-router-dom';
import React, { useEffect, useState } from 'react';

import { useAuthorization } from '@/hooks/authorization-hooks';
import { authenticationSession } from '@/lib/authentication-session';
import { dashboardAutoLogin } from '@/lib/dashboard-auto-login';
import { determineDefaultRoute } from '@/lib/utils';
import { api } from '@/lib/api';

export const DefaultRoute = () => {
  const [authState, setAuthState] = useState<'checking' | 'jwt' | 'external' | 'none'>('checking');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const location = useLocation();
  const { checkAccess } = useAuthorization();

  useEffect(() => {
    const checkAuthentication = async () => {
      console.log('DefaultRoute: Starting authentication check');

      // First, check for external tokens (immediate check)
      const accessToken = dashboardAutoLogin.getAccessToken();
      const organizationId = dashboardAutoLogin.getOrganizationId();
      const hasExternalTokens = Boolean(accessToken && organizationId);

      if (hasExternalTokens) {
        console.log('DefaultRoute: External authentication tokens found - setting state to external');
        setAuthState('external');
        return;
      }

      // Check JWT authentication
      if (authenticationSession.isLoggedIn()) {
        console.log('DefaultRoute: JWT authentication found');
        setAuthState('jwt');
        return;
      }

      // Try dashboard auto-login (this will check URL params and store tokens)
      console.log('DefaultRoute: No authentication found, trying auto-login');
      const loginSuccess = await dashboardAutoLogin.checkAndAutoLogin();

      if (loginSuccess) {
        // Check again for external tokens after auto-login
        const hasExternalTokensAfterLogin = Boolean(
          dashboardAutoLogin.getAccessToken() &&
            dashboardAutoLogin.getOrganizationId(),
        );

        if (hasExternalTokensAfterLogin) {
          console.log('DefaultRoute: Auto-login successful, external tokens available - redirecting to flows');
          setAuthState('external');
        } else if (authenticationSession.isLoggedIn()) {
          console.log('DefaultRoute: Auto-login successful, JWT available');
          setAuthState('jwt');
        } else {
          console.log('DefaultRoute: Auto-login completed but no valid authentication found');
          setAuthState('none');
        }
      } else {
        console.log('DefaultRoute: Auto-login failed');
        setAuthState('none');
      }
    };

    checkAuthentication();
  }, [location.pathname, location.search]);

  // Effect to fetch project ID for external auth - MUST be before any conditional returns
  useEffect(() => {
    if (authState === 'external' && !projectId && !isLoadingProject) {
      console.log('DefaultRoute: External auth confirmed, fetching project ID for redirect');
      setIsLoadingProject(true);

      const fetchProjectId = async () => {
        try {
          const data = await api.get<any>('/v1/flows', { limit: 1 });
          if (data.data && data.data.length > 0) {
            const fetchedProjectId = data.data[0].projectId as string;
            console.log('DefaultRoute: Setting projectId state to:', fetchedProjectId);
            setProjectId(fetchedProjectId);
            try {
              await authenticationSession.switchToProject(fetchedProjectId);
              console.log('DefaultRoute: Persisted projectId into session');
            } catch (e) {
              console.warn('DefaultRoute: Failed to switch project in session (may be no-op for external auth)', e);
            }
          } else {
            // No flows exist, use a placeholder projectId that the backend will handle
            setProjectId('external-auto-project');
          }
        } catch (error) {
          setProjectId('external-error-project');
        } finally {
          setIsLoadingProject(false);
        }
      };

      fetchProjectId();
    }
  }, [authState, projectId, isLoadingProject]);

  console.log('DefaultRoute: Current auth state:', authState, {
    hasTokens: !!(dashboardAutoLogin.getAccessToken() && dashboardAutoLogin.getOrganizationId()),
    hasJWT: authenticationSession.isLoggedIn()
  });

  // Show loading while checking
  if (authState === 'checking') {
    return <div>Loading authentication...</div>;
  }

  // Handle external authentication - redirect to flows with project context
  if (authState === 'external') {

    if (isLoadingProject) {
      console.log('DefaultRoute: Still loading project, showing loading screen');
      return <div>Loading project...</div>;
    }

    if (projectId) {
      const redirectUrl = `/projects/${projectId}/flows`;
      console.log('DefaultRoute: Redirecting to project flows:', redirectUrl);
      return <Navigate to={redirectUrl} replace />;
    }

    // Fallback if something went wrong: stay and wait rather than bouncing
    console.log('DefaultRoute: No project ID yet, showing loading');
    return <div>Loading project...</div>;
  }

  // Handle JWT authentication - use permission-based routing
  if (authState === 'jwt') {
    console.log('DefaultRoute: JWT auth confirmed, using determineDefaultRoute');
    return <Navigate to={determineDefaultRoute(checkAccess)} replace />;
  }

  // Handle no authentication - redirect to sign-in
  console.log('DefaultRoute: No authentication, redirecting to sign-in');
  const searchParams = new URLSearchParams();
  searchParams.set('from', location.pathname + location.search);

  return (
    <Navigate
      to={`/sign-in?${searchParams.toString()}`}
      replace
    />
  );
};
