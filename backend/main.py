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

from schemas import NotificationCreate, NotificationUpdate, NotificationResponse
from fastapi import Query

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Duty Assistant API is running"}

@app.post("/api/notifications/", response_model=NotificationResponse)
def create_notification(notification: NotificationCreate, db: Session = Depends(get_db)):
    db_notification = Notification(**notification.model_dump())
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)
    return db_notification

@app.get("/api/notifications/", response_model=List[NotificationResponse])
def get_notifications(
    skip: int = 0, 
    limit: int = 100,
    search: Optional[str] = None,
    status: Optional[StatusEnum] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Notification)
    if search:
        query = query.filter(Notification.title.contains(search) | Notification.raw_text.contains(search))
    if status:
        query = query.filter(Notification.status == status)
    
    notifications = query.order_by(Notification.received_time.desc()).offset(skip).limit(limit).all()
    return notifications

@app.get("/api/notifications/{notification_id}", response_model=NotificationResponse)
def get_notification(notification_id: int, db: Session = Depends(get_db)):
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notification

@app.put("/api/notifications/{notification_id}", response_model=NotificationResponse)
def update_notification(notification_id: int, notification: NotificationUpdate, db: Session = Depends(get_db)):
    db_notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not db_notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    update_data = notification.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_notification, key, value)
    
    db.commit()
    db.refresh(db_notification)
    return db_notification

@app.delete("/api/notifications/{notification_id}")
def delete_notification(notification_id: int, db: Session = Depends(get_db)):
    db_notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not db_notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    db.delete(db_notification)
    db.commit()
    return {"ok": True}

from schemas import NLPExtractRequest, NLPExtractResponse
import re

@app.post("/api/extract/", response_model=NLPExtractResponse)
def extract_information(request: NLPExtractRequest):
    text = request.text
    result = NLPExtractResponse(title=None, event_time=None, sender_dept=None, contact_person=None)
    
    # Extract time using jionlp
    try:
        time_res = jio.ner.extract_time(text)
        if time_res and len(time_res) > 0:
            # simple mapping of the first found time
            time_str = time_res[0]['time'][0]
            # Try to parse string to datetime (jionlp usually returns standard format like 2023-10-10 10:00:00)
            try:
                result.event_time = datetime.strptime(time_str, "%Y-%m-%d %H:%M:%S")
            except:
                pass
    except Exception as e:
        print(f"Error extracting time: {e}")

    # Extract organization/department
    try:
        org_res = jio.ner.extract_location(text)
        # using regex or custom rules for department names
        dept_pattern = r'[\u4e00-\u9fa5]+(省|市|区|局|厅|委|部|办)'
        match = re.search(dept_pattern, text)
        if match:
            result.sender_dept = match.group(0)
    except Exception:
        pass

    # Extract phone numbers / contacts
    try:
        phone_res = jio.parse_phone_number(text)
        if phone_res and len(phone_res) > 0:
            # Just grab the first found number
            result.contact_person = phone_res[0]
    except Exception:
        pass

    # Simple title extraction: first sentence or up to 20 chars
    title_match = re.split(r'[,。，\n]', text)
    if title_match:
        title = title_match[0].strip()
        result.title = title[:30] + "..." if len(title) > 30 else title

    return result
