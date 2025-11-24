# Wedding RSVP Workflow

This local workflow replaces the n8n automation and processes RSVP submissions from your Google Sheet, automatically sending thank you emails to guests.

## Features

- Monitors Google Sheet for new RSVP submissions
- Automatically sends personalized emails based on attendance response
- Sends "Thank you for coming" email for attendees
- Sends "That's a pity" email for those who can't attend

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Google Sheets API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Sheets API
4. Create a Service Account:
   - Go to "IAM & Admin" > "Service Accounts"
   - Click "Create Service Account"
   - Give it a name (e.g., "")
   - Grant it "Editor" role
   - Click "Done"
5. Create a key:
   - Click on the service account you just created
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key"
   - **Choose "JSON" format** (it may be labeled as "JavaScript" - that's the same thing, it's a JSON file)
   - Download the key file
   - Save it as `service-account-key.json` in this directory
   - **Note:** If you only see P12 format available, you can use that too - just update your `.env` file accordingly (see env.example)
6. Share your Google Sheet with the service account email:
   - Open your Google Sheet
   - Click "Share"
   - Add the service account email (found in the JSON key file)
   - Give it "Editor" access

### 3. Gmail Setup

1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password:
   - Go to [Google Account Settings](https://myaccount.google.com/)
   - Security > 2-Step Verification
   - App passwords
   - Generate a new app password for "Mail"
   - Copy the 16-character password

### 4. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your values:
   ```
   GOOGLE_SHEET_ID=your-google-sheet-id-from-url
   GOOGLE_SERVICE_ACCOUNT_KEY=service-account-key.json
   GMAIL_USER=your-email@gmail.com
   GMAIL_PASS=your-16-character-app-password
   ```

   To find your Google Sheet ID:
   - Open your Google Sheet
   - Look at the URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
   - Copy the `SHEET_ID_HERE` part

### 5. Update Sheet Name (if needed)

If your Google Sheet tab is not named "Sheet1", update the `SHEET_NAME` constant in `workflow.js`:

```javascript
const SHEET_NAME = 'YourSheetName';
```

### 6. Run the Workflow

```bash
npm start
```

The workflow will:
- Check for new rows every minute
- Process any new RSVP submissions
- Send appropriate emails automatically

## Running in Production

For production use, consider:

1. **Using PM2** to keep it running:
   ```bash
   npm install -g pm2
   pm2 start workflow.js --name wedding-rsvp
   pm2 save
   pm2 startup
   ```

2. **Using a VPS or cloud service** like:
   - Heroku
   - Railway
   - DigitalOcean
   - AWS EC2

3. **Setting up as a systemd service** (Linux)

## Troubleshooting

- **No emails being sent**: Check Gmail app password and credentials
- **Can't read sheet**: Verify service account has access to the sheet
- **Wrong data being read**: Check column indices in `workflow.js` match your sheet structure

## Column Mapping

The workflow expects these columns in order:
- Column A: Name
- Column B: E-Mail
- Column C: Zusage zu welcher Hochzeit?
- Column D: Wie viele Gäste kommen?
- Column E: Kommentar

Adjust the indices in `workflow.js` if your columns are in a different order.

