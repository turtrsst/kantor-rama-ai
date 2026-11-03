#!/usr/bin/env node
// RNA Router CLI — pengoperasian & instalasi via terminal
const { execSync } = require("child_process");
const fs = require("fs");

const cmd = process.argv[2] || "help";
const args = process.argv.slice(3);

function log(msg) { console.log("\n[RNA CLI] " + msg); }

switch (cmd) {
  case "install":
    log("Instalasi dependensi...");
    execSync("npm install", { stdio: "inherit" });
    log("Selesai.");
    break;

  case "db-setup":
    log("Jalankan SQL MySQL: mysql -u root -p < supabase/migrations/001_init_mysql.sql");
    log("Juga: mysql -u root -p < supabase/migrations/002_custom_routers.sql");
    break;

  case "build":
    log("Build produksi...");
    execSync("npm run build", { stdio: "inherit" });
    log("Build selesai di .next/");
    break;

  case "start":
    log("Memulai server (background/foreground)...");
    const bg = args.includes("--bg") || args.includes("-b");
    const cmdStr = bg
      ? "nohup bash start.sh > rna-server.log 2>&1 & echo $! > rna.pid"
      : "bash start.sh";
    if (bg) {
      execSync(cmdStr, { stdio: "inherit" });
      const pid = fs.readFileSync("rna.pid", "utf8").trim();
      log("Server berjalan background PID=" + pid);
    } else {
      execSync(cmdStr, { stdio: "inherit" });
    }
    break;

  case "stop":
    try {
      const pid = fs.readFileSync("rna.pid", "utf8").trim();
      process.kill(Number(pid), "SIGTERM");
      fs.unlinkSync("rna.pid");
      log("Server dihentikan (PID " + pid + ")");
    } catch {
      log("Tidak ada PID rna.pid — coba kill manual atau `pkill -f 'node .next/standalone'");
    }
    break;

  case "status":
    try {
      const pid = fs.readFileSync("rna.pid", "utf8").trim();
      log("Server aktif PID=" + pid);
    } catch {
      log("Server tidak berjalan (tidak ada rna.pid)");
    }
    try {
      execSync("curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/v1/models", { stdio: "inherit" });
      log("API /models merespons OK (port 3000)");
    } catch {
      log("API /models belum bisa diakses (pastikan server jalan)");
    }
    break;

  case "usage":
    log("Buka analytics: http://localhost:3000/usage");
    break;

  case "custom-router":
    if (args[0] === "add") {
      const [_, name, endpoint, key] = args;
      log("Tambahkan custom router via API (contoh):");
      console.log(`curl -X POST http://localhost:3000/api/custom-routers -H "x-api-key: rna-user-xxx" -d '{"router_name":"${name}","model_id":"${name}","endpoint":"${endpoint}","api_key":"${key}"}'`);
    } else {
      log("Usage: rna custom-router add <name> <endpoint> <api_key>");
    }
    break;

  case "help":
  default:
    console.log(`
RNA Router CLI
Perintah:
  rna install          → npm install
  rna db-setup         → reminder SQL
  rna build            → build produksi
  rna start [--bg]     → jalan server (foreground / background)
  rna stop             → hentikan server
  rna status           → cek PID + API
  rna usage            → buka /usage
  rna custom-router add <name> <url> <key>
  rna help             → ini
`);
    process.exit(cmd === "help" ? 0 : 1);
}
