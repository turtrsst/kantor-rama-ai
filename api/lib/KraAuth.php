<?php
declare(strict_types=1);

final class KraAuth
{
    public static function extractBearer(): ?string
    {
        $headers = [];
        if (function_exists('getallheaders')) {
            $headers = getallheaders() ?: [];
        }

        $authHeader = $_SERVER['HTTP_AUTHORIZATION']
            ?? $headers['Authorization']
            ?? $headers['authorization']
            ?? $_SERVER['HTTP_X_KRA_AUTH']
            ?? $headers['X-KRA-Auth']
            ?? null;

        if ($authHeader && preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
            return trim($matches[1]);
        }

        if (!empty($_SERVER['HTTP_X_KRA_AUTH'])) {
            return trim((string) $_SERVER['HTTP_X_KRA_AUTH']);
        }

        // Session credentials are accepted only in explicit request headers; avoid
        // cookie-based ambient auth that would make state-changing requests CSRF-prone.
        return null;
    }

    public static function authenticate(?string $customHeader = null): ?array
    {
        $credential = $customHeader !== null ? trim($customHeader) : self::extractBearer();
        if ($credential === null || $credential === '') {
            return null;
        }

        // KRA session token lookup. SIAS credentials never enter KRA database.
        $db = KraDb::connect();
        if ($db instanceof PDO) {
            $hashed = hash('sha256', $credential);
            $stmt = $db->prepare(
                'SELECT `id`, `username`, `display_name`, `role` FROM `kra_users` '
                . 'WHERE `session_hash` = :hash LIMIT 1'
            );
            $stmt->execute([':hash' => $hashed]);
            $user = $stmt->fetch();
            if ($user) {
                return [
                    'id' => (string) $user['id'],
                    'username' => (string) $user['username'],
                    'display_name' => (string) $user['display_name'],
                    'role' => (string) $user['role'],
                ];
            }
        }

        return null;
    }

    public static function requireUser(): array
    {
        $user = self::authenticate();
        if ($user === null) {
            http_response_code(401);
            echo json_encode([
                'ok' => false,
                'error' => 'Authentication required. Valid Bearer session header is missing or unrecognized.',
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
            exit;
        }
        return $user;
    }

    /** Revoke the current bearer token on the server, not only in browser storage. */
    public static function logout(): bool
    {
        $credential = self::extractBearer();
        if ($credential === null || $credential === '') return false;
        $db = KraDb::connect();
        if (!$db instanceof PDO) return false;
        $stmt = $db->prepare(
            'UPDATE `kra_users` SET `session_hash` = :replacement WHERE `session_hash` = :hash'
        );
        $stmt->execute([
            ':replacement' => hash('sha256', random_bytes(32)),
            ':hash' => hash('sha256', $credential),
        ]);
        return $stmt->rowCount() === 1;
    }

    public static function getUserRole(string $userId): string
    {
        $db = KraDb::connect();
        if ($db instanceof PDO) {
            $stmt = $db->prepare('SELECT `role` FROM `kra_users` WHERE `id` = :id LIMIT 1');
            $stmt->execute([':id' => $userId]);
            $res = $stmt->fetchColumn();
            if ($res) return (string) $res;
        }

        return 'officer';
    }

    private static function siasConnect(): ?PDO
    {
        try {
            // Separate SIAS credentials are optional; otherwise reuse the configured
            // KRA MySQL account, which must have SELECT access to the SIAS users table.
            $host = getenv('KRA_SIAS_DB_HOST') ?: (getenv('KRA_DB_HOST') ?: '127.0.0.1');
            $database = getenv('KRA_SIAS_DB') ?: 'sias';
            $dbUser = trim((string) (getenv('KRA_SIAS_DB_USER') ?: getenv('KRA_DB_USER') ?: ''));
            $dbPass = getenv('KRA_SIAS_DB_PASS');
            if ($dbPass === false) $dbPass = getenv('KRA_DB_PASS') ?: '';
            if ($dbUser === '') {
                $remote = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
                $localRequest = in_array($remote, ['127.0.0.1', '::1'], true);
                $localDevServer = PHP_SAPI === 'cli-server' && $localRequest;
                $explicitLocalOverride = getenv('KRA_ALLOW_DEFAULT_DB_ROOT') === '1' && $localRequest;
                if (!$localDevServer && !$explicitLocalOverride) return null;
                $dbUser = 'root';
            }

            return new PDO(
                'mysql:host=' . $host . ';dbname=' . $database . ';charset=utf8mb4',
                $dbUser,
                $dbPass,
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
            );
        } catch (Throwable $e) {
            return null;
        }
    }

    /** SIAS approval states that may open a KRA session; reject markers always win. */
    private static function siasAccountCanLogin(array $user): bool
    {
        $status = strtolower(trim((string) ($user['status'] ?? '')));
        $rejected = trim((string) ($user['rejected_at'] ?? '')) !== ''
            || in_array($status, ['rejected', 'ditolak', 'nonaktif', 'inactive', 'disabled'], true);
        return !$rejected && in_array($status, ['aktif', 'active', 'approved', 'disetujui'], true);
    }

    public static function login(string $username, string $password): ?array
    {
        $sias = self::siasConnect();
        $db = KraDb::connect();
        if (!$sias || !$db) return null;

        $u = trim($username);
        if ($u === '' || $password === '') return null;

        // These columns exist in the SIAS `users` schema. Password checks remain
        // server-side and password_verify intentionally rejects plaintext values.
        $stmt = $sias->prepare(
            'SELECT id, nama_lengkap, username, nip, email, password, role, status, approved_at, rejected_at '
            . 'FROM users WHERE username = :username OR email = :email OR nip = :nip LIMIT 1'
        );
        $stmt->execute([':username' => $u, ':email' => $u, ':nip' => $u]);
        $user = $stmt->fetch();
        if (!$user || !password_verify($password, (string) ($user['password'] ?? ''))) return null;
        if (!self::siasAccountCanLogin($user)) {
            $status = trim((string) ($user['status'] ?? 'belum disetujui')) ?: 'belum disetujui';
            return ['error' => 'Akun SIAS berstatus ' . $status . '. Hubungi admin SIAS.'];
        }

        $token = bin2hex(random_bytes(32));
        $id = 'sias_' . (string) $user['id'];
        $db->prepare('INSERT INTO kra_users (id, username, display_name, role, session_hash)
            VALUES (:id, :username, :display_name, :role, :session_hash)
            ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), role=VALUES(role), session_hash=VALUES(session_hash)')
           ->execute([
               ':id' => $id, ':username' => $user['username'], ':display_name' => $user['nama_lengkap'],
               ':role' => $user['role'] ?: 'user', ':session_hash' => hash('sha256', $token),
           ]);

        return ['token' => $token, 'user' => ['id' => $id, 'username' => $user['username'],
            'display_name' => $user['nama_lengkap'], 'role' => $user['role'] ?: 'user']];
    }

    public static function register(array $data): array
    {
        // ponytail: Restore KRA registration when SIAS approval accepts a password hash, never password_raw.
        return ['error' => 'Registrasi KRA sementara tidak tersedia. Gunakan registrasi SIAS resmi.'];
    }

    /** Return identity metadata only; never publish credentials or session keys. */
    public static function getOfficerDirectory(): array
    {
        $db = KraDb::connect();
        if (!$db instanceof PDO) return [];
        $stmt = $db->query('SELECT `id`, `username`, `display_name`, `role` FROM `kra_users` ORDER BY `display_name`');
        return $stmt ? $stmt->fetchAll() : [];
    }

}
