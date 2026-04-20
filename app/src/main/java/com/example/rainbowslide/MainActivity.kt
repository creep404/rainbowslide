package com.example.rainbowslide

import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.weight
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import kotlin.math.abs
import kotlin.random.Random

enum class Category(val title: String, val items: List<String>) {
    LETTERS("Letters", ('A'..'Z').map { it.toString() }),
    NUMBERS("Numbers", (0..20).map { it.toString() }),
    FRUITS("Fruits", listOf("🍎", "🍌", "🍊", "🍇", "🍓", "🍍", "🥝", "🍉"))
}

data class Balloon(
    val label: String,
    val color: Color,
    var x: Float,
    var y: Float,
    val radius: Float,
    val verticalSpeed: Float,
    val drift: Float
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        MobileAds.initialize(this)
        setContent {
            MaterialTheme { BalloonGameApp() }
        }
    }
}

@Composable
private fun BalloonGameApp() {
    var selectedCategory by remember { mutableStateOf<Category?>(null) }
    var interstitialAd by remember { mutableStateOf<InterstitialAd?>(null) }
    val adRequest = remember { AdRequest.Builder().build() }
    val lifecycleOwner = LocalLifecycleOwner.current

    LaunchedEffect(Unit) {
        val activity = lifecycleOwner as? ComponentActivity ?: return@LaunchedEffect
        InterstitialAd.load(
            activity,
            "ca-app-pub-3940256099942544/1033173712",
            adRequest,
            object : InterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: InterstitialAd) {
                    interstitialAd = ad
                }

                override fun onAdFailedToLoad(loadAdError: LoadAdError) {
                    interstitialAd = null
                }
            }
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF2F6FF))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text(
            text = "Balloon Pop Learning Game",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )

        if (selectedCategory == null) {
            CategoryMenu(onSelect = { selectedCategory = it })
        } else {
            GameScreen(
                category = selectedCategory!!,
                onBack = { selectedCategory = null },
                onMilestone = {
                    val activity = lifecycleOwner as? ComponentActivity ?: return@GameScreen
                    interstitialAd?.let { ad ->
                        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                            override fun onAdDismissedFullScreenContent() {
                                interstitialAd = null
                                InterstitialAd.load(
                                    activity,
                                    "ca-app-pub-3940256099942544/1033173712",
                                    adRequest,
                                    object : InterstitialAdLoadCallback() {
                                        override fun onAdLoaded(ad: InterstitialAd) {
                                            interstitialAd = ad
                                        }
                                    }
                                )
                            }
                        }
                        ad.show(activity)
                    }
                }
            )
        }

        BannerAd(modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun CategoryMenu(onSelect: (Category) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Pick a section:", fontWeight = FontWeight.SemiBold)
        Category.entries.forEach { category ->
            Button(
                onClick = { onSelect(category) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(category.title)
            }
        }
    }
}

@Composable
private fun GameScreen(category: Category, onBack: () -> Unit, onMilestone: () -> Unit) {
    val balloons = remember { mutableStateListOf<Balloon>() }
    var score by remember { mutableIntStateOf(0) }
    val tone = remember { ToneGenerator(AudioManager.STREAM_MUSIC, 70) }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("${category.title} Mode", fontWeight = FontWeight.Bold)
            Text("Score: $score", fontWeight = FontWeight.Bold)
        }

        Card(modifier = Modifier.weight(1f)) {
            val density = LocalDensity.current
            val minRadius = with(density) { 30.dp.toPx() }
            val maxRadius = with(density) { 45.dp.toPx() }

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xFFE3F2FD))
                    .pointerInput(category) {
                        detectTapGestures { tapOffset ->
                            val popped = balloons.firstOrNull { b ->
                                val dx = tapOffset.x - b.x
                                val dy = tapOffset.y - b.y
                                (dx * dx + dy * dy) <= b.radius * b.radius
                            }
                            if (popped != null) {
                                balloons.remove(popped)
                                score += 1
                                tone.startTone(ToneGenerator.TONE_PROP_BEEP2, 60)
                                if (score % 15 == 0) onMilestone()
                            }
                        }
                    }
            ) {
                Canvas(modifier = Modifier.fillMaxSize()) {
                    if (balloons.size < 8 && Random.nextFloat() < 0.05f) {
                        val radius = Random.nextFloat() * (maxRadius - minRadius) + minRadius
                        balloons.add(
                            Balloon(
                                label = category.items.random(),
                                color = Color(Random.nextFloat(), Random.nextFloat(), Random.nextFloat(), 1f),
                                x = Random.nextFloat() * size.width,
                                y = size.height + radius,
                                radius = radius,
                                verticalSpeed = Random.nextFloat() * 3f + 2f,
                                drift = Random.nextFloat() * 2f - 1f
                            )
                        )
                    }

                    balloons.forEach { b ->
                        b.y -= b.verticalSpeed
                        b.x += b.drift
                        if (b.x < b.radius) b.x = b.radius
                        if (b.x > size.width - b.radius) b.x = size.width - b.radius

                        drawCircle(color = b.color, center = Offset(b.x, b.y), radius = b.radius, style = Fill)
                        drawCircle(
                            color = Color.White.copy(alpha = 0.7f),
                            center = Offset(b.x - b.radius / 3, b.y - b.radius / 3),
                            radius = b.radius / 4,
                            style = Fill
                        )
                        drawCircle(
                            color = Color.Black.copy(alpha = 0.2f),
                            center = Offset(b.x, b.y),
                            radius = b.radius,
                            style = Stroke(width = 3f)
                        )

                        drawContext.canvas.nativeCanvas.drawText(
                            b.label,
                            b.x,
                            b.y + (b.radius / 5),
                            android.graphics.Paint().apply {
                                color = android.graphics.Color.WHITE
                                textAlign = android.graphics.Paint.Align.CENTER
                                textSize = b.radius * if (b.label.length > 1) 0.8f else 1.0f
                                isFakeBoldText = true
                            }
                        )
                    }

                    balloons.removeAll { it.y < -it.radius * 2 || abs(it.x) > size.width + it.radius * 2 }
                }

                LaunchedEffect(category) {
                    while (true) {
                        withFrameNanos { }
                    }
                }
            }
        }

        Button(onClick = onBack, modifier = Modifier.fillMaxWidth()) {
            Text("Back to Categories")
        }

        Text(
            text = "Pop the floating balloons. Every balloon is random in color and item!",
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
            fontSize = 12.sp
        )
    }
}

@Composable
private fun BannerAd(modifier: Modifier = Modifier) {
    val lifecycleOwner = LocalLifecycleOwner.current
    AndroidView(
        modifier = modifier.height(60.dp),
        factory = { context ->
            AdView(context).apply {
                adSize = AdSize.BANNER
                adUnitId = "ca-app-pub-3940256099942544/6300978111"
                loadAd(AdRequest.Builder().build())

                lifecycleOwner.lifecycle.addObserver(object : DefaultLifecycleObserver {
                    override fun onPause(owner: LifecycleOwner) = pause()
                    override fun onResume(owner: LifecycleOwner) = resume()
                    override fun onDestroy(owner: LifecycleOwner) = destroy()
                })
            }
        }
    )
}
