const bcrypt = require('bcrypt');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function createAdmin() {
    const name = "GebeyaMed Admin";
    const email = "robelalex90@gmail.com";
    const password = "robelalex"; // CHANGE THIS LATER!
    const role = "admin";

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        await pool.query(
            'INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
            [name, email, hashedPassword, role]
        );
        console.log("✅ Admin user created successfully!");
        console.log("Email: " + email);
        console.log("Password: " + password);
    } catch (err) {
        console.error("❌ Error: User might already exist.", err.message);
    } finally {
        pool.end();
    }
}

createAdmin();