<?php
declare(strict_types=1);

require_once __DIR__ . '/KraTenantContext.php';

/**
 * Signed offline licenses for local-first KRA installations.
 *
 * Token format: KRA1.<base64url(canonical-json)>.<base64url(ed25519-signature)>
 * Verification needs only the public key (env KRA_LICENSE_PUBLIC_KEY as
 * base64/hex raw bytes, or KRA_LICENSE_PUBLIC_KEY_FILE). The private key must
 * stay with the software owner and is used only by tools/license-issue.php.
 */
final class KraLicense
{
    public static function decodeKey(string $key): ?string
    {
        $key = trim($key);
        if ($key === '') return null;
        if (preg_match('/^[a-fA-F0-9]+$/', $key) && strlen($key) % 2 === 0) {
            $bin = hex2bin($key);
            if (is_string($bin) && $bin !== '') return $bin;
        }
        $bin = base64_decode(strtr($key, '-_', '+/'), true);
        return is_string($bin) && $bin !== '' ? $bin : null;
    }

    public static function encodeKey(string $binary): string
    {
        return base64_encode($binary);
    }

    public static function publicKey(): ?string
    {
        $env = trim((string) (getenv('KRA_LICENSE_PUBLIC_KEY') ?: ''));
        if ($env !== '') return self::decodeKey($env);
        $file = trim((string) (getenv('KRA_LICENSE_PUBLIC_KEY_FILE') ?: ''));
        if ($file !== '' && is_file($file)) return self::decodeKey((string) @file_get_contents($file));
        return null;
    }

    public static function canonicalJson(array $payload): string
    {
        $normalized = self::sortRecursive($payload);
        $json = json_encode($normalized, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        return $json;
    }

    public static function sign(array $payload, string $secretKeyEncoded): string
    {
        if (!function_exists('sodium_crypto_sign_detached')) {
            throw new RuntimeException('PHP extension sodium diperlukan untuk menerbitkan lisensi KRA.');
        }
        $secret = self::decodeKey($secretKeyEncoded);
        if ($secret === null || strlen($secret) !== SODIUM_CRYPTO_SIGN_SECRETKEYBYTES) {
            throw new InvalidArgumentException('Private key lisensi tidak valid (harus Ed25519 secret key base64/hex).');
        }
        $payload = ['version' => 1] + $payload;
        $body = self::base64UrlEncode(self::canonicalJson($payload));
        $signature = sodium_crypto_sign_detached($body, $secret);
        sodium_memzero($secret);
        return 'KRA1.' . $body . '.' . self::base64UrlEncode($signature);
    }

    public static function verify(string $token, ?string $publicKeyBinary = null): array
    {
        $token = trim($token);
        if ($token === '') return ['valid' => false, 'status' => 'missing', 'error' => 'Belum ada lisensi offline yang diimpor.'];
        if (!function_exists('sodium_crypto_sign_verify_detached')) {
            return ['valid' => false, 'status' => 'unsupported', 'error' => 'PHP extension sodium belum aktif di server KRA.'];
        }
        $public = $publicKeyBinary ?? self::publicKey();
        if ($public === null || strlen($public) !== SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES) {
            return ['valid' => false, 'status' => 'unconfigured', 'error' => 'Public key lisensi belum dikonfigurasi (KRA_LICENSE_PUBLIC_KEY).'];
        }
        $parts = explode('.', $token);
        if (count($parts) !== 3 || $parts[0] !== 'KRA1') {
            return ['valid' => false, 'status' => 'malformed', 'error' => 'Format lisensi tidak dikenal.'];
        }
        $bodyJson = self::base64UrlDecode($parts[1]);
        $signature = self::base64UrlDecode($parts[2]);
        if ($bodyJson === null || $signature === null || strlen($signature) !== SODIUM_CRYPTO_SIGN_BYTES) {
            return ['valid' => false, 'status' => 'malformed', 'error' => 'Isi atau tanda tangan lisensi rusak.'];
        }
        if (!sodium_crypto_sign_verify_detached($signature, $parts[1], $public)) {
            return ['valid' => false, 'status' => 'bad_signature', 'error' => 'Tanda tangan lisensi tidak cocok dengan public key KRA.'];
        }
        $payload = json_decode($bodyJson, true);
        if (!is_array($payload) || (int) ($payload['version'] ?? 0) !== 1) {
            return ['valid' => false, 'status' => 'malformed', 'error' => 'Payload lisensi tidak valid.'];
        }
        return ['valid' => true, 'status' => 'verified', 'payload' => $payload];
    }

    public static function storedToken(): string
    {
        // Environment/file/global tokens belong to the installation owner.
        // They may be used by a local installation or the explicitly claimed
        // legacy workspace, but never silently grant every hosted tenant the
        // owner's plan. Hosted workspaces use only their scoped import.
        $canUseInstallationToken = !KraTenantContext::hasWorkspace()
            || !KraTenantContext::isHosted()
            || KraTenantContext::canUseLegacyIntegrations();
        if ($canUseInstallationToken) {
            $env = trim((string) (getenv('KRA_LICENSE_KEY') ?: ''));
            if ($env !== '') return $env;
            $file = trim((string) (getenv('KRA_LICENSE_FILE') ?: ''));
            if ($file !== '' && is_file($file)) return trim((string) @file_get_contents($file));
        }
        if (class_exists('KraIntegrationSettings')) {
            try {
                $token = KraIntegrationSettings::licenseToken();
                if ($token !== '') return $token;
                return $canUseInstallationToken ? KraIntegrationSettings::globalLicenseToken() : '';
            } catch (Throwable) {
                return '';
            }
        }
        return '';
    }

    public static function currentPayload(): ?array
    {
        $result = self::verify(self::storedToken());
        return !empty($result['valid']) && is_array($result['payload'] ?? null) ? $result['payload'] : null;
    }

    public static function status(): array
    {
        $token = self::storedToken();
        $result = self::verify($token);
        $payload = is_array($result['payload'] ?? null) ? $result['payload'] : null;
        $publicPayload = null;
        if ($payload !== null) {
            $publicPayload = [
                'licenseId' => (string) ($payload['license_id'] ?? ''),
                'plan' => (string) ($payload['plan'] ?? ''),
                'licenseeUserId' => (string) ($payload['licensee_user_id'] ?? ''),
                'licenseeUsername' => (string) ($payload['licensee_username'] ?? ''),
                'workspaceId' => (string) ($payload['workspace_id'] ?? ''),
                'issuedAt' => $payload['issued_at'] ?? null,
                'expiresAt' => $payload['expires_at'] ?? null,
                'seats' => isset($payload['seats']) ? (int) $payload['seats'] : null,
            ];
        }
        $installationId = '';
        if (class_exists('KraIntegrationSettings')) {
            try { $installationId = KraIntegrationSettings::installationId(); } catch (Throwable) {}
        }
        return [
            'configured' => $token !== '',
            'valid' => !empty($result['valid']),
            'status' => (string) ($result['status'] ?? 'missing'),
            'message' => !empty($result['valid']) ? 'Lisensi offline terverifikasi.' : (string) ($result['error'] ?? 'Lisensi tidak valid.'),
            'publicKeyConfigured' => self::publicKey() !== null,
            'installationId' => $installationId,
            'license' => $publicPayload,
        ];
    }

    public static function import(string $token): array
    {
        $result = self::verify($token);
        if (empty($result['valid'])) throw new InvalidArgumentException((string) ($result['error'] ?? 'Lisensi tidak valid.'));
        if (!class_exists('KraIntegrationSettings')) throw new RuntimeException('Penyimpanan lisensi server tidak tersedia.');
        KraIntegrationSettings::saveLicenseToken(trim($token));
        KraTenantContext::setEntitlement(null);
        return self::status();
    }

    public static function generateKeypair(): array
    {
        if (!function_exists('sodium_crypto_sign_keypair')) throw new RuntimeException('PHP extension sodium diperlukan.');
        $pair = sodium_crypto_sign_keypair();
        $secret = sodium_crypto_sign_secretkey($pair);
        $public = sodium_crypto_sign_publickey($pair);
        $result = ['publicKey' => self::encodeKey($public), 'secretKey' => self::encodeKey($secret)];
        sodium_memzero($secret);
        sodium_memzero($pair);
        return $result;
    }

    private static function sortRecursive(array $value): array
    {
        ksort($value, SORT_STRING);
        foreach ($value as &$item) {
            if (is_array($item)) $item = self::sortRecursive($item);
        }
        unset($item);
        return $value;
    }

    private static function base64UrlEncode(string $bytes): string
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $value): ?string
    {
        $value = strtr($value, '-_', '+/');
        $padding = strlen($value) % 4;
        if ($padding > 0) $value .= str_repeat('=', 4 - $padding);
        $decoded = base64_decode($value, true);
        return is_string($decoded) ? $decoded : null;
    }
}
