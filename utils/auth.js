import fetch from "node-fetch";

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID;
const AUTH0_SECRET = process.env.AUTH0_SECRET;

if (!AUTH0_DOMAIN) throw new Error("AUTH0_DOMAIN not set");
if (!AUTH0_CLIENT_ID) throw new Error("AUTH0_CLIENT_ID not set");
if (!AUTH0_SECRET) throw new Error("AUTH0_SECRET not set");

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
            audience: `https://${AUTH0_DOMAIN}/vdcs/`,
            grant_type: "client_credentials",
        }),
    });

    const data = await response.json();
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + data.expires_in * 1000;
    return cachedToken;
}