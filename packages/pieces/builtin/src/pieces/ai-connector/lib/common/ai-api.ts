// pieces/common/ai-api.ts
import { HttpMethod } from '@activepieces/pieces-common';
import { imbraceApiRequest } from './api';

// Assistants come from chat-ai via the app-gateway (`/ai/v3/accounts/assistants`),
// not the retired legacy backend. The gateway needs an org access token.
export async function getAccountAssistants(
  organizationId: string,
  accessToken?: string
): Promise<any[]> {
  try {
    const res = await imbraceApiRequest(
      HttpMethod.GET,
      '/ai/v3/accounts/assistants?limit=1000',
      {},
      false,
      accessToken,
      { 'x-organization-id': organizationId }
    );
    return res?.data ?? res ?? [];
  } catch (error) {
    console.error('<getAccountAssistants> error: ', error);
    return [];
  }
}

export async function getAccountAssistantsV2(
  organizationId: string,
  accessToken?: string
): Promise<any[]> {
  return getAccountAssistants(organizationId, accessToken);
}

export function getAssistantById(
  assistants: Record<string, any>[],
  assistantId: string
): Record<string, any> | null {
  return assistants.find((assistant) => assistant['assistant_id'] === assistantId || assistant['id'] === assistantId) ?? null;
}
