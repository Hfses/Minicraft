/**
 * Shared lazy loader for the react-native-udp NATIVE module.
 *
 * Importing it at module top-level crashes the whole route (white screen)
 * in builds that don't bundle the native code (e.g. Expo Go). Every file
 * that needs UDP must go through loadDgram() and handle `null`.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dgramModule: any | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadDgram(): any | null {
  if (dgramModule !== undefined) return dgramModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("react-native-udp");
    dgramModule = mod?.default ?? mod ?? null;
  } catch {
    dgramModule = null;
  }
  return dgramModule;
}

/** True when the native UDP module is available in this build. */
export function isUdpAvailable(): boolean {
  return loadDgram() !== null;
}
