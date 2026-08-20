import { createPiece, PieceAuth } from '@activepieces/pieces-framework';
import { PieceCategory } from '@activepieces/shared';
import { askAQuestion } from './lib/actions/ask-a-question';

export const askQuestion = createPiece({
  displayName: 'Ask a Question',
  description: 'Ask a question (unrelated to contact info) and save the answer with a specified label',
  categories: [PieceCategory.COMMUNICATION, PieceCategory.ACTIONS],
  auth: PieceAuth.None(),
  minimumSupportedRelease: '0.36.1',
  logoUrl: '/node-icons/icon_ask_question.svg',
  authors: [],
  actions: [askAQuestion],
  triggers: [],
});
