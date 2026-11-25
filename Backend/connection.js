
const path = require('path');
require('dotenv').config({
    path: path.join(__dirname, '.env')
});

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function connect() {
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.ping();

        console.log('MySQL database connected successfully.');
    } catch (error) {
        console.error('MySQL connection failed:', error.message);
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

connect.pool = pool;

module.exports = connect;
