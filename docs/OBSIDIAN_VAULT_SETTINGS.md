# Obsidian vault settings

KRA's **Settings → Obsidian Vault Folder** control selects the folder used for KRA memory notes. The selection is stored server-side in `.temp/private-settings/obsidian-vault.php` (or in `KRA_SETTINGS_DIR` if configured); it is not kept in browser storage or Git. The repository `.htaccess` denies direct HTTP access to `.temp`.

## Selecting a vault

1. Sign in with a supervisor/admin account and open **Settings → Obsidian Vault Folder**.
2. Browse server drives/folders, use the desktop folder picker where available, or enter a path that exists on the KRA server.
3. Select the vault root and save. The selected directory must already exist and be writable by the PHP/Apache account. An existing `.obsidian` directory is detected as a helpful check; KRA does not create it.

An explicit saved selection takes precedence over `KRA_MEMORY_ROOT`. If there is no saved selection, KRA uses `KRA_MEMORY_ROOT` and then its legacy default. Save Memory/sync, recall, meeting notes, and memory reports all use `KraVaultSync::getVaultDir()`, so they share the same root. Changing the selected folder affects subsequent KRA operations; KRA does not migrate or delete notes in the previous folder.

The folder browser is supervisor-only and returns directory names only (no file contents). It lists at most 250 subdirectories per folder. Folder paths are validated on the server; selecting a path from the browser's computer does not make that path available to a remote KRA server.

If saving fails, check that the folder exists on the machine running PHP and that the Apache/PHP account can write to it. Also ensure KRA can write to `.temp/private-settings`, or set `KRA_SETTINGS_DIR` to a persistent, private, writable directory outside the public web root.
