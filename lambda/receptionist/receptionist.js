// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/** 
This node.js Lambda function code is triggered by the basic ingest topic $aws/rules/lobby where devices announce themselves/
It attempts to look up the commissioned iot endpoint and publishs it back to the thing-specific lobby topic (lobby/<thing-name>).
If no endpoint exists, it does nothing.  
**/

var AWS = require('aws-sdk');
const secondsSinceEpoch = Math.round(Date.now() / 1000).toString().trim();

exports.handler = function(event, context, callback) {
    // console.log("Incoming lobby message from rule: " + "\n" + JSON.stringify(event, null, 2));

    var region = process.env.AWS_REGION.toString().trim();
    var certificateId = event.certid.toString().trim();
    var certthingname = event.devicename.toString().trim();
    var iotep = event.iotep.toString().trim();
  
    var iotdata = new AWS.IotData({endpoint: iotep, apiVersion: '2015-05-28'});
    var devicelobbytopic = "lobby/" + certthingname;


    // Create the DynamoDBClient service object
    var ddbClient = new AWS.DynamoDB.DocumentClient;

    var table = process.env.DEVICE_LEDGER_TABLE;

    //update table to indicate device in lobby
    var params = {
        TableName: table,
        Key:{ 'certid' : certificateId},
        UpdateExpression: 'set devstate = :s, ts = :ts',
        ExpressionAttributeValues: { ':s' : 'inlobby', ':ts' : secondsSinceEpoch}
    };
    
    ddbClient.update(params, function(err, data) {
        if (err) {
            console.log("Unable to update device state: " + "\n" + JSON.stringify(err, undefined, 2));
        } else {
            
            // check if commissioned iotep is there
            var params = {
                TableName: table,
                Key:{ 'certid' : certificateId}
            };
            
            ddbClient.get(params, function(err, data) {
                if (err) {
                    console.log("Unable to get item", err);
                } else {
                    // console.log("Success", data.Item);
                    if( (data.Item.iotep == 'null') || (data.Item.iotep == null)) {
                        console.log("Device iotep not commissioned.  Notify someone that a device is loitering in the lobby.");
                        // Send SNS if you like
                    } else {
                        // console.log("iotep exists... send it to the device");
                        //iotep exists.  publish back on device lobby topic.  we assume the commissioning service has already setup the device and cert in the target iotep
                        var payload = {'iotep': data.Item.iotep, 'config': data.Item.config};
                        var params = {
                            topic: devicelobbytopic,
                            payload: JSON.stringify(payload),
                            qos: 1
                        };
                        iotdata.publish(params, function(err, data) {
                            if (err) console.log(err, err.stack); // an error occurred
                            else {
                                // console.log(data);           // successful response
                                //now update device state in table to commissioned
                                ddbClient.update({
                                    TableName: table,
                                    Key:{ 'certid' : certificateId},
                                    UpdateExpression: 'set devstate = :s, ts = :ts',
                                    ExpressionAttributeValues: { ':s' : 'commissioned', ':ts' : secondsSinceEpoch}
                                }, function(err, data) {
                                    if (err) console.log(err, err.stack); // an error occurred
                                    else console.log ("Successfully commissioned: " + certthingname);
                                });
                            }
                        });
                        
                    }
                }
            });
            
        }
    });    

};
