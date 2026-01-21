/**
 * Vercel Serverless Function - Génération signature Redsys
 * Version ROBUSTE finale
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
    const MERCHANT_KEY = "tkkBKNEBXAMrpyEAua+xz1KXpkr54mOO"; // Tes vraies credentials
    const MERCHANT_CODE = data.merchantCode || "355952300"; // Ton commerce
    const TERMINAL = data.terminal || "1";
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

    // Réponse
    res.status(200).json({
      success: true,
      Ds_SignatureVersion: "HMAC_SHA256_V1",
      Ds_MerchantParameters: merchantParamsBase64,
      Ds_Signature: signature,
      redsysURL: "https://sis.redsys.es/sis/realizarPago",  // PROD (sans -t)
      orderNumber: orderNumber,
      debug: {
        receivedData: {
          orderNumber: data.orderNumber,
          amount: data.amount,
          studentEmail: data.studentEmail,
          courseName: data.courseName
        }
      }
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
};

// Génération signature
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
