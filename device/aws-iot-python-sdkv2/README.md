# Device Lobby example device - Python SDK v2


## Quickstart
1. Install the AWS IoT SDK and example dependancies:
```
cd device/aws-iot-python-sdkv2/
python3 -m pip install -r requirements.txt
```
2. Generate and copy in the device credentials from ../../pki/devices created with the `pki/create-thing-creds.sh` script.
```
cd ../../pki/
./create-thing-creds.sh thing42
cp devices/thing42* ../device/aws-iot-python-sdkv2/
cd ../device/aws-iot-python-sdkv2/
```
3. Fetch the IoT endpoint for the Device Lobby account and set an env variable for use in future commands:
```
DL_ENDPOINT=$(aws iot describe-endpoint --endpoint-type iot:Data-ATS --query "endpointAddress" --output text)
```
3. Start the example lobby client using the certificate file that includes both the device and intermidate CA certificates:
```
python3 dl_pubsub.py --root-ca AmazonRootCA1.pem --cert thing42-int1ca.crt.pem --key thing42.key.pem --endpoint $DL_ENDPOINT
```

Assuming the intermediate signing CA is properly registered with IoT Core, the example client will connect after the second attempt and will begin announcing itself:
```
Cert file path: thing42-int1ca.crt.pem
Thing Certificate ID:  3db38dc1536c92ff6da0128792233d57acb57f5a9e0dd65c9e417f152e7a7c08
Thing name from the cert CN:  thing42
Device config not found.  Going to default lobby.
Connecting to <your-device-lobby-iot-endpoint> with client ID 'thing42'...
Connection to IoT Core failed...  retrying in 5s.
Connected!
Subscribing to topic lobby/thing42
Subscribed with QoS.AT_LEAST_ONCE
Publishing message to topic: $aws/rules/lobby
Publishing message to topic: $aws/rules/lobby
Publishing message to topic: $aws/rules/lobby
Publishing message to topic: $aws/rules/lobby
...
```

4. Switch over to the Device Lobby Admin Console and you will now see the device certificate fingerprint listed in the Device Lobby Admin Console.  It can be claimed or registered to a target account and region by copying the certificate id and clicking the Register button in the top right of the console.  Paste in the certificate id, select the default Device Lobby Account and target region then click register.

Alternative, the QRcode of the certificate id can be used to enter the certificate id field on the device registration page.  The example will output an image file of the qr in the same directory: `<thing-name>-qr.png`

Once the device is registered to a target account and region, the service will return the configured endpoint to the device as shown in the device output below:
```
...
Publishing message to topic: $aws/rules/lobby
Publishing message to topic: $aws/rules/lobby
Received message from topic 'lobby/thing42': b'{"iotep":"a1bx5zmbwqenkk-ats.iot.eu-west-1.amazonaws.com","config":"default config"}'
```

The device code will store the commissioned iot endpoint in a local file named `dev.cfg` and will simulate a reboot.  Upon boot, the device configuration is detected and the device connects to the commissioned endpoint in it's application mode:
```
JSON Payload dumped:{"iotep":"a1bx5zmbwqenkk-ats.iot.eu-west-1.amazonaws.com","config":"default config"}
Device config received and written to dev.cfg.  Restarting device in 5s...
Disconnecting...
Disconnected!
Cert file path: thing42-int1ca.crt.pem
Thing name from the cert CN:  thing42
Device config file found.
Connecting to a1bx5zmbwqenkk-ats.iot.eu-west-1.amazonaws.com with client ID 'thing42'...
Connected!
Subscribing to topic lobby/thing42
Subscribed with QoS.AT_LEAST_ONCE
Publishing message to topic: app/thing42
Publishing message to topic: app/thing42
Publishing message to topic: app/thing42
...
```

The device has been successfully routed to its target account and region to perform its job in the field.


## Forcing devices to return to the Device Lobby

From the device, it can be forced to return to the device lobby by simply removing/deleting the `dev.cfg` config file then restarting the client.  In practice, this process could be triggered by any number of methods of local interface on the device... ie. press and hold the reset button for 5 seconds.

From the cloud, the config can be removed by publishing the following message payload to the subscribed device lobby topic (`lobby/<thing-name>`) ***in the target account/region***:
```
{
  "config": "factory reset"
}
```

This will cause the device to remove its `dev.cfg` file remotely and then restart the client process to simulate a reboot.  Triggering the reset remotely enables fleet operators to migrate devices in the field to other accounts or regions without requiring physical access to the devices.




