<?php
declare(strict_types=1);

final class KraAuth
{
    private static array $fallbackOfficers = [
        'kra_officer_rama' => [
            'id' => 'user_rama',
            'username' => 'rama',
            'display_name' => 'Rama (Executive Boss)',
            'role' => 'supervisor',
        ],
        'kra_officer_budi' => [
            'id' => 'user_budi',
            'username' => 'budi',
            'display_name' => 'Budi (Scaffolding)',
            'role' => 'officer',
        ],
        'kra_officer_maya' => [
            'id' => 'user_maya',
            'username' => 'maya',
            'display_name' => 'Maya (Refactor)',
            'role' => 'officer',
        ],
        'kra_officer_dimas' => [
            'id' => 'user_dimas',
            'username' => 'dimas',
            'display_name' => 'Dimas (Auditor)',
            'role' => 'officer',
        ],
        'kra_officer_siti' => [
            'id' => 'user_siti',
            'username' => 'siti',
            'display_name' => 'Siti (Records)',
            'role' => 'officer',
        ],
    ];

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

        if (!empty($_COOKIE['kra_auth'])) {
            return trim((string) $_COOKIE['kra_auth']);
        }

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
                . 'WHERE `session_hash` = :hash OR `session_hash` = :raw LIMIT 1'
            );
            $stmt->execute([':hash' => $hashed, ':raw' => $credential]);
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

    public static function getUserRole(string $userId): string
    {
        $db = KraDb::connect();
        if ($db instanceof PDO) {
            $stmt = $db->prepare('SELECT `role` FROM `kra_users` WHERE `id` = :id LIMIT 1');
            $stmt->execute([':id' => $userId]);
            $res = $stmt->fetchColumn();
            if ($res) return (string) $res;
        }

        foreach (self::$fallbackOfficers as $officer) {
            if ($officer['id'] === $userId) {
                return $officer['role'];
            }
        }

        return 'officer';
    }

    public static function seedDefaultOfficers(): void
    {
        $db = KraDb::connect();
        if (!$db instanceof PDO) return;

        foreach (self::$fallbackOfficers as $credential => $officer) {
            $stmt = $db->prepare(
                'INSERT INTO `kra_users` (`id`, `username`, `display_name`, `role`, `session_hash`) '
                . 'VALUES (:id, :username, :display_name, :role, :session_hash) '
                . 'ON DUPLICATE KEY UPDATE `display_name`=VALUES(`display_name`), `role`=VALUES(`role`), `session_hash`=VALUES(`session_hash`)'
            );
            $stmt->execute([
                ':id' => $officer['id'],
                ':username' => $officer['username'],
                ':display_name' => $officer['display_name'],
                ':role' => $officer['role'],
                ':session_hash' => hash('sha256', $credential),
            ]);
        }
    }

    private static function siasConnect(): ?PDO
    {
        try {
            return new PDO(
                'mysql:host=' . (getenv('KRA_DB_HOST') ?: '127.0.0.1')
                . ';dbname=' . (getenv('KRA_SIAS_DB') ?: 'sias') . ';charset=utf8mb4',
                getenv('KRA_DB_USER') ?: 'root',
                getenv('KRA_DB_PASS') ?: '',
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
            );
        } catch (Throwable $e) {
            return null;
        }
    }

    public static function login(string $username, string $password): ?array
    {
        $sias = self::siasConnect();
        $db = KraDb::connect();
        if (!$sias || !$db) return null;

        $u = trim($username);
        $stmt = $sias->prepare('SELECT id, nama_lengkap, username, password, role, status FROM users WHERE username = :u OR email = :e LIMIT 1');
        $stmt->execute([':u' => $u, ':e' => $u]);
        $user = $stmt->fetch();
        if (!$user || !password_verify($password, (string) $user['password'])) return null;
        if (!in_array((string) $user['status'], ['aktif', 'active'], true)) {
            return ['error' => 'Akun status ' . $user['status'] . '. Hubungi admin SIAS.'];
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

    public static function getOfficerDirectory(): array
    {
        return array_values(array_map(function ($officer, $credential) {
            return [
                'id' => $officer['id'],
                'username' => $officer['username'],
                'display_name' => $officer['display_name'],
                'role' => $officer['role'],
                'pairing_key' => $credential,
            ];
        }, self::$fallbackOfficers, array_keys(self::$fallbackOfficers)));
    }
}
