CREATE TABLE IF NOT EXISTS custom_routers (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_api_key VARCHAR(255) NOT NULL,
  router_name VARCHAR(255) NOT NULL,
  model_id VARCHAR(255) NOT NULL,
  endpoint VARCHAR(500) NOT NULL,
  api_key VARCHAR(500),
  headers_json JSON,
  free_tier TINYINT(1) DEFAULT 1,
  context_window INT DEFAULT 8192,
  capabilities VARCHAR(500),
  tags VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_custom_model (user_api_key, model_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_custom_routers_user ON custom_routers(user_api_key);
CREATE INDEX idx_custom_routers_model ON custom_routers(model_id);
