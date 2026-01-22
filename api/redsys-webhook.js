/**
 * Vercel Serverless Function - Validation webhook Redsys
 * Scénario B - Validation du paiement
 */
const crypto = require('crypto');

module.exports = async (req, res) => {
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

    if (!merchantParams || !signature) {
      throw new Error('Missing parameters');
    }

    const decodedParams = Buffer.from(merchantParams, 'base64').toString('utf8');
    const params = JSON.parse(decodedParams);
    const orderNumber = String(params.Ds_Order || params.DS_MERCHANT_ORDER);
    
    if (!orderNumber) {
      throw new Error('Order number not found');
    }

    console.log('=== REDSYS WEBHOOK VALIDATION ===');
    console.log('Order Number:', orderNumber);
    console.log('Received Signature:', signature);
    
    const expectedSignature = generateSignature(orderNumber, merchantParams, MERCHANT_KEY);
    
    console.log('Expected Signature:', expectedSignature);
    console.log('Signatures match:', signature === expectedSignature);
    console.log('===================================');

    const isValid = signature === expectedSignature;
    const responseCode = params.Ds_Response || params.DS_MERCHANT_RESPONSE;
    const isSuccess = isValid && parseInt(responseCode) >= 0 && parseInt(responseCode) <= 99;

    return res.status(200).json({
      isValid: isValid,
      isSuccess: isSuccess,
      paymentStatus: isSuccess ? 'approved' : 'rejected',
      orderNumber: orderNumber,
      responseCode: responseCode,
      authorizationCode: params.Ds_AuthorisationCode,
      amount: params.Ds_Amount,
      shouldUpdateEnrollment: isValid,
      shouldSendEmail: isSuccess,
      shouldCreateCalendarEvent: isSuccess,
      decodedParams: params
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(400).json({
      success: false,
      isValid: false,
      isSuccess: false,
      error: error.message
    });
  }
};

function generateSignature(orderNumber, merchantParamsBase64, merchantKey) {
  const key = Buffer.from(merchantKey, 'base64');
  const orderPadded = String(orderNumber).padEnd(16, '\0');
  
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
