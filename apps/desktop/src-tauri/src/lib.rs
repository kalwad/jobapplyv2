mod api_client;
mod diagnostics;
#[cfg(test)]
#[path = "../build_support.rs"]
mod runtime_build_tests;
mod service;
pub use service::{
    ManagedService,
    native_paths::{
        NativePathService, PathFailure, PathOutcome, PathRequest, PathResolutionFields, PathRole,
        PathState, Reason, Scope,
    },
};
// Native-only traits used by the typed process policy; no renderer commands.
pub use service::native_paths::{
    LocalProcessSelection, ProcessProfile, TerminationIntent, WorkPermit, diagnostic_reason,
    request_owned_termination,
};
pub use service::{Bootstrap, Clock, OwnedProcess, ReadyFrame, ServiceIdentity, SupervisorError};

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

fn install_shell_quit_menu(app: &tauri::App) -> tauri::Result<()> {
    // Keep the framework's macOS application menu. This constant branch leaves
    // the non-Mac menu API type-checked by the common desktop build as well.
    if cfg!(target_os = "macos") {
        return Ok(());
    }
    use tauri::menu::{Menu, MenuItem, Submenu};
    let quit = MenuItem::with_id(app, "desktop-quit", "Quit", true, Some("Ctrl+Q"))?;
    let file = Submenu::with_items(app, "File", true, &[&quit])?;
    app.set_menu(Menu::with_items(app, &[&file])?)?;
    Ok(())
}

/// The File menu's exact Quit chord: a first Ctrl+Q key-down with neither Alt
/// nor Shift held.
#[cfg_attr(not(windows), allow(dead_code))]
fn is_quit_accelerator(
    key_down: bool,
    virtual_key: u32,
    repeat: bool,
    ctrl: bool,
    alt: bool,
    shift: bool,
) -> bool {
    key_down && virtual_key == u32::from(b'Q') && !repeat && ctrl && !alt && !shift
}

/// WebView2 keeps keyboard focus in its own browser process, so the native
/// menu's Ctrl+Q accelerator never reaches this process's TranslateAcceleratorW
/// (measured on hosted Windows, KI-0158). Route exactly that chord to the same
/// shutdown as File→Quit; every other key stays with WebView2.
#[cfg(windows)]
fn forward_quit_accelerator(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    let app = window.app_handle().clone();
    window.with_webview(move |webview| {
        use webview2_com::{
            AcceleratorKeyPressedEventHandler,
            Microsoft::Web::WebView2::Win32::{
                COREWEBVIEW2_KEY_EVENT_KIND, COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN,
                COREWEBVIEW2_PHYSICAL_KEY_STATUS,
            },
        };
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
            GetKeyState, VK_CONTROL, VK_MENU, VK_SHIFT,
        };
        let held = |key: u16| unsafe { GetKeyState(i32::from(key)) } < 0;
        let handler = AcceleratorKeyPressedEventHandler::create(Box::new(move |_, args| {
            let Some(args) = args else {
                return Ok(());
            };
            let mut kind = COREWEBVIEW2_KEY_EVENT_KIND::default();
            let mut key = 0u32;
            let mut status = COREWEBVIEW2_PHYSICAL_KEY_STATUS::default();
            unsafe {
                args.KeyEventKind(&mut kind)?;
                args.VirtualKey(&mut key)?;
                args.PhysicalKeyStatus(&mut status)?;
            }
            if is_quit_accelerator(
                kind == COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN,
                key,
                status.WasKeyDown.as_bool(),
                held(VK_CONTROL),
                held(VK_MENU) || status.IsMenuKeyDown.as_bool(),
                held(VK_SHIFT),
            ) {
                unsafe { args.SetHandled(true)? };
                app.state::<service::ManagedService>()
                    .request_shutdown(&app);
            }
            Ok(())
        }));
        let mut token = 0i64;
        // A refused registration leaves File→Quit and every other key unchanged.
        let _ = unsafe {
            webview
                .controller()
                .add_AcceleratorKeyPressed(&handler, &mut token)
        };
    })
}

pub fn run() {
    let app = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            diagnostics::commands::read_service_diagnostics,
            diagnostics::commands::cancel_service_request
        ])
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "desktop-quit" {
                app.state::<service::ManagedService>().request_shutdown(app);
            }
        })
        .setup(|app| {
            let config =
                app.config().app.windows.first().ok_or_else(|| {
                    std::io::Error::other("Desktop window configuration is missing")
                })?;
            let window = tauri::WebviewWindowBuilder::from_config(app, config)?
                .on_navigation(native_navigation_allowed)
                .on_new_window(|_, _| NewWindowResponse::Deny)
                .build()?;
            #[cfg(windows)]
            forward_quit_accelerator(&window)?;
            #[cfg(not(windows))]
            let _ = window;
            let runtime = service::configured_runtime(app.handle())
                .unwrap_or_else(|_| service::ConfiguredRuntime::unavailable());
            let service = service::ManagedService::new(runtime)
                .map_err(|_| std::io::Error::other("Local service configuration failed"))?;
            app.manage(service.clone());
            install_shell_quit_menu(app)?;
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
    use super::{is_quit_accelerator, shell_navigation_allowed};

    #[test]
    fn only_a_first_plain_ctrl_q_key_down_is_the_quit_accelerator() {
        let q = u32::from(b'Q');
        assert!(is_quit_accelerator(true, q, false, true, false, false));
        for (down, key, repeat, ctrl, alt, shift) in [
            (false, q, false, true, false, false),
            (true, u32::from(b'W'), false, true, false, false),
            (true, q, true, true, false, false),
            (true, q, false, false, false, false),
            (true, q, false, true, true, false),
            (true, q, false, true, false, true),
        ] {
            assert!(!is_quit_accelerator(down, key, repeat, ctrl, alt, shift));
        }
    }
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
