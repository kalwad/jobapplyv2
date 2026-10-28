//! Bounded owner-held directory creation transaction. No native calls live here.
use super::paths::CleanupPermit;
use super::policy::{PathFailure, WorkPermit, check};
use std::sync::Arc;

const CAPACITY: usize = 64;
#[derive(Clone)]
pub(super) struct Token {
    owner: Arc<()>,
    slot: usize,
    serial: u64,
}
#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) enum Stage {
    Reserved,
    Creating,
    Created,
    Validated,
}
#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) enum Mode {
    Existing,
    Persistent,
    Temporary,
}
#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) enum Created {
    New,
    Existing,
}
pub(super) trait CreationLease: Clone {
    fn token(&self) -> Option<&Token>;
    fn set_token(&self, token: Token) -> Result<(), PathFailure>;
}
struct Record<L> {
    lease: L,
    stage: Stage,
    mode: Mode,
    serial: u64,
}
pub(super) struct CreationBook<L> {
    owner: Arc<()>,
    serial: u64,
    acknowledged: [u64; CAPACITY],
    entries: [Option<Record<L>>; CAPACITY],
}
impl<L> Default for CreationBook<L> {
    fn default() -> Self {
        Self {
            owner: Arc::new(()),
            serial: 0,
            acknowledged: [0; CAPACITY],
            entries: std::array::from_fn(|_| None),
        }
    }
}
impl<L: CreationLease> CreationBook<L> {
    pub(super) fn pending(&self) -> bool {
        self.entries.iter().any(Option::is_some)
    }
    fn reserve(&mut self, lease: L, mode: Mode) -> Result<Token, PathFailure> {
        let slot = self
            .entries
            .iter()
            .position(Option::is_none)
            .ok_or(PathFailure::Busy)?;
        let serial = self.serial.checked_add(1).ok_or(PathFailure::Busy)?;
        let token = Token {
            owner: self.owner.clone(),
            slot,
            serial,
        };
        lease.set_token(token.clone())?;
        self.serial = serial;
        self.entries[slot] = Some(Record {
            lease,
            stage: Stage::Reserved,
            mode,
            serial,
        });
        Ok(token)
    }
    fn record(&mut self, token: &Token) -> Result<&mut Record<L>, PathFailure> {
        if !Arc::ptr_eq(&self.owner, &token.owner) {
            return Err(PathFailure::Identity);
        }
        self.entries
            .get_mut(token.slot)
            .and_then(Option::as_mut)
            .filter(|r| r.serial == token.serial)
            .ok_or(PathFailure::Identity)
    }
    fn advance(&mut self, token: &Token, stage: Stage) -> Result<(), PathFailure> {
        self.record(token)?.stage = stage;
        Ok(())
    }
    fn release(&mut self, token: &Token) -> Result<(), PathFailure> {
        self.record(token)?;
        self.entries[token.slot] = None;
        Ok(())
    }
    /// Provider calls only after its preallocated cleanup stack retains the lease.
    pub(super) fn acknowledge(&mut self, lease: &L) -> Result<(), PathFailure> {
        let Some(token) = lease.token() else {
            return Ok(());
        };
        if !Arc::ptr_eq(&self.owner, &token.owner) {
            return Err(PathFailure::Identity);
        }
        // Reconciliation of an already acknowledged ancestor is idempotent,
        // including while its former slot holds a newer provisional child.
        if self
            .acknowledged
            .get(token.slot)
            .is_some_and(|serial| *serial >= token.serial)
        {
            return Ok(());
        }
        if self.record(token)?.stage != Stage::Validated {
            return Err(PathFailure::Busy);
        }
        self.release(token)?;
        self.acknowledged[token.slot] = token.serial;
        Ok(())
    }
    /// Entries stay in place across errors and unwinding. One pending entry does
    /// not discard other owned entries; each operation uses the same finite budget.
    pub(super) fn cleanup(
        &mut self,
        permit: &impl CleanupPermit,
        mut settle: impl FnMut(&mut L, Stage, Mode) -> Result<(), PathFailure>,
    ) -> Result<(), PathFailure> {
        let mut first = None;
        for entry in &mut self.entries {
            permit.check_cleanup()?;
            if let Some(record) = entry {
                let result = if record.stage == Stage::Reserved {
                    Ok(())
                } else {
                    settle(&mut record.lease, record.stage, record.mode)
                };
                match result {
                    Ok(()) => *entry = None,
                    Err(error) => {
                        first.get_or_insert(error);
                    }
                }
                permit.check_cleanup()?;
            }
        }
        first.map_or(Ok(()), Err)
    }
}

/// The prepared lease is allocated before native creation. Native acquisition
/// installs its first handle before stat/security; cleanup never acquires a new
/// deletion identity from a name when that initial acquisition failed.
pub(super) fn create_and_acquire<L: CreationLease>(
    book: &mut CreationBook<L>,
    lease: L,
    mode: Mode,
    permit: Option<&dyn WorkPermit>,
    create: impl FnOnce() -> Result<Created, PathFailure>,
    acquire: impl FnOnce(&L) -> Result<(), PathFailure>,
    validate: impl FnOnce(&L) -> Result<(), PathFailure>,
) -> Result<L, PathFailure> {
    if book.pending() {
        return Err(PathFailure::Busy);
    }
    let token = if mode == Mode::Existing {
        None
    } else {
        Some(book.reserve(lease.clone(), mode)?)
    };
    if let Some(permit) = permit
        && let Err(error) = check(permit)
    {
        if let Some(token) = &token {
            book.release(token)?;
        }
        return Err(error);
    }
    let mut owns_creation = false;
    if let Some(token) = &token {
        // A panic during the call retains uncertainty; a known error never claims
        // a collision. Success is marked before the next fallible operation.
        book.advance(token, Stage::Creating)?;
        match create() {
            Ok(Created::New) => {
                book.advance(token, Stage::Created)?;
                owns_creation = true;
            }
            Ok(Created::Existing) => {
                book.release(token)?;
            }
            Err(error) => {
                book.release(token)?;
                return Err(error);
            }
        }
    }
    if let Some(permit) = permit {
        check(permit)?;
    }
    acquire(&lease)?;
    if let Some(permit) = permit {
        check(permit)?;
    }
    validate(&lease)?;
    if let Some(permit) = permit {
        check(permit)?;
    }
    if owns_creation {
        let token = token.as_ref().ok_or(PathFailure::Identity)?;
        if mode == Mode::Temporary {
            book.advance(token, Stage::Validated)?;
        } else {
            book.release(token)?;
        }
    }
    Ok(lease)
}

/// A missing name settles an unacquired reservation. An initial handle, when
/// retained, must also prove the original is unlinked; a rename is not deletion.
pub(super) fn settle_absence(held_unlinked: Option<bool>) -> Result<(), PathFailure> {
    if held_unlinked == Some(false) {
        Err(PathFailure::Identity)
    } else {
        Ok(())
    }
}

#[cfg(test)]
#[path = "ownership_tests.rs"]
mod tests;
