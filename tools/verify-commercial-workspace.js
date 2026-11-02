'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(root, relative));

const api = read('api/index.php');
const app = read('web/app.js');
const login = read('web/login.js');
const html = read('web/index.html');
const entitlements = read('api/lib/KraEntitlements.php');
const tenant = read('api/lib/KraTenantContext.php');
const billing = read('api/lib/KraBilling.php');
const database = read('api/lib/KraDb.php');
const integrations = read('api/lib/KraIntegrationSettings.php');
const providerConfig = read('api/ProviderConfig.php');
const projectPath = read('api/lib/KraProjectPath.php');
const vaultSync = read('api/lib/KraVaultSync.php');
const semanticMemory = read('api/lib/KraSemanticMemory.php');
const memoryCompiler = read('api/lib/KraMemoryCompiler.php');
const desktop = read('desktop/main.js');
const licenseTool = read('tools/license-issue.php');
const commercialTest = read('tools/runtime-harness/test-commercial.php');
const docs = read('docs/COMMERCIAL-AND-WORKSPACES.md');
const packageJson = JSON.parse(read('package.json'));

for (const file of [
  'api/lib/KraTenantContext.php',
  'api/lib/KraEntitlements.php',
  'api/lib/KraBilling.php',
  'api/lib/KraLicense.php',
  'api/lib/KraWorkspaces.php',
  'api/lib/KraApiKeys.php',
  'api/lib/KraMemoryCompiler.php',
  'web/commercial_workspace.css',
  'tools/license-issue.php',
  'tools/runtime-harness/test-commercial.php',
  'docs/COMMERCIAL-AND-WORKSPACES.md',
  'docs/KRA-API-KEYS.md',
]) assert.ok(exists(file), `${file} must exist`);

// The PHP catalog—not browser constants—is the price source of truth.
for (const [plan, monthly, yearly] of [
  ['pro', 9000, 100000],
  ['plus', 15000, 150000],
  ['platinum', 50000, 500000],
]) {
  assert.match(
    entitlements,
    new RegExp(`'${plan}' => \\[[\\s\\S]*?'pricesIdr' => \\['monthly' => ${monthly}, 'yearly' => ${yearly}\\]`),
    `${plan} must keep its approved IDR prices`,
  );
}
assert.match(entitlements, /'trialDays' => \$plan\['id'\] === 'pro' \? 7 : 0/, 'Only PRO gets the seven-day trial');
assert.match(entitlements, /public const GRACE_DAYS = 3;/, 'Subscription grace stays three days');
assert.match(entitlements, /public const LICENSE_GRACE_DAYS = 7;/, 'Offline-license grace stays seven days');
assert.match(entitlements, /Billing identity is the workspace owner/i, 'Entitlement resolution documents owner billing');
assert.match(entitlements, /\$ownerId = trim\(\(string\) \(\$workspace\['ownerUserId'\]/, 'Entitlements resolve from workspace owner');

// Exact SIAS admin bypass; a generic supervisor must not bypass billing.
const platformStart = tenant.indexOf('public static function isPlatformAdmin');
const platformEnd = tenant.indexOf('/** Broad operational role', platformStart);
const platformFunction = tenant.slice(platformStart, platformEnd);
for (const role of ['admin', 'administrator', 'superadmin', 'super admin']) {
  assert.ok(platformFunction.includes(`'${role}'`), `Exact platform-admin role ${role} is recognized`);
}
assert.ok(!platformFunction.includes("'supervisor'"), 'Supervisor must not be a billing bypass role');
assert.ok(!platformFunction.includes("'boss'"), 'Boss must not be a billing bypass role');
assert.match(tenant, /legacy rows[\s\S]*?legacyClaim=true/i, 'Legacy data requires an explicit claim');

// Server-side 402 gate and all commercial actions.
assert.match(api, /'code' => 'subscription_required'[\s\S]*?'catalog' => KraEntitlements::catalog\(\)[\s\S]*?\], 402\)/, 'Feature gates return HTTP 402 with catalog');
for (const action of [
  'subscription-catalog', 'subscription-status', 'subscription-checkout-request',
  'subscription-start-trial', 'subscription-cancel', 'subscription-orders',
  'subscription-admin-list', 'subscription-admin-upsert',
  'subscription-admin-order-paid', 'billing-webhook', 'license-status',
  'license-import', 'workspaces', 'workspace-update', 'workspace-members',
  'projects', 'project-default', 'provider-settings', 'memory-compile',
  'memory-notes', 'setup-status', 'api-keys', 'api-key-status',
]) assert.ok(api.includes(`'${action}'`), `${action} API action is wired`);
assert.match(api, /\$publicActions = \[[^\]]*'billing-webhook'/, 'Billing webhook is reachable only as a signed public action');
assert.match(api, /KraBilling::handleSignedWebhook\(\$rawBody, kraHeaderValue\('X-KRA-Signature'\)\)/, 'Billing webhook verifies the raw signed body');
assert.match(billing, /hash_equals\(strtolower\(\$expected\), strtolower\(\$signature\)\)/, 'Billing HMAC uses timing-safe comparison');
assert.match(billing, /external_event_id[\s\S]*?idempotent replay/, 'Billing webhook events are idempotent');
assert.match(api, /KraBilling::adminOrders\(100, 'pending'\)/, 'Platform admin receives the pending-order queue');

// Important feature gates stay at API boundaries, not merely hidden in UI.
for (const feature of [
  'creator_studio', 'creator_parallel', 'creator_discussion',
  'creator_custom_agents', 'creator_all_skills', 'youtube_connect',
  'youtube_upload', 'youtube_analytics_basic', 'telegram_notifications',
  'n100n_workflows', 'workflows_advanced', 'vault_manual',
  'vault_semantic_memory', 'kra_api_access',
]) assert.ok(api.includes(`requireCommercialFeature('${feature}'`), `${feature} is enforced server-side`);
assert.match(api, /youtube_analytics_basic[\s\S]*?\$analytics\['topVideos'\] = \[\]/, 'PRO Analytics omits PLUS per-video detail');
assert.match(api, /quota_exceeded/, 'Monthly plan quotas return a distinct quota code');

// Commercial schema and per-workspace persistence.
for (const table of [
  'kra_workspaces', 'kra_workspace_members', 'kra_projects',
  'kra_subscriptions', 'kra_billing_orders', 'kra_billing_events',
  'kra_memory_notes', 'kra_usage_events', 'kra_api_keys',
]) assert.ok(database.includes(table), `${table} migration is present`);
assert.match(database, /return self::workspaceId\(\) \. '\|' \. \$channel;/, 'JSON chat fallback is keyed by workspace');
assert.match(integrations, /canUseLegacyIntegrations/, 'Global integrations require the legacy workspace claim');
assert.match(integrations, /canReferenceProviderEnv/, 'Ordinary workspace admins cannot reference arbitrary server environment secrets');
assert.match(read('api/lib/KraLicense.php'), /hosted workspaces use only their scoped import/i, 'Hosted tenants do not inherit installation licenses');
assert.match(read('api/lib/KraWorkspaces.php'), /must not silently change the caller's active tenant context/, 'Workspace quota checks restore tenant context');
assert.match(providerConfig, /'hasProvider' =>/, 'Public provider summary exposes availability');
const providerStart = providerConfig.indexOf('public static function publicSummary');
const providerEnd = providerConfig.indexOf('public static function', providerStart + 10);
const providerSummary = providerConfig.slice(providerStart, providerEnd > providerStart ? providerEnd : undefined);
assert.ok(!providerSummary.includes("'apiKey' =>"), 'Public provider summary must not return an API key');
assert.ok(!providerSummary.includes("'apiKeyEnv' =>"), 'Public provider summary must not return environment variable names');

// Local versus hosted project containment and isolated memory.
assert.match(projectPath, /KRA Workspaces/, 'Non-legacy projects use a workspace area');
assert.match(projectPath, /In hosted mode, a project must be inside its own workspace projects area/, 'Hosted projects are contained');
assert.match(projectPath, /Resolved project path escapes its workspace projects area/, 'Resolved symlink escapes are rejected in hosted mode');
assert.match(vaultSync, /KRA Workspaces.*KraTenantContext::scopeKey\(\)/s, 'Vault writes use a workspace subfolder');
assert.match(memoryCompiler, /kra_workspace:/, 'Compiled notes stamp their workspace');
assert.match(memoryCompiler, /redacted-secret|\\[redacted\\]/, 'Compiled notes redact secrets');
assert.match(memoryCompiler, /vault_auto_compile/, 'Auto-compile is entitlement-gated');
assert.match(semanticMemory, /KRA Workspaces\/\(\[\^\/\]\+\)\//, 'Semantic scan excludes sibling workspace folders');
assert.match(semanticMemory, /kra_workspace:/, 'Semantic scan honors frontmatter workspace stamps');
assert.match(semanticMemory, /window containing the most distinct query terms/i, 'Semantic snippets anchor on relevant multi-term windows');

// Login and app carry the selected workspace on every authenticated request.
assert.match(login, /kra_tenant_session/, 'Login stores the sanitized tenant session');
assert.match(login, /kra_active_workspace/, 'Login stores the active workspace');
assert.match(app, /X-KRA-Workspace/, 'App sends the workspace header');
assert.match(app, /window\.KRA_TenantReady/, 'App publishes tenant readiness');
assert.match(app, /localStorage\.getItem\(kraProjectRootStorageKey\(\)\)/, 'Project preference is namespaced by workspace');
assert.match(app, /kra-creator-studio-agents-v2:/, 'Creator roster cache is namespaced by workspace');
assert.ok(!app.includes('kraTenantStatus'), 'Commercial UI must not reference the undefined kraTenantStatus variable');
assert.match(app, /const setup = kraSetupStatus \|\| kraTenantSession\.setup/, 'Onboarding reads the actual tenant setup state');
assert.match(app, /async function loadCreatorAnalytics\(\)/, 'YouTube Analytics frontend loader exists');
assert.match(app, /creator-analytics-refresh.*addEventListener\('click', loadCreatorAnalytics\)/s, 'Analytics refresh button is attached');

// Commercial modal and initializer are fully wired in HTML/CSS/JS.
assert.match(html, /commercial_workspace\.css/, 'Commercial workspace stylesheet is loaded');
for (const id of [
  'kra-workspace-select', 'kra-plan-badge', 'kra-commercial-modal',
  'kra-workspace-create-form', 'kra-workspace-member-form', 'kra-plan-catalog',
  'kra-license-token', 'kra-provider-form', 'kra-checkout-setup',
  'kra-memory-notes', 'kra-admin-subscriptions', 'kra-api-key-form', 'kra-api-key-list',
]) assert.ok(html.includes(`id="${id}"`), `#${id} exists`);
for (const fn of [
  'updateTenantChrome', 'renderKraPlanCatalog', 'loadKraWorkspaceMembers',
  'loadKraProjects', 'loadKraOrders', 'loadKraLicense', 'loadKraSetup',
  'loadKraMemoryNotes', 'loadKraApiKeys', 'loadKraAdminSubscriptions', 'openKraCommercialModal',
  'switchKraWorkspace', 'initKraCommercialWorkspace', 'kraMaybeOpenOnboarding',
]) assert.ok(app.includes(`function ${fn}`), `${fn} exists`);
const modeStart = app.indexOf('function initAppModeSwitcher()');
const modeEnd = app.indexOf('async function boot()', modeStart);
const modeFunction = app.slice(modeStart, modeEnd);
assert.ok(modeFunction.includes('initKraCommercialWorkspace();'), 'Commercial UI initializer is invoked exactly from mode boot');
assert.match(app, /window\.KRA_COMMERCIAL_INITIALIZED/, 'Repeated commercial initialization cannot duplicate listeners');
assert.ok(modeFunction.includes('window.KRA_SetAppMode = setMode;'), 'Tenant session can force ineligible users back to Office');
assert.match(modeFunction, /kraTenantReady && !kraCanAccessCreator\(\)/, 'Creator mode is locked in the UI as a second layer');
assert.match(modeFunction, /openKraCommercialModal\('plans'\)/, 'Locked Creator click opens plans instead of a dead end');
assert.match(app, /function kraCommercialLocked\(\)/, 'Free workspaces get a pricing-only commercial modal');
assert.match(app, /kra-commercial-section-' \+ name/, 'Free lock hides the workspace and setup sections');
assert.match(html, /id="kra-commercial-lock-note"/, 'Free lock explains that settings unlock after subscribing');
assert.match(app, /if \(kraCommercialLocked\(\)\) return;/, 'Free workspaces are not pushed into setup onboarding');

// Local-first desktop and owner-only license issuance.
assert.match(desktop, /KRA_DEPLOYMENT_MODE: process\.env\.KRA_DEPLOYMENT_MODE \|\| 'local'/, 'Electron defaults PHP to local deployment');
assert.match(desktop, /localFirst: true/, 'Desktop runtime identifies itself as local-first');
assert.match(licenseTool, /PHP_SAPI !== 'cli'/, 'License issuer is CLI-only');
assert.match(licenseTool, /KRA_LICENSE_PRIVATE_KEY/, 'License issuer reads the private key from environment');
assert.match(licenseTool, /private-key-file/, 'License issuer can read a private-key file');
assert.ok(!licenseTool.includes("--private-key="), 'License issuer does not encourage private keys in shell history');
assert.match(licenseTool, /Jangan commit, jangan kirim ke pelanggan/, 'License issuer warns that the secret stays with the owner');

// Tests and operator docs cover the same promises the UI makes.
assert.match(commercialTest, /COMMERCIAL_TENANT_TESTS=PASS/, 'Commercial runtime suite has a machine-checkable pass marker');
assert.match(commercialTest, /semantic recall cannot cross workspace vault boundaries/i, 'Commercial suite tests Vault isolation');
assert.match(commercialTest, /hosted projects cannot escape/i, 'Commercial suite tests hosted project containment');
assert.match(docs, /Rp9\.000[\s\S]*Rp100\.000/, 'Docs state PRO prices');
assert.match(docs, /Rp15\.000[\s\S]*Rp150\.000/, 'Docs state PLUS prices');
assert.match(docs, /Rp50\.000[\s\S]*Rp500\.000/, 'Docs state PLATINUM prices');
assert.match(docs, /bukan di PC pengunjung/, 'Docs explain hosted projects live on the KRA server');
assert.match(docs, /Jangan menjual akses shared-hosted/, 'Docs keep hosted sales behind a readiness checklist');
assert.equal(packageJson.scripts['verify:commercial'], 'node tools/verify-commercial-workspace.js', 'package exposes npm run verify:commercial');

console.log('Commercial workspace verification passed: exact plans/prices, server-side Creator gates, tenant-scoped data/memory/projects, local-first licensing, onboarding UI, and operator documentation are wired.');
