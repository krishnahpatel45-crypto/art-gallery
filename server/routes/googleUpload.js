const router = require('express').Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cloudinary = require('cloudinary').v2; // reads CLOUDINARY_URL
const { OAuth2Client } = require('google-auth-library');

const gClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const OWNER = (process.env.OWNER_EMAIL || '').toLowerCase();
const MODS = (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
const roleFor = e => e === OWNER ? 'owner' : MODS.includes(e) ? 'mod' : 'customer';

router.get('/auth/config', (q, s) => s.json({ googleClientId: process.env.GOOGLE_CLIENT_ID }));

router.post('/auth/google', async (req, res) => {
  try {
    const t = await gClient.verifyIdToken({ idToken: req.body.credential, audience: process.env.GOOGLE_CLIENT_ID });
    const p = t.getPayload();
    if (!p.email_verified) throw new Error('unverified');
    const email = p.email.toLowerCase();
    const user = { email, name: p.name || email.split('@')[0], role: roleFor(email) };
    res.cookie('session', jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '7d' }), {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 864e5
    });
    res.json({ user });
  } catch { res.status(401).json({ message: 'Google sign-in failed' }); }
});

router.post('/auth/logout', (q, s) => { s.clearCookie('session'); s.json({ ok: true }); });

function adminOnly(req, res, next) {
  try {
    const u = jwt.verify(req.cookies.session, process.env.JWT_SECRET);
    if (!['owner', 'mod'].includes(u.role)) throw new Error('no');
    next();
  } catch { res.status(403).json({ message: 'Please log in with Google as admin' }); }
}

const upload = multer({
  storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (q, f, cb) => cb(null, /^image\//.test(f.mimetype))
});
const oneImage = (req, res, next) =>
  upload.single('image')(req, res, e => e ? res.status(400).json({ message: 'Image must be under 5MB' }) : next());

router.post('/upload', adminOnly, oneImage, async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Choose an image file' });
  try {
    const url = await new Promise((ok, no) =>
      cloudinary.uploader.upload_stream(
        { folder: 'art-gallary', transformation: [{ width: 1600, crop: 'limit', quality: 'auto' }] },
        (e, r) => e ? no(e) : ok(r.secure_url)
      ).end(req.file.buffer));
    res.json({ url });
  } catch { res.status(500).json({ message: 'Upload failed' }); }
});

module.exports = router;