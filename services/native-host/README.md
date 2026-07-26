# services/native-host

Rust binary registered as a Chrome native-messaging host. It authenticates
the extension installation, proxies bounded typed messages to the local
service, enforces capability allowlists and maximum message sizes, and
rejects malformed or privileged requests (docs/MASTER_IMPLEMENTATION_SPEC.md
§5.3, §5.4).

Created as a crate scaffold in M00-W02. Implementation begins in M17-W04;
until then the binary exits with a failure notice instead of pretending to
provide a transport.

Checks (from the repository root):

```bash
cargo fmt --manifest-path services/native-host/Cargo.toml --check
cargo clippy --manifest-path services/native-host/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path services/native-host/Cargo.toml
```
