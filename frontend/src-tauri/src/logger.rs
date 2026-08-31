use std::path::PathBuf;
use tracing_subscriber::fmt::writer::MakeWriterExt;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

pub fn init_logger() -> Option<tracing_appender::non_blocking::WorkerGuard> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("~"));
    let log_dir = home.join(".dutytodo").join("logs");
    std::fs::create_dir_all(&log_dir).ok()?;

    let file_appender = tracing_appender::rolling::daily(log_dir, "backend.log");
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(
            tracing_subscriber::fmt::layer()
                .with_writer(non_blocking.and(std::io::stdout))
        )
        .init();

    tracing::info!("Logger initialized successfully.");
    Some(guard)
}
