import express from 'express';
import { getConnection, sql } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
let workerTypeColumnInitPromise;
let activeStatusColumnInitPromise;

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

const ensureActiveStatusColumn = async () => {
  if (!activeStatusColumnInitPromise) {
    activeStatusColumnInitPromise = (async () => {
      const pool = await getConnection();
      await pool.request().query(`
        IF COL_LENGTH('profiles', 'is_active') IS NULL
        BEGIN
          ALTER TABLE profiles
          ADD is_active BIT NOT NULL CONSTRAINT DF_profiles_is_active DEFAULT 1;
        END
      `);
    })().catch((error) => {
      activeStatusColumnInitPromise = null;
      throw error;
    });
  }

  return activeStatusColumnInitPromise;
};

// Get all profiles (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await ensureWorkerTypeColumn();
    await ensureActiveStatusColumn();
    const pool = await getConnection();
    const result = await pool.request()
      .query(`
        SELECT p.*, 
               (SELECT COUNT(*) FROM contact_submissions cs WHERE cs.user_id = p.user_id) as submission_count,
               (SELECT TOP 1 created_at FROM contact_submissions cs WHERE cs.user_id = p.user_id ORDER BY created_at DESC) as last_submission
        FROM profiles p 
        ORDER BY p.created_at DESC
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update worker type (admin only)
router.put('/:id/worker-type', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await ensureWorkerTypeColumn();
    const { id } = req.params;
    const { worker_type } = req.body;

    if (!['full_time', 'part_time'].includes(worker_type)) {
      return res.status(400).json({ error: 'Invalid worker_type' });
    }

    const pool = await getConnection();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .input('workerType', sql.NVarChar, worker_type)
      .input('updatedAt', sql.DateTime2, new Date()).query(`
        UPDATE profiles
        SET worker_type = @workerType, updated_at = @updatedAt
        WHERE id = @id
      `);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating worker type:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user status (admin only)
router.put('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await ensureActiveStatusColumn();
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'Invalid is_active' });
    }

    const pool = await getConnection();
    await pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .input('isActive', sql.Bit, is_active)
      .input('updatedAt', sql.DateTime2, new Date())
      .query(`
        UPDATE profiles
        SET is_active = @isActive, updated_at = @updatedAt
        WHERE id = @id
      `);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user role (admin only)
router.put('/:id/role', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const pool = await getConnection();
    await pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .input('role', sql.NVarChar, role)
      .input('updatedAt', sql.DateTime2, new Date())
      .query(`
        UPDATE profiles 
        SET role = @role, updated_at = @updatedAt
        WHERE id = @id
      `);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;