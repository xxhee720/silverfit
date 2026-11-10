import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fffaf5" },
  body: { padding: 22, paddingBottom: 50, gap: 18 },
  title: { fontSize: 28, fontWeight: "800", color: "#292524" },
  subtitle: { fontSize: 18, fontWeight: "700", color: "#292524" },
  text: { fontSize: 16, lineHeight: 25, color: "#57534e" },
  card: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#f1e4d8",
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d6cec5",
    borderRadius: 12,
    padding: 14,
    fontSize: 17,
    color: "#292524",
    backgroundColor: "white",
    minHeight: 52,
  },
  button: {
    backgroundColor: "#ea580c",
    borderRadius: 14,
    padding: 16,
    minHeight: 54,
    alignItems: "center",
  },
  buttonText: { fontSize: 17, fontWeight: "700", color: "white" },
  secondary: { backgroundColor: "#57534e" },
  error: { color: "#b91c1c", fontSize: 16, lineHeight: 24 },
  notice: { backgroundColor: "#fff0df", padding: 16, borderRadius: 14, gap: 8 },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  tag: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#f5f5f4",
    minHeight: 48,
  },
  active: { backgroundColor: "#fed7aa" },
  small: { fontSize: 13, color: "#78716c", lineHeight: 20 },
  label: { fontSize: 16, fontWeight: "600", color: "#44403c" },
  brand: { fontSize: 24, fontWeight: "900", color: "#ea580c" },
});
export function Screen({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
      >
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}
export function Button({
  title,
  onPress,
  busy = false,
  disabled = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.secondary,
        (disabled || busy) && { opacity: 0.5 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text style={styles.buttonText}>{title}</Text>
      )}
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={styles.input}
        placeholderTextColor="#9b928b"
        {...props}
      />
    </View>
  );
}
export function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.tag, selected && styles.active]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}
