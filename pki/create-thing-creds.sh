#!/usr/bin/env bash

THING_NAME="$1"
echo "42" > ~/.rnd

# Create a sample device key and CSR
cd devices/
openssl genrsa -out $THING_NAME.key.pem 2048
openssl req -new -sha256 -key $THING_NAME.key.pem -out $THING_NAME.csr.pem -subj "/C=US/ST=AnyState/L=AnyTown/O=AnyCompany/OU=IT/CN=$THING_NAME"

# Create device cert from Int1 CA
cd ../int1-ca/
openssl ca -batch -config int1CA.cnf -extensions v3_req -days 365 -md sha256 -in ../devices/$THING_NAME.csr.pem -out ../devices/$THING_NAME.crt.pem

# append the intermediate CA cert to the device cert for jitr registration
cat ../devices/$THING_NAME.crt.pem int1-ca.crt.pem > ../devices/$THING_NAME-int1ca.crt.pem

cd ..

