/**
 * Module Make.com - Traitement Webhook Redsys
 * À utiliser dans un webhook "Custom webhook" puis module JavaScript
 */

const crypto = require('crypto');

// ===== CONFIGURATION =====
const MERCHANT_KEY = "VOTRE_CLE_SHA256_ICI";  // Même clé que préparation

// ===== RÉCEPTION DES DONNÉES REDSYS =====
// Redsys envoie ces paramètres en POST
const receivedParams = {{webhook.Ds_MerchantParameters}};  // Base64
const receivedSignature = {{webhook.Ds_Signature}};        // Base64
const signatureVersion = {{webhook.Ds_SignatureVersion}};  // "HMAC_SHA256_V1"

// ===== DÉCODAGE DES PARAMÈTRES =====
const paramsJSON = Buffer.from(receivedParams, 'base64').toString('utf8');
const params = JSON.parse(paramsJSON);

// Extraction des données importantes
const orderNumber = params.Ds_Order;
const responseCode = params.Ds_Response;  // 0000-0099 = OK, >= 0100 = KO
const authorizationCode = params.Ds_AuthorisationCode;
const amount = parseInt(params.Ds_Amount) / 100;  // Reconvertir en euros
const cardCountry = params.Ds_Card_Country;
const date = params.Ds_Date;
const hour = params.Ds_Hour;

// ===== VALIDATION SIGNATURE =====
function validateSignature(orderNumber, receivedParams, receivedSignature, merchantKey) {
  // 1. Décode la clé merchant
  const key = Buffer.from(merchantKey, 'base64');
  
  // 2. Crée une clé dérivée avec l'order number
  const cipher = crypto.createCipheriv('des-ede3-cbc', key, Buffer.alloc(8, 0));
  cipher.setAutoPadding(false);
  const derivedKey = Buffer.concat([
    cipher.update(orderNumber, 'utf8'),
    cipher.final()
  ]);
  
  // 3. Génère le HMAC SHA-256 avec les paramètres reçus
  const hmac = crypto.createHmac('sha256', derivedKey);
  hmac.update(receivedParams);
  const calculatedSignature = hmac.digest('base64');
  
  // 4. Compare avec la signature reçue
  return calculatedSignature === receivedSignature;
}

const isValid = validateSignature(orderNumber, receivedParams, receivedSignature, MERCHANT_KEY);

// ===== DÉTERMINER LE STATUT =====
let paymentStatus;
let isSuccess = false;

if (!isValid) {
  paymentStatus = "Invalid Signature";
  isSuccess = false;
} else {
  const responseInt = parseInt(responseCode);
  
  if (responseInt >= 0 && responseInt <= 99) {
    paymentStatus = "Paid";
    isSuccess = true;
  } else if (responseCode === "900") {
    // Confirmation de préautorisation ou dévolution
    paymentStatus = "Paid";
    isSuccess = true;
  } else {
    paymentStatus = "Failed";
    isSuccess = false;
  }
}

// ===== OUTPUT POUR MAKE =====
output = {
  isValid: isValid,
  isSuccess: isSuccess,
  paymentStatus: paymentStatus,
  orderNumber: orderNumber,
  responseCode: responseCode,
  authorizationCode: authorizationCode,
  amount: amount,
  cardCountry: cardCountry,
  transactionDate: date,
  transactionHour: hour,
  
  // Données complètes pour logging
  fullParams: params,
  
  // Pour router dans Make
  shouldUpdateEnrollment: isValid,
  shouldSendEmail: isValid && isSuccess,
  shouldCreateCalendarEvent: isValid && isSuccess
};// JavaScript Document
