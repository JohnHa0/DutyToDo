// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod models;
mod database;
mod commands;
mod logger;

fn main() {
    let _guard = logger::init_logger();
    // Initialize database on startup
    let _ = database::init_db();

    tauri::Builder::default()
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
