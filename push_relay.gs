// ============================================================
// PORTAL DAS ESCRITORAS — Push Notification Relay
// Cole este código em: script.google.com (novo projeto)
// Publique como: Deploy > New deployment > Web App
//   - Execute as: Me
//   - Who has access: Anyone
// ============================================================

const SERVICE_ACCOUNT_EMAIL = 'firebase-adminsdk-fbsvc@portal-das-escritoras.iam.gserviceaccount.com';
const PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDRsObf8VXyowcX\nu7Qw7152gEwTJ7m0l44Pk0TY0jfb8A3cMi7s2XTdxjCqIvF1YVB7NSAu8/1A/9Zm\nLNQ0eUJG9aPcBZgciAAHA/iGvUuY6LLePJk6lTLVQCkZjG3BMTRYsvo3qJCGnVeG\nxey3YRq3y7cLJwNi22IvFwGHFyfqruDyOAUVj3VM+/VUbXufzboLXcGJt9wtbXdQ\nkQyUPu8TNqA2uKkcHdfhdA3Xtrdzhpr1aJWoFsUJ+Qkej6R5bhjhxV/NAbsFXtqe\nyS0njPGpYMhTcSNzYJ2C63zWbEq//takhjALUwU2+t/USu5K3YXZtpXVDJ+NAkUl\nCoIpuYuJAgMBAAECggEAVlK4oN1lsAb8PwF3WyPXo/oKF2KluRohEfljAM190G2h\nDxKbrcaRrVDPLONIurVOoAINVzb7fZw0w4hV7aozpimuhL/K0IgOVtUEJVfdPLwj\nEoko3WyZah/JK6rbbgpXDeLUTkB3CuvQIfvuCMoRaTOUjaNIahR9dXxHlTjrplkL\nWFAzVBSOE6LR3aehRKIVChFdXUCzFVLQFbbBSQ+NNxKbnL0GlsNYF7Ln/zeesc6z\nGIT93nDkNsYwPgl9sHn9BWLfdMolm9+TDE398OqLeh8B/M8r57z1HHNovb2ZpZOv\nTlPNtIzssQKHnuekmJqvYjO/UwWZjrDa2cTkhDYlBwKBgQD9lIhdscs07Onqycy5\n+SJT5eBcSBadDzMt7RdJw401ij65ngieKvBLAbBOFS1GD7kKAEapmOIcQrk+B4sK\nFf/Yvy4JFGMiVWHnBcWoXCgoK2HBQ0sICDdE6h8q4kyX4rJiikMbLJCZX4XHWT3d\nd/D+YIsU4NSgfmj+lrYtwxp6xwKBgQDTsScnLQl3FwhEj3GJZ4TdI0yBdxHNiwQ2\nJmc5kCiSmg3uhpPDaxuxpt2h4P1d9mPUehnz4ipJZEh65Oa5zkWGbbHzhmA+FG3I\nQmB9xN2ZGSoyAYBmP0q4Hs6ALlpHNXlOwn7SbVD1P3ctWgXuIrxAOU4ana7Bhl7Z\nP/gzimH3LwKBgQCYn46X/gvVdgawZvdOs9Fid8hbIpRhwaVHLh1HK2jRYbyxEZoU\nQLnSG1kXFg3izlHL4DCnoTnuUoaV/ApGbslHloHJuziTkJpVZxb5Z0ZQLxQuMyd0\n1SUW2Gcb84qwHCTLxHXxZBhAB8tIGcFvi+JD6K2tSkkPtCXTnbhWwMguPwKBgBlS\nJEvEUFCFWcDRo5P65OKKmVkXA/MhALT1bP1up9u5P5dbU4tZYWujePkm70dw9Eny\n/O22DLbQnvbMMGjjKl/E+TcWyKZETUlZ3y7MAHGSmAB5O4F/apGRZcPhR30jAUqR\naxgCaV+cYsXy8ailUP0hnZ0DZWbSir/Trf2EPOmTAoGALN55ZA2geoBaAKElyo4t\na2DnSbBGeSdFUacpqEBTJfu+U9jyU87sj3Cs4u/663LoRzOde9PiH1JGxWAzasum\nvFhqNQAjin/1h0xAjZSa+cmHXq3JSL0XFw3BnQDnHr1AE9rX9PxnpzpafwMX97uh\nNZ4WOnFhXf8zMDN2zR12aog=\n-----END PRIVATE KEY-----\n';
const PROJECT_ID = 'portal-das-escritoras';

// ============================================================

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const { tokens, title, body, icon } = payload;

    if (!tokens || tokens.length === 0) {
      return jsonResponse({ status: 'no_tokens' });
    }

    const accessToken = getAccessToken();
    const results = [];
    const validTokens = [...new Set(tokens)]; // remover duplicatas

    for (const token of validTokens) {
      if (!token) continue;
      const result = sendFCMMessage(token, title, body, icon, accessToken);
      results.push({ token: token.slice(-8), result });
    }

    return jsonResponse({ status: 'ok', sent: results.length });
  } catch (err) {
    console.error('doPost error:', err);
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);

  const header  = Utilities.base64EncodeWebSafe(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claimSet = Utilities.base64EncodeWebSafe(JSON.stringify({
    iss: SERVICE_ACCOUNT_EMAIL,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  }));

  const signInput  = header + '.' + claimSet;
  const signature  = Utilities.base64EncodeWebSafe(
    Utilities.computeRsaSha256Signature(signInput, PRIVATE_KEY)
  );
  const jwt = signInput + '.' + signature;

  const resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    contentType: 'application/x-www-form-urlencoded',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    },
    muteHttpExceptions: true
  });

  const data = JSON.parse(resp.getContentText());
  if (!data.access_token) throw new Error('Falha ao obter access token: ' + resp.getContentText());
  return data.access_token;
}

function sendFCMMessage(token, title, body, icon, accessToken) {
  const message = {
    message: {
      token: token,
      notification: {
        title: title || '📝 Portal das Escritoras',
        body:  body  || 'Nova publicação no feed!'
      },
      webpush: {
        notification: {
          icon:  icon || 'https://ui-avatars.com/api/?name=PE&background=B31312&color=fff&size=192',
          badge: 'https://ui-avatars.com/api/?name=PE&background=B31312&color=fff&size=72',
          requireInteraction: true,
          vibrate: [200, 100, 200]
        },
        fcmOptions: {
          link: 'https://backupcomunicacaoeditoracassol-sudo.github.io/prevenda/'
        }
      }
    }
  };

  const resp = UrlFetchApp.fetch(
    'https://fcm.googleapis.com/v1/projects/' + PROJECT_ID + '/messages:send',
    {
      method: 'POST',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + accessToken },
      payload: JSON.stringify(message),
      muteHttpExceptions: true
    }
  );

  return resp.getResponseCode();
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Teste manual: rode esta função no editor para verificar autenticação
function testAuth() {
  try {
    const token = getAccessToken();
    Logger.log('✅ Access token obtido com sucesso!');
    Logger.log(token.slice(0, 30) + '...');
  } catch (e) {
    Logger.log('❌ Erro: ' + e);
  }
}
