const { SecretClient } = require("@azure/keyvault-secrets");
const { DefaultAzureCredential } = require("@azure/identity");

const KEY_VAULT_URL =
  process.env.KEY_VAULT_URL ||
  "https://event-kv-iba.vault.azure.net/";

const SECRET_MAP = {
  "DB-HOST": "DB_HOST",
  "DB-USER": "DB_USER",
  "DB-NAME": "DB_NAME",
  "DB-PASSWORD": "DB_PASSWORD",

  "JWT-SECRET": "JWT_SECRET",
  "JWT-EXPIRES-IN": "JWT_EXPIRES_IN",
  "STRIPE-SECRET-KEY": "STRIPE_SECRET_KEY",
  "ACS-CONNECTION-STRING": "ACS_CONNECTION_STRING",
  "EMAIL-FROM": "EMAIL_FROM",
};

async function loadSecretsFromKeyVault() {
  console.log("🔑 Loading secrets from Azure Key Vault...");

  const credential = new DefaultAzureCredential();
  const client = new SecretClient(KEY_VAULT_URL, credential);

  const entries = Object.entries(SECRET_MAP);

  const results = await Promise.allSettled(
    entries.map(([kvName]) => client.getSecret(kvName))
  );

  let loaded = 0;

  results.forEach((result, i) => {
    const [kvName, envName] = entries[i];

    if (result.status === "fulfilled") {
      process.env[envName] = result.value.value;
      loaded++;
      console.log(`✅ Loaded ${kvName}`);
    } else {
      console.warn(`⚠️ Failed ${kvName}: ${result.reason?.message}`);
    }
  });

  // BUILD DATABASE URL (NOW SAFE)
  if (
    process.env.DB_HOST &&
    process.env.DB_USER &&
    process.env.DB_NAME &&
    process.env.DB_PASSWORD
  ) {
    process.env.DATABASE_URL =
      `postgresql://${process.env.DB_USER}:` +
      `${encodeURIComponent(process.env.DB_PASSWORD)}` +
      `@${process.env.DB_HOST}:5432/${process.env.DB_NAME}?sslmode=require`;

    console.log("✅ DATABASE_URL built successfully");
  } else {
    console.error("❌ DB secrets missing after Key Vault load");
    console.log({
      DB_HOST: process.env.DB_HOST,
      DB_USER: process.env.DB_USER,
      DB_NAME: process.env.DB_NAME,
      DB_PASSWORD: process.env.DB_PASSWORD ? "SET" : "NOT SET",
    });
  }

  console.log(`✅ Loaded ${loaded}/${entries.length} secrets`);
}

module.exports = { loadSecretsFromKeyVault };