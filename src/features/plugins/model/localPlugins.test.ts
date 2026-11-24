// @vitest-environment happy-dom
import { beforeEach, expect, it } from "vitest";
import {
  localPlugins,
  parseLocalPlugin,
  pluginFormValues,
  pluginToolCatalog,
  saveLocalPlugins,
} from "./localPlugins";
import {
  answerPluginForm,
  cancelSessionPluginForms,
  expirePluginForms,
  pluginOperations,
  pluginResult,
  requestPluginTool,
} from "./pluginForms";
const text = { en: "Review", "zh-CN": "审查" };
const manifest = () => ({
  schemaVersion: 1,
  id: "review-kit",
  version: "1.0.0",
  name: text,
  description: text,
  tools: [
    {
      id: "review",
      name: text,
      description: text,
      instructions: text,
      fields: [
        {
          key: "scope",
          label: text,
          type: "select",
          required: true,
          options: [{ value: "project", label: text }],
        },
        { key: "tests", label: text, type: "switch" },
      ],
    },
  ],
});
beforeEach(() => {
  localStorage.clear();
  for (const op of pluginOperations()) cancelSessionPluginForms(op.sessionId);
});
it("installs bilingual named tools while rejecting embedded code and invalid field shapes", () => {
  const plugin = parseLocalPlugin(manifest());
  saveLocalPlugins([plugin]);
  expect(pluginToolCatalog()[0]).toMatchObject({
    pluginId: "review-kit",
    toolId: "review",
    requiresUserForm: true,
  });
  expect(() => parseLocalPlugin({ ...manifest(), script: "run()" })).toThrow();
  expect(() =>
    parseLocalPlugin({ ...manifest(), name: { en: "Only English" } }),
  ).toThrow();
  expect(() =>
    pluginFormValues(plugin.tools[0], { scope: "forged" }),
  ).toThrow();
  expect(() =>
    pluginFormValues(plugin.tools[0], { scope: "project", tests: "false" }),
  ).toThrow();
  expect(() =>
    pluginFormValues(plugin.tools[0], { scope: "project", secret: "unknown" }),
  ).toThrow();
});
it("keeps user form answers isolated to the requesting conversation and deduplicates requests", () => {
  saveLocalPlugins([parseLocalPlugin(manifest())]);
  const input = {
    pluginId: "review-kit",
    toolId: "review",
    values: { scope: "project" },
  };
  const request = requestPluginTool("session-a", "request-a", input);
  expect(requestPluginTool("session-a", "request-a", input).operationId).toBe(
    request.operationId,
  );
  expect(() => pluginResult("session-b", request.operationId)).toThrow();
  answerPluginForm(request.operationId, { scope: "project", tests: true });
  expect(pluginResult("session-a", request.operationId)).toMatchObject({
    status: "completed",
    values: { scope: "project", tests: true },
  });
});
it("does not accept a form after its plugin changed or source task stopped", () => {
  saveLocalPlugins([parseLocalPlugin(manifest())]);
  const first = requestPluginTool("stopping", "request-stop", {
    pluginId: "review-kit",
    toolId: "review",
  });
  cancelSessionPluginForms("stopping");
  answerPluginForm(first.operationId, { scope: "project" });
  expect(pluginResult("stopping", first.operationId).status).toBe("cancelled");
  const second = requestPluginTool("updated", "request-update", {
    pluginId: "review-kit",
    toolId: "review",
  });
  saveLocalPlugins(localPlugins().map((p) => ({ ...p, enabled: false })));
  expect(() =>
    answerPluginForm(second.operationId, { scope: "project" }),
  ).toThrow("changed");
  expirePluginForms(Date.now() + 600_001);
  expect(pluginResult("updated", second.operationId).status).toBe("cancelled");
});
