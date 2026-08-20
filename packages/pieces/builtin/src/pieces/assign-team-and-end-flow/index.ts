
import { createPiece, PieceAuth } from "@activepieces/pieces-framework";
import { PieceCategory } from '@activepieces/shared';
import { assignTeamAndEndFlow } from './lib/actions/assign-team-and-end-flow';

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

export const assignTeam = createPiece({
  displayName: "Assign Team and End Flow",
  description: 'Call for service and end the flow',
  auth: PieceAuth.None(),
  categories: [PieceCategory.COMMUNICATION],
  minimumSupportedRelease: '0.36.1',
  logoUrl: "https://www.svgrepo.com/show/371691/assign-user.svg",
  authors: [],
  actions: [assignTeamAndEndFlow],
  triggers: [],
});
