from fastapi import FastAPI, Depends, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
import os

from models import Notification, StatusEnum, PriorityEnum, Base, SystemConfig
from database import engine, get_db, init_db
import jionlp as jio

# Initialize DB
init_db()

# Migration: Add handler column if not exists
from sqlalchemy import text
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE notifications ADD COLUMN handler VARCHAR(100)"))
        conn.commit()
except Exception:
    pass # Column likely already exists


# Initialize LLM Manager
try:
    from llm_service import LLMManager
    db = next(get_db())
    enabled_conf = db.query(SystemConfig).filter(SystemConfig.key == 'llm_enabled').first()
    path_conf = db.query(SystemConfig).filter(SystemConfig.key == 'llm_model_path').first()
    is_enabled = enabled_conf and enabled_conf.value == "true"
    model_path = path_conf.value if path_conf else ""
    LLMManager.get_instance().configure(is_enabled, model_path)
except Exception as e:
    print(f"Error loading LLM config on startup: {e}")

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
import platform
import subprocess

@app.get("/api/config/select_file")
def select_local_file():
    """Opens a native OS file dialog and returns the selected path"""
    system = platform.system()
    path = ""
    try:
        if system == "Darwin": # macOS
            script = 'POSIX path of (choose file with prompt "Select LLM Model" of type {"gguf", "bin"})'
            result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True)
            if result.returncode == 0:
                path = result.stdout.strip()
        elif system == "Windows":
            # Just a basic powershell fallback for Windows if needed
            script = (
                "[System.Reflection.Assembly]::LoadWithPartialName('System.windows.forms') | Out-Null;"
                "$f = New-Object System.Windows.Forms.OpenFileDialog;"
                "$f.Filter = 'Model Files (*.gguf)|*.gguf|All Files (*.*)|*.*';"
                "$f.ShowHelp = $true;"
                "if($f.ShowDialog() -eq 'OK'){ $f.FileName }"
            )
            result = subprocess.run(['powershell', '-Command', script], capture_output=True, text=True)
            if result.returncode == 0:
                path = result.stdout.strip()
    except Exception as e:
        print(f"File dialog error: {e}")
    
    return {"path": path}

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

    if config.key in ["llm_enabled", "llm_model_path"]:
        try:
            from llm_service import LLMManager
            enabled_conf = db.query(SystemConfig).filter(SystemConfig.key == 'llm_enabled').first()
            path_conf = db.query(SystemConfig).filter(SystemConfig.key == 'llm_model_path').first()
            
            enabled_val = False
            if enabled_conf and enabled_conf.value:
                try:
                    val = json.loads(enabled_conf.value) if isinstance(enabled_conf.value, str) else enabled_conf.value
                    enabled_val = str(val).lower() == "true"
                except:
                    enabled_val = str(enabled_conf.value).lower() == "true"
            
            model_path = ""
            if path_conf and path_conf.value:
                try:
                    val = json.loads(path_conf.value) if isinstance(path_conf.value, str) else path_conf.value
                    model_path = str(val)
                except:
                    model_path = str(path_conf.value)
            
            LLMManager.get_instance().configure(enabled_val, model_path)
        except Exception as e:
            print(f"Error initializing LLM in set_config: {e}")

    return db_config

@app.post("/api/extract/", response_model=NLPExtractResponse)
def extract_information(request: NLPExtractRequest, db: Session = Depends(get_db)):
    text = request.text
    result = NLPExtractResponse(title=None, event_time=None, event_end=None, sender_dept=None, contact_person=None)
    
    # Try LLM First
    from llm_service import LLMManager
    llm = LLMManager.get_instance()
    if llm.is_ready():
        parsed = llm.extract_information(text)
        if parsed:
            result.title = parsed.get("title")
            result.sender_dept = parsed.get("sender_dept")
            result.contact_person = parsed.get("contact_person")
            
            try:
                if parsed.get("event_start"):
                    result.event_time = datetime.strptime(parsed["event_start"], "%Y-%m-%d %H:%M:%S")
                if parsed.get("event_end"):
                    result.event_end = datetime.strptime(parsed["event_end"], "%Y-%m-%d %H:%M:%S")
                elif result.event_time:
                    # If LLM only provides start, set end to start
                    result.event_end = result.event_time
            except:
                pass
            
            # Fallback if LLM failed to extract a good title
            if not result.title:
                result.title = text[:15] + "..."
            
            return result

    # 1. Extract Time (Jionlp fallback)
    try:
        time_res = jio.ner.extract_time(text)
        if time_res and len(time_res) > 0:
            detail = time_res[0].get('detail', {})
            times = detail.get('time', [])
            
            if len(times) > 0:
                try:
                    result.event_time = datetime.strptime(times[0], "%Y-%m-%d %H:%M:%S")
                except:
                    pass
            if len(times) > 1 and time_res[0].get('type') == 'time_span':
                try:
                    result.event_end = datetime.strptime(times[1], "%Y-%m-%d %H:%M:%S")
                except:
                    pass
        
        # Fallback time extraction for casual texts like "9月4日", "下周三"
        if not result.event_time:
            time_pattern = r'(\d{1,2}月\d{1,2}日(至\d{1,2}月\d{1,2}日)?)|(下周[一二三四五六日])'
            t_match = re.search(time_pattern, text)
            if t_match:
                pass # Jionlp is usually good enough, fallback not fully implemented
                
        # If event_time exists but event_end does not, set event_end to event_time
        if result.event_time and not result.event_end:
            result.event_end = result.event_time
            
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

    # Smart title extraction / summarization
    # 1. Remove contact info and time info to get the core action
    clean_text = text
    if result.event_time:
        clean_text = re.sub(r'\d{1,2}月\d{1,2}日', '', clean_text)
    if result.contact_person:
        clean_text = re.sub(r'联系人.*', '', clean_text)
    
    # 2. Extract the first meaningful sentence/phrase
    sentences = re.split(r'[，。！？,!?\n；;]', clean_text)
    meaningful = [s.strip() for s in sentences if len(s.strip()) > 3]
    
    if meaningful:
        title = meaningful[0]
        # Remove common prefixes like '通知：', 'xx科通知'
        title = re.sub(r'^.*?通知[:：]', '', title).strip()
        result.title = title[:20] + "..." if len(title) > 20 else title
    else:
        result.title = text[:15] + "..."

    return result


@app.get("/api/db/export")
def export_database():
    from fastapi.responses import FileResponse
    import os
    from database import DB_DIR
    db_path = os.path.join(DB_DIR, 'duty_todo.db')
    if os.path.exists(db_path):
        return FileResponse(db_path, filename="duty_todo_backup.db")
    raise HTTPException(status_code=404, detail="Database file not found")

@app.post("/api/db/clear")
def clear_database(db: Session = Depends(get_db)):
    from sqlalchemy import text
    try:
        db.execute(text("DELETE FROM notifications"))
        db.commit()
        return {"message": "Database cleared successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    import shutil
    import uuid
    safe_filename = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"uid": safe_filename, "name": file.filename, "status": "done", "url": f"/api/download/{safe_filename}"}

@app.get("/api/download/{filename}")
def download_file(filename: str):
    from fastapi.responses import FileResponse
    file_path = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(file_path):
        return FileResponse(file_path, filename=filename.split('_', 1)[-1])
    raise HTTPException(status_code=404)


@app.get("/api/config/open_folder")
def open_folder():
    import subprocess
    import sys
    try:
        if sys.platform == "darwin":
            subprocess.run(["open", UPLOAD_DIR])
        elif sys.platform == "win32":
            os.startfile(UPLOAD_DIR)
        else:
            subprocess.run(["xdg-open", UPLOAD_DIR])
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
