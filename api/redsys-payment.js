/**
 * Vercel Serverless Function - Génération signature Redsys
 * Scénario A - Création du paiement
 * VERSION FINALE PRODUCTION
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
    
    // ✅ CORRECTION CRITIQUE : Terminal toujours sur 3 chiffres
    const TERMINAL = String(data.terminal || "001").padStart(3, '0');
    
    const CURRENCY = "978";
    const TRANSACTION_TYPE = "0";
    
    // Données avec valeurs par défaut robustes
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
    
    // ============= LOGS DE DEBUG =============
    console.log('=== REDSYS PAYMENT CREATION ===');
    console.log('Order Number:', orderNumber);
    console.log('Terminal:', TERMINAL);
    console.log('Amount:', amount);
    console.log('Merchant Code:', MERCHANT_CODE);
    console.log('Merchant Key length:', MERCHANT_KEY.length);
    console.log('Merchant Params preview:', merchantParamsBase64.substring(0, 50));
    console.log('Signature:', signature);
    console.log('================================');
    // =========================================
    
    // Réponse HTML avec formulaire auto-submit
    const htmlResponse = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redirigiendo al pago...</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            padding: 50px 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 450px;
            width: 100%;
            text-align: center;
        }
        .logo {
            font-size: 48px;
            margin-bottom: 20px;
        }
        h1 {
            color: #333;
            font-size: 24px;
            margin-bottom: 10px;
            font-weight: 600;
        }
        p {
            color: #666;
            font-size: 16px;
            margin-bottom: 30px;
        }
        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            width: 60px;
            height: 60px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .security {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            color: #10b981;
            font-size: 14px;
            margin-top: 20px;
        }
        .security svg {
            width: 18px;
            height: 18px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🔒</div>
        <h1>Redirigiendo al pago seguro</h1>
        <p>Por favor espera mientras te redirigimos a la pasarela de pago de tu banco...</p>
        <div class="spinner"></div>
        <div class="security">
            <svg fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
            </svg>
            Conexión segura
        </div>
    </div>
    
    <form id="redsysForm" action="https://sis.redsys.es/sis/realizarPago" method="POST" style="display:none;">
        <input type="hidden" name="Ds_SignatureVersion" value="HMAC_SHA256_V1" />
        <input type="hidden" name="Ds_MerchantParameters" value="${merchantParamsBase64}" />
        <input type="hidden" name="Ds_Signature" value="${signature}" />
    </form>
    
    <script>
        setTimeout(function() {
            document.getElementById('redsysForm').submit();
        }, 1500);
    </script>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(htmlResponse);

  } catch (error) {
    console.error('❌ Error in payment creation:', error);
    res.status(400).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
};

/**
 * Fonction de génération de signature Redsys
 * Utilise l'algorithme HMAC SHA-256 avec clé dérivée 3DES
 * CETTE FONCTION DOIT ÊTRE IDENTIQUE À CELLE DE redsys-webhook.js
 */
function generateSignature(orderNumber, merchantParamsBase64, merchantKey) {
  try {
    // Décoder la clé Base64
    const key = Buffer.from(merchantKey, 'base64');
    
    // Padder le numéro de commande à 16 caractères avec des null bytes
    const orderPadded = orderNumber.padEnd(16, '\0');
    
    // Créer une clé dérivée avec 3DES
    const cipher = crypto.createCipheriv('des-ede3-cbc', key, Buffer.alloc(8, 0));
    cipher.setAutoPadding(false);
    
    const derivedKey = Buffer.concat([
      cipher.update(orderPadded, 'utf8'),
      cipher.final()
    ]);
    
    // Calculer le HMAC SHA-256
    const hmac = crypto.createHmac('sha256', derivedKey);
    hmac.update(merchantParamsBase64);
    
    return hmac.digest('base64');
  } catch (error) {
    console.error('❌ Error generating signature:', error);
    throw error;
  }
}
