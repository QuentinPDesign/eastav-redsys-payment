/**
 * Vercel Serverless Function - Génération signature Redsys
 * Fichier: api/redsys-payment.js
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
    
    const MERCHANT_CODE = data.merchantCode || "355952300";
    const TERMINAL = data.terminal || "1";
    const CURRENCY = "978";
    const TRANSACTION_TYPE = "0";

    const orderNumber = data.orderNumber;
    const amount = data.amount.toString();
    const studentEmail = data.studentEmail;
    const courseName = data.courseName;
    const merchantURL = data.merchantURL;
    const urlOK = data.urlOK;
    const urlKO = data.urlKO;

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
      "DS_MERCHANT_PRODUCTDESCRIPTION": courseName.substring(0, 125),
      "DS_MERCHANT_TITULAR": studentEmail.substring(0, 60)
    };

    // Encodage Base64
    const merchantParamsJSON = JSON.stringify(merchantParameters);
    const merchantParamsBase64 = Buffer.from(merchantParamsJSON, 'utf8').toString('base64');

    // Génération signature
    const signature = generateSignature(orderNumber, merchantParamsBase64, MERCHANT_KEY);

    // Réponse
    res.status(200).json({
      success: true,
      Ds_SignatureVersion: "HMAC_SHA256_V1",
      Ds_MerchantParameters: merchantParamsBase64,
      Ds_Signature: signature,
      redsysURL: "https://sis-t.redsys.es:25443/sis/realizarPago",  // TEST
      // redsysURL: "https://sis.redsys.es/sis/realizarPago",  // PRODUCTION
      orderNumber: orderNumber
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
};

// ===== GÉNÉRATION SIGNATURE =====

function generateSignature(orderNumber, merchantParamsBase64, merchantKey) {
  // 1. Décoder la clé merchant (Base64)
  const key = Buffer.from(merchantKey, 'base64');
  
  // 2. Créer une clé dérivée avec l'order number
  const orderPadded = orderNumber.padEnd(16, '\0');
  
  // Chiffrer avec 3DES-CBC
  const cipher = crypto.createCipheriv('des-ede3-cbc', key, Buffer.alloc(8, 0));
  cipher.setAutoPadding(false);
  
  const derivedKey = Buffer.concat([
    cipher.update(orderPadded, 'utf8'),
    cipher.final()
  ]);
  
  // 3. Générer le HMAC SHA-256
  const hmac = crypto.createHmac('sha256', derivedKey);
  hmac.update(merchantParamsBase64);
  const signature = hmac.digest('base64');
  
  return signature;
}
