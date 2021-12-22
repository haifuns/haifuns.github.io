// Depends on tencentcloud-sdk-nodejs version 4.0.3 or higher
const tencentcloud = require("tencentcloud-sdk-nodejs");

const CdnClient = tencentcloud.cdn.v20180606.Client;

const clientConfig = {
  credential: {
    secretId: process.env.CDN_ID,
    secretKey: process.env.CDN_KEY
  },
  region: "",
  profile: {
    httpProfile: {
      endpoint: "cdn.tencentcloudapi.com",
    },
  },
};

const client = new CdnClient(clientConfig);
const params = {
    "Paths": [
        "https://haifuns.com"
    ],
    "FlushType": "flush"
};
client.PurgePathCache(params).then(
  (data) => {
    console.log(data);
  },
  (err) => {
    console.error("error", err);
  }
);
