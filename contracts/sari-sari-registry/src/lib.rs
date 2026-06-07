#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, Env, String, Symbol,
};
const MAX_NAME_LENGTH: u32 = 50;
const MIN_TTL: u32 = 17280; // ~1 day at 5s ledgers
const EXTEND_TO: u32 = 518400; // ~30 days

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
    Store(Address),
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
        let name_len = name.len();
        if name_len == 0 || name_len > MAX_NAME_LENGTH {
            return Err(Error::InvalidName);
        }

        let store_key = DataKey::Store(owner.clone());

        // Check if this owner already registered a store
        if env.storage().persistent().has(&store_key) {
            return Err(Error::StoreAlreadyExists);
        }

        // Add the new store
        let new_store = Store {
            owner: owner.clone(),
            name: name.clone(),
            lat,
            lng,
        };

        // Save entry and extend TTL to maintain state
        env.storage().persistent().set(&store_key, &new_store);
        env.storage()
            .persistent()
            .extend_ttl(&store_key, MIN_TTL, EXTEND_TO);

        // Emit an event for indexers
        env.events()
            .publish((Symbol::new(&env, "StoreRegistered"),), new_store);

        Ok(())
    }

    /// Deregister a store. The caller must be the owner.
    pub fn deregister_store(env: Env, owner: Address) -> Result<(), Error> {
        // Authenticate the owner
        owner.require_auth();

        let store_key = DataKey::Store(owner.clone());

        if !env.storage().persistent().has(&store_key) {
            return Err(Error::StoreDoesNotExist);
        }

        // Remove the store
        env.storage().persistent().remove(&store_key);

        // Emit an event for indexers (pass owner so it knows who to deregister)
        env.events()
            .publish((Symbol::new(&env, "StoreDeregistered"),), owner);

        Ok(())
    }

    /// Retrieve a single registered store by its owner.
    pub fn get_store(env: Env, owner: Address) -> Option<Store> {
        let store_key = DataKey::Store(owner);
        let store: Option<Store> = env.storage().persistent().get(&store_key);

        // If found, extend TTL so it doesn't expire
        if store.is_some() {
            env.storage()
                .persistent()
                .extend_ttl(&store_key, MIN_TTL, EXTEND_TO);
        }

        store
    }
}

mod test;
