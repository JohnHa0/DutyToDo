use serde_json::Value;
use crate::models::Notification;
use crate::database;
use std::fs;
use std::path::PathBuf;
use rusqlite::params;

#[tauri::command]
pub fn get_notifications(params: Option<Value>) -> Result<Vec<Notification>, String> {
    let conn = database::init_db().map_err(|e| e.to_string())?;
    let mut base_query = "SELECT id, title, raw_text, received_time, event_time, event_end, sender_dept, contact_person, status, routed_leaders, dept_heads, tags, priority, recorder, handler, attachments, created_at, updated_at FROM notifications WHERE 1=1".to_string();
    
    let mut sql_params: Vec<rusqlite::types::Value> = Vec::new();
    
    if let Some(p) = params {
        if let Some(search) = p.get("search").and_then(|v| v.as_str()) {
            if !search.trim().is_empty() {
                base_query.push_str(" AND (title LIKE ? OR raw_text LIKE ? OR sender_dept LIKE ?)");
                let like_str = format!("%{}%", search);
                sql_params.push(rusqlite::types::Value::Text(like_str.clone()));
                sql_params.push(rusqlite::types::Value::Text(like_str.clone()));
                sql_params.push(rusqlite::types::Value::Text(like_str));
            }
        }
        if let Some(status) = p.get("status").and_then(|v| v.as_str()) {
            if !status.trim().is_empty() {
                base_query.push_str(" AND status = ?");
                sql_params.push(rusqlite::types::Value::Text(status.to_string()));
            }
        }
    }
    
    base_query.push_str(" ORDER BY id DESC");
    
    let mut stmt = conn.prepare(&base_query).map_err(|e| e.to_string())?;
    
    let iter = stmt.query_map(rusqlite::params_from_iter(sql_params), |row| {
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
    
    let local_received_time = data.received_time.clone().unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string());
    
    conn.execute(
        "INSERT INTO notifications (title, raw_text, received_time, event_time, event_end, sender_dept, contact_person, status, routed_leaders, dept_heads, tags, priority, recorder, handler, attachments) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        params![
            data.title, data.raw_text, local_received_time, data.event_time, data.event_end,
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
    
    // Fetch old attachments to compare
    let mut stmt = conn.prepare("SELECT attachments FROM notifications WHERE id=?1").map_err(|e| e.to_string())?;
    let mut rows = stmt.query([id]).map_err(|e| e.to_string())?;
    let mut old_urls: Vec<String> = Vec::new();
    if let Some(row) = rows.next().unwrap_or(None) {
        if let Ok(Some(old_atts)) = row.get::<_, Option<String>>(0) {
            if let Ok(old_json) = serde_json::from_str::<serde_json::Value>(&old_atts) {
                if let Some(arr) = old_json.as_array() {
                    for f in arr {
                        if let Some(url) = f.get("url").and_then(|u| u.as_str()) {
                            old_urls.push(url.to_string());
                        }
                    }
                }
            }
        }
    }

    // Collect new attachments
    let mut new_urls: std::collections::HashSet<String> = std::collections::HashSet::new();
    if let Some(ref new_atts) = data.attachments {
        if let Ok(new_json) = serde_json::from_str::<serde_json::Value>(new_atts) {
            if let Some(arr) = new_json.as_array() {
                for f in arr {
                    if let Some(url) = f.get("url").and_then(|u| u.as_str()) {
                        new_urls.insert(url.to_string());
                    }
                }
            }
        }
    }

    // Delete physical files that are no longer referenced
    for url in old_urls {
        if !new_urls.contains(&url) {
            let _ = std::fs::remove_file(&url); // silently ignore errors (e.g. file already gone)
        }
    }

    conn.execute(
        "UPDATE notifications SET 
            title=?1, raw_text=?2, received_time=?3, event_time=?4, event_end=?5, 
            sender_dept=?6, contact_person=?7, status=?8, routed_leaders=?9, 
            dept_heads=?10, tags=?11, priority=?12, handler=?13, attachments=?14, 
            updated_at=CURRENT_TIMESTAMP 
         WHERE id=?15",
        params![
            data.title, data.raw_text, data.received_time, data.event_time, data.event_end,
            data.sender_dept, data.contact_person, data.status, data.routed_leaders,
            data.dept_heads, data.tags, data.priority, data.handler, data.attachments,
            id
        ],
    ).map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub fn delete_notification(id: i32) -> Result<(), String> {
    let conn = database::init_db().map_err(|e| e.to_string())?;
    
    // Fetch and delete all attachments
    let mut stmt = conn.prepare("SELECT attachments FROM notifications WHERE id=?1").map_err(|e| e.to_string())?;
    let mut rows = stmt.query([id]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().unwrap_or(None) {
        if let Ok(Some(old_atts)) = row.get::<_, Option<String>>(0) {
            if let Ok(old_json) = serde_json::from_str::<serde_json::Value>(&old_atts) {
                if let Some(arr) = old_json.as_array() {
                    for f in arr {
                        if let Some(url) = f.get("url").and_then(|u| u.as_str()) {
                            let _ = std::fs::remove_file(url);
                        }
                    }
                }
            }
        }
    }

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
pub fn set_config(key: String, value: String, state: tauri::State<'_, crate::llm::LlmState>) -> Result<String, String> {
    let conn = database::init_db().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO system_config (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = CURRENT_TIMESTAMP",
        [&key, &value],
    ).map_err(|e| e.to_string())?;

    if key == "llm_model_path" {
        if let Ok(enabled) = get_config("llm_enabled".to_string()) {
            if enabled == "true" {
                if let Some(tx) = state.tx.lock().unwrap().as_ref().cloned() {
                    let (reply_tx, _reply_rx) = tokio::sync::oneshot::channel();
                    let _ = tx.send(crate::llm::LlmRequest::Reload { model_path: value.clone(), reply: reply_tx });
                }
            }
        }
    } else if key == "llm_enabled" && value == "true" {
        if let Ok(path) = get_config("llm_model_path".to_string()) {
            if std::path::Path::new(&path).exists() {
                if let Some(tx) = state.tx.lock().unwrap().as_ref().cloned() {
                    let (reply_tx, _reply_rx) = tokio::sync::oneshot::channel();
                    let _ = tx.send(crate::llm::LlmRequest::Reload { model_path: path, reply: reply_tx });
                }
            }
        }
    }

    Ok(value)
}

#[tauri::command]
pub async fn extract_nlp(text: String, state: tauri::State<'_, crate::llm::LlmState>) -> Result<Value, String> {
    use regex::Regex;
    
    let fallback = || {
        let time_re = Regex::new(r"(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日号]?\s*\d{1,2}[:点]\d{1,2}?)").unwrap();
        // If regex finds a time, we try to extract it. To keep it simple, we just extract standard-looking times.
        let time_match = time_re.find(&text).map(|m| {
            let s = m.as_str().replace("年","-").replace("月","-").replace("日","").replace("号","").replace("点",":");
            s
        }).unwrap_or_else(|| "".to_string());

        let dept_re = Regex::new(r"([\u4e00-\u9fa5]{2,10}(办公厅|局|委|办|处|科))").unwrap();
        let dept_match = dept_re.find(&text).map(|m| m.as_str()).unwrap_or("");

        let contact_re = Regex::new(r"(联系人[:：\s]*([\u4e00-\u9fa5]{2,4})|电话[:：\s]*(\d{8,11}))").unwrap();
        let contact_match = contact_re.find(&text).map(|m| m.as_str()).unwrap_or("");

        serde_json::json!({
            "title": "",
            "event_time": if time_match.is_empty() { None } else { Some(time_match.clone()) },
            "event_end": if time_match.is_empty() { None } else { Some(time_match) },
            "sender_dept": dept_match,
            "contact_person": contact_match,
            "tags": ""
        })
    };

    let enabled_str = crate::commands::get_config("llm_enabled".to_string()).unwrap_or_else(|_| "false".to_string());
    if enabled_str != "true" {
        return Ok(fallback()); // Return fallback silently if not enabled
    }

    let default_prompt = "你是一个专业的政府机关公文提取助手。请从以下通知中提取关键信息，并严格输出合法的 JSON 格式。如果找不到对应信息，请返回空字符串。\n要求输出的JSON字段及要求：\n- title: 提炼通知核心内容和需要执行的具体任务，生成一句话摘要作为通知标题\n- event_time: 智能推断开始或截止时间，务必推断出年份和具体日期 (YYYY-MM-DD HH:mm:ss 格式)\n- event_end: 结束时间 (若只有一个时间，与 event_time 保持一致)\n- sender_dept: 发件/主办部门。如果通知中未明确说明，请根据内容智能推测，**必须且只能**从以下列表中选择最相关的一个：[信息保障科, 装备管理科, 作训科, 战勤计划科, 组织纪检科, 人力资源科, 情报科]。若都不匹配请留空，绝不要输出问号或其它字符。\n- routed_dept: 下发科室/承办科室。即该通知要求哪个科室去执行或参加。若无，返回空\n- tags: 业务标签。请根据通知内容智能推测，**必须且只能**从以下预设标签中选择相关的（可多选，逗号分隔）：[集会教育, 业务工作, 装备保障, 后勤财务, 信息系统, 材料上报, 训练考核, 值班值勤]。若都不匹配请留空，绝不要输出问号或未知等其它字符。\n- contact_person: 联系人与电话".to_string();
    let sys_prompt_base = crate::commands::get_config("llm_system_prompt".to_string()).unwrap_or_else(|_| "".to_string());
    let sys_prompt_base = if sys_prompt_base.trim().is_empty() { default_prompt } else { sys_prompt_base };
    
    // Inject current date context so LLM can infer relative dates like "本周五"
    let current_time = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let sys_prompt = format!("{}\n(注意：当前系统时间为 {}，请以此为基准推算“本周”、“明天”等相对日期。时间必须严格输出为YYYY-MM-DD HH:mm:ss格式)", sys_prompt_base, current_time);

    let tx = {
        let lock = state.tx.lock().unwrap();
        lock.as_ref().cloned()
    };

    if let Some(tx) = tx {
        let (reply_tx, reply_rx) = tokio::sync::oneshot::channel();
        if tx.send(crate::llm::LlmRequest::Extract { text, sys_prompt, reply: reply_tx }).is_ok() {
            match reply_rx.await {
                Ok(Ok(val)) => return Ok(val),
                Ok(Err(e)) => return Err(e),
                Err(_) => return Err("与大模型后台引擎通信失败".to_string()),
            }
        }
    }

    Err("大模型引擎未启动或尚未加载完成".to_string())
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
pub fn upload_file(name: String, data: Vec<u8>) -> Result<String, String> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("~"));
    let month_str = chrono::Local::now().format("%Y-%m").to_string();
    let attach_dir = home.join(".dutytodo").join("attachments").join(&month_str);
    
    fs::create_dir_all(&attach_dir).map_err(|e| e.to_string())?;
    
    // Ensure filename uniqueness
    let file_path = attach_dir.join(&name);
    let mut final_path = file_path.clone();
    let mut counter = 1;
    while final_path.exists() {
        let stem = file_path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
        let ext = file_path.extension().and_then(|s| s.to_str()).unwrap_or("");
        let new_name = if ext.is_empty() { format!("{}_{}", stem, counter) } else { format!("{}_{}.{}", stem, counter, ext) };
        final_path = attach_dir.join(new_name);
        counter += 1;
    }
    
    fs::write(&final_path, data).map_err(|e| e.to_string())?;
    
    // Return a URI-like string for local path
    Ok(final_path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn open_file(path: String) -> Result<(), String> {
    if !PathBuf::from(&path).exists() {
        return Err("文件不存在或已被删除".to_string());
    }
    
    #[cfg(target_os = "macos")]
    std::process::Command::new("open").arg(&path).spawn().unwrap();
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer").arg(&path).spawn().unwrap();
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open").arg(&path).spawn().unwrap();
    
    Ok(())
}

#[tauri::command]
pub fn open_attachment_folder() -> Result<(), String> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("~"));
    let attach_dir = home.join(".dutytodo").join("attachments");
    fs::create_dir_all(&attach_dir).map_err(|e| e.to_string())?;
    
    #[cfg(target_os = "macos")]
    std::process::Command::new("open").arg(&attach_dir).spawn().unwrap();
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer").arg(&attach_dir).spawn().unwrap();
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open").arg(&attach_dir).spawn().unwrap();
    
    Ok(())
}
