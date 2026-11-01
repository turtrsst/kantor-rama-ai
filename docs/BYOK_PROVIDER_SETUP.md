# KRA Bring-Your-Own-Key (BYOK) Provider Setup

KRA's provider seam is local-first. API keys are **never** placed in browser JavaScript, markdown memory, source-controlled files, reports, or agent exports.

## 1. Create local configuration

Copy:

```text
api/config.example.json
```

to:

```text
api/config.json
```

`api/config.json` is ignored by Git.

Choose a default provider and model. This file contains provider metadata only—no secret values.

## 2. Set an environment variable for the key

In the terminal session which runs Apache/PHP, set the environment variable:

```powershell
Set-Item -Path Env:KRA_OPENAI_API_KEY -Value (Read-Host -AsSecureString)
Set-Item -Path Env:KRA_ANTHROPIC_API_KEY -Value (Read-Host -AsSecureString)
Set-Item -Path Env:KRA_GEMINI_API_KEY -Value (Read-Host -AsSecureString)
```

For persistent Windows user variables, use the Windows environment-variable UI. Restart Apache after changing persistent variables.

### Public KRA hosting

When KRA runs at a public host, provider calls originate from the PHP server—not the user's browser or workstation. `127.0.0.1` / `localhost` therefore means the KRA server. A cloud/shared PHP host usually does not have your desktop Ollama or local 9Router listening on that address. Configure a provider URL that is reachable from the KRA host (for a cloud provider, use its HTTPS API URL and keep its key in the PHP/server environment), or run the local model service on an explicitly network-reachable server and firewall it to KRA. GitHub push does not install Ollama, 9Router, or provider credentials.

## 3. Check configuration safely

Open:

```text
/api/index.php?action=providers
```

The endpoint returns the configured provider names, base URLs, models, and whether a key is available. It never returns key values.

## Step 2 boundary

The chat provider selector applies the chosen provider to Team, private agent chat, and ReAct. Before a non-loopback provider receives a message, KRA shows an **ALLOW & SEND** action; approval is remembered only for that provider in the current browser session. The request includes the current message and a short recent conversation context, so review the destination before allowing it. Local loopback providers (for example local Ollama/9Router) do not show the external-transfer action.
