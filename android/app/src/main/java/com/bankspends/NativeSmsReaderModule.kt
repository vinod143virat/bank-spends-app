package com.bankspends

import android.Manifest
import android.content.pm.PackageManager
import android.provider.Telephony
import androidx.core.content.ContextCompat
import com.facebook.fbreact.specs.NativeSmsReaderSpec
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableArray

/**
 * Reads bank alerts out of the SMS inbox.
 *
 * Messages from senders outside the caller-supplied allow-list are dropped here,
 * in native code, so personal SMS is never copied into the JS heap. The module
 * exposes no way to read the inbox unfiltered.
 */
class NativeSmsReaderModule(reactContext: ReactApplicationContext) :
  NativeSmsReaderSpec(reactContext) {

  override fun hasReadPermission(): Boolean =
    ContextCompat.checkSelfPermission(reactApplicationContext, Manifest.permission.READ_SMS) ==
      PackageManager.PERMISSION_GRANTED

  override fun query(sinceEpochMs: Double, limit: Double, senderFragments: ReadableArray, promise: Promise) {
    if (!hasReadPermission()) {
      promise.reject(E_PERMISSION, "READ_SMS has not been granted")
      return
    }

    val fragments = ArrayList<String>(senderFragments.size())
    for (i in 0 until senderFragments.size()) {
      senderFragments.getString(i)?.uppercase()?.let { fragments.add(it) }
    }
    if (fragments.isEmpty()) {
      promise.resolve(Arguments.createArray())
      return
    }

    val maxRows = limit.toInt().coerceIn(1, MAX_ROWS)
    val results: WritableArray = Arguments.createArray()

    try {
      val projection = arrayOf(
        Telephony.Sms._ID,
        Telephony.Sms.ADDRESS,
        Telephony.Sms.BODY,
        Telephony.Sms.DATE,
      )

      reactApplicationContext.contentResolver.query(
        Telephony.Sms.Inbox.CONTENT_URI,
        projection,
        "${Telephony.Sms.DATE} > ?",
        arrayOf(sinceEpochMs.toLong().toString()),
        // The provider is SQLite-backed, so the sort clause carries the limit.
        // A generous scan cap keeps a noisy inbox from stalling the sync while
        // still letting the allow-list filter do its work.
        "${Telephony.Sms.DATE} ASC LIMIT ${maxRows * SCAN_FACTOR}",
      )?.use { cursor ->
        val idCol = cursor.getColumnIndexOrThrow(Telephony.Sms._ID)
        val addressCol = cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
        val bodyCol = cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)
        val dateCol = cursor.getColumnIndexOrThrow(Telephony.Sms.DATE)

        while (cursor.moveToNext() && results.size() < maxRows) {
          val address = cursor.getString(addressCol) ?: continue
          val upper = address.uppercase()
          if (fragments.none { upper.contains(it) }) continue

          val row = Arguments.createMap()
          row.putString("id", cursor.getString(idCol))
          row.putString("address", address)
          row.putString("body", cursor.getString(bodyCol) ?: "")
          row.putDouble("date", cursor.getLong(dateCol).toDouble())
          results.pushMap(row)
        }
      } ?: run {
        promise.reject(E_QUERY, "SMS provider returned no cursor")
        return
      }

      promise.resolve(results)
    } catch (e: SecurityException) {
      promise.reject(E_PERMISSION, e.message, e)
    } catch (e: Exception) {
      promise.reject(E_QUERY, e.message, e)
    }
  }

  companion object {
    private const val E_PERMISSION = "E_SMS_PERMISSION"
    private const val E_QUERY = "E_SMS_QUERY"
    private const val MAX_ROWS = 2000
    /** How many raw rows to scan per row returned, before the allow-list filter. */
    private const val SCAN_FACTOR = 20
  }
}
