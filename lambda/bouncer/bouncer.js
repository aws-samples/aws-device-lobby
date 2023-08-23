// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/** 
This node.js Lambda function code is used to authenticate IoT devices entering the lobby using JITR.
It creates and attaches an IoT policy to the registered certificate and activates it. The Lambda
function is attached as a rule engine action to the registration topic 
Saws/events/certificates/registered/<caCertificateID>
**/

const AWS = require('aws-sdk');
const secondsSinceEpoch = Math.round(Date.now() / 1000).toString().trim();
const { X509Certificate } = require('node:crypto');

exports.handler = async function(event, context) {
    const region = process.env.AWS_REGION.toString().trim();
    const accountId = event.awsAccountId.toString().trim();

    const iot = new AWS.Iot({'region': region, apiVersion: '2015-05-28'});
    const certificateId = event.certificateId.toString().trim();

    // DynamoDB service object
    const ddbClient = new AWS.DynamoDB.DocumentClient;

    const certificateARN = `arn:aws:iot:${region}:${accountId}:cert/${certificateId}`;

    // table and policy names passed in via CF vars
    const policyName = process.env.IOT_POLICY;
    const table = process.env.DEVICE_LEDGER_TABLE;

    let certthingname = "notset";

    try {
        await iot.attachPrincipalPolicy({
            policyName: policyName,
            principal: certificateARN
        }).promise();

        const certData = await iot.describeCertificate({
            certificateId: certificateId
        }).promise();

        const pem = certData.certificateDescription.certificatePem;
        const x509 = new X509Certificate(pem);
        const subject = x509.subject;
        certthingname = subject.substr((subject.search("CN="))+3, (subject.length)).trim();

        await iot.createThing({
            thingName: certthingname,
            attributePayload: {
                attributes: {
                    'type': '42',
                },
                merge: true
            } 
        }).promise();

        await iot.attachThingPrincipal({
            principal: certificateARN,
            thingName: certthingname
        }).promise();

        await iot.updateCertificate({
            certificateId: certificateId,
            newStatus: 'ACTIVE'
        }).promise();

        const params = {
            TableName: table,
            Key:{
                'certid' : certificateId
            },
            UpdateExpression: 'set devicecert = :cert, devicename = :dn, config = :c, ts = :ts, devstate = :s, doormancount = :cnt',
            ExpressionAttributeValues: {
            ':cert' : pem,
            ':dn' : certthingname,
            ':ts' : secondsSinceEpoch,
            ':s' : 'knocking',
            ':c' : 'default config',
            ':cnt' : 0
            }
        };

        await ddbClient.update(params).promise();

        return "Success, created thing, created policy, attached policy and activated the certificate " + certificateId;
    } catch (err) {
        if (err.code === 'ResourceAlreadyExistsException') {
            // Ignore if the policy is already attached
            return;
        }
        console.log(err);
        throw err;
    }
};
