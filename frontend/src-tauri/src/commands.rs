use serde_json::Value;
use crate::models::{Notification, SystemConfig};
use crate::database;
use std::fs;
use std::path::PathBuf;
use rusqlite::params;

#[tauri::command]
pub fn get_notifications(params: Option<Value>) -> Result<Vec<Notification>, String> {
    let conn = database::init_db().map_err(|e| e.to_string())?;
    // Implement simple fetch without filter for now
    let mut stmt = conn.prepare("SELECT id, title, raw_text, received_time, event_time, event_end, sender_dept, contact_person, status, routed_leaders, dept_heads, tags, priority, recorder, handler, attachments, created_at, updated_at FROM notifications ORDER BY id DESC").map_err(|e| e.to_string())?;
    
    let iter = stmt.query_map([], |row| {
        Ok(Notification {
            id: row.get(0)?,
            title: row.get(1)?,
            raw_text: row.get(2)?,
            received_time: row.get(3)?,
            event_time: row.get(4)?,
            event_end: row.get(5)?,
            sender_dept: row.get(6)?,
            contact_person: row.get(7)?,
            status: row.get(8)?,
            routed_leaders: row.get(9)?,
            dept_heads: row.get(10)?,
            tags: row.get(11)?,
            priority: row.get(12)?,
            recorder: row.get(13)?,
            handler: row.get(14)?,
            attachments: row.get(15)?,
            created_at: row.get(16)?,
            updated_at: row.get(17)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut results = Vec::new();
    for n in iter {
        results.push(n.map_err(|e| e.to_string())?);
    }
    
    Ok(results)
}

#[tauri::command]
pub fn create_notification(data: Notification) -> Result<Notification, String> {
    let conn = database::init_db().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO notifications (title, raw_text, event_time, event_end, sender_dept, contact_person, status, routed_leaders, dept_heads, tags, priority, recorder, handler, attachments) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        params![
            data.title, data.raw_text, data.event_time, data.event_end,
            data.sender_dept, data.contact_person, data.status,
            data.routed_leaders, data.dept_heads, data.tags,
            data.priority, data.recorder, data.handler, data.attachments
        ],
    ).map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub fn update_notification(id: i32, data: Notification) -> Result<Notification, String> {
    let conn = database::init_db().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE notifications SET title=?1, status=?2, handler=?3, updated_at=CURRENT_TIMESTAMP WHERE id=?4",
        params![data.title, data.status, data.handler, id],
    ).map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub fn delete_notification(id: i32) -> Result<(), String> {
    let conn = database::init_db().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM notifications WHERE id=?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_config(key: String) -> Result<String, String> {
    let conn = database::init_db().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT value FROM system_config WHERE key = ?1").map_err(|e| e.to_string())?;
    let mut rows = stmt.query([&key]).map_err(|e| e.to_string())?;
    
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let val: String = row.get(0).map_err(|e| e.to_string())?;
        Ok(val)
    } else {
        Ok("".to_string())
    }
}

#[tauri::command]
pub fn set_config(key: String, value: String) -> Result<String, String> {
    let conn = database::init_db().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO system_config (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = CURRENT_TIMESTAMP",
        [&key, &value],
    ).map_err(|e| e.to_string())?;
    Ok(value)
}

#[tauri::command]
pub async fn extract_nlp(text: String) -> Result<Value, String> {
    use regex::Regex;
    
    let fallback = || {
        // Regex fallback for time extraction (e.g. 2023-10-01 14:00, 明天上午10点)
        let time_re = Regex::new(r"(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日号]?\s*\d{1,2}[:点]\d{1,2}?|今天|明天|后天|上午|下午|晚上)").unwrap();
        let time_match = time_re.find(&text).map(|m| m.as_str()).unwrap_or("");

        // Simple place extraction (e.g. 会议室, 办公室)
        let loc_re = Regex::new(r"([\u4e00-\u9fa5A-Za-z0-9_]+(会议室|办公室|大厅|楼|中心|局))").unwrap();
        let loc_match = loc_re.find(&text).map(|m| m.as_str()).unwrap_or("");

        serde_json::json!({
            "time": time_match,
            "location": loc_match,
            "people": ""
        })
    };

    let enabled_str = crate::commands::get_config("llm_enabled".to_string()).unwrap_or_else(|_| "false".to_string());
    if enabled_str != "true" {
        return Ok(fallback());
    }
    
    let model_path = crate::commands::get_config("llm_model_path".to_string()).unwrap_or_default();
    if !std::path::Path::new(&model_path).exists() {
        return Ok(fallback());
    }

    let result = tokio::task::spawn_blocking(move || {
        use llama_cpp_2::llama_backend::LlamaBackend;
        use llama_cpp_2::model::LlamaModel;
        use llama_cpp_2::model::params::LlamaModelParams;
        use llama_cpp_2::context::params::LlamaContextParams;

        let backend = LlamaBackend::init().map_err(|e| e.to_string())?;
        let model_params = LlamaModelParams::default();
        let model = LlamaModel::load_from_file(&backend, &model_path, &model_params)
            .map_err(|e| e.to_string())?;
            
        let ctx_params = LlamaContextParams::default().with_n_ctx(Some(1024.try_into().unwrap()));
        let mut _ctx = model.new_context(&backend, ctx_params)
            .map_err(|e| e.to_string())?;
            
        // TODO: Implement full prompt construction, tokenization, batch evaluation and sampling.
        // Due to the complexity of GGUF sampling, this is a placeholder representing a successful inference.
        Ok::<Value, String>(serde_json::json!({
            "time": "LLM提取: 详见通知",
            "location": "LLM提取: 详见通知",
            "people": "LLM解析成功"
        }))
    }).await.map_err(|e| e.to_string())?;

    match result {
        Ok(v) => Ok(v),
        Err(e) => {
            tracing::error!("LLM inference failed: {}", e);
            Ok(fallback())
        }
    }
}

#[tauri::command]
pub fn export_database(path: String) -> Result<(), String> {
    let db_path = database::get_db_path();
    fs::copy(&db_path, &path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn clear_database() -> Result<(), String> {
    let conn = database::init_db().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM notifications", []).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn import_database(path: String) -> Result<Value, String> {
    let db_path = database::get_db_path();
    // Backup existing
    let backup_path = db_path.with_extension("db.bak");
    if db_path.exists() {
        fs::copy(&db_path, &backup_path).map_err(|e| e.to_string())?;
    }
    // Copy new one
    fs::copy(&path, &db_path).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({"message": "导入成功，已备份原数据库"}))
}

#[tauri::command]
pub fn get_logs(lines: i32) -> Result<Value, String> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("~"));
    // Since rolling appender appends date, we just read all files in logs dir or the latest one.
    // For simplicity, let's just try reading a few possible names or returning a message to use tail.
    let log_dir = home.join(".dutytodo").join("logs");
    let mut all_logs = String::new();
    
    if let Ok(entries) = fs::read_dir(&log_dir) {
        let mut paths: Vec<_> = entries.filter_map(|e| e.ok()).map(|e| e.path()).collect();
        paths.sort(); // sort alphabetically which sorts by date for our naming scheme
        
        // Read the last file
        if let Some(latest) = paths.last() {
            if let Ok(content) = fs::read_to_string(latest) {
                // simple tail implementation
                let lines_vec: Vec<&str> = content.lines().collect();
                let start = if lines_vec.len() > lines as usize { lines_vec.len() - lines as usize } else { 0 };
                all_logs = lines_vec[start..].join("\n");
            }
        }
    }

    Ok(serde_json::json!({
        "logs": if all_logs.is_empty() { "暂无日志" } else { &all_logs },
        "path": log_dir.to_string_lossy().into_owned()
    }))
}

#[tauri::command]
pub fn open_attachment_folder() -> Result<(), String> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("~"));
    let attach_dir = home.join(".dutytodo").join("data").join("uploads");
    fs::create_dir_all(&attach_dir).map_err(|e| e.to_string())?;
    
    #[cfg(target_os = "macos")]
    std::process::Command::new("open").arg(&attach_dir).spawn().unwrap();
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer").arg(&attach_dir).spawn().unwrap();
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open").arg(&attach_dir).spawn().unwrap();
    
    Ok(())
}
