
import { createPiece, PieceAuth } from "@activepieces/pieces-framework";
import { recordLinkerAction } from "./lib/actions/record-linker";
import { PieceCategory } from "@activepieces/shared";

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

export const recordLinker = createPiece({
  displayName: "Record Linker",
  description: "Link record(s) to a specified board",
  categories: [PieceCategory.SALES_AND_CRM],
  auth: PieceAuth.None(),
  minimumSupportedRelease: '0.36.1',
  logoUrl: "https://www.svgrepo.com/show/448373/connection.svg",
  authors: [],
  actions: [recordLinkerAction],
  triggers: [],
});
