import Constants from "expo-constants";
import { RELAY_PATH } from "@crafttogether/shared";

/** Backend base URL, injected at build time via EXPO_PUBLIC_API_URL. */
export const API_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? "http://127.0.0.1:8080";

/** Derive the WebSocket signaling URL from the API URL. */
export const WS_URL: string = API_URL.replace(/^http/, "ws") + "/ws";

/** Relay WebSocket base URL (per-peer token is appended as ?token=). */
export const RELAY_WS_URL: string = API_URL.replace(/^http/, "ws") + RELAY_PATH;
