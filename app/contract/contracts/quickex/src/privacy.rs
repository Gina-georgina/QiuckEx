use crate::errors::QuickexError;
use crate::events::publish_privacy_toggled;
use crate::storage::{DataKey, PRIVACY_ENABLED_KEY};
use soroban_sdk::{Address, Env, Symbol};

/// Grace period (in ledgers) during which the old key remains valid after a
/// rotation is activated.
const KEY_ROTATION_GRACE_LEDGERS: u32 = 17_280;

/// Status of a pending or completed key rotation for an account.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct KeyRotationStatus {
    /// The new key that will (or does) replace the old key.
    pub new_key: Symbol,
    /// Ledger sequence at which the rotation was announced.
    pub announced_at: u32,
    /// Ledger sequence at which the rotation becomes active.
    pub activates_at: u32,
    /// Ledger sequence at which the old key stops being valid.
    pub grace_ends_at: u32,
    /// Whether the rotation has been activated.
    pub activated: bool,
    /// Whether the rotation has been revoked.
    pub revoked: bool,
}

fn key_rotation_key(owner: &Address) -> DataKey {
    DataKey::KeyRotation(owner.clone())
}

fn key_rotation_nonce_key(owner: &Address) -> DataKey {
    DataKey::KeyRotationNonce(owner.clone())
}

fn read_key_rotation(env: &Env, owner: &Address) -> Option<KeyRotationStatus> {
    env.storage().persistent().get(&key_rotation_key(owner))
}

fn read_key_rotation_nonce(env: &Env, owner: &Address) -> u64 {
    env.storage()
        .persistent()
        .get(&key_rotation_nonce_key(owner))
        .unwrap_or(0)
}

fn write_key_rotation_nonce(env: &Env, owner: &Address, nonce: u64) {
    env.storage()
        .persistent()
        .set(&key_rotation_nonce_key(owner), &nonce);
}

/// Announce a key rotation for an account.
///
/// The rotation is recorded but not yet active. The old key remains valid until
/// [`activate_key_rotation`] is called and the grace period elapses. The
/// `nonce` must be strictly greater than the last consumed nonce to prevent
/// replay.
pub fn announce_key_rotation(
    env: &Env,
    owner: Address,
    new_key: Symbol,
    nonce: u64,
) -> Result<(), QuickexError> {
    owner.require_auth();

    let last_nonce = read_key_rotation_nonce(env, &owner);
    if nonce <= last_nonce {
        return Err(QuickexError::InvalidNonce);
    }

    if let Some(existing) = read_key_rotation(env, &owner) {
        if !existing.revoked && !existing.activated {
            return Err(QuickexError::KeyRotationAlreadyAnnounced);
        }
    }

    let now = env.ledger().sequence();
    let status = KeyRotationStatus {
        new_key: new_key.clone(),
        announced_at: now,
        activates_at: now,
        grace_ends_at: now.saturating_add(KEY_ROTATION_GRACE_LEDGERS),
        activated: false,
        revoked: false,
    };

    env.storage()
        .persistent()
        .set(&key_rotation_key(&owner), &status);
    write_key_rotation_nonce(env, &owner, nonce);

    publish_key_rotation_announced(env, owner, new_key, nonce);
    Ok(())
}

/// Activate a previously announced key rotation.
///
/// Once activated, the old key remains valid until `grace_ends_at`.
pub fn activate_key_rotation(env: &Env, owner: Address, nonce: u64) -> Result<(), QuickexError> {
    owner.require_auth();

    let last_nonce = read_key_rotation_nonce(env, &owner);
    if nonce <= last_nonce {
        return Err(QuickexError::InvalidNonce);
    }

    let mut status = read_key_rotation(env, &owner).ok_or(QuickexError::KeyRotationNotFound)?;
    if status.revoked {
        return Err(QuickexError::KeyRotationRevoked);
    }
    if status.activated {
        return Err(QuickexError::KeyRotationAlreadyActivated);
    }

    let now = env.ledger().sequence();
    status.activated = true;
    status.activates_at = now;
    status.grace_ends_at = now.saturating_add(KEY_ROTATION_GRACE_LEDGERS);

    env.storage()
        .persistent()
        .set(&key_rotation_key(&owner), &status);
    write_key_rotation_nonce(env, &owner, nonce);

    publish_key_rotation_activated(env, owner, status.new_key.clone(), status.grace_ends_at);
    Ok(())
}

/// Revoke a pending or active key rotation.
///
/// After revocation the old key remains the authoritative key.
pub fn revoke_key_rotation(env: &Env, owner: Address, nonce: u64) -> Result<(), QuickexError> {
    owner.require_auth();

    let last_nonce = read_key_rotation_nonce(env, &owner);
    if nonce <= last_nonce {
        return Err(QuickexError::InvalidNonce);
    }

    let mut status = read_key_rotation(env, &owner).ok_or(QuickexError::KeyRotationNotFound)?;
    if status.revoked {
        return Err(QuickexError::KeyRotationRevoked);
    }

    status.revoked = true;

    env.storage()
        .persistent()
        .set(&key_rotation_key(&owner), &status);
    write_key_rotation_nonce(env, &owner, nonce);

    publish_key_rotation_revoked(env, owner, status.new_key.clone());
    Ok(())
}

/// Return the current key rotation status for an account, if any.
///
/// The returned status reflects the grace period: `grace_ends_at` is the ledger
/// sequence until which the old key remains valid.
pub fn get_key_rotation_status(env: &Env, owner: Address) -> Option<KeyRotationStatus> {
    read_key_rotation(env, &owner)
}

fn legacy_privacy_key(env: &Env, owner: &Address) -> (Symbol, Address) {
    (Symbol::new(env, PRIVACY_ENABLED_KEY), owner.clone())
}

fn typed_privacy_key(owner: &Address) -> DataKey {
    DataKey::PrivacyEnabled(owner.clone())
}

fn read_privacy_flag(env: &Env, owner: &Address) -> bool {
    let typed_key = typed_privacy_key(owner);
    if let Some(enabled) = env.storage().persistent().get(&typed_key) {
        return enabled;
    }

    env.storage()
        .persistent()
        .get(&legacy_privacy_key(env, owner))
        .unwrap_or(false)
}

/// Enable or disable privacy for an account.
///
/// Reads the current state first and returns [`QuickexError::PrivacyAlreadySet`]
/// if the requested value matches the current value. Otherwise persists the new
/// state and publishes a [`crate::events::publish_privacy_toggled`] event.
pub fn set_privacy(env: &Env, owner: Address, enabled: bool) -> Result<(), QuickexError> {
    owner.require_auth();

    let current = read_privacy_flag(env, &owner);
    if current == enabled {
        return Err(QuickexError::PrivacyAlreadySet);
    }

    let typed_key = typed_privacy_key(&owner);
    env.storage().persistent().set(&typed_key, &enabled);

    let legacy_key = legacy_privacy_key(env, &owner);
    if env.storage().persistent().has(&legacy_key) {
        env.storage().persistent().remove(&legacy_key);
    }

    publish_privacy_toggled(env, owner, enabled);
    Ok(())
}

/// Return the current boolean privacy state for an account.
///
/// Defaults to `false` if never set.
pub fn get_privacy(env: &Env, owner: Address) -> bool {
    read_privacy_flag(env, &owner)
}
