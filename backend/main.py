from fastapi import FastAPI, Depends, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
import os

from models import Notification, StatusEnum, PriorityEnum, Base
from database import engine, get_db, init_db
import jionlp as jio

# Initialize DB
init_db()

app = FastAPI(title="Duty Assistant API")

# Setup CORS for Electron/Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Duty Assistant API is running"}

# TODO: Add API routes for Notifications CRUD
# TODO: Add NLP extraction route
