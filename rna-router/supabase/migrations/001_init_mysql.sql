-- RNA Router MySQL schema (self-hosted server)
-- Run: mysql -u root -p rna_router < 001_init_mysql.sql

CREATE DATABASE IF NOT EXISTS rna_router CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rna_router;

CREATE TABLE IF NOT EXISTS user_keys (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_api_key VARCHAR(255) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  key_value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_provider (user_api_key, provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_user_keys_lookup ON user_keys(user_api_key, provider);

CREATE TABLE IF NOT EXISTS gateway_logs (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  event VARCHAR(50) NOT NULL,
  model VARCHAR(255),
  from_model VARCHAR(255),
  to_model VARCHAR(255),
  status INT,
  user_key VARCHAR(255),
  usage_tokens INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_gateway_logs_model ON gateway_logs(model);
CREATE INDEX idx_gateway_logs_user ON gateway_logs(user_key);
CREATE INDEX idx_gateway_logs_time ON gateway_logs(created_at DESC);
