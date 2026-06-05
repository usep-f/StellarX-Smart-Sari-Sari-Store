#![cfg(test)]
use super::*;
use soroban_sdk::{Env, Address, String};
use soroban_sdk::testutils::Address as _;

fn setup(env: &Env) -> SariSariRegistryContractClient<'_> {
    let contract_id = env.register(SariSariRegistryContract, ());
    SariSariRegistryContractClient::new(env, &contract_id)
}

#[test]
fn test_register_and_get_all() {
    let env = Env::default();
    env.mock_all_auths();
    let client = setup(&env);

    let owner = Address::generate(&env);
    let store_name = String::from_str(&env, "Ate Joy's Store");
    
    // Check initial state is empty
    assert_eq!(client.get_all_stores().len(), 0);

    // Register store
    client.register_store(&owner, &store_name, &14599500, &121060900);

    // Verify list contains registered store
    let stores = client.get_all_stores();
    assert_eq!(stores.len(), 1);
    
    let store = stores.get(0).unwrap();
    assert_eq!(store.owner, owner);
    assert_eq!(store.name, store_name);
    assert_eq!(store.lat, 14599500);
    assert_eq!(store.lng, 121060900);
}

#[test]
fn test_prevent_duplicate_registration() {
    let env = Env::default();
    env.mock_all_auths();
    let client = setup(&env);

    let owner = Address::generate(&env);
    let name1 = String::from_str(&env, "First Store");
    let name2 = String::from_str(&env, "Second Store");

    client.register_store(&owner, &name1, &14599500, &121060900);
    
    // Attempt duplicate registration
    let result = client.try_register_store(&owner, &name2, &14599500, &121060900);
    assert_eq!(result, Err(Ok(Error::StoreAlreadyExists)));
}

#[test]
fn test_deregister() {
    let env = Env::default();
    env.mock_all_auths();
    let client = setup(&env);

    let owner1 = Address::generate(&env);
    let owner2 = Address::generate(&env);
    let name1 = String::from_str(&env, "Store One");
    let name2 = String::from_str(&env, "Store Two");

    client.register_store(&owner1, &name1, &1000, &2000);
    client.register_store(&owner2, &name2, &3000, &4000);

    assert_eq!(client.get_all_stores().len(), 2);

    // Deregister owner 1
    client.deregister_store(&owner1);

    // Verify only owner 2 remains
    let stores = client.get_all_stores();
    assert_eq!(stores.len(), 1);
    assert_eq!(stores.get(0).unwrap().owner, owner2);

    // Deregister owner 2
    client.deregister_store(&owner2);
    assert_eq!(client.get_all_stores().len(), 0);
}

#[test]
fn test_deregister_non_existent() {
    let env = Env::default();
    env.mock_all_auths();
    let client = setup(&env);

    let owner = Address::generate(&env);
    let result = client.try_deregister_store(&owner);
    assert_eq!(result, Err(Ok(Error::StoreDoesNotExist)));
}

#[test]
fn test_invalid_name() {
    let env = Env::default();
    env.mock_all_auths();
    let client = setup(&env);

    let owner = Address::generate(&env);
    let empty_name = String::from_str(&env, "");

    let result = client.try_register_store(&owner, &empty_name, &1000, &2000);
    assert_eq!(result, Err(Ok(Error::InvalidName)));
}
