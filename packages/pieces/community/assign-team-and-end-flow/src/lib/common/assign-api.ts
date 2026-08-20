// pieces/common/ai-api.ts
import { HttpMethod } from '@activepieces/pieces-common';
import { imbraceApiRequest } from './api';

export async function getTeamsAll(accessToken?: string): Promise<any[]> {
  try {
    const endpoint = `/platform/v1/team/all`;
    
    const response = await imbraceApiRequest(HttpMethod.GET, endpoint, {}, false, accessToken);
    return response || [];
  } catch (error) {
    console.error('<getTeamsAll> error: ', error);
    return [];
  }
}
export async function getAgentsByTeam(teamId: string, accessToken?: string | undefined): Promise<any[]> {
    try {
        const endpoint = `/platform/v1/team/${teamId}/users`;
        const response = await imbraceApiRequest(HttpMethod.GET, endpoint, {}, false, accessToken);
        return response || [];
    } catch (error) {
        console.error('<getAgentsByTeam> error: ', error);
        return [];
    }
}

