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

export default async function handler(req, res) {
    try {
        const verificationId = req.body.verificationId;
        const result = await run(verificationId);
        res.status(200).json(result);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
}

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