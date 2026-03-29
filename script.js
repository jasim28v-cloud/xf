// ========== إعدادات الأدمن (ضع بريدك لتصبح مديراً) ==========
const ADMIN_EMAILS = ['your-email@example.com']; // غيّره لبريدك
let isAdmin = false;

// ========== المتغيرات العامة ==========
let currentUser = null;
let currentUserData = null;
let allUsers = {};
let allPosts = [];
let allStories = [];
let currentChatUserId = null;
let selectedPostMedia = null;
let selectedMediaType = null;

// ========== دوال المصادقة ==========
function switchAuth(type) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.getElementById(type + 'Form').classList.add('active');
}

async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const msg = document.getElementById('loginMsg');
    if (!email || !password) { msg.innerText = 'الرجاء ملء جميع الحقول'; return; }
    msg.innerText = 'جاري تسجيل الدخول...';
    try {
        await auth.signInWithEmailAndPassword(email, password);
        msg.innerText = '';
    } catch (error) {
        if (error.code === 'auth/user-not-found') msg.innerText = 'لا يوجد حساب';
        else if (error.code === 'auth/wrong-password') msg.innerText = 'كلمة المرور غير صحيحة';
        else msg.innerText = 'حدث خطأ';
    }
}

async function register() {
    const username = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPass').value;
    const msg = document.getElementById('regMsg');
    if (!username || !email || !password) { msg.innerText = 'املأ جميع الحقول'; return; }
    if (password.length < 6) { msg.innerText = 'كلمة المرور 6 أحرف على الأقل'; return; }
    msg.innerText = 'جاري إنشاء الحساب...';
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await db.ref(`users/${userCredential.user.uid}`).set({
            username, email, bio: '', avatarUrl: '', followers: {}, following: {}, createdAt: Date.now()
        });
        msg.innerText = '';
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') msg.innerText = 'البريد مستخدم';
        else msg.innerText = 'حدث خطأ';
    }
}

function logout() { auth.signOut(); location.reload(); }

// ========== تحميل البيانات ==========
async function loadUserData() {
    const snap = await db.ref(`users/${currentUser.uid}`).get();
    if (snap.exists()) currentUserData = { uid: currentUser.uid, ...snap.val() };
}

db.ref('users').on('value', s => { allUsers = s.val() || {}; });

// ========== عرض المنشورات ==========
db.ref('posts').on('value', (s) => {
    const data = s.val();
    if (!data) { allPosts = []; renderFeed(); return; }
    allPosts = [];
    Object.keys(data).forEach(key => allPosts.push({ id: key, ...data[key] }));
    allPosts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    renderFeed();
});

function renderFeed() {
    const container = document.getElementById('feedContainer');
    if (!container) return;
    container.innerHTML = '';
    if (allPosts.length === 0) { container.innerHTML = '<div class="loading">لا توجد منشورات بعد</div>'; return; }
    const followingIds = currentUserData?.following ? Object.keys(currentUserData.following) : [];
    const feedPosts = allPosts.filter(p => followingIds.includes(p.sender) || p.sender === currentUser?.uid);
    feedPosts.forEach(post => {
        const user = allUsers[post.sender] || { username: post.senderName || 'user', avatarUrl: '' };
        const isLiked = post.likedBy && post.likedBy[currentUser?.uid];
        const mediaHtml = post.mediaType === 'video' 
            ? `<video class="post-media" controls><source src="${post.mediaUrl}" type="video/mp4"></video>`
            : `<img class="post-media" src="${post.mediaUrl}" alt="post">`;
        const caption = addHashtags(post.caption || '');
        const div = document.createElement('div');
        div.className = 'post-card';
        div.innerHTML = `
            <div class="post-header">
                <div class="post-avatar" onclick="viewProfile('${post.sender}')">${user.avatarUrl ? `<img src="${user.avatarUrl}">` : (user.username?.charAt(0) || '👤')}</div>
                <div class="post-user" onclick="viewProfile('${post.sender}')">${user.username}</div>
            </div>
            ${mediaHtml}
            <div class="post-actions">
                <button class="action-btn like-btn ${isLiked ? 'active' : ''}" onclick="toggleLikePost('${post.id}', this)"><i class="fas fa-heart"></i><span>${post.likes || 0}</span></button>
                <button class="action-btn" onclick="openCommentsPost('${post.id}')"><i class="fas fa-comment"></i><span>${Object.keys(post.comments || {}).length}</span></button>
                <button class="action-btn" onclick="sharePost('${post.mediaUrl}')"><i class="fas fa-paper-plane"></i></button>
            </div>
            <div class="post-caption">${caption}</div>
            <div class="post-time">${new Date(post.timestamp).toLocaleString()}</div>
        `;
        container.appendChild(div);
    });
}

function addHashtags(text) {
    if (!text) return '';
    return text.replace(/#(\w+)/g, '<span class="hashtag" onclick="searchHashtag(\'$1\')">#$1</span>');
}
function searchHashtag(tag) { document.getElementById('searchInput').value = '#' + tag; openSearch(); searchAll(); }

// ========== الإعجاب ==========
async function toggleLikePost(postId, btn) {
    if (!currentUser) return;
    const postRef = db.ref(`posts/${postId}`);
    const snap = await postRef.get();
    const post = snap.val();
    let likes = post.likes || 0;
    let likedBy = post.likedBy || {};
    if (likedBy[currentUser.uid]) {
        likes--; delete likedBy[currentUser.uid];
    } else {
        likes++; likedBy[currentUser.uid] = true;
        await addNotification(post.sender, 'like', currentUser.uid);
    }
    await postRef.update({ likes, likedBy });
    btn.classList.toggle('active');
    btn.querySelector('span').innerText = likes;
}

// ========== التعليقات ==========
let currentPostId = null;
async function openCommentsPost(postId) {
    currentPostId = postId;
    const comments = await db.ref(`posts/${postId}/comments`).once('value');
    const list = comments.val() || {};
    const container = document.getElementById('commentsList') || (() => { const d=document.createElement('div'); d.id='commentsList'; return d; })();
    // يمكن عرض لوحة منبثقة بسيطة
    alert('ميزة التعليقات متاحة قريباً (سيتم إضافتها كاملة)');
}
async function addCommentToPost() { /* سيتم لاحقاً */ }

// ========== القصص ==========
db.ref('stories').on('value', async (s) => {
    const data = s.val();
    const now = Date.now();
    const activeStories = [];
    if (data) {
        Object.keys(data).forEach(key => {
            const story = data[key];
            if (story.timestamp && (now - story.timestamp) < 24*60*60*1000) activeStories.push({ id: key, ...story });
        });
    }
    renderStories(activeStories);
});
function renderStories(stories) {
    const container = document.getElementById('storiesContainer');
    if (!container) return;
    container.innerHTML = '';
    if (stories.length === 0) { container.innerHTML = '<div class="text-gray-400 text-sm">لا توجد قصص جديدة</div>'; return; }
    stories.forEach(story => {
        const user = allUsers[story.sender] || { username: 'user', avatarUrl: '' };
        const div = document.createElement('div');
        div.className = 'story-item';
        div.onclick = () => viewStory(story);
        div.innerHTML = `
            <div class="story-avatar">${user.avatarUrl ? `<img src="${user.avatarUrl}">` : (user.username?.charAt(0) || '👤')}</div>
            <div class="story-name">${user.username}</div>
        `;
        container.appendChild(div);
    });
}
function viewStory(story) { window.open(story.mediaUrl, '_blank'); }

// ========== إضافة منشور ==========
function openCreatePost() { document.getElementById('createPostPanel').classList.add('open'); }
function closeCreatePost() { document.getElementById('createPostPanel').classList.remove('open'); resetPostForm(); }
function resetPostForm() { selectedPostMedia = null; document.getElementById('postPreview').style.display = 'none'; document.getElementById('postCaption').value = ''; document.getElementById('postFileInput').value = ''; document.getElementById('postStatus').innerHTML = ''; }
function previewPostMedia(input) {
    const file = input.files[0];
    if (!file) return;
    selectedPostMedia = file;
    selectedMediaType = file.type.startsWith('video/') ? 'video' : 'image';
    const reader = new FileReader();
    reader.onload = e => {
        const previewDiv = document.getElementById('postPreview');
        const previewVideo = document.getElementById('previewVideo');
        const previewImage = document.getElementById('previewImage');
        if (selectedMediaType === 'video') {
            previewVideo.src = e.target.result;
            previewVideo.style.display = 'block';
            previewImage.style.display = 'none';
        } else {
            previewImage.src = e.target.result;
            previewImage.style.display = 'block';
            previewVideo.style.display = 'none';
        }
        previewDiv.style.display = 'block';
    };
    reader.readAsDataURL(file);
}
async function uploadPost() {
    if (!selectedPostMedia) { alert('اختر صورة أو فيديو'); return; }
    const caption = document.getElementById('postCaption').value;
    const statusDiv = document.getElementById('postStatus');
    statusDiv.innerHTML = 'جاري الرفع...';
    const fd = new FormData();
    fd.append('file', selectedPostMedia);
    fd.append('upload_preset', UPLOAD_PRESET);
    const resourceType = selectedMediaType === 'video' ? 'video' : 'image';
    fd.append('resource_type', resourceType);
    try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, { method: 'POST', body: fd });
        const data = await res.json();
        await db.ref('posts').push({
            mediaUrl: data.secure_url,
            mediaType: resourceType,
            caption: caption,
            sender: currentUser.uid,
            senderName: currentUserData?.username,
            likes: 0,
            likedBy: {},
            comments: {},
            timestamp: Date.now()
        });
        statusDiv.innerHTML = '✅ تم النشر!';
        setTimeout(() => { closeCreatePost(); renderFeed(); }, 1500);
    } catch (error) { statusDiv.innerHTML = '❌ فشل النشر: ' + error.message; }
}

// ========== البحث ==========
function openSearch() { document.getElementById('searchPanel').classList.add('open'); }
function closeSearch() { document.getElementById('searchPanel').classList.remove('open'); }
function searchAll() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const resultsDiv = document.getElementById('searchResults');
    if (!query) { resultsDiv.innerHTML = ''; return; }
    const users = Object.values(allUsers).filter(u => u.username.toLowerCase().includes(query));
    const posts = allPosts.filter(p => p.caption?.toLowerCase().includes(query));
    const hashtags = [...new Set(allPosts.flatMap(p => (p.caption?.match(/#\w+/g) || []).filter(h => h.toLowerCase().includes(query))))];
    resultsDiv.innerHTML = `
        ${users.length ? `<h4 class="font-bold mb-2">👥 مستخدمين</h4>${users.map(u => `<div class="flex items-center gap-3 p-2 border-b" onclick="viewProfile('${u.uid}')"><div class="w-10 h-10 rounded-full bg-[#e4405f] flex items-center justify-center">${u.avatarUrl ? `<img src="${u.avatarUrl}">` : (u.username.charAt(0))}</div><div>@${u.username}</div></div>`).join('')}</div>` : ''}
        ${hashtags.length ? `<h4 class="font-bold mb-2 mt-4"># هاشتاقات</h4>${hashtags.map(h => `<div class="p-2 border-b cursor-pointer" onclick="searchHashtag('${h.substring(1)}')">${h}</div>`).join('')}</div>` : ''}
        ${posts.length ? `<h4 class="font-bold mb-2 mt-4">📷 منشورات</h4>${posts.map(p => `<div class="flex items-center gap-3 p-2 border-b cursor-pointer" onclick="window.open('${p.mediaUrl}','_blank')"><img src="${p.mediaUrl}" class="w-12 h-12 object-cover rounded">${p.caption?.substring(0, 30)}</div>`).join('')}</div>` : ''}
    `;
}

// ========== الملف الشخصي ==========
async function viewProfile(userId) {
    if (!userId) return;
    await loadProfileData(userId);
    document.getElementById('profilePanel').classList.add('open');
}
async function loadProfileData(userId) {
    const userSnap = await db.ref(`users/${userId}`).get();
    const user = userSnap.val();
    if (!user) return;
    document.getElementById('profileAvatarDisplay').innerHTML = user.avatarUrl ? `<img src="${user.avatarUrl}">` : (user.username?.charAt(0) || '👤');
    document.getElementById('profileNameDisplay').innerText = user.username;
    document.getElementById('profileBioDisplay').innerText = user.bio || '';
    const userPosts = allPosts.filter(p => p.sender === userId);
    document.getElementById('profilePosts').innerText = userPosts.length;
    document.getElementById('profileFollowers').innerText = Object.keys(user.followers || {}).length;
    document.getElementById('profileFollowing').innerText = Object.keys(user.following || {}).length;
    const grid = document.getElementById('profilePostsGrid');
    grid.innerHTML = userPosts.map(p => `<div class="post-thumb" onclick="window.open('${p.mediaUrl}','_blank')"><i class="fas fa-${p.mediaType === 'video' ? 'video' : 'image'}"></i></div>`).join('');
    const actions = document.getElementById('profileActions');
    actions.innerHTML = '';
    if (userId === currentUser?.uid) {
        actions.innerHTML = `<button class="bg-[#e4405f] text-white px-4 py-2 rounded-full" onclick="openEditProfile()">تعديل الملف</button><button class="border border-gray-300 px-4 py-2 rounded-full ml-2" onclick="logout()">تسجيل خروج</button>`;
    } else {
        const isFollowing = currentUserData?.following && currentUserData.following[userId];
        actions.innerHTML = `<button class="bg-[#e4405f] text-white px-4 py-2 rounded-full" onclick="toggleFollowProfile('${userId}', this)">${isFollowing ? 'متابع' : 'متابعة'}</button>`;
    }
}
function openMyProfile() { if (currentUser) viewProfile(currentUser.uid); }
function closeProfile() { document.getElementById('profilePanel').classList.remove('open'); }
function openEditProfile() { document.getElementById('editProfilePanel').classList.add('open'); }
function closeEditProfile() { document.getElementById('editProfilePanel').classList.remove('open'); }
async function saveProfile() { /* مشابه لتيك توك */ }
function changeAvatar() { document.getElementById('avatarInput').click(); }
async function uploadAvatar(input) { /* مشابه لتيك توك */ }

// ========== المتابعة ==========
async function toggleFollowProfile(userId, btn) {
    if (!currentUser || currentUser.uid === userId) return;
    const userRef = db.ref(`users/${currentUser.uid}/following/${userId}`);
    const targetRef = db.ref(`users/${userId}/followers/${currentUser.uid}`);
    const snap = await userRef.get();
    if (snap.exists()) {
        await userRef.remove(); await targetRef.remove(); btn.innerText = 'متابعة';
        await addNotification(userId, 'unfollow', currentUser.uid);
    } else {
        await userRef.set(true); await targetRef.set(true); btn.innerText = 'متابع';
        await addNotification(userId, 'follow', currentUser.uid);
    }
}

// ========== الإشعارات ==========
async function addNotification(targetUserId, type, fromUserId) {
    if (targetUserId === fromUserId) return;
    const fromUser = allUsers[fromUserId] || { username: 'مستخدم' };
    const messages = { like: 'أعجب بمنشورك', comment: 'علق على منشورك', follow: 'بدأ بمتابعتك', unfollow: 'توقف عن متابعتك' };
    await db.ref(`notifications/${targetUserId}`).push({ type, fromUserId, fromUsername: fromUser.username, message: messages[type], timestamp: Date.now(), read: false });
}
async function openNotifications() {
    const panel = document.getElementById('notificationsPanel');
    const snap = await db.ref(`notifications/${currentUser.uid}`).once('value');
    const notifs = snap.val() || {};
    const container = document.getElementById('notificationsList');
    container.innerHTML = '';
    Object.values(notifs).reverse().forEach(n => {
        container.innerHTML += `<div class="border-b p-3 flex gap-3"><i class="fas ${n.type === 'like' ? 'fa-heart text-red-500' : n.type === 'comment' ? 'fa-comment' : 'fa-user-plus'}"></i><div><div>${n.fromUsername}</div><div class="text-sm text-gray-500">${n.message}</div></div></div>`;
        if (!n.read) db.ref(`notifications/${currentUser.uid}/${Object.keys(notifs).find(k => notifs[k] === n)}/read`).set(true);
    });
    panel.classList.add('open');
}
function closeNotifications() { document.getElementById('notificationsPanel').classList.remove('open'); }

// ========== الدردشة الخاصة (مشابهة لتيك توك) ==========
async function openConversations() { /* ... */ }
async function openPrivateChat(userId) { /* ... */ }
function closeChat() { /* ... */ }
async function sendChatMessage() { /* ... */ }

// ========== التنقل ==========
function switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
    if (event.target.closest('.nav-item')) event.target.closest('.nav-item').classList.add('active');
    if (tab === 'search') openSearch();
    if (tab === 'notifications') openNotifications();
    if (tab === 'profile') openMyProfile();
    if (tab === 'feed') { closeSearch(); closeNotifications(); closeProfile(); }
}

// ========== مراقبة المستخدم ==========
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user; await loadUserData();
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        const presenceRef = db.ref('presence/' + user.uid);
        presenceRef.set(true); presenceRef.onDisconnect().remove();
    } else {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }
});
console.log('✅ InstaClone Ready');
