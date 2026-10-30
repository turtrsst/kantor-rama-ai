# KRA ↔ N100N bridge

The Content Creator Studio can browse N100N workflows, start one with JSON `items`, and inspect an execution. Browser requests go to KRA's authenticated PHP API; PHP calls the local N100N REST service, so the N100N API key is never sent to the browser.

## Configure the KRA XAMPP server

KRA defaults to `http://127.0.0.1:5679`, suitable when Apache/PHP and N100N run on the same Windows host. Configure the service API key that is authorized to list workflows and start workflow runs. Do not use a webhook-only key unless N100N explicitly authorizes it for these REST routes.

Set these variables in the Apache environment (for example, the local XAMPP `httpd-vhosts.conf` or another untracked server configuration), then restart Apache:

```apache
SetEnv KRA_N100N_BASE_URL "http://127.0.0.1:5679"
SetEnv KRA_N100N_API_KEY "PUT_A_NEW_ROTATED_SERVICE_KEY_HERE"
```

`api/lib/KraN100nClient.php` also accepts these values from the PHP process environment. Never commit the real key, put it in `web/`, or place it in a browser request. The API returns only whether a key is configured, never its value.

## Content Creator controls

- **Check N100N connection** probes the authenticated `GET /api/workflows` route from PHP.
- **Load workflows** lists workflows from `GET /api/workflows`.
- **Run in N100N** sends `{ "workflow_id": <id>, "items": [...] }` to `POST /api/workflows/<id>/run`. It requires a KRA supervisor/admin session and a separate explicit confirmation because the selected workflow may have external effects.
- **Check result** queries `GET /api/executions/<id>` using the returned execution ID.

All four KRA actions (`n100n-status`, `n100n-workflows`, `n100n-run`, and `n100n-execution`) require an authenticated KRA session. Running a workflow additionally requires a supervisor/admin role, enforces a 1 MB request ceiling, and validates the workflow ID and JSON array.

## Key rotation

API keys were shared in chat while describing the current installation. Treat those values as exposed: revoke/rotate them in N100N and configure a newly issued REST service key on the KRA server. Do not send the replacement key in chat. The direct webhook key is separate and should be rotated too if it was disclosed.

## Verify from the server

1. Open Content Creator in KRA and click **Check N100N connection**.
2. Click **Load workflows** and choose the intended workflow.
3. Check the JSON input against that workflow's required item schema.
4. Start it only if its downstream effects are expected; use **Check result** to inspect the execution.

If the connection is reported offline, confirm the Node service is running, the configured REST key has the required scope, Apache inherited the environment variables after restart, and PHP cURL is enabled.
