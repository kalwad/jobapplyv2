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

/// Win32 virtual-key codes of the modifiers whose key state is read.
const VK_SHIFT: u16 = 0x10;
const VK_CONTROL: u16 = 0x11;
const VK_MENU: u16 = 0x12;
#[cfg(windows)]
const _: () = {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse as win32;
    assert!(VK_SHIFT == win32::VK_SHIFT);
    assert!(VK_CONTROL == win32::VK_CONTROL);
    assert!(VK_MENU == win32::VK_MENU);
};

/// GetKeyState's high-order bit means the key is held; its low-order bit only
/// reports a toggle (for example Caps Lock), never a held key.
#[cfg_attr(not(windows), allow(dead_code))]
fn key_state_held(state: i16) -> bool {
    state < 0
}

/// Reads one WebView2 accelerator event as the quit chord. Alt counts as held
/// when either the key state or the event's menu flag reports it (AltGr holds
/// Ctrl+Alt without the menu flag), and an auto-repeat is never a first press.
#[cfg_attr(not(windows), allow(dead_code))]
fn quit_accelerator_event(
    key_down: bool,
    virtual_key: u32,
    was_key_down: bool,
    is_menu_key_down: bool,
    held: impl Fn(u16) -> bool,
) -> bool {
    is_quit_accelerator(
        key_down,
        virtual_key,
        was_key_down,
        held(VK_CONTROL),
        held(VK_MENU) || is_menu_key_down,
        held(VK_SHIFT),
    )
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
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::GetKeyState;
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
            if quit_accelerator_event(
                kind == COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN,
                key,
                status.WasKeyDown.as_bool(),
                status.IsMenuKeyDown.as_bool(),
                |vk| key_state_held(unsafe { GetKeyState(i32::from(vk)) }),
            ) && let Some(service) = app.try_state::<service::ManagedService>()
            {
                unsafe { args.SetHandled(true)? };
                service.request_shutdown(&app);
            }
            Ok(())
        }));
        let mut token = 0i64;
        // A refused registration is ignored: File→Quit and every other key are
        // unchanged, and the Windows 11 accelerator phase observes the gap.
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
    use super::{
        is_quit_accelerator, key_state_held, quit_accelerator_event, shell_navigation_allowed,
    };

    fn holding(keys: &[u16]) -> impl Fn(u16) -> bool + '_ {
        move |key| keys.contains(&key)
    }

    #[test]
    fn a_webview_key_event_quits_only_on_a_first_plain_ctrl_q() {
        // Win32 virtual-key codes for Shift, Ctrl and Alt (VK_MENU).
        const SHIFT: u16 = 0x10;
        const CTRL: u16 = 0x11;
        const ALT: u16 = 0x12;
        let (q, w) = (u32::from(b'Q'), u32::from(b'W'));
        let plain = quit_accelerator_event(true, q, false, false, holding(&[CTRL]));
        assert!(plain, "plain first Ctrl+Q");
        for (case, down, key, was_key_down, is_menu_key_down, held) in [
            ("AltGr", true, q, false, false, &[CTRL, ALT][..]),
            ("menu flag only", true, q, false, true, &[CTRL][..]),
            ("Alt and menu flag", true, q, false, true, &[CTRL, ALT][..]),
            ("auto-repeat", true, q, true, false, &[CTRL][..]),
            ("Shift", true, q, false, false, &[CTRL, SHIFT][..]),
            ("key-up", false, q, false, false, &[CTRL][..]),
            ("other key", true, w, false, false, &[CTRL][..]),
            ("no Ctrl", true, q, false, false, &[][..]),
        ] {
            assert!(
                !quit_accelerator_event(down, key, was_key_down, is_menu_key_down, holding(held)),
                "{case}"
            );
        }
    }

    #[test]
    fn only_the_high_order_key_state_bit_means_held() {
        // 0x8000 held, 0x8001 held and toggled, 0x0001 toggled only, 0 up.
        for (state, held) in [(i16::MIN, true), (-32767, true), (1, false), (0, false)] {
            assert_eq!(key_state_held(state), held, "{state:#06x}");
        }
    }

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
