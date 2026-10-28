// ============================================
// Art Gallary — Admin Dashboard Logic
// ============================================
let newProductPhotos = [];
let newExhibitionPhotos = [];
let newAwardPhotos = [];
let editingProductId = null;
let approvalOrderId = null;

function isAdmin() { return currentUser && (currentUser.role === 'owner' || currentUser.role === 'mod'); }
function isOwner() { return currentUser && currentUser.role === 'owner'; }

async function openAdmin() {
  if (!isAdmin()) return showMsg('Admin access required');
  $('adminModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  await setAdminTab('approvals');
  refreshApprovalBadge();
}
function closeAdmin() { $('adminModal').classList.add('hidden'); document.body.style.overflow = ''; }

async function setAdminTab(tab) {
  ['approvals','product','exhibition','award','hero','category','orders','team'].forEach(t => {
    const panel = $('panel-' + t);
    const btn = document.querySelector(`.admin-tab[data-atab="${t}"]`);
    if (!panel) return;
    const active = t === tab;
    panel.classList.toggle('hidden', !active);
    if (btn) {
      btn.className = 'admin-tab flex-1 whitespace-nowrap text-xs px-5 py-3 rounded-full font-bold transition-colors ' +
        (active ? 'bg-warli-charcoal text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100');
      if (t === 'team' && !isOwner()) btn.classList.add('hidden');
    }
  });
  if (tab === 'approvals') await renderApprovals();
  if (tab === 'orders') await renderAdminOrders();
  if (tab === 'category') await renderCategoryList();
  if (tab === 'team') { await renderMods(); await renderAnalytics(); }
  if (tab === 'hero') renderHeroSettings();
  if (tab === 'product') await renderAdminProducts();
}

async function openApprovals() {
  if (!isAdmin()) return showMsg('Admin access required');
  $('adminModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  await setAdminTab('approvals');
}
function closeApprovalModal() { $('approvalModal').classList.add('hidden'); approvalOrderId = null; }

async function refreshApprovalBadge() {
  if (!isAdmin()) return;
  try {
    const pending = await API.get('/orders/pending');
    const badge = $('approvalBadge');
    if (pending.length) { badge.innerText = pending.length; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
  } catch (e) {}
}

async function renderApprovals() {
  const el = $('approvalsList');
  el.innerHTML = '<p class="text-sm text-gray-400 text-center py-10">Loading…</p>';
  try {
    const orders = await API.get('/orders/pending');
    $('pendingCount').innerText = `${orders.length} Pending`;
    refreshApprovalBadge();
    if (!orders.length) {
      el.innerHTML = '<p class="text-sm text-gray-400 text-center py-10">✅ No pending approvals. All caught up!</p>';
      return;
    }
    el.innerHTML = orders.map(o => `
      <div class="border-2 border-amber-200 bg-amber-50/40 rounded-2xl overflow-hidden">
        <div class="flex flex-wrap justify-between items-center gap-3 px-5 py-3.5 bg-amber-100/60 border-b border-amber-200">
          <div><p class="text-[10px] font-bold text-amber-700 uppercase">Order</p><p class="text-sm font-bold font-mono">#${o._id.slice(-8)}</p></div>
          <div class="min-w-0"><p class="text-[10px] font-bold text-amber-700 uppercase">Customer</p><p class="text-sm font-bold truncate">${esc(o.userName)} <span class="text-amber-600 font-normal">· ${esc(o.userEmail)}</span></p></div>
          <div><p class="text-[10px] font-bold text-amber-700 uppercase">Total</p><p class="text-sm font-bold font-title">${inr(o.total)}</p></div>
          <span class="text-[10px] font-bold uppercase bg-amber-200 text-amber-800 px-3 py-1.5 rounded-full">⏳ Pending</span>
        </div>
        <div class="p-5 space-y-3">
          <div class="grid sm:grid-cols-2 gap-3">
            <div class="bg-white rounded-xl p-3 border">
              <p class="text-[10px] font-bold text-gray-400 uppercase">Delivery Address</p>
              <p class="text-xs mt-1 font-bold">${esc(o.address.name)} · ${esc(o.address.phone)}</p>
              <p class="text-xs text-gray-500">${esc(o.address.line1)}, ${esc(o.address.city)}, ${esc(o.address.state)} — ${esc(o.address.pincode)}</p>
            </div>
            <div class="bg-white rounded-xl p-3 border">
              <p class="text-[10px] font-bold text-gray-400 uppercase">Payment & Date</p>
              <p class="text-xs mt-1 font-bold">${esc(o.payment)}${o.razorpayPaymentId ? ' · Paid' : ''}</p>
              <p class="text-xs text-gray-500">${dateStr(o.createdAt)}</p>
            </div>
          </div>
          <div class="space-y-2">
            ${o.items.map(it => `
              <div class="flex gap-3 items-center bg-white p-2.5 rounded-xl border">
                <img src="${esc(it.photo)}" class="w-12 h-12 object-cover rounded-lg" onerror="this.src='${NO_IMG}'"/>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-bold clamp-1">${esc(it.title)}</p>
                  <p class="text-[10px] text-gray-400">Size ${esc(it.size)} · Qty ${it.qty}</p>
                </div>
                <span class="text-sm font-bold font-title">${inr(it.price * it.qty)}</span>
              </div>`).join('')}
          </div>
          <div class="flex flex-col sm:flex-row gap-3 pt-2">
            <button onclick="approveOrder('${o._id}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-3.5 rounded-xl font-bold uppercase tracking-widest text-xs shadow-md">✅ Approve Order</button>
            <button onclick="openRejectModal('${o._id}')" class="flex-1 bg-red-100 hover:bg-red-200 text-red-700 py-3.5 rounded-xl font-bold uppercase tracking-widest text-xs">❌ Reject</button>
          </div>
        </div>
      </div>`).join('');
  } catch (e) { el.innerHTML = `<p class="text-sm text-red-500 text-center py-10">${esc(e.message)}</p>`; }
}

async function approveOrder(id) {
  if (!confirm('Approve this order? Stock will be reserved.')) return;
  try {
    await API.put('/orders/' + id + '/approve');
    showMsg('✅ Order approved');
    await renderApprovals();
    await renderAdminOrders();
  } catch (e) { showMsg('❌ ' + e.message); }
}

function openRejectModal(id) {
  approvalOrderId = id;
  $('approvalModalBody').innerHTML = `
    <p class="text-sm text-gray-600 mb-3">Reject this order request? The customer will see your reason in their orders page.</p>
    <label class="lbl">Reason for Rejection</label>
    <textarea id="rejectReason" rows="4" class="inp resize-none" placeholder="e.g. Out of stock, shipping not available to this pincode…"></textarea>
    <div class="flex gap-3 mt-5">
      <button onclick="closeApprovalModal()" class="flex-1 bg-gray-100 hover:bg-gray-200 py-3.5 rounded-2xl font-bold uppercase text-xs">Cancel</button>
      <button onclick="confirmReject()" class="flex-1 bg-red-600 hover:bg-red-700 text-white py-3.5 rounded-2xl font-bold uppercase text-xs">Confirm Reject</button>
    </div>`;
  $('approvalModal').classList.remove('hidden');
}

async function confirmReject() {
  const reason = $('rejectReason').value.trim() || 'No reason provided';
  try {
    await API.put('/orders/' + approvalOrderId + '/reject', { reason });
    closeApprovalModal();
    showMsg('Order rejected');
    await renderApprovals();
    await renderAdminOrders();
  } catch (e) { showMsg('❌ ' + e.message); }
}

// ===== Products =====
async function renderAdminProducts() {
  const el = $('adminProductsList');
  el.innerHTML = '<p class="text-sm text-gray-400 text-center py-10">Loading…</p>';
  try {
    const products = await API.get('/products');
    $('adminProductCount').innerText = `${products.length} Item${products.length !== 1 ? 's' : ''}`;
    if (!products.length) { el.innerHTML = '<p class="text-sm text-gray-400 text-center py-10">No products yet.</p>'; return; }
    el.innerHTML = products.map(p => `
      <div class="flex gap-3 items-center bg-gray-50 p-3 rounded-2xl border">
        <img src="${esc(imgOf(p))}" class="w-16 h-16 object-cover rounded-xl" onerror="this.src='${NO_IMG}'"/>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold clamp-1">${esc(p.title)}</p>
          <p class="text-[10px] text-gray-400 uppercase mt-0.5">${esc(p.category)} · Stock: ${p.stock}</p>
          <p class="text-sm font-bold text-warli-red font-title mt-1">${inr(p.price)}</p>
        </div>
        <div class="flex flex-col gap-1.5">
          <button onclick="editProduct('${p._id}')" class="text-[10px] font-bold uppercase bg-blue-100 text-blue-700 px-3 py-2 rounded-lg">✏️ Edit</button>
          <button onclick="adminDeleteProduct('${p._id}')" class="text-[10px] font-bold uppercase bg-red-50 text-red-600 px-3 py-2 rounded-lg">🗑 Delete</button>
        </div>
      </div>`).join('');
  } catch (e) { el.innerHTML = `<p class="text-sm text-red-500 text-center py-10">${esc(e.message)}</p>`; }
}

async function adminDeleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  try { await API.del('/products/' + id); showMsg('Product deleted'); await renderAdminProducts(); await loadAll(); renderShop(); }
  catch (e) { showMsg('❌ ' + e.message); }
}

function addPhotoUrl() {
  const v = $('pPhotoUrl').value.trim();
  if (!v || !/^https?:\/\//.test(v)) return showMsg('Enter valid URL starting with http');
  newProductPhotos.push(v);
  $('pPhotoUrl').value = '';
  renderPhotoPreviews('product');
  showMsg('Photo added');
}
function addPhotoUrlTo(bucket) {
  const el = $(bucket === 'exhibition' ? 'ePhotoUrl' : 'aPhotoUrl');
  const v = el.value.trim();
  if (!v || !/^https?:\/\//.test(v)) return showMsg('Enter valid URL');
  const arr = bucket === 'exhibition' ? newExhibitionPhotos : newAwardPhotos;
  arr.push(v); el.value = '';
  renderPhotoPreviews(bucket);
  showMsg('Photo added');
}
function removePhoto(bucket, i) {
  const arr = bucket === 'product' ? newProductPhotos : bucket === 'exhibition' ? newExhibitionPhotos : newAwardPhotos;
  arr.splice(i, 1);
  renderPhotoPreviews(bucket);
}
function renderPhotoPreviews(bucket) {
  const arr = bucket === 'product' ? newProductPhotos : bucket === 'exhibition' ? newExhibitionPhotos : newAwardPhotos;
  const el = $(bucket === 'product' ? 'pPreview' : bucket === 'exhibition' ? 'ePreview' : 'aPreview');
  if (!el) return;
  el.innerHTML = arr.map((src, i) => `
    <div class="relative rounded-xl overflow-hidden border-2 ${i === 0 ? 'border-warli-red' : 'border-gray-200'} aspect-square bg-gray-50">
      <img src="${esc(src)}" class="w-full h-full object-cover"/>
      <button type="button" onclick="removePhoto('${bucket}',${i})" class="absolute top-1 right-1 bg-black/60 text-white w-5 h-5 rounded-full text-[10px]">&times;</button>
    </div>`).join('');
}

async function saveProduct(e) {
  e.preventDefault();
  const photos = newProductPhotos.slice();
  if (!photos.length && editingProductId) {
    const p = DB.products.find(x => x._id === editingProductId);
    if (p) photos.push(...(p.photos || []));
  }
  const sizes = $('pSizes').value.split(',').map(s => s.trim()).filter(Boolean);
  const payload = {
    title: $('pTitle').value.trim(),
    category: $('pCategory').value,
    price: Number($('pPrice').value),
    mrp: Number($('pMrp').value) || 0,
    stock: Number($('pStock').value) || 0,
    desc: $('pDesc').value.trim(),
    sizes,
    photos: photos.length ? photos : ['https://i.imgur.com/placeholder.jpg']
  };
  try {
    if (editingProductId) await API.put('/products/' + editingProductId, payload);
    else await API.post('/products', payload);
    showMsg(editingProductId ? 'Artwork updated' : 'Artwork published 🎉');
    resetProductForm();
    await renderAdminProducts();
    await loadAll(); renderShop();
    closeAdmin(); switchView('shop');
  } catch (e) { showMsg('❌ ' + e.message); }
}

function resetProductForm() {
  editingProductId = null;
  newProductPhotos = [];
  $('adminProductForm').reset();
  $('productFormTitle').innerText = 'Publish New Artwork';
  $('productSubmitBtn').innerText = 'Publish Artwork';
  $('productCancelBtn').classList.add('hidden');
  renderPhotoPreviews('product');
}
function cancelEditProduct() { resetProductForm(); showMsg('Edit cancelled'); }

function editProduct(id) {
  const p = DB.products.find(x => x._id === id);
  if (!p) return;
  editingProductId = id;
  $('productFormTitle').innerText = 'Edit Artwork';
  $('productSubmitBtn').innerText = 'Update Artwork';
  $('productCancelBtn').classList.remove('hidden');
  $('pTitle').value = p.title;
  $('pCategory').value = p.category;
  $('pPrice').value = p.price;
  $('pMrp').value = p.mrp || '';
  $('pStock').value = p.stock || 0;
  $('pDesc').value = p.desc || '';
  $('pSizes').value = (p.sizes || []).join(', ');
  newProductPhotos = (p.photos || []).slice();
  renderPhotoPreviews('product');
  openAdmin().then(() => setAdminTab('product'));
}

async function refreshProductCategoryDropdown() {
  try {
    const cats = await API.get('/categories');
    const sel = $('pCategory');
    sel.innerHTML = '<option value="" disabled>Select</option>' + cats.map(c => `<option>${esc(c.name)}</option>`).join('');
    const filter = $('categoryFilter');
    const cur = filter.value;
    filter.innerHTML = '<option value="All">All Categories</option>' + cats.map(c => `<option>${esc(c.name)}</option>`).join('');
    if (cur) filter.value = cur;
  } catch (e) {}
}

// ===== Exhibitions & Awards =====
async function addExhibition(e) {
  e.preventDefault();
  try {
    await API.post('/exhibitions', {
      title: $('eTitle').value.trim(),
      date: $('eDate').value.trim(),
      venue: $('eVenue').value.trim(),
      type: $('eType').value,
      details: $('eDetails').value.trim(),
      photos: newExhibitionPhotos.slice()
    });
    newExhibitionPhotos = [];
    e.target.reset();
    renderPhotoPreviews('exhibition');
    showMsg('Exhibition added');
    await loadAll(); renderExhibitions();
    closeAdmin(); switchView('exhibitions');
  } catch (err) { showMsg('❌ ' + err.message); }
}

async function addAward(e) {
  e.preventDefault();
  try {
    await API.post('/awards', {
      title: $('aTitle').value.trim(),
      year: $('aYear').value.trim(),
      by: $('aBy').value.trim(),
      details: $('aDetails').value.trim(),
      photos: newAwardPhotos.slice()
    });
    newAwardPhotos = [];
    e.target.reset();
    renderPhotoPreviews('award');
    showMsg('Award added');
    await loadAll(); renderAwards();
    closeAdmin(); switchView('awards');
  } catch (err) { showMsg('❌ ' + err.message); }
}

// ===== Orders management =====
async function renderAdminOrders() {
  const el = $('adminOrdersList');
  el.innerHTML = '<p class="text-sm text-gray-400 text-center py-10">Loading…</p>';
  try {
    const orders = await API.get('/orders');
    if (!orders.length) { el.innerHTML = '<p class="text-sm text-gray-400 text-center py-10">No orders yet.</p>'; return; }
    const statuses = ['Pending Approval','Placed','Packed','Shipped','Delivered','Cancelled','Rejected'];
    el.innerHTML = orders.map(o => `
      <div class="border rounded-2xl overflow-hidden">
        <div class="flex flex-wrap justify-between items-center gap-3 px-5 py-3.5 bg-gray-50/70 border-b">
          <div><p class="text-[10px] font-bold text-gray-400 uppercase">Order</p><p class="text-sm font-bold font-mono">#${o._id.slice(-8)}</p></div>
          <div class="min-w-0"><p class="text-[10px] font-bold text-gray-400 uppercase">Customer</p><p class="text-sm font-bold truncate">${esc(o.userName)} · ${esc(o.userEmail)}</p></div>
          <div><p class="text-[10px] font-bold text-gray-400 uppercase">Total</p><p class="text-sm font-bold font-title">${inr(o.total)}</p></div>
          ${o.status === 'Pending Approval' ? `<button onclick="approveOrder('${o._id}')" class="text-[10px] font-bold uppercase bg-green-600 text-white px-3 py-2 rounded-lg">✅ Approve</button>` : ''}
          ${o.status === 'Pending Approval' ? `<button onclick="openRejectModal('${o._id}')" class="text-[10px] font-bold uppercase bg-red-100 text-red-700 px-3 py-2 rounded-lg">❌ Reject</button>` : ''}
          <select onchange="updateOrderStatus('${o._id}', this.value)" class="text-xs font-bold border rounded-xl px-3 py-2 bg-white">
            ${statuses.map(s => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="p-5 space-y-2.5">
          ${o.items.map(it => `<div class="flex justify-between text-sm"><span class="text-gray-600">${esc(it.title)} <span class="text-gray-400">× ${it.qty} (${esc(it.size)})</span></span><span class="font-bold">${inr(it.price * it.qty)}</span></div>`).join('')}
          <p class="text-[11px] text-gray-400 pt-2 border-t border-dashed mt-2">${esc(o.address.name)}, ${esc(o.address.line1)}, ${esc(o.address.city)} — ${esc(o.address.pincode)} · ${esc(o.address.phone)} · ${esc(o.payment)} · ${dateStr(o.createdAt)}</p>
          ${o.rejectionReason ? `<p class="text-[11px] text-red-600">Rejected: ${esc(o.rejectionReason)}</p>` : ''}
        </div>
      </div>`).join('');
  } catch (e) { el.innerHTML = `<p class="text-sm text-red-500 text-center py-10">${esc(e.message)}</p>`; }
}

async function updateOrderStatus(id, status) {
  try { await API.put('/orders/' + id + '/status', { status }); showMsg(`Order → ${status}`); }
  catch (e) { showMsg('❌ ' + e.message); }
}

// ===== Categories =====
async function renderCategoryList() {
  const el = $('categoryList');
  el.innerHTML = '<p class="text-xs text-gray-400 text-center py-5">Loading…</p>';
  try {
    const cats = await API.get('/categories');
    const counts = {};
    DB.products.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
    el.innerHTML = cats.map(c => `
      <li class="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border gap-3">
        <div>
          <p class="font-bold text-sm">${esc(c.name)}</p>
          <p class="text-[11px] text-gray-500">${counts[c.name] || 0} product(s)</p>
        </div>
        <div class="flex gap-2">
          <button onclick="editCategory('${c._id}','${esc(c.name).replace(/'/g,"\\'")}')" class="text-[10px] font-bold uppercase bg-white border px-3 py-2 rounded-lg">Rename</button>
          <button onclick="deleteCategory('${c._id}')" class="text-[10px] font-bold uppercase bg-red-50 text-red-600 px-3 py-2 rounded-lg">Delete</button>
        </div>
      </li>`).join('') || '<p class="text-xs text-gray-400 text-center py-5">No categories.</p>';
  } catch (e) { el.innerHTML = `<p class="text-xs text-red-500 text-center py-5">${esc(e.message)}</p>`; }
}

async function addCategory() {
  const name = $('newCatName').value.trim();
  if (!name) return showMsg('Enter category name');
  try {
    await API.post('/categories', { name });
    $('newCatName').value = '';
    showMsg('Category added');
    await renderCategoryList();
    await refreshProductCategoryDropdown();
    await loadAll(); renderShop();
  } catch (e) { showMsg('❌ ' + e.message); }
}

async function editCategory(id, oldName) {
  const newName = prompt('Rename category:', oldName);
  if (!newName || newName === oldName) return;
  try {
    await API.put('/categories/' + id, { name: newName.trim() });
    showMsg('Renamed');
    await renderCategoryList();
    await refreshProductCategoryDropdown();
    await loadAll(); renderShop();
  } catch (e) { showMsg('❌ ' + e.message); }
}

async function deleteCategory(id) {
  if (!confirm('Delete this category?')) return;
  try {
    await API.del('/categories/' + id);
    showMsg('Category deleted');
    await renderCategoryList();
    await refreshProductCategoryDropdown();
    await loadAll(); renderShop();
  } catch (e) { showMsg('❌ ' + e.message); }
}

// ===== Moderators =====
async function renderMods() {
  const el = $('modList');
  if (!isOwner()) { el.innerHTML = ''; return; }
  try {
    const mods = await API.get('/users/mods');
    el.innerHTML = mods.map(m => `
      <li class="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border gap-3">
        <div><p class="font-bold text-sm">${esc(m.name)}</p><p class="text-[11px] text-gray-500">${esc(m.email)}</p></div>
        <button onclick="removeMod('${m._id}')" class="text-red-500 bg-red-50 px-4 py-2 rounded-xl text-[10px] font-bold uppercase">Revoke</button>
      </li>`).join('') || '<p class="text-xs text-gray-400 bg-gray-50 p-5 rounded-2xl text-center">No moderators yet.</p>';
  } catch (e) { el.innerHTML = `<p class="text-xs text-red-500 text-center py-3">${esc(e.message)}</p>`; }
}

async function addMod() {
  if (!isOwner()) return showMsg('Owner only');
  const email = $('newModEmail').value.trim().toLowerCase();
  const pass = $('newModPass').value.trim() || 'mod123';
  if (!/^\S+@\S+\.\S+$/.test(email)) return showMsg('Valid email required');
  try {
    await API.post('/users/mods', { email, password: pass });
    $('newModEmail').value = ''; $('newModPass').value = '';
    showMsg('Moderator authorised');
    await renderMods();
  } catch (e) { showMsg('❌ ' + e.message); }
}

async function removeMod(id) {
  if (!confirm('Revoke moderator access?')) return;
  try { await API.del('/users/mods/' + id); showMsg('Revoked'); await renderMods(); }
  catch (e) { showMsg('❌ ' + e.message); }
}

// ===== Analytics =====
async function renderAnalytics() {
  const el = $('analyticsGrid');
  try {
    const orders = await API.get('/orders').catch(() => []);
    const customers = await API.get('/users/customers').catch(() => []);
    const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
    const pending = orders.filter(o => o.status === 'Pending Approval').length;
    el.innerHTML = `
      <div class="bg-gradient-to-br from-warli-red to-warli-darkRed text-white rounded-2xl p-5 text-center shadow-md">
        <div class="text-xl font-bold font-title">${inr(totalRevenue)}</div>
        <div class="text-[9px] uppercase font-bold mt-1.5 opacity-70">Revenue</div>
      </div>
      <div class="bg-gradient-to-br from-gray-800 to-black text-white rounded-2xl p-5 text-center shadow-md">
        <div class="text-xl font-bold font-title">${orders.length}</div>
        <div class="text-[9px] uppercase font-bold mt-1.5 opacity-70">Orders</div>
      </div>
      <div class="bg-white border rounded-2xl p-5 text-center">
        <div class="text-xl font-bold font-title">${customers.length}</div>
        <div class="text-[9px] uppercase font-bold mt-1.5 text-gray-400">Customers</div>
      </div>
      <div class="bg-white border rounded-2xl p-5 text-center">
        <div class="text-xl font-bold font-title">${pending}</div>
        <div class="text-[9px] uppercase font-bold mt-1.5 text-gray-400">Pending</div>
      </div>`;
  } catch (e) {}
}

// ===== Hero =====
function renderHeroSettings() {
  $('heroCurrentPreview').src = DB.heroImage || '';
  $('hPhotoUrl').value = '';
}

async function saveHeroImage() {
  if (!isAdmin()) return showMsg('Admin access required');
  const url = $('hPhotoUrl').value.trim();
  if (!url || !/^https?:\/\//.test(url)) return showMsg('Enter valid URL');
  try {
    await API.put('/settings/hero', { heroImage: url });
    DB.heroImage = url;
    $('heroImage').src = url;
    renderHeroSettings();
    showMsg('Hero updated');
  } catch (e) { showMsg('❌ ' + e.message); }
}

async function resetHeroImage() {
  if (!confirm('Reset hero to default?')) return;
  const def = 'https://images.unsplash.com/photo-1578321272176-b7bbc0679853?w=1600&q=80';
  try {
    await API.put('/settings/hero', { heroImage: def });
    DB.heroImage = def;
    $('heroImage').src = def;
    renderHeroSettings();
    showMsg('Hero reset');
  } catch (e) { showMsg('❌ ' + e.message); }
}

// ===== Bootstrap =====
document.addEventListener('DOMContentLoaded', () => {
  // Poll for pending approvals every 30s
  setInterval(() => { if (isAdmin()) refreshApprovalBadge(); }, 30000);
  setTimeout(() => { if (isAdmin()) refreshApprovalBadge(); }, 2000);

  refreshProductCategoryDropdown().catch(() => {});
});
