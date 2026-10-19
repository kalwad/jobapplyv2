pub mod commands;
pub(crate) mod core;
pub(crate) mod owner;
pub use owner::create_engine;

#[cfg(test)]
#[path = "tests/boundary.rs"]
mod boundary_tests;
#[cfg(test)]
#[path = "tests/engine.rs"]
mod engine_tests;
#[cfg(test)]
#[path = "tests/tauri.rs"]
mod tauri_tests;

#[cfg(test)]
#[path = "tests/integration_bridge.rs"]
mod integration_bridge_tests;

#[cfg(test)]
#[path = "tests/http_integration.rs"]
mod http_integration_tests;
