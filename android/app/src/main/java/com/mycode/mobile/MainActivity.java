package com.mycode.mobile;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.webkit.*;
import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;
import org.json.JSONObject;
import java.io.*;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.cert.*;
import java.util.UUID;
import java.util.concurrent.Executors;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import javax.net.ssl.*;

/** Offline UI; authenticated HTTPS to the explicitly paired desktop only. */
public final class MainActivity extends Activity {
 private WebView web;
 private JSONObject credentials;
 private final java.util.concurrent.ExecutorService network = Executors.newSingleThreadExecutor();
 private String locale="zh-CN";
 @Override public void onCreate(Bundle state){super.onCreate(state);web=new WebView(this);setContentView(web);
  web.setOnApplyWindowInsetsListener((view,insets)->{if(android.os.Build.VERSION.SDK_INT>=30){android.graphics.Insets edges=insets.getInsets(android.view.WindowInsets.Type.systemBars()|android.view.WindowInsets.Type.ime());view.setPadding(edges.left,edges.top,edges.right,edges.bottom);}else{view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());}return insets;});
  web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(false);web.getSettings().setAllowContentAccess(false);web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowFileAccessFromFileURLs(false);web.getSettings().setAllowUniversalAccessFromFileURLs(false);web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  web.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return !request.getUrl().toString().equals("file:///android_asset/index.html");}@Override public void onPageFinished(WebView view,String url){restore();if(credentials!=null){try{callback("boot",new JSONObject().put("connected",true));}catch(Exception ignored){}}}});
  web.addJavascriptInterface(new Bridge(),"Desktop");web.loadUrl("file:///android_asset/index.html");
 }
 private void callback(String id,JSONObject result){runOnUiThread(()->web.evaluateJavascript("window.onNative("+JSONObject.quote(id)+","+result+")",null));}
 private JSONObject error(String text){JSONObject result=new JSONObject();try{result.put("error",text);}catch(Exception ignored){}return result;}
 private javax.crypto.SecretKey key() throws Exception {KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);if(!store.containsAlias("mycode-pairing")){KeyGenerator generator=KeyGenerator.getInstance("AES","AndroidKeyStore");generator.init(new KeyGenParameterSpec.Builder("mycode-pairing",KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());generator.generateKey();}return (javax.crypto.SecretKey)store.getKey("mycode-pairing",null);}
 private void persist() throws Exception {Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());String sealed=Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(credentials.toString().getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP);getSharedPreferences("pairing",MODE_PRIVATE).edit().putString("sealed",sealed).apply();}
 private void restore(){try{String sealed=getSharedPreferences("pairing",MODE_PRIVATE).getString("sealed",null);if(sealed==null)return;String[] parts=sealed.split(":",2);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));credentials=new JSONObject(new String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),StandardCharsets.UTF_8));}catch(Exception e){credentials=null;getSharedPreferences("pairing",MODE_PRIVATE).edit().clear().apply();}}
 private JSONObject post(JSONObject config,JSONObject request) throws Exception {
  String endpoint=config.getString("url"),fingerprint=config.getString("fingerprint").toLowerCase();URL url=new URL(endpoint);
  if(!url.getProtocol().equals("https")||!url.getPath().equals("/mycode/v1")||url.getUserInfo()!=null||url.getQuery()!=null||!fingerprint.matches("[a-f0-9]{64}"))throw new IOException("Invalid pairing address");
  X509TrustManager pinned=new X509TrustManager(){public X509Certificate[] getAcceptedIssuers(){return new X509Certificate[0];}public void checkClientTrusted(X509Certificate[] c,String a) throws CertificateException{throw new CertificateException("Client TLS unsupported");}public void checkServerTrusted(X509Certificate[] chain,String auth) throws CertificateException{try{if(chain.length==0)throw new CertificateException("Missing certificate");StringBuilder actual=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(chain[0].getEncoded()))actual.append(String.format(java.util.Locale.ROOT,"%02x",b&255));if(!MessageDigest.isEqual(actual.toString().getBytes(StandardCharsets.US_ASCII),fingerprint.getBytes(StandardCharsets.US_ASCII)))throw new CertificateException("Desktop certificate changed. Pair again.");}catch(GeneralSecurityException e){throw new CertificateException(e);}}};
  SSLContext tls=SSLContext.getInstance("TLS");tls.init(null,new TrustManager[]{pinned},new SecureRandom());HttpsURLConnection connection=(HttpsURLConnection)url.openConnection();connection.setSSLSocketFactory(tls.getSocketFactory());connection.setHostnameVerifier((host,session)->host.equals(url.getHost()));connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(8000);connection.setReadTimeout(25000);connection.setRequestMethod("POST");connection.setRequestProperty("Content-Type","application/json");connection.setDoOutput(true);byte[] body=request.toString().getBytes(StandardCharsets.UTF_8);connection.setFixedLengthStreamingMode(body.length);
  try{try(OutputStream out=connection.getOutputStream()){out.write(body);}if(connection.getResponseCode()!=200)throw new IOException("Desktop HTTP "+connection.getResponseCode());try(InputStream in=connection.getInputStream()){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1){if(out.size()+n>4*1024*1024)throw new IOException("Desktop response too large");out.write(buffer,0,n);}JSONObject response=new JSONObject(out.toString(StandardCharsets.UTF_8.name()));if(!response.optBoolean("ok"))throw new IOException(response.optString("error","Desktop unavailable"));JSONObject result=response.getJSONObject("result");if(result.has("error"))throw new IOException(result.getString("error"));return result;}}finally{connection.disconnect();}
 }
 private final class Bridge {
  @JavascriptInterface public void pair(String id,String text){network.execute(()->{try{JSONObject config=new JSONObject(text);JSONObject request=new JSONObject().put("action","pair").put("pairing",config.getString("pairing")).put("name",android.os.Build.MODEL);JSONObject result=post(config,request);credentials=new JSONObject().put("url",config.getString("url")).put("fingerprint",config.getString("fingerprint")).put("deviceToken",result.getString("deviceToken"));persist();callback(id,new JSONObject().put("connected",true));}catch(Exception e){callback(id,error(e.getMessage()));}});}
  @JavascriptInterface public void request(String id,String text){network.execute(()->{try{if(credentials==null)throw new IOException("Pair with MyCode first");JSONObject request=new JSONObject(text);request.put("id",UUID.randomUUID().toString());request.put("deviceToken",credentials.getString("deviceToken"));callback(id,post(credentials,request));}catch(Exception e){callback(id,error(e.getMessage()));}});}
  @JavascriptInterface public void scan(){runOnUiThread(()->{IntentIntegrator scan=new IntentIntegrator(MainActivity.this);scan.setDesiredBarcodeFormats(IntentIntegrator.QR_CODE);scan.setPrompt("扫描 MyCode 配对二维码 / Scan MyCode pairing code");scan.setBeepEnabled(false);scan.setOrientationLocked(false);scan.initiateScan();});}
  @JavascriptInterface public void paste(){runOnUiThread(()->{ClipboardManager clipboard=(ClipboardManager)getSystemService(CLIPBOARD_SERVICE);ClipData data=clipboard.getPrimaryClip();if(data!=null&&data.getItemCount()>0){JSONObject value=new JSONObject();try{value.put("pairing",data.getItemAt(0).coerceToText(MainActivity.this).toString());callback("pairing",value);}catch(Exception ignored){}}});}
  @JavascriptInterface public void disconnect(){network.execute(()->{credentials=null;getSharedPreferences("pairing",MODE_PRIVATE).edit().clear().apply();callback("disconnect",new JSONObject());});}
 }
 @Override protected void onActivityResult(int request,int result,Intent data){IntentResult scan=IntentIntegrator.parseActivityResult(request,result,data);if(scan!=null){if(scan.getContents()!=null){JSONObject value=new JSONObject();try{value.put("pairing",scan.getContents());callback("pairing",value);}catch(Exception ignored){}}}else super.onActivityResult(request,result,data);}
 @Override protected void onResume(){super.onResume();if(web!=null){web.onResume();web.evaluateJavascript("window.refresh&&window.refresh()",null);}}
 @Override protected void onPause(){if(web!=null){web.onPause();web.evaluateJavascript("window.pauseRefresh&&window.pauseRefresh()",null);}super.onPause();}
 @Override protected void onDestroy(){network.shutdownNow();web.removeJavascriptInterface("Desktop");web.destroy();super.onDestroy();}
}
