#!/usr/bin/env bash

# now register the intermediate ca that will be used for generating certificates with the device lobby iot core
AWS_REGION=$(aws configure get region)
VERIFICATION_CODE=$(aws iot get-registration-code --region $AWS_REGION --query "registrationCode" --output text)

cd int1-ca/

# generate a private verification key and CSR with the iot core account verification code as the CN of the subject
openssl genrsa -out verificationCert.key 2048
openssl req -batch -new -key verificationCert.key -out verificationCert.csr -subj "/C=US/CN=$VERIFICATION_CODE"

# sign the verification cert
openssl x509 -req -in verificationCert.csr -CA int1-ca.crt.pem -CAkey int1-ca-priv.key.pem -CAcreateserial -out verificationCert.pem -days 500 -sha256

#register the int1 cert with the device lobby account
aws iot register-ca-certificate --ca-certificate file://int1-ca.crt.pem --verification-cert file://verificationCert.pem --set-as-active --allow-auto-registration --region $AWS_REGION

cd ..

