#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env, String, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Store {
    pub owner: Address,
    pub name: String,
    pub lat: i32, // Latitude * 1,000,000
    pub lng: i32, // Longitude * 1,000,000
}

#[contracttype]
pub enum DataKey {
    Stores,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    StoreAlreadyExists = 1,
    StoreDoesNotExist = 2,
    InvalidName = 3,
}

#[contract]
pub struct SariSariRegistryContract;

#[contractimpl]
impl SariSariRegistryContract {
    /// Register a new store. A wallet address is restricted to registering at most one store.
    pub fn register_store(
        env: Env,
        owner: Address,
        name: String,
        lat: i32,
        lng: i32,
    ) -> Result<(), Error> {
        // Authenticate the owner
        owner.require_auth();

        // Validate name length
        if name.len() == 0 {
            return Err(Error::InvalidName);
        }

        // Retrieve the current stores list
        let mut stores: Vec<Store> = env
            .storage()
            .instance()
            .get(&DataKey::Stores)
            .unwrap_or_else(|| Vec::new(&env));

        // Check if this owner already registered a store
        for i in 0..stores.len() {
            let store = stores.get(i).unwrap();
            if store.owner == owner {
                return Err(Error::StoreAlreadyExists);
            }
        }

        // Add the new store
        let new_store = Store {
            owner: owner.clone(),
            name,
            lat,
            lng,
        };
        stores.push_back(new_store);

        // Save list and extend TTL to maintain state
        env.storage().instance().set(&DataKey::Stores, &stores);
        env.storage().instance().extend_ttl(1000, 5000);

        Ok(())
    }

    /// Deregister a store. The caller must be the owner.
    pub fn deregister_store(env: Env, owner: Address) -> Result<(), Error> {
        // Authenticate the owner
        owner.require_auth();

        // Retrieve current stores list
        let mut stores: Vec<Store> = env
            .storage()
            .instance()
            .get(&DataKey::Stores)
            .unwrap_or_else(|| Vec::new(&env));

        let mut index_to_remove: Option<u32> = None;
        for i in 0..stores.len() {
            let store = stores.get(i).unwrap();
            if store.owner == owner {
                index_to_remove = Some(i);
                break;
            }
        }

        if let Some(index) = index_to_remove {
            stores.remove(index);
            env.storage().instance().set(&DataKey::Stores, &stores);
            env.storage().instance().extend_ttl(1000, 5000);
            Ok(())
        } else {
            Err(Error::StoreDoesNotExist)
        }
    }

    /// Retrieve all registered stores.
    pub fn get_all_stores(env: Env) -> Vec<Store> {
        env.storage()
            .instance()
            .get(&DataKey::Stores)
            .unwrap_or_else(|| Vec::new(&env))
    }
}

mod test;
