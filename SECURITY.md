# Security & Threat Model

OpenCode plugins run within the user's host environment with full process privileges. Because OpenCode does not sandbox plugins by default, security, data privacy, and credential boundaries must be explicitly designed and verified.

This document describes the security guarantees, credential handling, and network profile of `@andyzasl/opencode-copilot`.

---

## 1. Credential & Token Boundary

### What the Plugin Reads
- **Only** the `github-copilot` OAuth access token entry in OpenCode's internal `auth.json`.
- The token is read on-demand directly from disk and discarded immediately after the HTTP request completes.
- It is never stored in persistent memory, cached to disk, or logged.

### What the Plugin Deliberately Does Not Do
- **No environment variable fallbacks (`GITHUB_TOKEN` / `GH_TOKEN`)**: Personal Access Tokens (PATs) and CI tokens frequently carry repository-wide write, workflow, or administrative scopes. This plugin will never read or transmit general-purpose environment tokens.
- **No key guessing**: Neighbouring keys in `auth.json` (such as OpenAI, Anthropic, or GitLab tokens) are never accessed.
- **No local credential retention**: If you run `opencode auth logout github-copilot` or rotate your credential, the token is revoked immediately.

---

## 2. Network Egress Profile

The plugin communicates strictly with GitHub's official infrastructure:

| Attribute | Specification |
|---|---|
| **Destination Host** | `api.github.com` (HTTPS, port 443) |
| **Endpoint** | `/copilot_internal/user` |
| **HTTP Method** | `GET` |
| **Payload** | None (headers only: `Authorization`, `Accept`, `X-GitHub-Api-Version`) |
| **Telemetry / Tracking** | Zero. No third-party endpoints, CDNs, or analytics services. |

### Network Inactivity
- **No background traffic on other providers**: Polling is completely suspended when working on non-Copilot sessions (Claude, OpenAI, Ollama, etc.).
- **Rate-limited**: Minimum 30-second interval between background requests; concurrency guard ensures only one in-flight request at any time.
- **Fail-safe timeout**: All requests enforce a 5-second timeout via `AbortSignal.timeout`.

---

## 3. Minimal Attack Surface

- **Zero Runtime Dependencies**: The package contains zero production dependencies (`dependencies` only contains `@types/node`). It relies entirely on the OpenCode host runtime.
- **Single-File Source**: The entire plugin logic resides in [`src/tui.tsx`](src/tui.tsx) (~190 lines of readable TypeScript), enabling complete line-by-line manual audit in under 2 minutes.
- **No Shell or File Execution**: The plugin registers no agent tools (`tool.execute`), executes no shell commands, modifies no files, and installs no prompt interception hooks.
- **Fail-Safe UI**: If the GitHub API fails, times out, or changes schema, the plugin degrades silently to absence rather than throwing errors or crashing the TUI.

---

## 4. Automated CI Security Scanning

Every commit and pull request is subjected to continuous automated scanning:

- **CodeQL (SAST)**: GitHub's semantic code analysis searching for injection, tainted input, and security bugs.
- **Gitleaks**: Scans git commit history for credentials and secrets.
- **Trivy**: Scans filesystem and dependency trees for CVEs and misconfigurations.
- **npm audit**: Audits dependencies for high/critical security advisories.

---

## 5. Reporting a Security Vulnerability

If you discover a security concern or potential vulnerability, please report it privately:

- Use GitHub's private vulnerability reporting feature on this repository: **Security > Report a vulnerability**.
- Or contact the maintainer directly at `andy.evil@gmail.com`.

Reports will be acknowledged within 48 hours and investigated promptly.
