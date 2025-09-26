import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

// API base URL for our Node.js backend
const NODE_API_URL = 'http://localhost:3001/api';

// ==========================================================
// STYLES - All styles are embedded here
// ==========================================================
const AppStyles = () => {
  const css = `
    :root {
      --bg-primary: #F3EFE0;      /* Dedicated Cream */
      --bg-secondary: #FFFFFF;    /* White for cards */
      --bg-tertiary: #FAFAFA;    /* Off-white for breaks */
      --text-primary: #343A40;    /* Focused Graphite */
      --text-secondary: #6C757D;  /* A softer gray for secondary text */
      --accent-primary: #4D2C5E;   /* Regal Purple */
      --accent-secondary: #00C853; /* Spark of Genius Green */
      --danger: #D32F2F;         /* A fitting red */
      --success: #00C853;       
    }
    body {
      margin: 0;
      font-family: 'Inter', sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      background-color: var(--bg-primary);
      color: var(--text-primary);
      overflow-x: hidden;
    }
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: #E9E4D5; }
    ::-webkit-scrollbar-thumb { background: #D1CBB8; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #B9B29B; }
    .container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 1rem;
    }
    @media (min-width: 640px) { .container { padding: 0 1.5rem; } }
    @media (min-width: 1024px) { .container { padding: 0 2rem; } }
    .button {
        padding: 0.75rem 1.5rem; font-weight: 600; border-radius: 0.5rem;
        cursor: pointer; transition: all 0.2s ease-in-out; border: none;
        box-shadow: 0 4px 14px 0 rgba(0,0,0,0.07);
    }
    .button:hover { transform: translateY(-2px); }
    .button-primary { background-color: #4D2C5E; color: white; }
    .button-primary:hover { box-shadow: 0 6px 20px 0 rgba(77, 44, 94, 0.3); }
    .button-secondary { background-color: #E9E4D5; color: #343A40; }
    .button-secondary:hover { background-color: #D1CBB8; }
    input, select {
        width: 100%; box-sizing: border-box; background-color: #E9E4D5;
        color: #343A40; border: 2px solid #D1CBB8;
        padding: 0.75rem; border-radius: 0.5rem; transition: border-color 0.2s;
    }
    input:focus, select:focus {
        outline: none; border-color: #4D2C5E;
    }
    label { font-weight: 600; font-size: 0.875rem; color: #343A40; }
    .app-main { padding: 1.5rem; max-width: 1280px; margin: 0 auto; }
    .header {
      background-color: #FFFFFF;
      border-bottom: 1px solid #E9E4D5;
      position: sticky; top: 0; z-index: 20;
    }
    .header-nav { display: flex; justify-content: space-between; align-items: center; padding-top: 1rem; padding-bottom: 1rem; }
    .header-brand { display: flex; align-items: center; gap: 0.75rem; cursor: pointer; }
    .header-brand svg { height: 2rem; width: 2rem; color: #4D2C5E; }
    .header-brand h1 { font-size: 1.5rem; font-weight: 700; margin: 0; }
    .scheduler-layout { display: grid; grid-template-columns: 1fr; gap: 2rem; }
    @media (min-width: 1024px) { .scheduler-layout { grid-template-columns: repeat(3, 1fr); } }
    .card {
      background-color: #FFFFFF; padding: 1.5rem; border-radius: 0.75rem;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.05);
    }
    .card h2 { font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; margin-top: 0; }
    .form-container { display: flex; flex-direction: column; gap: 1rem; }
    .form-group { display: flex; flex-direction: column; gap: 0.25rem; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .checkbox-group { display: flex; justify-content: space-around; padding-top: 0.5rem; }
    .checkbox-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
    .checkbox-input { height: 1rem; width: 1rem; accent-color: #4D2C5E; }
    .task-list-container { display: flex; flex-direction: column; height: 100%; }
    .task-list { list-style: none; padding: 0; margin: 0; flex-grow: 1; max-height: 20rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; }
    .task-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background-color: #4D2C5E; color: white; border-radius: 0.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .task-item-name { font-weight: 600; }
    .task-delete-btn { background: none; border: none; color: white; opacity: 0.7; cursor: pointer; transition: opacity 0.2s; }
    .task-delete-btn:hover { opacity: 1; }
    .generate-btn { margin-top: 1rem; }
    .generate-btn button { background: #00C853; color: #343A40; width: 100%; font-size: 1.125rem; }
    .generate-btn button:disabled { background: #6C757D; cursor: not-allowed; transform: none; box-shadow: none; }
    .schedule-display-container { grid-column: auto; }
    @media (min-width: 1024px) { .schedule-display-container { grid-column: span 2 / span 2; } }
    .schedule-timeline { list-style: none; padding: 0; margin: 0; max-height: 70vh; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; }
    .timeline-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid #E9E4D5; transition: all 0.3s; }
    .timeline-item-break { background-color: #FAFAFA; }
    .timeline-item-time { font-family: monospace; font-size: 0.875rem; color: #6C757D; }
    .timeline-item-name { font-weight: 600; margin-left: 1rem; }
    .timeline-item-complete-btn { background: none; border: none; font-size: 1.5rem; color: #00C853; cursor: pointer; transition: transform 0.2s; }
    .timeline-item-complete-btn:disabled { color: #ADB5BD; cursor: not-allowed; }
    .timeline-item.completed { background-color: #E9ECEF; text-decoration: line-through; color: #6C757D; }
    .ai-suggestion-box {
      padding: 0.75rem; background-color: #e6fff9; border-left: 4px solid #00C853;
      border-radius: 0 0.5rem 0.5rem 0; font-size: 0.875rem; display: flex; flex-direction: column; gap: 0.5rem;
    }
    .ai-suggestion-title { font-weight: 700; color: #4D2C5E; }
    .ai-suggestion-buttons { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .ai-suggestion-btn {
      font-size: 0.75rem; padding: 0.25rem 0.75rem; background-color: white;
      border: 1px solid #00C853; border-radius: 9999px; cursor: pointer;
      transition: all 0.2s;
    }
    .ai-suggestion-btn:hover { background-color: #00C853; color: white; }
    .calendar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .calendar-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; gap: 0.25rem; font-weight: 600; color: #6C757D; margin-bottom: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid #E9E4D5; }
    .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.5rem; min-height: 50vh; }
    .calendar-day { position: relative; border: 1px solid #E9E4D5; border-radius: 0.5rem; padding: 0.5rem; display: flex; align-items: flex-start; justify-content: flex-start; transition: all 0.3s ease; }
    .calendar-day-green { background-color: #00C853; color: white; }
    .calendar-day-coral { background-color: #FF6F61; color: white; }
    .calendar-day-red { background-color: #D32F2F; color: white; }
    .calendar-day-slate { background-color: #F1F1F1; }
    .calendar-day-tooltip {
        position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 0.5rem;
        width: max-content; padding: 0.25rem 0.5rem; background-color: #343A40; color: #F3EFE0;
        font-size: 0.75rem; border-radius: 0.375rem; opacity: 0; transition: opacity 0.3s; pointer-events: none;
    }
    .calendar-day:hover .calendar-day-tooltip { opacity: 1; }
    .modal-overlay { position: fixed; inset: 0; background-color: rgba(13, 42, 76, 0.7); display: grid; place-items: center; z-index: 50; }
    .modal-content {
      background-color: white; color: #343A40; padding: 2rem; border-radius: 1rem;
      width: 90%; max-width: 400px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
    }
    .modal-content h3 { margin-top: 0; font-size: 1.5rem; }
    .modal-content p { color: #6C757D; }
  `;
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{css}</style>
    </>
  );
};

// Main Application Component
export default function App() {
  const [view, setView] = useState('scheduler');

  return (
    <>
      <AppStyles />
      <div>
        <Header setView={setView} currentView={view} />
        <main className="app-main">
          <AnimatePresence mode="wait">
            {view === 'scheduler' ? <SchedulerPage key="scheduler" /> : <TrackerPage key="tracker" />}
          </AnimatePresence>
        </main>
      </div>
    </>
  );
}

// Reusable Components
const Header = ({ setView, currentView }) => (
  <header className="header">
    <nav className="container header-nav">
      <motion.div whileHover={{ scale: 1.05 }} className="header-brand">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        <h1>Time Buddy</h1>
      </motion.div>
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={() => setView(currentView === 'scheduler' ? 'tracker' : 'scheduler')}
        className="button button-primary">
        {currentView === 'scheduler' ? 'View Tracker' : 'Scheduler'}
      </motion.button>
    </nav>
  </header>
);

const pageVariants = { initial: { opacity: 0, y: 30 }, in: { opacity: 1, y: 0 }, out: { opacity: 0, y: -30 },};
const pageTransition = { type: 'spring', stiffness: 120, damping: 20 };

// PAGE 1: The Scheduler
const SchedulerPage = () => {
  const getDefaultTime = (h) => { const d=new Date(); d.setHours(h,0,0,0); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,16); };
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({ name: '', priority: 'medium', time_needed_minutes: 30, fixed: false, in_one_go: false, initialising_time: getDefaultTime(9), deadline_time: getDefaultTime(21) });
  const [schedule, setSchedule] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFetchingInitial, setIsFetchingInitial] = useState(true);
  const [prediction, setPrediction] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskToLog, setTaskToLog] = useState(null);
  // NEW: State to store the original tasks sent for generation
  const [sentTasksForSchedule, setSentTasksForSchedule] = useState([]);


  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${NODE_API_URL}/schedules/today`);
        if (data.schedule) {
            setSchedule(data.schedule);
            // If we load a schedule, we need to find the original tasks to get their priority.
            // This is a simplified reconstruction. A more robust solution might save this too.
            const reconstructedTasks = data.schedule.task_summary.map(summary => ({
                task_id: summary.task_id,
                name: summary.name,
                priority: 'medium' // Defaulting priority as we don't have it saved
            }));
            setSentTasksForSchedule(reconstructedTasks);
        }
      } catch (err) { console.error(err); } 
      finally { setIsFetchingInitial(false); }
    })();
  }, []);

  useEffect(() => {
    if (newTask.name.length < 5) { setPrediction(null); return; }
    const handler = setTimeout(async () => {
      try {
        const { data } = await axios.get(`${NODE_API_URL}/ml/predict`, { params: { taskName: newTask.name } });
        setPrediction(data);
      } catch (error) { console.error("Prediction failed:", error); }
    }, 500);
    return () => clearTimeout(handler);
  }, [newTask.name]);

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTask.name.trim()) return;
    setTasks(prev => [...prev, { ...newTask, task_id: Date.now(), time_needed_minutes: parseInt(newTask.time_needed_minutes, 10) || 30 }]);
    setNewTask({ name: '', priority: 'medium', time_needed_minutes: 30, fixed: false, in_one_go: false, initialising_time: getDefaultTime(9), deadline_time: getDefaultTime(21) });
    setPrediction(null);
  };

  const generateSchedule = async () => {
    if (tasks.length === 0) return;
    setIsGenerating(true);
    setSentTasksForSchedule(tasks); // THE FIX: Store the tasks before sending them
    try {
      const payload = { 
        tasks: tasks.map(t => ({...t, initialising_time: new Date(t.initialising_time).toISOString(), deadline_time: new Date(t.deadline_time).toISOString()})), 
        day_start: new Date(new Date().setHours(9,0,0,0)), 
        day_end: new Date(new Date().setHours(21,0,0,0)), 
      };
      const { data } = await axios.post(`${NODE_API_URL}/schedules`, payload);
      setSchedule(data);
      setTasks([]);
    } catch (err) { console.error(err); } 
    finally { setIsGenerating(false); }
  };
    
  const handleCompleteBlock = async (block) => {
    if (block.completed) return;
    const updatedTimeline = schedule.timeline.map(b => b.id === block.id ? { ...b, completed: true } : b);
    setSchedule(prev => ({ ...prev, timeline: updatedTimeline }));

    try {
      await axios.patch(`${NODE_API_URL}/schedules/today/blocks/${block.id}`, { completed: true });
      const allBlocksForTask = updatedTimeline.filter(b => b.item_id === block.item_id);
      if (allBlocksForTask.every(b => b.completed)) {
        // THE FIX: Find the original task from our saved 'sentTasksForSchedule' state
        const originalTask = sentTasksForSchedule.find(t => t.task_id === block.item_id);
        setTaskToLog({
          task_name: block.item_name,
          priority: originalTask ? originalTask.priority : 'medium',
        });
        setIsModalOpen(true);
      }
    } catch (err) { setSchedule(prev => ({ ...prev, timeline: schedule.timeline })); }
  };
  
  const handleLogSubmit = async (actualDuration) => {
    try {
      if (actualDuration && /^\d+$/.test(actualDuration)) {
        await axios.post(`${NODE_API_URL}/ml/log-task`, { 
          ...taskToLog,
          actual_duration_minutes: parseInt(actualDuration, 10) 
        });
      }
    } catch (err) {
      console.error("Failed to log task", err);
      alert("Could not log your task completion time.");
    } finally {
      setIsModalOpen(false);
      setTaskToLog(null);
    }
  };

  return (
    <>
      <motion.div variants={pageVariants} initial="initial" animate="in" exit="out" transition={pageTransition} className="scheduler-layout">
        <motion.div variants={{in: {transition: {staggerChildren: 0.1}}}} className="flex flex-col gap-8">
          <TaskInputForm newTask={newTask} setNewTask={setNewTask} onAddTask={handleAddTask} prediction={prediction} />
          <TaskList tasks={tasks} setTasks={setTasks} onGenerate={generateSchedule} isGenerating={isGenerating} />
        </motion.div>
        <motion.div variants={pageVariants} className="schedule-display-container">
          <div className="card">
            <h2 style={{textAlign: 'center', fontSize: '1.875rem', fontWeight: 700, marginBottom: '1rem'}}>Today's Plan</h2>
            {isFetchingInitial ? <p style={{textAlign: 'center'}}>Checking for a saved schedule...</p> :
             schedule ? <ScheduleDisplay schedule={schedule} onCompleteBlock={handleCompleteBlock} /> :
             <div style={{textAlign: 'center', marginTop: '5rem'}}>
                <p style={{fontSize: '1.125rem'}}>Your optimized day will appear here.</p>
                <p>Add some tasks and click "Generate Schedule" to begin!</p>
             </div>}
          </div>
        </motion.div>
      </motion.div>
      <AnimatePresence>
        {isModalOpen && <CompletionModal task={taskToLog} onSubmit={handleLogSubmit} onClose={() => setIsModalOpen(false)} />}
      </AnimatePresence>
    </>
  );
};

const CompletionModal = ({ task, onSubmit, onClose }) => {
  const [duration, setDuration] = useState('');
  const handleSubmit = (e) => { e.preventDefault(); onSubmit(duration); };
  return (
    <motion.div initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="modal-overlay" onClick={onClose}>
      <motion.div initial={{y: 50, opacity: 0}} animate={{y: 0, opacity: 1}} exit={{y: 50, opacity: 0}}
        className="modal-content" onClick={e => e.stopPropagation()}>
          <h3>Task Complete!</h3>
          <p>Great job finishing <strong>{task.task_name}</strong>. How many minutes did it actually take? This helps the AI learn.</p>
          <form onSubmit={handleSubmit} className="form-container">
            <div className="form-group">
                <label htmlFor="actual_duration">Actual Time Taken (minutes)</label>
                <input id="actual_duration" type="number" value={duration} onChange={e => setDuration(e.target.value)} autoFocus />
            </div>
            <button type="submit" className="button button-primary">Log Time</button>
          </form>
      </motion.div>
    </motion.div>
  );
};

const TaskInputForm = ({ newTask, setNewTask, onAddTask, prediction }) => {
    const handleInputChange = e => setNewTask(p => ({...p, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value}));
    return (
        <motion.div variants={pageVariants} className="card">
            <h2>Inbox</h2>
            <form onSubmit={onAddTask} className="form-container">
                <div className="form-group"><label htmlFor="name">Task Name</label><input id="name" type="text" name="name" value={newTask.name} onChange={handleInputChange} placeholder="e.g., Finalize presentation" /></div>
                <AnimatePresence>{prediction && <SuggestionBox prediction={prediction} setNewTask={setNewTask} />}</AnimatePresence>
                <div className="form-grid">
                    <div className="form-group"><label htmlFor="priority">Priority</label><select id="priority" name="priority" value={newTask.priority} onChange={handleInputChange}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
                    <div className="form-group"><label htmlFor="time">Time (min)</label><input id="time" type="number" name="time_needed_minutes" value={newTask.time_needed_minutes} onChange={handleInputChange} /></div>
                </div>
                <div className="form-grid">
                    <div className="form-group"><label htmlFor="initialising_time">Start After</label><input id="initialising_time" type="datetime-local" name="initialising_time" value={newTask.initialising_time} onChange={handleInputChange} /></div>
                    <div className="form-group"><label htmlFor="deadline_time">Finish Before</label><input id="deadline_time" type="datetime-local" name="deadline_time" value={newTask.deadline_time} onChange={handleInputChange} /></div>
                </div>
                <div className="checkbox-group"><label className="checkbox-label"><input type="checkbox" name="fixed" checked={newTask.fixed} onChange={handleInputChange} className="checkbox-input" /><span>Fixed</span></label><label className="checkbox-label"><input type="checkbox" name="in_one_go" checked={newTask.in_one_go} onChange={handleInputChange} className="checkbox-input"/><span>In One Go</span></label></div>
                <motion.button type="submit" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="button button-primary">Add Task</motion.button>
            </form>
        </motion.div>
    );
};
const TaskList = ({ tasks, setTasks, onGenerate, isGenerating }) => (
    <motion.div variants={pageVariants} className="card task-list-container">
        <h2>Ready ({tasks.length})</h2>
        <div className="task-list"><AnimatePresence>{tasks.map(task => (<motion.div key={task.task_id} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="task-item"><span className="task-item-name">{task.name}</span><motion.button whileHover={{ scale: 1.2 }} onClick={() => setTasks(p => p.filter(t => t.task_id !== task.task_id))} className="task-delete-btn">✕</motion.button></motion.div>))}</AnimatePresence></div>
        <div className="generate-btn"><motion.button onClick={onGenerate} disabled={tasks.length === 0 || isGenerating} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="button">{isGenerating ? 'Generating...' : 'Generate Schedule'}</motion.button></div>
    </motion.div>
);
const ScheduleDisplay = ({ schedule, onCompleteBlock }) => (
    <div className="schedule-timeline"><AnimatePresence>{schedule.timeline.map((item) => (<motion.div key={item.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ type: 'spring', stiffness: 200, damping: 25 }} className={`timeline-item ${item.completed ? 'completed' : ''} ${item.item_id === 'BREAK' ? 'timeline-item-break' : ''}`}><div><span className="timeline-item-time">{new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span className="timeline-item-name">{item.item_name}</span></div>{item.item_id !== 'BREAK' && <motion.button whileHover={{ scale: 1.2 }} onClick={() => onCompleteBlock(item)} disabled={item.completed} className="timeline-item-complete-btn">✔</motion.button>}</motion.div>))}</AnimatePresence></div>
);
const SuggestionBox = ({ prediction, setNewTask }) => (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="ai-suggestion-box">
        <p className="ai-suggestion-title">✨ AI Suggestion ✨</p><p>Based on similar tasks, we suggest:</p>
        <div className="ai-suggestion-buttons">
            <button type="button" onClick={() => setNewTask(p => ({...p, priority: prediction.predicted_priority}))} className="ai-suggestion-btn">Set Priority to <span style={{fontWeight: 700}}>{prediction.predicted_priority}</span></button>
            <button type="button" onClick={() => setNewTask(p => ({...p, time_needed_minutes: prediction.predicted_duration}))} className="ai-suggestion-btn">Set Duration to <span style={{fontWeight: 700}}>{prediction.predicted_duration} min</span></button>
        </div>
    </motion.div>
);

// PAGE 2: The Tracker
const TrackerPage = () => {
  const [stats, setStats] = useState({});
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    (async () => {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      try {
        const { data } = await axios.get(`${NODE_API_URL}/stats/monthly`, { params: { year, month } });
        setStats(data.reduce((acc, day) => ({ ...acc, [day.date]: { total: day.total_blocks_scheduled, completed: day.blocks_completed } }), {}));
      } catch (error) { console.error("Failed to fetch calendar stats", error); }
    })();
  }, [currentDate]);
  
  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();
  const handlePrevMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  
  const renderCalendarDays = () => {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const daysInMonth = getDaysInMonth(year, month);
      const firstDay = getFirstDayOfMonth(year, month);
      const days = Array.from({length: firstDay}, (_, i) => <div key={`blank-${i}`}></div>);
      for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayStat = stats[dateStr];
          let colorClass = 'calendar-day-slate', tooltip = 'No tasks scheduled';
          if (dayStat && dayStat.total > 0) {
              const ratio = dayStat.completed / dayStat.total;
              tooltip = `${dayStat.completed} / ${dayStat.total} blocks completed`;
              if (ratio >= 0.8) colorClass = 'calendar-day-green';
              else if (ratio >= 0.4) colorClass = 'calendar-day-coral';
              else colorClass = 'calendar-day-red';
          }
          days.push((<motion.div key={day} whileHover={{ scale: 1.1, zIndex: 5 }} className={`calendar-day ${colorClass}`}><span style={{fontWeight: 700}}>{day}</span><div className="calendar-day-tooltip">{tooltip}</div></motion.div>));
      }
      return days;
  };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="in" exit="out" transition={pageTransition} className="card">
      <div className="calendar-header">
        <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={handlePrevMonth} className="button button-secondary">&lt; Prev</motion.button>
        <h2 style={{fontSize: '1.5rem', fontWeight: 700}}>{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
        <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={handleNextMonth} className="button button-secondary">Next &gt;</motion.button>
      </div>
      <div className="calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day}>{day}</div>)}</div>
      <div className="calendar-grid">{renderCalendarDays()}</div>
    </motion.div>
  );
};

