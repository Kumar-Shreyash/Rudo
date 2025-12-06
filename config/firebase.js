const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin SDK
// In production, use service account key file or environment variables
try {
  let privatekey =
    "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDWYksBB/7vRksx\nBH3NeWEX6m1j55FWOhN0JYZTOvAI/fW4zQT2WYXJLnc+ELzNDjnUg7m9Wbj6yrv6\nK20mFgGUzfsT3PPRTCYH3zfu0gBGX6503MLsQykfA2pyknHPSWzgMA7/OHx+7XOn\nLVOo2/DUzZBuBztpv3nsNVC/zZ/doGZzXXTKnNdC97BVmf/jgXecwNqH0vmiWeU3\nKgcNifJaf3Z9SxkcMiVt8kYPbPK8Cf/+cg+zRm/x/nV9ycvG2BJ1D8tIWBEkjX3i\nW7XSczzLje0gZGuvyXl9DF1L60EqC2xLkEIxUpnqlfjfzTZuK6b6KTe68mwrcwE4\n+8KMoeVxAgMBAAECggEAEsUJk9IpRPX6spSV9pnSUUOYNvtg50OfrSc1aN9TwXfJ\nrhe+H9rz6oqnzD5vJ0Vf9Q4g4pYCyutZ1KP9cwyRcB+uJD2vt6MC/+SwWxeWCFNL\nfQYQh1q0dJeKF/SgJAHF12WBxKDjjoHX4rrGVLYH8nu6cdWugxpNcIu08YwNW3wM\n/6adkhna0n/yiO2LFXAw91jg452994XQCKOth0r9ukeZKvDMQKgWT6CqQUuS8em3\nHcfBAY41ndkVGyTgB5JnrCBpr+jo50x1tRFD42m9HJgAljP27YEodGNiWCx3vpxV\nCmUTY80vw8Ks/iPXt1fQkY4XjlwUkfhn5/eNHNlZWQKBgQDv4T/It09BEIQuYM9w\nARFwmAjajm/xHSQ72J/TrBRuPKIQeWfF/mxF8NnBndfAhbbOdMYJ6rqp4w5Cdsi/\n1k5r+fHaW3hgSaSljcHRhrkbGmq+CSM/ixyYL5bKsuAYEOzhU+RIA2s+ZDqk0l8C\nhQHb9uLLJGITMZgxxMssYo8v6QKBgQDkym1YnKJGywDCgQ9WOZfvWRgdOFbpKnn4\nssgkbK9Dx5ugP41RrfHpBuBF8E4P7l0Yz0XZyh7H2258iHDldfhFGZPQMkOIW2Ge\nqzwx6IHJSw0llvQ0TcM9cX5lbWPLI6gH6NZgokUAz+RQw8Kn4Z8uYjRu91F+GYQs\nBUhHk/ncSQKBgQDUAs5AFRvcEr/wyamtgZQrYoQ4vrlbbnku17fy+l0YTUijrNm2\nGbcSXdvoDxy4ULYQZQ7/htGyAzcAMUIeo0eukTtb1Ypf99aoZ9DM4fjKZp+/FA5u\nRAJi03S/9DaxroveXyodJ8BqZWWbdT9515qcEenCx4ZTFntASYGU2gtZuQKBgQCH\ntM5hJh9XMGhV9ql7MpQ9YzJbeqSKjyhj7N+sQ08+O/LCfY+8aBm6Z9q1gVE8P922\nrpM3GJ1jXHPPqDqW0H+ftQkpD/dgtRtVOypsTAZXuI2mw0A8mfd5xYz8aoMr5g1w\nC5rFHNsjHSzG/ybB36FEqPmC7G3JByeP2N5DnrExCQKBgF7WdO3U3L9Iii4d69nd\nq3AMM2f6cSaiiLSILZrIVI3IUj0ow4h21AjKr/fbIl0pdmf1VxSfc0U6mB6aDD8F\njb2iwEPGbPWAKLpU/iLewm0FzM7omKv9yigk+vA8tpETJ31mbXDWSNe2AWtPmpsz\nA3SqxfnOmuJ1aFwOzN3mkZ9R\n-----END PRIVATE KEY-----\n";
    let clientemail =
      "firebase-adminsdk-fbsvc@rudoassignments.iam.gserviceaccount.com";
  if (privatekey && clientemail) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID || "rudoassignments",
        privateKey:
          "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDWYksBB/7vRksx\nBH3NeWEX6m1j55FWOhN0JYZTOvAI/fW4zQT2WYXJLnc+ELzNDjnUg7m9Wbj6yrv6\nK20mFgGUzfsT3PPRTCYH3zfu0gBGX6503MLsQykfA2pyknHPSWzgMA7/OHx+7XOn\nLVOo2/DUzZBuBztpv3nsNVC/zZ/doGZzXXTKnNdC97BVmf/jgXecwNqH0vmiWeU3\nKgcNifJaf3Z9SxkcMiVt8kYPbPK8Cf/+cg+zRm/x/nV9ycvG2BJ1D8tIWBEkjX3i\nW7XSczzLje0gZGuvyXl9DF1L60EqC2xLkEIxUpnqlfjfzTZuK6b6KTe68mwrcwE4\n+8KMoeVxAgMBAAECggEAEsUJk9IpRPX6spSV9pnSUUOYNvtg50OfrSc1aN9TwXfJ\nrhe+H9rz6oqnzD5vJ0Vf9Q4g4pYCyutZ1KP9cwyRcB+uJD2vt6MC/+SwWxeWCFNL\nfQYQh1q0dJeKF/SgJAHF12WBxKDjjoHX4rrGVLYH8nu6cdWugxpNcIu08YwNW3wM\n/6adkhna0n/yiO2LFXAw91jg452994XQCKOth0r9ukeZKvDMQKgWT6CqQUuS8em3\nHcfBAY41ndkVGyTgB5JnrCBpr+jo50x1tRFD42m9HJgAljP27YEodGNiWCx3vpxV\nCmUTY80vw8Ks/iPXt1fQkY4XjlwUkfhn5/eNHNlZWQKBgQDv4T/It09BEIQuYM9w\nARFwmAjajm/xHSQ72J/TrBRuPKIQeWfF/mxF8NnBndfAhbbOdMYJ6rqp4w5Cdsi/\n1k5r+fHaW3hgSaSljcHRhrkbGmq+CSM/ixyYL5bKsuAYEOzhU+RIA2s+ZDqk0l8C\nhQHb9uLLJGITMZgxxMssYo8v6QKBgQDkym1YnKJGywDCgQ9WOZfvWRgdOFbpKnn4\nssgkbK9Dx5ugP41RrfHpBuBF8E4P7l0Yz0XZyh7H2258iHDldfhFGZPQMkOIW2Ge\nqzwx6IHJSw0llvQ0TcM9cX5lbWPLI6gH6NZgokUAz+RQw8Kn4Z8uYjRu91F+GYQs\nBUhHk/ncSQKBgQDUAs5AFRvcEr/wyamtgZQrYoQ4vrlbbnku17fy+l0YTUijrNm2\nGbcSXdvoDxy4ULYQZQ7/htGyAzcAMUIeo0eukTtb1Ypf99aoZ9DM4fjKZp+/FA5u\nRAJi03S/9DaxroveXyodJ8BqZWWbdT9515qcEenCx4ZTFntASYGU2gtZuQKBgQCH\ntM5hJh9XMGhV9ql7MpQ9YzJbeqSKjyhj7N+sQ08+O/LCfY+8aBm6Z9q1gVE8P922\nrpM3GJ1jXHPPqDqW0H+ftQkpD/dgtRtVOypsTAZXuI2mw0A8mfd5xYz8aoMr5g1w\nC5rFHNsjHSzG/ybB36FEqPmC7G3JByeP2N5DnrExCQKBgF7WdO3U3L9Iii4d69nd\nq3AMM2f6cSaiiLSILZrIVI3IUj0ow4h21AjKr/fbIl0pdmf1VxSfc0U6mB6aDD8F\njb2iwEPGbPWAKLpU/iLewm0FzM7omKv9yigk+vA8tpETJ31mbXDWSNe2AWtPmpsz\nA3SqxfnOmuJ1aFwOzN3mkZ9R\n-----END PRIVATE KEY-----\n".replace(
            /\\n/g,
            "\n"
          ),
        clientEmail:
          "firebase-adminsdk-fbsvc@rudoassignments.iam.gserviceaccount.com",
      }),
    });
  } else {
    // For development, you can use application default credentials
    // or initialize with a service account key file
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || "rudoassignments",
    });
  }
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
}

module.exports = admin;

