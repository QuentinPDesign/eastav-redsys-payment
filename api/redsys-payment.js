/**
 * Module Make.com - Préparation paiement Redsys
 * À utiliser dans un module "Tools > Set Variable" ou "HTTP > Make a request"
 */

const crypto = require('crypto');

// ===== CONFIGURATION REDSYS =====
const MERCHANT_CODE = "355952300";  // Ton FUC
const TERMINAL = "001";
const MERCHANT_KEY = "tkkBKNEBXAMrpyEAua+xz1KXpkr54mOO";  // À récupérer depuis Canales
const CURRENCY = "978";  // EUR
const TRANSACTION_TYPE = "0";  // Autorisation standard

// ===== DONNÉES DU PAIEMENT =====
// Ces variables viennent de tes modules précédents Make
const orderNumber = {{enrollment.recordId}}.substring(3, 15); // Prendre 4-12 chars du record ID
const amount = Math.round({{session.price}} * 100); // Convertir en centimes
const studentEmail = {{student.email}};
const courseName = {{course.name}};

// URLs de retour (à adapter selon ton domaine)
const merchantURL = "https://eastav.com/api/redsys-notification"; // Webhook
const urlOK = "https://eastav.com/payment-success?order=" + orderNumber;
const urlKO = "https://eastav.com/payment-failed?order=" + orderNumber;

// ===== CONSTRUCTION DES PARAMÈTRES =====
const merchantParameters = {
  "DS_MERCHANT_AMOUNT": amount.toString(),
  "DS_MERCHANT_ORDER": orderNumber,
  "DS_MERCHANT_MERCHANTCODE": MERCHANT_CODE,
  "DS_MERCHANT_CURRENCY": CURRENCY,
  "DS_MERCHANT_TRANSACTIONTYPE": TRANSACTION_TYPE,
  "DS_MERCHANT_TERMINAL": TERMINAL,
  "DS_MERCHANT_MERCHANTURL": merchantURL,
  "DS_MERCHANT_URLOK": urlOK,
  "DS_MERCHANT_URLKO": urlKO,
  "DS_MERCHANT_CONSUMERLANGUAGE": "002", // Espagnol
  "DS_MERCHANT_PRODUCTDESCRIPTION": courseName.substring(0, 125),
  "DS_MERCHANT_TITULAR": studentEmail.substring(0, 60)
};

// ===== ENCODAGE BASE64 =====
const merchantParamsJSON = JSON.stringify(merchantParameters);
const merchantParamsBase64 = Buffer.from(merchantParamsJSON, 'utf8').toString('base64');

// ===== GÉNÉRATION SIGNATURE SHA-256 =====
function generateSignature(orderNumber, merchantParamsBase64, merchantKey) {
  // 1. Décode la clé merchant (stockée en Base64)
  const key = Buffer.from(merchantKey, 'base64');
  
  // 2. Crée une clé dérivée avec l'order number
  const cipher = crypto.createCipheriv('des-ede3-cbc', key, Buffer.alloc(8, 0));
  cipher.setAutoPadding(false);
  const derivedKey = Buffer.concat([
    cipher.update(orderNumber, 'utf8'),
    cipher.final()
  ]);
  
  // 3. Génère le HMAC SHA-256
  const hmac = crypto.createHmac('sha256', derivedKey);
  hmac.update(merchantParamsBase64);
  const signature = hmac.digest('base64');
  
  return signature;
}

const signature = generateSignature(orderNumber, merchantParamsBase64, MERCHANT_KEY);

// ===== OUTPUT POUR MAKE =====
// Ces variables seront utilisées dans le module suivant
output = {
  Ds_SignatureVersion: "HMAC_SHA256_V1",
  Ds_MerchantParameters: merchantParamsBase64,
  Ds_Signature: signature,
  redsysURL: "https://sis.redsys.es/sis/realizarPago",
  orderNumber: orderNumber
};// JavaScript Document
