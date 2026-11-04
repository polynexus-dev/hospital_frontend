# Security headers for every response nginx serves (WASA / OWASP A05).
#
# nginx drops ALL inherited add_header lines in any block that sets one of
# its own, so this file is included in the server block AND in every
# location that adds a header (app.inc). Without that, index.html and
# /assets/ were served with none of these, HSTS included.
#
# Content-Security-Policy, by directive:
#   script-src 'self'      no inline script, no eval: an injected <script> or
#                          onclick="" never runs (the main XSS backstop)
#   style-src              'unsafe-inline' for React style props and libraries
#                          that inject <style>; Google Fonts' stylesheet
#   img-src                data: (QR codes), blob: (previews), https: (logos)
#   connect-src            the API (same origin), wss:/ws: for the SIP
#                          softphone's PBX socket, blob:/data: for 3D models
#   frame-src              blob: (PDF previews), https: (the video-consult room)
#   frame-ancestors 'self' the app can't be framed by another site (clickjacking)
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' blob: data: wss: ws:; frame-src 'self' blob: https:; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'" always;
add_header X-Content-Type-Options nosniff always;
add_header X-Frame-Options SAMEORIGIN always;
add_header Referrer-Policy strict-origin-when-cross-origin always;
# camera/microphone deliberately not listed: naming them would stop the
# embedded video-consult room (another origin) from being granted them.
add_header Permissions-Policy "geolocation=(), payment=(), usb=(), serial=(), bluetooth=()" always;
add_header Cross-Origin-Opener-Policy same-origin always;
# $hsts is set in https.conf.
add_header Strict-Transport-Security $hsts always;
