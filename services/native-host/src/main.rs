//! Native-messaging host scaffold.
//!
//! The real bridge (extension allowlist, session handshake, loopback proxy,
//! redaction, capability limits) is work package M17-W04 in
//! docs/MASTER_IMPLEMENTATION_SPEC.md. Until then this binary refuses to run
//! rather than pretending to provide a transport.

use std::process::ExitCode;

fn unimplemented_notice() -> String {
    format!(
        "{} {}: the native-messaging host is not implemented until work package M17-W04; refusing to run.",
        env!("CARGO_PKG_NAME"),
        env!("CARGO_PKG_VERSION"),
    )
}

fn main() -> ExitCode {
    eprintln!("{}", unimplemented_notice());
    ExitCode::FAILURE
}

#[cfg(test)]
mod tests {
    use super::unimplemented_notice;

    #[test]
    fn notice_names_the_crate_and_owning_work_package() {
        let notice = unimplemented_notice();
        assert!(notice.contains("native-host"));
        assert!(notice.contains("M17-W04"));
    }
}
