<?php
declare(strict_types=1);

function countActiveUsers(array $users): int
{
    $active = 0;
    foreach ($users as $user) {
        if (($user['status'] ?? '') === 'active') {
            $active++;
        }
    }
    return $active;
}
