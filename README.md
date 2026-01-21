# Auth0 Lab Hands on Lab: MDL

This repo is for a hands-on lab that walks through how to use the Verification Service.

## Prerequisites

- Install Node.js version 20.x locally.
- Clone the [Sample App repo](https://github.com/auth0/hol-mdl).\
\
Install dependencies for the hol-mdl project you just cloned with npm.
```
npm i
```

## Auth0 Environment Setup
### Create a Verification Template
Here you will create a **Verification Template** that verifies credentials. A **Verification Template** allows Auth0 to prompt and verify credentials matching a particular criteria.

1. Using the left nav go to **Credentials > Verification.**
2. Click **+ Create Verification Template.**

![Create a Verification Template](https://cdn.auth0.com/website/auth0/hol-mdl/create_verification_template.png)
3. Name the template\
4. Add Fields for querying and mark if you want to retain them or not.

![Add fields to the template](https://cdn.auth0.com/website/auth0/hol-mdl/create_verification_template_details.png)
5. Click **Create Template** to add the template to your Auth0 Lab tenant.\
6. Copy the Template ID that is displayed below the Verification Template name and take note of it, as you will use it in another section. The **Template ID** is prefixed **vct_.**

![Copy the Template ID](https://cdn.auth0.com/website/auth0/hol-mdl/copy_template_id.png)
### Create new API
1. First you will need to copy the **Domain** value. In order to do that using the left nav go to **Applications > Applications** and open an existing application. Then go to **Settings** tab and copy the **Domain** value. 
2. Using the left nav go to **Applications > APIs.**
3. Click **+ Create API.**
4. In the **identifier** field make sure to use saved **Domain** from step 1 and append **/vdcs.**  So the format would be: `https://${DOMAIN}.auth0c.com/vdcs`.\
Example: `https://hol-mdl-xyz.iam-foundations-mdl2.auth0c.com/vdcs` 
5. Navigate to **Permissions** tab and add following permissions (scopes):
   - `read:verification_request`
   - `create:verification_request`

### Create an Application

Now, you will create an application within your Auth0 tenant that will receive the verifiable credential API calls from your application.

1. Using the left nav go to **Applications > Applications.**
2. Click **+ Create Application.**
3. Pick **Machine to Machine Applications** and click **Create.**

![M2M Application Selection](https://cdn.auth0.com/website/auth0/hol-mdl/create_machine_to_machine_app.png)
4. Authorise the API created in previous **Create new API step.**  Make sure to grant permissions as well.

![Authorize the API](https://cdn.auth0.com/website/auth0/hol-mdl/create_machine_to_machine_app_details.png)
5. Navigate to the **Settings** tab and take note of the **Domain**, **Client ID**, **Client Secret**, as you will use them in another section.

## Adding Verification to the Sample App

This section walks you through setting up Auth0 as a verifier in a web application. For this lab, we are using a Next.js application as an example.

### Update the .env file

Edit the `.env.local` file, and set the missing values:

- `AUTH0_DOMAIN`: the **Domain** that you copied in the **Create an application** section
- `AUTH0_CLIENT_ID`: the **Client ID** of the application you created in the **Create an application** section
- `AUTH0_SECRET`: the **Client Secret** of the application you created in the **Create an application** section
- `TEMPLATE_ID`: the **Template ID** from the template you created above in the **Create a Verification Template** section

### App Structure

The code in its current state implements a web server with a simple UI. The UI has a button that starts the verification process.

![App structure](https://cdn.auth0.com/website/auth0/hol-mdl/credentail_verification_app.png)
The following high level steps describe how the app works:
1. When the **Start Presentation Flow** button is clicked, the app starts a verification request by making an API call to Auth0. In this API call, the app sends the `clientid`, `templateid` variables to the API. Auth0 replies with a `verificationId` (Verification ID (UUIDv4) , `engagement` (MDoc URI).\
The `engagement` is what you encode into a QR code for a wallet application to scan and start the process.
2. The `verificationId` is used to call back to another Auth0 API to check if the user submitted credentials.
3. Then, the application periodically checks Auth0 by making a separate API call to check if the user has successfully submitted a presentation. It passes the `verificationId` that was received as a response in step 1, and keeps doing it (polling for 60s) until a response indicating the process is complete is received.

To make this flow work, you will create two endpoints in our application:
- `/api/verify/start`
- `/api/verify/check`

When the user clicks the button to start the flow, a call needs to be made to the **/api/verify/start** endpoint, which will then start an interval timer on the UI to call the **/api/verify/check** endpoint once per second.

For simplicity, the UI is already wired up to handle calling the backend, different states, loading, error, etc. You only need to implement the two endpoints where the core logic is handled.
### Get the access token
In order to interact with the APIs we need to first fetch the token. 
1. In the root folder create a new folder named **utils**.
2. Create a new file named **auth.js** in the **utils** folder.
3. Import the **node-fetch** library, load the environment variables. This code is identical to the previous section:\
```js
import fetch from "node-fetch";

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID;
const AUTH0_SECRET = process.env.AUTH0_SECRET;

if (!AUTH0_DOMAIN) throw new Error("AUTH0_DOMAIN not set");
if (!AUTH0_CLIENT_ID) throw new Error("AUTH0_CLIENT_ID not set");
if (!AUTH0_SECRET) throw new Error("AUTH0_SECRET not set");
```
4. Follow the guidelines from this [doc](https://auth0.com/docs/secure/tokens/access-tokens/get-access-tokens) to get the access token for the right audience
```js
let cachedToken = null;
let tokenExpiry = null;

export async function getVdcsBearer() {
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) return cachedToken;

    const response = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify({
            client_id: AUTH0_CLIENT_ID,
            client_secret: AUTH0_SECRET,
            audience: `https://${AUTH0_DOMAIN}/vdcs`,
            grant_type: "client_credentials",
        }),
    });

    const data = await response.json();
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + data.expires_in * 1000;
    return cachedToken;
}
``` 
### Create a Presentation Request

This endpoint starts a **Presentation Request** by making a call to the Auth0 API. The API returns a engagement with the presentation request information for the user's wallet to consume.

A **Presentation Request** keeps track in Auth0 that the sample app requested a credential from a user.
1. Create a new folder named **api** in the **api** the pages folder.
2. Create a new folder named **verify** in the **api** folder you created in the previous step.
3. Create a new file named **start.js** in the **pages/api/verify** folder.
4. You will need to make API calls to Auth0. Add the following snippet to the **start.js** file. The snippet imports the **node-fetch** module, which you will use to make HTTP calls to the Auth0 API.
```js
import fetch from "node-fetch";
```
5. Import the function for fetching the token.
```js
import { getVdcsBearer } from "../../../utils/auth";
```
6. Assign the environment variables from the `.env.local` file to variables. By default, Next.js parses this file and sets the variables on the `process.env` object.
```js
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID;
const AUTH0_SECRET = process.env.AUTH0_SECRET;
const TEMPLATE_ID = process.env.TEMPLATE_ID;

if (!AUTH0_DOMAIN) throw new Error("AUTH0_DOMAIN not set");
if (!AUTH0_CLIENT_ID) throw new Error("AUTH0_CLIENT_ID not set");
if (!AUTH0_SECRET) throw new Error("AUTH0_SECRET not set");
if (!TEMPLATE_ID) throw new Error("TEMPLATE_ID not set");
```
7. Add the function to handle the HTTP request. This is mostly Next.js boilerplate. The relevant part is the call to `run()` that will do the bulk of the work.
```js
export default async function handler(req, res) {
    try {
        const result = await run();
        res.status(200).json(result);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
}
```
8. Define the `run()` function. It makes a POST HTTP request to the Auth0 verification API to start a Verifiable Presentation request and returns an object with two variables from the response.
   - `verificationId`: Verification ID (UUIDv4) as received from the verification initiation. This ID is used for subsequent interactions with the verification API, such as polling for status.
   - `engagement`: MDoc URI for the webapi protocol. This URI should be presented to the user to initiate the wallet interaction using the protocols. It conforms to the structure defined in [ISO/IEC DTS 18013-7](https://www.iso.org/standard/82772.html) (Annex 4).
```js
async function run() {
    const bearerToken = await getVdcsBearer();

    const result = await fetch(`https://${AUTH0_DOMAIN}/vdcs/verification`, {
        method: "post",
        headers: {
            "authorization": `bearer ${bearerToken}`,
            "content-type": "application/json",
        },
        body: JSON.stringify({
            template_id: TEMPLATE_ID,
            protocol: "mdoc/webapi/v1.0",
        }),
    })

    const { verificationId, engagement } = await result.json();

    return {verificationId, engagement };
},
```
### Check the Presentation Request's status

Once a **Presentation Request** has been created, the sample verifier app needs to know if the user submitted a credential to Auth0. The app does this by calling the **/api/verify/check** endpoint periodically. This endpoint calls an Auth0 API to check the status of the request. If the presentation was successful, the API will return the JSON from the presentation.
1. Create a new file named **check.js** in the **pages/api/verify** folder.
2. Import the **node-fetch** library, function for fetching the token, load the environment variables. This code is identical to the previous section:
```js
import fetch from "node-fetch";
import { getVdcsBearer } from "../../../utils/auth";

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID;
const AUTH0_SECRET = process.env.AUTH0_SECRET;
const TEMPLATE_ID = process.env.TEMPLATE_ID;

if (!AUTH0_DOMAIN) throw new Error("AUTH0_DOMAIN not set");
if (!AUTH0_CLIENT_ID) throw new Error("AUTH0_CLIENT_ID not set");
if (!AUTH0_SECRET) throw new Error("AUTH0_SECRET not set");
if (!TEMPLATE_ID) throw new Error("TEMPLATE_ID not set");
```
3. The HTTP handler will be very similar to the previous one. However, `verificationId` must be extracted from the POST body, so the sample app can query Auth0 for the status of the **Presentation Request**. Then, pass the `verificationId` to the `run()` function where most of the work will be done:
```js
export default async function handler(req, res) {
    try {
        const verificationId = req.body.verificationId;
        const result = await run(verificationId);
        res.status(200).json(result);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
}
```
4. Implement the `run()` function. It uses the ID of the **Presentation Request** (`verificationId`) to check the status of that request in Auth0 and returns the result.
> [!IMPORTANT]
> Once the presentation request completes, Auth0 responds to the HTTP request with an object that has a presentation property. The value of this property is a JSON object represented as a string. Before returning the result to the caller, we are turning the string into a JSON object.
```js
async function run(verificationId) {
    if (!verificationId) throw new Error("verificationId not found");

    const bearerToken = await getVdcsBearer();

    const result = await fetch(
        `https://${AUTH0_DOMAIN}/vdcs/verification/${verificationId}`,
        {
            method: "get",
            headers: {
                "authorization": `bearer ${bearerToken}`,
                "content-type": "application/json",
            },
        }
    );

    const data = await result.json();

    if (data.presentation) {
        data.presentation = JSON.parse(data.presentation);
    }

    return data;
}
```
### Verify it Works
That is all that is needed to implement verification through Auth0. To test the flow follow these steps.
1. In a terminal, `run npm run dev`. This should start the app on localhost:3000.
2. Open the application at http://localhost:3000/.
3. Click **Start Presentation Flow**.

![Yep, same image!](https://cdn.auth0.com/website/auth0/hol-mdl/credentail_verification_app.png)
4. Once ready, scan the QR code or click **here**. Make the engagement with your wallet 
5. Back in the app, you will see the JSON contents of the Verifiable Presentation received from the wallet. 
 
> [!NOTE]
>The full completed code for this lab is available on the endstate branch of the repo:
>https://github.com/Auth0/hol-mdl/tree/endstate


