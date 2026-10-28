const dotenv = require('dotenv');
dotenv.config();

const User = require('./models/User');
const Product = require('./models/Product');
const Category = require('./models/Category');
const Exhibition = require('./models/Exhibition');
const Award = require('./models/Award');
const Settings = require('./models/Settings');
const connectDB = require('./config/db');

const seedDatabase = async ({ reset = false } = {}) => {
  const [userCount, productCount, categoryCount, exhibitionCount, awardCount, settingsCount] = await Promise.all([
    User.countDocuments(),
    Product.countDocuments(),
    Category.countDocuments(),
    Exhibition.countDocuments(),
    Award.countDocuments(),
    Settings.countDocuments()
  ]);

  const hasData = userCount > 0 || productCount > 0 || categoryCount > 0 || exhibitionCount > 0 || awardCount > 0 || settingsCount > 0;
  if (!reset && hasData) {
    console.log('Database already contains seed data; skipping bootstrap.');
    return false;
  }

  if (reset) {
    await Promise.all([
      User.deleteMany(),
      Product.deleteMany(),
      Category.deleteMany(),
      Exhibition.deleteMany(),
      Award.deleteMany(),
      Settings.deleteMany()
    ]);
  }

  const ownerEmail = process.env.OWNER_EMAIL || 'owner@chikhli.art';
  await User.create({ name: 'Gallery Owner', email: ownerEmail, password: 'owner123', role: 'owner', phone: '+91 79847 39473' });
  await User.create({ name: 'Gallery Moderator', email: 'mod@chikhli.art', password: 'mod123', role: 'mod' });

  const cats = ['Canvas Painting', 'Round Canvas', 'Wall Art', 'Fabric Art', 'Home Decor', 'Other'];
  for (const name of cats) await Category.create({ name });

  const imgs = [
    'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&q=80',
    'https://images.unsplash.com/photo-1578321272176-b7bbc0679853?w=800&q=80',
    'https://images.unsplash.com/photo-1580136579312-94651dfd596d?w=800&q=80',
    'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&q=80',
    'https://images.unsplash.com/photo-1515405295579-ba7b45403062?w=800&q=80',
    'https://images.unsplash.com/photo-1578926375605-eaf7559b1458?w=800&q=80'
  ];

  const products = [
    { title: 'Maha Warli Gram Sanskruti', category: 'Canvas Painting', price: 18500, mrp: 24000, stock: 3, featured: true, desc: 'A sprawling village-scene composition depicting the traditional Tarpa dance.', sizes: ['24x36', '30x48'], photos: [imgs[0], imgs[3]] },
    { title: 'Tribal Pride Feathers', category: 'Wall Art', price: 8200, mrp: 9900, stock: 6, featured: true, desc: 'Contemporary Warli interpretation of tribal headgear.', sizes: ['18x24'], photos: [imgs[1]] },
    { title: 'Tarpa Dance Circle', category: 'Round Canvas', price: 11500, mrp: 0, stock: 2, desc: 'Circular canvas capturing the hypnotic spiral of the Tarpa dance.', sizes: ['24 inch'], photos: [imgs[2]] },
    { title: 'Harvest Season Storyboard', category: 'Canvas Painting', price: 24000, mrp: 28500, stock: 1, featured: true, desc: 'Large-format narrative painting of the agricultural cycle.', sizes: ['36x48'], photos: [imgs[3]] },
    { title: 'Warli Motif Cushion Set', category: 'Fabric Art', price: 2400, mrp: 3200, stock: 14, desc: 'Set of two hand-block printed cotton cushion covers.', sizes: ['16x16'], photos: [imgs[4]] },
    { title: 'Chauk Ritual Square', category: 'Other', price: 6700, mrp: 0, stock: 5, desc: 'Sacred Chauk square at the heart of Warli weddings.', sizes: ['12x12'], photos: [imgs[5]] }
  ];

  for (const p of products) await Product.create(p);

  await Exhibition.create({ title: 'Gujarat Kala Mahotsav', date: 'Dec 2026', venue: 'Navsari Art Centre', type: 'Upcoming', details: 'Annual state-level art showcase.', photos: [imgs[2]] });
  await Exhibition.create({ title: 'Tribal Roots — Retrospective', date: 'Mar 2025', venue: 'Ahmedabad', type: 'Past', details: 'A retrospective of three decades.', photos: [imgs[0]] });

  await Award.create({ title: 'Gujarat Sahitya Akademi Award', year: '2019', by: 'Gujarat Sahitya Akademi', details: 'Outstanding contribution to tribal art.', photos: [imgs[1]] });
  await Award.create({ title: 'National Tribal Art Excellence', year: '2022', by: 'Ministry of Tribal Affairs', details: 'Excellence in traditional Warli painting.', photos: [] });

  await Settings.create({ key: 'heroImage', value: 'https://images.unsplash.com/photo-1578321272176-b7bbc0679853?w=1600&q=80' });

  console.log('✅ Data seeded successfully');
  return true;
};

if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      await seedDatabase({ reset: true });
      process.exit(0);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  })();
}

module.exports = seedDatabase;
