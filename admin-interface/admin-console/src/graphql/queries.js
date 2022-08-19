/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getDevice = /* GraphQL */ `
  query GetDevice($certid: ID) {
    getDevice(certid: $certid) {
      certid
      targetaccount
      targetregion
      devstate
    }
  }
`;
export const listDevices = /* GraphQL */ `
  query ListDevices($count: Int, $nextToken: String) {
    listDevices(count: $count, nextToken: $nextToken) {
      devices {
        certid
        targetaccount
        targetregion
        devstate
      }
      nextToken
    }
  }
`;
export const listLobbyDevices = /* GraphQL */ `
  query ListLobbyDevices($count: Int, $nextToken: String, $devstate: String) {
    listLobbyDevices(
      count: $count
      nextToken: $nextToken
      devstate: $devstate
    ) {
      devices {
        certid
        targetaccount
        targetregion
        devstate
      }
      nextToken
    }
  }
`;
