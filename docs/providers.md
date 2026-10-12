> MyCode 当前正式交付 Windows 安装包；其他平台能力按代码和 CI 验证范围说明，依赖环境与实机行为需分别验证。

# Provider setup

Install and sign in to at least one supported agent before using MyCode. MyCode runs the CLIs you install and reuses their existing logins.

Follow each provider’s linked installation guide for platform requirements and installation options. Use the installation and login commands below where provided.

- [Claude Code](https://claude.com/product/claude-code) - `claude auth login`
- [Codex](https://developers.openai.com/codex/cli) - `codex login`
- [Cursor CLI](https://cursor.com/cli) - `agent login`
- [Grok Build](https://docs.x.ai/build/overview) - `curl -fsSL https://x.ai/cli/install.sh | bash` then `grok login`
- [OpenCode](https://opencode.ai) - `opencode auth login`
- [Pi](https://pi.dev/) - `npm install -g @earendil-works/pi-coding-agent`
- [Hermes Agent](https://github.com/NousResearch/hermes-agent) - macOS/Linux: `curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash`; Windows PowerShell: `iex (irm https://hermes-agent.nousresearch.com/install.ps1)`; then run `hermes model`
- [Devin CLI](https://docs.devin.ai/cli) - macOS/Linux: `curl -fsSL https://cli.devin.ai/install.sh | bash` (or `brew install --cask devin-cli`); Windows PowerShell: `irm https://static.devin.ai/cli/setup.ps1 | iex`; then run `devin auth login` (MyCode reuses that login)

MyCode also includes MiniMax Code and MiMo Code with application-managed installation and custom model routing. Legacy provider records remain readable without registering removed providers.

One provider is enough. MyCode probes for each CLI at startup and disables the ones it can’t find, with a hint about how to install them, so a missing Codex doesn’t stop you from working on anything else.

Once a provider is installed and signed in, open a project folder in MyCode, choose that agent, and send a message. For sessions on another machine, install and authenticate the providers on the host as described in [remote access](remote-access.md).

To run MyCode from a checkout, see [building from source](building.md). Return to the [README](../README.md) for desktop downloads.
