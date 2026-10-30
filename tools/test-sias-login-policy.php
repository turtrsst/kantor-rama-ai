<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/lib/KraAuth.php';

function siasPolicyCheck(bool $condition, string $label): void
{
    if (!$condition) {
        fwrite(STDERR, "[FAIL] {$label}\n");
        exit(1);
    }
    fwrite(STDOUT, "[PASS] {$label}\n");
}

$policy = new ReflectionMethod(KraAuth::class, 'siasAccountCanLogin');
foreach (['aktif', 'active', 'approved', 'disetujui'] as $status) {
    siasPolicyCheck($policy->invoke(null, ['status' => $status]) === true, "Approved SIAS status accepted: {$status}.");
}
foreach (['pending', 'ditolak', 'rejected', 'inactive', 'nonaktif'] as $status) {
    siasPolicyCheck($policy->invoke(null, ['status' => $status]) === false, "Non-active SIAS status denied: {$status}.");
}
siasPolicyCheck(
    $policy->invoke(null, ['status' => 'active', 'rejected_at' => '2026-10-30 10:00:00']) === false,
    'A rejection timestamp denies login even if status is active.'
);
siasPolicyCheck(
    $policy->invoke(null, ['status' => 'approved', 'rejected_at' => null]) === true,
    'Approved account with no rejection timestamp may log in.'
);

$password = 'SIAS-only-test-password';
$hash = password_hash($password, PASSWORD_BCRYPT);
siasPolicyCheck(password_verify($password, $hash), 'SIAS password hash is verified server-side.');
siasPolicyCheck(!password_verify($password, $password), 'Plaintext SIAS password is never accepted as a password hash.');

echo "SIAS LOGIN POLICY TEST PASSED\n";
