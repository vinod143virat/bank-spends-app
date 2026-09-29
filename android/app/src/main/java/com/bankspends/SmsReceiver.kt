package com.bankspends

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments

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
    // `reactHost` is null until the host is built, and `currentReactContext` is
    // null whenever JS is not running - a broadcast can arrive in both states.
    val reactContext = host.reactHost?.currentReactContext ?: return

    val payload = Arguments.createMap().apply {
      putString("sender", sender)
      putDouble("receivedAt", System.currentTimeMillis().toDouble())
    }

    // emitDeviceEvent resolves the emitter itself and no-ops when JS is not
    // listening. Guarding on hasActiveReactInstance() instead would drop every
    // event under bridgeless mode, which is the default on the New Architecture.
    reactContext.emitDeviceEvent(EVENT_NAME, payload)
  }

  companion object {
    const val EVENT_NAME = "bankspends:smsReceived"
  }
}
