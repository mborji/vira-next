import sql from 'mssql';
import 'dotenv/config';

// const sql = require('mssql');
// require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT),
  options: {
    encrypt: true, // Use this if you're on Windows Azure
    trustServerCertificate: true // Use this if you're using self-signed certificates
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let poolPromise;

export const getConnection = async () => {
  try {
    if (!poolPromise) {
      poolPromise = new sql.ConnectionPool(config).connect();
    }
    return await poolPromise;
  } catch (err) {
    console.error('Database connection failed:', err);
    throw err;
  }
};

export { sql };


// module.exports = {
//   sql,
//   getConnection
// };
