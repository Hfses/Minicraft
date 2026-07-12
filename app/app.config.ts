import type { ExpoConfig } from "expo/config";

/**
 * Expo app config. `react-native-udp` requires native code, so this app runs in
 * a Dev Client or a full build (not Expo Go). Run `expo prebuild` then
 * `expo run:android` / `expo run:ios`, or build with EAS.
 */
const config: ExpoConfig = {
  name: "CraftTogether",
  slug: "crafttogether",
  version: "0.1.0",
  orientation: "portrait",
  scheme: "crafttogether",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  // Old architecture keeps the CI APK build simpler and more reliable for now.
  newArchEnabled: false,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#14532d",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.crafttogether.app",
    infoPlist: {
      // Allow the on-device proxy to talk to the local Minecraft world.
      NSLocalNetworkUsageDescription:
        "O CraftTogether usa a rede local para descobrir e conectar mundos do Minecraft entre amigos.",
      NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
    },
  },
  android: {
    package: "com.crafttogether.app",
    permissions: ["INTERNET", "ACCESS_NETWORK_STATE", "ACCESS_WIFI_STATE"],
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#14532d",
    },
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    // Compose compiler in expo-modules-core (SDK 52) needs Kotlin 1.9.25.
    ["expo-build-properties", { android: { kotlinVersion: "1.9.25" } }],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8080",
  },
};

export default config;
