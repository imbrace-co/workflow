import { useQuery } from '@tanstack/react-query';

import { gatewayApi } from './gateway-api';

export type AiAssistant = {
  id: string;
  name: string;
  mode: 'standard' | 'advanced';
  description?: string;
  streaming?: boolean;
};

export const imbraceAiAssistantApi = {
  async list(): Promise<AiAssistant[]> {
    try {
      const assistants = await gatewayApi.get<AiAssistant[]>(
        '/ai/v3/accounts/assistants',
        { limit: 1000 },
      );
      // Normalize assistant data
      return (assistants ?? []).map((a) => ({
        ...a,
        mode: a.mode || 'standard',
        description: a.description || undefined,
      }));
    } catch (error) {
      console.error('Failed to fetch AI assistants:', error);
      return [];
    }
  },
};

export const useAiAssistants = (enabled = true) => {
  return useQuery<AiAssistant[], Error>({
    queryKey: ['ai-assistants'],
    queryFn: () => imbraceAiAssistantApi.list(),
    staleTime: 60 * 1000,
    enabled,
  });
};
