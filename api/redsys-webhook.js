/**
 * Vercel Serverless Function - Validation webhook Redsys
 * Scénario B - Appelé par Make.com après réception du webhook Redsys
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
    
    // Clé de production Redsys (identique à redsys-payment.js)
    const MERCHANT_KEY = "tkkBKNEBXAMrpyEAua+xz1KXpkr54mOO";
    
    // Récupérer les paramètres du webhook Redsys
    const merchantParams = data.Ds_MerchantParameters;
    const signature = data.Ds_Signature;
    const signatureVersion = data.Ds_SignatureVersion;

    // Vérifier que les paramètres obligatoires sont présents
    if (!merchantParams || !signature) {
      throw new Error('Missing required parameters: Ds_MerchantParameters or Ds_Signature');
    }

    // Décoder les paramètres Base64
    const decodedParams = Buffer.from(merchantParams, 'base64').toString('utf8');
    const params = JSON.parse(decodedParams);

    // Extraire le numéro de commande (Redsys renvoie Ds_Order)
    const orderNumber = String(params.Ds_Order || params.DS_MERCHANT_ORDER);
    
    if (!orderNumber) {
      throw new Error('Order number not found in decoded parameters');
    }

    // ============= LOGS DE DEBUG =============
    console.log('=== REDSYS WEBHOOK VALIDATION ===');
    console.log('Order Number:', orderNumber);
    console.log('Order Number type:', typeof orderNumber);
    console.log('Order Number length:', orderNumber.length);
    console.log('Merchant Key length:', MERCHANT_KEY.length);
    console.log('Merchant Params preview:', merchantParams.substring(0, 50));
    console.log('Received Signature:', signature);
    
    // Générer la signature attendue
    const expectedSignature = generateSignature(orderNumber, merchantParams, MERCHANT_KEY);
    
    console.log('Expected Signature:', expectedSignature);
    console.log('Signatures match:', signature === expectedSignature);
    console.log('===================================');
    // =========================================

    // Valider la signature
    const isValid = signature === expectedSignature;

    // Extraire le code de réponse
    const responseCode = params.Ds_Response || params.DS_MERCHANT_RESPONSE;
    
    // Déterminer si le paiement est réussi
    // Codes 0000-0099 = Succès
    const isSuccess = isValid && parseInt(responseCode) >= 0 && parseInt(responseCode) <= 99;

    // Construire la réponse pour Make.com
    return res.status(200).json({
      isValid: isValid,
      isSuccess: isSuccess,
      paymentStatus: isSuccess ? 'approved' : 'rejected',
      orderNumber: orderNumber,
      responseCode: responseCode,
      authorizationCode: params.Ds_AuthorisationCode || params.DS_MERCHANT_AUTHORISATIONCODE,
      amount: params.Ds_Amount || params.DS_MERCHANT_AMOUNT,
      transactionDate: params.Ds_Date,
      transactionHour: params.Ds_Hour,
      cardCountry: params.Ds_Card_Country,
      cardBrand: params.Ds_Card_Brand,
      terminal: params.Ds_Terminal,
      // Flags pour Make.com
      shouldUpdateEnrollment: isValid,
      shouldSendEmail: isSuccess,
      shouldCreateCalendarEvent: isSuccess,
      // Tous les paramètres décodés
      decodedParams: params,
      // Debug info
      debug: {
        receivedSignature: signature,
        expectedSignature: expectedSignature,
        orderNumberUsed: orderNumber,
        orderNumberType: typeof orderNumber,
        signatureMatch: signature === expectedSignature,
        merchantKeyLength: MERCHANT_KEY.length
      }
    });

  } catch (error) {
    console.error('❌ Error in webhook validation:', error);
    return res.status(400).json({
      success: false,
      isValid: false,
      isSuccess: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Fonction de génération de signature Redsys
 * Utilise l'algorithme HMAC SHA-256 avec clé dérivée 3DES
 * CETTE FONCTION DOIT ÊTRE IDENTIQUE À CELLE DE redsys-payment.js
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
