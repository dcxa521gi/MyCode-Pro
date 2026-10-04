package com.mycode.mobile;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import com.journeyapps.barcodescanner.CaptureManager;
import com.journeyapps.barcodescanner.DecoratedBarcodeView;
import com.google.zxing.client.android.R;

/** Camera failures return to pairing; every Activity lifecycle still calls its superclass. */
public final class ScanActivity extends Activity {
    private CaptureManager capture;
    private void failed(){setResult(RESULT_CANCELED,new Intent().putExtra("MYCODE_SCAN_ERROR",true));finish();}
    @Override protected void onCreate(Bundle state){
        super.onCreate(state);
        try {setContentView(R.layout.zxing_capture);DecoratedBarcodeView view=findViewById(R.id.zxing_barcode_scanner);capture=new CaptureManager(this,view);capture.initializeFromIntent(getIntent(),state);capture.decode();}
        catch(RuntimeException|LinkageError error){failed();}
    }
    @Override protected void onResume(){super.onResume();if(capture!=null){try{capture.onResume();}catch(RuntimeException|LinkageError error){failed();}}}
    @Override protected void onPause(){if(capture!=null){try{capture.onPause();}catch(RuntimeException ignored){}}super.onPause();}
    @Override protected void onDestroy(){if(capture!=null){try{capture.onDestroy();}catch(RuntimeException ignored){}}super.onDestroy();}
    @Override protected void onSaveInstanceState(Bundle state){super.onSaveInstanceState(state);if(capture!=null)capture.onSaveInstanceState(state);}
    @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] grants){super.onRequestPermissionsResult(code,permissions,grants);if(capture!=null){try{capture.onRequestPermissionsResult(code,permissions,grants);}catch(RuntimeException error){failed();}}}
}
