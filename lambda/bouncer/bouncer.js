// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/** 
This node.js Lambda function code is used to authenticate IoT devices entering the lobby using JITR.
It creates and attaches an IoT policy to the registered certificate and activates it. The Lambda
function is attached as a rule engine action to the registration topic 
Saws/events/certificates/registered/<caCertificateID>
**/

var AWS = require('aws-sdk');
const secondsSinceEpoch = Math.round(Date.now() / 1000).toString().trim();
const { X509Certificate } = require('node:crypto');

exports.handler = function(event, context, callback) {
    
//    console.log(event);

    var region = process.env.AWS_REGION.toString().trim();
    var accountId = event.awsAccountId.toString().trim();

    var iot = new AWS.Iot({'region': region, apiVersion: '2015-05-28'});
    var certificateId = event.certificateId.toString().trim();

    // DynamoDB service object
    var ddbClient = new AWS.DynamoDB.DocumentClient;

    var topicName = `lobby`;
    var certificateARN = `arn:aws:iot:${region}:${accountId}:cert/${certificateId}`;

    // table and policy names passed in via CF vars
    var policyName = process.env.IOT_POLICY;
    var table = process.env.DEVICE_LEDGER_TABLE;

    var certthingname = "notset";

    /*
    Create a policy
    */
        //Policy created by cloudformation

    /*
    Attach the policy to the certificate to enable
    */
    iot.attachPrincipalPolicy({
        policyName: policyName,
        principal: certificateARN
    }, (err, data) => {
        //Ignore if the policy is already attached
        if (err && (!err.code || err.code !== 'ResourceAlreadyExistsException')) {
            console.log(err);
            callback(err, data);
            return;
        }
        // console.log(data);
        
        /*
        get thing name from cert CN and register it
        */
        iot.describeCertificate({
            certificateId: certificateId
        }, (err,data) => {
            if (err) console.log(err, err.stack); // an error occurred
            else     {
                // console.log(data);           // successful response
    
                var pem = data.certificateDescription.certificatePem;
                // console.log("Here is the PEM!");
                // console.log(pem);
                const x509 = new X509Certificate(pem);
                
                const subject = x509.subject;
                // console.log(subject);
                    
                certthingname = subject.substr((subject.search("CN="))+3, (subject.length)).trim();
                // console.log('thing name from cert:',certthingname);
                // console.log('Now register the name!');
                
                //register thing name
                iot.createThing({
                    thingName: certthingname,
                    attributePayload: {
                        attributes: {
                            'type': '42',
                            /* '<AttributeName>': ... */
                        },
                        merge: true
                        } 
                }, (err,data) => {
                    if (err) console.log(err, err.stack); // an error occurred
                    else     {
                        // console.log("Thingname created successfully! ARN: ", data.thingArn);
                        //attach thing to cert
                        
                        iot.attachThingPrincipal({
                            principal: certificateARN,
                            thingName: certthingname
                        }, (err, data) => {
                            if (err) console.log(err, err.stack); // an error occurred
                            else     {
                                // console.log("Cert attached to Thing!");
                                
                                /*
                                Activate the certificate. Optionally, you can have your custom Certificate Revocation List (CRL) check
                                logic here and ACTIVATE the certificate only if it is not in the CRL. Revoke the certificate if it is in the CRL
                                */
                                iot.updateCertificate({
                                    certificateId: certificateId,
                                    newStatus: 'ACTIVE'
                                }, (err, data) => {
                                    if (err) {
                                        console.log(err, err.stack); 
                                        callback(err, data);
                                    }
                                    else {
                                        // console.log(data);   
                                        
                                        var params = {
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
                                        
                                        ddbClient.update(params, function(err, data) {
                                            if (err) {
                                                console.log("Unable to update item: " + "\n" + JSON.stringify(err, undefined, 2));
                                            } else {
                                                console.log("Update to device lobby ledger entry succeeded: " + "\n" + JSON.stringify(data, undefined, 2));
                                            }
                                        });
                                        
                                        callback(null, "Success, created thing, created policy, attached policy and activated the certificate " + certificateId);
                                    }
                                });
                            }
                        });
                    } 
                });
            }
        });
    });
};
