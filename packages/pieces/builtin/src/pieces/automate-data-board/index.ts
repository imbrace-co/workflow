import { createPiece, PieceAuth } from '@activepieces/pieces-framework';
// Import actions
// import { createRecord } from './lib/actions/create';
// import { updateFields } from './lib/actions/update';
// import { clearFields } from './lib/actions/clearFields';
// import { deleteRecord } from './lib/actions/deleteRecord';
// import { getAllRecords } from './lib/actions/getAllRecords';
// import { getBoardDetails } from './lib/actions/getBoardDetails';
// import { searchRecords } from './lib/actions/searchRecords';
import { autoDataBoard } from './lib/actions/autoDataBoard';
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

export const automateDataBoard = createPiece({
  displayName: 'Automate Data Board',
  description: 'Automate data board creation',
  categories: [PieceCategory.CORE, PieceCategory.COMMUNICATION],
  auth: PieceAuth.None(),
  minimumSupportedRelease: '0.36.1',
  logoUrl: '/node-icons/icon_automation.svg',
  authors: [],
  actions: [autoDataBoard],
  triggers: [],
});
