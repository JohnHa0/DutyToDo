use rusqlite::{Connection, Result};
use std::fs;
use std::path::PathBuf;

pub fn get_db_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("~"));
    let db_dir = home.join(".dutytodo").join("data");
    fs::create_dir_all(&db_dir).unwrap();
    db_dir.join("duty_todo.db")
}

pub fn init_db() -> Result<Connection> {
    let db_path = get_db_path();
    let conn = Connection::open(db_path)?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS system_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key VARCHAR(100) UNIQUE,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title VARCHAR(255),
            raw_text TEXT,
            received_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            event_time DATETIME,
            event_end DATETIME,
            sender_dept VARCHAR(100),
            contact_person VARCHAR(255),
            status VARCHAR(50) DEFAULT '待办理',
            routed_leaders VARCHAR(255),
            dept_heads VARCHAR(255),
            tags VARCHAR(255),
            priority VARCHAR(50) DEFAULT '普通',
            recorder VARCHAR(100),
            handler VARCHAR(100),
            attachments TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // Prepopulate default presets if they do not exist (or if they are empty arrays "[]")
    conn.execute(
        "INSERT INTO system_config (key, value) VALUES 
        ('preset_departments', '[\"信息保障科\",\"装备管理科\",\"作训科\",\"战勤计划科\",\"组织纪检科\",\"人力资源科\",\"情报科\"]')
        ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE value = '[]'",
        [],
    )?;

    conn.execute(
        "INSERT INTO system_config (key, value) VALUES 
        ('preset_tags', '[{\"name\":\"集会教育\",\"color\":\"#f50\"},{\"name\":\"业务工作\",\"color\":\"#2db7f5\"},{\"name\":\"装备保障\",\"color\":\"#87d068\"},{\"name\":\"后勤财务\",\"color\":\"#108ee9\"},{\"name\":\"信息系统\",\"color\":\"purple\"},{\"name\":\"材料上报\",\"color\":\"volcano\"},{\"name\":\"训练考核\",\"color\":\"magenta\"},{\"name\":\"值班值勤\",\"color\":\"#108ee9\"}]')
        ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE value = '[]'",
        [],
    )?;

    Ok(conn)
}
