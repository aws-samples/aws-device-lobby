import React, { Component } from "react";
import { API } from "aws-amplify";
import {
  Button,
  FormControl,
  Grid,
  Row,
  Col,
  FormGroup,
  ControlLabel,
  ProgressBar,
  Alert,
  Table,
  Modal
} from 'react-bootstrap';
import { listDevices } from 'graphql/queries'

import { Card } from "components/Card/Card.jsx";

class Devices extends Component {
  constructor(props) {
    super(props);

    this.handleRegisterDevice = this.handleRegisterDevice.bind(this);
    this.handleDevice = this.handleDevice.bind(this);
    this.handleFilter = this.handleFilter.bind(this);
    this.handleOrderChange = this.handleOrderChange.bind(this);

    // Sets up initial state
    this.state = {
      devices: [],
      error: false,
      isLoading: false,
      show: false,
      deviceName: '',
      deviceId: '',
      isDeleting: false,
      title: '',
    };
  }

  componentDidMount() {
    this.setState({ title: 'AWS IoT Device Lobby', });
    this.getDevices();
  }

  // Registers a device
  handleRegisterDevice() {
    this.props.history.push('/devices/registration');
  }

  // Register a device already in the lobby
  handleDevice(deviceId) {
    this.props.history.push(`/devices/registration/${deviceId}`);
  }

  // Handles input changes
  handleFilter = () => {
    // Gets element value directly due to the stale state
    let connected = document.getElementById("status").value;
    let keyword = document.getElementById("keyword").value;
    let devices = this.state.devices;

    for (let i = 0; i < devices.length; i++) {
      let deviceName = devices[i].certid;
      let targetregion = devices[i].targetregion;
      let targetaccount = devices[i].targetaccount;
      let devicestate = devices[i].devstate;

      if (keyword === '' && connected === '') {
        //Empty keyword and All status
        devices[i].visible = false;
      } else if (keyword === '') {
        //Empty keyword and certain status
        if ((connected === 'commissioned') && (devicestate === 'commissioned')) {
           devices[i].visible = true;
        } else if ((connected === 'inlobby') && (devicestate === 'inlobby')) {
          devices[i].visible = true;
        } else if ((connected === 'claimed') && (devicestate === 'claimed')) {
          devices[i].visible = true;
        } else {
          devices[i].visible = false;
        }
      } else if (connected === '') {
        // Some keyword and All status and
        if (deviceName.indexOf(keyword) > -1
          || targetaccount.indexOf(keyword) > -1
          || targetregion.indexOf(keyword) > -1) {
          devices[i].visible = true;
        } else {
          devices[i].visible = false;
        }
      } else {
        //Some keyword and certain status
        if (deviceName.indexOf(keyword) > -1
        || targetaccount.indexOf(keyword) > -1
        || targetregion.indexOf(keyword) > -1) {
          if ((connected === 'commissioned') && (devicestate === 'commissioned')) {
             devices[i].visible = true;
          } else if ((connected === 'inlobby') && (devicestate === 'inlobby')) {
            devices[i].visible = true;
          } else if ((connected === 'claimed') && (devicestate === 'claimed')) {
            devices[i].visible = true;
          } else {
            devices[i].visible = false;
          }
        } else {
          devices[i].visible = false;
        }
      }
    }

    this.setState({ devices: devices });
  }

  handleOrderChange = (event) => {
    let order = event.target.value;
    this.sortDevices(order);
  };

  // Sorts devices
  sortDevices = (order) => {
    let devices = this.state.devices;
    if (order === 'asc') {
      devices.sort((a, b) => a.attributes.deviceName.localeCompare(b.attributes.deviceName));
    } else if (order === 'desc') {
      devices.sort((a, b) => b.attributes.deviceName.localeCompare(a.attributes.deviceName));
    }

    this.setState({ devices: devices });
  };

  // Gets devices
  getDevices = async () => {
    this.setState({ isLoading: true });
    // let token = await this.props.getToken();
    // let apiName = 'smart-product-api';
    // let path = 'devices';
    // let params = {
      // headers: {
        // 'Authorization': token,
      // },
      // response: true,
    // }
    // API.get(apiName, path, params)
    API.graphql({ query: listDevices, variables: {count: 10 } })
      .then(response => {
        let devices = response.data.listDevices.devices;
        console.log(devices);

        // Adds visible key/value for filter
        for (let i = 0; i < devices.length; i++) {
          devices[i]['visible'] = true;
          if ((devices[i].devstate === null ) || (devices[i].devstate === '')) {
          
            devices[i].visible = false;
          }

        }

        // Sorts initially
        // devices.sort((a, b) => a.attributes.deviceName.localeCompare(b.attributes.deviceName));
        this.setState({ 
          devices: devices,
          title: `My Devices (${devices.length})`,
        });
      })
      .catch(error => {
        let message = error.response;
        console.log(message);
        // if (message === undefined) {
        //   message = error.message;
        // } else {
        //   message = error.response.data.message;
        // }

        // this.setState({ error: message, });
      })
      .finally(() => {
        this.setState({ isLoading: false, });
      });
  };

  render() {
    const { isLoading, isDeleting, error, devices, deviceName, title } = this.state;
    return (
      <div className="content">
        <Grid fluid>
          <Row>
            <Col md={6}>
              <h2>AWS IoT Device Lobby</h2>
            </Col>
            <Col md={6}>
              <Button className="btn-fill pull-right" bsSize="small" bsStyle="warning" active onClick={this.handleRegisterDevice}>Register a Device</Button>
            </Col>
          </Row>
          <Row>
            <Col md={12}>
              <span>&nbsp;</span>
            </Col>
          </Row>
          <Row>
            <Col md={12}>
              <Card
                title={title}
                content={
                  <div>
                    <Col md={4}>
                      <FormGroup>
                        <ControlLabel>Search Keyword</ControlLabel>
                        <FormControl placeholder="Search by Cert ID or name"
                          type="text" defaultValue="" onChange={this.handleFilter} id="keyword" />
                      </FormGroup>
                    </Col>
                    <Col md={4}>
                      <FormGroup>
                        <ControlLabel>Filter by Device Status</ControlLabel>
                        <FormControl componentClass="select" defaultValue="" onChange={this.handleFilter} id="status">
                          <option value="">All</option>
                          <option value="commissioned">Commissioned</option>
                          <option value="inlobby">In Lobby</option>
                          <option value="claimed">Claimed</option>
                        </FormControl>
                      </FormGroup>
                    </Col>
                    <Col md={4}>
                      <FormGroup>
                        <ControlLabel>Sort By</ControlLabel>
                        <FormControl componentClass="select" defaultValue="asc" onChange={this.handleOrderChange}>
                          <option value="asc">A-Z</option>
                          <option value="desc">Z-A</option>
                        </FormControl>
                      </FormGroup>
                    </Col>
                    <div className="clearfix" />
                  </div>
                }
              />
            </Col>
          </Row>
          <Row>
            {
              devices.length === 0 && !isLoading &&
              <Col md={12}>
                <Card content={<div>No device found.</div>} />
              </Col>
            }
            {
              devices
                .filter(devices => devices.visible)
                .map(devices => {
                  return (
                    <Col md={6} key={devices.certid}>
                      <Card title={devices.certid}
                        content={
                          <div>
                            <Table bordered>
                              <tbody>
                                <tr>
                                  <td>Target Account</td>
                                  <td>{devices.targetaccount}</td>
                                </tr>
                                <tr>
                                </tr>
                                <tr>
                                  <td>Target Region</td>
                                  <td>{devices.targetregion}</td>
                                </tr>
                                <tr>
                                </tr>
                                <tr>
                                  <td>State</td>
                                  <td>{devices.devstate}</td>
                                </tr>
                              </tbody>
                            </Table>
                            <Button bsStyle="warning" bsSize="small"
                              className="btn-fill pull-right" active
                              onClick={() => this.handleDevice(devices.certid)}>Register</Button>
                            <div className="clearfix" />
                          </div>
                        }
                      />
                    </Col>
                  )
              })
            }
          </Row>
          { isLoading &&
            <Row>
              <Col md={12}>
                <div>
                  <ProgressBar active now={50} />
                </div>
              </Col>
            </Row>
          }
          { error &&
            <Row>
              <Col md={12}>
                <Alert bsStyle="danger">
                  <span>{this.state.error}</span>
                </Alert>
              </Col>
            </Row>
          }
        </Grid>
        <Modal show={this.state.show} onHide={this.handleDeleteClose}>
          <Modal.Header closeButton>
            <Modal.Title>Delete Device</Modal.Title>
          </Modal.Header>
          <Modal.Body>Are you sure to delete the device {deviceName}?</Modal.Body>
          <Modal.Footer>
            <Button onClick={this.handleDeleteClose}>Close</Button>
            <Button bsStyle="primary" className="btn-fill" active onClick={() => this.deleteDevice(this.state.deviceId)}>Delete</Button>
          </Modal.Footer>
          { isDeleting &&
            <div>
              <ProgressBar active now={50} />
            </div>
          }
        </Modal>
      </div>
    );
  }
}

export default Devices;
