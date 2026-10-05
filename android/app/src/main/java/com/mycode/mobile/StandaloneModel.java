package com.mycode.mobile;

import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.io.*;
import javax.net.ssl.HttpsURLConnection;
import org.json.*;

/** Explicit phone-owned credentials; never reads desktop pairing credentials. */
final class StandaloneModel {
 static URL endpoint(JSONObject profile) throws Exception {
  String base=profile.getString("url").replaceAll("/+$","");
  URL checked=new URL(base);
  if(!checked.getProtocol().equals("https")||checked.getHost().isEmpty()||checked.getUserInfo()!=null||checked.getQuery()!=null||checked.getRef()!=null)throw new IllegalArgumentException("Model endpoint must use HTTPS");
  String protocol=profile.optString("protocol","openai-completions");
  if(!protocol.equals("openai-completions")&&!protocol.equals("anthropic-messages"))throw new IllegalArgumentException("Unsupported model protocol");
  return new URL(base+(protocol.equals("anthropic-messages")?"/messages":"/chat/completions"));
 }
 static JSONObject request(JSONObject profile,JSONArray messages) throws Exception {
  if(messages.length()==0||messages.length()>200||profile.optString("model").trim().isEmpty()||profile.optString("key").trim().isEmpty())throw new IllegalArgumentException("Configure model and API key first");
  JSONArray clean=new JSONArray();
  for(int i=0;i<messages.length();i++){JSONObject item=messages.getJSONObject(i);String role=item.getString("role"),text=item.getString("text");if(!role.equals("user")&&!role.equals("assistant"))throw new IllegalArgumentException("Invalid message role");clean.put(new JSONObject().put("role",role).put("content",text));}
  JSONObject payload=new JSONObject().put("model",profile.getString("model")).put("messages",clean).put("stream",false);
  boolean anthropic=profile.optString("protocol").equals("anthropic-messages");if(anthropic)payload.put("max_tokens",4096);
  byte[] body=payload.toString().getBytes(StandardCharsets.UTF_8);if(body.length>2*1024*1024)throw new IOException("Conversation too large; start a new chat");
  HttpsURLConnection connection=(HttpsURLConnection)endpoint(profile).openConnection();connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(15000);connection.setReadTimeout(180000);connection.setRequestMethod("POST");connection.setRequestProperty("Content-Type","application/json");connection.setDoOutput(true);connection.setFixedLengthStreamingMode(body.length);
  if(anthropic){connection.setRequestProperty("x-api-key",profile.getString("key"));connection.setRequestProperty("anthropic-version","2023-06-01");}else connection.setRequestProperty("Authorization","Bearer "+profile.getString("key"));
  try {
   try(OutputStream output=connection.getOutputStream()){output.write(body);}
   int status=connection.getResponseCode();if(status!=200)throw new IOException("Model HTTP "+status);
   byte[] response;try(InputStream input=connection.getInputStream();ByteArrayOutputStream output=new ByteArrayOutputStream()){byte[] buffer=new byte[8192];int count;while((count=input.read(buffer))!=-1){if(output.size()+count>4*1024*1024)throw new IOException("Model response too large");output.write(buffer,0,count);}response=output.toByteArray();}
   JSONObject value=new JSONObject(new String(response,StandardCharsets.UTF_8));String text;
   if(anthropic){StringBuilder answer=new StringBuilder();JSONArray content=value.getJSONArray("content");for(int i=0;i<content.length();i++){JSONObject part=content.getJSONObject(i);if(part.optString("type").equals("text"))answer.append(part.optString("text"));}text=answer.toString();}
   else text=value.getJSONArray("choices").getJSONObject(0).getJSONObject("message").getString("content");
   if(text.trim().isEmpty())throw new IOException("Model returned no text");
   return new JSONObject().put("text",text).put("usage",value.optJSONObject("usage"));
  }finally{connection.disconnect();}
 }
}
