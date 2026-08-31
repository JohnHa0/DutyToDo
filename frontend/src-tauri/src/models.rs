use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Notification {
    pub id: Option<i32>,
    pub title: String,
    pub raw_text: Option<String>,
    pub received_time: Option<String>,
    pub event_time: Option<String>,
    pub event_end: Option<String>,
    pub sender_dept: Option<String>,
    pub contact_person: Option<String>,
    pub status: String, // 待办理, 正在办理, 已办结
    pub routed_leaders: Option<String>,
    pub dept_heads: Option<String>,
    pub tags: Option<String>,
    pub priority: String, // 普通, 重要, 紧急
    pub recorder: Option<String>,
    pub handler: Option<String>,
    pub attachments: Option<String>, // JSON string
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemConfig {
    pub id: Option<i32>,
    pub key: String,
    pub value: String, // JSON string
    pub updated_at: Option<String>,
}
