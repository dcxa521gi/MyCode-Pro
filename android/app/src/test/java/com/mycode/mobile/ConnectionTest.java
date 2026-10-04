package com.mycode.mobile;

import android.Manifest;
import android.content.pm.PackageManager;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.Before;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class ConnectionTest {
 @Before public void diagnostics(){org.robolectric.shadows.ShadowLog.stream=System.err;}
 private static final String KEY="11".repeat(32);
 @Test public void scanRequestsPermissionAndDenialKeepsPairingActivityAlive(){
  try(var controller=Robolectric.buildActivity(MainActivity.class).setup()){
   MainActivity activity=controller.get();Shadows.shadowOf(RuntimeEnvironment.getApplication()).denyPermissions(Manifest.permission.CAMERA);
   assertEquals("Denied camera permission precondition",PackageManager.PERMISSION_DENIED,activity.checkSelfPermission(Manifest.permission.CAMERA));
   activity.startScan();var requested=Shadows.shadowOf(activity).getLastRequestedPermission();assertNotNull("Camera permission must be requested",requested);assertArrayEquals(new String[]{Manifest.permission.CAMERA},requested.requestedPermissions);
   activity.onRequestPermissionsResult(2501,new String[]{Manifest.permission.CAMERA},new int[]{PackageManager.PERMISSION_DENIED});assertFalse(activity.isFinishing());
  }
 }
 @Test public void scanLaunchesDedicatedInternalActivityAfterPermissionGranted(){
  try(var controller=Robolectric.buildActivity(MainActivity.class).setup()){
   MainActivity activity=controller.get();Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(Manifest.permission.CAMERA);
   assertEquals("Granted camera permission precondition",PackageManager.PERMISSION_GRANTED,activity.checkSelfPermission(Manifest.permission.CAMERA));
   activity.startScan();var started=Shadows.shadowOf(activity).getNextStartedActivityForResult();assertNotNull("Scan intent must start",started);assertNotNull("Explicit scan component",started.intent.getComponent());assertEquals(ScanActivity.class.getName(),started.intent.getComponent().getClassName());
  }
 }
 @Test public void copiedDirectAndRemotePairingAreValidatedBeforeNetworkUse() throws Exception {
  JSONObject direct=new JSONObject().put("url","https://192.168.1.10:4443/mycode/v1").put("fingerprint","AA".repeat(32)).put("pairing",KEY);
  assertEquals("direct",PairingConfig.parse("\uFEFF  "+direct+"  ").getString("mode"));
  String room="00000000-0000-0000-0000-000000000000";
  JSONObject remote=new JSONObject().put("mode","relay").put("url","https://relay.example.com/v1/rooms/"+room+"/request").put("room",room).put("transportKey",KEY).put("pairing",KEY);
  assertEquals("relay",PairingConfig.parse(remote.toString()).getString("mode"));
  remote.put("url","http://relay.example.com/v1/rooms/"+room+"/request");assertThrows(IllegalArgumentException.class,()->PairingConfig.parse(remote.toString()));
  direct.put("pairing","");assertThrows(IllegalArgumentException.class,()->PairingConfig.parse(direct.toString()));
 }
 @Test public void transportMatchesSharedCryptoVectorAndRejectsWrongRoomAndTampering() throws Exception {
  JSONObject fixture=new JSONObject().put("nonce","IiIiIiIiIiIiIiIi").put("ciphertext","bNVmKrSm8DHHBfxPLciN9zOxuYcS9Y5xcKixT+5ayOrkxkyZ/YrV/Co9m0SFPR1a2LfwQK9QDpvHAMedhx2G0R2uMBo44XMoyRNT4GKMjXjIjIFDueUXyeXgPLinxMJUVyUkyQ==");
  assertEquals("继续项目",TransportCrypto.open(KEY,fixture,"mycode:request:fixture-room").getString("text"));
  assertThrows(Exception.class,()->TransportCrypto.open(KEY,fixture,"mycode:request:wrong-room"));
  JSONObject sealed=TransportCrypto.seal(KEY,new JSONObject().put("deviceToken","test-device"),"response");assertFalse(sealed.toString().contains("test-device"));
  assertEquals("test-device",TransportCrypto.open(KEY,sealed,"response").getString("deviceToken"));sealed.put("ciphertext","AAAA");assertThrows(Exception.class,()->TransportCrypto.open(KEY,sealed,"response"));
 }
}
