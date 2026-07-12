import Constants from "expo-constants";

/** Backend base URL, injected at build time via EXPO_PUBLIC_API_URL. */
export const API_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? "http://127.0.0.1:8080";

/** Derive the WebSocket signaling URL from the API URL. */
export const WS_URL: string = API_URL.replace(/^http/, "ws") + "/ws";
