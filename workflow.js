require('dotenv').config();
process.env.TZ = 'Asia/Ho_Chi_Minh';
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
require('dotenv').config();

const LAST_PROCESSED_ROW_FILE = path.join(__dirname, '.last-processed-row');
const ROW_COUNT_FILE = path.join(__dirname, '.row-count');

// Google Sheets configuration
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = 'RSVP'; // Change if your sheet has a different name

// Email configuration
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS;

// Load last processed row from file (persists between runs)
function loadLastProcessedRow() {
  try {
    if (fs.existsSync(LAST_PROCESSED_ROW_FILE)) {
      const content = fs.readFileSync(LAST_PROCESSED_ROW_FILE, 'utf8').trim();
      const row = parseInt(content, 10);
      return isNaN(row) ? 0 : row;
    }
  } catch (error) {
    console.error('Error loading last processed row:', error);
  }
  return 0;
}

// Save last processed row to file
function saveLastProcessedRow(row) {
  try {
    fs.writeFileSync(LAST_PROCESSED_ROW_FILE, row.toString(), 'utf8');
  } catch (error) {
    console.error('Error saving last processed row:', error);
  }
}

// Load saved row count from file
function loadRowCount() {
  try {
    if (fs.existsSync(ROW_COUNT_FILE)) {
      const content = fs.readFileSync(ROW_COUNT_FILE, 'utf8').trim();
      const count = parseInt(content, 10);
      return isNaN(count) ? null : count;
    }
  } catch (error) {
    console.error('Error loading row count:', error);
  }
  return null;
}

// Save row count to file
function saveRowCount(count) {
  try {
    fs.writeFileSync(ROW_COUNT_FILE, count.toString(), 'utf8');
  } catch (error) {
    console.error('Error saving row count:', error);
  }
}

// Track the last processed row (loaded from file)
let lastProcessedRow = loadLastProcessedRow();

// Track emails that have already received emails (to prevent duplicates)
const processedEmails = new Set();

// Initialize Google Sheets API
async function getGoogleSheetsClient() {
  let auth;
  
  // Check if using P12 key or JSON key
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_SERVICE_ACCOUNT_KEY.endsWith('.p12')) {
    // P12 format
    auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  } else {
    // JSON format (default)
    auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || 'service-account-key.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  }

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  return sheets;
}

// Initialize Gmail transporter
function getGmailTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_PASS,
    },
  });
}

// Send email function
async function sendEmail(to, subject, message) {
  const transporter = getGmailTransporter();
  
  // Path to the image file
  const imagePath = path.join(__dirname, 'just.png');
  
  // Check if image file exists
  let attachments = [];
  if (fs.existsSync(imagePath)) {
    attachments = [
      {
        filename: 'just.png',
        path: imagePath,
        cid: 'just_married_image' // Content-ID for inline image
      }
    ];
    console.log(`Image file found at ${imagePath}`);
  } else {
    console.warn(`Image file not found at ${imagePath}, sending email without image`);
  }
  
  const mailOptions = {
    from: `"Mạnh Hùng & Ngọc Ánh" <${GMAIL_USER}>`,
    to: to,
    subject: subject,
    html: message,
    attachments: attachments
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${to}. Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error);
    console.error(`Error details:`, error.message);
    if (error.response) {
      console.error(`SMTP response:`, error.response);
    }
    return false;
  }
}


const PROCESSED_EMAILS_FILE = 'processed_emails.json';

// Hàm load emails đã xử lý
function loadProcessedEmails() {
  try {
    if (fs.existsSync(PROCESSED_EMAILS_FILE)) {
      const data = fs.readFileSync(PROCESSED_EMAILS_FILE, 'utf8');
      const emails = JSON.parse(data);
      console.log(`📁 Loaded ${emails.length} processed emails from file`);
      return new Set(emails);
    }
  } catch (error) {
    console.log('❌ No processed emails file found or error reading, creating new one');
  }
  return new Set();
}

// Hàm save emails đã xử lý
function saveProcessedEmails(emailsSet) {
  try {
    const emailsArray = Array.from(emailsSet);
    fs.writeFileSync(PROCESSED_EMAILS_FILE, JSON.stringify(emailsArray, null, 2));
    console.log(`💾 Saved ${emailsArray.length} processed emails to ${PROCESSED_EMAILS_FILE}`);
  } catch (error) {
    console.error('❌ Error saving processed emails:', error);
  }
}

async function checkForNewRows() {
  let processedEmails;
  
  try {
    const sheets = await getGoogleSheetsClient();
    
    // Load emails đã xử lý từ file
    processedEmails = loadProcessedEmails();
    
    // Get all data from the sheet
    let response;
    try {
      response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:Z`,
      });
    } catch (error) {
      // If that fails, try without sheet name
      try {
        response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'A:Z',
        });
      } catch (err2) {
        // Try getting sheet names first
        const sheetInfo = await sheets.spreadsheets.get({
          spreadsheetId: SPREADSHEET_ID,
        });
        const firstSheetName = sheetInfo.data.sheets[0].properties.title;
        response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${firstSheetName}!A:Z`,
        });
      }
    }

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      console.log('📭 No data rows found');
      return;
    }

    // Skip header row
    const dataRows = rows.slice(1);
    let newEmailsCount = 0;
    let skippedEmailsCount = 0;

    console.log(`📊 Found ${dataRows.length} data rows in spreadsheet`);
    console.log(`📧 Already processed: ${processedEmails.size} emails`);

    for (let i = 0; i < dataRows.length; i++) {
      const rowIndex = i + 2; // +2 because: +1 for header, +1 for 1-based indexing
      const row = dataRows[i];
      
      // Map row data (adjust indices based on your sheet structure)
      const name = row[1] || '';
      const email = row[2] || '';
      const zusage = row[3] || '';
      const guests = row[4] || '';
      const comment = row[5] || '';
      
      if (!email) {
        console.log(`➡️ Row ${rowIndex}: No email found, skipping`);
        continue;
      }
      
      const emailLower = email.toLowerCase().trim();
      
      // Kiểm tra nếu email đã được xử lý
      if (processedEmails.has(emailLower)) {
        console.log(`⏭️ Row ${rowIndex}: ${email} - ĐÃ GỬI TRƯỚC ĐÂY`);
        skippedEmailsCount++;
        continue;
      }

      console.log(`\n🆕 Row ${rowIndex}: XỬ LÝ MỚI - ${name} (${email}) - ${zusage}`);

      let emailSent = false;

      // Gửi email dựa trên lựa chọn
      if (zusage.toLowerCase() === 'neither') {
        console.log(`✉️ Gửi email "Thật tiếc" đến ${email}`);
        emailSent = await sendEmail(
          email,
          'Thật tiếc! 💔',
          `<p>Thật tiếc vì bạn không thể tham dự.</p>
           <p>Chúng tôi sẽ rất nhớ bạn tại buổi tiệc!</p>
           <p>🫶🏼</p>
           <br>`
        );
      } else {
        console.log(`✉️ Gửi email "Cảm ơn" đến ${email}`);
        emailSent = await sendEmail(
          email,
          'Cảm ơn bạn đã xác nhận tham dự 💍',
          `<p>Xin cảm ơn bạn rất nhiều vì đã phản hồi ☺️!</p>
           <p>Chúng tôi rất vui khi bạn sẽ tham dự ngày cưới của chúng tôi.</p>
           <p>Rất vui vì bạn sẽ là một phần trong ngày đặc biệt này!💍👰🏻‍♀️🤵🏽🌷</p>
           <br>
           <img src="cid:just_married_image" alt="Just Married" style="max-width: 100%; height: auto; margin: 20px 0;">`
        );
      }

      if (emailSent) {
        // Thêm email vào danh sách đã xử lý
        processedEmails.add(emailLower);
        newEmailsCount++;
        console.log(`✅ Đã gửi và lưu ${email} vào danh sách đã xử lý`);
      } else {
        console.log(`❌ Gửi email thất bại cho ${email}`);
      }
    }
    
    // Lưu danh sách emails đã xử lý
    if (newEmailsCount > 0) {
      saveProcessedEmails(processedEmails);
      console.log(`\n🎉 HOÀN THÀNH: Đã xử lý ${newEmailsCount} email mới`);
    } else {
      console.log(`\nℹ️ Không có email mới nào để xử lý`);
    }
    
    console.log(`📊 Thống kê:`);
    console.log(`   - Đã xử lý trước đó: ${skippedEmailsCount} emails`);
    console.log(`   - Mới xử lý: ${newEmailsCount} emails`);
    console.log(`   - Tổng đã xử lý: ${processedEmails.size} emails`);
    
  } catch (error) {
    console.error('❌ Error in checkForNewRows:', error);
    
    // Vẫn cố gắng lưu processed emails nếu có lỗi
    if (processedEmails) {
      saveProcessedEmails(processedEmails);
    }
  }
}
function startPolling() {
  console.log('Starting workflow polling...');
  console.log(`Monitoring sheet: ${SPREADSHEET_ID}`);
  
  // Initial check
  checkForNewRows();
  
  // Check every minute
  setInterval(checkForNewRows, 60000); // 60000ms = 1 minute
}

// Run once (for GitHub Actions)
async function runOnce() {
  console.log('=== Starting RSVP Email Workflow ===');
  console.log(`Gmail User: ${GMAIL_USER ? 'Set' : 'NOT SET'}`);
  console.log(`Gmail Pass: ${GMAIL_PASS ? 'Set' : 'NOT SET'}`);
  console.log(`Spreadsheet ID: ${SPREADSHEET_ID ? 'Set' : 'NOT SET'}`);
  console.log(`Last processed row: ${lastProcessedRow}`);
  console.log(`Monitoring sheet: ${SPREADSHEET_ID}`);
  
  try {
    await checkForNewRows();
    console.log('=== Check complete ===');
    process.exit(0);
  } catch (error) {
    console.error('=== Workflow failed ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Start the workflow
if (require.main === module) {
  // Check if running in GitHub Actions (CI environment)
  if (process.env.CI || process.env.GITHUB_ACTIONS) {
    runOnce();
  } else {
    // Local development - run continuously
    startPolling();
  }
}

module.exports = { checkForNewRows, sendEmail };

