#![cfg(test)]
use super::*;
use soroban_sdk::{Env, Address, String};
use soroban_sdk::testutils::Address as _;

fn setup(env: &Env) -> SariSariRegistryContractClient<'_> {
    let contract_id = env.register(SariSariRegistryContract, ());
    SariSariRegistryContractClient::new(env, &contract_id)
}

#[test]
fn test_register_and_get() {
    let env = Env::default();
    env.mock_all_auths();
    let client = setup(&env);

    let owner = Address::generate(&env);
    let manager = Address::generate(&env);
    let store_name = String::from_str(&env, "Ate Joy's Store");
    
    // Check initial state is empty
    assert!(client.get_store(&owner).is_none());

    // Register store
    client.register_store(&owner, &manager, &store_name, &14599500, &121060900);

    // Verify store exists
    let store = client.get_store(&owner).unwrap();
    assert_eq!(store.owner, owner);
    assert_eq!(store.manager, manager);
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
    let manager = Address::generate(&env);
    let name1 = String::from_str(&env, "First Store");
    let name2 = String::from_str(&env, "Second Store");

    client.register_store(&owner, &manager, &name1, &14599500, &121060900);
    
    // Attempt duplicate registration
    let result = client.try_register_store(&owner, &manager, &name2, &14599500, &121060900);
    assert_eq!(result, Err(Ok(Error::StoreAlreadyExists)));
}

#[test]
fn test_deregister() {
    let env = Env::default();
    env.mock_all_auths();
    let client = setup(&env);

    let owner1 = Address::generate(&env);
    let owner2 = Address::generate(&env);
    let manager1 = Address::generate(&env);
    let manager2 = Address::generate(&env);
    let name1 = String::from_str(&env, "Store One");
    let name2 = String::from_str(&env, "Store Two");

    client.register_store(&owner1, &manager1, &name1, &1000, &2000);
    client.register_store(&owner2, &manager2, &name2, &3000, &4000);

    assert!(client.get_store(&owner1).is_some());
    assert!(client.get_store(&owner2).is_some());

    // Deregister owner 1 as the owner
    client.deregister_store(&owner1, &owner1);

    // Verify owner 1 is gone but owner 2 remains
    assert!(client.get_store(&owner1).is_none());
    assert!(client.get_store(&owner2).is_some());

    // Deregister owner 2 as the manager
    client.deregister_store(&owner2, &manager2);
    assert!(client.get_store(&owner2).is_none());
}

#[test]
fn test_deregister_non_existent() {
    let env = Env::default();
    env.mock_all_auths();
    let client = setup(&env);

    let owner = Address::generate(&env);
    let result = client.try_deregister_store(&owner, &owner);
    assert_eq!(result, Err(Ok(Error::StoreDoesNotExist)));
}

#[test]
fn test_invalid_name() {
    let env = Env::default();
    env.mock_all_auths();
    let client = setup(&env);

    let owner = Address::generate(&env);
    let manager = Address::generate(&env);
    let empty_name = String::from_str(&env, "");

    let result = client.try_register_store(&owner, &manager, &empty_name, &1000, &2000);
    assert_eq!(result, Err(Ok(Error::InvalidName)));

    // Test too long name (51 chars)
    let too_long_name = String::from_str(&env, "This is a store name that is definitely over fifty characters long");
    let result2 = client.try_register_store(&owner, &manager, &too_long_name, &1000, &2000);
    assert_eq!(result2, Err(Ok(Error::InvalidName)));
}

#[test]
fn test_manager_update_and_auth() {
    let env = Env::default();
    env.mock_all_auths();
    let client = setup(&env);

    let owner = Address::generate(&env);
    let manager1 = Address::generate(&env);
    let manager2 = Address::generate(&env);
    let store_name = String::from_str(&env, "My Store");

    client.register_store(&owner, &manager1, &store_name, &0, &0);
    
    // Update manager to manager2
    client.update_manager(&owner, &manager2);
    
    let store = client.get_store(&owner).unwrap();
    assert_eq!(store.manager, manager2);
    
    // Verify unauthorized deregister fails
    let rando = Address::generate(&env);
    let result = client.try_deregister_store(&owner, &rando);
    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}
