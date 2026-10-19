mod build_support;
mod ipc_policy;
fn main() {
    let base = std::path::PathBuf::from(
        std::env::var_os("CARGO_MANIFEST_DIR").expect("Cargo manifest directory"),
    );
    let target = std::env::var("TARGET").expect("Cargo target");
    let descriptor = build_support::descriptor_for_build(&base, &target);
    let descriptor =
        descriptor.unwrap_or_else(|_| panic!("Native runtime payload failed validation"));
    let source = if let Some(d) = descriptor {
        format!(
            "const COMPILED_RUNTIME: Option<BoundRuntime> = Some(BoundRuntime {{build_executable: {:?},resource_relative: {:?},executable_sha256: {:?},manifest_sha256: {:?},target: {:?} }});",
            d.build_executable.to_str().expect("build path UTF8"),
            d.resource_relative,
            d.executable_sha256,
            d.manifest_sha256,
            target
        )
    } else {
        "const COMPILED_RUNTIME: Option<BoundRuntime> = None;".into()
    };
    std::fs::write(
        std::path::PathBuf::from(std::env::var_os("OUT_DIR").expect("Cargo output directory"))
            .join("runtime_descriptor.rs"),
        source,
    )
    .expect("write compile-bound descriptor");
    println!("cargo:rerun-if-changed=runtime-payload");
    let windows_msvc = std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc");
    let attributes = tauri_build::Attributes::new()
        .app_manifest(tauri_build::AppManifest::new().commands(ipc_policy::SERVICE_COMMANDS));
    let attributes = if windows_msvc {
        // MSVC's linker owns the one RT_MANIFEST for every executable,
        // including the lib test harness. Tauri still emits icon/version
        // resources, but must not add a second manifest to resource.lib.
        attributes.windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest())
    } else {
        attributes
    };
    tauri_build::try_build(attributes).expect("Desktop command policy could not be built");
    if windows_msvc {
        let manifest = base.join("windows-common-controls.manifest");
        println!("cargo:rerun-if-changed={}", manifest.display());
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
    }
}
