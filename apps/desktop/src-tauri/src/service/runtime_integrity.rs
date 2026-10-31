//! Compile-bound payload verification performed by the background spawn preflight.
use super::SupervisorError;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeSet,
    fs::{File, Metadata, OpenOptions},
    io::Read,
    path::{Path, PathBuf},
};
const MAX_MANIFEST: u64 = 512 * 1024;
const MAX_PAYLOAD: u64 = 512 * 1024 * 1024;
const MAX_FILES: usize = 1024;
const MAX_NODES: usize = 2048;
const MAX_DEPTH: usize = 32;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Manifest {
    schema_version: String,
    target: String,
    entrypoint: String,
    source_inputs: SourceInputs,
    files: Vec<PayloadFile>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SourceInputs {
    orchestrator_wheel_sha256: String,
    contracts_wheel_sha256: String,
    runtime_requirements_sha256: String,
    build_requirements_sha256: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct PayloadFile {
    path: String,
    bytes: u64,
    sha256: String,
}
pub(super) struct RuntimeTree {
    root: PathBuf,
    target: String,
    manifest_sha256: [u8; 32],
}
impl RuntimeTree {
    #[cfg(windows)]
    pub(super) fn root(&self) -> &Path {
        &self.root
    }

    #[allow(dead_code)] // App descriptor is compiled in the final desktop.
    pub(super) fn new(root: PathBuf, target: &str, manifest_sha256: [u8; 32]) -> Self {
        Self {
            root,
            target: target.into(),
            manifest_sha256,
        }
    }
    fn entrypoint(&self) -> &'static str {
        if self.target.contains("windows") {
            "japp-orchestrator/japp-orchestrator.exe"
        } else {
            "japp-orchestrator/japp-orchestrator"
        }
    }
    #[allow(dead_code)] // Used by real desktop descriptor.
    pub(super) fn contains_entrypoint(&self, path: &Path) -> bool {
        path == self.root.join(self.entrypoint())
    }
    pub(super) fn verify(
        &self,
        mut check: impl FnMut() -> Result<(), SupervisorError>,
    ) -> Result<(), SupervisorError> {
        check()?;
        if !self.root.is_absolute() {
            return Err({
                eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                SupervisorError::InvalidRuntime
            });
        }
        let root = std::fs::symlink_metadata(&self.root).map_err(|_| {
            eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
            SupervisorError::InvalidRuntime
        })?;
        if root.file_type().is_symlink() || !root.is_dir() {
            return Err({
                eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                SupervisorError::InvalidRuntime
            });
        }
        let manifest_path = self.root.join("manifest.json");
        let size = std::fs::symlink_metadata(&manifest_path)
            .map_err(|_| {
                eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                SupervisorError::InvalidRuntime
            })?
            .len();
        if size > MAX_MANIFEST {
            return Err({
                eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                SupervisorError::InvalidRuntime
            });
        }
        let (hash, bytes) = read_checked(&manifest_path, size, true, &mut check)?;
        if hash != self.manifest_sha256 {
            return Err({
                eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                SupervisorError::InvalidRuntime
            });
        }
        let manifest: Manifest = serde_json::from_slice(&bytes).map_err(|_| {
            eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
            SupervisorError::InvalidRuntime
        })?;
        if manifest.schema_version != "1.0.0"
            || manifest.target != self.target
            || manifest.entrypoint != self.entrypoint()
            || manifest.files.is_empty()
            || manifest.files.len() > MAX_FILES
        {
            return Err({
                eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                SupervisorError::InvalidRuntime
            });
        }
        for hash in [
            &manifest.source_inputs.orchestrator_wheel_sha256,
            &manifest.source_inputs.contracts_wheel_sha256,
            &manifest.source_inputs.runtime_requirements_sha256,
            &manifest.source_inputs.build_requirements_sha256,
        ] {
            parse_hash(hash)?;
        }
        let mut expected = BTreeSet::new();
        let mut directories = BTreeSet::new();
        let mut total = 0u64;
        for entry in manifest.files {
            check()?;
            if !safe_relative(&entry.path)
                || entry.path == "manifest.json"
                || !expected.insert(entry.path.clone())
            {
                return Err({
                    eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                    SupervisorError::InvalidRuntime
                });
            }
            total = total.checked_add(entry.bytes).ok_or_else(|| {
                eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                SupervisorError::InvalidRuntime
            })?;
            if total > MAX_PAYLOAD {
                return Err({
                    eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                    SupervisorError::InvalidRuntime
                });
            }
            let mut parts = entry.path.split('/').peekable();
            let mut path = self.root.clone();
            let mut relative = String::new();
            while let Some(part) = parts.next() {
                check()?;
                path.push(part);
                if !relative.is_empty() {
                    relative.push('/');
                }
                relative.push_str(part);
                let metadata = std::fs::symlink_metadata(&path).map_err(|_| {
                    eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                    SupervisorError::InvalidRuntime
                })?;
                if metadata.file_type().is_symlink()
                    || (parts.peek().is_some() && !metadata.is_dir())
                {
                    return Err({
                        eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                        SupervisorError::InvalidRuntime
                    });
                }
                if parts.peek().is_some() {
                    directories.insert(relative.clone());
                }
            }
            if read_checked(&path, entry.bytes, false, &mut check)?.0 != parse_hash(&entry.sha256)?
            {
                return Err({
                    eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                    SupervisorError::InvalidRuntime
                });
            }
        }
        if !expected.contains(self.entrypoint()) {
            return Err({
                eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                SupervisorError::InvalidRuntime
            });
        }
        let mut actual = BTreeSet::new();
        let mut pending = vec![(self.root.clone(), 0usize)];
        let mut nodes = 0usize;
        while let Some((directory, depth)) = pending.pop() {
            check()?;
            if depth > MAX_DEPTH {
                return Err({
                    eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                    SupervisorError::InvalidRuntime
                });
            }
            for item in std::fs::read_dir(directory).map_err(|_| {
                eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                SupervisorError::InvalidRuntime
            })? {
                check()?;
                nodes += 1;
                if nodes > MAX_NODES {
                    return Err({
                        eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                        SupervisorError::InvalidRuntime
                    });
                }
                let item = item.map_err(|_| {
                    eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                    SupervisorError::InvalidRuntime
                })?;
                let kind = item.file_type().map_err(|_| {
                    eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                    SupervisorError::InvalidRuntime
                })?;
                let path = item.path();
                let relative = relative_inventory_path(&self.root, &path)?;
                if kind.is_symlink() {
                    return Err({
                        eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                        SupervisorError::InvalidRuntime
                    });
                }
                if kind.is_dir() {
                    if !directories.contains(&relative) {
                        return Err({
                            eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                            SupervisorError::InvalidRuntime
                        });
                    }
                    pending.push((path, depth + 1));
                } else if kind.is_file() {
                    if relative != "manifest.json" && !actual.insert(relative) {
                        return Err({
                            eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                            SupervisorError::InvalidRuntime
                        });
                    }
                } else {
                    return Err({
                        eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                        SupervisorError::InvalidRuntime
                    });
                }
            }
        }
        if expected != actual {
            return Err({
                eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                SupervisorError::InvalidRuntime
            });
        }
        let after = std::fs::symlink_metadata(&self.root).map_err(|_| {
            eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
            SupervisorError::InvalidRuntime
        })?;
        if !same_identity(&root, &after) {
            return Err({
                eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                SupervisorError::InvalidRuntime
            });
        }
        check()
    }
}
fn relative_inventory_path(root: &Path, path: &Path) -> Result<String, SupervisorError> {
    let relative = path.strip_prefix(root).map_err(|_| {
        eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
        SupervisorError::InvalidRuntime
    })?;
    let mut names = Vec::new();
    for part in relative.components() {
        let std::path::Component::Normal(name) = part else {
            return Err({
                eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                SupervisorError::InvalidRuntime
            });
        };
        let name = name.to_str().ok_or_else(|| {
            eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
            SupervisorError::InvalidRuntime
        })?;
        // Native separators are component boundaries. A POSIX filename's literal
        // backslash is data, so it must not alias a declared slash-separated path.
        if name.contains(['\\', '/', ':']) || names.len() >= MAX_DEPTH {
            return Err({
                eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                SupervisorError::InvalidRuntime
            });
        }
        names.push(name);
    }
    let result = names.join("/");
    if !safe_relative(&result) {
        return Err({
            eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
            SupervisorError::InvalidRuntime
        });
    }
    Ok(result)
}
fn safe_relative(path: &str) -> bool {
    !path.is_empty()
        && path.len() <= 1024
        && !path.contains(['\\', ':'])
        && path.split('/').count() <= MAX_DEPTH
        && path
            .split('/')
            .all(|part| !part.is_empty() && part != "." && part != "..")
        && Path::new(path)
            .components()
            .all(|part| matches!(part, std::path::Component::Normal(_)))
}
fn parse_hash(value: &str) -> Result<[u8; 32], SupervisorError> {
    if value.len() != 64
        || !value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    {
        return Err({
            eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
            SupervisorError::InvalidRuntime
        });
    }
    let mut bytes = [0; 32];
    for (index, byte) in bytes.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&value[index * 2..index * 2 + 2], 16).map_err(|_| {
            eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
            SupervisorError::InvalidRuntime
        })?;
    }
    Ok(bytes)
}
fn same_identity(before: &Metadata, after: &Metadata) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        if before.dev() != after.dev() || before.ino() != after.ino() {
            return false;
        }
    }
    !after.file_type().is_symlink()
        && before.is_file() == after.is_file()
        && before.is_dir() == after.is_dir()
        && before.len() == after.len()
        && before.modified().ok() == after.modified().ok()
}
// The named regular-file check is not atomic with open. A replacement FIFO
// must be acquired without waiting for a writer, then refused by held identity
// before any payload bytes are read. O_NONBLOCK remains set on the regular FD.
fn open_regular_payload(path: &Path, initial: &Metadata) -> Result<File, SupervisorError> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(libc::O_NOFOLLOW | libc::O_CLOEXEC | libc::O_NONBLOCK);
    }
    let file: File = options.open(path).map_err(|_| {
        eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
        SupervisorError::InvalidRuntime
    })?;
    if !same_identity(
        initial,
        &file.metadata().map_err(|_| {
            eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
            SupervisorError::InvalidRuntime
        })?,
    ) {
        return Err({
            eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
            SupervisorError::InvalidRuntime
        });
    }
    Ok(file)
}

fn read_checked(
    path: &Path,
    size: u64,
    collect: bool,
    check: &mut impl FnMut() -> Result<(), SupervisorError>,
) -> Result<([u8; 32], Vec<u8>), SupervisorError> {
    check()?;
    if size > MAX_PAYLOAD {
        return Err({
            eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
            SupervisorError::InvalidRuntime
        });
    }
    let initial = std::fs::symlink_metadata(path).map_err(|_| {
        eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
        SupervisorError::InvalidRuntime
    })?;
    if !initial.is_file() || initial.file_type().is_symlink() || initial.len() != size {
        return Err({
            eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
            SupervisorError::InvalidRuntime
        });
    }
    let file = open_regular_payload(path, &initial)?;
    let mut limited = file.take(size + 1);
    let mut hash = Sha256::new();
    let mut raw = Vec::new();
    let mut total = 0u64;
    let mut buffer = [0; 16384];
    loop {
        check()?;
        let count = limited.read(&mut buffer).map_err(|_| {
            eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
            SupervisorError::InvalidRuntime
        })?;
        if count == 0 {
            break;
        }
        total += count as u64;
        if total > size {
            return Err({
                eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                SupervisorError::InvalidRuntime
            });
        }
        hash.update(&buffer[..count]);
        if collect {
            raw.extend_from_slice(&buffer[..count]);
        }
    }
    if total != size
        || !same_identity(
            &initial,
            &limited.get_ref().metadata().map_err(|_| {
                eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                SupervisorError::InvalidRuntime
            })?,
        )
        || !same_identity(
            &initial,
            &std::fs::symlink_metadata(path).map_err(|_| {
                eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                SupervisorError::InvalidRuntime
            })?,
        )
    {
        return Err({
            eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
            SupervisorError::InvalidRuntime
        });
    }
    check()?;
    Ok((hash.finalize().into(), raw))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::service::{ConfiguredRuntime, RuntimeAdapter};
    use sha2::{Digest, Sha256};
    use std::sync::atomic::{AtomicUsize, Ordering};
    static NEXT: AtomicUsize = AtomicUsize::new(0);
    const ENTRY: &str = "japp-orchestrator/japp-orchestrator";
    struct Fixture {
        root: PathBuf,
    }
    impl Fixture {
        fn ready() -> Self {
            let root = std::env::temp_dir().join(format!(
                "japp-runtime-integrity-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            std::fs::create_dir_all(root.join("japp-orchestrator/_internal")).unwrap();
            std::fs::write(root.join(ENTRY), b"owned-native").unwrap();
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(root.join(ENTRY), std::fs::Permissions::from_mode(0o700))
                    .unwrap();
            }
            std::fs::write(
                root.join("japp-orchestrator/_internal/dependency"),
                b"owned-dependency",
            )
            .unwrap();
            let files=[ENTRY,"japp-orchestrator/_internal/dependency"].map(|name|{
                let raw=std::fs::read(root.join(name)).unwrap();
                serde_json::json!({"path":name,"bytes":raw.len(),"sha256":format!("{:x}",Sha256::digest(raw))})
            });
            let zero = "0".repeat(64);
            let manifest = serde_json::json!({"schema_version":"1.0.0","target":"aarch64-apple-darwin","entrypoint":ENTRY,"source_inputs":{"orchestrator_wheel_sha256":zero,"contracts_wheel_sha256":zero,"runtime_requirements_sha256":zero,"build_requirements_sha256":zero},"files":files});
            std::fs::write(
                root.join("manifest.json"),
                serde_json::to_vec(&manifest).unwrap(),
            )
            .unwrap();
            Self { root }
        }
        fn binding(&self) -> RuntimeTree {
            RuntimeTree::new(
                self.root.clone(),
                "aarch64-apple-darwin",
                Sha256::digest(std::fs::read(self.root.join("manifest.json")).unwrap()).into(),
            )
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            std::fs::remove_dir_all(&self.root).unwrap();
        }
    }
    #[test]
    fn exact_compiled_payload_is_accepted() {
        let f = Fixture::ready();
        assert_eq!(f.binding().verify(|| Ok(())), Ok(()));
    }
    #[test]
    fn dependency_change_is_rejected_even_when_entrypoint_is_unchanged() {
        let f = Fixture::ready();
        let binding = f.binding();
        std::fs::write(
            f.root.join("japp-orchestrator/_internal/dependency"),
            b"changed-dependency",
        )
        .unwrap();
        assert_eq!(
            binding.verify(|| Ok(())),
            Err(SupervisorError::InvalidRuntime)
        );
    }
    #[test]
    fn rewriting_manifest_cannot_authorize_replaced_payload() {
        let f = Fixture::ready();
        let binding = f.binding();
        let p = f.root.join("manifest.json");
        let mut value: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&p).unwrap()).unwrap();
        value["files"][1]["sha256"] = serde_json::json!("f".repeat(64));
        std::fs::write(p, serde_json::to_vec(&value).unwrap()).unwrap();
        assert_eq!(
            binding.verify(|| Ok(())),
            Err(SupervisorError::InvalidRuntime)
        );
    }
    #[test]
    fn undeclared_runtime_file_is_rejected() {
        let f = Fixture::ready();
        std::fs::write(f.root.join("injected-library"), b"untrusted").unwrap();
        assert_eq!(
            f.binding().verify(|| Ok(())),
            Err(SupervisorError::InvalidRuntime)
        );
    }
    #[test]
    #[cfg(unix)]
    fn symlinked_parent_directory_is_rejected_before_file_open() {
        let f = Fixture::ready();
        let binding = f.binding();
        let source = f.root.join("japp-orchestrator/_internal");
        let outside = f.root.join("owned-outside");
        std::fs::rename(&source, &outside).unwrap();
        std::os::unix::fs::symlink(&outside, source).unwrap();
        assert_eq!(
            binding.verify(|| Ok(())),
            Err(SupervisorError::InvalidRuntime)
        );
    }
    #[test]
    fn trusted_hash_does_not_make_escaped_manifest_paths_safe() {
        let f = Fixture::ready();
        let p = f.root.join("manifest.json");
        let mut value: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&p).unwrap()).unwrap();
        value["files"][1]["path"] = serde_json::json!("../escaped");
        std::fs::write(p, serde_json::to_vec(&value).unwrap()).unwrap();
        assert_eq!(
            f.binding().verify(|| Ok(())),
            Err(SupervisorError::InvalidRuntime)
        );
    }
    #[test]
    fn cancellation_is_observed_during_bounded_inventory_work() {
        let f = Fixture::ready();
        let mut checks = 0;
        assert_eq!(
            f.binding().verify(|| {
                checks += 1;
                Err(SupervisorError::Cancelled)
            }),
            Err(SupervisorError::Cancelled)
        );
        assert_eq!(checks, 1);
    }
    #[test]
    fn oversized_manifest_is_rejected_before_parsing() {
        let f = Fixture::ready();
        let binding = f.binding();
        std::fs::write(
            f.root.join("manifest.json"),
            vec![b' '; MAX_MANIFEST as usize + 1],
        )
        .unwrap();
        assert_eq!(
            binding.verify(|| Ok(())),
            Err(SupervisorError::InvalidRuntime)
        );
    }
    #[test]
    fn payload_chunk_verification_honors_mid_file_cancellation() {
        let f = Fixture::ready();
        let file = f.root.join("owned-large-file");
        let size = 64 * 1024;
        std::fs::write(&file, vec![0; size]).unwrap();
        let mut checks = 0;
        let mut permit = || {
            checks += 1;
            if checks == 4 {
                Err(SupervisorError::Cancelled)
            } else {
                Ok(())
            }
        };
        assert_eq!(
            read_checked(&file, size as u64, false, &mut permit),
            Err(SupervisorError::Cancelled)
        );
        assert_eq!(checks, 4, "cancellation occurs between actual file chunks");
    }
    #[test]
    fn file_growth_during_open_read_is_rejected_at_size_plus_one() {
        use std::io::Write;
        let f = Fixture::ready();
        let path = f.root.join("owned-growing-file");
        std::fs::write(&path, b"owned").unwrap();
        let mut checks = 0;
        let mut permit = || {
            checks += 1;
            if checks == 2 {
                std::fs::OpenOptions::new()
                    .append(true)
                    .open(&path)
                    .unwrap()
                    .write_all(b"extra")
                    .unwrap();
            }
            Ok(())
        };
        assert_eq!(
            read_checked(&path, 5, false, &mut permit),
            Err(SupervisorError::InvalidRuntime)
        );
        assert_eq!(checks, 2, "reject immediately after the first bounded read");
    }
    #[test]
    #[cfg(unix)]
    fn literal_backslash_extra_file_cannot_alias_a_declared_native_path() {
        let f = Fixture::ready();
        let binding = f.binding();
        let extra = f.root.join("japp-orchestrator\\japp-orchestrator");
        std::fs::write(&extra, b"undeclared-bytes").unwrap();
        assert!(extra.is_file(), "the native extra-file premise must exist");
        assert_eq!(
            binding.verify(|| Ok(())),
            Err(SupervisorError::InvalidRuntime)
        );
    }
    #[test]
    #[cfg(unix)]
    fn invalid_utf8_components_are_rejected_without_lossy_normalization() {
        use std::os::unix::ffi::OsStringExt;
        let root = Path::new("/owned-runtime");
        let path = root.join(std::ffi::OsString::from_vec(b"invalid-\xff".to_vec()));
        assert_eq!(
            relative_inventory_path(root, &path),
            Err(SupervisorError::InvalidRuntime)
        );
    }
    #[test]
    fn actual_runtime_adapter_requires_dependency_inventory() {
        let f = Fixture::ready();
        let binding = f.binding();
        let hash: [u8; 32] = Sha256::digest(std::fs::read(f.root.join(ENTRY)).unwrap()).into();
        let runtime = ConfiguredRuntime::approved_tree(f.root.join(ENTRY), hash, binding).unwrap();
        std::fs::write(
            f.root.join("japp-orchestrator/_internal/dependency"),
            b"changed-dependency",
        )
        .unwrap();
        assert_eq!(
            runtime.check_runtime(),
            Err(SupervisorError::InvalidRuntime)
        );
    }
    #[cfg(unix)]
    #[test]
    fn prechecked_payload_replaced_with_fifo_is_rejected_before_read() {
        use std::os::unix::{ffi::OsStrExt, fs::FileTypeExt};
        let fixture = Fixture::ready();
        let path = fixture.root.join("owned-open-target");
        let retained = fixture.root.join("retained-regular");
        std::fs::write(&path, b"owned synthetic payload\n").unwrap();
        let initial = path.symlink_metadata().unwrap();
        assert!(initial.is_file());
        std::fs::rename(&path, &retained).unwrap();
        let c_path = std::ffi::CString::new(path.as_os_str().as_bytes()).unwrap();
        assert_eq!(unsafe { libc::mkfifo(c_path.as_ptr(), 0o600) }, 0);
        assert!(path.symlink_metadata().unwrap().file_type().is_fifo());
        // No writer exists. The future outer owned-process cap must fail the
        // selector if O_NONBLOCK is removed and the native open blocks.
        assert!(matches!(
            open_regular_payload(&path, &initial),
            Err(SupervisorError::InvalidRuntime)
        ));
        assert!(path.symlink_metadata().unwrap().file_type().is_fifo());
        assert_eq!(
            std::fs::read(retained).unwrap(),
            b"owned synthetic payload\n"
        );
    }
}
