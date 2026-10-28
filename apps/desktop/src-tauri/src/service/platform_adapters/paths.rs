use super::policy::{
    PathFailure, PathRequest, PathRole, PathState, Reason, Scope, WorkPermit, check, valid_segment,
};
use crate::service::Clock;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    path::{Component, Path, PathBuf},
    time::Duration,
};

pub(super) const BUNDLE_ID: &str = "dev.jobapply.desktop";
/// Native SDK roots are deliberately neither Debug nor Serialize.
pub(crate) struct TrustedBases {
    data: PathBuf,
    cache: PathBuf,
    temporary: PathBuf,
    bundle_id: String,
}
impl TrustedBases {
    pub(super) fn new(
        data: PathBuf,
        cache: PathBuf,
        temporary: PathBuf,
        bundle_id: &str,
        override_configured: bool,
    ) -> Result<Self, PathFailure> {
        let valid = |p: &Path| {
            p.is_absolute()
                && p.as_os_str().as_encoded_bytes().len() <= 32 * 1024
                && !p
                    .components()
                    .any(|c| matches!(c, Component::CurDir | Component::ParentDir))
                && p.parent().is_some()
        };
        if override_configured
            || bundle_id != BUNDLE_ID
            || ![&data, &cache, &temporary].into_iter().all(|p| valid(p))
        {
            return Err(PathFailure::Invalid);
        }
        let persistent = data.join("data");
        let disposable = cache.join("cache");
        let temp = temporary.join(bundle_id);
        if [&disposable, &temp]
            .into_iter()
            .any(|p| persistent.starts_with(p) || p.starts_with(&persistent))
            || disposable.starts_with(&temp)
            || temp.starts_with(&disposable)
        {
            return Err(PathFailure::Identity);
        }
        Ok(Self {
            data,
            cache,
            temporary,
            bundle_id: bundle_id.into(),
        })
    }
}
#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) struct DirectoryIdentity(pub u64, pub u64);
#[derive(Clone, Copy)]
pub(super) enum BaseKind {
    Application,
    SharedTemporary,
}
/// Narrow adapter-private native directory ownership seam, not a process owner.
pub(super) trait DirectoryOps {
    type Lease: Clone;
    fn open_base(
        &mut self,
        path: &Path,
        kind: BaseKind,
        create: bool,
    ) -> Result<Self::Lease, PathFailure>;
    fn child(
        &mut self,
        parent: &Self::Lease,
        name: &str,
        create: bool,
        fresh: bool,
    ) -> Result<Self::Lease, PathFailure>;
    fn open_base_permitted(
        &mut self,
        path: &Path,
        kind: BaseKind,
        create: bool,
        permit: &impl WorkPermit,
    ) -> Result<Self::Lease, PathFailure> {
        check(permit)?;
        self.open_base(path, kind, create)
    }
    fn child_permitted(
        &mut self,
        parent: &Self::Lease,
        name: &str,
        create: bool,
        fresh: bool,
        permit: &impl WorkPermit,
    ) -> Result<Self::Lease, PathFailure> {
        check(permit)?;
        self.child(parent, name, create, fresh)
    }
    fn register_owned(&mut self, _lease: &Self::Lease) -> Result<(), PathFailure> {
        Ok(())
    }
    fn cleanup_auxiliary_permitted(
        &mut self,
        permit: &impl CleanupPermit,
    ) -> Result<(), PathFailure> {
        permit.check_cleanup()?;
        self.cleanup_auxiliary()?;
        permit.check_cleanup()
    }
    fn verify(&mut self, lease: &Self::Lease) -> Result<(), PathFailure>;
    fn identity(&self, lease: &Self::Lease) -> DirectoryIdentity;
    fn location<'a>(&self, lease: &'a Self::Lease) -> &'a Path;
    fn writable_probe(
        &mut self,
        lease: &Self::Lease,
        permit: &impl WorkPermit,
    ) -> Result<bool, PathFailure>;
    fn remove_owned_empty(&mut self, lease: Self::Lease) -> Result<(), (PathFailure, Self::Lease)>;
    /// Keep the caller's lease in place across a fallible removal or unwind.
    fn remove_retained(&mut self, lease: &mut Self::Lease) -> Result<(), PathFailure> {
        match self.remove_owned_empty(lease.clone()) {
            Ok(()) => Ok(()),
            Err((error, retained)) => {
                *lease = retained;
                Err(error)
            }
        }
    }
    fn same_or_ancestor(&self, ancestor: &Self::Lease, descendant: &Self::Lease) -> bool {
        self.identity(ancestor) == self.identity(descendant)
            || self
                .location(descendant)
                .starts_with(self.location(ancestor))
    }
    fn auxiliary_cleanup_pending(&self) -> bool {
        false
    }
    fn cleanup_auxiliary(&mut self) -> Result<(), PathFailure> {
        Ok(())
    }
}
/// Preparation may observe native state or obtain entropy/security metadata.
/// It cannot authorize a later probe mutation after the original permit expires.
/// The create closure must retain a successful acquisition before any postcheck.
pub(super) fn admit_writable_probe<T>(
    permit: &impl WorkPermit,
    prepare: impl FnOnce() -> Result<T, PathFailure>,
    create: impl FnOnce(T) -> Result<bool, PathFailure>,
) -> Result<bool, PathFailure> {
    check(permit)?;
    let prepared = prepare()?;
    check(permit)?;
    create(prepared)
}

pub(super) trait NonceSource {
    fn next(&mut self) -> Result<String, PathFailure>;
}

/// Separate cleanup permission cannot authorize new work or restore a revoked lease.
pub(crate) trait CleanupPermit {
    fn check_cleanup(&self) -> Result<(), PathFailure>;
}
impl<T: WorkPermit> CleanupPermit for T {
    fn check_cleanup(&self) -> Result<(), PathFailure> {
        check(self)
    }
}
pub(crate) struct CleanupBudget<'a> {
    clock: &'a dyn Clock,
    deadline: Duration,
}
impl<'a> CleanupBudget<'a> {
    pub(crate) fn new(clock: &'a dyn Clock, total: Duration) -> Result<Self, PathFailure> {
        if total.is_zero() || total > Duration::from_secs(3) {
            return Err(PathFailure::Invalid);
        }
        let deadline = clock.now().checked_add(total).ok_or(PathFailure::Invalid)?;
        Ok(Self { clock, deadline })
    }
    pub(crate) fn clipped(
        clock: &'a dyn Clock,
        total: Duration,
        deadline: Duration,
    ) -> Result<Self, PathFailure> {
        let mut budget = Self::new(clock, total)?;
        budget.deadline = budget.deadline.min(deadline);
        budget.check_cleanup()?;
        Ok(budget)
    }
}
impl CleanupPermit for CleanupBudget<'_> {
    fn check_cleanup(&self) -> Result<(), PathFailure> {
        if self.clock.now() >= self.deadline {
            Err(PathFailure::Timeout)
        } else {
            Ok(())
        }
    }
}

/// Canonical result fields only. Generated-contract owner supplies provenance metadata.
#[derive(Clone, Debug, Serialize)]
pub struct PathResolutionFields {
    pub role: PathRole,
    pub scope: Scope,
    pub resolution_state: PathState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sanitized_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path_digest: Option<String>,
    pub exists: bool,
    pub writable: bool,
    pub reason_codes: Vec<Reason>,
}
impl PathResolutionFields {
    fn failure(request: &PathRequest, error: PathFailure, exists: bool) -> Self {
        Self {
            role: request.role,
            scope: request.scope,
            resolution_state: match error {
                PathFailure::Permission => PathState::DeniedPermission,
                PathFailure::NotEvaluated => PathState::NotEvaluated,
                _ => PathState::Unavailable,
            },
            sanitized_path: None,
            path_digest: None,
            exists: error == PathFailure::Permission && exists,
            writable: false,
            reason_codes: vec![error.reason()],
        }
    }
}
/// The sole disposable-directory owner is intentionally not Clone/Debug/Serialize.
pub(super) struct OwnedPath<L> {
    role: PathRole,
    lease: Option<L>,
    cleanup_stack: Vec<L>,
}
pub(super) struct NativePathResolution<L> {
    pub view: PathResolutionFields,
    pub(super) owned: Option<OwnedPath<L>>,
}
struct RoleRoots<L> {
    data: L,
    cache: L,
}
pub(super) struct PathProvider<O: DirectoryOps, N: NonceSource> {
    roots: TrustedBases,
    ops: O,
    nonce: N,
    role_roots: Option<RoleRoots<O::Lease>>,
    pending: Option<OwnedPath<O::Lease>>,
}
impl<O: DirectoryOps, N: NonceSource> PathProvider<O, N> {
    pub(super) fn new(roots: TrustedBases, ops: O, nonce: N) -> Self {
        Self {
            roots,
            ops,
            nonce,
            role_roots: None,
            pending: None,
        }
    }
    fn persistent_roots(
        &mut self,
        create: bool,
        permit: &impl WorkPermit,
    ) -> Result<(), PathFailure> {
        check(permit)?;
        if self.role_roots.is_none() {
            let base = self.ops.open_base_permitted(
                &self.roots.data,
                BaseKind::Application,
                create,
                permit,
            )?;
            check(permit)?;
            let data = self
                .ops
                .child_permitted(&base, "data", create, false, permit)?;
            check(permit)?;
            let base = self.ops.open_base_permitted(
                &self.roots.cache,
                BaseKind::Application,
                create,
                permit,
            )?;
            check(permit)?;
            let cache = self
                .ops
                .child_permitted(&base, "cache", create, false, permit)?;
            check(permit)?;
            if self.ops.same_or_ancestor(&data, &cache) || self.ops.same_or_ancestor(&cache, &data)
            {
                return Err(PathFailure::Identity);
            }
            self.role_roots = Some(RoleRoots { data, cache });
        }
        let roots = self.role_roots.as_ref().ok_or(PathFailure::Missing)?;
        self.ops.verify(&roots.data)?;
        check(permit)?;
        self.ops.verify(&roots.cache)?;
        check(permit)
    }
    pub(super) fn resolve(
        &mut self,
        request: &PathRequest,
        permit: &impl WorkPermit,
    ) -> NativePathResolution<O::Lease> {
        let mut began = false;
        let mut exists = false;
        let result = (|| {
            check(permit)?;
            let reference = request.validate()?;
            if self.ops.auxiliary_cleanup_pending() {
                return Err(PathFailure::Busy);
            }
            if request.role == PathRole::Temporary && self.pending.is_some() {
                return Err(PathFailure::Busy);
            }
            self.persistent_roots(request.create_if_missing, permit)?;
            let roots = self.role_roots.as_ref().ok_or(PathFailure::Missing)?;
            let mut lease = match request.role {
                PathRole::ApplicationData | PathRole::ArtifactStore => roots.data.clone(),
                PathRole::Cache => roots.cache.clone(),
                PathRole::Temporary => {
                    if !request.create_if_missing {
                        return Err(PathFailure::Policy);
                    }
                    let base = self.ops.open_base_permitted(
                        &self.roots.temporary,
                        BaseKind::SharedTemporary,
                        false,
                        permit,
                    )?;
                    check(permit)?;
                    let namespace = self.ops.child_permitted(
                        &base,
                        &self.roots.bundle_id,
                        true,
                        false,
                        permit,
                    )?;
                    check(permit)?;
                    if [&roots.data, &roots.cache].into_iter().any(|root| {
                        self.ops.same_or_ancestor(root, &namespace)
                            || self.ops.same_or_ancestor(&namespace, root)
                    }) {
                        return Err(PathFailure::Identity);
                    }
                    // At most one nonce plus eight validated relative components.
                    // Reserve storage and retain its owner before any fresh create.
                    let mut stack = Vec::new();
                    stack.try_reserve_exact(9).map_err(|_| PathFailure::Busy)?;
                    self.pending = Some(OwnedPath {
                        role: PathRole::Temporary,
                        lease: None,
                        cleanup_stack: stack,
                    });
                    began = true;
                    let mut fresh = None;
                    for _ in 0..3 {
                        check(permit)?;
                        let nonce = self.nonce.next()?;
                        if !valid_segment(&nonce) {
                            return Err(PathFailure::Invalid);
                        }
                        match self
                            .ops
                            .child_permitted(&namespace, &nonce, true, true, permit)
                        {
                            Ok(lease) => {
                                self.pending
                                    .as_mut()
                                    .ok_or(PathFailure::Identity)?
                                    .cleanup_stack
                                    .push(lease.clone());
                                self.ops.register_owned(&lease)?;
                                fresh = Some(lease);
                                break;
                            }
                            Err(PathFailure::Collision) => continue,
                            Err(cause) => return Err(cause),
                        }
                    }
                    check(permit)?;
                    fresh.ok_or(PathFailure::Collision)?
                }
                _ => return Err(PathFailure::NotEvaluated),
            };
            if request.role == PathRole::ArtifactStore {
                lease = self.ops.child_permitted(
                    &lease,
                    "artifacts",
                    request.create_if_missing,
                    false,
                    permit,
                )?;
                check(permit)?;
            }
            for segment in &request.relative_segments {
                check(permit)?;
                self.ops.verify(&lease)?;
                let fresh = request.role == PathRole::Temporary;
                lease = self.ops.child_permitted(
                    &lease,
                    segment,
                    request.create_if_missing,
                    fresh,
                    permit,
                )?;
                if fresh {
                    self.pending
                        .as_mut()
                        .ok_or(PathFailure::Identity)?
                        .cleanup_stack
                        .push(lease.clone());
                    self.ops.register_owned(&lease)?;
                }
                check(permit)?;
            }
            self.ops.verify(&lease)?;
            exists = true;
            check(permit)?;
            if !self.ops.writable_probe(&lease, permit)? {
                return Err(PathFailure::Permission);
            }
            check(permit)?;
            self.ops.verify(&lease)?;
            check(permit)?;
            let digest = Sha256::digest(self.ops.location(&lease).as_os_str().as_encoded_bytes());
            let digest = format!(
                "sha256:{}",
                digest
                    .iter()
                    .map(|b| format!("{b:02x}"))
                    .collect::<String>()
            );
            // No asynchronous result can bypass this final monotonic/authority fence.
            check(permit)?;
            // Construct every allocating view field before ownership transfer.
            let view = PathResolutionFields {
                role: request.role,
                scope: request.scope,
                resolution_state: PathState::Resolved,
                sanitized_path: Some(reference),
                path_digest: Some(digest),
                exists: true,
                writable: true,
                reason_codes: vec![],
            };
            let mut owned = if request.role == PathRole::Temporary {
                self.pending.take().ok_or(PathFailure::Identity)?
            } else {
                OwnedPath {
                    role: request.role,
                    lease: None,
                    cleanup_stack: vec![],
                }
            };
            owned.lease = Some(lease);
            Ok((view, owned))
        })();
        match result {
            Ok((view, owned)) => NativePathResolution {
                view,
                owned: Some(owned),
            },
            Err(error) => {
                if began
                    && self
                        .pending
                        .as_ref()
                        .is_some_and(|p| p.cleanup_stack.is_empty())
                    && !self.ops.auxiliary_cleanup_pending()
                {
                    self.pending = None;
                }
                NativePathResolution {
                    view: PathResolutionFields::failure(request, error, exists),
                    owned: None,
                }
            }
        }
    }
    pub(super) fn cleanup(
        &mut self,
        owned: &mut OwnedPath<O::Lease>,
        permit: &impl CleanupPermit,
    ) -> Result<(), PathFailure> {
        Self::cleanup_entry(&mut self.ops, owned, permit)
    }
    fn cleanup_entry(
        ops: &mut O,
        owned: &mut OwnedPath<O::Lease>,
        permit: &impl CleanupPermit,
    ) -> Result<(), PathFailure> {
        if owned.role != PathRole::Temporary {
            return Err(PathFailure::Policy);
        }
        permit.check_cleanup()?;
        owned.lease = None;
        while let Some(lease) = owned.cleanup_stack.last_mut() {
            permit.check_cleanup()?;
            ops.register_owned(lease)?;
            ops.remove_retained(lease)?;
            owned.cleanup_stack.pop();
            permit.check_cleanup()?;
        }
        Ok(())
    }
    pub(super) fn cleanup_pending(
        &mut self,
        permit: &impl CleanupPermit,
    ) -> Result<(), PathFailure> {
        permit.check_cleanup()?;
        // Reconcile an unwind after stack retention but before acknowledgement.
        // Both owners stay in place until this pure, allocation-free handoff.
        let mut first = None;
        if let Some(owned) = &self.pending {
            for lease in &owned.cleanup_stack {
                permit.check_cleanup()?;
                if let Err(error) = self.ops.register_owned(lease) {
                    first.get_or_insert(error);
                }
            }
        }
        if let Err(error) = self.ops.cleanup_auxiliary_permitted(permit) {
            first.get_or_insert(error);
        }
        permit.check_cleanup()?;
        if let Some(owned) = &mut self.pending {
            if let Err(error) = Self::cleanup_entry(&mut self.ops, owned, permit) {
                first.get_or_insert(error);
            }
            if owned.cleanup_stack.is_empty() {
                self.pending = None;
            }
        }
        first.map_or(Ok(()), Err)
    }
    pub(super) fn pending_cleanup(&self) -> bool {
        self.pending.is_some() || self.ops.auxiliary_cleanup_pending()
    }
}
/// Native-only handle. Only `view` may be copied into generated DTO metadata.
/// The provider, not the consumer, retains every issued temp cleanup lease.
#[must_use]
pub struct PathOutcome {
    pub view: PathResolutionFields,
    handle: Option<u64>,
}
pub(super) struct PathOwner<O: DirectoryOps, N: NonceSource> {
    provider: PathProvider<O, N>,
    issued: std::collections::BTreeMap<u64, NativePathResolution<O::Lease>>,
}
// Process-lifetime uniqueness also fences outcomes retained across owner recreation.
// A single CAS fails promptly under contention; this path never spins or reuses IDs.
static NEXT_PATH_HANDLE: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
fn reserve_path_handle() -> Result<u64, PathFailure> {
    use std::sync::atomic::Ordering;
    let value = NEXT_PATH_HANDLE.load(Ordering::Acquire);
    #[cfg(test)]
    super::fixture_isolation::after_handle_load();
    let next = value.checked_add(1).ok_or(PathFailure::Busy)?;
    NEXT_PATH_HANDLE
        .compare_exchange(value, next, Ordering::AcqRel, Ordering::Acquire)
        .map(|_| value)
        .map_err(|_| PathFailure::Busy)
}
impl<O: DirectoryOps, N: NonceSource> PathOwner<O, N> {
    pub(super) fn new(provider: PathProvider<O, N>) -> Self {
        Self {
            provider,
            issued: std::collections::BTreeMap::new(),
        }
    }
    pub(super) fn resolve(
        &mut self,
        request: &PathRequest,
        permit: &impl WorkPermit,
    ) -> Result<PathOutcome, PathFailure> {
        check(permit)?;
        // Canonical requests permit SYSTEM only for native host registration.
        // Invalid request combinations are native failures, never result DTOs.
        if request.scope == Scope::System && request.role != PathRole::NativeHostRegistration {
            return Err(PathFailure::Policy);
        }
        // A finite native registry avoids unbounded retained handles; dropping a
        // consumer's outcome cannot discard the provider's cleanup ownership.
        if request.role == PathRole::Temporary && self.issued.len() >= 64 {
            return Err(PathFailure::Busy);
        }
        let reserved = if request.role == PathRole::Temporary {
            Some(reserve_path_handle()?)
        } else {
            None
        };
        if let Some(id) = reserved {
            self.issued.insert(
                id,
                NativePathResolution {
                    view: PathResolutionFields::failure(request, PathFailure::Busy, false),
                    owned: None,
                },
            );
        }
        let resolution = self.provider.resolve(request, permit);
        let (view, handle) = if let Some(id) = reserved {
            let slot = self
                .issued
                .get_mut(&id)
                .expect("entry reserved before native work");
            *slot = resolution;
            let view = slot.view.clone();
            if slot.owned.is_some() {
                (view, Some(id))
            } else {
                self.issued.remove(&id);
                (view, None)
            }
        } else {
            (resolution.view, None)
        };
        check(permit)?;
        Ok(PathOutcome { view, handle })
    }
    pub(super) fn cleanup(
        &mut self,
        outcome: &mut PathOutcome,
        permit: &impl CleanupPermit,
    ) -> Result<(), PathFailure> {
        let Some(id) = outcome.handle else {
            return Err(PathFailure::Policy);
        };
        let resolution = self.issued.get_mut(&id).ok_or(PathFailure::Invalid)?;
        let owned = resolution.owned.as_mut().ok_or(PathFailure::Invalid)?;
        self.provider.cleanup(owned, permit)?;
        self.issued.remove(&id);
        outcome.handle = None;
        Ok(())
    }
    /// Caller retains this owner after an error and retries within a new explicit
    /// shutdown budget. This never makes a revoked WorkPermit active again.
    pub(super) fn cleanup_all(&mut self, permit: &impl CleanupPermit) -> Result<(), PathFailure> {
        permit.check_cleanup()?;
        let mut first = self.provider.cleanup_pending(permit).err();
        let mut previous = None;
        loop {
            permit.check_cleanup()?;
            let next = match previous {
                None => self.issued.keys().next().copied(),
                Some(id) => self
                    .issued
                    .range((std::ops::Bound::Excluded(id), std::ops::Bound::Unbounded))
                    .next()
                    .map(|(k, _)| *k),
            };
            let Some(id) = next else {
                break;
            };
            previous = Some(id);
            let resolution = self.issued.get_mut(&id).ok_or(PathFailure::Identity)?;
            let result = match resolution.owned.as_mut() {
                Some(owned) => self.provider.cleanup(owned, permit),
                // Preallocated empty registration left by an unwind: the
                // provider/book still owns its operation, not this placeholder.
                None => Ok(()),
            };
            match result {
                Ok(()) => {
                    self.issued.remove(&id);
                }
                Err(error) => {
                    first.get_or_insert(error);
                }
            }
        }
        first.map_or(Ok(()), Err)
    }

    pub(super) fn pending_cleanup(&self) -> bool {
        self.provider.pending_cleanup() || !self.issued.is_empty()
    }
}

#[cfg(test)]
#[path = "tests.rs"]
mod tests;

#[cfg(test)]
#[path = "probe_admission_tests.rs"]
mod probe_admission_tests;

/// Read-only settlement after native deletion releases its sole handle.
/// A visible original stays pending; a replacement is never adopted/deleted.
#[cfg(any(windows, test, feature = "windows-source-check"))]
pub(super) fn settled_deleted_directory(
    owned: DirectoryIdentity,
    named: Option<DirectoryIdentity>,
) -> Result<(), PathFailure> {
    match named {
        None => Ok(()),
        Some(named) if named == owned => Err(PathFailure::Busy),
        Some(_) => Err(PathFailure::Identity),
    }
}
