# Content Creator integrations

The Creator workspace places the 3D production set beside its Studio Terminal. The roster/activity panel remains available below the workspace. At narrow widths the scene and terminal stack vertically for usability.

## YouTube channel authorization

The Settings panel can save Google OAuth client settings and authorize the channel identity. It grants the **YouTube Data API read-only** scope to identify the account/channel. It does not upload, publish, modify, or delete videos.

1. In Google Cloud Console, select/create a project and enable **YouTube Data API v3**.
2. Configure the OAuth consent screen, including test users if the app remains in Testing.
3. Create an OAuth client of type **Web application**.
4. Copy the exact callback URL shown in Creator Settings (`https://your-host/api/index.php?action=youtube-oauth-callback`) into **Authorized redirect URIs**. For local development only, `http://localhost/...` is accepted. Deployed callbacks must use HTTPS.
5. In the KRA Creator Settings form, enter the client ID, client secret, and the exact same callback URI. Save, then select **Authorize YouTube Channel** and complete Google consent.

Google client ID/secret values are submitted only to authenticated supervisor-only PHP actions. The client secret is write-only (the API never sends it back); OAuth state is random, one-time, and expires after ten minutes. OAuth tokens and channel identity are stored on the server. The UI only reports the connected channel and does not expose access or refresh tokens. PHP cURL with valid TLS certificate verification is required for server-side Google calls.

A configured Google OAuth application and Google-side consent/test-user setup are prerequisites. Do not paste client secrets, access tokens, or refresh tokens into chat, issues, browser code, or commits.

## N100N service settings

In **N100N Workflow Bridge → Configure Server**, set the URL that the **KRA PHP server** can reach (for example `http://127.0.0.1:5679` when N100N runs on that same host) and the N100N REST API key. Save and use **Check N100N connection**. Workflow listing/execution still depends on the N100N service being running and its API enabled.

The browser posts settings only to authenticated supervisor-only PHP actions. The N100N key is write-only and stays on the KRA server. Existing environment variables (`KRA_N100N_BASE_URL` / `KRA_N100N_URL`, `KRA_N100N_API_KEY` / `KRA_N100N_TOKEN`) take precedence over saved settings. YouTube environment variables (`KRA_YOUTUBE_CLIENT_ID`, `KRA_YOUTUBE_CLIENT_SECRET`, `KRA_YOUTUBE_REDIRECT_URI`) likewise take precedence.

## Private settings storage and deployment

Integration settings are written outside the application tree to a private server directory. By default the application creates a per-install directory under PHP's system temporary directory; configure **`KRA_PRIVATE_CONFIG_DIR` to a persistent directory outside the public web root** in production, and grant write access only to the PHP service account. The directory is restricted to mode `0700` and the JSON file to `0600` where supported. Ensure backups/storage for this directory are private and encrypted as appropriate. A non-persistent temporary directory can lose the settings on reboot.

Environment variables take precedence over values saved in the Settings panel. If environment-managed credentials are set, update them in the hosting control panel instead. The KRA site and all credential submissions must be served over HTTPS in production. Never commit server settings or secrets.
