import { getConnection, sql } from '../server/config/database.js';
import bcrypt from 'bcryptjs';

async function createAdminUser() {
    try {
        const pool = await getConnection();
        
        const adminEmail = 'admin@test.com';
        const adminPassword = 'admin123';
        const adminName = 'Test Admin';
        
        // Check if admin already exists
        const existingUser = await pool.request()
            .input('email', sql.NVarChar, adminEmail)
            .query('SELECT id FROM users WHERE email = @email');

        if (existingUser.recordset.length > 0) {
            console.log('Admin user already exists');
            return;
        }

        const hashedPassword = await bcrypt.hash(adminPassword, 12);

        // Create admin user in the users table.
        // The database will automatically generate the ID.
        const userResult = await pool.request()
            .input('email', sql.NVarChar, adminEmail)
            .input('password_hash', sql.NVarChar, hashedPassword)
            .query(`
                INSERT INTO users (email, password_hash)
                OUTPUT INSERTED.id
                VALUES (@email, @password_hash)
            `);
        
        const newUserId = userResult.recordset[0].id;

        // Create admin profile in the profiles table, using the new user's ID
        // The database will automatically generate the ID for the profile.
        await pool.request()
            .input('user_id', sql.UniqueIdentifier, newUserId)
            .input('full_name', sql.NVarChar, adminName)
            .input('email', sql.NVarChar, adminEmail)
            .input('role', sql.NVarChar, 'admin')
            .query(`
                INSERT INTO profiles (user_id, full_name, email, role)
                VALUES (@user_id, @full_name, @email, @role)
            `);

        console.log('Admin user created successfully!');
        console.log('Email:', adminEmail);
        console.log('Password:', adminPassword);
        
    } catch (error) {
        console.error('Error creating admin user:', error);
    }
}

createAdminUser();