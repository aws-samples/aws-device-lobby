// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/** 
This node.js Lambda function code is triggered by the basic ingest topic $aws/rules/lobby where devices announce themselves.
It attempts to look up the commissioned iot endpoint and publishes it back to the thing-specific lobby topic (lobby/<thing-name>).
If no endpoint exists, it does nothing.  
**/

const AWS = require('aws-sdk');
const secondsSinceEpoch = Math.round(Date.now() / 1000).toString().trim();

// Helper function to trim strings
const trimString = (str) => str.toString().trim();

exports.handler = async function(event, context) {
    const region = trimString(process.env.AWS_REGION);
    const certificateId = trimString(event.certid);
    const certthingname = trimString(event.devicename);
    const iotep = trimString(event.iotep);

    const iotdata = new AWS.IotData({endpoint: iotep, apiVersion: '2015-05-28'});
    const devicelobbytopic = `lobby/${certthingname}`;

    // Create the DynamoDBClient service object
    const ddbClient = new AWS.DynamoDB.DocumentClient;
    const table = process.env.DEVICE_LEDGER_TABLE;

    //update table to indicate device in lobby
    const params = {
        TableName: table,
        Key:{ 'certid' : certificateId},
        UpdateExpression: 'set devstate = :s, ts = :ts',
        ExpressionAttributeValues: { ':s' : 'inlobby', ':ts' : secondsSinceEpoch}
    };

    try {
        await ddbClient.update(params).promise();

        // check if commissioned iotep is there
        const paramsGet = {
            TableName: table,
            Key:{ 'certid' : certificateId}
        };

        const data = await ddbClient.get(paramsGet).promise();

        if( (data.Item.iotep == 'null') || (data.Item.iotep == null)) {
            console.log("Device iotep not commissioned.  Notify someone that a device is loitering in the lobby.");
            // Send SNS if you like
        } else {
            //iotep exists.  publish back on device lobby topic.  we assume the commissioning service has already setup the device and cert in the target iotep
            const payload = {'iotep': data.Item.iotep, 'config': data.Item.config};
            const paramsPublish = {
                topic: devicelobbytopic,
                payload: JSON.stringify(payload),
                qos: 1
            };
            await iotdata.publish(paramsPublish).promise();

            //now update device state in table to commissioned
            await ddbClient.update({
                TableName: table,
                Key:{ 'certid' : certificateId},
                UpdateExpression: 'set devstate = :s, ts = :ts',
                ExpressionAttributeValues: { ':s' : 'commissioned', ':ts' : secondsSinceEpoch}
            }).promise();

            console.log (`Successfully commissioned: ${certthingname}`);
        }
    } catch (err) {
        console.error(err);
        throw err;
    }
};
