package uz.angren.taxi

import android.app.AppOpsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings

/**
 * Xitoy OEM'larining "Avtozapusk" ruxsati.
 *
 * NEGA KERAK: Xiaomi/Oppo/Vivo/Huawei'da foydalanuvchi ilovani "so'nggi
 * ilovalar"dan surib yopsa, tizim uni "majburan to'xtatilgan" holatga
 * o'tkazadi va avtozapusk yoqilmagan bo'lsa FCM push ham uni UYG'OTMAYDI.
 * Natija: haydovchi onlayn, lekin zakaz telefoniga umuman yetmaydi.
 * Angrendagi haydovchilarning aksariyati Xiaomi/Redmi ishlatadi.
 *
 * Android'da buning ommaviy API'si yo'q:
 *  - Xiaomi: MIUI o'z AppOps kodini (10008) yuritadi — reflection bilan
 *    o'qiladi (keng tarqalgan "Autostarter" kutubxonalari usuli). O'qib
 *    bo'lmasa — `unknown`.
 *  - Boshqalar: holatni o'qib bo'lmaydi (`unknown`), faqat sahifani ochamiz.
 */
object Autostart {
    /** MIUI'ning ichki AppOps kodi: "Avtozapusk". */
    private const val MIUI_OP_AUTO_START = 10008

    /**
     * OEM sahifalari, eng yangi firmware'dan boshlab. Ko'pi eksport
     * qilinmagan bo'lishi mumkin — har biri try/catch bilan sinaladi.
     */
    private val xiaomiPages = listOf(
        ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
    )
    private val oppoPages = listOf(
        ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
        ComponentName("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"),
        ComponentName("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"),
    )
    private val vivoPages = listOf(
        ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
        ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"),
        ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"),
    )
    private val huaweiPages = listOf(
        ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
        ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"),
        ComponentName("com.hihonor.systemmanager", "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
    )

    private enum class Vendor { XIAOMI, OPPO, VIVO, HUAWEI, OTHER }

    private fun vendor(): Vendor {
        val m = Build.MANUFACTURER.lowercase()
        val b = Build.BRAND.lowercase()
        fun any(vararg names: String) = names.any { m.contains(it) || b.contains(it) }
        return when {
            any("xiaomi", "redmi", "poco") -> Vendor.XIAOMI
            any("oppo", "realme", "oneplus") -> Vendor.OPPO
            any("vivo", "iqoo") -> Vendor.VIVO
            any("huawei", "honor") -> Vendor.HUAWEI
            else -> Vendor.OTHER
        }
    }

    /** Dart `AutostartStatus` nomlari bilan bir xil. */
    fun status(context: Context): String = when (vendor()) {
        Vendor.OTHER -> "notApplicable"
        Vendor.XIAOMI -> when (miuiAutostart(context)) {
            true -> "allowed"
            false -> "denied"
            null -> "unknown"
        }
        else -> "unknown"
    }

    /**
     * MIUI autostart AppOps holati. `checkOpNoThrow(int, int, String)` —
     * yashirin (greylist) usul; yangi MIUI/HyperOS uni yopib qo'ysa yoki
     * kutilmagan rejim qaytarsa — `null` (noma'lum), xato emas.
     */
    private fun miuiAutostart(context: Context): Boolean? = try {
        val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val method = AppOpsManager::class.java.getMethod(
            "checkOpNoThrow",
            Int::class.javaPrimitiveType,
            Int::class.javaPrimitiveType,
            String::class.java,
        )
        when (method.invoke(ops, MIUI_OP_AUTO_START, Process.myUid(), context.packageName) as? Int) {
            AppOpsManager.MODE_ALLOWED -> true
            AppOpsManager.MODE_IGNORED, AppOpsManager.MODE_ERRORED -> false
            else -> null
        }
    } catch (_: Throwable) {
        null
    }

    /**
     * OEM sahifasini ochadi; hech biri ochilmasa — ilova ma'lumotlari
     * sahifasi (u yerda ham "Avtozapusk"/"Fonda ishga tushirish" bor).
     */
    fun openSettings(context: Context) {
        val pages = when (vendor()) {
            Vendor.XIAOMI -> xiaomiPages
            Vendor.OPPO -> oppoPages
            Vendor.VIVO -> vivoPages
            Vendor.HUAWEI -> huaweiPages
            Vendor.OTHER -> emptyList()
        }
        for (page in pages) {
            try {
                context.startActivity(
                    Intent().setComponent(page).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                )
                return
            } catch (_: Exception) {
                // Bu firmware'da yo'q yoki eksport qilinmagan — keyingisi.
            }
        }
        try {
            context.startActivity(
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        } catch (_: Exception) {
        }
    }
}
