import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "rna_router",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function dbQuery(sql: string, values?: any[]): Promise<any> {
  const [rows] = await pool.execute(sql, values || []);
  return rows;
}

export { pool };
