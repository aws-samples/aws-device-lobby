import React, { Component } from "react";
import QrReader from 'react-qr-reader'
import { API, graphqlOperation } from "aws-amplify";
import {
  Grid,
  Row,
  Col,
  Button,
  ProgressBar,
  Alert,
  FormGroup,
  ControlLabel,
  FormControl,
  HelpBlock
} from "react-bootstrap";

import targetaccounts from "target-accounts.js";
import targetregions from "target-regions.js";

import { Card } from "components/Card/Card.jsx";

import { addDevice } from 'graphql/mutations';

class DeviceRegistration extends Component {
  constructor(props) {
    super(props);

    this.goBack = this.goBack.bind(this);
    this.register = this.register.bind(this);
    this.finish = this.finish.bind(this);

    this.handlecertidChange = this.handlecertidChange.bind(this);
    this.handletargetaccountChange = this.handletargetaccountChange.bind(this);
    this.handletargetregionChange = this.handletargetregionChange.bind(this);
    
    this.handleScan = this.handleScan.bind(this);

    this.state = {
      step: 0,
      certid: '',
      targetaccount: '',
      targetregion: '',
      isLoading: false,
      error: false,
      certidValidateState: null,
      showcertidHelpBlock: false,
      targetaccountValidateState: null,
      showtargetaccountHelpBlock: false,
      targetregionValidateState: null,
      showtargetregionHelpBlock: false,
      isRegistering: false,
      delay: 500,
      result: '',
    };
  }

  componentDidMount() {
    // Checks if the previous page sends a state.
    // It would only happens when the device is pending to be registered, and a user wants to see the registration instruction again.
    const state = this.props.location.state;
    if (state) {
      let deviceId = state.deviceId;
      this.setState({
        step: 1,
        certid: deviceId
      });
    }
  }

  goBack() {
    this.props.history.push('/devices');
  }
  
  //handle qrcode scan
  handleScan(result){
    if(result){
      this.setState({ result });
      this.setState({ certid: result });
    }
  }
  
  //handle qrcode error
  handleError(err){
    console.error(err);
  }
  
  // Handles input changes
  handlecertidChange = (event) => {
    this.setState({ certid: event.target.value }, () => {
      this.certidValidate();
    });
  }
  handletargetaccountChange = (event) => {
    this.setState({ targetaccount: event.target.value }, () => {
      this.validateInput('targetaccount');
    });
  }
  handletargetregionChange = (event) => {
    this.setState({ targetregion: event.target.value }, () => {
      this.validateInput('targetregion');
    });
  }

  // Validates serial number
  certidValidate = () => {
    // let certid = this.state.certid;
    let pass = true;

    // let regexp = /^[a-zA-Z0-9-_:]+$/;
    // let pass = regexp.test(certid);
    // if (pass) {
    //   this.setState({
    //     showcertidHelpBlock: false,
    //     certidValidateState: null,
    //   });
    // } else {
    //   this.setState({
    //     showcertidHelpBlock: true,
    //     certidValidateState: 'error',
    //   });
    // }

    return pass;
  }

  // Validates inputs
  validateInput = (type) => {
    // let regexp = /^[a-zA-Z0-9-_.,:/@#]+$/;
    let pass = false;
    // let input = '';

    // switch (type) {
    //   case 'certid': {
    //     input = this.state.certid;
    //     pass = regexp.test(input);

    //     if (pass) {
    //       this.setState({
    //         showtargetaccountHelpBlock: false,
    //         targetaccountValidateState: null,
    //       });
    //     } else {
    //       this.setState({
    //         showtargetaccountHelpBlock: true,
    //         targetaccountValidateState: 'error',
    //       });
    //     }
    //     break;
    //   }
    //   case 'targetaccount': {
    //     input = this.state.targetregion;
    //     pass = regexp.test(input);

    //     if (pass) {
    //       this.setState({
    //         showtargetregionHelpBlock: false,
    //         targetregionValidateState: null,
    //       });
    //     } else {
    //       this.setState({
    //         showtargetregionHelpBlock: true,
    //         targetregionValidateState: 'error',
    //       });
    //     }
    //     break;
    //   }
    //   default : {
    //     // do nothing
    //     break;
    //   }
    // }

    return pass;
  }

  // Registers device
  register = async () => {
    this.setState({ error: false, });
    if (!this.state.isRegistering) {
      this.setState({ isRegistering: true });

      this.setState({ isLoading: true });

      await API.graphql(graphqlOperation(addDevice, {certid: this.state.certid, targetaccount: this.state.targetaccount, targetregion: this.state.targetregion }))
        .then(response => {
          this.setState({
            step: 1
          });
        })
        .catch(error => {
          let message = error.response;
          // console.log(error);
          // if (message === undefined) {
          //   message = error.message;
          // } else {
            message = "Error registering device.API";
          // }

          this.setState({ error: message, });
        })
        .finally(() => {
          this.setState({
            isLoading: false,
            isRegistering: false,
          });
        });
    } else {
      this.props.handleNotification('Device is still registering', 'warning', 'pe-7s-close-circle', 5);
    }
  }

  finish = () => {
    // let deviceId = this.state.certid;
    this.props.history.push(`/devices/`);
  }

  render() {
    const { isLoading, error,
      certidValidateState, showcertidHelpBlock,
    } = this.state;

    const previewStyle = {
      height: 320,
      width: 320,
      position: 'center'
    };
    
    let targetaccountList = targetaccounts.length > 0 && targetaccounts.map((item, i) => {
      return (<option value={item.awsaccountid}>{item.name} - {item.awsaccountid}</option>)
    }, this);

    let targetregionList = targetregions.length > 0 && targetregions.map((item, i) => {
      return (<option value={item.region}>{item.name} - {item.region}</option>)
    }, this);

    if (this.state.step === 1) {
      return (
        <div className="content">
          <Grid fluid>
            <Row>
              <Col md={10} mdOffset={1}>
                <Card
                  title="Device Registered"
                  content={
                      <div>
                      <Button className="btn-fill pull-right" active bsSize="small" onClick={this.finish}>Finish</Button>
                      </div>
                  }
                />
              </Col>
            </Row>
          </Grid>
        </div>
      );
    } else {
      return (
        <div className="content">
          <Grid fluid>
            <Row>
              <Col md={8} mdOffset={2}>
                <Card
                  title="Lobby Registration"
                  content={
                    <div>
                      <Col md={12}>
                        <QrReader
                          delay={this.state.delay}
                          style={previewStyle}
                          onError={this.handleError}
                          onScan={this.handleScan}
                        />
                        <p>{this.state.result}</p>
                      </Col>
                      
                      <Col md={12}>
                        <FormGroup controlId="formcertid" validationState={certidValidateState}>
                          <ControlLabel>Certificate Fingerprint</ControlLabel>
                          <FormControl type="text" placeholder="Scan a QR code or enter cert fingerprint here..." defaultValue="" onChange={this.handlecertidChange} />
                          { showcertidHelpBlock &&
                            <HelpBlock>Must contain only alphanumeric characters:</HelpBlock>
                          }
                        </FormGroup>
                      </Col>
                      <Col md={6}>
                      <FormGroup controlId="formtargetaccount" >
                          <ControlLabel>Target Account</ControlLabel>
                          <FormControl componentClass="select" placeholder="select" defaultValue="" onChange={this.handletargetaccountChange} >
                            <option value="select">select</option>
                            {targetaccountList}
                          </FormControl>
                        </FormGroup>
                      </Col>
                      <Col md={6}>
                      <FormGroup controlId="formtargetregion" >
                          <ControlLabel>Target Region</ControlLabel>
                          <FormControl componentClass="select" placeholder="select" defaultValue="" onChange={this.handletargetregionChange} >
                            <option value="select">select</option>
                            {targetregionList}
                          </FormControl>
                        </FormGroup>
                      </Col>
                      <Col md={12}>
                        <Button className="btn-fill pull-right" bsSize="small" bsStyle="warning" active onClick={this.register}>Register</Button>
                        <Button className="btn-fill" bsSize="small" onClick={this.goBack}>Cancel</Button>
                      </Col>
                      <div className="clearfix" />
                    </div>
                  }
                />
              </Col>
            </Row>
            { isLoading &&
              <Row>
                <Col md={8} mdOffset={2}>
                  <div>
                    <ProgressBar active now={50} />
                  </div>
                </Col>
              </Row>
            }
            { error &&
              <Row>
                <Col md={8} mdOffset={2}>
                  <Alert bsStyle="danger">
                    <span>{this.state.error}</span>
                  </Alert>
                </Col>
              </Row>
            }
          </Grid>
        </div>
      );
    }
  }
}

export default DeviceRegistration;
