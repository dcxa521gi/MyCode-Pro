import { router, Stack } from "expo-router";

import {
  HeaderButton,
  modalStackOptions,
  sheetScreenLayout,
} from "@/features/files/codeScreen";
import { MONOS_ENABLED } from "@/features/connection/selection";
import { useColors } from "@/ui/theme";
import { t } from "@/ui/i18n";

// Settings: a native modal with its own stack, so its pages push inside the
// sheet and the close button dismisses the lot.
export default function SettingsLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={modalStackOptions(colors)}
      screenLayout={sheetScreenLayout(colors.sheet)}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t("Settings"),
          headerLeft: () => (
            <HeaderButton
              icon="close"
              label={t("Close")}
              onPress={() => router.back()}
            />
          ),
        }}
      />
      <Stack.Screen name="appearance" options={{ title: t("Appearance") }} />
      <Stack.Screen name="providers" options={{ title: t("Providers") }} />
      <Stack.Screen name="permissions" options={{ title: t("Permissions") }} />
      {/* The provider's models title themselves. */}
      <Stack.Screen name="models" options={{ title: "" }} />
      <Stack.Screen
        name="workspace"
        options={{ title: MONOS_ENABLED ? "Projects and monos" : "Projects" }}
      />
    </Stack>
  );
}
