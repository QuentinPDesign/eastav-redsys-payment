/**
 * Vercel Serverless Function - Génération signature Redsys
 * Scénario A - Création du paiement
 * VERSION CORRECTE - Renvoie SEULEMENT JSON (pas de HTML)
 */
const crypto = require('crypto');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = req.body;
    
    // Clé SHA-256 PRODUCTION (identique à redsys-webhook.js)
    const MERCHANT_KEY = "tkkBKNEBXAMrpyEAua+xz1KXpkr54mOO";
    const MERCHANT_CODE = data.merchantCode || "355952300";
    
    // ✅ Terminal toujours sur 3 chiffres
    const TERMINAL = String(data.terminal || "001").padStart(3, '0');
    
    const CURRENCY = "978";
    const TRANSACTION_TYPE = "0";
    
    // Données
    const orderNumber = String(data.orderNumber || "TEST001");
    const amount = String(data.amount || 0);
    const studentEmail = String(data.studentEmail || "test@example.com");
    const courseName = String(data.courseName || "Curso");
    const merchantURL = String(data.merchantURL || "");
    const urlOK = String(data.urlOK || "");
    const urlKO = String(data.urlKO || "");
    
    // Construction des paramètres
    const merchantParameters = {
      "DS_MERCHANT_AMOUNT": amount,
      "DS_MERCHANT_ORDER": orderNumber,
      "DS_MERCHANT_MERCHANTCODE": MERCHANT_CODE,
      "DS_MERCHANT_CURRENCY": CURRENCY,
      "DS_MERCHANT_TRANSACTIONTYPE": TRANSACTION_TYPE,
      "DS_MERCHANT_TERMINAL": TERMINAL,
      "DS_MERCHANT_MERCHANTURL": merchantURL,
      "DS_MERCHANT_URLOK": urlOK,
      "DS_MERCHANT_URLKO": urlKO,
      "DS_MERCHANT_CONSUMERLANGUAGE": "002",
      "DS_MERCHANT_PRODUCTDESCRIPTION": courseName.substring(0, Math.min(125, courseName.length)),
      "DS_MERCHANT_TITULAR": studentEmail.substring(0, Math.min(60, studentEmail.length))
    };
    
    // Encodage Base64
    const merchantParamsJSON = JSON.stringify(merchantParameters);
    const merchantParamsBase64 = Buffer.from(merchantParamsJSON, 'utf8').toString('base64');
    
    // Génération signature
    const signature = generateSignature(orderNumber, merchantParamsBase64, MERCHANT_KEY);
    
    // Logs de debug
    console.log('=== REDSYS PAYMENT CREATION ===');
    console.log('Order Number:', orderNumber);
    console.log('Terminal:', TERMINAL);
    console.log('Amount:', amount);
    console.log('Signature:', signature);
    console.log('================================');
    
    // ✅ Renvoyer SEULEMENT les données JSON (pas de HTML)
    return res.status(200).json({
      success: true,
      orderNumber: orderNumber,
      amount: amount,
      terminal: TERMINAL,
      merchantCode: MERCHANT_CODE,
      signature: signature,
      merchantParameters: merchantParamsBase64,
      signatureVersion: "HMAC_SHA256_V1",
      redsysURL: "https://sis.redsys.es/sis/realizarPago"
    });

  } catch (error) {
    console.error('❌ Error in payment creation:', error);
    return res.status(400).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
};

/**
 * Fonction de génération de signature Redsys
 */
function generateSignature(orderNumber, merchantParamsBase64, merchantKey) {
  try {
    const key = Buffer.from(merchantKey, 'base64');
    const orderPadded = orderNumber.padEnd(16, '\0');
    
    const cipher = crypto.createCipheriv('des-ede3-cbc', key, Buffer.alloc(8, 0));
    cipher.setAutoPadding(false);
    
    const derivedKey = Buffer.concat([
      cipher.update(orderPadded, 'utf8'),
      cipher.final()
    ]);
    
    const hmac = crypto.createHmac('sha256', derivedKey);
    hmac.update(merchantParamsBase64);
    
    return hmac.digest('base64');
  } catch (error) {
    console.error('❌ Error generating signature:', error);
    throw error;
  }
}
```

---

## 🎯 Points clés

1. **Ligne 30** : Terminal avec `padStart(3, '0')` ✅
2. **Ligne 28** : Même clé que webhook ✅
3. **Lignes 76-85** : Renvoie SEULEMENT du JSON (pas de HTML) ✅
4. **Fonction generateSignature** : Identique au webhook ✅

---

## 📋 Utilisation dans Make

**Module Update Enrollment :**
```
Redsys Order Number: {{5.orderNumber}}
```

**Module Webhook Response :**
```
HTML codé en dur dans Make (comme avant)
