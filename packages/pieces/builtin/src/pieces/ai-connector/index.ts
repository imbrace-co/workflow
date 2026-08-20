// pieces/ai-connector/index.ts
import { createPiece, PieceAuth } from '@activepieces/pieces-framework';
import { assistantRequest } from './lib/actions/assistant-request';
import { PieceCategory } from '@activepieces/shared';

export const token = PieceAuth.CustomAuth({
  description: "",
  props:{},
  validate: async (auth) => {
    try {
      console.log('Validating auth token:', auth);
      return {
        valid: true,
      };
    } catch (e) {
      return {
        valid: false,
        error: 'Invalid API key',
      };
    }
  },
  required: true,
});


export const aiConnector = createPiece({
  auth: PieceAuth.None(),
  displayName: 'AI agents',
  description: 'Return response data from AI assistant',
  minimumSupportedRelease: '0.36.1',
  authors: ['you'],
  logoUrl: '/node-icons/icon_ai_agents.svg',
  categories: [PieceCategory.ARTIFICIAL_INTELLIGENCE],
  actions: [assistantRequest],
  triggers: [],
});
