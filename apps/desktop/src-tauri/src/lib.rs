mod api_client;
mod diagnostics;
#[cfg(test)]
#[path = "../build_support.rs"]
mod runtime_build_tests;
mod service;
use tauri::{Manager, webview::NewWindowResponse};

fn shell_navigation_allowed(url: &tauri::Url, development: bool) -> bool {
    if !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || !matches!(url.path(), "" | "/" | "/index.html")
    {
        return false;
    }
    match (url.scheme(), url.host_str(), url.port()) {
        ("tauri", Some("localhost"), None) | ("http", Some("tauri.localhost"), None) => true,
        ("http", Some("127.0.0.1"), Some(1420)) => development,
        _ => false,
    }
}

fn native_navigation_allowed(url: &tauri::Url) -> bool {
    shell_navigation_allowed(url, tauri::is_dev())
}

pub fn run() {
    let app = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            diagnostics::commands::read_service_diagnostics,
            diagnostics::commands::cancel_service_request
        ])
        .setup(|app| {
            let config =
                app.config().app.windows.first().ok_or_else(|| {
                    std::io::Error::other("Desktop window configuration is missing")
                })?;
            tauri::WebviewWindowBuilder::from_config(app, config)?
                .on_navigation(native_navigation_allowed)
                .on_new_window(|_, _| NewWindowResponse::Deny)
                .build()?;
            let runtime = service::configured_runtime(app.handle())
                .unwrap_or_else(|_| service::ConfiguredRuntime::unavailable());
            let service = service::ManagedService::new(runtime)
                .map_err(|_| std::io::Error::other("Local service configuration failed"))?;
            app.manage(service.clone());
            let diagnostics = diagnostics::create_engine(service.clone())
                .map_err(|_| std::io::Error::other("Native diagnostics configuration failed"))?;
            app.manage(diagnostics::commands::DiagnosticsState(diagnostics));
            let _ = service.start_background(app.handle());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Desktop app could not start");
    app.run(|app, event| match event {
        tauri::RunEvent::ExitRequested { api, .. } => app
            .state::<service::ManagedService>()
            .on_exit_requested(app, &api),
        tauri::RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::CloseRequested { api, .. },
            ..
        } if label == "main" => {
            let service = app.state::<service::ManagedService>();
            if !service.allow_exit() {
                api.prevent_close();
                service.request_shutdown(app);
            }
        }
        _ => {}
    });
}

#[cfg(test)]
mod tests {
    use super::shell_navigation_allowed;
    use tauri::Url;

    #[test]
    fn actual_protocol_mode_controls_the_development_origin() {
        let loopback = Url::parse("http://127.0.0.1:1420/").unwrap();
        assert_eq!(
            super::native_navigation_allowed(&loopback),
            tauri::is_dev(),
            "packaged debug builds must deny the development origin"
        );
        assert!(super::native_navigation_allowed(
            &Url::parse("tauri://localhost").unwrap()
        ));
        assert!(!super::native_navigation_allowed(
            &Url::parse("https://example.com/").unwrap()
        ));
    }

    #[test]
    fn packaged_shell_allows_only_the_local_entry_and_hash_routes() {
        for value in [
            "tauri://localhost",
            "tauri://localhost#diagnostics",
            "tauri://localhost/",
            "tauri://localhost/index.html",
            "tauri://localhost/index.html#diagnostics",
            "http://tauri.localhost/",
            "http://tauri.localhost/index.html#settings",
        ] {
            assert!(
                shell_navigation_allowed(&Url::parse(value).unwrap(), false),
                "{value}"
            );
        }
    }

    #[test]
    fn dev_origin_is_exact_and_cannot_be_used_by_a_packaged_shell() {
        for value in [
            "http://127.0.0.1:1420/",
            "http://127.0.0.1:1420/index.html#diagnostics",
        ] {
            let url = Url::parse(value).unwrap();
            assert!(shell_navigation_allowed(&url, true), "{value}");
            assert!(!shell_navigation_allowed(&url, false), "{value}");
        }
    }

    #[test]
    fn external_urls_authorities_and_non_shell_paths_are_denied() {
        for value in [
            "https://example.com/",
            "https://tauri.localhost/index.html",
            "tauri://example.com/index.html",
            "tauri://localhost.evil.test/index.html",
            "tauri://username@localhost/index.html",
            "tauri://localhost:1420/index.html",
            "tauri://localhost/index.html?route=diagnostics",
            "tauri://localhost/settings",
            "tauri://localhost/other.html",
            "tauri://localhost/%69ndex.html",
            "http://tauri.localhost:1420/index.html",
            "http://localhost:1420/",
            "http://127.0.0.1:1421/",
            "https://127.0.0.1:1420/",
            "http://127.0.0.1:1420/settings",
            "http://127.0.0.1:1420/?unsafe=1",
            "http://username:password@127.0.0.1:1420/",
            "file:///tmp/index.html",
            "data:text/html,test",
            "javascript:alert(1)",
            "about:blank",
        ] {
            let url = Url::parse(value).unwrap();
            assert!(!shell_navigation_allowed(&url, false), "packaged: {value}");
            assert!(
                !shell_navigation_allowed(&url, true),
                "development: {value}"
            );
        }
    }

    #[test]
    fn shell_config_exposes_only_two_version_reads_to_the_local_main_window() {
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let capability: serde_json::Value =
            serde_json::from_str(include_str!("../tests/fixtures/w01-main-shell.json")).unwrap();
        assert_eq!(config["app"]["withGlobalTauri"], false);
        assert_eq!(config["app"]["windows"].as_array().unwrap().len(), 1);
        assert_eq!(config["app"]["windows"][0]["create"], false);
        assert_eq!(config["app"]["windows"][0]["label"], "main");
        assert_eq!(config["app"]["windows"][0]["decorations"], true);
        assert_eq!(
            config["app"]["security"]["capabilities"],
            serde_json::json!(["main-shell"])
        );
        assert_eq!(capability["local"], true);
        assert_eq!(capability["windows"], serde_json::json!(["main"]));
        assert!(capability.get("remote").is_none());
        assert_eq!(
            capability["permissions"],
            serde_json::json!(["core:app:allow-version", "core:app:allow-tauri-version"])
        );
    }

    #[test]
    fn packaged_policy_blocks_network_frames_forms_and_dynamic_code() {
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let security = &config["app"]["security"];
        let csp = security["csp"].as_str().unwrap();
        for required in [
            "default-src 'none'",
            "script-src 'self'",
            "style-src 'self'",
            "connect-src ipc: http://ipc.localhost",
            "object-src 'none'",
            "base-uri 'none'",
            "form-action 'none'",
            "frame-src 'none'",
            "frame-ancestors 'none'",
        ] {
            assert!(
                csp.split(';')
                    .map(str::trim)
                    .any(|directive| directive == required),
                "{required}"
            );
        }
        for forbidden in [
            "*",
            "unsafe-inline",
            "unsafe-eval",
            "127.0.0.1",
            "https:",
            "ws:",
            "wss:",
        ] {
            assert!(!csp.contains(forbidden), "{forbidden}");
        }
        assert!(
            security
                .get("dangerousDisableAssetCspModification")
                .is_none()
        );
        assert!(security.get("dangerousRemoteDomainIpcAccess").is_none());
        assert_eq!(config["build"]["devUrl"], "http://127.0.0.1:1420");
        assert_eq!(config["build"]["frontendDist"], "../dist");
    }
}
