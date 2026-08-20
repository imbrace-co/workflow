import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

import { SocketProvider } from '@/components/socket-provider';
import { useTelemetry } from '@/components/telemetry-provider';
import { flagsHooks } from '@/hooks/flags-hooks';
import { platformHooks } from '@/hooks/platform-hooks';
import { projectHooks } from '@/hooks/project-hooks';

import { authenticationSession } from '../../lib/authentication-session';
import { dashboardAutoLogin } from '../../lib/dashboard-auto-login';

type AllowOnlyLoggedInUserOnlyGuardProps = {
  children: React.ReactNode;
};
export const AllowOnlyLoggedInUserOnlyGuard = ({
  children,
}: AllowOnlyLoggedInUserOnlyGuardProps) => {
  const { reset } = useTelemetry();
  const location = useLocation();
  const [isCheckingAutoLogin, setIsCheckingAutoLogin] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    const checkAutoLogin = async () => {
      // Prevent multiple simultaneous checks
      if (isCheckingAutoLogin || hasChecked) {
        console.log('Auth Guard: Skipping check - already checking or checked:', { isCheckingAutoLogin, hasChecked });
        return;
      }
      console.log('Auth Guard: Checking authentication status');

      // Debug: Check what tokens we have
      console.log('Auth Guard: Dashboard tokens:', {
        accessToken: dashboardAutoLogin.getAccessToken() ? 'present' : 'missing',
        organizationId: dashboardAutoLogin.getOrganizationId() || 'missing',
        userId: dashboardAutoLogin.getUserId() || 'missing'
      });

      // Check for external authentication first
      const hasExternalAuth = Boolean(
        dashboardAutoLogin.getAccessToken() && dashboardAutoLogin.getOrganizationId(),
      );

      if (hasExternalAuth) {
        console.log('Auth Guard: External authentication tokens found');
        return;
      }

      console.log('Auth Guard: Currently logged in?', authenticationSession.isLoggedIn());

      if (!authenticationSession.isLoggedIn()) {
        console.log('Auth Guard: Not logged in, attempting dashboard auto-login');
        setIsCheckingAutoLogin(true);
        const loginSuccess = await dashboardAutoLogin.checkAndAutoLogin();
        setIsCheckingAutoLogin(false);
        setHasChecked(true);

        if (!loginSuccess) {
          // If auto-login failed and still not logged in, proceed with normal flow
          if (!authenticationSession.isLoggedIn() && !dashboardAutoLogin.getAccessToken()) {
            console.log('Auth Guard: Auto-login failed, proceeding with logout');
            authenticationSession.logOut();
            reset();
          }
        }
      } else {
        setHasChecked(true);
      }
    };

    checkAutoLogin();
  }, [reset]);

  // Show loading while checking auto-login
  if (isCheckingAutoLogin) {
    return <div>Loading...</div>;
  }

  // Check if user is authenticated (either JWT token or external auth)
  const hasExternalAuth = Boolean(
    dashboardAutoLogin.getAccessToken() && dashboardAutoLogin.getOrganizationId(),
  );
  const isAuthenticated = authenticationSession.isLoggedIn() || hasExternalAuth;

  if (!isAuthenticated) {
    console.log('Auth Guard: Not authenticated, redirecting to sign-in');
    authenticationSession.logOut();
    reset();
    const searchParams = new URLSearchParams();
    searchParams.set('from', location.pathname + location.search);
    return <Navigate to={`/sign-in?${searchParams.toString()}`} replace />;
  }
  platformHooks.useCurrentPlatform();
  flagsHooks.useFlags();
  projectHooks.useCurrentProject();
  return <SocketProvider>{children}</SocketProvider>;
};
