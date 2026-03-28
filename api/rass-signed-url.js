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

export default async function handler(req, res) {
  const { page } = req.query;
  const command = new GetObjectCommand({
    Bucket: "manualrass",
    Key: "manual final.pdf",
  });
  const url = await getSignedUrl(client, command, { expiresIn: 1800 });
  res.redirect(`${url}#page=${page || 1}`);
}
