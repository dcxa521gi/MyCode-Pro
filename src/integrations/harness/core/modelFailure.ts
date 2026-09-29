import { translate } from "../../../shared/i18n";

export function modelFailureMessage(message: string, custom: boolean): string {
  const hint =
    /insufficient.?(credits|balance)|never purchased credits|payment required/i.test(
      message,
    )
      ? "The selected provider account has insufficient credits. Check that provider’s balance or select a different model provider."
      : /not logged in|please run \/login/i.test(message)
        ? custom
          ? "The custom model was rejected by the CLI. Check the API key and the protocol supported by this agent in Settings > Providers."
          : "This CLI is not logged in. Sign in to this agent’s own account, or select a compatible model provider with an API key."
        : /authentication[_ ]?(fails|error|failed)|invalid.?api.?key|401\b/i.test(
              message,
            )
          ? "The selected account rejected authentication. Check this provider’s API key, endpoint and account permissions."
          : undefined;
  return hint ? `${translate(hint)}\n${message}` : translate(message);
}
