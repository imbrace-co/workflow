/**
 * Community edition: postMessage protocol for the `/embed` routes.
 *
 * The embedding SDK itself is an enterprise feature and is not part of this
 * repository. The embed routes still exchange messages with a parent window,
 * so this module declares only the event names and payload shapes those routes
 * send and receive. It is written for this codebase from how the routes use
 * the messages; it contains no enterprise code.
 */

export enum ActivepiecesClientEventName {
  CLIENT_INIT = 'CLIENT_INIT',
  CLIENT_ROUTE_CHANGED = 'CLIENT_ROUTE_CHANGED',
  CLIENT_NEW_CONNECTION_DIALOG_CLOSED = 'CLIENT_NEW_CONNECTION_DIALOG_CLOSED',
  CLIENT_SHOW_CONNECTION_IFRAME = 'CLIENT_SHOW_CONNECTION_IFRAME',
  CLIENT_CONNECTION_NAME_IS_INVALID = 'CLIENT_CONNECTION_NAME_IS_INVALID',
  CLIENT_AUTHENTICATION_SUCCESS = 'CLIENT_AUTHENTICATION_SUCCESS',
  CLIENT_AUTHENTICATION_FAILED = 'CLIENT_AUTHENTICATION_FAILED',
  CLIENT_CONFIGURATION_FINISHED = 'CLIENT_CONFIGURATION_FINISHED',
  CLIENT_CONNECTION_PIECE_NOT_FOUND = 'CLIENT_CONNECTION_PIECE_NOT_FOUND',
  CLIENT_BUILDER_HOME_BUTTON_CLICKED = 'CLIENT_BUILDER_HOME_BUTTON_CLICKED',
}

export enum ActivepiecesVendorEventName {
  VENDOR_INIT = 'VENDOR_INIT',
  VENDOR_ROUTE_CHANGED = 'VENDOR_ROUTE_CHANGED',
}

/** Query parameters read by the embedded new-connection dialog route. */
export const NEW_CONNECTION_QUERY_PARAMS = {
  name: 'name',
  connectionName: 'connectionName',
  randomId: 'randomId',
} as const;

type EmbedMessage<T extends string, D> = {
  type: T;
  data: D;
};

export type ActivepiecesClientInit = EmbedMessage<
  ActivepiecesClientEventName.CLIENT_INIT,
  Record<string, never>
>;

export type ActivepiecesClientAuthenticationSuccess = EmbedMessage<
  ActivepiecesClientEventName.CLIENT_AUTHENTICATION_SUCCESS,
  Record<string, never>
>;

export type ActivepiecesClientAuthenticationFailed = EmbedMessage<
  ActivepiecesClientEventName.CLIENT_AUTHENTICATION_FAILED,
  unknown
>;

export type ActivepiecesClientConfigurationFinished = EmbedMessage<
  ActivepiecesClientEventName.CLIENT_CONFIGURATION_FINISHED,
  Record<string, never>
>;

export type ActivepiecesClientShowConnectionIframe = EmbedMessage<
  ActivepiecesClientEventName.CLIENT_SHOW_CONNECTION_IFRAME,
  Record<string, never>
>;

export type ActivepiecesNewConnectionDialogClosed = EmbedMessage<
  ActivepiecesClientEventName.CLIENT_NEW_CONNECTION_DIALOG_CLOSED,
  { connection?: { id: string; name: string } }
>;

export type ActivepiecesClientConnectionNameIsInvalid = EmbedMessage<
  ActivepiecesClientEventName.CLIENT_CONNECTION_NAME_IS_INVALID,
  { error: string }
>;

export type ActivepiecesClientConnectionPieceNotFound = EmbedMessage<
  ActivepiecesClientEventName.CLIENT_CONNECTION_PIECE_NOT_FOUND,
  { error: string }
>;

export type ActivepiecesVendorRouteChanged = EmbedMessage<
  ActivepiecesVendorEventName.VENDOR_ROUTE_CHANGED,
  { vendorRoute: string }
>;

export type ActivepiecesVendorInit = EmbedMessage<
  ActivepiecesVendorEventName.VENDOR_INIT,
  {
    jwtToken: string;
    mode?: 'light' | 'dark';
    locale?: string;
    initialRoute?: string;
    hideSidebar: boolean;
    hideFlowNameInBuilder?: boolean;
    disableNavigationInBuilder: boolean | 'keep_home_button_only';
    hideFolders?: boolean;
    sdkVersion?: string;
    fontUrl?: string;
    fontFamily?: string;
    hideExportAndImportFlow?: boolean;
    emitHomeButtonClickedEvent?: boolean;
    homeButtonIcon?: 'back' | 'logo';
    hideDuplicateFlow?: boolean;
    hideFlowsPageNavbar?: boolean;
    hidePageHeader?: boolean;
  }
>;
