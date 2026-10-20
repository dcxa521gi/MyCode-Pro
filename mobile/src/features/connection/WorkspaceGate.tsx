import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useColors } from "@/ui/theme";
import { useConnection } from "./ConnectionProvider";
import { ConnectScreen } from "./ConnectScreen";
import { WorkspacePicker } from "./WorkspacePicker";
export function WorkspaceGate({ children }: { children: ReactNode }) {
  const colors = useColors();
  const connection = useConnection();
  // Expo Router's root navigator must mount on the first render. Keep it
  // mounted behind setup so selecting a workspace can navigate immediately.
  const setup = connection.restoring ? (
    <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.content} />
    </View>
  ) : !connection.pairing ? (
    <ConnectScreen />
  ) : connection.selection === null ? (
    <WorkspacePicker />
  ) : null;
  return (
    <View style={{ flex: 1 }}>
      {children}
      {setup ? <View style={[StyleSheet.absoluteFill, { zIndex: 1 }]}>{setup}</View> : null}
    </View>
  );
}
