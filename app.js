const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const getOAuth2ClientForUser = require('./oauth2');

// List unread messages
async function listUnreadMessages(auth) {
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread',
  });

  return res.data.messages || [];
}

// Get the email content by message ID
async function getEmailContent(auth, messageId) {
  const gmail = google.gmail({ version: 'v1', auth });
  const message = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
  });

  return message.data;
}

// Mark an email as read
async function markEmailAsRead(auth, messageId) {
  const gmail = google.gmail({ version: 'v1', auth });
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      removeLabelIds: ['UNREAD'],
    },
  });
}

// Helper function to recursively extract body content from a message
function extractBodyFromParts(parts, mimeType) {
  let body = '';
  
  for (const part of parts) {
    if (part.mimeType === mimeType && part.body && part.body.data) {
      body += Buffer.from(part.body.data, 'base64').toString('utf-8');
    } else if (part.parts) {
      // Recursively handle nested parts
      body += extractBodyFromParts(part.parts, mimeType);
    }
  }

  return body;
}

// Forward the email
async function forwardEmail(auth, emailContent, sender, toAddress) {
  const gmail = google.gmail({ version: 'v1', auth });

  // Extract subject
  const subject = `Fwd: ${emailContent.payload.headers.find(h => h.name === "Subject").value}`;

  // Initialize body and content type
  let body = '';
  let type = 'text/html';

  if (emailContent.payload.mimeType === 'text/html' || emailContent.payload.mimeType === 'multipart/alternative') {
    // Handle HTML content or multipart emails
    if (emailContent.payload.parts) {
      body = extractBodyFromParts(emailContent.payload.parts, 'text/html');
    } else {
      body = emailContent.payload.body.data
        ? Buffer.from(emailContent.payload.body.data, "base64").toString('utf-8')
        : '';
    }
  } else if (emailContent.payload.mimeType === 'text/plain') {
    // Handle plain text content
    body = emailContent.payload.body.data
      ? Buffer.from(emailContent.payload.body.data, "base64").toString('utf-8')
      : '';
  } else if (emailContent.payload.mimeType === 'multipart/mixed' || emailContent.payload.parts) {
    // Handle multipart/mixed, which may include attachments and inline content
    body = extractBodyFromParts(emailContent.payload.parts, 'text/html') || extractBodyFromParts(emailContent.payload.parts, 'text/plain');
  }

  // Create raw message
  const rawMessage = [
    `From: ${sender}`,
    `To: ${toAddress}`,
    `Subject: ${subject}`,
    `Content-Type: ${type}; charset=UTF-8`,
    '',
    body
  ].join('\n');

  // Encode message in base64url format
  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Send the email
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  });

  console.log(`Email forwarded to ${toAddress}`);
}

// Define rules for redirection
const emailRules = {
  'kevinrowland.pro0110@gmail.com': 'ghinavanry@gmail.com',
  'steven.fredericks.dev110@gmail.com': 'kevinrowland.dev0110@gmail.com',
  'joshuawentroble@gmail.com': 'ansfrzzz@gmail.com',
  'knightmare.protagonist@gmail.com': 'ghinavanry@gmail.com',
};

function verificationCheck(subject) {
  const targets = [
    'confirm your identity',
    'complete your application',
    'your submission is almost done',
    'security code for your application',
    'complete your',
    'your application is incomplete',
    'verification code',
    'verify your candidate account',
    'oracle identity verification',
    'verify your email address',
    'sign up for bronze',
    'your password-free login for squarepeg',
    'reset your password',
    'secure authentication code',
    'your job application is incomplete',
    'verify your candidate account',
    'apply now',
    'new match:',
    'i think you may be a good fit for these roles',
    'interested in any of these jobs?',
    'more react jobs in remote',
    '@ get.it',
    'be a great fit for this',
    'your ukg token'
  ];

  for (let target of targets) {
    if (subject.toLowerCase().includes(target)) return true;
  }

  return false;
}

function checkEmail(content) {
  for(let email of Object.keys(emailRules)) {
    if(content.toLowerCase().includes(email.toLowerCase())) return email;
  }
  return null;
}

// Main function to check emails and redirect based on rules for each account
async function checkAndRedirectEmails() {
  const tokensDir = path.join(__dirname, 'tokens');

  fs.readdir(tokensDir, async (err, files) => {
    if (err) {
      console.error('Error reading tokens directory', err);
      return;
    }

    for (const file of files) {
      const tokenFilePath = path.join(tokensDir, file);
      const gmailAccount = path.basename(file, '.json');

      console.log(`Checking Gmail account: ${gmailAccount}`);

      const auth = getOAuth2ClientForUser(tokenFilePath);
      const unreadMessages = await listUnreadMessages(auth);

      for (const message of unreadMessages) {
        const emailContent = await getEmailContent(auth, message.id);
        try {
          const fromHeader = emailContent.payload.headers.find(h => h.name === 'To').value;

          const senderEmail = fromHeader;
          const subject = emailContent.payload.headers.find(h => h.name === 'Subject').value;

          const finalizedEmail = checkEmail(senderEmail);
          if (finalizedEmail && verificationCheck(subject)) {
            await forwardEmail(auth, emailContent, finalizedEmail, emailRules[finalizedEmail]);
            console.log(`Email from ${finalizedEmail} with subject "${subject}" forwarded for ${gmailAccount}.`);

            // Mark the email as read after forwarding
            await markEmailAsRead(auth, message.id);
          } 
        } catch (error) {
          console.log('Error happened:', error);
        }
      }
    }
  });
}

// Run the script
checkAndRedirectEmails();
setInterval(checkAndRedirectEmails, 60 * 1000);
