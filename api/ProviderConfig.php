<?php
declare(strict_types=1);

final class ProviderConfig
{
    public static function load(): array
    {
        $path = __DIR__ . '/config.json';
        if (!is_file($path)) {
            return [
                'configured' => false,
                'message' => 'No local provider configuration found. Copy config.example.json to config.json.',
                'providers' => [],
            ];
        }

        $decoded = json_decode((string) file_get_contents($path), true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Provider configuration is not valid JSON.');
        }

        $providers = [];
        foreach (($decoded['providers'] ?? []) as $name => $provider) {
            if (!is_array($provider)) {
                continue;
            }
            $envName = (string) ($provider['apiKeyEnv'] ?? '');
            $apiKey = (string) ($provider['apiKey'] ?? '');
            $providers[$name] = [
                'baseUrl' => (string) ($provider['baseUrl'] ?? ''),
                'model' => (string) ($provider['model'] ?? ''),
                'configured' => $apiKey !== '' || $envName === '' || (getenv($envName) !== false && getenv($envName) !== ''),
                'apiKey' => $apiKey,
                'apiKeyEnv' => $envName,
                'healthUrl' => (string) ($provider['healthUrl'] ?? ''),
                'modelsUrl' => (string) ($provider['modelsUrl'] ?? ''),
                'fallbackProvider' => (string) ($provider['fallbackProvider'] ?? ''),
                'availableModel' => (string) ($provider['model'] ?? ''),
            ];
        }

        return [
            'configured' => true,
            'defaultProvider' => (string) ($decoded['defaultProvider'] ?? ''),
            'providers' => $providers,
        ];
    }

    /** Public-safe provider metadata. Never serialize API keys or env variable names. */
    public static function publicSummary(): array
    {
        $config = self::load();
        $providers = [];
        foreach (($config['providers'] ?? []) as $name => $provider) {
            $providers[$name] = [
                'baseUrl' => (string) ($provider['baseUrl'] ?? ''),
                'model' => (string) ($provider['model'] ?? ''),
                'configured' => (bool) ($provider['configured'] ?? false),
                'apiKeyConfigured' => (bool) ($provider['configured'] ?? false),
                'healthUrl' => (string) ($provider['healthUrl'] ?? ''),
                'modelsUrl' => (string) ($provider['modelsUrl'] ?? ''),
                'fallbackProvider' => (string) ($provider['fallbackProvider'] ?? ''),
                'availableModel' => (string) ($provider['availableModel'] ?? ''),
            ];
        }
        return [
            'configured' => (bool) ($config['configured'] ?? false),
            'message' => (string) ($config['message'] ?? ''),
            'defaultProvider' => (string) ($config['defaultProvider'] ?? ''),
            'providers' => $providers,
        ];
    }
}
