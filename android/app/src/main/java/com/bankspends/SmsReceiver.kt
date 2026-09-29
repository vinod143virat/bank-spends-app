package com.bankspends

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Nudges the app to re-sync when a bank alert lands while it is running.
 *
 * The receiver deliberately does not carry the message body across: it emits
 * only the sender and timestamp, and the app then re-reads through the filtered
 * query path. One code path owns inbox reads, which keeps the privacy boundary
 * in [NativeSmsReaderModule] from being quietly bypassed here.
 */
class SmsReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

    val sender = Telephony.Sms.Intents.getMessagesFromIntent(intent)
      ?.firstOrNull()
      ?.originatingAddress
      ?: return

    val host = context.applicationContext as? ReactApplication ?: return
    val reactContext = host.reactHost.currentReactContext ?: return
    if (!reactContext.hasActiveReactInstance()) return

    val payload = Arguments.createMap().apply {
      putString("sender", sender)
      putDouble("receivedAt", System.currentTimeMillis().toDouble())
    }

    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(EVENT_NAME, payload)
  }

  companion object {
    const val EVENT_NAME = "bankspends:smsReceived"
  }
}
