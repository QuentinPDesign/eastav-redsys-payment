/**
 * Vercel Serverless Function - Validation webhook Redsys
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

    // Clé SHA-256
    const MERCHANT_KEY = "tkkBKNEBXAMrpyEAua+xz1KXpkr54mOO";

    const merchantParams = data.Ds_MerchantParameters;
    const signature = data.Ds_Signature;
    const signatureVersion = data.Ds_SignatureVersion;

    // Décoder les paramètres
    const decodedParams = Buffer.from(merchantParams, 'base64').toString('utf8');
    const params = JSON.parse(decodedParams);

    // Extraire le numéro de commande
    const orderNumber = params.Ds_Order || params.DS_MERCHANT_ORDER;

    // Générer la signature attendue
    const expectedSignature = generateSignature(orderNumber, merchantParams, MERCHANT_KEY);

    // Comparer les signatures
    const isValid = signature === expectedSignature;

    // Déterminer le statut du paiement
    const responseCode = params.Ds_Response || params.DS_MERCHANT_RESPONSE;
    const isSuccess = isValid && parseInt(responseCode) >= 0 && parseInt(responseCode) <= 99;

    // Réponse
    res.status(200).json({
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
      decodedParams: params
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
};

// Génération signature (même fonction que pour le paiement)
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
