import os
import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.linear_model import Ridge
from sklearn.pipeline import Pipeline

# ==============================================================================
# CONFIGURATION & FILE PATHS
# ==============================================================================

# This is the "switch" for turning on the AI. Training will only occur
# once the user has completed at least this many tasks.
MIN_TRAINING_SAMPLES = 30

# Define paths to save our trained models and the text vectorizer.
# The 'models' directory will be created automatically.
MODEL_DIR = "saved_models"
PRIORITY_MODEL_PATH = os.path.join(MODEL_DIR, "priority_model.pkl")
DURATION_MODEL_PATH = os.path.join(MODEL_DIR, "duration_model.pkl")
VECTORIZER_PATH = os.path.join(MODEL_DIR, "vectorizer.pkl")

# Ensure the directory to save models exists
os.makedirs(MODEL_DIR, exist_ok=True)


# ==============================================================================
# PREDICTION LOGIC
# ==============================================================================

def predict_task_attributes(task_name: str) -> dict:
    """
    Predicts the priority and duration for a given task name.
    This is the "suggestion" feature.
    """
    # --- The "On/Off" Switch ---
    # Check if our models have been trained and saved yet.
    # If not, the feature is "off," and we return default values.
    if not all(os.path.exists(p) for p in [PRIORITY_MODEL_PATH, DURATION_MODEL_PATH, VECTORIZER_PATH]):
        return {
            "predicted_priority": "medium",
            "predicted_duration": 30
        }

    try:
        # Load the saved, pre-trained models and vectorizer
        priority_pipeline = joblib.load(PRIORITY_MODEL_PATH)
        duration_pipeline = joblib.load(DURATION_MODEL_PATH)
        
        # The input task_name must be in a list for the model to process it
        task_name_list = [task_name]
        
        # Make predictions using the loaded pipelines
        predicted_priority = priority_pipeline.predict(task_name_list)[0]
        predicted_duration = duration_pipeline.predict(task_name_list)[0]

        # Ensure duration is a non-negative integer
        predicted_duration = max(5, int(round(predicted_duration)))

        return {
            "predicted_priority": predicted_priority,
            "predicted_duration": predicted_duration
        }
    except Exception as e:
        print(f"Error during prediction: {e}")
        # Fallback to defaults if anything goes wrong
        return {
            "predicted_priority": "medium",
            "predicted_duration": 30
        }

# ==============================================================================
# TRAINING LOGIC
# ==============================================================================

def retrain_models_from_history(history_data: list) -> dict:
    """
    Retrains the priority and duration models based on the user's full task history.
    """
    # --- The Training Trigger ---
    # If we don't have enough data yet, we skip the training process.
    if len(history_data) < MIN_TRAINING_SAMPLES:
        return {
            "status": "skipped_training",
            "message": f"Need at least {MIN_TRAINING_SAMPLES} completed tasks to train. Currently have {len(history_data)}."
        }

    try:
        # 1. Prepare the data using pandas
        df = pd.DataFrame(history_data)
        
        # Features (the input text)
        X = df['task_name']
        
        # Labels (the outputs we want to predict)
        y_priority = df['priority']
        y_duration = df['actual_duration_minutes']

        # 2. Create the ML Pipelines
        # A pipeline chains together the steps: text vectorization -> model training.
        # This is best practice as it ensures new data is processed identically.
        
        # Pipeline for the Priority Classification Model (Naive Bayes)
        priority_pipeline = Pipeline([
            ('tfidf', TfidfVectorizer(lowercase=True, stop_words='english')),
            ('clf', MultinomialNB())
        ])
        
        # Pipeline for the Duration Regression Model (Ridge)
        duration_pipeline = Pipeline([
            ('tfidf', TfidfVectorizer(lowercase=True, stop_words='english')),
            ('reg', Ridge())
        ])

        # 3. Train the models on the entire history
        print(f"Retraining models with {len(df)} samples...")
        priority_pipeline.fit(X, y_priority)
        duration_pipeline.fit(X, y_duration)
        
        # 4. Save the trained models (and their vectorizers) to disk
        # This is how the model's "knowledge" is persisted.
        joblib.dump(priority_pipeline, PRIORITY_MODEL_PATH)
        joblib.dump(duration_pipeline, DURATION_MODEL_PATH)
        
        print("Models retrained and saved successfully.")
        
        return {
            "status": "training_complete",
            "message": f"Models were successfully retrained with {len(df)} tasks."
        }
    except Exception as e:
        print(f"An error occurred during model retraining: {e}")
        return {
            "status": "training_failed",
            "error": str(e)
        }