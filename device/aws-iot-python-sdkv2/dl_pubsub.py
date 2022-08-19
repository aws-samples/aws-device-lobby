# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0.

import argparse
from awscrt import io, mqtt, auth, http
from awsiot import mqtt_connection_builder
import sys
import threading
import time
from uuid import uuid4
import json
import os
import pyqrcode
import png

from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes

parser = argparse.ArgumentParser(description="Example Device Lobby device implementation")
parser.add_argument('--endpoint', required=True, help="The Device Lobby endpoint not including a port. " +
                                                       "Ex: \"abcd123456wxyz-ats.iot.us-east-1.amazonaws.com\"")
parser.add_argument('--port', type=int, help="Specify port. AWS IoT supports 443 and 8883.")
parser.add_argument('--cert', help="File path to your client certificate, in PEM format.")
parser.add_argument('--key', help="File path to your private key, in PEM format.")
parser.add_argument('--root-ca', help="File path to root certificate authority, in PEM format. " +
                                      "Necessary if MQTT server uses a certificate that's not already in " +
                                      "your trust store.")
parser.add_argument('--count', default=10, type=int, help="Number of messages to publish/receive before exiting. " +
                                                          "Specify 0 to run forever.")
parser.add_argument('--proxy-host', help="Hostname of proxy to connect to.")
parser.add_argument('--proxy-port', type=int, default=8080, help="Port of proxy to connect to.")
parser.add_argument('--verbosity', choices=[x.name for x in io.LogLevel], default=io.LogLevel.NoLogs.name,
    help='Logging level')

# Using globals to simplify sample code
args = parser.parse_args()

io.init_logging(getattr(io.LogLevel, args.verbosity), 'stderr')

cfg_received = False
app_mode = False
gpayload = {}

received_all_event = threading.Event()

# Callback when connection is accidentally lost.
def on_connection_interrupted(connection, error, **kwargs):
    print("Connection interrupted. error: {}".format(error))


# Callback when an interrupted connection is re-established.
def on_connection_resumed(connection, return_code, session_present, **kwargs):
    print("Connection resumed. return_code: {} session_present: {}".format(return_code, session_present))

    if return_code == mqtt.ConnectReturnCode.ACCEPTED and not session_present:
        print("Session did not persist. Resubscribing to existing topics...")
        resubscribe_future, _ = connection.resubscribe_existing_topics()

        # Cannot synchronously wait for resubscribe result because we're on the connection's event-loop thread,
        # evaluate result with a callback instead.
        resubscribe_future.add_done_callback(on_resubscribe_complete)


def on_resubscribe_complete(resubscribe_future):
        resubscribe_results = resubscribe_future.result()
        print("Resubscribe results: {}".format(resubscribe_results))

        for topic, qos in resubscribe_results['topics']:
            if qos is None:
                sys.exit("Server rejected resubscribe to topic: {}".format(topic))

def write_reset(cfg):
    message = json.loads(cfg)
    if message['config'] == 'factory reset':
        os.remove('dev.cfg')
        print("FACTORY RESET INITIATED!")
        print("wiping device config and restarting in 5s...")
    else:
        with open('dev.cfg', 'w') as f:
            f.write(cfg)
        print("JSON Payload dumped:" + cfg)
        print("Device config received and written to dev.cfg.  Restarting device in 5s...")
    # Disconnect
    print("Disconnecting...")
    disconnect_future = mqtt_connection.disconnect()
    disconnect_future.result()
    print("Disconnected!")
    time.sleep(5)
    # simulate reboot of device
    os.execv(sys.executable, ['python3'] + sys.argv)

print("Cert file path:", args.cert)

#extract thing name from CN of cert
with open("./"+args.cert) as f:
    certraw = f.read()

cert = x509.load_pem_x509_certificate(str.encode(certraw))
thingname = cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value
certid = cert.fingerprint(hashes.SHA256()).hex()

print("Thing Certificate ID: ", certid)

print("Thing name from the cert CN: ",thingname)
sub_topic = "lobby/" + thingname
app_topic = "app/" + thingname


default_iot_ep = args.endpoint

if os.path.exists('dev.cfg'):
    print("Device config file found.")
    with open('dev.cfg') as f:
        temp = f.read()
    ep_cfg = json.loads(temp)
    target_ep = ep_cfg['iotep']
    app_mode = True
    # f.close
else:
    print("Device config not found.  Going to default lobby.")
    target_ep = default_iot_ep

# Callback when the subscribed topic receives a message
def on_message_received(topic, payload, dup, qos, retain, **kwargs):
    print("Received message from topic '{}': {}".format(topic, payload))
    global gpayload 
    gpayload = str(payload, "utf-8")
    global cfg_received 
    cfg_received = True
    
lobby_message ={
  'state': "factory default",
  'iotep': default_iot_ep,
  'config': "default"
}

app_message ={
    'Device' : thingname,
    'Sensor 1': 42,
    'Status': "Doing my IoT job!"
}

# Spin up resources
event_loop_group = io.EventLoopGroup(1)
host_resolver = io.DefaultHostResolver(event_loop_group)
client_bootstrap = io.ClientBootstrap(event_loop_group, host_resolver)

proxy_options = None
if (args.proxy_host):
    proxy_options = http.HttpProxyOptions(host_name=args.proxy_host, port=args.proxy_port)

mqtt_connection = mqtt_connection_builder.mtls_from_path(
    endpoint=target_ep,
    port=args.port,
    cert_filepath=args.cert,
    pri_key_filepath=args.key,
    client_bootstrap=client_bootstrap,
    ca_filepath=args.root_ca,
    on_connection_interrupted=on_connection_interrupted,
    on_connection_resumed=on_connection_resumed,
    client_id=thingname,
    clean_session=True,
    keep_alive_secs=30,
    http_proxy_options=proxy_options)

if app_mode == False:
    qr = pyqrcode.create(certid)
    # type(qr)
    qrfile = thingname + "-qr.png"
    qr.png(qrfile, scale = 6)
    print("QRCode for " + thingname + " saved as: " + qrfile)

print("Connecting to {} with client ID '{}'...".format(
    target_ep, thingname))

#Connect to the gateway
while True:
  try:
    connect_future = mqtt_connection.connect()
# Future.result() waits until a result is available
    connect_future.result()
  except:
    print("Connection to IoT Core failed...  retrying in 5s.")
    time.sleep(5)
    continue
  else:
    print("Connected!")
    break

# Subscribe
print("Subscribing to topic " + sub_topic)
subscribe_future, packet_id = mqtt_connection.subscribe(
    topic=sub_topic,
    qos=mqtt.QoS.AT_LEAST_ONCE,
    callback=on_message_received)

subscribe_result = subscribe_future.result()
print("Subscribed with {}".format(str(subscribe_result['qos'])))

while True:

    if app_mode == False :
        print("Publishing message to topic: $aws/rules/lobby")
        #print(message)
        message_json = json.dumps(lobby_message)
        mqtt_connection.publish(
            topic="$aws/rules/lobby",
            payload=message_json,
            qos=mqtt.QoS.AT_LEAST_ONCE)
        time.sleep(5)
        if cfg_received==True:
            write_reset(gpayload)
    else:
        print("Publishing message to topic: " + app_topic)
        #print(message)
        message_json = json.dumps(app_message)
        mqtt_connection.publish(
            topic=app_topic,
            payload=message_json,
            qos=mqtt.QoS.AT_LEAST_ONCE)
        time.sleep(5)
        if cfg_received==True:
            write_reset(gpayload)

