from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional, Any
from models import StatusEnum, PriorityEnum

class NotificationBase(BaseModel):
    title: str
    raw_text: Optional[str] = None
    event_time: Optional[datetime] = None
    sender_dept: Optional[str] = None
    contact_person: Optional[str] = None
    status: StatusEnum = StatusEnum.PENDING
    routed_leaders: Optional[str] = None
    dept_heads: Optional[str] = None
    tags: Optional[str] = None
    priority: PriorityEnum = PriorityEnum.NORMAL
    recorder: Optional[str] = None
    attachments: Optional[Any] = None

class NotificationCreate(NotificationBase):
    pass

class NotificationUpdate(NotificationBase):
    title: Optional[str] = None

class NotificationResponse(NotificationBase):
    id: int
    received_time: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class NLPExtractRequest(BaseModel):
    text: str

class NLPExtractResponse(BaseModel):
    event_time: Optional[datetime] = None
    sender_dept: Optional[str] = None
    contact_person: Optional[str] = None
    title: Optional[str] = None
