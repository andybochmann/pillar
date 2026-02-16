import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.pillar.app",
  appName: "Pillar",
  webDir: "public",
  server: {
    url: process.env.CAPACITOR_SERVER_URL || "http://10.0.2.2:3000",
    androidScheme: "https",
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
