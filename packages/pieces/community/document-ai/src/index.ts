import { createPiece, PieceAuth } from '@activepieces/pieces-framework';
import { documentAiAction } from './lib/actions/document-ai';
import { PieceCategory } from '@activepieces/shared';

export const documentAi = createPiece({
  displayName: 'Document AI',
  auth: PieceAuth.None(),
  categories: [PieceCategory.ARTIFICIAL_INTELLIGENCE, PieceCategory.MOST_COMMON_USE],
  minimumSupportedRelease: '0.36.1',
  logoUrl: '/node-icons/icon_document_ai.svg',
  authors: [],
  actions: [documentAiAction],
  triggers: [],
});
