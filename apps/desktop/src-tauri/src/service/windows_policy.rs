//! Portable policy shared by the native Windows adapter; no OS operations here.
use super::{ReadyFrame, SupervisorError};

pub const CREATE_FLAGS: u32 = 0x0000_0004 | 0x0008_0000 | 0x0800_0000 | 0x0000_0400;
pub struct LaunchPlan {
    pub application: Vec<u16>,
    pub command_line: Vec<u16>,
    pub directory: Vec<u16>,
    pub flags: u32,
}
/// The owned service inherits nothing from the parent environment. It gets
/// exactly one variable, the OS-reported Windows directory: Winsock resolves
/// its provider DLLs through %SystemRoot%, so with an empty block every socket
/// fails with WSAEPROVIDERFAILEDINIT (10106) and the frozen service exits while
/// importing asyncio, before it reads its bootstrap.
pub fn service_environment(system_root: &str) -> Result<Vec<u16>, SupervisorError> {
    let bytes = system_root.as_bytes();
    if bytes.len() < 4
        || system_root.encode_utf16().count() > 260
        || !bytes[0].is_ascii_alphabetic()
        || &bytes[1..3] != b":\\"
        || system_root[2..]
            .chars()
            .any(|v| v < ' ' || "<>:\"/|?*=".contains(v))
        || system_root[3..]
            .split('\\')
            .any(|c| c.is_empty() || c == "." || c == "..")
    {
        return Err({
            eprintln!("JAPP_DIAG SpawnFailed {}:{}", file!(), line!());
            SupervisorError::SpawnFailed
        });
    }
    Ok(format!("SystemRoot={system_root}")
        .encode_utf16()
        .chain([0, 0])
        .collect())
}
pub fn launch_plan(path: &str) -> Result<LaunchPlan, SupervisorError> {
    let normalized = path.replace('/', "\\");
    let path = normalized.as_str();
    if path.encode_utf16().count() > 32760 {
        return Err({
            eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
            SupervisorError::InvalidRuntime
        });
    }
    let bytes = path.as_bytes();
    if bytes.len() < 4
        || !bytes[0].is_ascii_alphabetic()
        || &bytes[1..3] != b":\\"
        || !path.ends_with(".exe")
    {
        return Err({
            eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
            SupervisorError::InvalidRuntime
        });
    }
    let components: Vec<_> = path[3..].split('\\').collect();
    if components.is_empty()
        || components.iter().any(|c| {
            c.is_empty()
                || *c == "."
                || *c == ".."
                || c.ends_with(['.', ' '])
                || c.chars().any(|v| v < ' ' || "<>:\"/|?*".contains(v))
                || {
                    let stem = c.split('.').next().unwrap_or("").to_ascii_uppercase();
                    ["CON", "PRN", "AUX", "NUL"].contains(&stem.as_str())
                        || (stem.len() == 4
                            && (stem.starts_with("COM") || stem.starts_with("LPT"))
                            && matches!(stem.as_bytes()[3], b'1'..=b'9'))
                }
        })
    {
        return Err({
            eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
            SupervisorError::InvalidRuntime
        });
    }
    let directory = path
        .rsplit_once('\\')
        .ok_or_else(|| {
            eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
            SupervisorError::InvalidRuntime
        })?
        .0;
    let root_directory;
    let directory = if directory.len() == 2 {
        root_directory = format!("{directory}\\");
        root_directory.as_str()
    } else {
        directory
    };
    let wide = |v: &str| v.encode_utf16().chain([0]).collect();
    Ok(LaunchPlan {
        application: wide(path),
        command_line: wide(&format!("\"{path}\"")),
        directory: wide(directory),
        flags: CREATE_FLAGS,
    })
}
pub fn inherited_handles(
    input: isize,
    output: isize,
    error: isize,
    job: isize,
    lease: isize,
) -> Result<[isize; 3], SupervisorError> {
    let h = [input, output, error];
    if h.iter()
        .any(|v| *v == 0 || *v == -1 || *v == job || *v == lease)
        || h[0] == h[1]
        || h[0] == h[2]
        || h[1] == h[2]
    {
        return Err({
            eprintln!("JAPP_DIAG ContainmentUnavailable {}:{}", file!(), line!());
            SupervisorError::ContainmentUnavailable
        });
    }
    Ok(h)
}
pub fn cleanup_status(
    terminal: Option<i32>,
    active: u32,
    settled: bool,
) -> Result<Option<i32>, SupervisorError> {
    if terminal.is_none() {
        return Ok(None);
    }
    if active != 0 || !settled {
        return Err(SupervisorError::CleanupPending);
    }
    Ok(terminal)
}
#[derive(Default)]
pub struct ReadyDecoder {
    data: Vec<u8>,
    emitted: bool,
}
impl ReadyDecoder {
    pub fn push(&mut self, bytes: &[u8]) -> Result<Option<ReadyFrame>, SupervisorError> {
        if bytes.is_empty() {
            return Ok(None);
        }
        if self.emitted || self.data.len().saturating_add(bytes.len()) > 4100 {
            return Err(SupervisorError::ProtocolRejected);
        }
        self.data.extend_from_slice(bytes);
        if self.data.len() < 4 {
            return Ok(None);
        }
        let len = u32::from_be_bytes(
            self.data[..4]
                .try_into()
                .map_err(|_| SupervisorError::ProtocolRejected)?,
        ) as usize;
        if len == 0 || len > 4096 || self.data.len() > len + 4 {
            return Err(SupervisorError::ProtocolRejected);
        }
        if self.data.len() < len + 4 {
            return Ok(None);
        }
        let frame = ReadyFrame::read_from(&mut self.data.as_slice())
            .map_err(|_| SupervisorError::ProtocolRejected)?;
        self.data.clear();
        self.emitted = true;
        Ok(Some(frame))
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn ack() -> Vec<u8> {
        let body=br#"{"protocol":"JAPP_SERVICE_STATUS_V1","schema_version":"1.0.0","status":"READY","bind_host":"127.0.0.1","bind_port":32123,"instance_id":"svc_00000000000000000000000000","generation":1}"#;
        [(body.len() as u32).to_be_bytes().as_slice(), body].concat()
    }
    #[test]
    fn windows_absolute_unicode_paths_are_explicit_and_quoted() {
        let path = "C:\\Build Test Ω漢字\\runtime\\service.exe";
        let p = launch_plan(path).unwrap();
        assert_eq!(
            String::from_utf16(&p.application[..p.application.len() - 1]).unwrap(),
            path
        );
        assert_eq!(
            String::from_utf16(&p.command_line[..p.command_line.len() - 1]).unwrap(),
            format!("\"{path}\"")
        );
        assert_eq!(
            String::from_utf16(&p.directory[..p.directory.len() - 1]).unwrap(),
            "C:\\Build Test Ω漢字\\runtime"
        );
    }
    #[test]
    fn service_environment_block_holds_exactly_system_root() {
        for root in [
            "C:\\Windows",
            "c:\\windows",
            "C:\\W",
            "D:\\OS Root Ω\\Windows",
        ] {
            assert_eq!(
                String::from_utf16(&service_environment(root).unwrap()).unwrap(),
                format!("SystemRoot={root}\0\0")
            );
        }
    }
    #[test]
    fn service_environment_refuses_malformed_or_injected_roots() {
        for root in [
            "",
            "Windows",
            "C:",
            "C:\\",
            "C:Windows",
            "C:/Windows",
            "\\\\server\\share\\Windows",
            "\\\\?\\C:\\Windows",
            "C:\\Windows\\",
            "C:\\Windows\\..\\Users",
            "C:\\.\\Windows",
            "1:\\Windows",
            "C:\\Win:dows",
            "C:\\Win<dows",
            "C:\\Win>dows",
            "C:\\Win\"dows",
            "C:\\Win/dows",
            "C:\\Win|dows",
            "C:\\Win?dows",
            "C:\\Win*dows",
            "C:\\Windows=PATH",
            "C:\\Windows\0PATH=C:\\x",
            "C:\\Windows\0",
            "Ω:\\Windows",
            "CΩ\\Windows",
            "C:Ω\\Windows",
            "C:\\Windows\nPATH",
        ] {
            assert_eq!(
                service_environment(root),
                Err(SupervisorError::SpawnFailed),
                "{root:?}"
            );
        }
        // The bound counts UTF-16 units, as CreateProcessW receives them.
        let longest = format!("C:\\{}\u{1D54E}", "w".repeat(255));
        assert_eq!(longest.encode_utf16().count(), 260);
        assert!(service_environment(&longest).is_ok());
        assert_eq!(
            service_environment(&format!("{longest}w")),
            Err(SupervisorError::SpawnFailed)
        );
    }
    #[test]
    fn unsafe_windows_paths_never_form_a_launch_plan() {
        for path in [
            "service.exe",
            "\\\\server\\share\\a.exe",
            "C:\\x\\..\\a.exe",
            "C:\\x\\a.exe:stream",
            "C:\\CON\\a.exe",
            "C:\\x.\\a.exe",
            "C:\\x\\a\0.exe",
            "C:\\x\\a.cmd",
        ] {
            assert!(launch_plan(path).is_err(), "{path:?}");
        }
    }
    #[test]
    fn creation_requires_atomic_job_assignment_suspension_and_no_console() {
        assert_eq!(
            launch_plan("C:\\runtime\\a.exe").unwrap().flags,
            CREATE_FLAGS
        );
        assert_eq!(CREATE_FLAGS & (0x10 | 0x8 | 0x01000000), 0);
        // Suspended, extended startup info, no console, and a UTF-16
        // environment block (service_environment builds UTF-16).
        for required in [0x4, 0x0008_0000, 0x0800_0000, 0x400] {
            assert_eq!(CREATE_FLAGS & required, required, "{required:#x}");
        }
    }
    #[test]
    fn handle_list_refuses_job_lease_aliases_and_invalid_handles() {
        assert_eq!(inherited_handles(1, 2, 3, 4, 5).unwrap(), [1, 2, 3]);
        for args in [
            (4, 2, 3, 4, 5),
            (1, 5, 3, 4, 5),
            (1, 1, 3, 4, 5),
            (0, 2, 3, 4, 5),
            (-1, 2, 3, 4, 5),
        ] {
            assert!(inherited_handles(args.0, args.1, args.2, args.3, args.4).is_err());
        }
    }
    #[test]
    fn exited_leader_cannot_hide_live_job_members() {
        assert_eq!(
            cleanup_status(Some(0), 1, true),
            Err(SupervisorError::CleanupPending)
        );
    }
    #[test]
    fn completed_job_cannot_hide_incomplete_private_io() {
        assert_eq!(
            cleanup_status(Some(0), 0, false),
            Err(SupervisorError::CleanupPending)
        );
    }
    #[test]
    fn only_terminal_empty_settled_job_is_cleanup_success() {
        assert_eq!(cleanup_status(Some(72), 0, true), Ok(Some(72)));
        assert_eq!(cleanup_status(None, 1, true), Ok(None));
    }
    #[test]
    fn ack_decoder_rejects_oversized_header_before_collecting_body() {
        let mut d = ReadyDecoder::default();
        assert_eq!(
            d.push(&4097u32.to_be_bytes()),
            Err(SupervisorError::ProtocolRejected)
        );
    }
    #[test]
    fn ack_decoder_rejects_trailing_bytes_in_same_completion() {
        let mut d = ReadyDecoder::default();
        let mut a = ack();
        a.push(0x1a);
        assert_eq!(d.push(&a), Err(SupervisorError::ProtocolRejected));
    }
    #[test]
    fn ack_decoder_never_authorizes_a_second_or_late_frame() {
        let mut d = ReadyDecoder::default();
        assert!(d.push(&ack()).unwrap().is_some());
        assert_eq!(d.push(&[0]), Err(SupervisorError::ProtocolRejected));
    }
    #[test]
    fn fragmented_ack_is_token_free_and_emitted_once() {
        let mut d = ReadyDecoder::default();
        let a = ack();
        for byte in &a[..a.len() - 1] {
            assert!(d.push(&[*byte]).unwrap().is_none());
        }
        let r = d.push(&a[a.len() - 1..]).unwrap().unwrap();
        assert!(r.matches(&super::super::ServiceIdentity {
            instance_id: "svc_00000000000000000000000000".into(),
            generation: 1,
            bind_port: 32123
        }));
    }
}

pub fn inventory_key(relative: &str) -> Result<String, SupervisorError> {
    if !relative.is_ascii() || relative.contains('\\') {
        return Err({
            eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
            SupervisorError::InvalidRuntime
        });
    }
    let native = relative.replace('/', "\\");
    launch_plan(&format!("C:\\{native}\\placeholder.exe"))?;
    Ok(relative.to_ascii_lowercase())
}
#[cfg(test)]
mod inventory_tests {
    use super::*;
    #[test]
    fn payload_case_aliases_share_one_key() {
        assert_eq!(
            inventory_key("a/DLL.dll").unwrap(),
            inventory_key("A/dll.DLL").unwrap()
        );
    }
    #[test]
    fn payload_names_reject_ads_reserved_and_ambiguous_components() {
        for p in [
            "a/x:stream",
            "a/CON.txt",
            "a/x.",
            "a/x ",
            "a/../x",
            "a/Ω.dll",
            "a/x\\y",
        ] {
            assert!(inventory_key(p).is_err(), "{p}");
        }
    }
    #[test]
    fn payload_normal_ascii_names_preserve_the_manifest_path() {
        assert_eq!(
            inventory_key("japp-orchestrator/_internal/python312.dll").unwrap(),
            "japp-orchestrator/_internal/python312.dll"
        );
    }
}

#[cfg(test)]
mod native_path_tests {
    use super::*;
    #[test]
    fn typed_resource_join_accepts_windows_separator_variants() {
        let plan =
            launch_plan("C:/Build Ω/runtime/japp-orchestrator/japp-orchestrator.exe").unwrap();
        assert_eq!(
            String::from_utf16(&plan.application[..plan.application.len() - 1]).unwrap(),
            "C:\\Build Ω\\runtime\\japp-orchestrator\\japp-orchestrator.exe"
        );
    }
    #[test]
    fn drive_root_executable_has_an_absolute_working_directory() {
        let plan = launch_plan("C:\\service.exe").unwrap();
        assert_eq!(
            String::from_utf16(&plan.directory[..plan.directory.len() - 1]).unwrap(),
            "C:\\"
        );
    }
}

pub fn opened_directory(attributes: u32) -> Result<bool, SupervisorError> {
    if attributes == u32::MAX || attributes & 0x400 != 0 {
        return Err({
            eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
            SupervisorError::InvalidRuntime
        });
    }
    Ok(attributes & 0x10 != 0)
}
#[cfg(test)]
mod opened_identity_tests {
    use super::*;
    #[test]
    fn opened_reparse_identity_never_uses_a_cached_directory_classification() {
        for attributes in [0x400, 0x410, u32::MAX] {
            assert_eq!(
                opened_directory(attributes),
                Err(SupervisorError::InvalidRuntime)
            );
        }
    }
    #[test]
    fn opened_regular_and_directory_identities_remain_distinct() {
        assert_eq!(opened_directory(0x10), Ok(true));
        assert_eq!(opened_directory(0x80), Ok(false));
    }
}

/// Resolve an immediate overlapped dispatch against completion observation.
/// The optional API count is not an authoritative completion observation.
pub fn resolve_immediate_overlapped_completion(
    _optional_reported_count: u32,
    query_completion: impl FnOnce() -> Result<Option<u32>, SupervisorError>,
) -> Result<Option<u32>, SupervisorError> {
    query_completion()
}

/// Keep lpValue referents in place until the attribute list has been deleted.
pub fn create_and_release_attributes<A, R>(
    attributes: &mut Option<A>,
    create: impl FnOnce() -> R,
) -> R {
    let result = create();
    drop(attributes.take());
    result
}

#[cfg(test)]
mod ffi_contract_tests {
    use super::*;
    use std::cell::Cell;

    #[test]
    fn immediate_overlapped_success_uses_authoritative_count_before_bootstrap_success() {
        let queries = Cell::new(0);
        let actual = resolve_immediate_overlapped_completion(0, || {
            queries.set(queries.get() + 1);
            Ok(Some(189))
        });
        assert_eq!(
            actual,
            Ok(Some(189)),
            "optional TRUE/count0 cannot replace the completed count"
        );
        assert_eq!(queries.get(), 1);
    }

    #[test]
    fn immediate_overlapped_success_cannot_settle_pending_completion() {
        let actual = resolve_immediate_overlapped_completion(0, || Ok(None));
        assert_eq!(
            actual,
            Ok(None),
            "pending authoritative observation must retain I/O ownership"
        );
    }

    #[test]
    fn immediate_overlapped_success_cannot_hide_terminal_observation_failure() {
        let actual =
            resolve_immediate_overlapped_completion(189, || Err(SupervisorError::ProtocolRejected));
        assert_eq!(actual, Err(SupervisorError::ProtocolRejected));
    }

    struct Attributes<'a>(&'a Cell<bool>);
    impl Drop for Attributes<'_> {
        fn drop(&mut self) {
            self.0.set(true);
        }
    }

    #[test]
    fn attribute_list_is_deleted_before_owner_relocation_on_both_create_outcomes() {
        for process_created in [true, false] {
            let deleted = Cell::new(false);
            let mut attributes = Some(Attributes(&deleted));
            let returned = create_and_release_attributes(&mut attributes, || {
                assert!(
                    !deleted.get(),
                    "list must remain alive throughout CreateProcess"
                );
                process_created
            });
            assert_eq!(returned, process_created);
            assert!(
                deleted.get(),
                "DeleteProcThreadAttributeList must precede moving the job owner"
            );
            assert!(
                attributes.is_none(),
                "no borrowed lpValue list may survive into child ownership"
            );
        }
    }
}
