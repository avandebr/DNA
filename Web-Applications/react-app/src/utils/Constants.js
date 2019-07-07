/*Set of constants for the app*/
const Constants = {
  EMAIL: 'email',
  HASH: 'hash',
  NAME: 'name',
  POST: 'post',
  FILE: 'file',
  SIGNATURE: 'signature',
  MAX_FILE_SIZE: 20000000, //Max file size of 20 MB, to avoid crashing the app
  CONTRACT_ADDRESS: {
    patents: '0xe690C3cDC155503Cb096EBC06099118f599952C6',
    requests: '0xc2862de5B2EA31849e2B18ea4Da39615d292d5fE',
    users: '0x014Df5b617A03e0a19DCB5a235ce9C0dFc73A818',
  }
};

const FileStates = {
  NOT_ENCRYPTED: 0,
  ENCRYPTING: 1,
  ENCRYPTED: 2
};

const RequestStatus = {
  NOT_REQUESTED: 0,
  PENDING: 1,
  ACCEPTED: 2,
  REJECTED: 3,
  CANCELLED: 4,
};

/*Returns the string associated to the given status (Between 0 and 3)*/
const getStatusString = (status) => {
  switch (status) {
    case RequestStatus.NOT_REQUESTED:
      return "Not requested";
    case RequestStatus.PENDING:
      return "Pending";
    case RequestStatus.ACCEPTED:
      return "Accepted";
    case RequestStatus.REJECTED:
      return "Rejected";
    case RequestStatus.CANCELLED:
      return "Cancelled";
    default :
      return "";
  }
};

module.exports = {Constants, FileStates, RequestStatus, getStatusString};