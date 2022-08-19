/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const addDevice = /* GraphQL */ `
  mutation AddDevice(
    $certid: ID!
    $targetaccount: String!
    $targetregion: String!
  ) {
    addDevice(
      certid: $certid
      targetaccount: $targetaccount
      targetregion: $targetregion
    ) {
      certid
      targetaccount
      targetregion
      devstate
    }
  }
`;
