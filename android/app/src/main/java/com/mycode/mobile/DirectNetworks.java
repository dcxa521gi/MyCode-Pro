package com.mycode.mobile;

import android.content.Context;
import android.net.*;
import java.net.*;

/** A direct LAN pairing should stay on its matching physical subnet, even with a VPN. */
final class DirectNetworks {
 static boolean sameSubnet(InetAddress local,InetAddress remote,int prefix) {
  byte[] a=local.getAddress(),b=remote.getAddress();if(a.length!=4||b.length!=4||prefix<1||prefix>32)return false;
  for(int i=0;i<4;i++){int bits=Math.max(0,Math.min(8,prefix-i*8));int mask=bits==0?0:(255<<(8-bits))&255;if((a[i]&mask)!=(b[i]&mask))return false;}return true;
 }
 static URLConnection open(Context context,URL url) throws Exception {
  // Only literal LAN addresses can select a physical network. Relay / provider
  // traffic retains Android's normal VPN routing and public certificate checks.
  if(!url.getHost().matches("\\d{1,3}(\\.\\d{1,3}){3}"))return url.openConnection(Proxy.NO_PROXY);
  InetAddress target=InetAddress.getByName(url.getHost());
  ConnectivityManager manager=(ConnectivityManager)context.getSystemService(Context.CONNECTIVITY_SERVICE);
  if(manager!=null)for(Network network:manager.getAllNetworks()){
   NetworkCapabilities caps=manager.getNetworkCapabilities(network);LinkProperties links=manager.getLinkProperties(network);
   if(caps==null||links==null||caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)||(!caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)&&!caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)))continue;
   for(LinkAddress local:links.getLinkAddresses())if(sameSubnet(local.getAddress(),target,local.getPrefixLength()))return network.openConnection(url,Proxy.NO_PROXY);
  }
  return url.openConnection(Proxy.NO_PROXY);
 }
}
