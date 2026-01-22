/**
 * Vercel Serverless Function - Validation webhook Redsys
 * VERSION CORRIGÉE COMPLÈTE
 */
const crypto = require('crypto');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = req.body;
    
    const MERCHANT_KEY = "tkkBKNEBXAMrpyEAua+xz1KXpkr54mOO";
    
    const merchantParams = data.Ds_MerchantParameters;
    const signature = data.Ds_Signature;
    const signatureVersion = data.Ds_SignatureVersion;

    if (!merchantParams || !signature) {
      throw new Error('Missing required parameters');
    }

    // Décoder les paramètres
    const decodedParams = Buffer.from(merchantParams, 'base64').toString('utf8');
    const params = JSON.parse(decodedParams);

    const orderNumber = String(params.Ds_Order || params.DS_MERCHANT_ORDER);
    
    if (!orderNumber) {
      throw new Error('Order number not found in decoded parameters');
    }

    // DEBUG LOGS
    console.log('=== DEBUG SIGNATURE ===');
    console.log('Order Number:', orderNumber);
    console.log('Order Number type:', typeof orderNumber);
    console.log('Order Number length:', orderNumber.length);
    console.log('Merchant Params (first 50 chars):', merchantParams.substring(0, 50));
    console.log('Received Signature:', signature);
    
    // Générer la signature attendue
    const expectedSignature = generateSignature(orderNumber, merchantParams, MERCHANT_KEY);
    
    console.log('Expected Signature:', expectedSignature);
    console.log('Signatures match:', signature === expectedSignature);
    console.log('=======================');

    // Comparer les signatures
    const isValid = signature === expectedSignature;

    const responseCode = params.Ds_Response || params.DS_MERCHANT_RESPONSE;
    const isSuccess = isValid && parseInt(responseCode) >= 0 && parseInt(responseCode) <= 99;

    // Réponse
    return res.status(200).json({
      isValid: isValid,
      isSuccess: isSuccess,
      paymentStatus: isSuccess ? 'approved' : 'rejected',
      orderNumber: orderNumber,
      responseCode: responseCode,
      authorizationCode: params.Ds_AuthorisationCode || params.DS_MERCHANT_AUTHORISATIONCODE,
      amount: params.Ds_Amount || params.DS_MERCHANT_AMOUNT,
      shouldUpdateEnrollment: isValid,
      shouldSendEmail: isSuccess,
      shouldCreateCalendarEvent: isSuccess,
      decodedParams: params,
      debug: {
        receivedSignature: signature,
        expectedSignature: expectedSignature,
        orderNumberUsed: orderNumber,
        orderNumberType: typeof orderNumber,
        merchantParamsPreview: merchantParams.substring(0, 50)
      }
    });

  } catch (error) {
    console.error('Error in webhook validation:', error);
    return res.status(400).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
};

// Fonction de génération de signature
function generateSignature(orderNumber, merchantParamsBase64, merchantKey) {
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
}
