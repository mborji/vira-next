import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getConnection, sql } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
let workerTypeColumnInitPromise;

const ensureWorkerTypeColumn = async () => {
  if (!workerTypeColumnInitPromise) {
    workerTypeColumnInitPromise = (async () => {
      const pool = await getConnection();
      await pool.request().query(`
        IF COL_LENGTH('profiles', 'worker_type') IS NULL
        BEGIN
          ALTER TABLE profiles
          ADD worker_type NVARCHAR(20) NOT NULL CONSTRAINT DF_profiles_worker_type DEFAULT 'full_time';
          ALTER TABLE profiles
          ADD CONSTRAINT CK_profiles_worker_type CHECK (worker_type IN ('full_time', 'part_time'));
        END
      `);
    })().catch((error) => {
      workerTypeColumnInitPromise = null;
      throw error;
    });
  }

  return workerTypeColumnInitPromise;
};

// Sign up - Simplified without email verification
router.post('/signup', async (req, res) => {
  try {
    await ensureWorkerTypeColumn();
    const { email, password, fullName } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const pool = await getConnection();

    // Check if user already exists
    const existingUser = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id FROM users WHERE email = @email');

    if (existingUser.recordset.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const userResult = await pool.request()
      .input('email', sql.NVarChar, email)
      .input('password_hash', sql.NVarChar, hashedPassword)
      .query('INSERT INTO users (email, password_hash) OUTPUT INSERTED.id VALUES (@email, @password_hash)');

    const userId = userResult.recordset[0].id;

    // Create profile
    await pool.request()
      .input('user_id', sql.UniqueIdentifier, userId)
      .input('email', sql.NVarChar, email)
      .input('full_name', sql.NVarChar, fullName)
      .input('role', sql.NVarChar, 'client')
      .query('INSERT INTO profiles (user_id, email, full_name, role) VALUES (@user_id, @email, @full_name, @role)');

    // Generate JWT token immediately (no email verification needed)
    const token = jwt.sign(
      { 
        id: userId,
        email: email,
        role: 'client'
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({ 
      message: 'User created successfully',
      token: token,
      user: {
        id: userId,
        email: email,
        full_name: fullName,
        role: 'client'
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sign in
router.post('/signin', async (req, res) => {
  try {
    await ensureWorkerTypeColumn();
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const pool = await getConnection();

    // Find user with profile
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query(`
        SELECT u.id, u.email, u.password_hash, p.full_name, p.role, p.worker_type
        FROM users u
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE u.email = @email
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.recordset[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role || 'client' 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role || 'client',
        worker_type: user.worker_type || 'full_time'
      }
    });

  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    await ensureWorkerTypeColumn();
    const pool = await getConnection();

    const result = await pool.request()
      .input('user_id', sql.UniqueIdentifier, req.user.id)
      .query(`
        SELECT u.id, u.email, p.full_name, p.role, p.worker_type
        FROM users u
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE u.id = @user_id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.recordset[0];
    res.json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role || 'client',
      worker_type: user.worker_type || 'full_time'
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

// Change Password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id; 

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'رمز عبور قبلی و فعلی را وارد نمایید' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'رمز عبور باید حداقل ۶ کاراکتر باشد' });
    }

    const pool = await getConnection();

    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, userId)
      .query('SELECT password_hash FROM users WHERE id = @userId');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }

    const user = result.recordset[0];

    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'رمز عبور فعلی اشتباه است' });
    }

    const saltRounds = 10;
    const newHashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await pool.request()
      .input('userId', sql.UniqueIdentifier, userId)
      .input('newPasswordHash', sql.NVarChar, newHashedPassword)
      .query('UPDATE users SET password_hash = @newPasswordHash WHERE id = @userId');

    res.json({ message: 'رمز عبور با موفقیت تغییر کرد' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'خطا در تغییر رمز عبور' });
  }
});