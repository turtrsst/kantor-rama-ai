<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/KraTenantContext.php';
if (is_file(__DIR__ . '/lib/KraIntegrationSettings.php')) require_once __DIR__ . '/lib/KraIntegrationSettings.php';

final class ProviderConfig
{
    private static function workspaceOverlay(): array
    {
        if (!class_exists('KraIntegrationSettings')) return ['defaultProvider' => '', 'providers' => []];
        try { return KraIntegrationSettings::providerSettings(); } catch (Throwable) { return ['defaultProvider' => '', 'providers' => []]; }
    }

    private static function configured(array $provider): bool
    {
        $envName = (string) ($provider['apiKeyEnv'] ?? '');
        $apiKey = (string) ($provider['apiKey'] ?? '');
        return $apiKey !== '' || $envName === '' || (getenv($envName) !== false && getenv($envName) !== '');
    }

    public static function load(): array
    {
        $path = __DIR__ . '/config.json';
        $decoded = null;
        if (is_file($path)) {
            $decoded = json_decode((string) file_get_contents($path), true);
            if (!is_array($decoded)) {
                throw new RuntimeException('Provider configuration is not valid JSON.');
            }
        }

        $providers = [];
        $hideGlobalKeys = KraTenantContext::isHosted() && KraTenantContext::hasWorkspace() && !KraTenantContext::canUseLegacyIntegrations();
        foreach (($decoded['providers'] ?? []) as $name => $provider) {
            if (!is_array($provider)) continue;
            $envName = (string) ($provider['apiKeyEnv'] ?? '');
            $apiKey = (string) ($provider['apiKey'] ?? '');
            if ($hideGlobalKeys) {
                // Keep public endpoint/model templates, but the installation
                // owner's central API key must never fund another tenant.
                $apiKey = '';
                if ($envName !== '') $envName = '';
            }
            $normalized = [
                'baseUrl' => (string) ($provider['baseUrl'] ?? ''),
                'model' => (string) ($provider['model'] ?? ''),
                'apiKey' => $apiKey,
                'apiKeyEnv' => $envName,
                'healthUrl' => (string) ($provider['healthUrl'] ?? ''),
                'modelsUrl' => (string) ($provider['modelsUrl'] ?? ''),
                'fallbackProvider' => (string) ($provider['fallbackProvider'] ?? ''),
                'availableModel' => (string) ($provider['model'] ?? ''),
            ];
            $normalized['configured'] = self::configured($normalized);
            $providers[(string) $name] = $normalized;
        }

        $overlay = self::workspaceOverlay();
        foreach (($overlay['providers'] ?? []) as $name => $provider) {
            if (!is_array($provider)) continue;
            $existing = is_array($providers[$name] ?? null) ? $providers[$name] : [];
            $merged = $existing;
            foreach (['baseUrl', 'model', 'apiKey', 'apiKeyEnv', 'healthUrl', 'modelsUrl', 'fallbackProvider'] as $field) {
                if (array_key_exists($field, $provider) && (string) $provider[$field] !== '') $merged[$field] = (string) $provider[$field];
            }
            if (array_key_exists('apiKey', $provider) && (string) $provider['apiKey'] === '' && isset($provider['apiKeyEnv']) && (string) $provider['apiKeyEnv'] !== '') {
                $merged['apiKey'] = '';
            }
            $merged['availableModel'] = (string) ($merged['model'] ?? '');
            $merged['configured'] = self::configured($merged);
            $providers[(string) $name] = $merged;
        }

        $defaultProvider = (string) (($overlay['defaultProvider'] ?? '') ?: ($decoded['defaultProvider'] ?? ''));
        $hasConfig = is_array($decoded) || $providers !== [];
        return [
            'configured' => $hasConfig,
            'message' => $hasConfig ? '' : 'No provider configuration found. Copy config.example.json to config.json or save BYOK settings for this workspace.',
            'defaultProvider' => $defaultProvider,
            'providers' => $providers,
            'workspaceId' => KraTenantContext::workspaceId(),
            'byok' => KraTenantContext::hasWorkspace(),
        ];
    }

    /** Public-safe provider metadata. Never serialize API keys or env variable names. */
    public static function publicSummary(): array
    {
        $config = self::load();
        $providers = [];
        foreach (($config['providers'] ?? []) as $name => $provider) {
            $envName = (string) ($provider['apiKeyEnv'] ?? '');
            $hasApiKey = (string) ($provider['apiKey'] ?? '') !== ''
                || ($envName !== '' && getenv($envName) !== false && getenv($envName) !== '');
            $providers[$name] = [
                'baseUrl' => (string) ($provider['baseUrl'] ?? ''),
                'model' => (string) ($provider['model'] ?? ''),
                'configured' => (bool) ($provider['configured'] ?? false),
                'apiKeyConfigured' => $hasApiKey,
                'healthUrl' => (string) ($provider['healthUrl'] ?? ''),
                'modelsUrl' => (string) ($provider['modelsUrl'] ?? ''),
                'fallbackProvider' => (string) ($provider['fallbackProvider'] ?? ''),
                'availableModel' => (string) ($provider['availableModel'] ?? ''),
            ];
        }
        $hasProvider = false;
        foreach ($providers as $provider) {
            if (!empty($provider['configured']) && ((string) ($provider['baseUrl'] ?? '') !== '' || (string) ($provider['model'] ?? '') !== '')) {
                $hasProvider = true;
                break;
            }
        }
        return [
            'configured' => (bool) ($config['configured'] ?? false),
            'hasProvider' => $hasProvider,
            'message' => (string) ($config['message'] ?? ''),
            'defaultProvider' => (string) ($config['defaultProvider'] ?? ''),
            'providers' => $providers,
            'workspaceId' => (string) ($config['workspaceId'] ?? KraTenantContext::workspaceId()),
            'byok' => !empty($config['byok']),
        ];
    }
}
