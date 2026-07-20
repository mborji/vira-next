import express from 'express';
import { getConnection, sql } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get ticket responses for a submission
router.get('/:submissionId/responses', authenticateToken, async (req, res) => {
  try {
    const { submissionId } = req.params;
    
    const pool = await getConnection();
    const result = await pool.request()
      .input('submissionId', sql.UniqueIdentifier, submissionId)
      .query(`
        SELECT * FROM ticket_responses 
        WHERE submission_id = @submissionId 
        ORDER BY created_at ASC
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching ticket responses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a response to a ticket
router.post('/:submissionId/responses', authenticateToken, async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { message, is_admin_response } = req.body;

    const pool = await getConnection();
    await pool.request()
      .input('id', sql.UniqueIdentifier, sql.newGuid())
      .input('submissionId', sql.UniqueIdentifier, submissionId)
      .input('message', sql.NVarChar, message)
      .input('isAdminResponse', sql.Bit, is_admin_response)
      .input('createdAt', sql.DateTime2, new Date())
      .input('updatedAt', sql.DateTime2, new Date())
      .query(`
        INSERT INTO ticket_responses (id, submission_id, message, is_admin_response, created_at, updated_at)
        VALUES (@id, @submissionId, @message, @isAdminResponse, @createdAt, @updatedAt)
      `);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding ticket response:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;