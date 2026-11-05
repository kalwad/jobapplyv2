use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct PayloadManifest {
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
#[derive(Debug, PartialEq, Eq)]
pub struct GeneratedDescriptor {
    pub build_executable: PathBuf,
    pub resource_relative: String,
    pub executable_sha256: [u8; 32],
    pub manifest_sha256: [u8; 32],
}
pub fn descriptor_for_build(
    base: &Path,
    target: &str,
) -> Result<Option<GeneratedDescriptor>, String> {
    use std::{collections::BTreeSet, io::Read};
    if !base.is_absolute() {
        return Err("Build directory must be absolute".into());
    }
    let root = base.join("runtime-payload");
    let manifest_path = root.join("manifest.json");
    let metadata =
        std::fs::symlink_metadata(&root).map_err(|_| "Runtime staging directory is missing")?;
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Err("Invalid staging directory".into());
    }
    if !manifest_path.exists() {
        for entry in std::fs::read_dir(&root).map_err(|_| "Cannot inspect staging directory")? {
            let entry = entry.map_err(|_| "Cannot inspect staging entry")?;
            if entry.file_name() != ".gitignore"
                || !entry
                    .file_type()
                    .map_err(|_| "Cannot inspect staging type")?
                    .is_file()
            {
                return Err("Unmanifested runtime payload".into());
            }
        }
        return Ok(None);
    }
    let manifest_metadata =
        std::fs::symlink_metadata(&manifest_path).map_err(|_| "Cannot inspect runtime manifest")?;
    if !manifest_metadata.is_file()
        || manifest_metadata.file_type().is_symlink()
        || manifest_metadata.len() > 512 * 1024
    {
        return Err("Invalid runtime manifest".into());
    }
    let mut bytes = Vec::new();
    std::fs::File::open(&manifest_path)
        .map_err(|_| "Cannot open runtime manifest")?
        .take(512 * 1024 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Cannot read runtime manifest")?;
    if bytes.len() > 512 * 1024 {
        return Err("Runtime manifest too large".into());
    }
    let manifest: PayloadManifest =
        serde_json::from_slice(&bytes).map_err(|_| "Malformed runtime manifest")?;
    let entrypoint = if target.contains("windows") {
        "japp-orchestrator/japp-orchestrator.exe"
    } else {
        "japp-orchestrator/japp-orchestrator"
    };
    if manifest.schema_version != "1.0.0"
        || manifest.target != target
        || manifest.entrypoint != entrypoint
        || manifest.files.is_empty()
        || manifest.files.len() > 1024
    {
        return Err("Runtime manifest identity mismatch".into());
    }
    for value in [
        &manifest.source_inputs.orchestrator_wheel_sha256,
        &manifest.source_inputs.contracts_wheel_sha256,
        &manifest.source_inputs.runtime_requirements_sha256,
        &manifest.source_inputs.build_requirements_sha256,
    ] {
        digest(value)?;
    }
    let mut expected = BTreeSet::new();
    let mut total = 0u64;
    let mut executable_sha256 = None;
    for entry in manifest.files {
        if !safe_relative(&entry.path) || !expected.insert(entry.path.clone()) {
            return Err("Unsafe or duplicate runtime path".into());
        }
        total = total
            .checked_add(entry.bytes)
            .ok_or("Runtime payload too large")?;
        if total > 512 * 1024 * 1024 {
            return Err("Runtime payload too large".into());
        }
        let path = root.join(&entry.path);
        let initial = std::fs::symlink_metadata(&path).map_err(|_| "Missing runtime file")?;
        if !initial.is_file() || initial.file_type().is_symlink() || initial.len() != entry.bytes {
            return Err("Runtime file identity mismatch".into());
        }
        let expected_hash = digest(&entry.sha256)?;
        let mut source = std::fs::File::open(&path)
            .map_err(|_| "Cannot open runtime file")?
            .take(entry.bytes + 1);
        let mut hash = Sha256::new();
        let mut buffer = [0u8; 16384];
        let mut read = 0u64;
        loop {
            let count = source
                .read(&mut buffer)
                .map_err(|_| "Cannot read runtime file")?;
            if count == 0 {
                break;
            }
            read += count as u64;
            if read > entry.bytes {
                return Err("Growing runtime file".into());
            }
            hash.update(&buffer[..count]);
        }
        let observed: [u8; 32] = hash.finalize().into();
        let final_metadata =
            std::fs::symlink_metadata(&path).map_err(|_| "Cannot reinspect runtime file")?;
        if read != entry.bytes
            || observed != expected_hash
            || initial.len() != final_metadata.len()
            || initial.modified().ok() != final_metadata.modified().ok()
        {
            return Err("Changed runtime file".into());
        }
        if entry.path == entrypoint {
            executable_sha256 = Some(expected_hash);
        }
    }
    let mut observed = BTreeSet::new();
    collect_files(&root, &root, &mut observed)?;
    observed.remove("manifest.json");
    if observed != expected {
        return Err("Runtime inventory mismatch".into());
    }
    Ok(Some(GeneratedDescriptor {
        build_executable: root.join(entrypoint),
        resource_relative: format!("runtime/{entrypoint}"),
        executable_sha256: executable_sha256.ok_or("Missing runtime executable")?,
        manifest_sha256: Sha256::digest(bytes).into(),
    }))
}
fn safe_relative(value: &str) -> bool {
    !value.is_empty()
        && !value.contains('\\')
        && !value.contains(':')
        && value
            .split('/')
            .all(|component| !component.is_empty() && component != "." && component != "..")
        && Path::new(value)
            .components()
            .all(|part| matches!(part, std::path::Component::Normal(_)))
}
fn digest(value: &str) -> Result<[u8; 32], String> {
    if value.len() != 64
        || !value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    {
        return Err("Invalid runtime hash".into());
    }
    let mut bytes = [0; 32];
    for (index, byte) in bytes.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&value[index * 2..index * 2 + 2], 16)
            .map_err(|_| "Invalid runtime hash")?;
    }
    Ok(bytes)
}
fn collect_files(
    root: &Path,
    path: &Path,
    files: &mut std::collections::BTreeSet<String>,
) -> Result<(), String> {
    for entry in std::fs::read_dir(path).map_err(|_| "Cannot inspect runtime inventory")? {
        let entry = entry.map_err(|_| "Cannot inspect runtime entry")?;
        let kind = entry
            .file_type()
            .map_err(|_| "Cannot inspect runtime type")?;
        if kind.is_symlink() {
            return Err("Symlinked runtime path".into());
        }
        if kind.is_dir() {
            collect_files(root, &entry.path(), files)?;
        } else if kind.is_file() {
            let relative = entry
                .path()
                .strip_prefix(root)
                .map_err(|_| "Runtime outside staging root")?
                .to_str()
                .ok_or("Runtime path must be UTF8")?
                .replace('\\', "/");
            files.insert(relative);
            if files.len() > 1025 {
                return Err("Too many runtime files".into());
            }
        } else {
            return Err("Unsupported runtime file type".into());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    static NEXT: AtomicUsize = AtomicUsize::new(0);
    struct Fixture(PathBuf);
    impl Fixture {
        fn empty() -> Self {
            let base = std::env::temp_dir().join(format!(
                "japp-runtime-build-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            std::fs::create_dir_all(base.join("runtime-payload")).unwrap();
            std::fs::write(base.join("runtime-payload/.gitignore"), "*\n!.gitignore\n").unwrap();
            Self(base)
        }
        fn ready() -> Self {
            let f = Self::empty();
            let root = f.0.join("runtime-payload");
            std::fs::create_dir_all(root.join("japp-orchestrator")).unwrap();
            std::fs::write(
                root.join("japp-orchestrator/japp-orchestrator"),
                b"native-runtime",
            )
            .unwrap();
            let files=[".gitignore","japp-orchestrator/japp-orchestrator"].map(|name|{let bytes=std::fs::read(root.join(name)).unwrap();serde_json::json!({"path":name,"bytes":bytes.len(),"sha256":format!("{:x}",Sha256::digest(bytes))})});
            let zero = "0".repeat(64);
            let manifest = serde_json::json!({"schema_version":"1.0.0","target":"aarch64-apple-darwin","entrypoint":"japp-orchestrator/japp-orchestrator","source_inputs":{"orchestrator_wheel_sha256":zero,"contracts_wheel_sha256":zero,"runtime_requirements_sha256":zero,"build_requirements_sha256":zero},"files":files});
            std::fs::write(
                root.join("manifest.json"),
                serde_json::to_vec(&manifest).unwrap(),
            )
            .unwrap();
            f
        }
        fn change(&self, mutate: impl FnOnce(&mut serde_json::Value)) {
            let path = self.0.join("runtime-payload/manifest.json");
            let mut value = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
            mutate(&mut value);
            std::fs::write(path, serde_json::to_vec(&value).unwrap()).unwrap();
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            std::fs::remove_dir_all(&self.0).unwrap();
        }
    }
    #[test]
    fn absent_payload_is_truthfully_unconfigured() {
        let f = Fixture::empty();
        assert_eq!(descriptor_for_build(&f.0, "aarch64-apple-darwin"), Ok(None));
    }
    #[test]
    fn full_manifest_binds_exact_entrypoint_and_bytes() {
        let f = Fixture::ready();
        let d = descriptor_for_build(&f.0, "aarch64-apple-darwin")
            .unwrap()
            .unwrap();
        assert_eq!(
            d.resource_relative,
            "runtime/japp-orchestrator/japp-orchestrator"
        );
        assert_eq!(
            d.build_executable,
            f.0.join("runtime-payload/japp-orchestrator/japp-orchestrator")
        );
        assert_eq!(
            d.executable_sha256,
            <[u8; 32]>::from(Sha256::digest(b"native-runtime"))
        );
    }
    #[test]
    fn escaped_entrypoint_is_rejected() {
        let f = Fixture::ready();
        f.change(|v| v["entrypoint"] = "../japp-orchestrator".into());
        assert!(descriptor_for_build(&f.0, "aarch64-apple-darwin").is_err());
    }
    #[test]
    fn wrong_target_is_rejected() {
        let f = Fixture::ready();
        assert!(descriptor_for_build(&f.0, "x86_64-pc-windows-msvc").is_err());
    }
    #[test]
    fn changed_payload_fails_before_binding() {
        let f = Fixture::ready();
        std::fs::write(
            f.0.join("runtime-payload/japp-orchestrator/japp-orchestrator"),
            b"changed",
        )
        .unwrap();
        assert!(descriptor_for_build(&f.0, "aarch64-apple-darwin").is_err());
    }
    #[test]
    fn extra_unmanifested_file_is_rejected() {
        let f = Fixture::ready();
        std::fs::write(f.0.join("runtime-payload/unlisted"), b"extra").unwrap();
        assert!(descriptor_for_build(&f.0, "aarch64-apple-darwin").is_err());
    }
    #[test]
    fn duplicate_manifest_path_is_rejected() {
        let f = Fixture::ready();
        f.change(|v| {
            let entry = v["files"][0].clone();
            v["files"].as_array_mut().unwrap().push(entry)
        });
        assert!(descriptor_for_build(&f.0, "aarch64-apple-darwin").is_err());
    }
    #[cfg(unix)]
    #[test]
    fn symlinked_payload_file_is_rejected() {
        let f = Fixture::ready();
        let path =
            f.0.join("runtime-payload/japp-orchestrator/japp-orchestrator");
        std::fs::rename(&path, f.0.join("original")).unwrap();
        std::os::unix::fs::symlink(f.0.join("original"), path).unwrap();
        assert!(descriptor_for_build(&f.0, "aarch64-apple-darwin").is_err());
    }
}
