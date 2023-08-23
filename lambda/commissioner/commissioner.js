// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/** 
This node.js Lambda function code is used to evaluate the stream from the device ledger dynamodb table.
If a completed record is seen that includes the device identity and a target account/region, the function
will attempt to register the thing in the target account/region.
**/

const AWS = require('aws-sdk');

// Helper function to trim strings
const trimString = (str) => str.toString().trim();

async function CommissionTarget (tregion, taccount, creds, tobj) {
    const iot = new AWS.Iot({'region': tregion, credentials: creds, apiVersion: '2015-05-28'});
    const certpem = trimString(tobj.cert);
    const policyname = `${trimString(tobj.name)}${trimString(tobj.certId)}`;

    try {
        const data = await iot.registerCertificateWithoutCA({
            certificatePem: certpem
        }).promise();

        let certificateARN;
        if(data.code == 'ResourceAlreadyExistsException') {
            certificateARN = `arn:aws:iot:${tregion}:${taccount}:cert/${trimString(tobj.certId)}`;
        } else {
            certificateARN = trimString(data.certificateArn);
        }

        await iot.createPolicy({
            policyDocument: JSON.stringify(tobj.policy),
            policyName: `${trimString(tobj.name)}${trimString(tobj.certId)}`,
        }).promise();

        await iot.attachPrincipalPolicy({
            policyName: policyname,
            principal: certificateARN
        }).promise();

        await iot.createThing({
            thingName: trimString(tobj.name)
        }).promise();

        await iot.attachThingPrincipal({
            principal: certificateARN,
            thingName: trimString(tobj.name)
        }).promise();

        await iot.updateCertificate({
            certificateId: trimString(tobj.certId),
            newStatus: 'ACTIVE'
        }).promise();

        const data = await iot.describeEndpoint({
            endpointType: 'iot:Data-ATS'
        }).promise();

        const commissionedep = trimString(data.endpointAddress);

        const ddbClient = new AWS.DynamoDB.DocumentClient;
        const table = "devicelobby-ledger";
        await ddbClient.update({
            TableName: table,
            Key:{
              'certid' : trimString(tobj.certId)
            },
            UpdateExpression: 'set iotep = :ep',
            ExpressionAttributeValues: {
            ':ep' : commissionedep
            }
        }).promise();

    } catch (err) {
        if (err.code !== 'ResourceAlreadyExistsException') {
            console.error(err);
            throw err;
        }
    }
}

exports.handler = async function(event, context) {
    const sts = new AWS.STS({apiVersion: '2011-06-15'});

    for (let record of event.Records) {
        if(record.eventName == 'MODIFY') {
            console.log('DynamoDB Record: %j', record.dynamodb);

            if ((record.dynamodb.NewImage.hasOwnProperty("targetaccount")) && (record.dynamodb.NewImage.hasOwnProperty("targetregion")) && record.dynamodb.NewImage.hasOwnProperty("devicecert")) {
                const region = trimString(record.dynamodb.NewImage.targetregion.S);
                const accountId = trimString(record.dynamodb.NewImage.targetaccount.S);
                const role = `arn:aws:iam::${accountId}:role/lobby_commissioner_role`;

                let roleCreds;

                const thingpolicy = {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Action": [
                                "iot:Connect"
                            ],
                            "Resource": `arn:aws:iot:${region}:${accountId}:client/*`
                        },
                        {
                            "Effect": "Allow",
                            "Action": [
                                "iot:Publish"
                            ],
                            "Resource": `arn:aws:iot:${region}:${accountId}:topic/$aws/rules/lobby/`
                        },
                        {
                            "Effect": "Allow",
                            "Action": [
                                "iot:Publish"
                            ],
                            "Resource": `arn:aws:iot:${region}:${accountId}:topic/app/*`
                        },
                        {
                            "Effect": "Allow",
                            "Action": [
                                "iot:Receive"
                            ],
                            "Resource": `arn:aws:iot:${region}:${accountId}:topic/lobby*`
                        },
                        {
                            "Effect": "Allow",
                            "Action": [
                                "iot:Subscribe",
                            ],
                            "Resource": `arn:aws:iot:${region}:${accountId}:topicfilter/lobby*`
                        }
                    ]
                };

                const thingobj = {
                    name: trimString(record.dynamodb.NewImage.devicename.S),
                    cert: trimString(record.dynamodb.NewImage.devicecert.S),
                    certId: trimString(record.dynamodb.NewImage.certid.S),
                    policy: thingpolicy
                };

                await CommissionTarget(region, accountId, roleCreds, thingobj);
            }
        }
    }
};
