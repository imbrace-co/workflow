
import { createPiece, PieceAuth } from "@activepieces/pieces-framework";
import { PieceCategory } from "@activepieces/shared";
import { endFlow } from './lib/actions/end-flow';

export const token = PieceAuth.CustomAuth({
  description: "",
  props: {},
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
export const endTheFlow = createPiece({
  displayName: "End-flow",
  auth: PieceAuth.None(),
  categories: [PieceCategory.COMMUNICATION],
  minimumSupportedRelease: '0.36.1',
  logoUrl: "/node-icons/icon_end_flow.svg",
  authors: [],
  actions: [endFlow],
  triggers: [],
});
