import express from "express";
import jalaali from "jalaali-js";
import { getConnection, sql } from "../config/database.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import {
  getCurrentJalaliYear,
  getJalaliYearGregorianRange,
} from "../utils/jalali.js";

const router = express.Router();
let holidayTableInitPromise;
let workerTypeColumnInitPromise;

const ensureHolidaysTable = async () => {
  if (!holidayTableInitPromise) {
    holidayTableInitPromise = (async () => {
      const pool = await getConnection();
      await pool.request().query(`
        IF OBJECT_ID(N'holidays', N'U') IS NULL
        BEGIN
          CREATE TABLE holidays (
            id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
            holiday_date DATE NOT NULL UNIQUE,
            title NVARCHAR(255) NULL,
            created_by UNIQUEIDENTIFIER NULL,
            created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
            updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
            FOREIGN KEY (created_by) REFERENCES users(id)
          );
          CREATE INDEX IX_holidays_holiday_date ON holidays(holiday_date);
        END
      `);
    })().catch((error) => {
      holidayTableInitPromise = null;
      throw error;
    });
  }

  return holidayTableInitPromise;
};

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

// Get all workers
router.get("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await ensureWorkerTypeColumn();
    const pool = await getConnection();
    const result = await pool.request().query(`
        SELECT p.id, p.user_id, p.full_name, p.worker_type, u.email
        FROM profiles p
        INNER JOIN users u ON p.user_id = u.id
        WHERE p.role = 'worker' or p.role = 'admin'
        ORDER BY p.full_name
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching workers:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get time logs
router.get("/time-logs", authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, workerId } = req.query;

    const pool = await getConnection();

    let query = `SELECT tl.id, 
    tl.worker_id,
    tl.date, 
    tl.description, 
    tl.created_at,
    tl.updated_at, 
    tl.hours_worked, 
    tl.start_time, 
    tl.end_time, 
    tl.start_time_2, 
    tl.end_time_2, 
    p.full_name as worker_name, 
    SUBSTRING(tl.hours_worked , 1, 5) AS hours_worked_str
    FROM time_logs tl
    INNER JOIN profiles p ON tl.worker_id = p.user_id
    WHERE 1=1`;

    const request = pool.request();

    if (startDate) {
      query += " AND tl.date >= @startDate";
      request.input("startDate", sql.Date, startDate);
    }

    if (endDate) {
      query += " AND tl.date <= @endDate";
      request.input("endDate", sql.Date, endDate);
    }

    if (workerId) {
      query += " AND tl.worker_id = @workerId";
      request.input("workerId", sql.UniqueIdentifier, workerId);
    }

    query += " ORDER BY tl.date DESC";

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching time logs:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create or update time log
router.post("/time-logs", authenticateToken, async (req, res) => {
  try {
    const { worker_id, date, start_time, end_time, hours_worked, description, start_time_2, end_time_2 } =
      req.body;

    // Check if user is admin or the worker themselves
    const isAdmin = req.user.role === "admin" || req.user.role === "worker";
    const isOwnLog = req.user.userId === worker_id;

    if (!isAdmin && !isOwnLog) {
      return res.status(403).json({ error: "Access denied" });
    }

    const pool = await getConnection();

    // Check if log exists for this date
    const existingResult = await pool
      .request()
      .input("workerId", sql.UniqueIdentifier, worker_id)
      .input("date", sql.Date, new Date(date))
      .query(
        "SELECT id FROM time_logs WHERE worker_id = @workerId AND date = @date"
      );

    if (existingResult.recordset.length > 0) {
      // Update existing log
      await pool
        .request()
        .input("id", sql.UniqueIdentifier, existingResult.recordset[0].id)
        .input("startTime", sql.VarChar, start_time)
        .input("endTime", sql.VarChar, end_time)
        .input("hoursWorked", sql.VarChar, hours_worked)
        .input("description", sql.NVarChar, description)
        .input("startTime2", sql.NVarChar, start_time_2 || null) 
        .input("endTime2", sql.NVarChar, end_time_2 || null)
        .input("updatedAt", sql.DateTime2, new Date()).query(`
          UPDATE time_logs 
          SET start_time = @startTime, end_time = @endTime, hours_worked = @hoursWorked, description = @description, start_time_2 = @startTime2, end_time_2 = @endTime2, updated_at = @updatedAt
          WHERE id = @id
        `);
    } else {
      // Create new log
      const result = await pool
        .request()
        .input("workerId", sql.UniqueIdentifier, worker_id)
        .input("date", sql.Date, date)
        .input("startTime", sql.VarChar, start_time)
        .input("endTime", sql.VarChar, end_time)
        .input("hoursWorked", sql.VarChar, hours_worked)
        .input("description", sql.NVarChar, description)
        .input("startTime2", sql.NVarChar, start_time_2 || null) 
        .input("endTime2", sql.NVarChar, end_time_2 || null)
        .input("createdAt", sql.DateTime2, new Date())
        .input("updatedAt", sql.DateTime2, new Date()).query(`
          INSERT INTO time_logs (worker_id, date, start_time, end_time, hours_worked, description, start_time_2, end_time_2, created_at, updated_at)
          VALUES (@workerId, @date, @startTime, @endTime, @hoursWorked, @description, @startTime2, @endTime2, @createdAt, @updatedAt)
        `);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving time log:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update time log (admin only)
router.put(
  "/time-logs/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { start_time, end_time, start_time_2, end_time_2, hours_worked, description } = req.body;

      const pool = await getConnection();
      await pool
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .input("startTime", sql.VarChar, start_time)
        .input("endTime", sql.VarChar, end_time)
        .input("hoursWorked", sql.VarChar, hours_worked)
        .input("description", sql.NVarChar, description)
        .input("startTime2", sql.NVarChar, start_time_2 || null) 
        .input("endTime2", sql.NVarChar, end_time_2 || null)
        .input("updatedAt", sql.DateTime2, new Date()).query(`
        UPDATE time_logs 
        SET start_time = @startTime, end_time = @endTime, hours_worked = @hoursWorked, description = @description, start_time_2 = @startTime2, end_time_2 = @endTime2, updated_at = @updatedAt
        WHERE id = @id
      `);

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating time log:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Delete time log (admin and worker can delete their own)
router.delete("/time-logs/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getConnection();

    // Check if user owns this time log or is admin
    const checkResult = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query("SELECT worker_id FROM time_logs WHERE id = @id");

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ error: "Time log not found" });
    }

    const isOwner = checkResult.recordset[0].worker_id === req.user.userId;
    const isAdmin = req.user.role === "admin" || req.user.role === "worker";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query("DELETE FROM time_logs WHERE id = @id");

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting time log:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get day off requests
router.get("/day-off-requests", authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, workerId } = req.query;

    const pool = await getConnection();
    let query = `
      SELECT dor.*, p.full_name as worker_name
      FROM day_off_requests dor
      INNER JOIN profiles p ON dor.worker_id = p.user_id
      WHERE 1=1
    `;

    const request = pool.request();

    if (startDate) {
      query += " AND dor.request_date >= @startDate";
      request.input("startDate", sql.Date, startDate);
    }

    if (endDate) {
      query += " AND dor.request_date <= @endDate";
      request.input("endDate", sql.Date, endDate);
    }

    if (workerId) {
      query += " AND dor.worker_id = @workerId";
      request.input("workerId", sql.UniqueIdentifier, workerId);
    }

    query += " ORDER BY dor.created_at DESC";

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching day off requests:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get remaining approved day off requests for a year
router.get(
  "/day-off-requests/remaining",
  authenticateToken,
  async (req, res) => {
    try {
      const limitPerYear = 26;
      const { workerId, year } = req.query;

      const targetWorkerId = (workerId || req.user.userId) + "";
      const targetYear =
        year !== undefined && year !== null && year !== ""
          ? Number(year)
          : getCurrentJalaliYear();

      if (!Number.isFinite(targetYear) || targetYear < 1200 || targetYear > 1600) {
        return res.status(400).json({ error: "Invalid year" });
      }

      const { startDate, endDate } = getJalaliYearGregorianRange(targetYear);

      const isAdmin =
        req.user.role === "admin" ||
        req.user.role === "super_admin" ||
        req.user.role === "worker";
      const isOwn = req.user.userId === targetWorkerId;

      if (!isAdmin && !isOwn) {
        return res.status(403).json({ error: "Access denied" });
      }

      const pool = await getConnection();
      const result = await pool
        .request()
        .input("workerId", sql.UniqueIdentifier, targetWorkerId)
        .input("startDate", sql.Date, startDate)
        .input("endDate", sql.Date, endDate).query(`
          SELECT COUNT(1) AS approved_count
          FROM day_off_requests
          WHERE worker_id = @workerId
            AND status = 'approved'
            AND request_date >= @startDate
            AND request_date <= @endDate
        `);

      const approvedCount = Number(result.recordset?.[0]?.approved_count || 0);
      const remaining = Math.max(0, limitPerYear - approvedCount);

      res.json({
        workerId: targetWorkerId,
        year: targetYear,
        limit: limitPerYear,
        approvedCount,
        remaining,
      });
    } catch (error) {
      console.error("Error fetching day off remaining:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Create day off request
router.post("/day-off-requests", authenticateToken, async (req, res) => {
  try {
    const { worker_id, request_date, reason } = req.body;

    // Check if user is admin or the worker themselves
    const isAdmin = req.user.role === "admin" || req.user.role === "worker";
    const isOwnRequest = req.user.userId === worker_id;

    if (!isAdmin && !isOwnRequest) {
      return res.status(403).json({ error: "Access denied" });
    }

    const pool = await getConnection();
    await pool
      .request()
      .input("workerId", sql.UniqueIdentifier, worker_id)
      .input("requestDate", sql.Date, request_date)
      .input("reason", sql.NVarChar, reason)
      .input("status", sql.NVarChar, "pending")
      .input("createdAt", sql.DateTime2, new Date())
      .input("updatedAt", sql.DateTime2, new Date()).query(`
        INSERT INTO day_off_requests (worker_id, request_date, reason, status, created_at, updated_at)
        VALUES (@workerId, @requestDate, @reason, @status, @createdAt, @updatedAt)
      `);

    res.json({ success: true });
  } catch (error) {
    console.error("Error creating day off request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update day off request status (admin only)
router.put(
  "/day-off-requests/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status, admin_notes } = req.body;

      const pool = await getConnection();

      if (status === "approved") {
        const limitPerYear = 26;


        const requestInfo = await pool
          .request()
          .input("id", sql.UniqueIdentifier, id)
          .query(
            "SELECT worker_id, request_date, status FROM day_off_requests WHERE id = @id"
          );

        if (requestInfo.recordset.length === 0) {
          return res.status(404).json({ error: "Day off request not found" });
        }

        const { worker_id: workerId, request_date: requestDate, status: currentStatus } =
          requestInfo.recordset[0];

        if (currentStatus !== "approved") {
          const jalaliYear = jalaali.toJalaali(new Date(requestDate)).jy;
          const { startDate, endDate } =
            getJalaliYearGregorianRange(jalaliYear);

          const countResult = await pool
            .request()
            .input("workerId", sql.UniqueIdentifier, workerId)
            .input("startDate", sql.Date, startDate)
            .input("endDate", sql.Date, endDate).query(`
              SELECT COUNT(1) AS approved_count
              FROM day_off_requests
              WHERE worker_id = @workerId
                AND status = 'approved'
                AND request_date >= @startDate
                AND request_date <= @endDate
            `);

          const approvedCount = Number(
            countResult.recordset?.[0]?.approved_count || 0
          );

          if (approvedCount >= limitPerYear) {
            return res.status(400).json({
              error: `Approved day off requests limit reached for Jalali year ${jalaliYear} (max ${limitPerYear})`,
            });
          }
        }
      }

      await pool
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .input("status", sql.NVarChar, status)
        .input("adminNotes", sql.NVarChar, admin_notes)
        .input("reviewedAt", sql.DateTime2, new Date())
        .input("updatedAt", sql.DateTime2, new Date()).query(`
        UPDATE day_off_requests 
        SET status = @status, admin_notes = @adminNotes, reviewed_at = @reviewedAt, updated_at = @updatedAt
        WHERE id = @id
      `);

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating day off request:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Delete day off request (admin and worker can delete their own)
router.delete("/day-off-requests/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getConnection();

    // Check if user owns this request or is admin
    const checkResult = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query("SELECT worker_id FROM day_off_requests WHERE id = @id");

    if (checkResult.recordset.lenFgth === 0) {
      return res.status(404).json({ error: "Day off request not found" });
    }

    const isOwner = checkResult.recordset[0].worker_id === req.user.userId;
    const isAdmin = req.user.role === "admin" || req.user.role === "worker";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query("DELETE FROM day_off_requests WHERE id = @id");

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting day off request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get holidays
router.get("/holidays", authenticateToken, async (req, res) => {
  try {
    await ensureHolidaysTable();
    const { startDate, endDate, year } = req.query;
    const pool = await getConnection();
    let query = `
      SELECT id, holiday_date, title, created_by, created_at, updated_at
      FROM holidays
      WHERE 1=1
    `;
    const request = pool.request();

    if (startDate) {
      query += " AND holiday_date >= @startDate";
      request.input("startDate", sql.Date, startDate);
    }

    if (endDate) {
      query += " AND holiday_date <= @endDate";
      request.input("endDate", sql.Date, endDate);
    }

    if (year) {
      const targetYear = Number(year);
      if (!Number.isFinite(targetYear) || targetYear < 1970 || targetYear > 3000) {
        return res.status(400).json({ error: "Invalid year" });
      }
      query += " AND YEAR(holiday_date) = @year";
      request.input("year", sql.Int, targetYear);
    }

    query += " ORDER BY holiday_date DESC";
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching holidays:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create holiday (admin only)
router.post("/holidays", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await ensureHolidaysTable();
    const { holiday_date, title } = req.body;

    if (!holiday_date) {
      return res.status(400).json({ error: "holiday_date is required" });
    }

    const pool = await getConnection();
    const existing = await pool
      .request()
      .input("holidayDate", sql.Date, holiday_date)
      .query("SELECT id FROM holidays WHERE holiday_date = @holidayDate");

    if (existing.recordset.length > 0) {
      return res.status(400).json({ error: "Holiday already exists for this date" });
    }

    const result = await pool
      .request()
      .input("holidayDate", sql.Date, holiday_date)
      .input("title", sql.NVarChar, title || null)
      .input("createdBy", sql.UniqueIdentifier, req.user.userId)
      .input("createdAt", sql.DateTime2, new Date())
      .input("updatedAt", sql.DateTime2, new Date()).query(`
        INSERT INTO holidays (holiday_date, title, created_by, created_at, updated_at)
        OUTPUT INSERTED.id, INSERTED.holiday_date, INSERTED.title, INSERTED.created_by, INSERTED.created_at, INSERTED.updated_at
        VALUES (@holidayDate, @title, @createdBy, @createdAt, @updatedAt)
      `);

    res.json({ success: true, holiday: result.recordset[0] });
  } catch (error) {
    console.error("Error creating holiday:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update holiday (admin only)
router.put("/holidays/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await ensureHolidaysTable();
    const { id } = req.params;
    const { title, holiday_date } = req.body;
    const pool = await getConnection();

    if (holiday_date) {
      const duplicateCheck = await pool
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .input("holidayDate", sql.Date, holiday_date).query(`
          SELECT id
          FROM holidays
          WHERE holiday_date = @holidayDate AND id <> @id
        `);

      if (duplicateCheck.recordset.length > 0) {
        return res
          .status(400)
          .json({ error: "Holiday already exists for this date" });
      }
    }

    const result = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .input("title", sql.NVarChar, title || null)
      .input("holidayDate", sql.Date, holiday_date || null)
      .input("updatedAt", sql.DateTime2, new Date()).query(`
        UPDATE holidays
        SET title = @title,
            holiday_date = COALESCE(@holidayDate, holiday_date),
            updated_at = @updatedAt
        WHERE id = @id
      `);

    if (!result.rowsAffected || result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Holiday not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating holiday:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete holiday (admin only)
router.delete("/holidays/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await ensureHolidaysTable();
    const { id } = req.params;
    const pool = await getConnection();
    const result = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query("DELETE FROM holidays WHERE id = @id");

    if (!result.rowsAffected || result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Holiday not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting holiday:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
