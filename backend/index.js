// SECTION 1: IMPORTS AND SETUP
// ==========================================================
import express from 'express';
import sqlite3 from 'sqlite3';
import axios from 'axios';
import cors from 'cors';

const app = express();
const PORT = 3001;
const PYTHON_API_BASE_URL = 'http://127.0.0.1:8000';
const RETRAIN_TRIGGER_COUNT = 20; // Retrain ML models after this many tasks are logged.

// SECTION 2: MIDDLEWARE
// ==========================================================
app.use(cors()); // Allow requests from our React frontend
app.use(express.json()); // Allow the server to understand JSON request bodies

// SECTION 3: DATABASE INITIALIZATION
// ==========================================================
const db = new sqlite3.Database('./time_buddy_storage.db', (err) => {
  if (err) {
    console.error("Error opening database", err.message);
  } else {
    console.log("Connected to the SQLite database.");
    // Use serialize to ensure tables are created in order.
    db.serialize(() => {
      // Table 1: Stores the full schedule object for a given day to persist state on refresh.
      db.run(`CREATE TABLE IF NOT EXISTS DailySchedules (
        date TEXT PRIMARY KEY,
        schedule_data TEXT NOT NULL
      )`);

      // Table 2: Stores the summary stats for the productivity calendar.
      db.run(`CREATE TABLE IF NOT EXISTS DailyProductivityStats (
        date TEXT PRIMARY KEY,
        total_blocks_scheduled INTEGER NOT NULL,
        blocks_completed INTEGER NOT NULL
      )`);
      
      // Table 3: Stores the user's completed task history for ML model training.
      db.run(`CREATE TABLE IF NOT EXISTS UserTaskHistory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_name TEXT NOT NULL,
        priority TEXT NOT NULL,
        actual_duration_minutes INTEGER NOT NULL
      )`);
    });
  }
});

// SECTION 4: API ENDPOINTS
// ==========================================================

// --- Root Endpoint for Server Health Check ---
app.get('/api', (req, res) => res.status(200).send("Time Buddy Node.js API is running."));

// --- 1. SCHEDULE GENERATION AND STATE MANAGEMENT ---

// GET /api/schedules/today - Fetches today's saved schedule to fix the refresh bug.
app.get('/api/schedules/today', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const sql = `SELECT schedule_data FROM DailySchedules WHERE date = ?`;
    
    db.get(sql, [today], (err, row) => {
        if (err) return res.status(500).json({ message: "Database error fetching today's schedule." });
        res.status(200).json({ schedule: row ? JSON.parse(row.schedule_data) : null });
    });
});

// POST /api/schedules - Generates a new schedule, replacing any existing one for today.
app.post('/api/schedules', async (req, res) => {
  try {
    const pythonResponse = await axios.post(`${PYTHON_API_BASE_URL}/create-schedule`, req.body);
    const schedule = pythonResponse.data;
    const today = new Date().toISOString().split('T')[0];

    // Enhance the schedule with state (unique IDs and completion status) before saving.
    const scheduleWithState = {
        ...schedule,
        timeline: schedule.timeline.map((item, index) => ({ ...item, id: index, completed: false }))
    };
    const scheduleJSON = JSON.stringify(scheduleWithState);
    const totalBlocks = schedule.timeline.filter(item => item.item_id !== 'BREAK').length;

    // Use a database transaction to ensure both tables are updated together.
    db.serialize(() => {
        db.run('BEGIN TRANSACTION;');
        const statsSql = `INSERT INTO DailyProductivityStats (date, total_blocks_scheduled, blocks_completed) VALUES (?, ?, 0) ON CONFLICT(date) DO UPDATE SET total_blocks_scheduled = excluded.total_blocks_scheduled, blocks_completed = 0`;
        db.run(statsSql, [today, totalBlocks]);

        const scheduleSql = `INSERT INTO DailySchedules (date, schedule_data) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET schedule_data = excluded.schedule_data`;
        db.run(scheduleSql, [today, scheduleJSON]);
        
        db.run('COMMIT;', (err) => {
            if (err) return res.status(500).json({ message: "Failed to commit schedule to database." });
            res.status(201).json(scheduleWithState);
        });
    });
  } catch (error) {
    console.error("Error communicating with Python API:", error.message);
    res.status(500).json({ message: 'Error generating schedule via AI service.' });
  }
});

// PATCH /api/schedules/today/blocks/:blockId - Updates the completion status of a single block.
app.patch('/api/schedules/today/blocks/:blockId', (req, res) => {
    const { blockId } = req.params;
    const { completed } = req.body;
    const today = new Date().toISOString().split('T')[0];

    db.get(`SELECT schedule_data FROM DailySchedules WHERE date = ?`, [today], (err, row) => {
        if (!row) return res.status(404).json({ message: "Today's schedule not found." });
        
        const schedule = JSON.parse(row.schedule_data);
        const blockIndex = schedule.timeline.findIndex(b => b.id === parseInt(blockId));
        if (blockIndex === -1) return res.status(404).json({ message: "Block not found in schedule." });

        const wasAlreadyCompleted = schedule.timeline[blockIndex].completed;
        schedule.timeline[blockIndex].completed = completed;
        
        db.run(`UPDATE DailySchedules SET schedule_data = ? WHERE date = ?`, [JSON.stringify(schedule), today], (err) => {
            // Only increment the completion count if a block is newly marked as complete.
            if (completed && !wasAlreadyCompleted) {
                db.run(`UPDATE DailyProductivityStats SET blocks_completed = blocks_completed + 1 WHERE date = ?`, [today]);
            }
            res.status(200).json(schedule);
        });
    });
});

// --- 2. PRODUCTIVITY STATS AND CALENDAR ---

// GET /api/stats/monthly - Fetches all daily stats for a given month and year.
app.get('/api/stats/monthly', (req, res) => {
  const { year, month } = req.query;
  const searchPattern = `${year}-${String(month).padStart(2, '0')}-%`;
  
  db.all(`SELECT * FROM DailyProductivityStats WHERE date LIKE ? ORDER BY date`, [searchPattern], (err, rows) => {
    if (err) return res.status(500).json({ message: "Database error fetching monthly stats." });
    res.status(200).json(rows);
  });
});


// --- 3. MACHINE LEARNING DATA COLLECTION AND PREDICTION ---

// POST /api/ml/log-task - Logs a completed task's actual duration to train our ML models.
app.post('/api/ml/log-task', (req, res) => {
    const { task_name, priority, actual_duration_minutes } = req.body;
    const sql = `INSERT INTO UserTaskHistory (task_name, priority, actual_duration_minutes) VALUES (?, ?, ?)`;
    
    db.run(sql, [task_name, priority, actual_duration_minutes], function(err) {
        if (err) return res.status(500).json({ message: 'Failed to log task for ML training.' });
        
        // Check if it's time to retrain the models.
        db.get('SELECT COUNT(*) as count FROM UserTaskHistory', [], (err, row) => {
            if (row && row.count > 0 && row.count % RETRAIN_TRIGGER_COUNT === 0) {
                console.log(`Task count reached ${row.count}. Triggering model retraining...`);
                triggerModelRetraining();
            }
        });
        res.status(201).json({ message: 'Task completion logged for ML training.' });
    });
});

// GET /api/ml/predict - Acts as a proxy to get predictions from the Python AI.
app.get('/api/ml/predict', async (req, res) => {
    try {
        const { taskName } = req.query;
        if (!taskName) return res.status(400).json({ message: 'taskName query parameter is required.' });

        const predictionResponse = await axios.post(`${PYTHON_API_BASE_URL}/ml/predict`, { task_name: taskName });
        res.status(200).json(predictionResponse.data);
    } catch (error) {
        console.error("ML prediction proxy error:", error.message);
        res.status(200).json({ predicted_priority: 'medium', predicted_duration: 30 });
    }
});


// --- Helper function to trigger model retraining in the Python service ---
async function triggerModelRetraining() {
    try {
        db.all('SELECT task_name, priority, actual_duration_minutes FROM UserTaskHistory', [], async (err, history) => {
            if (err || !history.length) return;
            
            console.log(`Sending ${history.length} tasks to Python service for retraining...`);
            await axios.post(`${PYTHON_API_BASE_URL}/ml/retrain`, { history });
            console.log("Retraining request completed.");
        });
    } catch (error) {
        console.error("Failed to trigger model retraining:", error.message);
    }
}

// SECTION 5: START THE SERVER
// ==========================================================
app.listen(PORT, () => {
  console.log(`Node.js server is running on http://localhost:${PORT}`);
});