from sqlalchemy import Column, Integer, String, DateTime, Text, Enum, JSON
from sqlalchemy.orm import declarative_base
import enum
from datetime import datetime

Base = declarative_base()

class StatusEnum(str, enum.Enum):
    PENDING = "待办理"
    PROCESSING = "正在办理"
    COMPLETED = "已办结"

class PriorityEnum(str, enum.Enum):
    NORMAL = "普通"
    IMPORTANT = "重要"
    URGENT = "紧急"

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), index=True)
    raw_text = Column(Text)
    received_time = Column(DateTime, default=datetime.now)
    event_time = Column(DateTime, nullable=True)
    event_end = Column(DateTime, nullable=True)
    sender_dept = Column(String(100), index=True, nullable=True)
    contact_person = Column(String(255), nullable=True)
    status = Column(Enum(StatusEnum), default=StatusEnum.PENDING, index=True)
    routed_leaders = Column(String(255), nullable=True)
    dept_heads = Column(String(255), nullable=True)
    tags = Column(String(255), nullable=True) # Stored as comma separated or JSON string
    priority = Column(Enum(PriorityEnum), default=PriorityEnum.NORMAL)
    recorder = Column(String(100), nullable=True)
    attachments = Column(JSON, nullable=True) # Stored as JSON array
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

class SystemConfig(Base):
    __tablename__ = "system_config"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True)
    value = Column(JSON)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
