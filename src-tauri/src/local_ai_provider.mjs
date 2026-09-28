// Loaded explicitly by MyCode's Pi child. No network calls during registration.
export default function registerMyCodeProviders(pi) {
  const connections = JSON.parse(process.env.MYCODE_CONNECTIONS || "[]");
  for (const c of connections) {
    pi.registerProvider(c.id, {
      baseUrl: c.baseUrl,
      api: c.api,
      apiKey: `$${c.env}`,
      models: c.models.map((id) => ({
        id,
        name: `${c.name} / ${id}`,
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 32768,
        maxTokens: 4096,
      })),
    });
  }
}
