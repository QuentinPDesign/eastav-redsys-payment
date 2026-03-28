import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});

const cache = {};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { page, token } = req.query;

  if (token) {
    const url = cache[token];
    if (!url) return res.status(404).json({ error: "Token expired" });
    return res.json({ url });
  }

  const command = new GetObjectCommand({
    Bucket: "manualrass",
    Key: "manual final.pdf",
    ResponseContentDisposition: "inline",
    ResponseContentType: "application/pdf",
  });
  const url = await getSignedUrl(client, command, { expiresIn: 1800 });
  const tok = Math.random().toString(36).slice(2, 10);
  cache[tok] = url;
  setTimeout(() => delete cache[tok], 1800000);

  const viewerUrl = `https://eastav-global.webflow.io/formacion/manual-rass?token=${tok}&page=${page || 1}`;
  res.redirect(viewerUrl);
}
