use rusqlite::{params, Connection, Result};
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

    Ok(conn)
}
