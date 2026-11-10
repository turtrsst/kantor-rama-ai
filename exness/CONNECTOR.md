# Exness

- `custom.exness` connects Muse to Exness through its Trading API and reads one trading account.

- It authenticates with Ed25519 signed requests using an API key, a private key, an account ID and a per-account Gateway URL.

- Helpers live in `~/workspace/custom-connectors/custom.exness/bin/`. `exness-readonly.mjs` discovers the Access Point, caches only its URL, and reads account details. It has no trading endpoints.

- No Exness connection is registered in Muse. The secure API access flow declines signed-request and multi-secret schemes by name, so this connector has no stored credential. Give the credentials per run through environment variables and never store them.

## Connect

- Create an API key with Trading read access to the account in Key Management in the Exness Personal Area.

- Take the HTTPS Gateway base URL from the DNS widget in Key Management and use it as the discovery base URL.

- Set the four values in the terminal for one run only and do not save them in a file.

```text
export EXN_API_KEY=<your-api-key>
export EXN_PRIVATE_KEY="128 hex characters or PEM contents"
export EXN_ACCOUNT_ID="123456"
export EXN_DISCOVERY_BASE_URL="https://gateway.example"
```

- Prove access with a harmless read before any other work.

```text
node ~/workspace/custom-connectors/custom.exness/bin/exness-readonly.mjs --account-details
```

- Check that the reply shows the account currency, leverage, margin call level and stop out level.

## Credentials

- The helper reads the four environment variables at runtime only and never writes them to a file, a document, a log or a chat message.

- Never put a key, a private key, a secret or a signed header in this doc, a helper, a command argument, an environment variable that persists, or a log.

- Keep redirects disabled on authenticated requests. The helper refuses redirects instead of forwarding signed headers to another host.

- Keep the system clock synchronized. Signatures carry a millisecond timestamp.

- On a 401 or 403, check the request first. Confirm that the key has Trading read access, that the account ID matches the key, and that the Gateway URL came from the DNS widget for that account.

- Do not call the secure API access flow for this connector. It declines this scheme, so a reconnect request cannot fix a rejected key.

## Discover the Access Point

- Discover the Access Point on the Gateway before reading the account.

```text
node ~/workspace/custom-connectors/custom.exness/bin/exness-readonly.mjs --discover
```

- The helper calls signed GET `/v1/trading/access-point?account_id=<account-id>` on the Gateway and prints the Access Point URL.

- The helper caches only the Access Point URL in `.access-point.json` beside this doc for 24 hours and reuses it. The cache holds no credentials.

- Force a fresh discovery when the account or the Gateway changes.

```text
node ~/workspace/custom-connectors/custom.exness/bin/exness-readonly.mjs --discover --refresh
```

## Read account details

- Read the account from the Access Point, never from the Gateway.

```text
node ~/workspace/custom-connectors/custom.exness/bin/exness-readonly.mjs --account-details
```

- The command reads only. It calls signed GET `/v1/configuration/accounts/{account_id}/account` and prints the JSON reply.

- Read the currency, leverage, margin call level and stop out level from the reply and keep the account ID for later reads.

## Validate signing without a real key

- Run the self-test before the first real call. It uses only the public synthetic vector from the Exness developer portal and makes no network request.

```text
node ~/workspace/custom-connectors/custom.exness/bin/exness-readonly.mjs --self-test
```

- Expect all checks to pass, including the exact EXN-DATA and EXN-SIGN values from the portal.

## Recover from errors

- HTTP 401 with code 1000 means the API key is invalid. Check the key value and confirm it belongs to the account in Key Management.

- HTTP 401 with code 1001 means the signature is invalid. Run the self-test, check the private key format, and confirm the system clock is synchronized.

- HTTP 404 with code 2000 means the account was not found. Check the account ID and confirm the key was created for that account.

- HTTP 429 means discovery was called too often. Wait and reuse the cached Access Point URL instead of discovering again.

- A refused redirect means the host answered with a redirect. Do not follow it. Check the Gateway URL and the Access Point URL.

- After a failed or timed-out change, check the current state with a read before trying again, because the first request may have completed.

## Limits

- This connector reads only. It cannot open or close positions, place or cancel orders, deposit, or withdraw.

- Live calls are untested. No real Exness credentials have been used with this helper yet, so discovery and account details are untested against the real API.

- Discovery is rate limited. Resolve the Access Point once and reuse the cache.

- Access is per account and revocable. Sub-accounts made only for MT4 or MT5 cannot issue an API key.

- The Gateway URL is per account. Do not reuse one account Gateway URL for another account.

## Related skills

- No skill uses this connector yet. The finance agent SANDI uses it for read-only account reads once a key exists.

- Use `muse.skill_search` to find other skills and `muse.connector_search` to find other connectors.
