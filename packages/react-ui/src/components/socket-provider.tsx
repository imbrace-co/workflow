import React, { useRef } from 'react';
import { useEffectOnce } from 'react-use';
import { io } from 'socket.io-client';

import { API_BASE_URL } from '@/lib/api';
import { authenticationSession } from '@/lib/authentication-session';

import { useToast } from './ui/use-toast';

const socket = io(API_BASE_URL, {
  transports: ['websocket'],
  path: '/api/socket.io',
  autoConnect: false,
  reconnection: true,
});

const SocketContext = React.createContext<typeof socket>(socket);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const token = authenticationSession.getToken();
  const org_id = authenticationSession.getOrganizationId();
  const { dismiss, toast } = useToast();
  const toastIdRef = useRef<string | null>(null);

  useEffectOnce(() => {
    console.log('SocketProvider: Initializing socket connection', { org_id });
    if (token || org_id) {
      socket.auth = { token, org_id };
      if (!socket.connected) {
        console.log('SocketProvider: Connecting socket...');
        socket.connect();

        socket.on('connect', () => {
          if (toastIdRef.current) {
            dismiss(toastIdRef.current);
            toastIdRef.current = null;
          }
          console.log('connected to socket');
        });

        socket.on('disconnect', (reason) => {
          if (!toastIdRef.current) {
            const { id } = toast({
              itemID: 'websocket-disconnected',
              title: 'Connection Lost',
              description: 'We are trying to reconnect...',
              duration: Infinity,
              variant: 'default',
            });
            toastIdRef.current = id;
          }
          if (reason === 'io server disconnect') {
            socket.connect();
          }
        });
      }
    } else {
      socket.disconnect();
    }
  });

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};

export const useSocket = () => React.useContext(SocketContext);
