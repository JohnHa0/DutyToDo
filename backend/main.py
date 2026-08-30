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

from schemas import NLPExtractRequest, NLPExtractResponse, SystemConfigSchema, SystemConfigResponse
import re

@app.get("/api/config/{key}", response_model=SystemConfigResponse)
def get_config(key: str, db: Session = Depends(get_db)):
    config = db.query(SystemConfig).filter(SystemConfig.key == key).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    return config

@app.post("/api/config/", response_model=SystemConfigResponse)
def set_config(config: SystemConfigSchema, db: Session = Depends(get_db)):
    db_config = db.query(SystemConfig).filter(SystemConfig.key == config.key).first()
    if db_config:
        db_config.value = config.value
    else:
        db_config = SystemConfig(key=config.key, value=config.value)
        db.add(db_config)
    
    db.commit()
    db.refresh(db_config)
    return db_config

@app.get("/api/config/", response_model=List[SystemConfigResponse])
def get_all_configs(db: Session = Depends(get_db)):
    return db.query(SystemConfig).all()


@app.post("/api/extract/", response_model=NLPExtractResponse)
def extract_information(request: NLPExtractRequest, db: Session = Depends(get_db)):
    text = request.text
    result = NLPExtractResponse(title=None, event_time=None, sender_dept=None, contact_person=None)
    
    # 1. Extract Time
    try:
        time_res = jio.ner.extract_time(text)
        if time_res and len(time_res) > 0:
            time_str = time_res[0]['time'][0]
            try:
                result.event_time = datetime.strptime(time_str, "%Y-%m-%d %H:%M:%S")
            except:
                pass
        
        # Fallback time extraction for casual texts like "9月4日", "下周三"
        if not result.event_time:
            time_pattern = r'(\d{1,2}月\d{1,2}日)|(下周[一二三四五六日])'
            t_match = re.search(time_pattern, text)
            if t_match:
                # We can't perfectly map "下周三" to datetime without complex logic, 
                # but Jionlp usually handles it. We just leave it for now or rely on jionlp
                pass
    except Exception as e:
        print(f"Error extracting time: {e}")

    # 2. Extract Organization/Department
    try:
        org_res = jio.ner.extract_location(text)
        # Use dynamic preset departments if available, otherwise regex
        preset_dept_config = db.query(SystemConfig).filter(SystemConfig.key == 'preset_departments').first()
        preset_depts = preset_dept_config.value if preset_dept_config else []
        
        found_dept = None
        for pd in preset_depts:
            if pd in text:
                found_dept = pd
                break
                
        if found_dept:
            result.sender_dept = found_dept
        else:
            # Extended regex for grassroots units
            dept_pattern = r'[\u4e00-\u9fa5]{2,10}(省|市|区|局|厅|委|部|办|处|科|中心|支队|大队)'
            match = re.search(dept_pattern, text)
            if match:
                result.sender_dept = match.group(0)
    except Exception:
        pass

    # 3. Extract Phone numbers / Contacts
    try:
        # Advanced regex for "Name: phone / short phone / landline"
        contact_pattern = r'(联系人[:：\s]*([\u4e00-\u9fa5]{2,4})?)?[:：\s]*([\d\-]{6,12})'
        matches = re.finditer(contact_pattern, text)
        phones = []
        name = ""
        for m in matches:
            if m.group(2) and not name:
                name = m.group(2)
            if m.group(3):
                phones.append(m.group(3))
        
        if name or phones:
            result.contact_person = f"{name} {' '.join(phones)}".strip()
        else:
            phone_res = jio.parse_phone_number(text)
            if phone_res and len(phone_res) > 0:
                result.contact_person = phone_res[0]
    except Exception:
        pass

    # Simple title extraction: first sentence or up to 30 chars
    title_match = re.split(r'[,。，\n]', text)
    if title_match:
        title = title_match[0].strip()
        result.title = title[:30] + "..." if len(title) > 30 else title

    return result
