import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { SessionProvider } from "../lib/session";
export default function Layout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerTitle: "SilverFit · 실버핏",
            headerTintColor: "#c2410c",
            headerShadowVisible: false,
            headerStyle: { backgroundColor: "#fffaf5" },
          }}
        />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
