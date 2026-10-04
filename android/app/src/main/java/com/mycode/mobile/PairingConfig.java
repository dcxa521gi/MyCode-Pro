package com.mycode.mobile;

import java.net.URL;
import org.json.JSONObject;

public final class PairingConfig {
    public static JSONObject parse(String text) throws Exception {
        JSONObject value=new JSONObject(text.trim().replace("\uFEFF",""));
        URL url=new URL(value.getString("url"));
        if(!url.getProtocol().equals("https")||url.getHost().isEmpty()||url.getUserInfo()!=null||url.getQuery()!=null||url.getRef()!=null)throw new IllegalArgumentException("Invalid pairing address");
        String mode=value.optString("mode","direct");
        if(mode.equals("relay")) {
            String room=value.getString("room");
            if(!room.matches("[a-f0-9-]{36}")||!url.getPath().equals("/v1/rooms/"+room+"/request")||!value.getString("transportKey").matches("[a-fA-F0-9]{64}"))throw new IllegalArgumentException("Invalid remote pairing");
        } else if(mode.equals("direct")) {
            String fingerprint=value.getString("fingerprint").replaceAll("[\\s:]","").toLowerCase(java.util.Locale.ROOT);
            if(!url.getPath().equals("/mycode/v1")||!fingerprint.matches("[a-f0-9]{64}"))throw new IllegalArgumentException("Invalid desktop certificate");
            value.put("fingerprint",fingerprint);
        } else throw new IllegalArgumentException("Unsupported connection mode");
        if(!value.optString("pairing").matches("[a-f0-9]{64}"))throw new IllegalArgumentException("Pairing expired or invalid");
        value.put("mode",mode); return value;
    }
}
