import { Redirect, router } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useWorkspaceOrNull } from "@/features/workspace/WorkspaceProvider";
import { SessionScreen } from "@/features/sessions/SessionScreen";
import { ConnectScreen, useConnectionStyles } from "@/features/connection/ConnectScreen";
import { WorkspacePicker } from "@/features/connection/WorkspacePicker";
import { useConnection } from "@/features/connection/ConnectionProvider";
import { useColors } from "@/ui/theme";
import { t } from "@/ui/i18n";
export default function Index() {
  const connection = useConnection();
  const workspace = useWorkspaceOrNull();
  const colors = useColors();
  if (connection.restoring || (connection.pairing && connection.selection !== null && !workspace))
    return <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.background }}><ActivityIndicator color={colors.content} /></View>;
  if (!connection.pairing) return <ConnectScreen />;
  if (connection.selection === null) return <WorkspacePicker />;
  return <LinkedIndex />;
}

function LinkedIndex() {
  const styles = useConnectionStyles();
  const { projects, monos } = useWorkspaceOrNull()!;
  if (projects[0])
    return (
      <Redirect
        href={{
          pathname: "/project/[projectId]",
          params: { projectId: projects[0].id },
        }}
      />
    );
  if (monos[0])
    return (
      <Redirect
        href={{ pathname: "/mono/[monoId]", params: { monoId: monos[0].id } }}
      />
    );
  return (
    <SessionScreen title={t("Workspace")}>
      <View style={[styles.screen, { justifyContent: "center", gap: 24 }]}>
        <Text style={styles.title}>{t("Make yourself at home.")}</Text>
        <Text style={styles.subtitle}>{t("Choose the projects and monos you want on your phone.")}</Text>
        <Pressable
          style={styles.primary}
          onPress={() => router.push("/settings")}
        >
          <Text style={styles.primaryLabel}>{t("Choose workspace")}</Text>
        </Pressable>
      </View>
    </SessionScreen>
  );
}
