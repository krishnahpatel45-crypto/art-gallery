// ============================================
// Art Gallary — Storefront Logic
// ============================================
const $ = id => document.getElementById(id);
const NO_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#EAE5D9"/><text x="50%" y="50%" font-family="sans-serif" font-size="18" fill="#b03324" text-anchor="middle" dy=".3em">No Image</text></svg>');

let DB = { products: [], categories: [], exhibitions: [], awards: [], heroImage: '' };
let currentUser = null;
let searchTerm = '';
let activeProduct = null;
let pmPhotos = [];
let pmRating = 5;
let selectedAddressId = null;
let paymentMethod = 'COD';
let pendingAddressForCheckout = false;
let editingAddressId = null;
let pendingSignup = false;

const ORDER_FLOW = ['Placed', 'Packed', 'Shipped', 'Delivered'];

// ===== Utilities =====
function inr(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function stars(r) { const n = Math.round(r || 0); return '★'.repeat(n) + '☆'.repeat(5 - n); }
function avgRating(p) { const r = (p.reviews || []).filter(x => !x.isHidden); if (!r.length) return 0; return r.reduce((s, x) => s + (x.rating || 5), 0) / r.length; }
function imgOf(o) { return (o && o.photos && o.photos.length) ? o.photos[0] : NO_IMG; }
function dateStr(ts) { return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
function showMsg(msg) {
  const b = $('msgBox');
  b.innerText = msg;
  b.classList.remove('hidden');
  requestAnimationFrame(() => b.classList.remove('opacity-0', 'translate-y-4'));
  clearTimeout(b._t);
  b._t = setTimeout(() => {
    b.classList.add('opacity-0', 'translate-y-4');
    setTimeout(() => b.classList.add('hidden'), 300);
  }, 2800);
}

// ===== Cart / Wishlist (local + server sync) =====
function getCart() { return JSON.parse(localStorage.getItem('ag_cart') || '[]'); }
function setCart(c) { localStorage.setItem('ag_cart', JSON.stringify(c)); }
function getWishlist() { return JSON.parse(localStorage.getItem('ag_wishlist') || '[]'); }
function setWishlist(w) { localStorage.setItem('ag_wishlist', JSON.stringify(w)); }

function cartTotals() {
  const c = getCart();
  const subtotal = c.reduce((s, i) => s + i.price * i.qty, 0);
  return { subtotal, total: subtotal, count: c.reduce((s, i) => s + i.qty, 0) };
}

function updateBadges() {
  const t = cartTotals();
  const cb = $('cartBadge');
  cb.innerText = t.count;
  cb.classList.toggle('hidden', t.count === 0);
  const wc = getWishlist().length;
  const wb = $('wishBadge');
  wb.innerText = wc;
  wb.classList.toggle('hidden', wc === 0);
}

function addToCart(id, size, qty) {
  const p = DB.products.find(x => x._id === id);
  if (!p) return;
  size = size || (p.sizes && p.sizes[0]) || 'Standard';
  qty = qty || 1;
  const cart = getCart();
  const ex = cart.find(c => c.product === id && c.size === size);
  if (ex) ex.qty += qty;
  else cart.push({ product: id, title: p.title, price: p.price, size, qty, photo: imgOf(p) });
  setCart(cart);
  syncCartToServer();
  renderCart(); updateBadges();
  showMsg('Added to cart');
}

function syncCartToServer() {
  if (!currentUser) return;
  API.put('/auth/sync', { cart: getCart(), wishlist: getWishlist() }).catch(() => {});
}

function removeFromCart(i) { const c = getCart(); c.splice(i, 1); setCart(c); syncCartToServer(); renderCart(); updateBadges(); }
function changeQty(i, d) {
  const c = getCart();
  if (!c[i]) return;
  c[i].qty += d;
  if (c[i].qty < 1) c.splice(i, 1);
  setCart(c); syncCartToServer(); renderCart(); updateBadges();
}

function renderCart() {
  const cart = getCart();
  const el = $('cartItemsContainer');
  const t = cartTotals();
  $('cartSubtotal').innerText = inr(t.subtotal);
  $('cartTotalDisplay').innerText = inr(t.total);
  if (!cart.length) {
    el.innerHTML = '<div class="h-full flex flex-col items-center justify-center text-center opacity-60 py-16"><span class="text-5xl mb-4">🛒</span><p class="text-sm font-bold">Your cart is empty</p></div>';
    return;
  }
  el.innerHTML = cart.map((it, i) => `
    <div class="flex gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
      <img src="${esc(it.photo)}" class="w-20 h-20 object-cover rounded-xl" onerror="this.src='${NO_IMG}'"/>
      <div class="flex-1 min-w-0">
        <h4 class="text-sm font-bold clamp-2">${esc(it.title)}</h4>
        <p class="text-[10px] text-gray-400 mt-0.5">Size: ${esc(it.size)}</p>
        <div class="flex items-center justify-between mt-2">
          <div class="flex items-center border rounded-full">
            <button onclick="changeQty(${i},-1)" class="w-7 h-7 font-bold">−</button>
            <span class="w-7 text-center text-xs font-bold">${it.qty}</span>
            <button onclick="changeQty(${i},1)" class="w-7 h-7 font-bold">+</button>
          </div>
          <span class="font-bold text-sm">${inr(it.price * it.qty)}</span>
        </div>
      </div>
      <button onclick="removeFromCart(${i})" class="text-gray-300 hover:text-red-500">&times;</button>
    </div>`).join('');
}

// ===== Shop / Products =====
function getFilteredProducts() {
  const cat = $('categoryFilter').value;
  const sort = $('sortSelect').value;
  let list = DB.products.slice();
  if (cat !== 'All') list = list.filter(p => p.category === cat);
  if (searchTerm) list = list.filter(p =>
    (p.title || '').toLowerCase().includes(searchTerm) ||
    (p.category || '').toLowerCase().includes(searchTerm) ||
    (p.desc || '').toLowerCase().includes(searchTerm));
  switch (sort) {
    case 'new': list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
    case 'low': list.sort((a,b) => a.price - b.price); break;
    case 'high': list.sort((a,b) => b.price - a.price); break;
    case 'rating': list.sort((a,b) => avgRating(b) - avgRating(a)); break;
    default: list.sort((a,b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  }
  return list;
}

function productCard(p) {
  const wl = getWishlist();
  const saved = wl.includes(p._id);
  const rating = avgRating(p);
  const reviewCount = (p.reviews || []).filter(r => !r.isHidden).length;
  const discount = p.mrp && p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0;
  const isAdmin = currentUser && (currentUser.role === 'owner' || currentUser.role === 'mod');
  return `
    <div class="bg-white rounded-3xl shadow-card border border-gray-100 overflow-hidden flex flex-col group hover:shadow-xl transition-all">
      <div class="relative h-56 overflow-hidden bg-warli-sand/40 cursor-pointer" onclick="openProductModal('${p._id}')">
        <img src="${esc(imgOf(p))}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" onerror="this.src='${NO_IMG}'"/>
        <span class="absolute top-3 left-3 bg-white/95 text-[9px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest">${esc(p.category)}</span>
        ${discount ? `<span class="absolute top-3 right-12 bg-warli-red text-white text-[9px] font-bold px-2.5 py-1.5 rounded-full">-${discount}%</span>` : ''}
        <button onclick="toggleWishlist('${p._id}', event)" class="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/95 shadow-sm flex items-center justify-center text-sm ${saved ? 'text-warli-red' : 'text-gray-300'}">${saved ? '♥' : '♡'}</button>
        ${p.stock <= 0 ? '<div class="absolute inset-0 bg-black/50 flex items-center justify-center"><span class="bg-white text-[10px] font-bold px-4 py-2 rounded-full uppercase">Sold Out</span></div>' : ''}
      </div>
      <div class="p-4 flex-1 flex flex-col">
        <div class="flex items-center gap-1.5 mb-1.5">
          <span class="text-[11px] text-warli-gold">${stars(rating)}</span>
          <span class="text-[10px] text-gray-400">${reviewCount ? `(${reviewCount})` : '(New)'}</span>
        </div>
        <h4 class="font-bold text-[15px] leading-snug clamp-2 cursor-pointer hover:text-warli-red" onclick="openProductModal('${p._id}')">${esc(p.title)}</h4>
        <div class="flex items-end gap-2 mt-2 mb-3">
          <span class="font-title font-bold text-lg">${inr(p.price)}</span>
          ${p.mrp && p.mrp > p.price ? `<span class="text-xs text-gray-400 line-through">${inr(p.mrp)}</span>` : ''}
        </div>
        <div class="mt-auto flex gap-2">
          <button onclick="openProductModal('${p._id}')" class="flex-1 text-[10px] uppercase bg-gray-100 hover:bg-gray-200 px-3 py-3 rounded-xl font-bold">View</button>
          <button onclick="quickAdd('${p._id}', event)" ${p.stock <= 0 ? 'disabled' : ''} class="flex-1 text-[10px] uppercase ${p.stock <= 0 ? 'bg-gray-200 text-gray-400' : 'bg-warli-red hover:bg-warli-darkRed text-white'} px-3 py-3 rounded-xl font-bold">${p.stock <= 0 ? 'Sold' : 'Add'}</button>
        </div>
      </div>
    </div>`;
}

function quickAdd(id, e) { if (e) e.stopPropagation(); addToCart(id); }

function renderShop() {
  const list = getFilteredProducts();
  $('productCount').innerText = `${list.length} Item${list.length !== 1 ? 's' : ''}`;
  $('productsGrid').innerHTML = list.map(productCard).join('');
  $('emptyShop').classList.toggle('hidden', list.length > 0);
  renderCategoryChips();
}

function renderCategoryChips() {
  const cur = $('categoryFilter').value;
  const counts = {};
  DB.products.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
  const chips = ['All', ...DB.categories.filter(c => counts[c])];
  $('categoryChips').innerHTML = chips.map(c => `
    <button onclick="setCategory('${esc(c)}')" class="shrink-0 px-5 py-2.5 rounded-full text-xs font-bold uppercase border ${cur === c ? 'bg-warli-charcoal text-white' : 'bg-white text-gray-500 hover:border-warli-red hover:text-warli-red'}">
      ${esc(c)}${c !== 'All' && counts[c] ? ` <span class="opacity-50">${counts[c]}</span>` : ''}
    </button>`).join('');
}

function setCategory(c) { $('categoryFilter').value = c; renderShop(); }
function scrollToGrid() { $('productsGrid').scrollIntoView({ behavior: 'smooth' }); }
function onSearch(mobile) {
  searchTerm = (mobile ? $('searchInputM') : $('searchInput')).value.trim().toLowerCase();
  if (mobile) $('searchInput').value = $('searchInputM').value;
  else $('searchInputM').value = $('searchInput').value;
  renderShop();
}

function toggleWishlist(id, e) {
  if (e) e.stopPropagation();
  if (!currentUser) { openLoginModal(); showMsg('Log in to save'); return; }
  let wl = getWishlist();
  const i = wl.indexOf(id);
  if (i > -1) { wl.splice(i, 1); showMsg('Removed from wishlist'); }
  else { wl.push(id); showMsg('Saved to wishlist ♥'); }
  setWishlist(wl);
  syncCartToServer();
  updateBadges(); renderShop(); renderWishlist();
  if (activeProduct && activeProduct._id === id) renderProductModal(id);
}

function renderWishlist() {
  const wl = getWishlist();
  const items = DB.products.filter(p => wl.includes(p._id));
  const g = $('wishlistGrid');
  if (!items.length) { g.innerHTML = '<div class="col-span-full text-center py-20 opacity-60"><div class="text-5xl mb-4">♡</div><p class="font-bold">Wishlist empty</p></div>'; return; }
  g.innerHTML = items.map(productCard).join('');
}

// ===== Product Modal =====
function openProductModal(id) {
  const p = DB.products.find(x => x._id === id);
  if (!p) return;
  activeProduct = p;
  pmRating = 5;
  renderProductModal(id);
  $('productModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeProductModal() {
  $('productModal').classList.add('hidden');
  document.body.style.overflow = '';
  activeProduct = null;
}

function renderProductModal(id) {
  const p = DB.products.find(x => x._id === id);
  if (!p) return;
  const photos = (p.photos && p.photos.length) ? p.photos : [NO_IMG];
  pmPhotos = photos;
  const rating = avgRating(p);
  const reviews = (p.reviews || []).filter(r => (currentUser && (currentUser.role === 'owner' || currentUser.role === 'mod')) || !r.isHidden);
  const saved = getWishlist().includes(p._id);
  const discount = p.mrp && p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0;

  $('productModalBody').innerHTML = `
    <div class="grid lg:grid-cols-2 gap-8">
      <div>
        <div class="relative rounded-3xl overflow-hidden bg-warli-sand/40 aspect-[4/3]">
          <img id="pmMain" src="${esc(photos[0])}" class="w-full h-full object-cover" onerror="this.src='${NO_IMG}'"/>
          <button onclick="toggleWishlist('${p._id}', event)" class="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/95 shadow-md flex items-center justify-center text-xl ${saved ? 'text-warli-red' : 'text-gray-300'}">${saved ? '♥' : '♡'}</button>
        </div>
        ${photos.length > 1 ? `<div class="flex gap-2.5 mt-3 overflow-x-auto hide-scrollbar pb-1">${photos.map((ph,i) => `<img src="${esc(ph)}" onclick="pmSetImageIndex(${i},this)" class="pm-thumb w-20 h-20 object-cover rounded-2xl border-2 cursor-pointer ${i === 0 ? 'thumb-active' : 'border-transparent'}" onerror="this.style.display='none'"/>`).join('')}</div>` : ''}
      </div>
      <div class="flex flex-col">
        <span class="text-[10px] font-bold uppercase tracking-widest text-warli-red">${esc(p.category)}</span>
        <h2 class="font-title text-2xl sm:text-3xl font-bold mt-2">${esc(p.title)}</h2>
        <div class="flex items-center gap-2 mt-3">
          <span class="text-warli-gold text-sm">${stars(rating)}</span>
          <span class="text-xs text-gray-500">${rating ? rating.toFixed(1) : 'No ratings'} · ${reviews.length} review${reviews.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="flex items-end gap-3 mt-5">
          <span class="font-title font-bold text-3xl">${inr(p.price)}</span>
          ${p.mrp && p.mrp > p.price ? `<span class="text-base text-gray-400 line-through">${inr(p.mrp)}</span>` : ''}
        </div>
        <p class="text-sm text-gray-500 leading-relaxed mt-5">${esc(p.desc || 'Authentic handmade Warli artwork.')}</p>
        ${p.sizes && p.sizes.length ? `<div class="mt-6"><p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Select Size</p><div class="flex flex-wrap gap-2">${p.sizes.map((s,i) => `<button onclick="pmSelectSize(this)" data-size="${esc(s)}" class="pm-size px-4 py-2.5 rounded-xl border-2 text-xs font-bold ${i === 0 ? 'border-warli-red bg-warli-red/5 text-warli-red' : 'border-gray-200 text-gray-600'}">${esc(s)}</button>`).join('')}</div></div>` : ''}
        <div class="mt-6 flex items-center gap-5">
          <div>
            <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Quantity</p>
            <div class="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden">
              <button onclick="pmQty(-1)" class="w-10 h-11 font-bold">−</button>
              <span id="pmQty" class="w-10 text-center text-sm font-bold">1</span>
              <button onclick="pmQty(1)" class="w-10 h-11 font-bold">+</button>
            </div>
          </div>
          <div class="pt-6">${p.stock > 0 ? `<span class="status-dot bg-green-500"></span><span class="text-xs font-bold text-green-600 ml-1.5">In Stock (${p.stock})</span>` : `<span class="status-dot bg-red-500"></span><span class="text-xs font-bold text-red-600 ml-1.5">Out of Stock</span>`}</div>
        </div>
        <div class="flex gap-3 mt-7">
          <button onclick="pmAddToCart()" ${p.stock <= 0 ? 'disabled' : ''} class="flex-1 ${p.stock <= 0 ? 'bg-gray-200 text-gray-400' : 'bg-warli-charcoal hover:bg-black text-white'} py-4 rounded-2xl font-bold uppercase text-xs">Add to Cart</button>
          <button onclick="pmBuyNow()" ${p.stock <= 0 ? 'disabled' : ''} class="flex-1 ${p.stock <= 0 ? 'bg-gray-200 text-gray-400' : 'bg-warli-red hover:bg-warli-darkRed text-white'} py-4 rounded-2xl font-bold uppercase text-xs">Buy Now</button>
        </div>
        <div class="grid grid-cols-3 gap-2 mt-6 text-center">
          <div class="bg-gray-50 rounded-2xl py-3"><div class="text-lg">🚚</div><p class="text-[9px] font-bold text-gray-500 mt-1">All India</p></div>
          <div class="bg-gray-50 rounded-2xl py-3"><div class="text-lg">🎨</div><p class="text-[9px] font-bold text-gray-500 mt-1">Handmade</p></div>
          <div class="bg-gray-50 rounded-2xl py-3"><div class="text-lg">🎁</div><p class="text-[9px] font-bold text-gray-500 mt-1">Gift Ready</p></div>
        </div>
      </div>
    </div>
    <div class="mt-10 border-t pt-8">
      <h3 class="font-bold text-lg mb-5">Customer Reviews</h3>
      <div class="space-y-3 max-h-80 overflow-y-auto hide-scrollbar">
        ${reviews.length ? reviews.map(r => `
          <div class="bg-gray-50 p-4 rounded-2xl border ${r.isHidden ? 'opacity-50' : ''}">
            <div class="flex items-center gap-2">
              <span class="font-bold text-sm">${esc(r.author)}</span>
              <span class="text-warli-gold text-[11px]">${stars(r.rating)}</span>
              <span class="text-[10px] text-gray-400">${r.date ? dateStr(r.date) : ''}</span>
            </div>
            <p class="text-gray-600 text-sm mt-1.5">${esc(r.text)}</p>
          </div>`).join('') : '<p class="text-sm text-gray-400 text-center py-6">No reviews yet</p>'}
      </div>
    </div>`;
  setTimeout(() => pmSetRating(5), 30);
}

function pmSetImageIndex(i, el) {
  const src = pmPhotos[i]; if (!src) return;
  $('pmMain').src = src;
  document.querySelectorAll('.pm-thumb').forEach(t => t.classList.remove('thumb-active'));
  if (el) el.classList.add('thumb-active');
}
function pmSelectSize(el) {
  document.querySelectorAll('.pm-size').forEach(b => { b.classList.remove('border-warli-red', 'bg-warli-red/5', 'text-warli-red'); b.classList.add('border-gray-200', 'text-gray-600'); });
  el.classList.remove('border-gray-200', 'text-gray-600');
  el.classList.add('border-warli-red', 'bg-warli-red/5', 'text-warli-red');
}
function pmQty(d) {
  const el = $('pmQty');
  let v = parseInt(el.innerText) + d;
  if (v < 1) v = 1;
  if (activeProduct && v > activeProduct.stock) v = activeProduct.stock;
  el.innerText = v;
}
function pmGetSize() {
  const el = document.querySelector('.pm-size.border-warli-red');
  if (el) return el.dataset.size;
  const f = document.querySelector('.pm-size');
  return f ? f.dataset.size : 'Standard';
}
function pmAddToCart() { if (!activeProduct) return; addToCart(activeProduct._id, pmGetSize(), parseInt($('pmQty').innerText) || 1); }
function pmBuyNow() { if (!activeProduct) return; pmAddToCart(); closeProductModal(); openCart(); }
function pmSetRating(n) {
  pmRating = n;
  document.querySelectorAll('.pm-star').forEach(s => s.style.opacity = parseInt(s.dataset.star) <= n ? '1' : '0.25');
}

// ===== Exhibitions / Awards =====
function renderExhibitions() {
  $('exhibitionsList').innerHTML = DB.exhibitions.map(e => `
    <div class="bg-white rounded-3xl shadow-soft border overflow-hidden">
      ${e.photos && e.photos.length ? `<img src="${esc(e.photos[0])}" class="w-full h-52 object-cover"/>` : ''}
      <div class="p-7">
        <div class="flex justify-between items-start mb-3 gap-3">
          <div>
            <h4 class="font-bold text-xl">${esc(e.title)}</h4>
            <p class="text-xs font-bold text-warli-red uppercase tracking-widest mt-1">${esc(e.date)}</p>
            ${e.venue ? `<p class="text-[11px] text-gray-400 mt-0.5">📍 ${esc(e.venue)}</p>` : ''}
          </div>
          <span class="text-[9px] uppercase font-bold ${e.type === 'Upcoming' ? 'bg-warli-red text-white' : 'bg-gray-100 text-gray-500'} px-3 py-1.5 rounded-full">${esc(e.type)}</span>
        </div>
        <p class="text-sm text-gray-500">${esc(e.details)}</p>
      </div>
    </div>`).join('') || '<p class="col-span-full text-center text-gray-400 py-16">No exhibitions yet.</p>';
}

function renderAwards() {
  $('awardsList').innerHTML = DB.awards.map(a => `
    <div class="bg-white rounded-3xl shadow-soft border overflow-hidden relative">
      ${a.photos && a.photos.length ? `<img src="${esc(a.photos[0])}" class="w-full h-48 object-cover"/>` : ''}
      <div class="p-7 relative">
        <div class="absolute -top-6 right-7 bg-white p-3 rounded-2xl shadow-md text-2xl border">🏆</div>
        <h4 class="font-bold text-xl mt-3">${esc(a.title)}</h4>
        <p class="text-[10px] font-bold text-warli-red uppercase tracking-widest mb-3">${esc(a.year)}${a.by ? ' · ' + esc(a.by) : ''}</p>
        <p class="text-sm text-gray-500">${esc(a.details)}</p>
      </div>
    </div>`).join('') || '<p class="col-span-full text-center text-gray-400 py-16">No awards yet.</p>';
}

// ===== Orders =====
async function renderOrders() {
  const list = $('ordersList');
  if (!currentUser) {
    list.innerHTML = '<div class="text-center py-20 opacity-60"><div class="text-5xl mb-4">📦</div><p class="font-bold">Please log in to view orders</p><button onclick="openLoginModal()" class="mt-5 bg-warli-charcoal text-white px-7 py-3.5 rounded-full text-[10px] font-bold uppercase">Log In</button></div>';
    return;
  }
  try {
    const orders = await API.get('/orders/my');
    if (!orders.length) {
      list.innerHTML = '<div class="text-center py-20 opacity-60"><div class="text-5xl mb-4">🛍️</div><p class="font-bold">No orders yet</p></div>';
      return;
    }
    list.innerHTML = orders.map(o => {
      const stepIdx = ORDER_FLOW.indexOf(o.status);
      const statusColor = o.status === 'Pending Approval' ? 'bg-amber-100 text-amber-700' :
        o.status === 'Delivered' ? 'bg-green-100 text-green-700' :
        o.status === 'Rejected' || o.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
        'bg-warli-red/10 text-warli-red';
      return `
        <div class="bg-white rounded-3xl border shadow-soft overflow-hidden">
          <div class="flex flex-wrap justify-between items-center gap-3 px-6 py-4 bg-gray-50/70 border-b">
            <div><p class="text-[10px] font-bold text-gray-400 uppercase">Order ID</p><p class="text-sm font-bold font-mono">#${o._id.slice(-8)}</p></div>
            <div><p class="text-[10px] font-bold text-gray-400 uppercase">Placed</p><p class="text-sm font-bold">${dateStr(o.createdAt)}</p></div>
            <div><p class="text-[10px] font-bold text-gray-400 uppercase">Total</p><p class="text-sm font-bold font-title">${inr(o.total)}</p></div>
            <span class="text-[10px] font-bold uppercase px-3.5 py-2 rounded-full ${statusColor}">${esc(o.status)}</span>
          </div>
          <div class="p-6 space-y-4">
            ${o.status === 'Pending Approval' ? '<div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-[11px] text-amber-800">⏳ Waiting for owner approval. You\'ll be notified once reviewed.</div>' : ''}
            ${o.status === 'Rejected' ? `<div class="bg-red-50 border border-red-200 rounded-2xl p-3 text-[11px] text-red-800"><b>Rejected:</b> ${esc(o.rejectionReason || 'No reason')}</div>` : ''}
            ${o.status !== 'Cancelled' && o.status !== 'Rejected' && o.status !== 'Pending Approval' ? `<div class="flex items-center">${ORDER_FLOW.map((s,i) => `
              <div class="flex items-center ${i < ORDER_FLOW.length - 1 ? 'flex-1' : ''}">
                <div class="flex flex-col items-center">
                  <div class="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${i <= stepIdx ? 'bg-warli-red text-white' : 'bg-gray-200 text-gray-400'}">${i <= stepIdx ? '✓' : i + 1}</div>
                  <span class="text-[9px] font-bold uppercase mt-1.5 ${i <= stepIdx ? 'text-warli-red' : 'text-gray-400'}">${s}</span>
                </div>
                ${i < ORDER_FLOW.length - 1 ? `<div class="flex-1 h-1 mx-1.5 rounded ${i < stepIdx ? 'bg-warli-red' : 'bg-gray-200'}"></div>` : ''}
              </div>`).join('')}</div>` : ''}
            <div class="space-y-2.5">
              ${o.items.map(it => `
                <div class="flex gap-3 items-center">
                  <img src="${esc(it.photo)}" class="w-14 h-14 object-cover rounded-xl" onerror="this.src='${NO_IMG}'"/>
                  <div class="flex-1"><p class="text-sm font-bold clamp-1">${esc(it.title)}</p><p class="text-[10px] text-gray-400">Size ${esc(it.size)} · Qty ${it.qty}</p></div>
                  <span class="font-bold text-sm font-title">${inr(it.price * it.qty)}</span>
                </div>`).join('')}
            </div>
            <div class="bg-gray-50 rounded-2xl p-4 text-xs">
              <p class="font-bold mb-1">Delivering to</p>
              <p>${esc(o.address.name)} · ${esc(o.address.phone)}</p>
              <p>${esc(o.address.line1)}, ${esc(o.address.city)} — ${esc(o.address.pincode)}</p>
            </div>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    list.innerHTML = `<p class="text-center text-red-500 py-10">${esc(e.message)}</p>`;
  }
}

// ===== Checkout =====
function openCart() { $('cartModal').classList.remove('hidden'); renderCart(); }
function closeCart() { $('cartModal').classList.add('hidden'); }

function openCheckout() {
  if (!currentUser) { closeCart(); openLoginModal(); showMsg('Please log in to checkout'); return; }
  const cart = getCart();
  if (!cart.length) return showMsg('Cart is empty');
  closeCart();
  const def = currentUser.addresses?.find(a => a.isDefault) || currentUser.addresses?.[0];
  selectedAddressId = def ? def._id : null;
  renderCheckoutAddresses(); renderCheckoutSummary(); renderPayOptions();
  $('checkoutModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeCheckout() { $('checkoutModal').classList.add('hidden'); document.body.style.overflow = ''; }

function renderCheckoutAddresses() {
  const el = $('checkoutAddressList');
  const addrs = currentUser.addresses || [];
  if (!addrs.length) { el.innerHTML = '<p class="text-xs text-gray-400 bg-gray-50 p-4 rounded-2xl text-center">No addresses. Add one below.</p>'; return; }
  el.innerHTML = addrs.map(a => `
    <label class="cursor-pointer flex gap-3 items-start p-4 rounded-2xl border-2 ${selectedAddressId === a._id ? 'border-warli-red bg-warli-red/5' : 'border-gray-200'}">
      <input type="radio" name="chkAddr" ${selectedAddressId === a._id ? 'checked' : ''} onchange="selectedAddressId='${a._id}'; renderCheckoutAddresses();" class="mt-1 accent-warli-red"/>
      <div class="flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-bold text-sm">${esc(a.name)}</span>
          <span class="text-[9px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">${esc(a.label)}</span>
          ${a.isDefault ? '<span class="text-[9px] bg-warli-red/10 text-warli-red px-2 py-0.5 rounded-full">Default</span>' : ''}
        </div>
        <p class="text-xs text-gray-500 mt-1">${esc(a.line1)}, ${esc(a.city)}, ${esc(a.state)} — ${esc(a.pincode)}</p>
        <p class="text-xs text-gray-400">📞 ${esc(a.phone)}</p>
      </div>
    </label>`).join('');
}

function renderPayOptions() {
  const sel = document.querySelector('input[name="payMethod"]:checked');
  paymentMethod = sel ? sel.value : 'COD';
  document.querySelectorAll('.pay-opt').forEach(l => {
    const on = l.querySelector('input').checked;
    l.classList.toggle('border-warli-red', on);
    l.classList.toggle('bg-warli-red/5', on);
    l.classList.toggle('border-gray-200', !on);
  });
}

function renderCheckoutSummary() {
  const cart = getCart();
  const t = cartTotals();
  $('checkoutSummary').innerHTML = cart.map(i => `
    <div class="flex justify-between text-sm">
      <span class="text-gray-600">${esc(i.title)} × ${i.qty}</span>
      <span class="font-bold">${inr(i.price * i.qty)}</span>
    </div>`).join('') + `
    <div class="border-t border-dashed pt-3 mt-2 flex justify-between items-end">
      <span class="text-xs text-gray-400 uppercase font-bold">Total</span>
      <span class="text-xl font-bold font-title">${inr(t.total)}</span>
    </div>`;
}

async function placeOrder() {
  if (!currentUser) return openLoginModal();
  const addr = (currentUser.addresses || []).find(a => a._id === selectedAddressId);
  if (!addr) return showMsg('Select a delivery address');
  const cart = getCart();
  if (!cart.length) return showMsg('Cart empty');
  const t = cartTotals();

  const btn = $('placeOrderBtn');
  btn.disabled = true; btn.innerText = 'Processing…';

  try {
    if (paymentMethod === 'WHATSAPP') {
      const lines = cart.map(i => `• ${i.title} (${i.size}) × ${i.qty} — ${inr(i.price * i.qty)}`).join('\n');
      const msg = `🛍️ *New Order — Art Gallary*\n\n${lines}\n\n*Total:* ${inr(t.total)}\n\n*Deliver to:*\n${addr.name}\n${addr.line1}\n${addr.city}, ${addr.state} — ${addr.pincode}\n📞 ${addr.phone}`;
      window.open(`https://wa.me/${CONFIG.OWNER_PHONE}?text=${encodeURIComponent(msg)}`, '_blank');
      await createOrder(cart, addr, 'WHATSAPP', null);
      return;
    }

    if (paymentMethod === 'ONLINE' && typeof Razorpay !== 'undefined') {
      let rzpOrderId = null;
      try {
        const r = await API.post('/payment/create-order', { amount: t.total });
        rzpOrderId = r.id;
      } catch (e) { console.warn('Razorpay order backend failed'); }

      const options = {
        key: CONFIG.RAZORPAY_KEY_ID,
        amount: Math.round(t.total * 100),
        currency: CONFIG.CURRENCY,
        name: CONFIG.SHOP_NAME,
        description: `${cart.length} item(s)`,
        order_id: rzpOrderId || undefined,
        prefill: { name: addr.name, email: currentUser.email, contact: addr.phone },
        theme: { color: '#b03324' },
        handler: async (response) => { await createOrder(cart, addr, 'ONLINE', response.razorpay_payment_id); },
        modal: { ondismiss: () => { btn.disabled = false; btn.innerText = 'Place Order Request'; showMsg('Payment cancelled'); } }
      };
      new Razorpay(options).open();
      return;
    }

    await createOrder(cart, addr, 'COD', null);
  } catch (e) {
    btn.disabled = false; btn.innerText = 'Place Order Request';
    showMsg('❌ ' + e.message);
  }
}

async function createOrder(cart, addr, payment, paymentId) {
  try {
    await API.post('/orders', {
      items: cart.map(i => ({ product: i.product, title: i.title, price: i.price, size: i.size, qty: i.qty, photo: i.photo })),
      address: { name: addr.name, phone: addr.phone, line1: addr.line1, city: addr.city, state: addr.state, pincode: addr.pincode, label: addr.label },
      payment, razorpayPaymentId: paymentId
    });
    setCart([]);
    syncCartToServer();
    updateBadges(); renderCart();
    closeCheckout();
    switchView('orders');
    showMsg('🎉 Order request sent! Awaiting owner approval.');
  } catch (e) {
    showMsg('❌ ' + e.message);
  } finally {
    const btn = $('placeOrderBtn');
    if (btn) { btn.disabled = false; btn.innerText = 'Place Order Request'; }
  }
}

// ===== Addresses =====
function openAddressForm(forCheckout) {
  if (!currentUser) return openLoginModal();
  pendingAddressForCheckout = !!forCheckout;
  editingAddressId = null;
  ['adName','adPhone','adLine1','adCity','adState','adPincode'].forEach(id => $(id).value = '');
  $('adLabel').value = 'Home'; $('adDefault').checked = false;
  if (currentUser.name) $('adName').value = currentUser.name;
  if (currentUser.phone) $('adPhone').value = currentUser.phone;
  $('addressModal').classList.remove('hidden');
}
function closeAddressForm() { $('addressModal').classList.add('hidden'); }

async function saveAddress() {
  const data = {
    name: $('adName').value.trim(), phone: $('adPhone').value.trim(),
    line1: $('adLine1').value.trim(), city: $('adCity').value.trim(),
    state: $('adState').value.trim(), pincode: $('adPincode').value.trim(),
    label: $('adLabel').value, isDefault: $('adDefault').checked
  };
  if (!data.name || !data.phone || !data.line1 || !data.city || !data.state || !data.pincode)
    return showMsg('Fill all fields');
  if (!/^\d{6}$/.test(data.pincode)) return showMsg('PIN must be 6 digits');
  try {
    let addrs;
    if (editingAddressId) addrs = await API.put('/auth/addresses/' + editingAddressId, data);
    else addrs = await API.post('/auth/addresses', data);
    currentUser.addresses = addrs;
    if (!selectedAddressId && addrs.length) selectedAddressId = addrs[addrs.length - 1]._id;
    closeAddressForm(); renderAddresses(); renderCheckoutAddresses();
    showMsg('Address saved ✓');
    if (pendingAddressForCheckout) { $('checkoutModal').classList.remove('hidden'); pendingAddressForCheckout = false; }
  } catch (e) { showMsg('❌ ' + e.message); }
}

function renderAddresses() {
  const el = $('addressList');
  if (!currentUser) return;
  const addrs = currentUser.addresses || [];
  if (!addrs.length) { el.innerHTML = '<p class="text-xs text-gray-400 bg-gray-50 p-5 rounded-2xl text-center">No addresses yet.</p>'; return; }
  el.innerHTML = addrs.map(a => `
    <div class="flex gap-3 items-start p-4 rounded-2xl border bg-gray-50/60">
      <div class="flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-bold text-sm">${esc(a.name)}</span>
          <span class="text-[9px] bg-white text-gray-500 border px-2 py-0.5 rounded-full">${esc(a.label)}</span>
          ${a.isDefault ? '<span class="text-[9px] bg-warli-red/10 text-warli-red px-2 py-0.5 rounded-full">Default</span>' : ''}
        </div>
        <p class="text-xs text-gray-500 mt-1.5">${esc(a.line1)}, ${esc(a.city)}, ${esc(a.state)} — ${esc(a.pincode)}</p>
        <p class="text-xs text-gray-400 mt-0.5">📞 ${esc(a.phone)}</p>
      </div>
      <div class="flex flex-col gap-1.5">
        <button onclick="editAddress('${a._id}')" class="text-[9px] font-bold uppercase bg-white border px-3 py-1.5 rounded-lg">Edit</button>
        <button onclick="deleteAddress('${a._id}')" class="text-[9px] font-bold uppercase bg-red-50 text-red-600 px-3 py-1.5 rounded-lg">Delete</button>
      </div>
    </div>`).join('');
}

function editAddress(id) {
  const a = (currentUser.addresses || []).find(x => x._id === id);
  if (!a) return;
  editingAddressId = id;
  $('adName').value = a.name; $('adPhone').value = a.phone; $('adLine1').value = a.line1;
  $('adCity').value = a.city; $('adState').value = a.state; $('adPincode').value = a.pincode;
  $('adLabel').value = a.label; $('adDefault').checked = !!a.isDefault;
  $('addressModal').classList.remove('hidden');
}

async function deleteAddress(id) {
  if (!confirm('Delete this address?')) return;
  try {
    const addrs = await API.del('/auth/addresses/' + id);
    currentUser.addresses = addrs;
    if (selectedAddressId === id) selectedAddressId = addrs[0] ? addrs[0]._id : null;
    renderAddresses(); renderCheckoutAddresses(); showMsg('Address deleted');
  } catch (e) { showMsg('❌ ' + e.message); }
}

// ===== Profile =====
function renderProfile() {
  if (!currentUser) return;
  $('pfName').value = currentUser.name || '';
  $('pfPhone').value = currentUser.phone || '';
  $('pfEmail').value = currentUser.email;
  renderAddresses();
  API.get('/orders/my').then(orders => {
    const spent = orders.reduce((s, o) => s + o.total, 0);
    $('activitySummary').innerHTML = `
      <div class="bg-gray-50 rounded-2xl py-5"><p class="text-2xl font-bold font-title">${orders.length}</p><p class="text-[9px] font-bold uppercase text-gray-400 mt-1">Orders</p></div>
      <div class="bg-gray-50 rounded-2xl py-5"><p class="text-2xl font-bold font-title">${getWishlist().length}</p><p class="text-[9px] font-bold uppercase text-gray-400 mt-1">Wishlist</p></div>
      <div class="bg-gray-50 rounded-2xl py-5"><p class="text-2xl font-bold font-title">${inr(spent)}</p><p class="text-[9px] font-bold uppercase text-gray-400 mt-1">Spent</p></div>`;
  }).catch(() => {});
}

async function saveProfile() {
  try {
    const updated = await API.put('/auth/me', { name: $('pfName').value.trim(), phone: $('pfPhone').value.trim() });
    currentUser.name = updated.name;
    currentUser.phone = updated.phone;
    showMsg('Profile updated ✓');
    refreshAuthUI();
  } catch (e) { showMsg('❌ ' + e.message); }
}

// ===== Auth =====
function openLoginModal() { $('loginModal').classList.remove('hidden'); }
function closeLoginModal() { $('loginModal').classList.add('hidden'); }

async function emailAuth(mode) {
  const email = $('loginEmail').value.trim().toLowerCase();
  const pass = $('loginPassword').value.trim();
  const name = $('loginName')?.value.trim() || '';
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return showMsg('Enter a valid email');
  if (!pass || pass.length < 6) return showMsg('Password must be 6+ characters');

  try {
    let data;
    if (mode === 'signup') {
      if (!name) { $('signupNameWrap').classList.remove('hidden'); return showMsg('Enter your name, then click Sign Up again'); }
      data = await API.post('/auth/register', { name, email, password: pass, phone: $('loginPhone')?.value.trim() });
    } else {
      data = await API.post('/auth/login', { email, password: pass });
    }
    API.setToken(data.token);
    currentUser = data;
    // Merge local cart/wishlist with server
    const localCart = getCart();
    const localWl = getWishlist();
    if (localCart.length || localWl.length) {
      await API.put('/auth/sync', { cart: localCart, wishlist: localWl });
    } else {
      setCart(data.cart || []);
      setWishlist(data.wishlist || []);
    }
    closeLoginModal();
    $('loginEmail').value = ''; $('loginPassword').value = ''; $('loginName').value = '';
    $('signupNameWrap').classList.add('hidden');
    refreshAuthUI(); renderAll();
    showMsg(`✅ Welcome ${data.name}!`);
  } catch (e) { showMsg('❌ ' + e.message); }
}

function handleLogout() {
  API.clearToken();
  currentUser = null;
  setCart([]); setWishlist([]);
  refreshAuthUI(); renderAll(); switchView('shop');
  showMsg('Logged out');
}

function refreshAuthUI() {
  const btn = $('authBtn');
  const menu = $('accountMenu');
  const adminBtns = [$('menuAdminBtn'), $('adminNavBtn')];
  const teamTab = $('teamTabBtn');
  if (currentUser) {
    btn.innerText = currentUser.name.split(' ')[0].toUpperCase();
    btn.classList.add('bg-warli-red');
    btn.classList.remove('bg-warli-charcoal');
    $('accName').innerText = currentUser.name;
    $('accEmail').innerText = currentUser.email;
    $('accRole').innerText = currentUser.role === 'owner' ? 'Gallery Owner' : currentUser.role === 'mod' ? 'Moderator' : 'Customer';
    const isAdmin = currentUser.role === 'owner' || currentUser.role === 'mod';
    adminBtns.forEach(b => b && b.classList.toggle('hidden', !isAdmin));
    if (teamTab) teamTab.classList.toggle('hidden', currentUser.role !== 'owner');
    $('adminRoleTag').innerText = isAdmin ? (currentUser.role === 'owner' ? 'Full Owner Access' : 'Moderator Access') : '';
  } else {
    btn.innerText = 'Log In';
    btn.classList.remove('bg-warli-red');
    btn.classList.add('bg-warli-charcoal');
    menu.classList.add('hidden');
    adminBtns.forEach(b => b && b.classList.add('hidden'));
    if (teamTab) teamTab.classList.add('hidden');
  }
}

function toggleAccountMenu() {
  if (!currentUser) { openLoginModal(); return; }
  $('accountMenu').classList.toggle('hidden');
}
function closeAccountMenu() { $('accountMenu').classList.add('hidden'); }

document.addEventListener('click', e => {
  const menu = $('accountMenu');
  const btn = $('authBtn');
  if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target) && !btn.contains(e.target))
    menu.classList.add('hidden');
});

// ===== View switching =====
function switchView(view) {
  ['shop','exhibitions','awards','orders','wishlist','profile'].forEach(v => {
    const el = $(v + 'View');
    if (el) el.classList.toggle('hidden', v !== view);
  });
  ['shop','exhibitions','awards','orders'].forEach(id => {
    const btn = $('nav-' + id);
    if (!btn) return;
    btn.classList.toggle('text-warli-red', id === view);
    btn.classList.toggle('text-gray-400', id !== view);
  });
  if (view === 'orders') renderOrders();
  if (view === 'wishlist') renderWishlist();
  if (view === 'profile') renderProfile();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function changeLanguage(code) {
  const sel = document.querySelector('.goog-te-combo');
  if (sel) { sel.value = code; sel.dispatchEvent(new Event('change')); }
}

// ===== Data loading =====
async function loadAll() {
  try {
    const [products, cats, ex, aw, hero] = await Promise.all([
      API.get('/products'),
      API.get('/categories'),
      API.get('/exhibitions'),
      API.get('/awards'),
      API.get('/settings/hero').catch(() => ({ heroImage: '' }))
    ]);
    DB.products = products;
    DB.categories = cats.map(c => c.name);
    DB.exhibitions = ex;
    DB.awards = aw;
    DB.heroImage = hero.heroImage;
    if (hero.heroImage) $('heroImage').src = hero.heroImage;
  } catch (e) { console.warn('Load error:', e); }
}

async function tryRestoreSession() {
  const token = API.getToken();
  if (!token) return;
  try {
    const me = await API.get('/auth/me');
    currentUser = me;
    if (me.cart) setCart(me.cart);
    if (me.wishlist) setWishlist(me.wishlist);
  } catch (e) { API.clearToken(); }
}

function renderAll() {
  renderShop();
  renderExhibitions();
  renderAwards();
  renderWishlist();
  renderCart();
  updateBadges();
  refreshAuthUI();
  if (currentUser) renderProfile();
}

async function init() {
  await loadAll();
  await tryRestoreSession();
  renderAll();
  switchView('shop');

  // refresh products every 60s
  setInterval(async () => { await loadAll(); renderShop(); }, 60000);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeProductModal(); closeCart(); closeCheckout(); closeLoginModal(); closeAddressForm(); }
  });

  $('cloudStatus')?.classList.remove('hidden');
}

init();
