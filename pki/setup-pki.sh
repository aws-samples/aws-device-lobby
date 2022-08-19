#!/usr/bin/env bash

#Create root CA private key, cert and signing resources
cd root-ca/
openssl genrsa -out root-ca-priv.key.pem 2048
openssl req -config rootCA.cnf -x509 -extensions v3_req -new -nodes -key root-ca-priv.key.pem -sha256 -days 9999 -out rootCA.crt.pem
touch index.txt
touch index.txt.attr
echo "4242" > serial


# Create Intermediate 1 private key, CSR and signing resources
cd ../int1-ca/
openssl genrsa -out int1-ca-priv.key.pem 2048
openssl req -config int1CA.cnf -new -sha256 -key int1-ca-priv.key.pem -out int1-ca.csr.pem
touch index.txt
touch index.txt.attr
echo "424242" > serial

# Create Int 1 cert from csr by root ca
cd ../root-ca/
openssl ca -batch -config rootCA.cnf -extensions v3_req -days 3650 -md sha256 -in ../int1-ca/int1-ca.csr.pem -out ../int1-ca/int1-ca.crt.pem

cd ..
