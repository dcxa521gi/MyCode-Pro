import { describe, expect, it } from "vitest";
import config from "../../../src-tauri/tauri.conf.json";
import { RELEASE_REPOSITORY, RELEASES_URL } from "./githubReleases";
describe("fork update configuration", () => {
  it("uses the MyCode fork and permits GitHub metadata requests in packaged builds", () => {
    expect(RELEASE_REPOSITORY).toBe("dcxa521gi/MyCode");
    expect(RELEASES_URL).toBe("https://github.com/dcxa521gi/MyCode/releases");
    expect(config.app.security.csp).toContain(
      "connect-src https://api.github.com ",
    );
    expect(config.app.security.devCsp).toContain(
      "connect-src https://api.github.com ",
    );
  });
  it("does not create unsigned updater artifacts or retain an upstream endpoint", () => {
    expect(config.bundle.createUpdaterArtifacts).toBe(false);
    expect(config.plugins.updater.endpoints).toEqual([]);
  });
});
