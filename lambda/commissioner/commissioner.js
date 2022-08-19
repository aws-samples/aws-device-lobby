// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/** 
This node.js Lambda function code is used to evaluate the stream from the device ledger dynamodb table.
If a completed record is seen that includes the device identity and a target account/region, the function
will attempt to register the thing in the target account/region.
**/

// console.log('Loading function');
var AWS = require('aws-sdk');

function CommissionTarget (tregion, taccount, creds, tobj) {
    
    // console.log("Attempting to setup device in: " + tregion);
    // console.log("Using these creds: " + JSON.stringify(creds));
    
    // console.log("Thing object: " + JSON.stringify(tobj));
    
    var iot = new AWS.Iot({'region': tregion, credentials: creds, apiVersion: '2015-05-28'});
    
    var certpem = tobj.cert.toString().trim();
    var policyname = tobj.name.toString().trim() + tobj.certId.toString().trim();
    
    // console.log(certpem);
    // console.log(policyname);
    
    iot.registerCertificateWithoutCA({
        certificatePem: certpem
    }, (err, data) => {
        //Ignore if cert already exists
        if (err && (err.code !== 'ResourceAlreadyExistsException')) {
            console.log(err, err.stack); // an error occurred
            return;
        }
        else {
            // console.log(err);
            // console.log(data);           // successful response
            var certificateARN;
            if(err.code == 'ResourceAlreadyExistsException') {
                certificateARN = "arn:aws:iot:" + tregion + ":" + taccount + ":cert/" + tobj.certId.toString().trim();
            } else {
                certificateARN = data.certificateArn.toString().trim();
            }
            // console.log("HERE IS THE CERTARN: " + certificateARN);
            iot.createPolicy({
                policyDocument: JSON.stringify(tobj.policy),
                policyName: tobj.name.toString().trim() + tobj.certId.toString().trim(),
            }, (err, data) => {
                //Ignore if the policy already exists
                if (err && (!err.code || err.code !== 'ResourceAlreadyExistsException')) {
                    console.log(err);
                    return;
                } else {
                    // console.log(err);
                    // console.log(data);           // successful response
                    iot.attachPrincipalPolicy({
                        policyName: policyname,
                        principal: certificateARN
                    }, (err, data) => {
                        //Ignore if the policy is already attached
                        if (err && (!err.code || err.code !== 'ResourceAlreadyExistsException')) {
                            console.log(err);
                            return;
                        } else {
                            iot.createThing({
                                thingName: tobj.name.toString().trim()
                            }, (err,data) => {
                                //Ignore if thing already exists
                                if (err && (!err.code || err.code !== 'ResourceAlreadyExistsException')) {
                                    console.log(err);
                                    return;
                                } else {
                                    // console.log(err);
                                    // console.log(data);
                                    iot.attachThingPrincipal({
                                        principal: certificateARN,
                                        thingName: tobj.name.toString().trim()
                                    }, (err, data) => {
                                        //Ignore if the thing is already attached
                                        if (err && (!err.code || err.code !== 'ResourceAlreadyExistsException')) {
                                            console.log(err);
                                            return;
                                        } else {
                                            // console.log(err);
                                            // console.log("Cert attached to Thing!");
                                            iot.updateCertificate({
                                                certificateId: tobj.certId.toString().trim(),
                                                newStatus: 'ACTIVE'
                                            }, (err, data) => {
                                                 //Ignore if cert is already attached
                                                if (err && (!err.code || err.code !== 'ResourceAlreadyExistsException')) {
                                                    console.log(err);
                                                    return;
                                                } else {
                                                    // console.log(err);
                                                    // console.log(data);   
                                                    console.log("Success, created thing, created policy, attached policy and activated the certificate in target account/region");
                                                    //get the iotep to set in the table
                                                    
                                                    iot.describeEndpoint({
                                                        endpointType: 'iot:Data-ATS'
                                                    }, (err, data) => {
                                                        if (err) {
                                                            console.log(err, err.stack); // an error occurred
                                                            return;
                                                        } else {
                                                            // console.log(err);
                                                            // console.log(data);
                                                            var commissionedep = data.endpointAddress.toString().trim()
                                                            console.log("IoT EP of target region is: " + commissionedep);           // successful response
                                                            //now write the new iot-ep back to ddb indicating it is ready.
                                                            var ddbClient = new AWS.DynamoDB.DocumentClient;
                                                            var table = "devicelobby-ledger";
                                                            ddbClient.update({
                                                                TableName: table,
                                                                Key:{
                                                                  'certid' : tobj.certId.toString().trim()
                                                                },
                                                                UpdateExpression: 'set iotep = :ep',
                                                                ExpressionAttributeValues: {
                                                                ':ep' : commissionedep
                                                                }
                                                            }, (err, data) => {
                                                                if (err) {
                                                                    console.log(err);
                                                                } else {
                                                                    console.log(data);
                                                                    console.log(tobj.name.toString().trim() + " registered in target account and ledge table updated with target iotep: " + commissionedep);
                                                                }
                                                            });
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
            
    });
 
    return;   
}

exports.handler = function(event, context, callback) {
    // console.log(JSON.stringify(event, null, 2));
    var sts = new AWS.STS({apiVersion: '2011-06-15'});

    event.Records.forEach(function(record) {
        // console.log(record.eventID);
        // console.log(record.eventName);
        //only check record modifications
        if(record.eventName == 'MODIFY') {
            console.log('DynamoDB Record: %j', record.dynamodb);
            
            //there are two requirements for being able to commision a new account:
            //  1) a new target account/region to indicate where to commission
            //  2) the device cert... which is only available after the device connnects to the lobby
            
           // iotep string will be fetched later
           
           if ((record.dynamodb.NewImage.hasOwnProperty("targetaccount")) && (record.dynamodb.NewImage.hasOwnProperty("targetregion")) && record.dynamodb.NewImage.hasOwnProperty("devicecert")) {
               
                var region = record.dynamodb.NewImage.targetregion.S.toString().trim();
                var accountId = record.dynamodb.NewImage.targetaccount.S.toString().trim();
                var role = "arn:aws:iam::" + accountId + ":role/lobby_commissioner_role";
                
                var roleCreds;

                var thingpolicy = {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Action": [
                                "iot:Connect"
                            ],
                            "Resource": "arn:aws:iot:" + region + ":" + accountId + ":client/*"
                        },
                        {
                            "Effect": "Allow",
                            "Action": [
                                "iot:Publish"
                            ],
                            "Resource": "arn:aws:iot:" + region + ":" + accountId + ":topic/$aws/rules/lobby/"
                        },
                                                {
                            "Effect": "Allow",
                            "Action": [
                                "iot:Publish"
                            ],
                            "Resource": "arn:aws:iot:" + region + ":" + accountId + ":topic/app/*"
                        },
                        {
                            "Effect": "Allow",
                            "Action": [
                                "iot:Receive"
                            ],
                            "Resource": "arn:aws:iot:" + region + ":" + accountId + ":topic/lobby*"
                        },
                        {
                            "Effect": "Allow",
                            "Action": [
                                "iot:Subscribe",
                            ],
                            "Resource": "arn:aws:iot:" + region + ":" + accountId + ":topicfilter/lobby*"
                        }
                    ]
                };
                
                var thingobj = {
                    name: record.dynamodb.NewImage.devicename.S.toString().trim(),
                    cert: record.dynamodb.NewImage.devicecert.S.toString().trim(),
                    certId: record.dynamodb.NewImage.certid.S.toString().trim(),
                    policy: thingpolicy
                }
                
                // if(record.dynamodb.NewImage.iotep.S != record.dynamodb.NewImage.iotep.S) {
                    // console.log("New iotep written... check if cert is present");
                    // now check to make sure the cert is present before we commission
                    if(record.dynamodb.NewImage.devicecert.S.startsWith("-----BEGIN CERTIFICATE-----")) {
                        console.log("EP1: device cert exists...  commissioning target account.");
                        console.log("commissioning with this role:    " + role);
                        var params = {
                            ExternalId: "123ABC", 
                            RoleArn: role, 
                            RoleSessionName: "CommissionAssumeRoleSession"
                         };
                         
                        sts.assumeRole(params, function(err, data) {
                            if (err) console.log(err, err.stack);
                            else{
                                roleCreds = {accessKeyId: data.Credentials.AccessKeyId,
                                             secretAccessKey: data.Credentials.SecretAccessKey,
                                             sessionToken: data.Credentials.SessionToken};
                                CommissionTarget(region, accountId, roleCreds, thingobj);
                            }
                        });
                        return;
                        
                    } else {
                        //console.log("cert is not present... do nothing until device actually connects so the cert can be captured");
                        return;
                    }
                // }
           } else { 
            //console.log("target account, region and/or cert not found in record"); 
            return; 
            }

        }
    });
    callback(null, "message");
};
