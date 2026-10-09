import { formatMessage, translate } from "../../../shared/i18n";

/** Translate application diagnostics while retaining exit codes and log paths. */
export function cliErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const installation =
    /^CLI installation failed \((.+)\)\. Diagnostic log: (.+)$/s.exec(message);
  if (installation)
    return formatMessage(
      "CLI installation failed ({status}). Diagnostic log: {path}",
      {
        status: installation[1],
        path: installation[2],
      },
    );
  const outdated = /^Still on (.+) after updating\.$/.exec(message);
  if (outdated)
    return formatMessage("Still on {version} after updating.", {
      version: outdated[1],
    });
  const required = /^Installed CLI did not reach version (.+)\.$/.exec(message);
  if (required)
    return formatMessage("Installed CLI did not reach version {version}.", {
      version: required[1],
    });
  return translate(message);
}
