const express = require('express');
const crypto = require('crypto');
const https = require('https');
const app = express();

app.use(express.json());

const DROPBOX_ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN;
const DROPBOX_FOLDER_PATH = process.env.DROPBOX_FOLDER_PATH;
const ZOOM_SECRET_TOKEN = process.env.ZOOM_SECRET_TOKEN;

app.post('/webhook', (req, res) => {
  const payload = req.body;

  if (payload.event === 'endpoint.url_validation') {
    const hashForValidate = crypto
      .createHmac('sha256', ZOOM_SECRET_TOKEN)
      .update(payload.payload.plainToken)
      .digest('hex');
    return res.json({
      plainToken: payload.payload.plainToken,
      encryptedToken: hashForValidate
    });
  }

  if (payload.event === 'recording.completed') {
    const files = payload.payload.object.recording_files;
    const topic = payload.payload.object.topic;
    const startTime = payload.payload.object.start_time;
    const downloadToken = payload.download_token;

    files.forEach(file => {
      if (file.file_type === 'MP4' && file.status === 'completed') {
        const fileName = (topic + '_' + startTime + '.mp4').replace(/[^\w\s.-]/g, '_');
        uploadToDropbox(file.download_url, fileName, downloadToken);
      }
    });
  }

  res.sendStatus(200);
});

function uploadToDropbox(downloadUrl, fileName, zoomToken) {
  const data = JSON.stringify({
    path: DROPBOX_FOLDER_PATH + '/' + fileName,
    url: downloadUrl + '?access_token=' + zoomToken
  });

  const options = {
    hostname: 'api.dropboxapi.com',
    path: '/2/files/save_url',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + DROPBOX_ACCESS_TOKEN,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  const req = https.request(options, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => console.log('Dropbox result:', body));
  });

  req.on('error', e => console.error('Dropbox error:', e));
  req.write(data);
  req.end();
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
