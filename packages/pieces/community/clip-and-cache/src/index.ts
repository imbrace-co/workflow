
import { createPiece, PieceAuth } from "@activepieces/pieces-framework";
import { clipAndCacheAction } from "./lib/actions/clip-and-cache";

export const clipAndCache = createPiece({
  displayName: "Clip And Cache",
  auth: PieceAuth.None(),
  minimumSupportedRelease: '0.36.1',
  logoUrl: "https://www.svgrepo.com/show/420619/cache-cached-caching.svg",
  authors: [],
  actions: [clipAndCacheAction],
  triggers: [],
});
