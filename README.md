# IoT Device Lobby Architecture
This solution provides a method for QR code onboarding of devices to AWS IoT Core. It simplifies the provisioning and onboarding process of devices by removing the requirement that an end cloud account/region is known at the time of device provisioning in the factory.  This enables device makers to produce generic IoT devices not bound to end cloud services and for IoT platform operators to flexibly attach these devices to their services in the field. 

Refer to the [DESIGN](DESIGN.md) doc for [USE CASES](DESIGN.md#device-onboarding-use-cases) and implementation details.

## Quickstart Guide
### Step 1 - Setup a deployment environment in Cloud9

1. **Log in to the [AWS Account Console](https://console.aws.amazon.com).**
1. **[Create](https://console.aws.amazon.com/cloud9/home/create?) a Cloud9 environment with the following configuration:**
   - Name: **Device Lobby Deployment Env**
   - Environment type: **Create a new EC2 instance for environment (direct access)**
   - Instance type: **t3.small**
   - Platform: **Ubuntu Server 18.04 LTS**

### Step 2 - Deploy the Device Lobby Service infrastructure and Admin APIs.
1. **In the Cloud9 IDE terminal, clone the AWS Device Lobby repo:**
```
git clone <TODO ADD FINAL REPO LINK>
cd aws-device-lobby/
```

2. **Deploy the Device Lobby Service and Admin APIs with the included deploy script:**
```
./deploy.sh
```
This will deploy the service Lambda functions, device ledger DynamoDB table and the AppSync GraphQL APIs for claiming and routing devices.  Refer to the Device Lobby [CloudFormation template](CloudFormation-DeviceLobby-Account.yaml) for more details. 
When the deploy script finishes, the ARNs of the primary services elements are printed including the AppSync API ID and API key used for administering the Device Lobby service. 

### Step 3 - Deploy the Device Lobby Admin console web application.

---->[Follow the Device Lobby admin console quickstart.](admin-interface/admin-console#deployment-quickstart-guide)

### Step 4 - Setup the example public key infrastructure (PKI) and register the signing CA for your device certificates.

---->[Follow the PKI Quickstart](pki#pki-quickstart)

### Step 5 - Provision, connect and claim devices through the Device Lobby

---->[Follow the AWS IoT SDK v2 for Python Quickstart](device/aws-iot-python-sdkv2/README.md#quickstart)

Beyond this quickstart example, checkout the [device README](device/README.md) for other sample device implementations of Device Lobby onboarding.


## Device Lobby Usage


## Device Lobby Configuration
### Adding target AWS accounts and regions
Additional ***target accounts*** can be added to the service by enabling trust from a role in the target account and the commissioner lambda execution role in the account hosting the device lobby service.  This can be done with the following steps:
1. ***IN THE DEVICE LOBBY ACCOUNT***, retrieve the ARN for the execution role for the Commissioner Lambda function.  This can be done in the terminal of the Cloud9 deployment environment with the following command:
   ```
   aws iam list-roles --query 'Roles[?contains(RoleName, `CommissionerLambdaFunctionRole`)== `true`].Arn' --output text
   ```
2. ***IN THE TARGET ACCOUNT***, create a role with the name `lobby_commissioner_role` and attach the following policy document:
   ```
   {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "iot:RegisterCertificateWithoutCA",
                "iot:RegisterThing",
                "iot:CreatePolicy",
                "iot:AttachPrincipalPolicy",
                "iot:CreateThing",
                "iot:AttachThingPrincipal",
                "iot:UpdateCertificate",
                "iot:DescribeEndpoint"
            ],
            "Resource": [
                "*"
            ],
            "Effect": "Allow"
         }
      ]
   }
   ```
   Add the following trust relationship (AssumeRolePolicyDocument) using the ARN of the Commissioner Lambda Execution Role from Step 1 to enable the Commissioner Lambda to assume this role in the target account:
   ```
   {
      "Version": "2012-10-17",
      "Statement": [
         {
               "Effect": "Allow",
               "Principal": {
                  "AWS": "<ARN of Lobby Commissioner Lambda Execution Role>"
               },
               "Action": "sts:AssumeRole"
         }
      ]
   }
   ```

3. ***IN THE DEVICE LOBBY ACCOUNT DEPLOYMENT ENVIRONMENT***, add the name and AWS Account ID of the new target account to [target-accounts.js](admin-interface/admin-console/src/target-accounts.js) of the admin console source code.  
   Then build and publish the updated admin console by executing `amplify publish` from the `admin-interface/admin-console/` path in the terminal of the deployment environment.

The ***target region*** list can be updated in the admin console source file [target-regions.js](admin-interface/admin-console/src/target-regions.js).  Once updated, the admin console will need to be built and published with `amplify publish`.  Because the IAM permissions for the Commissioner Lambda are global, nothing more is needed to add or remove target regions than to modify this list in the console source.   


### Adding additional device signing CAs 

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the [LICENSE](LICENSE) file.


 
