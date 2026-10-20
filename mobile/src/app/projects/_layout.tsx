import { router, Stack } from "expo-router";

import {
  HeaderButton,
  modalStackOptions,
  sheetScreenLayout,
} from "@/features/files/codeScreen";
import { useColors } from "@/ui/theme";
import { t } from "@/ui/i18n";

// The project picker: a native modal with its own stack and header, as
// settings is, its search in the header.
export default function ProjectsLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={modalStackOptions(colors)}
      screenLayout={sheetScreenLayout(colors.sheet)}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t("Projects"),
          headerLeft: () => (
            <HeaderButton
              icon="close"
              label={t("Close")}
              onPress={() => router.back()}
            />
          ),
        }}
      />
    </Stack>
  );
}
