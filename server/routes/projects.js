import express from 'express';
import { getConnection, sql } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all projects
router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .query('SELECT * FROM projects ORDER BY created_at DESC');
    
    // Parse tags JSON for each project
    const projects = result.recordset.map(project => ({
      ...project,
      tags: project.tags ? JSON.parse(project.tags) : []
    }));
    
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project
router.get('/:id', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('id', sql.UniqueIdentifier, req.params.id)
      .query('SELECT * FROM projects WHERE id = @id');
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = {
      ...result.recordset[0],
      tags: result.recordset[0].tags ? JSON.parse(result.recordset[0].tags) : []
    };
    
    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create project (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, description, image, category, tags, client, link } = req.body;
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('title', sql.NVarChar, title)
      .input('description', sql.NText, description)
      .input('image', sql.NVarChar, image)
      .input('category', sql.NVarChar, category)
      .input('tags', sql.NText, JSON.stringify(tags || []))
      .input('client', sql.NVarChar, client)
      .input('link', sql.NVarChar, link)
      .query(`
        INSERT INTO projects (title, description, image, category, tags, client, link)
        OUTPUT INSERTED.*
        VALUES (@title, @description, @image, @category, @tags, @client, @link)
      `);
    
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, description, image, category, tags, client, link } = req.body;
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('id', sql.UniqueIdentifier, req.params.id)
      .input('title', sql.NVarChar, title)
      .input('description', sql.NText, description)
      .input('image', sql.NVarChar, image)
      .input('category', sql.NVarChar, category)
      .input('tags', sql.NText, JSON.stringify(tags || []))
      .input('client', sql.NVarChar, client)
      .input('link', sql.NVarChar, link)
      .query(`
        UPDATE projects
        SET title = @title, description = @description, image = @image, 
            category = @category, tags = @tags, client = @client, link = @link, updated_at = GETDATE()
        WHERE id = @id;
        
        SELECT * FROM projects WHERE id = @id;
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = {
      ...result.recordset[0],
      tags: result.recordset[0].tags ? JSON.parse(result.recordset[0].tags) : []
    };
    
    res.json(project);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('id', sql.UniqueIdentifier, req.params.id)
      .query('DELETE FROM projects WHERE id = @id');
    
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;
