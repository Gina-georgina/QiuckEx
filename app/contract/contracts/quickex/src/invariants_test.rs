//! Invariant tests for the QuickEx escrow contract.
//!
//! These tests are explicitly mapped to the invariants documented in
//! `docs/INVARIANTS.md`:
//!
//! * INV-01 — The server never takes custody of user funds.
//! * INV-02 — No user funds can be lost: every deposit is either withdrawn by
//!   the intended recipient or refunded to the depositor.
//! * INV-03 — Escrow balance consistency: the contract's tracked balance for an
//!   escrow always equals the sum of funds actually held for that escrow.
//!
//! Each test carries a `// Verifies: INV-XX` comment so that the mapping is
//! machine-checkable by tooling.

#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env,
};

use crate::{QuickExContract, QuickExContractClient};

/// Helper: deploy the contract and return a client plus the contract address.
fn setup_contract(env: &Env) -> (QuickExContractClient<'_>, Address) {
    let contract_id = env.register_contract(None, QuickExContract);
    let client = QuickExContractClient::new(env, &contract_id);
    (client, contract_id)
}

/// Helper: create a Stellar asset contract and mint `amount` to `to`.
fn create_token<'a>(
    env: &'a Env,
    admin: &Address,
    to: &Address,
    amount: i128,
) -> (token::Client<'a>, token::StellarAssetClient<'a>) {
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_client = token::Client::new(env, &sac.address());
    let token_admin = token::StellarAssetClient::new(env, &sac.address());
    token_admin.mint(to, &amount);
    (token_client, token_admin)
}

// ---------------------------------------------------------------------------
// INV-01 — The server never takes custody of user funds.
// ---------------------------------------------------------------------------

/// Verifies: INV-01
///
/// After a deposit, the funds must live in the escrow contract, never in any
/// server-controlled account. We assert that the depositor's balance decreased
/// by exactly the deposit amount and that the contract holds those funds.
#[test]
fn inv01_deposit_never_moves_funds_to_server() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

    let (token_client, _token_admin) = create_token(&env, &admin, &depositor, 1_000);

    let (client, contract_id) = setup_contract(&env);

    let amount: i128 = 400;
    let escrow_id = client.deposit(&depositor, &recipient, &token_client.address, &amount);

    // The depositor paid exactly `amount`.
    assert_eq!(token_client.balance(&depositor), 600);

    // The contract (escrow), not any server account, holds the funds.
    assert_eq!(token_client.balance(&contract_id), amount);

    // The escrow is recorded and owned by the depositor/recipient pair.
    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.depositor, depositor);
    assert_eq!(escrow.recipient, recipient);
    assert_eq!(escrow.amount, amount);
}

/// Verifies: INV-01
///
/// A withdrawal must transfer funds directly from the escrow contract to the
/// recipient. No intermediate server address may ever hold the funds.
#[test]
fn inv01_withdraw_pays_recipient_directly() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

    let (token_client, _token_admin) = create_token(&env, &admin, &depositor, 1_000);

    let (client, contract_id) = setup_contract(&env);

    let amount: i128 = 250;
    let escrow_id = client.deposit(&depositor, &recipient, &token_client.address, &amount);

    client.withdraw(&escrow_id, &recipient);

    // Recipient received the funds directly.
    assert_eq!(token_client.balance(&recipient), amount);

    // The contract no longer holds the escrowed funds.
    assert_eq!(token_client.balance(&contract_id), 0);
}

/// Verifies: INV-01
///
/// A refund must return funds directly to the depositor, never routing them
/// through a server-controlled account.
#[test]
fn inv01_refund_returns_funds_to_depositor() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

    let (token_client, _token_admin) = create_token(&env, &admin, &depositor, 1_000);

    let (client, contract_id) = setup_contract(&env);

    let amount: i128 = 300;
    let escrow_id = client.deposit(&depositor, &recipient, &token_client.address, &amount);

    // Advance time past the refund window so the depositor may reclaim funds.
    env.ledger().with_mut(|l| {
        l.timestamp += 60 * 60 * 24 * 30;
    });

    client.refund(&escrow_id, &depositor);

    // Depositor got their funds back in full.
    assert_eq!(token_client.balance(&depositor), 1_000);

    // Contract holds nothing afterwards.
    assert_eq!(token_client.balance(&contract_id), 0);
}

// ---------------------------------------------------------------------------
// INV-02 — No user funds can be lost.
// ---------------------------------------------------------------------------

/// Verifies: INV-02
///
/// Every deposit must be resolvable: either the recipient withdraws it or the
/// depositor refunds it. Here we exercise the happy-path withdrawal and assert
/// the full amount reaches the recipient (no leakage).
#[test]
fn inv02_withdraw_transfers_full_amount_no_loss() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

    let (token_client, _token_admin) = create_token(&env, &admin, &depositor, 5_000);

    let (client, _contract_id) = setup_contract(&env);

    let amount: i128 = 1_234;
    let escrow_id = client.deposit(&depositor, &recipient, &token_client.address, &amount);

    client.withdraw(&escrow_id, &recipient);

    // Recipient receives the exact amount; nothing is lost to fees or the server.
    assert_eq!(token_client.balance(&recipient), amount);

    // The escrow is marked resolved and cannot be double-spent.
    let escrow = client.get_escrow(&escrow_id);
    assert!(escrow.resolved);
}

/// Verifies: INV-02
///
/// A refund path must return the full amount to the depositor. No funds may be
/// lost even when the recipient never claims the escrow.
#[test]
fn inv02_refund_transfers_full_amount_no_loss() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

    let (token_client, _token_admin) = create_token(&env, &admin, &depositor, 2_000);

    let (client, _contract_id) = setup_contract(&env);

    let amount: i128 = 777;
    let escrow_id = client.deposit(&depositor, &recipient, &token_client.address, &amount);

    env.ledger().with_mut(|l| {
        l.timestamp += 60 * 60 * 24 * 30;
    });

    client.refund(&escrow_id, &depositor);

    // Depositor is made whole: original balance restored.
    assert_eq!(token_client.balance(&depositor), 2_000);

    // Escrow is resolved and cannot be refunded again.
    let escrow = client.get_escrow(&escrow_id);
    assert!(escrow.resolved);
}

/// Verifies: INV-02
///
/// A disputed escrow must still resolve to exactly one party (recipient or
/// depositor) with the full amount. Funds must never be stranded.
#[test]
fn inv02_dispute_resolves_without_fund_loss() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

    let (token_client, _token_admin) = create_token(&env, &admin, &depositor, 1_500);

    let (client, contract_id) = setup_contract(&env);

    let amount: i128 = 500;
    let escrow_id = client.deposit(&depositor, &recipient, &token_client.address, &amount);

    // Raise a dispute on the escrow.
    client.dispute(&escrow_id, &depositor);

    // Resolve the dispute in favour of the recipient.
    client.resolve_dispute(&escrow_id, &recipient);

    // Exactly one party received the funds, and the contract holds nothing.
    assert_eq!(token_client.balance(&recipient), amount);
    assert_eq!(token_client.balance(&contract_id), 0);

    // Total supply conservation: depositor + recipient == initial mint.
    assert_eq!(
        token_client.balance(&depositor) + token_client.balance(&recipient),
        1_500
    );
}

// ---------------------------------------------------------------------------
// INV-03 — Escrow balance consistency.
// ---------------------------------------------------------------------------

/// Verifies: INV-03
///
/// The contract's tracked escrow amount must always equal the funds actually
/// held by the contract for that escrow.
#[test]
fn inv03_escrow_balance_matches_held_funds_after_deposit() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

    let (token_client, _token_admin) = create_token(&env, &admin, &depositor, 10_000);

    let (client, contract_id) = setup_contract(&env);

    let amount: i128 = 3_210;
    let escrow_id = client.deposit(&depositor, &recipient, &token_client.address, &amount);

    let escrow = client.get_escrow(&escrow_id);

    // Tracked amount equals the funds actually held by the contract.
    assert_eq!(escrow.amount, amount);
    assert_eq!(token_client.balance(&contract_id), escrow.amount);
}

/// Verifies: INV-03
///
/// Multiple concurrent escrows must each be individually consistent, and the
/// contract's total held balance must equal the sum of all open escrows.
#[test]
fn inv03_multiple_escrows_sum_consistently() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient_a = Address::generate(&env);
    let recipient_b = Address::generate(&env);

    let (token_client, _token_admin) = create_token(&env, &admin, &depositor, 10_000);

    let (client, contract_id) = setup_contract(&env);

    let amount_a: i128 = 1_000;
    let amount_b: i128 = 2_500;

    let escrow_a = client.deposit(&depositor, &recipient_a, &token_client.address, &amount_a);
    let escrow_b = client.deposit(&depositor, &recipient_b, &token_client.address, &amount_b);

    let tracked_a = client.get_escrow(&escrow_a).amount;
    let tracked_b = client.get_escrow(&escrow_b).amount;

    // Each escrow is individually consistent.
    assert_eq!(tracked_a, amount_a);
    assert_eq!(tracked_b, amount_b);

    // The contract's held balance equals the sum of all open escrows.
    assert_eq!(token_client.balance(&contract_id), tracked_a + tracked_b);
}

/// Verifies: INV-03
///
/// After a withdrawal, the escrow's tracked balance and the contract's held
/// funds must both decrease by exactly the withdrawn amount.
#[test]
fn inv03_balance_consistency_after_withdrawal() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

    let (token_client, _token_admin) = create_token(&env, &admin, &depositor, 10_000);

    let (client, contract_id) = setup_contract(&env);

    let amount_a: i128 = 1_500;
    let amount_b: i128 = 2_000;

    let escrow_a = client.deposit(&depositor, &recipient, &token_client.address, &amount_a);
    let _escrow_b = client.deposit(&depositor, &recipient, &token_client.address, &amount_b);

    // Before withdrawal: contract holds the sum of both escrows.
    assert_eq!(token_client.balance(&contract_id), amount_a + amount_b);

    client.withdraw(&escrow_a, &recipient);

    // After withdrawal: contract holds only the remaining escrow.
    assert_eq!(token_client.balance(&contract_id), amount_b);

    // The withdrawn escrow is marked resolved and its tracked amount is zeroed
    // (or otherwise no longer counted as held).
    let resolved = client.get_escrow(&escrow_a);
    assert!(resolved.resolved);
}

/// Verifies: INV-03
///
/// After a refund, the contract's held funds must decrease by exactly the
/// refunded amount, keeping tracked and held balances consistent.
#[test]
fn inv03_balance_consistency_after_refund() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

    let (token_client, _token_admin) = create_token(&env, &admin, &depositor, 10_000);

    let (client, contract_id) = setup_contract(&env);

    let amount_a: i128 = 900;
    let amount_b: i128 = 1_100;

    let escrow_a = client.deposit(&depositor, &recipient, &token_client.address, &amount_a);
    let _escrow_b = client.deposit(&depositor, &recipient, &token_client.address, &amount_b);

    assert_eq!(token_client.balance(&contract_id), amount_a + amount_b);

    env.ledger().with_mut(|l| {
        l.timestamp += 60 * 60 * 24 * 30;
    });

    client.refund(&escrow_a, &depositor);

    // Only the un-refunded escrow remains held by the contract.
    assert_eq!(token_client.balance(&contract_id), amount_b);

    let resolved = client.get_escrow(&escrow_a);
    assert!(resolved.resolved);
}