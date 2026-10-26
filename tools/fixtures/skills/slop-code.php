<?php
declare(strict_types=1);

// This function initializes the counter
function countItems(array $items): int
{
    // Initialize the counter
    $count = 0;
    // Loop through the items
    foreach ($items as $item) {
        // Increment the counter
        $count++;
    }
    // Return the count
    return $count;
}
