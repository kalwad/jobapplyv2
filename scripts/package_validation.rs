//! Future outside-only cfg(test) actor. Uses production native ownership adapters.
//! This is not a packaged app GUI actor or a native-platform certification.
use super::{ConfiguredRuntime, MonotonicClock, Policy, ServiceState, Supervisor};
use super::runtime_integrity::RuntimeTree;
use crate::api_client::{canonical::Catalog, client::{Cancellation, Client, Operation, Policy as HttpPolicy}};
use serde::Deserialize;
use std::sync::Mutex;
use sha2::{Digest, Sha256};
use std::{fs, net::{Ipv4Addr, TcpListener}, path::PathBuf, sync::{Arc, atomic::Ordering}, time::Duration};

fn assert_listener_released(port: u16) -> std::io::Result<()> {
    #[cfg(windows)]
    {
        TcpListener::bind((Ipv4Addr::LOCALHOST, port)).map(drop)
    }
    #[cfg(unix)]
    {
        // TIME_WAIT can outlive an exclusive listener. A bounded TCP refusal
        // tests listener release without claiming immediate address reusability.
        let address = std::net::SocketAddr::from((Ipv4Addr::LOCALHOST, port));
        match std::net::TcpStream::connect_timeout(&address, Duration::from_millis(250)) {
            Err(error) if error.kind() == std::io::ErrorKind::ConnectionRefused => Ok(()),
            Err(error) => Err(error),
            Ok(stream) => {
                drop(stream);
                Err(std::io::Error::new(
                    std::io::ErrorKind::AddrInUse,
                    "Retired service port still accepts TCP connections",
                ))
            }
        }
    }
}

#[cfg(unix)]
fn listener_oracle_controls() -> std::io::Result<()> {
    use std::io::{Read, Write};
    use std::net::{Shutdown, TcpStream};

    // These sockets belong to this test process. No port retries or elapsed
    // TIME_WAIT assumptions are used, and the production socket policy stays
    // exclusive. The existing Tokio runtime supplies only socket registration.
    let make_listener = || -> std::io::Result<TcpListener> {
        let socket = tokio::net::TcpSocket::new_v4()?;
        socket.set_reuseaddr(false)?;
        assert!(!socket.reuseaddr()?);
        socket.bind(std::net::SocketAddr::from((Ipv4Addr::LOCALHOST, 0)))?;
        let listener = socket.listen(8)?.into_std()?;
        listener.set_nonblocking(false)?;
        Ok(listener)
    };
    let live = make_listener()?;
    let live_address = live.local_addr()?;
    eprintln!(
        "PACKAGE_LISTENER_CONTROL live_pid={} live_address={live_address} previous_reuseaddr=0",
        std::process::id()
    );
    let error = assert_listener_released(live_address.port())
        .expect_err("A still-live controlled listener cannot be released");
    assert_eq!(error.kind(), std::io::ErrorKind::AddrInUse);
    drop(live);

    let listener = make_listener()?;
    let address = listener.local_addr()?;
    let bound = Duration::from_millis(250);
    let mut client = TcpStream::connect_timeout(&address, bound)?;
    client.set_read_timeout(Some(bound))?;
    client.set_write_timeout(Some(bound))?;
    let (mut server, peer) = listener.accept()?;
    assert_eq!(peer, client.local_addr()?);
    assert_eq!(server.local_addr()?, address);
    server.set_read_timeout(Some(bound))?;
    server.set_write_timeout(Some(bound))?;
    eprintln!(
        "PACKAGE_LISTENER_CONTROL retired_pid={} retired_address={address} peer={peer} previous_reuseaddr=0",
        std::process::id()
    );
    client.write_all(b"x")?;
    let mut byte = [0_u8];
    server.read_exact(&mut byte)?;
    assert_eq!(byte, [b'x']);
    server.shutdown(Shutdown::Write)?;
    assert_eq!(client.read(&mut byte)?, 0);
    client.shutdown(Shutdown::Write)?;
    assert_eq!(server.read(&mut byte)?, 0);
    drop(server);
    drop(client);
    drop(listener);

    // This is a differential observation, not a prerequisite or a claim about
    // the earlier CI failure. Kernel address reuse semantics differ by host.
    let legacy = match TcpListener::bind(address) {
        Ok(listener) => {
            drop(listener);
            "BOUND".to_owned()
        }
        Err(error) => format!("{:?}", error.kind()),
    };
    assert_listener_released(address.port())?;
    eprintln!(
        "PACKAGE_LISTENER_ORACLE_CONTROL_PASS previous_reuseaddr=0 server_active_close=1 live_listener_rejected=1 retired_connection_refused=1 legacy_bind={legacy} gui_claim=0"
    );
    Ok(())
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Pins {
    target: String,
    runtime_root: PathBuf,
    manifest_sha256: String,
    entrypoint_sha256: String,
}
type PackageSupervisor = Supervisor<ConfiguredRuntime, MonotonicClock>;
// Installed before start: the same Supervisor gets one bounded shutdown attempt
// on normal completion and every post-start unwind. A cleanup failure is recorded
// without replacing the original panic. NativeChild::drop is not closure proof.
struct OwnedCleanup {
    owner: Arc<Mutex<PackageSupervisor>>,
    result: Option<Result<(), String>>,
}
impl OwnedCleanup {
    fn new(owner: Arc<Mutex<PackageSupervisor>>) -> Self { Self { owner, result: None } }
    fn settle(&mut self) -> Result<(), String> {
        if let Some(result) = &self.result { return result.clone(); }
        let started = std::time::Instant::now();
        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let mut owner = self.owner.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
            owner.shutdown().map_err(|error| format!("{error:?}"))?;
            if owner.state() != ServiceState::Stopped { return Err("Owner did not stop".into()); }
            Ok(())
        })).unwrap_or_else(|_| Err("Shutdown panicked".into()));
        self.result = Some(outcome.clone());
        use std::io::Write;
        let _ = writeln!(std::io::stderr().lock(), "PACKAGE_OWNED_CLEANUP success={} elapsed_ms={} policy_wait_bound_ms=6000", outcome.is_ok(), started.elapsed().as_millis());
        outcome
    }
}
impl Drop for OwnedCleanup {
    fn drop(&mut self) {
        if self.result.is_none() {
            if let Err(error) = self.settle() {
                use std::io::Write;
                let _ = writeln!(std::io::stderr().lock(), "PACKAGE_OWNED_CLEANUP_FAILURE {error}");
            }
        }
    }
}

fn hex(value: &str) -> [u8; 32] {
    assert_eq!(value.len(), 64);
    let mut out = [0; 32];
    for (index, byte) in out.iter_mut().enumerate() {
        assert!(value.as_bytes()[index*2..index*2+2].iter().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(b)));
        *byte = u8::from_str_radix(&value[index*2..index*2+2], 16).unwrap();
    }
    out
}
#[cfg(windows)]
fn drive_path(path: &std::path::Path) -> PathBuf {
    use std::path::{Component, Prefix};
    let mut parts=path.components();
    let letter=match parts.next() {
        Some(Component::Prefix(prefix))=>match prefix.kind() {
            Prefix::Disk(value)|Prefix::VerbatimDisk(value)=>value.to_ascii_uppercase(),
            _=>panic!("Owned local drive path required"),
        },
        _=>panic!("Owned absolute drive path required"),
    };
    assert!(matches!(parts.next(),Some(Component::RootDir)));
    let mut out=PathBuf::from(format!("{}:\\",char::from(letter)));
    for part in parts {
        if let Component::Normal(value)=part {out.push(value)} else {panic!("Normal path component required")}
    }
    out
}
fn inputs() -> (Pins, PathBuf) {
    let path = PathBuf::from(std::env::var_os("JAPP_PACKAGE_PROBE_INPUT").expect("Explicit owned package pins required"));
    assert!(path.is_absolute() && path.is_file() && !path.is_symlink());
    let bytes = fs::read(&path).unwrap();
    assert!(bytes.len() <= 16_384);
    let pins: Pins = serde_json::from_slice(&bytes).unwrap();
    let expected = if cfg!(windows) {"x86_64-pc-windows-msvc"} else {"x86_64-unknown-linux-gnu"};
    assert_eq!(pins.target, expected);
    assert!(pins.runtime_root.is_absolute() && !pins.runtime_root.is_symlink());
    let canonical=pins.runtime_root.canonicalize().unwrap();
    #[cfg(windows)]
    let pins={
        assert_eq!(drive_path(&canonical),drive_path(&pins.runtime_root));
        Pins{runtime_root:drive_path(&canonical),..pins}
    };
    #[cfg(not(windows))]
    assert_eq!(canonical,pins.runtime_root);
    let manifest = pins.runtime_root.join("manifest.json");
    assert_eq!(<[u8;32]>::from(Sha256::digest(fs::read(manifest).unwrap())), hex(&pins.manifest_sha256));
    let relative = if cfg!(windows) {"japp-orchestrator/japp-orchestrator.exe"} else {"japp-orchestrator/japp-orchestrator"};
    let executable = pins.runtime_root.join(relative);
    (pins, executable)
}

#[test]
#[cfg(windows)]
fn windows_local_drive_prefixes_preserve_spaces_and_unicode() {
    assert_eq!(drive_path(std::path::Path::new(r"\\?\C:\owned 空间\runtime")),PathBuf::from(r"C:\owned 空间\runtime"));
    assert_eq!(drive_path(std::path::Path::new(r"c:\owned 空间\runtime")),PathBuf::from(r"C:\owned 空间\runtime"));
}
#[test]
#[cfg(windows)]
fn windows_unc_and_relative_drive_paths_are_refused() {
    for name in [r"\\server\share\runtime",r"\\?\UNC\server\share\runtime",r"C:relative",r"relative\runtime"] {
        assert!(std::panic::catch_unwind(||drive_path(std::path::Path::new(name))).is_err());
    }
}

#[tokio::test(flavor = "current_thread")]
async fn packaged_runtime_health_auth_and_owned_cleanup() {
    assert!(cfg!(any(all(windows, target_arch="x86_64"), all(target_os="linux",target_arch="x86_64"))));
    let (pins, executable) = inputs();
    let manifest_pin = hex(&pins.manifest_sha256);
    let runtime = ConfiguredRuntime::approved_tree(executable, hex(&pins.entrypoint_sha256), RuntimeTree::new(pins.runtime_root, &pins.target, manifest_pin)).unwrap();
    let owner = Arc::new(Mutex::new(Supervisor::new(runtime, MonotonicClock::default(), Policy::default()).unwrap()));
    let mut cleanup = OwnedCleanup::new(Arc::clone(&owner));
    // This test-only body deadline leaves the existing six-second shutdown
    // policy reserve within the external45s owned-container command cap.
    tokio::time::timeout(Duration::from_secs(30), async {
    #[cfg(unix)]
    listener_oracle_controls().expect("Controlled listener release oracle must hold");
    let identity = owner.lock().unwrap().start().expect("Actual packaged service must acknowledge and prove health");
    assert_eq!(owner.lock().unwrap().state(), ServiceState::Running);
    let native = owner.lock().unwrap().client_session().unwrap();
    let catalog = Arc::new(Catalog::new(crate::api_client::tests::canonical_documents()).unwrap());
    let mut client = Client::connect(Arc::clone(&native.session), catalog, "corr_00000000000000000000000001", Cancellation::new(), HttpPolicy::new(Duration::from_secs(3)).unwrap()).await.unwrap();
    let health = client.get(Operation::Health).await.unwrap();
    assert_eq!(health["payload"]["status"], "LIVE");
    assert_eq!(health["payload"]["instance_id"], identity.instance_id);
    assert_eq!(health["payload"]["generation"], identity.generation);
    assert_eq!(client.get(Operation::Ready).await.unwrap()["payload"]["status"], "READY");
    let version = client.get(Operation::Version).await.unwrap();
    assert_eq!(version["payload"]["service_version"], "0.0.1");
    assert_eq!(version["payload"]["api_version"], "1.0.0");
    cleanup.settle().expect("Native owned job/group must settle, reap and drain");
    assert_eq!(owner.lock().unwrap().state(), ServiceState::Stopped);
    assert!(!native.valid.load(Ordering::Acquire));
    assert!(client.get(Operation::Health).await.is_err(), "Retired owner authority cannot issue a later request");
    drop(client);
    assert_listener_released(identity.bind_port).expect("Owned listener must be released");
    eprintln!("PACKAGE_SERVICE_ACTOR_PASS actual_native_actors=1 health=1 ready=1 version=1 shutdown=1 authority_withdrawn=1 listener_released=1 gui_claim=0");
    }).await.expect("Selected package service body exceeded30s; same-owner cleanup retained");
}
