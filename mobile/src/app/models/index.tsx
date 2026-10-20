import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { ModelList } from "@/features/models/ModelPicker";
import { t } from "@/ui/i18n";

// The models of every provider for a session, or a new one in the project,
// searched from the header.
export default function ModelsScreen() {
  const params = useLocalSearchParams<{
    projectId: string;
    sessionId?: string;
  }>();
  const [query, setQuery] = useState("");
  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: t("Find a model"),
            hideWhenScrolling: false,
            autoCapitalize: "none",
            onChangeText: (event) => setQuery(event.nativeEvent.text),
          },
        }}
      />
      <ModelList
        projectId={params.projectId}
        sessionId={params.sessionId}
        query={query}
        onOpenOptions={() =>
          router.push({ pathname: "/models/options", params })
        }
      />
    </>
  );
}
