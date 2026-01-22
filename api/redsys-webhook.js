try {
  const data = req.body;
  
  const MERCHANT_KEY = "tkkBKNEBXAMrpyEAua+xz1KXpkr54mOO";
  
  const merchantParams = data.Ds_MerchantParameters;
  const signature = data.Ds_Signature;
  const signatureVersion = data.Ds_SignatureVersion;

  // Décoder les paramètres
  const decodedParams = Buffer.from(merchantParams, 'base64').toString('utf8');
  const params = JSON.parse(decodedParams);

  const orderNumber = String(params.Ds_Order || params.DS_MERCHANT_ORDER);
  
  if (!orderNumber) {
    throw new Error('Order number not found in decoded parameters');
  }

  // ⭐ DEBUG LOGS
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
  res.status(400).json({
    success: false,
    error: error.message,
    stack: error.stack
  });
}
