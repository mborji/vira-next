import express from 'express';
const router = express.Router();
import { getConnection, sql } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

// Create contact submission
router.post('/', async (req, res) => {
    try {
        const pool = await getConnection();
        const { name, email, phone, subject, message, user_id } = req.body;

        const result = await pool.request()
            .input('name', sql.NVarChar, name)
            .input('email', sql.NVarChar, email)
            .input('phone', sql.NVarChar, phone)
            .input('subject', sql.NVarChar, subject)
            .input('message', sql.NText, message)
            .input('user_id', sql.UniqueIdentifier, user_id || null)
            .input('status', sql.NVarChar, 'pending')
            .input('createdAt', sql.DateTime2, new Date())
            .input('updatedAt', sql.DateTime2, new Date())
            .query(`
                INSERT INTO contact_submissions (name, email, phone, subject, message, user_id, status, created_at, updated_at)
                OUTPUT INSERTED.*
                VALUES (@name, @email, @phone, @subject, @message, @user_id, @status, @createdAt, @updatedAt)
            `);

        res.status(201).json(result.recordset[0]);
    } catch (error) {
        console.error('Error creating contact submission:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get contact submissions (admin or own submissions)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const pool = await getConnection();
        let query = 'SELECT * FROM contact_submissions';
        const request = pool.request();

        if (req.user.role === 'admin' || req.user.role === 'super_admin') {
            // Admin can see all submissions
            query += ' ORDER BY created_at DESC';
        } else {
            // Users can only see their own submissions
            query += ' WHERE user_id = @user_id ORDER BY created_at DESC';
            request.input('user_id', sql.UniqueIdentifier, req.user.id);
        }

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching contact submissions:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Update contact submission status (admin only)
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const pool = await getConnection();
        const { id } = req.params;
        const { status, admin_notes } = req.body;

        const result = await pool.request()
            .input('id', sql.UniqueIdentifier, id)
            .input('status', sql.NVarChar, status)
            .input('admin_notes', sql.NText, admin_notes)
            .query(`
                UPDATE contact_submissions
                SET status = @status, admin_notes = @admin_notes, updated_at = GETDATE()
                OUTPUT INSERTED.*
                WHERE id = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Contact submission not found' });
        }

        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error updating contact submission:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get ticket responses
router.get('/:id/responses', authenticateToken, async (req, res) => {
    try {
        const pool = await getConnection();
        const { id } = req.params;

        // Check if user can access this submission
        const submissionResult = await pool.request()
            .input('id', sql.UniqueIdentifier, id)
            .input('user_id', sql.UniqueIdentifier, req.user.id)
            .query(`
                SELECT * FROM contact_submissions
                WHERE id = @id AND (user_id = @user_id OR @user_id IN (SELECT user_id FROM profiles WHERE role = 'admin'))
            `);

        if (submissionResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Contact submission not found' });
        }

        const result = await pool.request()
            .input('submission_id', sql.UniqueIdentifier, id)
            .query('SELECT * FROM ticket_responses WHERE submission_id = @submission_id ORDER BY created_at ASC');

        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching ticket responses:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Add ticket response
router.post('/:id/responses', authenticateToken, async (req, res) => {
    try {
        const pool = await getConnection();
        const { id } = req.params;
        const { message } = req.body;

        // Check if user can access this submission
        const submissionResult = await pool.request()
            .input('id', sql.UniqueIdentifier, id)
            .input('user_id', sql.UniqueIdentifier, req.user.id)
            .query(`
                SELECT * FROM contact_submissions
                WHERE id = @id AND (user_id = @user_id OR @user_id IN (SELECT user_id FROM profiles WHERE role = 'admin'))
            `);

        if (submissionResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Contact submission not found' });
        }
        
        // Determine if response is from an admin
        const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';

        const result = await pool.request()
            .input('submission_id', sql.UniqueIdentifier, id)
            .input('message', sql.NText, message)
            .input('is_admin_response', sql.Bit, isAdmin)
            .input('createdAt', sql.DateTime2, new Date())
            .input('updatedAt', sql.DateTime2, new Date())
            .query(`
                INSERT INTO ticket_responses (submission_id, message, is_admin_response, created_at, updated_at)
                OUTPUT INSERTED.*
                VALUES (@submission_id, @message, @is_admin_response, @createdAt, @updatedAt)
            `);

        res.status(201).json(result.recordset[0]);
    } catch (error) {
        console.error('Error creating ticket response:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

export default router;
