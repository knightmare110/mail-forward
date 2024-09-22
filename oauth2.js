const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

function getOAuth2ClientForUser(tokenFilePath) {
    const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Load token from the provided token file path
    if (fs.existsSync(tokenFilePath)) {
        const token = JSON.parse(fs.readFileSync(tokenFilePath));
        oAuth2Client.setCredentials(token);
    } else {
        console.error(`Token file not found: ${tokenFilePath}`);
        process.exit(1);
    }

    return oAuth2Client;
}

module.exports = getOAuth2ClientForUser;
