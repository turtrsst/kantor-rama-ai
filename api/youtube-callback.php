<?php
declare(strict_types=1);

/**
 * Clean-URL Google OAuth callback for KRA YouTube integration.
 *
 * Register this exact URL in Google Cloud Console → Authorized redirect URIs,
 * e.g. http://localhost/kantor-rama-ai/api/youtube-callback.php (XAMPP),
 * http://127.0.0.1:8088/api/youtube-callback.php (KRA desktop), or the HTTPS
 * equivalent in production. It runs the same handler as
 * api/index.php?action=youtube-oauth-callback; the dedicated path simply
 * avoids query-string ambiguity in the registered redirect URI.
 */

require_once __DIR__ . '/lib/KraIntegrationSettings.php';
require_once __DIR__ . '/lib/KraYouTubeOAuth.php';

KraYouTubeOAuth::callback();
