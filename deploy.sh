#!/usr/bin/env bash
#Assume current default region.  Update this to the region where the API will be deployed
AWS_REGION=$(aws configure get region)
#Bucket name where artifacts will be deployed
BUCKET_NAME="aws-device-lobby-cf-$(date +%Y%m%d%M%s)"

# Inject the lobby deployment account number into the admin console.
LOBBY_ACCOUNT=$(aws sts get-caller-identity --query "Account" --output text)
sed -i 's/999999999999/'"$LOBBY_ACCOUNT"'/g' admin-interface/admin-console/src/target-accounts.js

# Make the bucket
aws s3 mb s3://$BUCKET_NAME --region $AWS_REGION

# Upload the required artifacts for deployment and package the cloudformation template.
aws cloudformation package --template CloudFormation-DeviceLobby-Account.yaml --s3-bucket $BUCKET_NAME --output-template-file packaged-template.yaml

# Deploy stack
aws cloudformation deploy --template-file packaged-template.yaml --stack-name DeviceLobbyStack --capabilities CAPABILITY_NAMED_IAM --region $AWS_REGION

#Display outputs
aws cloudformation describe-stacks --stack-name DeviceLobbyStack --region $AWS_REGION --query "Stacks[0].Outputs"
