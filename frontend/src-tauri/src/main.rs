// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod models;
mod database;
mod commands;
mod logger;
mod llm;

fn main() {
    let _guard = logger::init_logger();
    // Initialize database on startup
    let _ = database::init_db();

    // Start LLM Thread and get Sender
    let llm_tx = llm::start_llm_thread();

    // Preload model on startup if enabled
    if let Ok(enabled) = commands::get_config("llm_enabled".to_string()) {
        if enabled == "true" {
            if let Ok(path) = commands::get_config("llm_model_path".to_string()) {
                if std::path::Path::new(&path).exists() {
                    let (tx, _rx) = tokio::sync::oneshot::channel();
                    let _ = llm_tx.send(llm::LlmRequest::Reload { model_path: path, reply: tx });
                }
            }
        }
    }

    tauri::Builder::default()
        .manage(llm::LlmState {
            tx: std::sync::Mutex::new(Some(llm_tx)),
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_notifications,
            commands::create_notification,
            commands::update_notification,
            commands::delete_notification,
            commands::get_config,
            commands::set_config,
            commands::extract_nlp,
            commands::export_database,
            commands::clear_database,
            commands::import_database,
            commands::get_logs,
            commands::open_attachment_folder,
            commands::upload_file,
            commands::open_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
