// @ts-nocheck
import mysql, { Pool, RowDataPacket, ResultSetHeader, FieldPacket } from 'mysql2/promise';

let pool: Pool | null = null;

export async function getPool(): Promise<Pool> {
  if (!pool) {
    if (!process.env.MYSQL_PASSWORD) {
      throw new Error('MYSQL_PASSWORD environment variable is not set');
    }
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DB || 'HR',
      waitForConnections: true,
      connectionLimit: 20,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
  }
  return pool;
}

export async function query<T extends RowDataPacket[] = any>(sql: string, params?: any[]): Promise<T> {
  const p = await getPool();
  const [rows] = await p.execute<T>(sql, params || []);
  return rows;
}

export async function execute(sql: string, params?: any[]): Promise<ResultSetHeader> {
  const p = await getPool();
  const [result] = await p.execute<ResultSetHeader>(sql, params || []);
  return result;
}

export async function getConnection() {
  const p = await getPool();
  return p.getConnection();
}
