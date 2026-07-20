import express from 'express';
import { getConnection, sql } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all services
router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .query('SELECT * FROM services ORDER BY created_at DESC');
    
    // Parse features JSON for each service
    const services = result.recordset.map(service => ({
      ...service,
      features: service.features ? JSON.parse(service.features) : []
    }));
    
    res.json(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// Get single service
router.get('/:id', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('id', sql.UniqueIdentifier, req.params.id)
      .query('SELECT * FROM services WHERE id = @id');
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    const service = {
      ...result.recordset[0],
      features: result.recordset[0].features ? JSON.parse(result.recordset[0].features) : []
    };
    
    res.json(service);
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({ error: 'Failed to fetch service' });
  }
});

// Create service (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, description, icon, features } = req.body;
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('title', sql.NVarChar, title)
      .input('description', sql.NText, description)
      .input('icon', sql.NVarChar, icon)
      .input('features', sql.NText, JSON.stringify(features || []))
      .query(`
        INSERT INTO services (title, description, icon, features)
        OUTPUT INSERTED.*
        VALUES (@title, @description, @icon, @features)
      `);
    
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

// Update service (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, description, icon, features } = req.body;
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('id', sql.UniqueIdentifier, req.params.id)
      .input('title', sql.NVarChar, title)
      .input('description', sql.NText, description)
      .input('icon', sql.NVarChar, icon)
      .input('features', sql.NText, JSON.stringify(features || []))
      .query(`
        UPDATE services
        SET title = @title, description = @description, icon = @icon, features = @features, updated_at = GETDATE()
        WHERE id = @id;
        
        SELECT * FROM services WHERE id = @id;
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    const service = {
      ...result.recordset[0],
      features: result.recordset[0].features ? JSON.parse(result.recordset[0].features) : []
    };
    
    res.json(service);
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

// Delete service (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('id', sql.UniqueIdentifier, req.params.id)
      .query('DELETE FROM services WHERE id = @id');
    
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

export default router;
