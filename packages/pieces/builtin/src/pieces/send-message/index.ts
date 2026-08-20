import { createPiece, PieceAuth } from "@activepieces/pieces-framework";
import { PieceCategory } from "@activepieces/shared";
import { sendAMessage } from "./lib/actions/send-a-message";

export const sendMessage = createPiece({
  displayName: "Send a Message",
  description: 'Send a message without waiting for reply to continue',
  categories: [PieceCategory.COMMUNICATION, PieceCategory.ACTIONS],
  auth: PieceAuth.None(),
  minimumSupportedRelease: '0.36.1',
  logoUrl: "/node-icons/icon_send-message.svg",
  authors: [],
  actions: [sendAMessage],
  triggers: [],
});