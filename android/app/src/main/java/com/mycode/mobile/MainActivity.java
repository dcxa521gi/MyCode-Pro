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
 private volatile JSONObject credentials;
 private static final int CAMERA_PERMISSION=2501;
 private final java.util.concurrent.ExecutorService network = Executors.newFixedThreadPool(2);
 private final java.util.concurrent.ExecutorService models = Executors.newSingleThreadExecutor();
 private volatile JSONObject localState = new JSONObject();
 private final java.util.concurrent.ExecutorService storage = Executors.newSingleThreadExecutor();
 private volatile boolean localReady=false;
 private String locale="zh-CN";
 @Override public void onCreate(Bundle state){super.onCreate(state);web=new WebView(this);setContentView(web);
  web.setOnApplyWindowInsetsListener((view,insets)->{if(android.os.Build.VERSION.SDK_INT>=30){android.graphics.Insets edges=insets.getInsets(android.view.WindowInsets.Type.systemBars()|android.view.WindowInsets.Type.ime());view.setPadding(edges.left,edges.top,edges.right,edges.bottom);}else{view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());}return insets;});
  web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(false);web.getSettings().setAllowContentAccess(false);web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowFileAccessFromFileURLs(false);web.getSettings().setAllowUniversalAccessFromFileURLs(false);web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  web.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return !request.getUrl().toString().equals("file:///android_asset/index.html");}@Override public void onPageFinished(WebView view,String url){restore();if(credentials!=null){try{callback("boot",new JSONObject().put("connected",true));}catch(Exception ignored){}}}});
  web.addJavascriptInterface(new Bridge(),"Desktop");web.loadUrl("file:///android_asset/index.html");
 }
 private void callback(String id,JSONObject result){runOnUiThread(()->{if(isFinishing()||isDestroyed()||web==null)return;web.evaluateJavascript("window.onNative("+JSONObject.quote(id)+","+result+")",null);});}
 private JSONObject error(String text){JSONObject result=new JSONObject();try{result.put("error",text);}catch(Exception ignored){}return result;}
 private synchronized javax.crypto.SecretKey key() throws Exception {KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);if(!store.containsAlias("mycode-pairing")){KeyGenerator generator=KeyGenerator.getInstance("AES","AndroidKeyStore");generator.init(new KeyGenParameterSpec.Builder("mycode-pairing",KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());generator.generateKey();}return (javax.crypto.SecretKey)store.getKey("mycode-pairing",null);}
 private void persist() throws Exception {Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());String sealed=Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(credentials.toString().getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP);getSharedPreferences("pairing",MODE_PRIVATE).edit().putString("sealed",sealed).apply();}
 private void restore(){try{String sealed=getSharedPreferences("pairing",MODE_PRIVATE).getString("sealed",null);if(sealed==null)return;String[] parts=sealed.split(":",2);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));credentials=new JSONObject(new String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),StandardCharsets.UTF_8));}catch(Exception e){credentials=null;getSharedPreferences("pairing",MODE_PRIVATE).edit().clear().apply();}}
 private boolean chinese(){return !locale.equals("en");}
 private String friendly(Exception e){
  String text=e.getMessage()==null?"":e.getMessage();
  if(e instanceof java.net.SocketTimeoutException)return chinese()?"连接超时。请确认电脑运行和防火墙允许连接；两端 VPN 请允许局域网访问，关闭“阻止绕过”后重试，或使用远程中继。":"Connection timed out. Check desktop and firewall. Allow LAN access in both VPNs, disable block-without-VPN, or use the remote relay.";
  if(e instanceof java.net.UnknownHostException)return chinese()?"地址无法解析，请检查域名及手机网络。":"Cannot resolve the address. Check hostname and network.";
  if(e instanceof java.net.ConnectException||e instanceof java.net.NoRouteToHostException||e instanceof SecurityException)return chinese()?"地址无法连接或被系统网络策略阻止。请选择电脑的 Wi-Fi/以太网地址，允许防火墙和两端 VPN 的局域网访问；跨网络请使用远程中继。":"Address unreachable or blocked by system policy. Select the desktop Wi-Fi/Ethernet address and allow firewall/LAN traffic in both VPNs. Use remote relay across networks.";
  if(e instanceof javax.net.ssl.SSLException||e instanceof java.security.GeneralSecurityException)return chinese()?"连接证书或加密校验失败，请复制电脑新生成的配对信息，并检查手机时间。":"Certificate or encryption verification failed. Use new pairing information and check phone time.";
  if(text.contains("Pairing expired")||text.contains("Pairing expired or invalid"))return chinese()?"配对码已使用、过期或无效，请在电脑点击刷新配对码。":"Pairing code used, expired or invalid. Refresh it on the desktop.";
  if(text.contains("not authorized")||text.contains("Bridge disabled"))return chinese()?"设备授权已失效，请断开后重新配对。":"Device authorization expired. Disconnect and pair again.";
  if(text.contains("HTTP 410"))return chinese()?"远程电脑已离线或连接已过期，请在电脑重新开启远程连接。":"Desktop offline or remote room expired. Enable a new connection on the desktop.";
  if(text.contains("HTTP 429"))return chinese()?"连接服务繁忙，请稍后重试。":"Connection service busy. Try again shortly.";
  if(text.contains("HTTP 504"))return chinese()?"远程电脑未及时响应，请确认 MyCode 正在运行。":"Remote desktop did not respond. Check that MyCode is running.";
  if(e instanceof org.json.JSONException||e instanceof IllegalArgumentException)return chinese()?"配对信息格式无效，请完整复制电脑生成的配对信息。":"Invalid pairing information. Copy the complete desktop pairing code.";
  if(text.contains("model is no longer available"))return chinese()?"该模型已不可用，请刷新并重新选择有效模型。":"Model unavailable. Refresh and select an available model.";
  if(text.contains("Pause the task before"))return chinese()?"请先暂停任务，再切换代理或模型。":"Pause the task before changing agent or model.";
  if(text.contains("Message was not accepted"))return chinese()?"电脑未接受本次消息，请检查代理是否安装及会话状态。":"Desktop did not accept the message. Check agent installation and session state.";
  if(text.contains("still running"))return chinese()?"任务仍在运行，请先暂停，再发送下一条消息。":"Task is running. Pause it before sending another message.";
  return chinese()?"连接失败："+text:"Connection failed: "+text;
 }
 private JSONObject post(JSONObject config,JSONObject request) throws Exception {
  URL url=new URL(config.getString("url"));boolean remote=config.optString("mode","direct").equals("relay");
  if(!url.getProtocol().equals("https")||url.getUserInfo()!=null||url.getQuery()!=null||url.getRef()!=null)throw new IllegalArgumentException("Invalid address");
  // LAN traffic must not inherit a system HTTP proxy pointing at another network.
  HttpsURLConnection connection=(HttpsURLConnection)(remote?url.openConnection():DirectNetworks.open(MainActivity.this,url));JSONObject outgoing=request;
  if(remote){outgoing=TransportCrypto.seal(config.getString("transportKey"),request,"mycode:request:"+config.getString("room"));}
  else {
   String fingerprint=config.getString("fingerprint");
   X509TrustManager pinned=new X509TrustManager(){public X509Certificate[] getAcceptedIssuers(){return new X509Certificate[0];}public void checkClientTrusted(X509Certificate[] c,String a) throws CertificateException{throw new CertificateException("Client TLS unsupported");}public void checkServerTrusted(X509Certificate[] chain,String auth) throws CertificateException{try{if(chain.length==0)throw new CertificateException("Missing certificate");StringBuilder actual=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(chain[0].getEncoded()))actual.append(String.format(java.util.Locale.ROOT,"%02x",b&255));if(!MessageDigest.isEqual(actual.toString().getBytes(StandardCharsets.US_ASCII),fingerprint.getBytes(StandardCharsets.US_ASCII)))throw new CertificateException("Desktop certificate changed. Pair again.");}catch(GeneralSecurityException e){throw new CertificateException(e);}}};
   SSLContext tls=SSLContext.getInstance("TLS");tls.init(null,new TrustManager[]{pinned},new SecureRandom());connection.setSSLSocketFactory(tls.getSocketFactory());connection.setHostnameVerifier((host,session)->host.equals(url.getHost()));
  }
  connection.setInstanceFollowRedirects(false);connection.setUseCaches(false);connection.setConnectTimeout(10000);connection.setReadTimeout(remote?60000:30000);connection.setRequestMethod("POST");connection.setRequestProperty("Content-Type","application/json");connection.setDoOutput(true);byte[] body=outgoing.toString().getBytes(StandardCharsets.UTF_8);connection.setFixedLengthStreamingMode(body.length);
  try {
   try(OutputStream out=connection.getOutputStream()){out.write(body);}
   if(connection.getResponseCode()!=200)throw new IOException("Desktop HTTP "+connection.getResponseCode());
   long length=connection.getContentLengthLong();if(length>6*1024*1024)throw new IOException("Desktop response too large");
   JSONObject response;
   try(InputStream in=connection.getInputStream()){
    ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[8192];long remaining=length;
    while(length<0||remaining>0){int n=in.read(buffer,0,(int)(length<0?buffer.length:Math.min(buffer.length,remaining)));if(n<0){if(length>=0&&remaining>0)throw new IOException("Incomplete desktop response");break;}if(out.size()+n>6*1024*1024)throw new IOException("Desktop response too large");out.write(buffer,0,n);remaining-=n;}
    response=new JSONObject(out.toString(StandardCharsets.UTF_8.name()));
   }
   if(remote){JSONObject envelope=response.getJSONObject("envelope");if(!envelope.getString("requestNonce").equals(outgoing.getString("nonce")))throw new java.security.GeneralSecurityException("Reply binding mismatch");response=TransportCrypto.open(config.getString("transportKey"),envelope,"mycode:response:"+config.getString("room")+":"+outgoing.getString("nonce"));}
   if(!response.optBoolean("ok"))throw new IOException(response.optString("error","Desktop unavailable"));JSONObject result=response.getJSONObject("result");if(result.has("error"))throw new IOException(result.getString("error"));return result;
  }finally{connection.disconnect();}
 }
 void startScan(){
  if(checkSelfPermission(android.Manifest.permission.CAMERA)!=android.content.pm.PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{android.Manifest.permission.CAMERA},CAMERA_PERMISSION);return;}
  launchScan();
 }
 private void launchScan(){try{IntentIntegrator scan=new IntentIntegrator(MainActivity.this);scan.setCaptureActivity(ScanActivity.class);scan.setDesiredBarcodeFormats(IntentIntegrator.QR_CODE);scan.setPrompt(chinese()?"扫描 MyCode 配对二维码":"Scan MyCode pairing QR");scan.setBeepEnabled(false);scan.setOrientationLocked(false);scan.initiateScan();}catch(RuntimeException|LinkageError error){android.util.Log.w("MyCodeScan","Could not start pairing scanner",error);callback("notice",error(chinese()?"无法启动摄像头，您仍可粘贴配对信息连接。":"Camera could not start. Paste pairing information to connect."));}}
 @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] grants){super.onRequestPermissionsResult(request,permissions,grants);if(request==CAMERA_PERMISSION){if(grants.length>0&&grants[0]==android.content.pm.PackageManager.PERMISSION_GRANTED)launchScan();else callback("notice",error(chinese()?"未允许摄像头。可在系统设置中授权，或粘贴配对信息连接。":"Camera permission denied. Enable it in system settings or paste pairing information."));}}
 public final class Bridge {
  @JavascriptInterface public void localLoad(String id){storage.execute(()->{try{
   File file=new File(getFilesDir(),"local-state.sealed");if(file.isFile()){
    String[] sealed=new String(java.nio.file.Files.readAllBytes(file.toPath()),StandardCharsets.UTF_8).split(":",2);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(sealed[0],Base64.NO_WRAP)));localState=new JSONObject(new String(cipher.doFinal(Base64.decode(sealed[1],Base64.NO_WRAP)),StandardCharsets.UTF_8));
   }localReady=true;callback(id,new JSONObject(localState.toString()));
  }catch(Exception e){callback(id,error(chinese()?"手机本地数据无法读取，原文件已保留。":"Local data could not be read; the original file was retained."));}});}
  @JavascriptInterface public void localSave(String id,String text){storage.execute(()->{try{
   if(!localReady)throw new IOException("Local data not loaded");byte[] data=text.getBytes(StandardCharsets.UTF_8);if(data.length>6*1024*1024)throw new IOException("Local storage limit exceeded");JSONObject next=new JSONObject(text);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());String sealed=Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(data),Base64.NO_WRAP);
   File temporary=new File(getFilesDir(),"local-state.pending"),destination=new File(getFilesDir(),"local-state.sealed");try(FileOutputStream output=new FileOutputStream(temporary)){output.write(sealed.getBytes(StandardCharsets.UTF_8));output.getFD().sync();}java.nio.file.Files.move(temporary.toPath(),destination.toPath(),java.nio.file.StandardCopyOption.REPLACE_EXISTING);localState=next;callback(id,new JSONObject().put("saved",true));
  }catch(Exception e){callback(id,error(chinese()?"保存失败，请保留本次内容后重试。":"Save failed. Retain this content and retry."));}});}
  @JavascriptInterface public void localChat(String id,String text){models.execute(()->{try{JSONObject request=new JSONObject(text);callback(id,StandaloneModel.request(request.getJSONObject("profile"),request.getJSONArray("messages")));}catch(Exception e){callback(id,error(friendly(e)));}});}
  @JavascriptInterface public void language(String value){locale=value.equals("en")?"en":"zh-CN";}
  @JavascriptInterface public void pair(String id,String text){network.execute(()->{try{
   JSONObject config=PairingConfig.parse(text);JSONObject request=new JSONObject().put("action","pair").put("id",UUID.randomUUID().toString()).put("pairing",config.getString("pairing")).put("name",android.os.Build.MODEL);JSONObject result=post(config,request);
   JSONObject saved=new JSONObject(config.toString()).put("deviceToken",result.getString("deviceToken"));saved.remove("pairing");saved.remove("expiresIn");saved.remove("addresses");credentials=saved;
   JSONObject answer=new JSONObject().put("connected",true);try{persist();}catch(Exception storage){answer.put("warning",chinese()?"设备授权暂存于本次运行，关闭应用后需重新配对。":"Authorization is temporary; pair again after closing the app.");}callback(id,answer);
  }catch(Exception e){callback(id,error(friendly(e)));}});}
  @JavascriptInterface public void request(String id,String text){network.execute(()->{try{if(credentials==null)throw new IOException("Pair with MyCode first");JSONObject request=new JSONObject(text);request.put("id",UUID.randomUUID().toString());request.put("deviceToken",credentials.getString("deviceToken"));callback(id,post(credentials,request));}catch(Exception e){callback(id,error(friendly(e)));}});}
  @JavascriptInterface public void scan(){runOnUiThread(MainActivity.this::startScan);}
  @JavascriptInterface public void paste(){runOnUiThread(()->{ClipboardManager clipboard=(ClipboardManager)getSystemService(CLIPBOARD_SERVICE);ClipData data=clipboard==null?null:clipboard.getPrimaryClip();if(data!=null&&data.getItemCount()>0){JSONObject value=new JSONObject();try{value.put("pairing",data.getItemAt(0).coerceToText(MainActivity.this).toString());callback("pairing",value);}catch(Exception ignored){}}else callback("notice",error(chinese()?"剪贴板为空，请先在电脑复制配对信息。":"Clipboard is empty. Copy pairing information first."));});}
  @JavascriptInterface public void disconnect(){network.execute(()->{credentials=null;getSharedPreferences("pairing",MODE_PRIVATE).edit().clear().apply();callback("disconnect",new JSONObject());});}
 }
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);IntentResult scan=IntentIntegrator.parseActivityResult(request,result,data);if(scan!=null){if(scan.getContents()!=null){JSONObject value=new JSONObject();try{value.put("pairing",scan.getContents());callback("pairing",value);}catch(Exception ignored){}}else if(data!=null&&data.getBooleanExtra("MYCODE_SCAN_ERROR",false))callback("notice",error(chinese()?"摄像头无法打开，请粘贴配对信息连接。":"Camera unavailable. Paste pairing information to connect."));}}
 @Override protected void onResume(){super.onResume();if(web!=null){web.onResume();web.evaluateJavascript("window.refresh&&window.refresh()",null);}}
 @Override protected void onPause(){if(web!=null){web.onPause();web.evaluateJavascript("window.pauseRefresh&&window.pauseRefresh()",null);}super.onPause();}
 @Override protected void onDestroy(){network.shutdownNow();models.shutdownNow();storage.shutdown();if(web!=null){web.removeJavascriptInterface("Desktop");web.destroy();web=null;}super.onDestroy();}
}
