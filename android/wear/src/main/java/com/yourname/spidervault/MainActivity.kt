package com.yourname.spidervault

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material3.*
import androidx.wear.compose.navigation.SwipeDismissableNavHost
import androidx.wear.compose.navigation.composable
import androidx.wear.compose.navigation.rememberSwipeDismissableNavController
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.*
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec
import android.util.Base64

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            SpiderVaultWearApp()
        }
    }
}

// TODO: Replace with your actual Supabase credentials from your .env file
const val SUPABASE_URL = "https://your-project-id.supabase.co"
const val SUPABASE_ANON_KEY = "your-anon-key"

@Composable
fun SpiderVaultWearApp() {
    val navController = rememberSwipeDismissableNavController()
    var userSession by remember { mutableStateOf<JSONObject?>(null) }
    var encryptionKey by remember { mutableStateOf<ByteArray?>(null) }

    AppScaffold {
        SwipeDismissableNavHost(
            navController = navController,
            startDestination = "login"
        ) {
            composable("login") {
                LoginScreen(onLoginSuccess = { session, key ->
                    userSession = session
                    encryptionKey = key
                    navController.navigate("vault")
                })
            }
            composable("vault") {
                VaultListScreen(
                    session = userSession,
                    onItemSelected = { item ->
                        navController.navigate("detail/${item.getString("id")}")
                    }
                )
            }
            composable("detail/{itemId}") { backStackEntry ->
                val itemId = backStackEntry.arguments?.getString("itemId")
                VaultDetailScreen(
                    itemId = itemId,
                    session = userSession,
                    encryptionKey = encryptionKey
                )
            }
        }
    }
}

@Composable
fun LoginScreen(onLoginSuccess: (JSONObject, ByteArray) -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Alignment.Center
    ) {
        Text("SpiderVault", style = MaterialTheme.typography.titleMedium)
        Spacer(modifier = Modifier.height(8.dp))
        // Simple text inputs for Wear (in real app, use RemoteInput or keyboard)
        // For this demo, we'll use a mock login button or simple fields
        Button(onClick = {
            loading = true
            scope.launch {
                try {
                    // 1. Derive Keys (PBKDF2)
                    val keys = deriveKeys(password, email)
                    
                    // 2. Sign In to Supabase
                    val session = signIn(email, keys.authHash)
                    if (session != null) {
                        onLoginSuccess(session, keys.encryptionKey)
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                } finally {
                    loading = false
                }
            }
        }, enabled = !loading) {
            if (loading) CircularProgressIndicator() else Text("LOGIN")
        }
    }
}

@Composable
fun VaultListScreen(session: JSONObject?, onItemSelected: (JSONObject) -> Unit) {
    var items by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        scope.launch {
            val fetchedItems = fetchVaultItems(session?.getString("access_token"))
            items = fetchedItems
            loading = false
        }
    }

    if (loading) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
    } else {
        // Use Wear OS ScalingLazyColumn for optimized scrolling
        // For simplicity using a Column with scroll for now
        Column(Modifier.fillMaxSize().padding(8.dp)) {
            items.forEach { item ->
                Button(
                    onClick = { onItemSelected(item) },
                    modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp)
                ) {
                    Text(item.getString("title"))
                }
            }
        }
    }
}

@Composable
fun VaultDetailScreen(itemId: String?, session: JSONObject?, encryptionKey: ByteArray?) {
    var item by remember { mutableStateOf<JSONObject?>(null) }
    var decryptedText by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(itemId) {
        scope.launch {
            item = fetchVaultItem(itemId, session?.getString("access_token"))
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Alignment.Center
    ) {
        item?.let {
            Text(it.getString("title"), style = MaterialTheme.typography.titleSmall)
            Spacer(modifier = Modifier.height(8.dp))
            
            if (decryptedText == null) {
                Button(onClick = {
                    scope.launch {
                        val encryptedData = it.getString("encrypted_data")
                        decryptedText = decryptData(encryptedData, encryptionKey!!)
                    }
                }) {
                    Text("DECRYPT")
                }
            } else {
                Text(decryptedText!!, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

// --- Crypto Utils ---

data class DerivedKeys(val authHash: String, val encryptionKey: ByteArray)

suspend fun deriveKeys(password: String, email: String): DerivedKeys = withContext(Dispatchers.Default) {
    val iterations = 600000
    val salt = email.lowercase().toByteArray()
    val spec = PBEKeySpec(password.toCharArray(), salt, iterations, 512)
    val skf = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
    val derivedBytes = skf.generateSecret(spec).encoded
    
    val authHashBytes = derivedBytes.sliceArray(0 until 32)
    val encryptionKeyBytes = derivedBytes.sliceArray(32 until 64)
    
    val authHash = authHashBytes.joinToString("") { "%02x".format(it) }
    DerivedKeys(authHash, encryptionKeyBytes)
}

suspend fun decryptData(base64Ciphertext: String, keyBytes: ByteArray): String = withContext(Dispatchers.Default) {
    val combined = Base64.decode(base64Ciphertext, Base64.DEFAULT)
    val iv = combined.sliceArray(0 until 12)
    val ciphertext = combined.sliceArray(12 until combined.size)
    
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    val spec = GCMParameterSpec(128, iv)
    val keySpec = SecretKeySpec(keyBytes, "AES")
    
    cipher.init(Cipher.DECRYPT_MODE, keySpec, spec)
    val decryptedBytes = cipher.doFinal(ciphertext)
    String(decryptedBytes)
}

// --- Supabase Client (Simple OkHttp implementation) ---

private val client = OkHttpClient()

suspend fun signIn(email: String, authHash: String): JSONObject? = withContext(Dispatchers.IO) {
    val json = JSONObject().apply {
        put("email", email)
        put("password", authHash)
    }
    
    val request = Request.Builder()
        .url("$SUPABASE_URL/auth/v1/token?grant_type=password")
        .addHeader("apikey", SUPABASE_ANON_KEY)
        .post(json.toString().toRequestBody("application/json".toMediaType()))
        .build()

    client.newCall(request).execute().use { response ->
        if (response.isSuccessful) {
            JSONObject(response.body?.string() ?: "")
        } else null
    }
}

suspend fun fetchVaultItems(accessToken: String?): List<JSONObject> = withContext(Dispatchers.IO) {
    val request = Request.Builder()
        .url("$SUPABASE_URL/rest/v1/vault_items?select=*")
        .addHeader("apikey", SUPABASE_ANON_KEY)
        .addHeader("Authorization", "Bearer $accessToken")
        .get()
        .build()

    client.newCall(request).execute().use { response ->
        if (response.isSuccessful) {
            val array = JSONArray(response.body?.string() ?: "[]")
            List(array.length()) { array.getJSONObject(it) }
        } else emptyList()
    }
}

suspend fun fetchVaultItem(id: String?, accessToken: String?): JSONObject? = withContext(Dispatchers.IO) {
    val request = Request.Builder()
        .url("$SUPABASE_URL/rest/v1/vault_items?id=eq.$id&select=*")
        .addHeader("apikey", SUPABASE_ANON_KEY)
        .addHeader("Authorization", "Bearer $accessToken")
        .get()
        .build()

    client.newCall(request).execute().use { response ->
        if (response.isSuccessful) {
            val array = JSONArray(response.body?.string() ?: "[]")
            if (array.length() > 0) array.getJSONObject(0) else null
        } else null
    }
}
