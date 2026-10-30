# opencode-copilot

[![GitHub Release](https://img.shields.io/github/v/release/andyzasl/opencode-copilot?color=blue&logo=github)](https://github.com/andyzasl/opencode-copilot/releases)
[![OpenCode v2](https://img.shields.io/badge/OpenCode-v2-10b981?logo=terminal&logoColor=white)](https://opencode.ai)
[![Security & Quality](https://github.com/andyzasl/opencode-copilot/actions/workflows/security.yml/badge.svg)](https://github.com/andyzasl/opencode-copilot/actions/workflows/security.yml)
[![Dependencies](https://img.shields.io/badge/dependencies-0%20runtime-success)](package.json)
[![Security Policy](https://img.shields.io/badge/security-audited-success?logo=github)](SECURITY.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](tsconfig.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An [OpenCode](https://opencode.ai) v2 TUI plugin that shows your remaining GitHub Copilot quota and real-time chat usage directly in the sidebar **Context** block.

<p align="center">
  <img src="https://raw.githubusercontent.com/andyzasl/opencode-copilot/main/assets/screenshot.png" alt="Copilot Quota and Usage Preview" width="480" />
</p>

```
Context
9,234 tokens
45% used
$0.12 spent

Copilot                      ← this plugin
74% left (185k credits)
Chat: 2.5 credits
```

The block renders dynamically when the active session is running on a `github-copilot` model.

## Features

- **Billing Cycle Balance**: Displays remaining premium quota as both a percentage and total volume (credits or requests).
- **Per-Chat Usage Attribution**: Tracks baseline balance upon session view and shows how much was consumed during the conversation (`Chat: X credits`).
- **Plan Auto-detection**: Automatically adapts units based on Copilot's response (`credits` for token-metered plans, `requests` for discrete plans, or hides cleanly if unlimited).
- **Zero Configuration**: Reads existing Copilot credentials from OpenCode's internal store automatically.
- **Privacy & Security Focused**: Deliberately reads *only* the `github-copilot` OAuth token from OpenCode's local storage. Never falls back to general-purpose `GITHUB_TOKEN` / `GH_TOKEN` environment variables to prevent accidental credential leakage to undocumented endpoints.

## What the Numbers Mean

Copilot plans report quota differently:

| Plan reports | Unit shown | Example |
|---|---|---|
| `token_based_billing: true` | credits | `74% left (185k credits)` |
| `token_based_billing: false` | requests | `82% left (247 requests)` |
| `unlimited: true` | *hidden* | — |

The line below (`Chat: ...`) displays the change in quota observed since the current session was opened.

## Installation

### Option 1 — OpenCode CLI (Recommended)

Install the plugin directly from GitHub into your global OpenCode configuration:

```bash
opencode plugin add andyzasl/opencode-copilot
```

### Option 2 — Global Config (`opencode.json`)

Add the repository specifier to your `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [
    "andyzasl/opencode-copilot"
  ]
}
```

### Option 3 — Local or Manual Configuration (`tui.json`)

If you cloned this repository locally:

```bash
git clone git@github.com:andyzasl/opencode-copilot.git
cd opencode-copilot
npm install
```

Reference the source directly in `~/.config/opencode/tui.json` (or `.opencode/tui.json` for project-local):

```json
{
  "plugin": ["/path/to/opencode-copilot/src/tui.tsx"]
}
```

## Authentication

Authentication is completely automatic. The plugin checks the `github-copilot` OAuth access token in OpenCode's `auth.json` across standard OS storage paths:

1. `$XDG_DATA_HOME/opencode/auth.json`
2. macOS: `~/Library/Application Support/opencode/auth.json`
3. Windows: `%LOCALAPPDATA%/opencode/auth.json` and `%APPDATA%/opencode/auth.json`
4. Linux / Fallback: `~/.local/share/opencode/auth.json`

If you are not authenticated with Copilot in OpenCode, nothing is rendered.

## Security & Credential Transparency

Because OpenCode plugins run directly in the host user environment without sandboxing, this plugin is built according to community security best practices:

- 🔒 **Narrow Credential Scope**: The plugin *only* reads the `github-copilot` OAuth access token from OpenCode's internal `auth.json`. It **never** reads environment variables (`GITHUB_TOKEN` / `GH_TOKEN`), preventing broad personal access tokens or CI credentials from being sent.
- 🚫 **No Credential Persistence**: The token is read on-demand directly from disk and discarded immediately after the HTTP call. It is never cached in memory, written to files, or logged.
- 🌐 **Single Trusted Host**: The only outbound destination is `https://api.github.com/copilot_internal/user`. Zero third-party telemetry, trackers, or foreign network calls.
- 🛡️ **Zero Runtime Dependencies**: The package contains zero external dependencies. The entire codebase is a single file ([`src/tui.tsx`](src/tui.tsx), < 200 lines) easily auditable in under 2 minutes.
- ⚡ **Passive & Safe**: No agent tools registered (`tool.execute`), no shell command execution, and no prompt interception. If any network or API error occurs, the plugin degrades silently without disrupting your session.

See [SECURITY.md](SECURITY.md) for the complete threat model and security guarantees.

## Polling & Network Behavior

| Aspect | Detail |
|---|---|
| **Endpoint** | `api.github.com/copilot_internal/user` |
| **Refresh Interval** | Every 5 minutes while active, plus on `session.idle` (5 s throttle) |
| **Rate Limiting** | Minimum 30 s gap between background polls; enforces single in-flight request |
| **Timeout** | 5 seconds |
| **Idle Behavior** | Background polling starts only after a Copilot session is observed |
| **Degradation** | Fails silently without cluttering the UI with error banners |

> [!NOTE]
> `copilot_internal/user` is an internal GitHub API endpoint. If GitHub modifies or restricts this endpoint, the plugin safely hides rather than throwing unhandled exceptions.

## Development & Verification

Check types:

```bash
npm install
npm run typecheck
```

Continuous integration runs TypeScript typechecking, dependency audits (`npm audit`), secret detection (Gitleaks), CodeQL SAST analysis, and Trivy filesystem vulnerability scanning on every pull request and push to `main`.

## License

[MIT](LICENSE) © Andrei Zaslavskii
