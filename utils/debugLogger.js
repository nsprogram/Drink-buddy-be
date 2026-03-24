const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../debug_chat.log');

const debugLog = (msg, data = null) => {
  const timestamp = new Date().toISOString();
  let text = `[${timestamp}] ${msg}`;
  if (data) {
    text += ` | DATA: ${JSON.stringify(data)}`;
  }
  text += '\n';
  fs.appendFileSync(LOG_FILE, text);
};

module.exports = debugLog;
