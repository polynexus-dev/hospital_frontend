let ua = null, session = null;

if (window.JsSIP) {
  try { JsSIP.debug.enable('JsSIP:*'); } catch(e) {}
}

// ─── ERROR CONTROLLER & NOTIFICATION SYSTEM ────────────────────────────────────
const ErrorController = {
  bannerTimer: null,

  show(message, type = 'error', autoDismissMs = 8000) {
    const banner = document.getElementById('errorBanner');
    const textEl = document.getElementById('errorBannerText');
    const iconEl = document.getElementById('errorBannerIcon');
    if (!banner || !textEl) return;

    banner.className = `error-banner ${type}`;
    iconEl.textContent = type === 'error' ? '❌' : type === 'warn' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
    textEl.textContent = message;
    banner.style.display = 'flex';

    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    if (autoDismissMs > 0) {
      this.bannerTimer = setTimeout(() => this.dismiss(), autoDismissMs);
    }
    log(message, type);
  },

  dismiss() {
    const banner = document.getElementById('errorBanner');
    if (banner) banner.style.display = 'none';
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
  },

  /**
   * Securely handles API response failures without leaking internal stack traces or crashing on HTML
   */
  async handleApiResponseError(res) {
    let errorMsg = `Server error (${res.status})`;
    try {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (typeof data.detail === 'string') {
          errorMsg = data.detail;
        } else if (Array.isArray(data.non_field_errors) && data.non_field_errors.length) {
          errorMsg = data.non_field_errors[0];
        } else if (data.error) {
          errorMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        } else if (data.message) {
          errorMsg = data.message;
        } else {
          const firstVal = Object.values(data)[0];
          if (Array.isArray(firstVal) && firstVal.length) errorMsg = String(firstVal[0]);
          else if (typeof firstVal === 'string') errorMsg = firstVal;
        }
      } else {
        if (res.status === 502 || res.status === 504) {
          errorMsg = 'Telephony backend is unreachable (Bad Gateway). Ensure Django and HoduPBX services are active.';
        } else if (res.status === 404) {
          errorMsg = 'Click-to-call API endpoint not found (404). Check API route.';
        }
      }
    } catch (parseErr) {
      errorMsg = `Failed to parse response (${res.status}).`;
    }

    switch (res.status) {
      case 400:
        this.show(`Bad Request: ${errorMsg}`, 'warn');
        break;
      case 401:
        this.show('Authentication required: Your session has expired or token is invalid. Please log into the Hospital Console.', 'error');
        break;
      case 403:
        this.show('Access Forbidden: Your account is not authorized to initiate calls.', 'error');
        break;
      case 404:
        this.show('Call endpoint not found (404).', 'error');
        break;
      case 409:
        this.show(`Call Conflict: ${errorMsg}`, 'warn');
        break;
      case 429:
        this.show('Rate limit reached: Too many call requests. Please wait a few seconds before trying again.', 'warn');
        break;
      case 500:
        this.show('Internal telephony server error. Please check PBX logs.', 'error');
        break;
      case 502:
      case 503:
      case 504:
        this.show('Telephony PBX Gateway is unreachable. Please verify network connectivity.', 'error');
        break;
      default:
        this.show(errorMsg, 'error');
    }
    return errorMsg;
  },

  /**
   * Handles network and connection exceptions
   */
  handleNetworkError(err) {
    let msg = 'Network error: Unable to contact hospital telephony server.';
    if (!navigator.onLine) {
      msg = 'Offline: Please check your Internet connection.';
    } else if (err.name === 'AbortError') {
      msg = 'Call initiation request timed out (15s). Please check server responsiveness.';
    } else if (err.message && err.message.toLowerCase().includes('failed to fetch')) {
      msg = 'Connection refused: Backend server is unreachable or blocked by CORS.';
    }
    this.show(msg, 'error');
    return msg;
  },

  /**
   * Handles media & microphone permissions
   */
  handleMediaError(err) {
    let msg = 'Microphone error: ' + (err.message || 'Access denied');
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      msg = 'Microphone permission blocked. Click the lock/settings icon in the URL bar to allow microphone access.';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      msg = 'No microphone device found. Please connect an audio input device.';
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      msg = 'Microphone is already occupied by another application.';
    }
    this.show(msg, 'error');
    return msg;
  },

  /**
   * Handles SIP Registration and Call state failures
   */
  handleSipError(cause, status) {
    let msg = `SIP registration error: ${cause || 'Unknown'}`;
    if (status === 401 || status === 407) {
      msg = 'SIP Authentication failed (401/407): Check Extension Number and Password.';
    } else if (status === 403) {
      msg = 'SIP Forbidden (403): Extension disabled or IP not whitelisted in PBX ACL.';
    } else if (status === 404) {
      msg = 'SIP Extension not found (404): Extension does not exist in PBX tenant.';
    } else if (status === 408) {
      msg = 'SIP Request Timeout (408): PBX server did not respond.';
    } else if (status === 486) {
      msg = 'Extension Busy (486): Extension is currently handling another call.';
    } else if (cause === 'User Denied Media Access') {
      msg = 'Microphone access denied: Cannot establish WebRTC audio session.';
    }
    this.show(msg, 'error');
    return msg;
  }
};

// ─── SECURITY CONTROLLER ───────────────────────────────────────────────────────
function log(msg, type = 'info') {
  const c = document.getElementById('log');
  if (!c) return;
  const t = new Date().toTimeString().slice(0,8);
  const el = document.createElement('div');
  el.className = `entry ${type}`;
  el.textContent = `[${t}] ${msg}`;
  c.appendChild(el);
  c.scrollTop = c.scrollHeight;
}

function setStatus(text, cls) {
  document.getElementById('statusText').textContent = text;
  document.getElementById('statusDot').className = `dot ${cls}`;
}

function setBtns({ reg, ans, hup, unreg }) {
  document.getElementById('btnRegister').disabled = !reg;
  document.getElementById('btnAnswer').disabled   = !ans;
  document.getElementById('btnHangup').disabled   = !hup;
  document.getElementById('btnUnreg').disabled    = !unreg;
}

async function register(domain, extUser, authUser, pwd) {
  ErrorController.dismiss();

  // Pre-acquire microphone access
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    const btn = document.getElementById('btnMic');
    if (btn) {
      btn.style.background = '#059669';
      btn.textContent = '🎤 Microphone Enabled ✓';
    }
  } catch (err) {
    ErrorController.handleMediaError(err);
  }

  const wsUrl    = document.getElementById('wsUrl').value.trim();
  const ext      = extUser  || document.getElementById('extNumber').value.trim();
  const auth     = authUser || ext;
  const password = pwd      || document.getElementById('extPassword').value.trim();
  domain         = domain   || document.getElementById('sipDomain').value.trim();

  if (!wsUrl || !domain || !ext || !password) {
    ErrorController.show('Validation Error: All connection fields (WebSocket URL, Domain, Username, Password) are required.', 'warn');
    return;
  }

  if (ua) { try { ua.stop(); } catch(e) {} ua = null; }

  log(`Connecting: sip:${ext}@${domain} (auth: ${auth})`, 'info');
  document.getElementById('sipDomain').value = domain;
  document.getElementById('extNumber').value = ext;

  try {
    const socket = new JsSIP.WebSocketInterface(wsUrl);
    ua = new JsSIP.UA({
      sockets             : [socket],
      uri                 : `sip:${ext}@${domain}`,
      authorization_user  : auth,
      password            : password,
      user_agent          : 'HoduPhone',
      register            : true,
      session_timers      : false,
      register_expires    : 300,
      connection_recovery_min_interval: 2,
      connection_recovery_max_interval: 30,
    });

    ua.on('registered', () => {
      ErrorController.dismiss();
      log(`✅ Registered! User=${ext} Domain=${domain}`, 'success');
      setStatus(`Ready — ext ${ext}`, 'online');
      setBtns({ reg: false, ans: false, hup: false, unreg: true });
    });

    ua.on('unregistered', () => {
      log('Unregistered', 'warn');
      setStatus('Not registered', 'offline');
      setBtns({ reg: true, ans: false, hup: false, unreg: false });
    });

    ua.on('registrationFailed', e => {
      let statusCode = e.response ? e.response.status_code : null;
      let detail = e.cause || 'Rejected';
      if (e.response) {
        detail = `${e.response.status_code} ${e.response.reason_phrase || ''}`;
      }
      ErrorController.handleSipError(e.cause, statusCode);
      log(`❌ Failed [${ext}@${domain}]: ${detail}`, 'error');
      setStatus('Registration failed', 'offline');
      setBtns({ reg: true, ans: false, hup: false, unreg: false });
    });

    ua.on('connected',    () => log('WebSocket connected ✓'));
    ua.on('disconnected', () => {
      log('WebSocket disconnected', 'warn');
      ErrorController.show('WebSocket connection to HoduPBX lost. Attempting reconnection...', 'warn');
    });

    ua.on('newRTCSession', ({ originator, session: s }) => {
      if (originator !== 'remote') return;
      if (session) {
        log('🚫 User is already on a call — rejecting incoming call with 486 Busy', 'warn');
        try { s.terminate({ status_code: 486, reason_phrase: 'Busy Here' }); } catch(e) {}
        return;
      }
      session = s;
      const caller = s.remote_identity.uri.toString();
      log(`📞 Incoming call from ${caller}`, 'success');
      setStatus('📞 Incoming call...', 'ringing');
      setBtns({ reg: false, ans: true, hup: true, unreg: false });

      // Attach peer connection track listener immediately
      s.on('peerconnection', ({ peerconnection }) => {
        peerconnection.addEventListener('track', e => {
          const audioEl = document.getElementById('remoteAudio');
          if (e.streams && e.streams[0]) {
            audioEl.srcObject = e.streams[0];
            audioEl.play().catch(err => ErrorController.handleMediaError(err));
          }
        });
      });

      s.on('ended', () => { session = null; log('Call ended'); reset(); });
      s.on('failed', e => {
        session = null;
        log(`Call Failed: ${e.cause}`, 'error');
        if (e.cause === 'User Denied Media Access') {
          ErrorController.handleMediaError(new Error('Browser blocked microphone access.'));
        }
        reset();
      });
      s.on('confirmed', () => {
        log('Call answered — connected to HoduPBX bridge', 'success');
        setStatus('🔵 In call', 'incall');
        setBtns({ reg: false, ans: false, hup: true, unreg: false });
      });

      // Auto-answer if checked
      const autoAns = document.getElementById('chkAutoAnswer') && document.getElementById('chkAutoAnswer').checked;
      if (autoAns) {
        log('⚡ Auto-answering call...', 'info');
        setTimeout(answer, 300);
      }
    });

    ua.start();
    setStatus('Connecting...', 'offline');
    setBtns({ reg: false, ans: false, hup: false, unreg: false });
  } catch (err) {
    ErrorController.show(`SIP Initialization Error: ${err.message}`, 'error');
  }
}

async function testMic() {
  ErrorController.dismiss();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    log('🎤 Microphone access GRANTED! Audio is ready.', 'success');
    stream.getTracks().forEach(t => t.stop());
    const btn = document.getElementById('btnMic');
    btn.style.background = '#059669';
    btn.textContent = '🎤 Microphone Enabled ✓';
    ErrorController.show('Microphone permission confirmed. Audio is ready.', 'success', 3000);
  } catch (err) {
    ErrorController.handleMediaError(err);
  }
}

function answer() {
  if (!session) {
    ErrorController.show('No incoming call to answer', 'warn', 3000);
    return;
  }
  try {
    session.answer({
      mediaConstraints: { audio: true, video: false },
      pcConfig: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      },
    });
  } catch(err) {
    ErrorController.show(`Answer error: ${err.message}`, 'error');
  }
}

function hangup() {
  if (session) {
    try { session.terminate(); } catch(e) {}
    session = null;
  }
  reset();
}

function unregister() {
  if (ua) {
    try { ua.unregister(); ua.stop(); } catch(e) {}
    ua = null;
  }
  setStatus('Not registered', 'offline');
  setBtns({ reg: true, ans: false, hup: false, unreg: false });
  document.getElementById('remoteAudio').srcObject = null;
}

function reset() {
  const reg = ua && ua.isRegistered();
  setStatus(reg ? 'Ready — waiting' : 'Not registered', reg ? 'online' : 'offline');
  setBtns({ reg: !reg, ans: false, hup: false, unreg: !!reg });
  document.getElementById('remoteAudio').srcObject = null;
}

// Auto-try all common HoduPBX / FreeSWITCH configuration permutations
async function autoTry() {
  // No built-in password or password hash: this page is a public file, so
  // anything written here is readable by anyone who can reach the site.
  const passPlain = document.getElementById('extPassword').value.trim();
  if (!passPlain) {
    log('Enter the extension password first.', 'error');
    return;
  }

  const combos = [
    { domain: 'ecallpbx.konnectcom.in', ext: '1048101', auth: '1048101', pwd: passPlain },
    { domain: '1048',                  ext: '101',     auth: '101',     pwd: passPlain },
    { domain: '1048',                  ext: '1048101', auth: '1048101', pwd: passPlain },
    { domain: 'ecallpbx.konnectcom.in', ext: '101',     auth: '101',     pwd: passPlain },
    { domain: 'ecallpbx.konnectcom.in', ext: '101',     auth: '1048101', pwd: passPlain },
    { domain: '74.225.89.85',          ext: '1048101', auth: '1048101', pwd: passPlain },
    { domain: '74.225.89.85',          ext: '101',     auth: '101',     pwd: passPlain },
    { domain: '1048.ecallpbx.konnectcom.in', ext: '101', auth: '101',   pwd: passPlain },
  ];

  document.getElementById('btnAutoTry').disabled = true;
  log('── Starting Auto-Detection ──', 'warn');

  for (const c of combos) {
    if (ua && ua.isRegistered()) {
      log('🎉 Already registered!', 'success');
      break;
    }
    unregister();
    await new Promise(r => setTimeout(r, 400));

    register(c.domain, c.ext, c.auth, c.pwd);

    const result = await new Promise(resolve => {
      let resolved = false;
      const t = setTimeout(() => { if (!resolved) { resolved = true; resolve('timeout'); } }, 4000);

      const check = setInterval(() => {
        if (ua && ua.isRegistered()) {
          clearInterval(check);
          clearTimeout(t);
          if (!resolved) { resolved = true; resolve('ok'); }
        }
      }, 150);

      const prevHandler = ua.listeners('registrationFailed')[0];
      ua.removeAllListeners('registrationFailed');
      ua.on('registrationFailed', e => {
        if (prevHandler) prevHandler(e);
        clearInterval(check);
        clearTimeout(t);
        if (!resolved) { resolved = true; resolve('failed'); }
      });
    });

    if (result === 'ok') {
      log(`🎉 SUCCESS: sip:${c.ext}@${c.domain}`, 'success');
      document.getElementById('sipDomain').value = c.domain;
      document.getElementById('extNumber').value = c.ext;
      document.getElementById('extPassword').value = c.pwd;
      document.getElementById('btnAutoTry').disabled = false;
      return;
    }

    log(`↳ Trying next combination...`, 'info');
    unregister();
    await new Promise(r => setTimeout(r, 500));
  }

  log('── All combinations tested. See SIP challenge details above. ──', 'error');
  document.getElementById('btnAutoTry').disabled = false;
}

// Bound here rather than in onclick="" attributes: the page is served under a
// Content-Security-Policy without 'unsafe-inline' (nginx/security-headers.inc).
// Each handler is called with no arguments, as the attributes did.
;[
  ["btnDismissError", () => ErrorController.dismiss()],
  ["btnMic", () => testMic()],
  ["btnRegister", () => register()],
  ["btnAutoTry", () => autoTry()],
  ["btnAnswer", () => answer()],
  ["btnHangup", () => hangup()],
  ["btnUnreg", () => unregister()],
].forEach(([id, handler]) => document.getElementById(id).addEventListener("click", handler))
