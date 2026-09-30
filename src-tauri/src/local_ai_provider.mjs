// Loaded explicitly by MyCode's Pi child. No network calls during registration.
export default function registerMyCodeProviders(pi) {
  const connections = JSON.parse(process.env.MYCODE_CONNECTIONS || "[]");
  for (const c of connections) {
    pi.registerProvider(c.id, {
      baseUrl: c.baseUrl,
      api: c.api,
      headers: c.headers,
      apiKey: process.env[c.env],
      models: c.models.map((id) => ({
        id,
        name: `${c.name} / ${id}`,
        reasoning:
          !!c.metadata?.[id]?.reasoningEfforts?.length ||
          c.metadata?.[id]?.thinking === true,
        input: c.metadata?.[id]?.modalities?.filter((m) =>
          ["text", "image"].includes(m),
        ) || ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: c.metadata?.[id]?.contextWindow || 32768,
        maxTokens: c.metadata?.[id]?.maxOutput || 4096,
      })),
    });
  }
}
