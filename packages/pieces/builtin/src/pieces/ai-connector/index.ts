// pieces/ai-connector/index.ts
import { createPiece, PieceAuth } from '@activepieces/pieces-framework';
import { assistantRequest } from './lib/actions/assistant-request';
import { PieceCategory } from '@activepieces/shared';

// Optional: flows started by iMBrace services carry the caller's token. Flows started
// any other way (a plain webhook, a schedule) need an organization API key instead.
export const imbraceAuth = PieceAuth.SecretText({
  displayName: 'iMBrace API key',
  description:
    'Organization API key (api_...). Needed when the flow is not started by an iMBrace service, for example from a plain webhook or a schedule.',
  required: false,
});

export const aiConnector = createPiece({
  auth: imbraceAuth,
  displayName: 'AI agents',
  description: 'Return response data from AI assistant',
  minimumSupportedRelease: '0.36.1',
  authors: ['you'],
  logoUrl: '/node-icons/icon_ai_agents.svg',
  categories: [PieceCategory.ARTIFICIAL_INTELLIGENCE],
  actions: [assistantRequest],
  triggers: [],
});
