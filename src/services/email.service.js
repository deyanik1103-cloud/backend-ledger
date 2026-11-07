require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: process.env.EMAIL_USER,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN,
  },
});

// Verify the connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('Error connecting to email server:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

/* ---------- helpers ---------- */

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function money(amount, currency) {
  const cur = currency || "USD";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(amount);
  } catch (e) {
    return `${cur} ${Number(amount).toFixed(2)}`;
  }
}

function tail(id) {
  return "..." + String(id).slice(-4);
}

function when(date) {
  return new Date(date || Date.now()).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  }) + " UTC";
}

function layout(heading, inner) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;border:1px solid #e4e3dd;border-radius:14px;overflow:hidden;color:#1c1b18">
    <div style="background:#ffc20e;padding:18px 24px">
      <span style="display:inline-block;background:#000;color:#ffc20e;font-weight:bold;border-radius:8px;padding:4px 11px;margin-right:8px">A</span>
      <b style="font-size:20px;color:#000">Aurum</b>
    </div>
    <div style="padding:24px">
      <h2 style="margin:0 0 14px;color:#000">${heading}</h2>
      ${inner}
    </div>
    <div style="padding:14px 24px;background:#f1f1ee;color:#6f6d65;font-size:12px">
      Aurum is a student demo project. No real money is involved.
    </div>
  </div>`;
}

function detailRows(rows) {
  return `<table style="width:100%;border-collapse:collapse;margin-top:8px">` +
    rows.map(([label, value]) => `
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid #e4e3dd;color:#6f6d65">${esc(label)}</td>
        <td style="padding:9px 0;border-bottom:1px solid #e4e3dd;text-align:right;font-weight:bold">${esc(value)}</td>
      </tr>`).join("") + `</table>`;
}

/* ---------- sender ---------- */

// Returns true when the email was handed to Gmail, false when it failed
const sendEmail = async (to, subject, text, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"Aurum Bank" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log('Message sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

/* ---------- emails ---------- */

async function sendVerificationEmail(userEmail, name, code, minutes) {
  const subject = 'Your Aurum verification code';
  const text = `Hello ${name},\n\nYour Aurum verification code is ${code}.\nIt expires in ${minutes} minutes.\n\nIf you did not sign up, you can ignore this email.`;
  const html = layout("Verify your email", `
    <p style="margin:0 0 16px">Hello ${esc(name)}, enter this code in Aurum to finish signing up:</p>
    <div style="font-size:34px;font-weight:bold;letter-spacing:10px;background:#fff3c7;border-radius:12px;padding:16px;text-align:center;color:#000">${esc(code)}</div>
    <p style="margin:16px 0 0;color:#6f6d65">The code expires in ${minutes} minutes. If you did not sign up, you can ignore this email.</p>`);

  return await sendEmail(userEmail, subject, text, html);
}

async function sendRegistrationEmail(userEmail, name) {
  const subject = 'Welcome to Aurum!';
  const text = `Hello ${name},\n\nYour email is verified and your Aurum profile is ready. Log in and open your first account.\n\nBest regards,\nThe Aurum Team`;
  const html = layout("Welcome to Aurum", `
    <p style="margin:0">Hello ${esc(name)}, your email is verified and your profile is ready. Log in and open your first account.</p>`);

  return await sendEmail(userEmail, subject, text, html);
}

/**
 * - Sent to the person who SENT money
 * - details: { amount, currency, toName, fromAccount, toAccount, transactionId, date }
 */
async function sendTransferSentEmail(userEmail, name, details) {
  const amountText = money(details.amount, details.currency);
  const subject = `You sent ${amountText}`;
  const text = `Hello ${name},\n\nYou sent ${amountText} to ${details.toName} (account ${tail(details.toAccount)}) from your account ${tail(details.fromAccount)}.\nTransaction ID: ${details.transactionId}\nDate: ${when(details.date)}\n\nIf you did not do this, contact support immediately.`;
  const html = layout("Money sent", `
    <p style="margin:0 0 6px">Hello ${esc(name)}, your transfer was successful.</p>
    ${detailRows([
      ["Amount", amountText],
      ["To", `${details.toName} (${tail(details.toAccount)})`],
      ["From your account", tail(details.fromAccount)],
      ["Date", when(details.date)],
      ["Transaction ID", String(details.transactionId)]
    ])}
    <p style="margin:16px 0 0;color:#6f6d65">If you did not make this transfer, contact support immediately.</p>`);

  return await sendEmail(userEmail, subject, text, html);
}

/**
 * - Sent to the person who RECEIVED money
 * - details: { amount, currency, fromName, toAccount, transactionId, date }
 */
async function sendTransferReceivedEmail(userEmail, name, details) {
  const amountText = money(details.amount, details.currency);
  const subject = `You received ${amountText}`;
  const text = `Hello ${name},\n\nYou received ${amountText} from ${details.fromName} in your account ${tail(details.toAccount)}.\nTransaction ID: ${details.transactionId}\nDate: ${when(details.date)}`;
  const html = layout("Money received", `
    <p style="margin:0 0 6px">Hello ${esc(name)}, you just received money.</p>
    ${detailRows([
      ["Amount", amountText],
      ["From", details.fromName],
      ["Into your account", tail(details.toAccount)],
      ["Date", when(details.date)],
      ["Transaction ID", String(details.transactionId)]
    ])}`);

  return await sendEmail(userEmail, subject, text, html);
}

// Kept for older code that may still call it
async function sendTransactionEmail(userEmail, name, amount, toAccount) {
  return await sendTransferSentEmail(userEmail, name, {
    amount, currency: "USD", toName: "recipient", fromAccount: "", toAccount, transactionId: "", date: new Date()
  });
}

async function sendTransactionFailureEmail(userEmail, name, amount, toAccount) {
  const amountText = money(amount, "USD");
  const subject = 'Transaction Failed';
  const text = `Hello ${name},\n\nYour transaction of ${amountText} to account ${toAccount} was unsuccessful.\n\nBest regards,\nThe Aurum Team`;
  const html = layout("Transaction failed", `
    <p style="margin:0">Hello ${esc(name)}, your transaction of ${esc(amountText)} to account ${esc(toAccount)} was unsuccessful.</p>`);

  return await sendEmail(userEmail, subject, text, html);
}

module.exports = {
  sendVerificationEmail,
  sendRegistrationEmail,
  sendTransferSentEmail,
  sendTransferReceivedEmail,
  sendTransactionEmail,
  sendTransactionFailureEmail
};
