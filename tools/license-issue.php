<?php
declare(strict_types=1);

/**
 * Owner-only KRA offline-license issuer.
 *
 * This CLI must run only on the software owner's trusted machine. It never
 * accepts a private key as a command-line value (which would leak into shell
 * history/process lists). Supply it through KRA_LICENSE_PRIVATE_KEY or
 * --private-key-file=/path/ke/file-rahasia.
 *
 * Examples (PowerShell):
 *   php tools/license-issue.php keygen
 *   $env:KRA_LICENSE_PRIVATE_KEY = '<base64-secret-key>'
 *   php tools/license-issue.php issue --plan=plus --period=yearly --username=budi
 *
 * Examples (bash):
 *   KRA_LICENSE_PRIVATE_KEY='...' php tools/license-issue.php issue \
 *     --plan=platinum --days=366 --workspace-id=ws_xxx --seats=5
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    echo "CLI only.\n";
    exit(1);
}

require_once __DIR__ . '/../api/lib/KraLicense.php';

function kraLicenseUsage(): void
{
    fwrite(STDERR, <<<'TXT'
KRA offline license issuer (owner machine only)

Usage:
  php tools/license-issue.php keygen
  php tools/license-issue.php issue --plan=pro|plus|platinum [options]

Issue options:
  --period=monthly|yearly       Default monthly (31 days; yearly = 366 days)
  --days=1..3650                Explicit validity; overrides --period
  --expires=YYYY-MM-DD          Explicit UTC expiry date; overrides days/period
  --user-id=ID                  Optional SIAS/KRA user binding
  --username=NAME               Optional username binding
  --email=EMAIL                 Optional email binding
  --workspace-id=ID             Optional workspace binding
  --seats=N                     Optional seat-limit override
  --private-key-file=PATH       Read base64/hex Ed25519 secret key from a local file

Environment alternative:
  KRA_LICENSE_PRIVATE_KEY       Base64/hex Ed25519 secret key

Without any binding option, the result is an installation license for that
local KRA installation. Keep the secret key offline; distribute only the
public key with KRA as KRA_LICENSE_PUBLIC_KEY.

TXT);
}

/** @return array<string,string|true> */
function kraLicenseOptions(array $args): array
{
    $options = [];
    foreach ($args as $arg) {
        if (!str_starts_with($arg, '--')) continue;
        $body = substr($arg, 2);
        if ($body === '') continue;
        if (str_contains($body, '=')) {
            [$key, $value] = explode('=', $body, 2);
            $options[$key] = $value;
        } else {
            $options[$body] = true;
        }
    }
    return $options;
}

function kraLicenseSecretKey(array $options): string
{
    $file = trim((string) ($options['private-key-file'] ?? ''));
    if ($file !== '') {
        if (!is_file($file)) throw new RuntimeException('File private key tidak ditemukan.');
        $secret = trim((string) file_get_contents($file));
        if ($secret !== '') return $secret;
    }
    $secret = trim((string) (getenv('KRA_LICENSE_PRIVATE_KEY') ?: ''));
    if ($secret === '') {
        throw new RuntimeException('Atur KRA_LICENSE_PRIVATE_KEY atau --private-key-file pada mesin pemilik.');
    }
    return $secret;
}

$command = strtolower(trim((string) ($argv[1] ?? '')));
$options = kraLicenseOptions(array_slice($argv, 2));

try {
    if ($command === 'keygen') {
        $pair = KraLicense::generateKeypair();
        fwrite(STDERR, "PERINGATAN: simpan SECRET KEY hanya di password manager/mesin pemilik. Jangan commit, jangan kirim ke pelanggan.\n");
        echo "KRA_LICENSE_PUBLIC_KEY=" . $pair['publicKey'] . "\n";
        echo "KRA_LICENSE_PRIVATE_KEY=" . $pair['secretKey'] . "\n";
        exit(0);
    }

    if ($command !== 'issue') {
        kraLicenseUsage();
        exit($command === '' || $command === 'help' || $command === '--help' ? 0 : 2);
    }

    $plan = strtolower(trim((string) ($options['plan'] ?? '')));
    if (!in_array($plan, ['pro', 'plus', 'platinum'], true)) {
        throw new InvalidArgumentException('--plan harus pro, plus, atau platinum.');
    }
    $period = strtolower(trim((string) ($options['period'] ?? 'monthly')));
    if (!in_array($period, ['monthly', 'yearly'], true)) {
        throw new InvalidArgumentException('--period harus monthly atau yearly.');
    }

    $now = time();
    $expiresAt = null;
    if (!empty($options['expires'])) {
        $date = trim((string) $options['expires']);
        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date, new DateTimeZone('UTC'));
        if ($parsed === false) throw new InvalidArgumentException('--expires harus berformat YYYY-MM-DD.');
        // End of the named UTC day, so a license "until 2027-01-31" includes it.
        $expiresAt = $parsed->setTime(23, 59, 59)->getTimestamp();
    } elseif (!empty($options['days'])) {
        $days = filter_var($options['days'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 3650]]);
        if ($days === false) throw new InvalidArgumentException('--days harus 1..3650.');
        $expiresAt = $now + $days * 86400;
    } else {
        $expiresAt = $now + ($period === 'yearly' ? 366 : 31) * 86400;
    }
    if ($expiresAt <= $now) throw new InvalidArgumentException('Tanggal kedaluwarsa harus di masa depan.');

    $payload = [
        'license_id' => 'KRA-LIC-' . strtoupper(bin2hex(random_bytes(6))),
        'product' => 'kantor-rama-ai',
        'plan' => $plan,
        'billing_period' => $period,
        'issued_at' => gmdate(DATE_ATOM, $now),
        'expires_at' => gmdate(DATE_ATOM, $expiresAt),
    ];
    $bindings = [
        'user-id' => 'licensee_user_id',
        'username' => 'licensee_username',
        'email' => 'licensee_email',
        'workspace-id' => 'workspace_id',
    ];
    foreach ($bindings as $option => $field) {
        $value = trim((string) ($options[$option] ?? ''));
        if ($value !== '') $payload[$field] = substr($value, 0, 240);
    }
    if (!empty($options['seats'])) {
        $seats = filter_var($options['seats'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 10000]]);
        if ($seats === false) throw new InvalidArgumentException('--seats harus 1..10000.');
        $payload['seats'] = $seats;
    }

    $secretEncoded = kraLicenseSecretKey($options);
    $token = KraLicense::sign($payload, $secretEncoded);

    // Self-check with the matching public key before the owner sends anything.
    $secretBinary = KraLicense::decodeKey($secretEncoded);
    if ($secretBinary === null) throw new RuntimeException('Private key tidak dapat dibaca.');
    $publicBinary = sodium_crypto_sign_publickey_from_secretkey($secretBinary);
    sodium_memzero($secretBinary);
    $verified = KraLicense::verify($token, $publicBinary);
    if (empty($verified['valid'])) throw new RuntimeException('Lisensi gagal diverifikasi ulang: ' . (string) ($verified['error'] ?? 'unknown'));

    fwrite(STDERR, 'Lisensi ' . $payload['license_id'] . ' · ' . strtoupper($plan) . ' · berlaku s.d. ' . $payload['expires_at'] . "\n");
    fwrite(STDERR, "Kirim hanya token di bawah ini kepada pelanggan untuk diimpor dari ⚙ Workspace & Paket → Lisensi lokal.\n");
    echo $token . "\n";
} catch (Throwable $error) {
    fwrite(STDERR, 'ERROR: ' . $error->getMessage() . "\n");
    exit(1);
}
