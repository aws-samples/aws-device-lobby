# Example Public Key Infrastructure for Device Lobby
This directory provides sample CA configurations for creating the following example PKI for use with the Device Lobby onboarding service:
```
|-Root CA (root-ca/)
  |-> Intermediate CA (int1-ca/)
      |-> Device Certificates (devices/)
```

## PKI Quickstart

1. Create the Root and Intermediate CAs with the following command from the `pki/` directory of this repo:

```
cd pki/
./setup-pki.sh
```
After execution, the CA certificates can be found in their respective directories: `rootCA/` and `int1-ca/`

2. Register the Intermediate CA certificate with the IoT Core Device Lobby account and enable automatic registration for device certs signed by this CA:

```
./register_int1CA_with_lobby_account.sh
```
Upon sucessfull execution, you should see the CA cert ARN and Id printed:
> {  
>    "certificateArn": "arn:aws:iot:us-east-1:643123322899:cacert/b1bbd082208fe5894039d9b2149c47b959c64d7688b089301e77d6f6375ff2ec",  
>    "certificateId": "b1bbd082208fe5894039d9b2149c47b959c64d7688b089301e77d6f6375ff2ec"  
> }

---->[Back to main QuickStart](../README.md#step-4---setup-the-example-public-key-infrastructure-pki-and-register-the-signing-ca-for-your-device-certificates)

## Device Credential Creation using PKI
Create device credentials signed by the intermediate CA with the following command:

```
./create_thing_creds.sh <thing-name>
```
This will produce 4 files in the `devices/` directory:
> thingname.csr.pem - certificate signing request for generating the cert  
> thingname.key.pem - device private key  
> thingname.crt.pem - device certificate signed by the intermediate CA
> thingname-int1ca.crt.pem - concatination of device cert and signing intermediate ca cert needed for JITR
