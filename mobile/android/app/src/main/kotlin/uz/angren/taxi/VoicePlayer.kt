package uz.angren.taxi

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import io.flutter.FlutterInjector

/**
 * Navigatsiya ovoz bo'laklarini KETMA-KET ijro etadi
 * ("100 metrdan keyin" + "o'ngga buriling").
 *
 * Yangi gap kelsa eskisi TO'XTATILADI — navigatsiyada eng yangi ko'rsatma
 * muhim. Ijro paytida boshqa ovoz (musiqa, radio) vaqtincha PASAYTIRILADI
 * (navigatsiya ovozi uchun Android'ning odatiy xulqi).
 */
object VoicePlayer {
    private var player: MediaPlayer? = null
    private var queue: ArrayDeque<String> = ArrayDeque()
    private var focusRequest: AudioFocusRequest? = null

    private val attributes: AudioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build()

    /** [assets] — Flutter asset yo'llari (`assets/voice/uz/dist_100.mp3`). */
    fun play(context: Context, assets: List<String>): Boolean {
        stop(context)
        if (assets.isEmpty()) return false
        queue = ArrayDeque(assets)
        requestFocus(context)
        return playNext(context)
    }

    private fun playNext(context: Context): Boolean {
        val asset = queue.removeFirstOrNull() ?: run {
            release(context)
            return true
        }
        return try {
            val key = FlutterInjector.instance().flutterLoader().getLookupKeyForAsset(asset)
            val fd = context.assets.openFd(key)
            val mp = MediaPlayer()
            mp.setAudioAttributes(attributes)
            mp.setDataSource(fd.fileDescriptor, fd.startOffset, fd.length)
            fd.close()
            mp.setOnCompletionListener {
                it.release()
                if (player === it) player = null
                playNext(context)
            }
            mp.setOnErrorListener { p, _, _ ->
                p.release()
                if (player === p) player = null
                playNext(context)
                true
            }
            mp.prepare()
            mp.start()
            player = mp
            true
        } catch (e: Exception) {
            // Bitta bo'lak buzilgan bo'lsa ham qolganlari aytilsin.
            playNext(context)
            false
        }
    }

    fun stop(context: Context) {
        queue.clear()
        player?.let {
            try {
                it.stop()
            } catch (_: Exception) {
            }
            it.release()
        }
        player = null
        abandonFocus(context)
    }

    private fun release(context: Context) {
        player = null
        abandonFocus(context)
    }

    private fun requestFocus(context: Context) {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(attributes)
                .build()
            focusRequest = request
            am.requestAudioFocus(request)
        } else {
            @Suppress("DEPRECATION")
            am.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
        }
    }

    private fun abandonFocus(context: Context) {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            focusRequest?.let { am.abandonAudioFocusRequest(it) }
            focusRequest = null
        } else {
            @Suppress("DEPRECATION")
            am.abandonAudioFocus(null)
        }
    }
}
