use base64::{engine::general_purpose::STANDARD, Engine};
use ring::{
    aead,
    rand::{SecureRandom, SystemRandom},
};
use serde_json::{json, Value};

pub fn key_bytes(key: &str) -> Result<Vec<u8>, String> {
    if key.len() != 64 || !key.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("Invalid transport key".into());
    }
    (0..64)
        .step_by(2)
        .map(|i| u8::from_str_radix(&key[i..i + 2], 16).map_err(|_| "Invalid transport key".into()))
        .collect()
}
fn cipher(key: &str) -> Result<aead::LessSafeKey, String> {
    aead::UnboundKey::new(&aead::AES_256_GCM, &key_bytes(key)?)
        .map(aead::LessSafeKey::new)
        .map_err(|_| "Invalid transport key".into())
}
pub fn seal(key: &str, value: &Value, aad: &str) -> Result<Value, String> {
    let mut nonce = [0u8; 12];
    SystemRandom::new()
        .fill(&mut nonce)
        .map_err(|_| "Random generation failed")?;
    let mut data = serde_json::to_vec(value).map_err(|_| "Invalid payload")?;
    cipher(key)?
        .seal_in_place_append_tag(
            aead::Nonce::assume_unique_for_key(nonce),
            aead::Aad::from(aad.as_bytes()),
            &mut data,
        )
        .map_err(|_| "Encryption failed")?;
    Ok(json!({"nonce":STANDARD.encode(nonce),"ciphertext":STANDARD.encode(data)}))
}
pub fn open(key: &str, envelope: &Value, aad: &str) -> Result<Value, String> {
    let nonce = STANDARD
        .decode(envelope["nonce"].as_str().unwrap_or(""))
        .map_err(|_| "Invalid nonce")?;
    let nonce: [u8; 12] = nonce.try_into().map_err(|_| "Invalid nonce")?;
    let text = envelope["ciphertext"]
        .as_str()
        .ok_or("Invalid ciphertext")?;
    if text.len() > 96_000 {
        return Err("Encrypted request too large".into());
    }
    let mut data = STANDARD.decode(text).map_err(|_| "Invalid ciphertext")?;
    let plain = cipher(key)?
        .open_in_place(
            aead::Nonce::assume_unique_for_key(nonce),
            aead::Aad::from(aad.as_bytes()),
            &mut data,
        )
        .map_err(|_| "Encrypted request authentication failed")?;
    if plain.len() > 65536 {
        return Err("Request too large".into());
    }
    serde_json::from_slice(plain).map_err(|_| "Invalid encrypted JSON".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shared_android_node_vector_decrypts() {
        let e = json!({"nonce":"IiIiIiIiIiIiIiIi","ciphertext":"bNVmKrSm8DHHBfxPLciN9zOxuYcS9Y5xcKixT+5ayOrkxkyZ/YrV/Co9m0SFPR1a2LfwQK9QDpvHAMedhx2G0R2uMBo44XMoyRNT4GKMjXjIjIFDueUXyeXgPLinxMJUVyUkyQ=="});
        assert_eq!(
            open(&"11".repeat(32), &e, "mycode:request:fixture-room").unwrap()["text"],
            "继续项目"
        );
    }
    #[test]
    fn encrypted_requests_reject_tampering_wrong_room_and_wrong_key() {
        let key = "11".repeat(32);
        let value = json!({"action":"send","text":"继续项目","deviceToken":"private"});
        let mut e = seal(&key, &value, "mycode:request:room").unwrap();
        assert!(!e.to_string().contains("private"));
        assert_eq!(open(&key, &e, "mycode:request:room").unwrap(), value);
        assert!(open(&key, &e, "mycode:response:room").is_err());
        assert!(open(&"22".repeat(32), &e, "mycode:request:room").is_err());
        e["ciphertext"] = json!("AAAA");
        assert!(open(&key, &e, "mycode:request:room").is_err());
    }
    #[test]
    fn keys_and_nonces_are_validated() {
        assert!(key_bytes("short").is_err());
        assert!(key_bytes(&"gg".repeat(32)).is_err());
        assert!(open(
            &"11".repeat(32),
            &json!({"nonce":"AAAA","ciphertext":"AAAA"}),
            "room"
        )
        .is_err());
    }
}
