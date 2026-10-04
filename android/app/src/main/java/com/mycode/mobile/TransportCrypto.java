package com.mycode.mobile;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.json.JSONObject;

/** AES-GCM with a direction/room/request binding shared with the desktop. */
public final class TransportCrypto {
    private static byte[] key(String text) {
        if (!text.matches("[a-fA-F0-9]{64}")) throw new IllegalArgumentException("Invalid transport key");
        byte[] bytes = new byte[32];
        for (int i=0;i<32;i++) bytes[i]=(byte)Integer.parseInt(text.substring(i*2,i*2+2),16);
        return bytes;
    }
    public static JSONObject seal(String key, JSONObject value, String aad) throws Exception {
        byte[] nonce = new byte[12]; new SecureRandom().nextBytes(nonce);
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE,new SecretKeySpec(key(key),"AES"),new GCMParameterSpec(128,nonce));
        cipher.updateAAD(aad.getBytes(StandardCharsets.UTF_8));
        byte[] data=cipher.doFinal(value.toString().getBytes(StandardCharsets.UTF_8));
        return new JSONObject().put("nonce",Base64.getEncoder().encodeToString(nonce)).put("ciphertext",Base64.getEncoder().encodeToString(data));
    }
    public static JSONObject open(String key, JSONObject value, String aad) throws Exception {
        byte[] nonce=Base64.getDecoder().decode(value.getString("nonce"));
        if(nonce.length!=12||value.getString("ciphertext").length()>5600000)throw new IllegalArgumentException("Invalid encrypted reply");
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE,new SecretKeySpec(key(key),"AES"),new GCMParameterSpec(128,nonce));
        cipher.updateAAD(aad.getBytes(StandardCharsets.UTF_8));
        return new JSONObject(new String(cipher.doFinal(Base64.getDecoder().decode(value.getString("ciphertext"))),StandardCharsets.UTF_8));
    }
}
