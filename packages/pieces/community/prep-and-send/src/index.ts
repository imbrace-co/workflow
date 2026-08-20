
import { createPiece, PieceAuth } from "@activepieces/pieces-framework";
import { prepAndSendAction } from "./lib/actions/prep-and-send";

export const prepAndSend = createPiece({
  displayName: "Prep And Send",
  description: "Gather the defined label and paired data for next connector",
  auth: PieceAuth.None(),
  minimumSupportedRelease: '0.36.1',
  logoUrl: "https://www.svgrepo.com/show/435937/request-send.svg",
  authors: [],
  actions: [prepAndSendAction],
  triggers: [],
});
