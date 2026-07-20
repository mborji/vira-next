import express from 'express';
import { getConnection, sql } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all contact submissions (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .query(`
        SELECT * FROM contact_submissions 
        ORDER BY created_at DESC
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's own submissions
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Ensure user can only see their own submissions unless admin
    if (req.user.id !== userId && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const pool = await getConnection();
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, userId)
      .query(`
        SELECT * FROM contact_submissions 
        WHERE user_id = @userId 
        ORDER BY created_at DESC
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching user submissions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update submission (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    const pool = await getConnection();
    await pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .input('status', sql.NVarChar, status)
      .input('admin_notes', sql.NVarChar, admin_notes)
      .input('updated_at', sql.DateTime2, new Date())
      .query(`
        UPDATE contact_submissions 
        SET status = @status, admin_notes = @admin_notes, updated_at = @updated_at
        WHERE id = @id
      `);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating submission:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dashboard stats (admin only)
router.get('/stats/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pool = await getConnection();
    
    // Get published blogs count
    const blogsResult = await pool.request()
      .query('SELECT COUNT(*) as count FROM blogs WHERE published = 1');
    
    // Get services count
    const servicesResult = await pool.request()
      .query('SELECT COUNT(*) as count FROM services');
    
    // Get services count
    const projectsResult = await pool.request()
      .query('SELECT COUNT(*) as count FROM projects');
    
    // Get total users count
    const usersResult = await pool.request()
      .query('SELECT COUNT(*) as count FROM profiles');
    
    const blogsCount = blogsResult.recordset[0].count;
    const servicesCount = servicesResult.recordset[0].count;
    const projectsCount = projectsResult.recordset[0].count;
    const usersCount = usersResult.recordset[0].count;

    res.json({
      publishedBlogsCount: blogsCount,
      servicesCount: servicesCount,
      projectsCount: projectsCount,
      totalUsers: usersCount,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;