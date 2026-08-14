package com.lumina.mentormentee

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.*
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefreshLayout: SwipeRefreshLayout
    private lateinit var topProgressBar: ProgressBar
    private lateinit var layoutSplash: LinearLayout
    private lateinit var layoutNoInternet: LinearLayout
    private lateinit var btnRetry: Button

    /**
     * Set your deployed web app URL or local development server here.
     * Example: "https://your-lumina-app.onrender.com" or Firebase Hosting domain.
     */
    private val webAppUrl = "https://mentormenteemitadt.netlify.app/#/landing" // Change this to your live domain or local IP

    private var isNetworkError = false
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null

    // Activity Result Launcher for HTML5 file uploads (<input type="file">)
    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (fileUploadCallback == null) return@registerForActivityResult
        val results: Array<Uri>? = when {
            result.resultCode == RESULT_OK && result.data?.data != null -> arrayOf(result.data!!.data!!)
            result.resultCode == RESULT_OK && result.data?.clipData != null -> {
                val count = result.data!!.clipData!!.itemCount
                Array(count) { i -> result.data!!.clipData!!.getItemAt(i).uri }
            }
            else -> null
        }
        fileUploadCallback?.onReceiveValue(results)
        fileUploadCallback = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        swipeRefreshLayout = findViewById(R.id.swipeRefreshLayout)
        topProgressBar = findViewById(R.id.topProgressBar)
        layoutSplash = findViewById(R.id.layoutSplash)
        layoutNoInternet = findViewById(R.id.layoutNoInternet)
        btnRetry = findViewById(R.id.btnRetry)

        setupSwipeRefresh()
        setupWebView()
        setupNetworkObserver()
        setupBackNavigation()

        btnRetry.setOnClickListener {
            if (isOnline()) {
                hideErrorScreen()
                webView.reload()
            } else {
                Toast.makeText(this, "Still offline. Please check your connection.", Toast.LENGTH_SHORT).show()
            }
        }

        // Initial Load Check
        if (isOnline()) {
            hideErrorScreen()
            webView.loadUrl(webAppUrl)
        } else {
            showErrorScreen()
        }
    }

    private fun setupSwipeRefresh() {
        swipeRefreshLayout.setColorSchemeResources(R.color.primary, R.color.accent)
        swipeRefreshLayout.setProgressBackgroundColorSchemeResource(R.color.surface_dark)
        swipeRefreshLayout.setOnRefreshListener {
            if (isOnline()) {
                hideErrorScreen()
                webView.reload()
            } else {
                swipeRefreshLayout.isRefreshing = false
                showErrorScreen()
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        // Native Look & Feel: Disable browser zoom controls
        settings.setSupportZoom(false)
        settings.displayZoomControls = false
        settings.builtInZoomControls = false
        webView.isVerticalScrollBarEnabled = false
        webView.isHorizontalScrollBarEnabled = false

        // Custom WebViewClient: Intercept errors & suppress Chrome default error pages
        webView.webViewClient = object : WebViewClient() {

            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                topProgressBar.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                topProgressBar.visibility = View.GONE
                swipeRefreshLayout.isRefreshing = false
                layoutSplash.visibility = View.GONE

                if (!isNetworkError) {
                    hideErrorScreen()
                }
            }

            // Android 6.0+ Error Handler
            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    isNetworkError = true
                    showErrorScreen()
                }
            }

            // Legacy Android Error Handler (< 6.0)
            override fun onReceivedError(
                view: WebView?,
                errorCode: Int,
                description: String?,
                failingUrl: String?
            ) {
                isNetworkError = true
                showErrorScreen()
            }

            // Handle SSL error gracefully if needed
            override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: android.net.http.SslError?) {
                // If using verified production SSL, proceed or cancel
                handler?.proceed()
            }

            // Prevent opening external browser
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url.toString()
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    return false // Keep inside WebView
                } else if (url.startsWith("tel:") || url.startsWith("mailto:") || url.startsWith("whatsapp:")) {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        startActivity(intent)
                    } catch (e: Exception) {
                        // Ignore if app not installed
                    }
                    return true
                }
                return true
            }
        }

        // WebChromeClient: Progress bar, Camera/Mic permissions, and File Chooser
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                topProgressBar.progress = newProgress
                if (newProgress == 100) {
                    topProgressBar.visibility = View.GONE
                    layoutSplash.visibility = View.GONE
                } else {
                    topProgressBar.visibility = View.VISIBLE
                }
            }

            // HTML5 File Upload support (Excel import, Profile pics, PDF export upload)
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback

                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "*/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                }

                try {
                    fileChooserLauncher.launch(intent)
                } catch (e: Exception) {
                    fileUploadCallback = null
                    return false
                }
                return true
            }

            // WebRTC Camera & Microphone Permission (For Live Video Meetings)
            override fun onPermissionRequest(request: PermissionRequest?) {
                runOnUiThread {
                    request?.grant(request.resources)
                }
            }
        }
    }

    private fun showErrorScreen() {
        runOnUiThread {
            layoutSplash.visibility = View.GONE
            swipeRefreshLayout.isRefreshing = false
            webView.visibility = View.GONE
            layoutNoInternet.visibility = View.VISIBLE
        }
    }

    private fun hideErrorScreen() {
        runOnUiThread {
            isNetworkError = false
            layoutNoInternet.visibility = View.GONE
            webView.visibility = View.VISIBLE
        }
    }

    private fun isOnline(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val capabilities = cm.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    // Auto-reconnect: Seamlessly refreshes the page when internet is restored
    private fun setupNetworkObserver() {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val builder = NetworkRequest.Builder()

        cm.registerNetworkCallback(builder.build(), object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                runOnUiThread {
                    if (layoutNoInternet.visibility == View.VISIBLE || isNetworkError) {
                        hideErrorScreen()
                        webView.reload()
                    }
                }
            }

            override fun onLost(network: Network) {
                runOnUiThread {
                    showErrorScreen()
                }
            }
        })
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }
}
