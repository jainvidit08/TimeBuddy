# ==============================================================================
# SECTION 1: IMPORTS AND SETUP
# ==============================================================================
import datetime
import random
import copy
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

# --- Local ML Module Import (CORRECTED) ---
try:
    # This now correctly imports from ml_models.py
    from ml_model import predict_task_attributes, retrain_models_from_history
except ImportError:
    print("WARNING: ml_models.py not found. Predictive features will not work.")
    def predict_task_attributes(task_name: str):
        return {"predicted_priority": "medium", "predicted_duration": 30}
    def retrain_models_from_history(history: list):
        return {"status": "training_skipped", "message": "ML module not found."}


app = FastAPI(
    title="Time Buddy AI Core",
    description="Handles AI-powered scheduling and ML-based task predictions."
)

# ==============================================================================
# SECTION 2: PYDANTIC MODELS (API Data Contracts)
# ==============================================================================
class TaskIn(BaseModel):
    task_id: int
    name: str
    priority: str
    initialising_time: datetime.datetime
    deadline_time: datetime.datetime
    time_needed_minutes: int
    fixed: bool = False
    in_one_go: bool = False

class ScheduleRequest(BaseModel):
    tasks: List[TaskIn]
    day_start: datetime.datetime
    day_end: datetime.datetime

class ScheduleResponse(BaseModel):
    final_score: float
    timeline: List[Dict[str, Any]]
    task_summary: List[Dict[str, Any]]

class PredictionRequest(BaseModel):
    task_name: str

class PredictionResponse(BaseModel):
    predicted_priority: str
    predicted_duration: int

class TaskHistoryItem(BaseModel):
    task_name: str
    priority: str
    actual_duration_minutes: int

class RetrainRequest(BaseModel):
    history: List[TaskHistoryItem]

# ==============================================================================
# SECTION 3: CORE SCHEDULING ALGORITHM
# ==============================================================================
class Task:
    def __init__(self, task_model: TaskIn):
        self.task_id, self.name, self.priority = task_model.task_id, task_model.name, task_model.priority
        self.initialising_time, self.deadline_time = task_model.initialising_time, task_model.deadline_time
        self.time_needed = datetime.timedelta(minutes=task_model.time_needed_minutes)
        self.fixed, self.in_one_go = task_model.fixed, task_model.in_one_go
        self.time_remaining, self.scheduled_blocks, self.finish_time = self.time_needed, [], None
    def is_fully_scheduled(self): return self.time_remaining <= datetime.timedelta(0)

class Schedule:
    def __init__(self, tasks_dict): self.timeline, self.tasks = [], tasks_dict
    def add_item(self, start, duration, id, name):
        self.timeline.append({'start_time': start, 'end_time': start + duration, 'item_id': id, 'item_name': name})
        self.timeline.sort(key=lambda x: x['start_time'])
    def find_available_slot(self, start_search, duration, earliest, latest):
        current = max(start_search, earliest)
        if not self.timeline: return current if current + duration <= latest else None
        if current + duration <= self.timeline[0]['start_time']: return current
        for i in range(len(self.timeline) - 1):
            search = max(self.timeline[i]['end_time'], current)
            if search + duration <= self.timeline[i+1]['start_time'] and search + duration <= latest: return search
        search = max(self.timeline[-1]['end_time'], current)
        return search if search + duration <= latest else None

def chunk_task_time(time_needed):
    chunks, twenty_five_mins = [], datetime.timedelta(minutes=25)
    if time_needed <= datetime.timedelta(0): return chunks
    num, rem = divmod(time_needed.total_seconds(), twenty_five_mins.total_seconds())
    num, rem = int(num), datetime.timedelta(seconds=rem)
    if num > 0 and datetime.timedelta(0) < rem < datetime.timedelta(minutes=10):
        chunks.extend([twenty_five_mins] * (num - 1)); chunks.append(twenty_five_mins + rem)
    else:
        chunks.extend([twenty_five_mins] * num)
        if rem > datetime.timedelta(0): chunks.append(rem)
    return chunks

def generate_initial_schedule(tasks, day_start, day_end):
    schedule = Schedule({t.task_id: t for t in tasks})
    sorted_tasks = sorted(tasks, key=lambda t: (not t.fixed, t.priority != 'high', t.priority != 'medium', t.deadline_time))
    for task in sorted_tasks:
        if task.fixed:
            schedule.add_item(task.initialising_time - datetime.timedelta(minutes=5), datetime.timedelta(minutes=5), "BREAK", "Break")
            schedule.add_item(task.initialising_time, task.time_needed, task.task_id, task.name)
            task.finish_time, task.time_remaining = task.initialising_time + task.time_needed, datetime.timedelta(0)
            schedule.add_item(task.finish_time, datetime.timedelta(minutes=5), "BREAK", "Break")
            continue
        chunks = [task.time_needed] if task.in_one_go else chunk_task_time(task.time_needed)
        search_time = day_start
        for i, chunk in enumerate(chunks):
            if slot := schedule.find_available_slot(search_time, chunk, task.initialising_time, task.deadline_time):
                schedule.add_item(slot, chunk, task.task_id, task.name)
                task.scheduled_blocks.append((slot, slot + chunk)); task.time_remaining -= chunk; task.finish_time = slot + chunk; search_time = slot + chunk
                if not task.in_one_go and i < len(chunks) - 1: schedule.add_item(search_time, datetime.timedelta(minutes=5), "BREAK", "Break")
            else: break
    return schedule

def calculate_total_score(schedule):
    score, weights = 0, {'low': 100, 'medium': 500, 'high': 2000}
    for task in schedule.tasks.values():
        if task.is_fully_scheduled() and task.finish_time > task.deadline_time: score += weights[task.priority] + (task.finish_time - task.deadline_time).total_seconds() / 60
        if not task.is_fully_scheduled(): score += (task.time_remaining / task.time_needed) * weights[task.priority]
    return score

def generate_neighbor_schedule(schedule, day_start, day_end):
    neighbor = copy.deepcopy(schedule)
    movable = [t for t in neighbor.tasks.values() if not t.fixed and t.scheduled_blocks]
    if not movable: return neighbor
    task = random.choice(movable)
    block_start, block_end = random.choice(task.scheduled_blocks)
    duration = block_end - block_start
    neighbor.timeline = [i for i in neighbor.timeline if not (i['start_time'] == block_start and i['item_id'] == task.task_id)]
    task.scheduled_blocks.remove((block_start, block_end)); task.time_remaining += duration
    rand_start = day_start + datetime.timedelta(minutes=random.randint(0, int((day_end - day_start).total_seconds() / 60 - 60)))
    if slot := neighbor.find_available_slot(rand_start, duration, task.initialising_time, task.deadline_time):
        neighbor.add_item(slot, duration, task.task_id, task.name)
        task.scheduled_blocks.append((slot, slot + duration)); task.time_remaining -= duration
    task.finish_time = max(b[1] for b in task.scheduled_blocks) if task.scheduled_blocks else None
    return neighbor

def stochastic_hill_climbing(tasks, day_start, day_end, max_iter=2000, num_neighbors=10):
    current_schedule = generate_initial_schedule(tasks, day_start, day_end)
    current_score = calculate_total_score(current_schedule)
    for _ in range(max_iter):
        neighbors = [generate_neighbor_schedule(current_schedule, day_start, day_end) for _ in range(num_neighbors)]
        best_neighbor = min(neighbors, key=calculate_total_score)
        best_neighbor_score = calculate_total_score(best_neighbor)
        if best_neighbor_score < current_score: current_schedule, current_score = best_neighbor, best_neighbor_score
    return current_schedule

# ==============================================================================
# SECTION 4: API ENDPOINTS
# ==============================================================================
@app.get("/")
def read_root(): return {"status": "Time Buddy AI Core is running."}

@app.post("/create-schedule", response_model=ScheduleResponse)
async def create_schedule_endpoint(request: ScheduleRequest):
    tasks = [Task(task_data) for task_data in request.tasks]
    final_schedule = stochastic_hill_climbing(tasks, request.day_start, request.day_end)
    task_summary = [{'task_id': t.task_id, 'name': t.name, 'status': "COMPLETED" if t.is_fully_scheduled() else "INCOMPLETE"} for t in final_schedule.tasks.values()]
    return ScheduleResponse(final_score=calculate_total_score(final_schedule), timeline=final_schedule.timeline, task_summary=task_summary)

@app.post("/ml/predict", response_model=PredictionResponse)
async def predict_endpoint(request: PredictionRequest):
    if not request.task_name.strip(): raise HTTPException(status_code=400, detail="Task name cannot be empty.")
    predictions = predict_task_attributes(request.task_name)
    return PredictionResponse(**predictions)

@app.post("/ml/retrain")
async def retrain_endpoint(request: RetrainRequest):
    if not request.history: raise HTTPException(status_code=400, detail="History cannot be empty.")
    history_data = [item.model_dump() for item in request.history]
    result = retrain_models_from_history(history_data)
    return result

