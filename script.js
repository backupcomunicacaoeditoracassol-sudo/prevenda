// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDKN78IhW8565_1C8c6yPhfxtp9ljxF4Xg",
    authDomain: "portal-das-escritoras.firebaseapp.com",
    projectId: "portal-das-escritoras",
    storageBucket: "portal-das-escritoras.firebasestorage.app",
    messagingSenderId: "84912612092",
    appId: "1:84912612092:web:19f720a022c12b5d8bed79",
    measurementId: "G-2TBMREMRF1"
};

// Initialize Firebase (Compatibility mode)
firebase.initializeApp(firebaseConfig);

// Firebase Messaging - inicializado com segurança dentro da função
let messaging = null;
try {
    messaging = firebase.messaging();
} catch (e) {
    console.warn('Firebase Messaging não suportado neste contexto:', e.message);
}

// VAPID Key do Firebase Console (Configurações > Cloud Messaging > Certificados Push Web)
// ⬇️ COLE AQUI a chave pública gerada no Firebase Console ⬇️
const VAPID_KEY = 'BCOvoiBUvtP6OYZJfsUEkwF7lOBQMgpXQFxme86LBtcKhdmagPK3EXtXDYhQbBNDDjw6t8KotOlQo6_sIZyFrPw';

// File Input Preview (Show selected filename)
document.addEventListener('change', e => {
    if (e.target.id === 'postImage') {
        const file = e.target.files[0];
        const preview = document.getElementById('imageNamePreview');
        if (preview) preview.innerText = file ? `📎 ${file.name}` : "";
    }
});

const auth = firebase.auth();
const db = firebase.firestore();

// Google Apps Script for Uploads
const BRIDGE_URL = "https://script.google.com/macros/s/AKfycbzmA2YS4fUM22Se2U7FPwAeSbFIFYLA_Er9sfVoWD5JVkBy-92va3Id9fDsdt0TuXxL/exec";

let currentUser = null;
let sessionStatus = {};
let editingPostId = null;

// --- AUTH LOGIC ---

auth.onAuthStateChanged(async user => {
    if (user) {
        currentUser = user;
        // Check for approval BEFORE showing the app
        const isApproved = await checkUserApproval();

        if (isApproved) {
            document.getElementById('authScreen').style.display = 'none';
            document.getElementById('pendingScreen').style.display = 'none';
            document.getElementById('app').style.display = 'block';
            updateUIWithUser();
            initApp();
        } else {
            document.getElementById('authScreen').style.display = 'none';
            document.getElementById('app').style.display = 'none';
            document.getElementById('pendingScreen').style.display = 'flex';
        }
    } else {
        document.getElementById('authScreen').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
        document.getElementById('pendingScreen').style.display = 'none';
    }

    // Esconde a tela de splash com delay para a animação ficar fluida
    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        if (splash) splash.classList.add('hidden');
    }, 500);
});

async function checkUserApproval() {
    if (!currentUser) return false;

    const isMasterAdmin = isUserAdmin(currentUser);

    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();

        if (!userDoc.exists) {
            // Criar registro inicial
            await db.collection('users').doc(currentUser.uid).set({
                name: currentUser.displayName || "Usuário",
                email: (currentUser.email || "").toLowerCase(),
                photo: currentUser.photoURL || "",
                approved: isMasterAdmin ? true : false,
                isAdmin: isMasterAdmin,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            sessionStorage.setItem('isAdmin', isMasterAdmin);
            return isMasterAdmin;
        }

        const data = userDoc.data();
        const approved = data.approved === true;
        const isAdmin = data.isAdmin === true || isMasterAdmin;

        // Sync master admin status if needed
        if (isMasterAdmin && !data.isAdmin) {
            await db.collection('users').doc(currentUser.uid).update({ isAdmin: true });
        }

        sessionStorage.setItem('isAdmin', isAdmin);
        return approved;
    } catch (e) {
        console.error("Approval Check Error:", e);
        return isMasterAdmin;
    }
}

function updateUIWithUser() {
    const name = currentUser.displayName || currentUser.email.split('@')[0];
    const photo = currentUser.photoURL;

    document.getElementById('userName').innerText = name;

    if (photo) {
        document.getElementById('userAvatar').src = photo;
    } else {
        document.getElementById('userAvatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=B31312&color=fff`;
    }

    // Admin Check
    const userEmail = (currentUser.email || "").toLowerCase();
    const admin = sessionStorage.getItem('isAdmin') === 'true' || isUserAdmin(currentUser);

    console.log("Auth Debug:", { name, userEmail, admin });

    if (admin) {
        if (document.getElementById('adminControls')) {
            document.getElementById('adminControls').style.display = 'block';
        }
        const resetBtn = document.getElementById('adminResetBtn');
        if (resetBtn) {
            resetBtn.style.setProperty('display', 'flex', 'important');
        }
        // Show User Management Tab
        const usersTab = document.getElementById('tabUsers');
        if (usersTab) usersTab.style.display = 'flex';
    }

    // Set Name and Gendered Role in Challenges View
    const nameDisplay = document.getElementById('currentName');
    const roleDisplay = document.getElementById('currentRole');

    if (nameDisplay) nameDisplay.innerText = name;

    if (roleDisplay) {
        const male = isMale(name);
        roleDisplay.innerText = male ? "Escritor em destaque" : "Escritora em destaque";

        // Update Brand/Logo dynamically
        const logo = document.getElementById('mainLogo');
        const authTitle = document.getElementById('authBrandTitle');
        if (logo) logo.innerText = "Portal Pré-Venda";
        if (authTitle) authTitle.innerText = "Portal Pré-Venda";

        // Update Document Title
        document.title = "Portal Pré-Venda";
    }
}

async function handleGoogleLogin() {
    const btn = document.querySelector('.btn-google');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerText = "Aguarde...";

    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        console.error("Erro Google Login:", error);
        if (error.code === 'auth/popup-blocked') {
            alert("O popup de login foi bloqueado pelo navegador. Por favor, habilite popups para este site.");
        } else {
            alert("Erro no login com Google: " + error.message);
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function handleEmailLogin() {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    const btn = document.querySelector('#loginForm .btn-primary');

    if (!email || !pass) return alert("Preencha todos os campos.");

    btn.disabled = true;
    btn.innerText = "Entrando...";

    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (error) {
        console.error("Erro Email Login:", error);
        alert("Erro no login: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Entrar";
    }
}

async function handleEmailRegister() {
    const email = document.getElementById('regEmail').value;
    const pass = document.getElementById('regPass').value;
    const name = document.getElementById('regName').value;
    const btn = document.querySelector('#registerForm .btn-primary');

    if (!email || !pass || !name) return alert("Preencha todos os campos.");

    btn.disabled = true;
    btn.innerText = "Criando conta...";

    try {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        await cred.user.updateProfile({ displayName: name });
        location.reload();
    } catch (error) {
        console.error("Erro Cadastro:", error);
        alert("Erro no cadastro: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Criar Conta";
    }
}

function handleLogout() {
    auth.signOut();
}

function confirmLogout() {
    if (confirm("Deseja realmente sair do portal?")) {
        handleLogout();
    }
}

function toggleAuthMode() {
    const isLogin = document.getElementById('loginForm').style.display !== 'none';
    document.getElementById('loginForm').style.display = isLogin ? 'none' : 'block';
    document.getElementById('registerForm').style.display = isLogin ? 'block' : 'none';
}

// --- NAVIGATION ---

function switchTab(tab) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    if (tab === 'feed') {
        document.getElementById('feedView').classList.add('active');
        document.getElementById('tabFeed').classList.add('active');
        loadFeed();
    } else if (tab === 'challenges') {
        document.getElementById('challengesView').classList.add('active');
        document.getElementById('tabChallenges').classList.add('active');
        updateProgressUI();
    } else if (tab === 'users') {
        document.getElementById('usersView').classList.add('active');
        document.getElementById('tabUsers').classList.add('active');
        loadUsersForAdmin();
    }

    // Ao entrar no feed, marcar notificações como lidas
    if (tab === 'feed') {
        markNotificationsRead();
        clearNotificationBadge();
    }

    // Salvar aba atual
    localStorage.setItem('activeTab', tab);
}

// --- FEED LOGIC ---



async function createPost() {
    const content = document.getElementById('postContent').value;
    const titleEl = document.getElementById('postTitle');
    const postTitle = titleEl ? titleEl.value.trim() : "";
    const imageFile = document.getElementById('postImage').files[0];

    if (!content) return alert("Escreva algo antes de publicar.");

    const btn = document.querySelector('.admin-panel .btn-primary');
    btn.disabled = true;
    btn.innerText = "Publicando...";

    try {
        let imageUrl = "";

        if (imageFile) {
            btn.innerText = "Enviando imagem...";
            // Usar a mesma URL do push_relay, mas com o payload de imagem
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(imageFile);
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = error => reject(error);
            });

            const uploadPayload = {
                imageBase64: base64,
                fileName: imageFile.name,
                mimeType: imageFile.type
            };

            const uploadResponse = await fetch(PUSH_RELAY_URL, {
                method: 'POST',
                body: JSON.stringify(uploadPayload),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' } // text/plain evita preflight options
            });

            const uploadResult = await uploadResponse.json();

            if (uploadResult.status === 'success') {
                imageUrl = uploadResult.url;
            } else {
                throw new Error("Erro no upload para o Drive: " + (uploadResult.message || 'Desconhecido'));
            }
        }

        btn.innerText = "Salvando...";

        if (editingPostId) {
            const updateData = { content: content };
            if (imageUrl) updateData.imageUrl = imageUrl;
            await db.collection('posts').doc(editingPostId).update(updateData);
            editingPostId = null;
            document.getElementById('editTitle')?.remove();
            document.getElementById('cancelEditBtn')?.remove();
            btn.innerText = "Publicar";
        } else {
            const postRef = await db.collection('posts').add({
                title: postTitle,
                content: content,
                imageUrl: imageUrl,
                authorName: currentUser.displayName || "Admin",
                authorEmail: (currentUser.email || "").toLowerCase(),
                authorUid: currentUser.uid,
                authorPhoto: currentUser.photoURL || "",
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                likes: 0
            });
            // Criar notificacao para todos os usuarios
            await db.collection('notifications').add({
                postId: postRef.id,
                message: `✨ ${currentUser.displayName || 'Admin'} publicou: ${postTitle || 'Uma novidade no feed!'}`,
                authorName: currentUser.displayName || 'Admin',
                authorPhoto: currentUser.photoURL || '',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                readBy: [currentUser.uid]
            });

            // Enviar push via Apps Script relay
            sendPushToAll(
                postTitle ? `✨ ${postTitle}` : '✨ Nova publicação!',
                `${currentUser.displayName || 'Admin'}: ${content.slice(0, 80)}${content.length > 80 ? '...' : ''}`,
                currentUser.photoURL || ''
            );
        }

        document.getElementById('postContent').value = "";
        if (document.getElementById('postTitle')) document.getElementById('postTitle').value = "";
        document.getElementById('postImage').value = "";
        document.getElementById('imageNamePreview').innerText = "";
        loadFeed();
    } catch (error) {
        console.error("Error creating/editing post:", error);
        const msg = error.message || error.toString();
        if (msg.includes('bytes') || msg.includes('size') || msg.includes('RESOURCE_EXHAUSTED')) {
            alert("Erro: A imagem é muito grande mesmo após compressão. Tente uma foto menor.");
        } else {
            alert("Erro ao publicar: " + msg);
        }
    } finally {
        btn.disabled = false;
        btn.innerText = "Publicar";
    }
}

async function editPost(postId) {
    const card = document.getElementById(`post-${postId}`);
    const contentDiv = card.querySelector('.post-content');
    const currentText = contentDiv.innerText;

    // Transform content into textarea
    contentDiv.innerHTML = `
        <textarea id="edit-input-${postId}" class="inline-edit-textarea">${currentText}</textarea>
        <div class="inline-edit-actions">
            <button class="btn-save" onclick="updatePostInline('${postId}')">Salvar</button>
            <button class="btn-cancel" onclick="loadFeed()">Cancelar</button>
        </div>
    `;

    const textarea = document.getElementById(`edit-input-${postId}`);
    textarea.focus();
    // Set cursor to end
    textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
}

async function updatePostInline(postId) {
    const newText = document.getElementById(`edit-input-${postId}`).value.trim();
    if (!newText) return;

    try {
        await db.collection('posts').doc(postId).update({
            content: newText
        });
        loadFeed();
    } catch (e) {
        console.error("Erro ao atualizar:", e);
        alert("Erro ao salvar alterações.");
    }
}

async function loadFeed() {
    const feedList = document.getElementById('feedList');
    if (!feedList) return;

    try {
        const snapshot = await db.collection('posts').orderBy('timestamp', 'desc').get();
        if (snapshot.empty) {
            feedList.innerHTML = "<p style='text-align:center; color:#888; padding: 40px;'>Nenhuma publicação ainda.</p>";
            return;
        }

        feedList.innerHTML = snapshot.docs.map(doc => {
            const post = doc.data();
            const date = post.timestamp ? post.timestamp.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : "Agora";
            const authorImg = post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=B31312&color=fff`;

            const userEmail = (currentUser.email || "").toLowerCase();
            const authorEmail = (post.authorEmail || "").toLowerCase();
            const isAdmin = userEmail === 'backupcomunicacao.editoracassol@gmail.com';
            const isAuthor = userEmail === authorEmail;
            const isAdminPost = authorEmail === 'backupcomunicacao.editoracassol@gmail.com';

            const hasLiked = post.likedBy && post.likedBy.includes(currentUser.uid);

            return `
                <div class="feed-card ${isAdminPost ? 'admin-post' : ''}" id="post-${doc.id}">
                    <div class="post-header">
                        <img src="${authorImg}" class="post-author-img" referrerpolicy="no-referrer">
                        <div class="post-info">
                            <h4>${post.authorName} ${isAdminPost ? `
                                <svg class="verified-badge" viewBox="0 0 24 24" width="18" height="18">
                                    <path fill="#0095f6" d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.67-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91c-1.31.67-2.19 1.91-2.19 3.34s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zM10 17L5.5 12.5l1.41-1.41L10 14.17l7.09-7.09L18.5 8.5 10 17z"/>
                                </svg>
                            ` : ''}</h4>
                            <span>${date}</span>
                        </div>
                        ${(isAdmin || isAuthor) ? `
                            <div class="post-options">
                                <button class="btn-dots" onclick="togglePostMenu('${doc.id}', event)">...</button>
                                <div class="options-menu" id="menu-${doc.id}">
                                    <button onclick="editPost('${doc.id}')">Editar Postagem</button>
                                    <button onclick="deletePost('${doc.id}')" style="color: var(--accent);">Excluir Postagem</button>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    ${post.title ? `<h3 class="post-title" style="margin: 0 0 8px 0; padding: 0 25px; font-family: var(--font-title); font-size: 1.2rem; color: #111;">${post.title}</h3>` : ''}
                    <div class="post-content">${post.content}</div>
                    ${(() => {
                    if (!post.imageUrl) return "";
                    let renderUrl = post.imageUrl;
                    if (renderUrl.includes('drive.google.com/uc')) {
                        const match = renderUrl.match(/id=([^&]+)/);
                        if (match && match[1]) {
                            renderUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
                        }
                    }
                    return `<img src="${renderUrl}" class="post-image" referrerpolicy="no-referrer">`;
                })()}
                    <div class="post-footer">
                        <button class="post-action ${hasLiked ? 'liked' : ''}" onclick="likePost('${doc.id}')">
                            <svg class="heart-icon" viewBox="0 0 24 24" width="22" height="22" fill="${hasLiked ? 'var(--accent)' : 'none'}" stroke="${hasLiked ? 'var(--accent)' : 'currentColor'}" stroke-width="2">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                            <span id="likes-count-${doc.id}">${post.likes || 0}</span>
                        </button>
                        <button class="post-action" onclick="toggleComments('${doc.id}')">
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="comments-section" id="comments-${doc.id}">
                        <div class="comments-list" id="list-${doc.id}">
                            <!-- Comments injected here -->
                        </div>
                        <div class="comment-input-area">
                            <input type="text" id="input-${doc.id}" placeholder="Escreva um comentário...">
                            <button onclick="addComment('${doc.id}')">Enviar</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error("Erro ao carregar feed:", error);
        feedList.innerHTML = `<p style='text-align:center; color:#888; padding: 20px;'>
            Erro ao carregar o feed. Verifique sua conexão ou configuração do Firebase.<br>
            <small style="font-size: 0.7rem;">${error.message}</small>
        </p>`;
    }
}

function togglePostMenu(postId, event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById(`menu-${postId}`);
    const isVisible = menu.style.display === 'block';

    // Close all menus
    document.querySelectorAll('.options-menu').forEach(m => m.style.display = 'none');

    // Toggle current
    menu.style.display = isVisible ? 'none' : 'block';
}

// Close menus on click outside
document.addEventListener('click', e => {
    if (!e.target.classList.contains('btn-dots')) {
        document.querySelectorAll('.options-menu').forEach(m => m.style.display = 'none');
    }
});

async function likePost(postId) {
    if (!currentUser) return;
    const ref = db.collection('posts').doc(postId);
    const uid = currentUser.uid;

    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(ref);
            if (!doc.exists) return;

            let likedBy = doc.data().likedBy || [];
            let likes = doc.data().likes || 0;

            if (likedBy.includes(uid)) {
                // Remove like
                likedBy = likedBy.filter(id => id !== uid);
                likes = Math.max(0, likes - 1);
            } else {
                // Add like
                likedBy.push(uid);
                likes++;
            }

            transaction.update(ref, { likedBy, likes });
        });
        loadFeed();
    } catch (e) {
        console.error("Error toggling like:", e);
    }
}

async function toggleComments(postId) {
    const section = document.getElementById(`comments-${postId}`);
    section.classList.toggle('expanded');
    if (section.classList.contains('expanded')) {
        loadComments(postId);
    }
}

async function addComment(postId) {
    const input = document.getElementById(`input-${postId}`);
    const text = input.value;
    if (!text) return;

    input.value = "";
    input.disabled = true;

    try {
        await db.collection('posts').doc(postId).collection('comments').add({
            text: text,
            authorName: currentUser.displayName || "Usuário",
            authorEmail: currentUser.email,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        loadComments(postId);
    } catch (e) {
        console.error("Error adding comment:", e);
        alert("Erro ao comentar. Verifique as regras do Firestore.");
    } finally {
        input.disabled = false;
    }
}

async function deletePost(postId) {
    if (confirm("Deseja realmente excluir esta postagem para todos?")) {
        try {
            await db.collection('posts').doc(postId).delete();
            loadFeed();
        } catch (e) {
            console.error("Error deleting post:", e);
            alert("Erro ao excluir postagem: " + e.message);
        }
    }
}

async function loadComments(postId) {
    const list = document.getElementById(`list-${postId}`);
    list.innerHTML = "<p style='font-size:0.8rem; color:#888; padding:10px;'>Carregando...</p>";

    try {
        const snapshot = await db.collection('posts').doc(postId).collection('comments').orderBy('timestamp', 'asc').get();
        if (snapshot.empty) {
            list.innerHTML = "<p style='font-size:0.8rem; color:#888; padding:10px;'>Seja a primeira a comentar!</p>";
            return;
        }

        list.innerHTML = snapshot.docs.map(doc => {
            const c = doc.data();
            return `
                <div class="comment-item">
                    <strong>${c.authorName}:</strong> <span>${c.text}</span>
                </div>
            `;
        }).join('');
    } catch (e) {
        list.innerHTML = "<p style='font-size:0.8rem; color:red; padding:10px;'>Erro ao carregar comentários.</p>";
    }
}

// --- CHALLENGES LOGIC (Personalized) ---

async function nukeAllPosts() {
    if (!confirm("⚠️ ATENÇÃO: Isso vai apagar TODAS as postagens de TODAS as escritoras permanentemente. Deseja continuar?")) return;

    try {
        const snapshot = await db.collection('posts').get();
        if (snapshot.empty) return alert("O feed já está vazio.");

        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        alert("✅ Todas as postagens foram deletadas!");
        loadFeed();
    } catch (e) {
        console.error("Erro no Nuke:", e);
        alert("Erro ao deletar: " + e.message);
    }
}

async function initApp() {
    loadLocalStatus();

    // Restaurar aba ativa
    const savedTab = localStorage.getItem('activeTab') || 'feed';
    switchTab(savedTab);

    // Iniciar listener de notificações em tempo real
    startNotificationListener();

    // Verificar estado das notificações push (NÃO pede permissão automaticamente)
    checkPushNotificationState();
}

function loadLocalStatus() {
    if (!currentUser) return;
    const saved = localStorage.getItem(`portal_status_${currentUser.uid}`);
    if (saved) sessionStatus = JSON.parse(saved);
    else sessionStatus = {};
}

function saveLocalStatus() {
    if (!currentUser) return;
    localStorage.setItem(`portal_status_${currentUser.uid}`, JSON.stringify(sessionStatus));
}

function resetMyProgress() {
    if (confirm("Deseja resetar o SEU progresso de vídeos para testar novamente?")) {
        sessionStatus = {};
        saveLocalStatus();
        updateProgressUI();
        alert("Progresso resetado!");
    }
}

function updateProgressUI() {
    if (!currentUser) return;

    // Reset cards UI first
    for (let i = 1; i <= 3; i++) {
        const card = document.getElementById(`slot-${i}`);
        const label = document.getElementById(`l${i}`);
        if (card) {
            card.classList.remove('completed');
            label.innerText = "📤 Subir Vídeo";
            label.style.background = "var(--accent)";
        }
    }

    let doneCount = 0;
    for (let i = 1; i <= 3; i++) {
        if (sessionStatus[i]) {
            doneCount++;
            markSlotDone(i);
        }
    }
    const percent = Math.round((doneCount / 3) * 100);
    const bar = document.getElementById('mainProgressBar');
    const stats = document.getElementById('progressStats');

    if (bar) bar.style.width = `${percent}%`;
    if (stats) stats.innerText = `${doneCount} de 3 vídeos salvos`;
}

async function up(ev, slot, title) {
    const file = ev.target.files[0];
    if (!file || !currentUser) return;

    const st = document.getElementById(`s${slot}`);
    const lb = document.getElementById(`l${slot}`);

    st.innerText = "⏳ Salvando vídeo...";
    lb.style.opacity = "0.5";
    lb.style.pointerEvents = "none";

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        const payload = {
            base64: base64,
            type: file.type,
            name: file.name,
            writer: currentUser.displayName || currentUser.email,
            slot: title
        };

        try {
            const response = await fetch(BRIDGE_URL, { method: 'POST', body: JSON.stringify(payload) });
            const result = await response.json();

            if (result.status === "success") {
                st.innerText = "✅ Vídeo salvo com sucesso!";
                st.style.color = "green";
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

                sessionStatus[slot] = true;
                saveLocalStatus();
                updateProgressUI();

                showCongratsPopup(title);
            } else { throw new Error(result.error); }
        } catch (e) {
            st.innerText = "❌ Erro ao salvar.";
            console.error(e);
        } finally {
            lb.style.opacity = "1";
            lb.style.pointerEvents = "auto";
        }
    };
}

async function shareAchievement(slotTitle) {
    if (!currentUser) return;

    const btn = document.querySelector('#congratsOverlay .btn-primary');
    const customText = document.getElementById('achievementMessage').value.trim();

    if (btn) {
        btn.disabled = true;
        btn.innerText = "✨ Compartilhando...";
    }

    // Mapeamento de imagens de conquista
    const achievementImages = {
        "Carreira de Escritora": "conquista_carreira.png",
        "Processo de Criação": "conquista_obra.png",
        "Vídeo Conceito": "conquista_conceito.png"
    };

    const achievementImg = achievementImages[slotTitle] || "";
    const achievementText = customText || `✨ Conquista Desbloqueada! Acabei de completar o "${slotTitle}" da minha jornada no Portal Pré-Venda! 🖋️📖`;

    try {
        const postData = {
            content: achievementText,
            imageUrl: achievementImg,
            achievementSlot: slotTitle, // Tag to identify the challenge
            authorName: currentUser.displayName || (isMale(currentUser.displayName) ? "Escritor" : "Escritora"),
            authorEmail: (currentUser.email || "").toLowerCase(),
            authorUid: currentUser.uid,
            authorPhoto: currentUser.photoURL || "",
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            likes: 0,
            likedBy: []
        };

        await db.collection('posts').add(postData);

        closeCongrats();
        switchTab('feed');
        setTimeout(() => {
            loadFeed();
            updateProgressUI(); // Sync the buttons
        }, 1000);
    } catch (e) {
        console.error("Erro detalhado ao compartilhar:", e);
        alert("Erro ao compartilhar: " + e.message);
        if (btn) {
            btn.disabled = false;
            btn.innerText = "✨ Compartilhar no Feed";
        }
    }
}

function showCongratsPopup(slotTitle) {
    const overlay = document.createElement('div');
    overlay.id = 'congratsOverlay';
    overlay.className = 'congrats-overlay';

    // Escapar aspas simples para o onclick
    const escapedTitle = slotTitle.replace(/'/g, "\\'");
    const defaultText = `✨ Conquista Desbloqueada! Acabei de completar o "${slotTitle}" da minha jornada no Portal Pré-Venda! 🖋️📖`;

    overlay.innerHTML = `
        <div class="congrats-card">
            <div class="congrats-icon">🎉</div>
            <h2>Parabéns!</h2>
            <p>Você completou o desafio: <br><strong>"${slotTitle}"</strong></p>
            
            <textarea id="achievementMessage" class="congrats-textarea" placeholder="Escreva uma mensagem...">${defaultText}</textarea>

            <div class="congrats-actions">
                <button class="btn-primary" onclick="shareAchievement('${escapedTitle}')">✨ Compartilhar no Feed</button>
                <button class="btn-text" onclick="closeCongrats()">Agora não</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Confetti explosion com proteção
    try {
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 150,
                spread: 100,
                origin: { y: 0.6 },
                colors: ['#B31312', '#E63946', '#ffd700']
            });
        }
    } catch (err) {
        console.error("Confetti error:", err);
    }
}

function closeCongrats() {
    const overlay = document.getElementById('congratsOverlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
    }
}

function markSlotDone(id) {
    const card = document.getElementById(`slot-${id}`);
    const label = document.getElementById(`l${id}`);
    if (card) {
        card.classList.add('completed');
        label.innerText = "✅ Vídeo Enviado";
        label.style.background = "#2ecc71";
    }
}
function isUserAdmin(user) {
    if (!user) return false;
    const email = (user.email || "").toLowerCase();
    // Apenas o e-mail principal é Super Admin fixo por segurança
    return email === 'backupcomunicacao.editoracassol@gmail.com';
}

function isMale(name) {
    if (!name) return false;
    const n = name.toLowerCase();
    return n.includes('luiggi') || n.includes('cassol') || n.endsWith('o') || n.includes('pedro') || n.includes('joao');
}

function getTerm(termA, termO) {
    const name = currentUser ? (currentUser.displayName || "") : "";
    return isMale(name) ? termO : termA;
}

async function loadUsersForAdmin() {
    const list = document.getElementById('usersList');
    if (!list) return;

    list.innerHTML = "<div class='loading-spinner'>Buscando usuários...</div>";

    try {
        // Tentar primeiro sem ordenação para evitar erros de índice ausente
        const snapshot = await db.collection('users').get();
        if (snapshot.empty) {
            list.innerHTML = "<p style='text-align:center; padding:20px;'>Nenhum usuário cadastrado.</p>";
            return;
        }

        // Ordenar localmente se necessário, ou apenas exibir
        const docs = snapshot.docs;

        list.innerHTML = docs.map(doc => {
            const u = doc.data();
            const id = doc.id;
            const status = u.approved ?
                '<span style="color:green; font-weight:bold;">Aprovado</span>' :
                '<span style="color:orange; font-weight:bold;">Pendente</span>';

            return `
                <div class="feed-card" style="padding: 20px; display: flex; align-items: center; gap: 15px;">
                    <img src="${u.photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.name)}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;" referrerpolicy="no-referrer">
                    <div style="flex: 1;">
                        <h4 style="margin:0;">${u.name} ${u.isAdmin ? '⭐' : ''}</h4>
                        <p style="margin:0; font-size: 0.8rem; color: #888;">${u.email}</p>
                        <p style="margin:5px 0 0; font-size: 0.8rem;">Status: ${status}</p>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${u.approved ?
                    `<button onclick="setApproval('${id}', false)" class="btn-secondary" style="font-size: 0.7rem; color: red; border-color: red; padding: 5px 10px;">Bloquear</button>` :
                    `<button onclick="setApproval('${id}', true)" class="btn-primary" style="font-size: 0.7rem; width: auto; padding: 5px 15px;">Aprovar</button>`
                }
                        <button onclick="toggleAdminRole('${id}', ${u.isAdmin || false})" 
                            class="btn-secondary" 
                            style="font-size: 0.7rem; padding: 5px 10px; ${id === currentUser.uid || isUserAdmin({ email: u.email }) ? 'opacity: 0.5; pointer-events: none;' : ''}">
                            ${u.isAdmin ? 'Remover Admin' : 'Tornar Admin'}
                        </button>
                        ${id !== currentUser.uid && !isUserAdmin({ email: u.email }) ?
                    `<button onclick="deleteUser('${id}')" class="btn-text" style="font-size: 0.7rem; color: #888; margin-top: 5px;">Excluir Usuário</button>` : ''
                }
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error("Error loading users:", e);
        list.innerHTML = `
            <p style='color:red; padding: 20px; text-align:center;'>
                Erro ao carregar lista de usuários.<br>
                <small style="font-size: 0.7rem; color: #666;">${e.message}</small>
            </p>`;
    }
}

async function setApproval(uid, status) {
    if (!confirm(`Deseja ${status ? 'APROVAR' : 'BLOQUEAR'} este usuário?`)) return;

    try {
        await db.collection('users').doc(uid).update({ approved: status });
        loadUsersForAdmin();
    } catch (e) {
        alert("Erro ao atualizar: " + e.message);
    }
}

async function toggleAdminRole(uid, currentStatus) {
    if (!confirm(`Deseja ${currentStatus ? 'REMOVER' : 'TORNAR'} este usuário administrador?`)) return;

    try {
        await db.collection('users').doc(uid).update({ isAdmin: !currentStatus });
        loadUsersForAdmin();
    } catch (e) {
        alert("Erro ao atualizar cargo: " + e.message);
    }
}

async function deleteUser(uid) {
    if (!confirm("⚠️ ATENÇÃO: Isso excluirá o registro deste usuário permanentemente. Deseja continuar?")) return;

    try {
        await db.collection('users').doc(uid).delete();
        loadUsersForAdmin();
    } catch (e) {
        alert("Erro ao excluir usuário: " + e.message);
    }
}

// --- NOTIFICATIONS ---

let notificationUnsubscribe = null;

function startNotificationListener() {
    if (!currentUser) return;
    if (notificationUnsubscribe) notificationUnsubscribe(); // clear previous listener

    notificationUnsubscribe = db.collection('notifications')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .onSnapshot(snapshot => {
            let unread = 0;
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const readBy = data.readBy || [];
                if (!readBy.includes(currentUser.uid)) {
                    unread++;
                    // Mostrar toast apenas para novas notificações (criadas nos últimos 30s)
                    const ts = data.timestamp ? data.timestamp.toMillis() : 0;
                    const age = Date.now() - ts;
                    if (age < 30000) {
                        showNotificationToast(data);
                    }
                }
            });
            // Atualizar badge da aba do feed
            if (unread > 0 && document.getElementById('feedView') && !document.getElementById('feedView').classList.contains('active')) {
                showNotificationBadge(unread);
            }
        }, err => console.error('Notification listener error:', err));
}

function showNotificationToast(data) {
    // Evitar duplicatas
    if (document.getElementById('notifToast')) return;

    const photo = data.authorPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.authorName)}&background=B31312&color=fff`;

    const toast = document.createElement('div');
    toast.id = 'notifToast';
    toast.className = 'notif-toast';
    toast.innerHTML = `
        <img src="${photo}" referrerpolicy="no-referrer" class="notif-avatar">
        <div class="notif-body">
            <strong>${data.title || 'Nova publicação!'}</strong>
            <p>${data.message}</p>
        </div>
        <button class="notif-close" onclick="this.parentElement.remove()">×</button>
    `;
    toast.onclick = (e) => {
        if (e.target.classList.contains('notif-close')) return;
        toast.remove();
        switchTab('feed');
    };
    document.body.appendChild(toast);

    // Auto-remover após 6 segundos
    setTimeout(() => toast.remove(), 6000);
}

function showNotificationBadge(count) {
    const tab = document.getElementById('tabFeed');
    if (!tab) return;
    let badge = document.getElementById('feedBadge');
    if (!badge) {
        badge = document.createElement('span');
        badge.id = 'feedBadge';
        badge.className = 'notif-badge';
        tab.style.position = 'relative';
        tab.appendChild(badge);
    }
    badge.innerText = count;
}

function clearNotificationBadge() {
    const badge = document.getElementById('feedBadge');
    if (badge) badge.remove();
}

async function markNotificationsRead() {
    if (!currentUser) return;
    try {
        const snapshot = await db.collection('notifications').get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            const readBy = doc.data().readBy || [];
            if (!readBy.includes(currentUser.uid)) {
                batch.update(doc.ref, {
                    readBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                });
            }
        });
        await batch.commit();
    } catch (e) {
        console.error('markNotificationsRead error:', e);
    }
}

// URL do relay Apps Script para envio de push (atualizar após deploy)
const PUSH_RELAY_URL = 'https://script.google.com/macros/s/AKfycbzfK6tG_dl5eR5raCA2JY8iDQRqUSXb0NUHg6k0eneRENNO2_q_aXXd3s6KVJnT1cez/exec';

async function sendPushToAll(title, body, icon) {
    if (PUSH_RELAY_URL === 'COLE_AQUI_A_URL_DO_APPS_SCRIPT_DEPLOY') return;

    try {
        // Buscar todos os tokens FCM de todos os usuários
        const snapshot = await db.collection('users').get();
        const tokens = [];
        snapshot.docs.forEach(doc => {
            const fcmTokens = doc.data().fcmTokens || [];
            // Não enviar para o próprio usuário que publicou
            if (doc.id !== currentUser.uid) {
                tokens.push(...fcmTokens);
            }
        });

        if (tokens.length === 0) return;

        await fetch(PUSH_RELAY_URL, {
            method: 'POST',
            body: JSON.stringify({ tokens, title, body, icon }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' } // text/plain evita preflight options (CORS)
        });
        console.log(`Push enviado para ${tokens.length} dispositivos.`);
    } catch (e) {
        console.error('Erro ao enviar push:', e);
    }
}

// === PUSH NOTIFICATIONS (Web Push via FCM) — iOS Compatible ===

// Detectar iOS
function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Detectar se está em modo PWA standalone (instalado na Home Screen)
function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
}

// Verificar estado das notificações sem pedir permissão (chamado no initApp)
function checkPushNotificationState() {
    if (!currentUser) return;

    const btn = document.getElementById('notifPermBtn');
    if (!btn) return;

    // Verificar suporte básico
    if (!('Notification' in window)) {
        console.warn('Notifications API não disponível.');
        // No iOS fora do standalone, mostrar botão que guia para instalar
        if (isIOS() && !isStandalone()) {
            btn.innerHTML = '📲 Instalar App';
            btn.style.display = 'flex';
            btn.onclick = showIOSInstallGuide;
        }
        return;
    }

    // iOS em standalone mas sem suporte a PushManager (versão antiga do iOS)
    if (isIOS() && isStandalone() && !('PushManager' in window)) {
        console.warn('PushManager não disponível neste iOS. Versão 16.4+ necessária.');
        btn.style.display = 'none';
        return;
    }

    // Se a permissão já foi concedida, registrar token silenciosamente
    if (Notification.permission === 'granted') {
        btn.style.display = 'none';
        registerPushToken(); // Apenas registra token, sem pedir permissão
        setupForegroundMessages();
        return;
    }

    // Se foi negada, esconder botão
    if (Notification.permission === 'denied') {
        btn.style.display = 'none';
        console.log('Notificações foram bloqueadas pelo usuário.');
        return;
    }

    // Permissão ainda não decidida ("default") — mostrar botão
    btn.innerHTML = '🔔 Ativar Notificações';
    btn.style.display = 'flex';
}

// Função chamada pelo botão "🔔 Ativar Notificações" (via gesto do usuário!)
async function requestNotifPermission() {
    const btn = document.getElementById('notifPermBtn');

    // iOS fora do standalone → guiar para instalar
    if (isIOS() && !isStandalone()) {
        showIOSInstallGuide();
        return;
    }

    // Verificar suporte
    if (!('Notification' in window) || !('PushManager' in window)) {
        alert('Notificações push não são suportadas neste navegador. No iPhone, adicione o app à Tela Inicial primeiro.');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ Aguarde...';
    }

    try {
        // Pedir permissão (DEVE estar dentro de um evento de clique para iOS!)
        const permission = await Notification.requestPermission();

        if (permission === 'granted') {
            console.log('✅ Permissão de notificação concedida!');
            await registerPushToken();
            setupForegroundMessages();

            if (btn) {
                btn.innerHTML = '✅ Notificações Ativas';
                btn.style.background = 'rgba(46, 204, 113, 0.15)';
                btn.style.color = '#2ecc71';
                btn.style.borderColor = 'rgba(46, 204, 113, 0.4)';
                setTimeout(() => { btn.style.display = 'none'; }, 3000);
            }

            // Mostrar confirmação visual
            showNotificationToast({
                message: '🎉 Notificações ativadas! Você será avisada de novas publicações.',
                authorName: 'Portal',
                authorPhoto: ''
            });
        } else {
            console.log('Permissão negada ou descartada:', permission);
            if (btn) {
                btn.innerHTML = '🔕 Notificações Bloqueadas';
                btn.disabled = false;
                setTimeout(() => { btn.style.display = 'none'; }, 3000);
            }
        }
    } catch (e) {
        console.error('Erro ao solicitar permissão:', e);
        if (btn) {
            btn.innerHTML = '🔔 Ativar Notificações';
            btn.disabled = false;
        }
    }
}

// Registrar Service Worker + obter token FCM (sem pedir permissão)
async function registerPushToken() {
    if (!currentUser || !messaging) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (VAPID_KEY === 'COLE_A_VAPID_KEY_AQUI') {
        console.error('⚠️ VAPID_KEY não configurada! Vá ao Firebase Console > Cloud Messaging > Certificados Push Web.');
        return;
    }

    try {
        // Registrar o Service Worker (caminho dinâmico: local ou GitHub Pages)
        const isGHPages = location.hostname.includes('github.io') || location.pathname.startsWith('/prevenda');
        const swPath = isGHPages ? '/prevenda/sw.js' : '/sw.js';
        const swScope = isGHPages ? '/prevenda/' : '/';
        const reg = await navigator.serviceWorker.register(swPath, { scope: swScope });
        console.log('Service Worker registrado:', reg.scope);

        // Aguardar o SW ficar ativo
        await navigator.serviceWorker.ready;

        // Obter token FCM
        const token = await messaging.getToken({
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: reg
        });

        if (token) {
            // Salvar token no Firestore vinculado ao usuário
            await db.collection('users').doc(currentUser.uid).update({
                fcmTokens: firebase.firestore.FieldValue.arrayUnion(token),
                lastTokenUpdate: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ FCM Token salvo:', token.slice(-12));
        }
    } catch (e) {
        console.error('Erro ao registrar push token:', e);
    }
}

// Listener de mensagens em foreground (app aberto)
function setupForegroundMessages() {
    if (!messaging) return;
    messaging.onMessage((payload) => {
        console.log('Mensagem em foreground:', payload);
        showNotificationToast({
            title: payload.notification?.title || 'Portal Pré-Venda',
            message: payload.notification?.body || 'Nova publicação no feed!',
            authorName: 'Portal',
            authorPhoto: payload.notification?.image || ''
        });
    });
}

// Guia visual para instalar o PWA no iOS
function showIOSInstallGuide() {
    // Remover guia anterior se existir
    const existing = document.getElementById('iosInstallGuide');
    if (existing) existing.remove();

    const guide = document.createElement('div');
    guide.id = 'iosInstallGuide';
    guide.className = 'congrats-overlay';
    guide.style.cssText = 'display:flex; align-items:center; justify-content:center; z-index: 10000;';
    guide.innerHTML = `
        <div class="congrats-card" style="max-width: 380px; text-align: center;">
            <div class="congrats-icon" style="font-size: 3.5rem;">📲</div>
            <h2 style="font-family: var(--font-title); font-size: 1.6rem; margin-bottom: 12px;">Instalar o Portal</h2>
            <p style="color: #666; font-size: 0.95rem; margin-bottom: 20px; line-height: 1.5;">
                Para receber notificações no iPhone, você precisa <strong>adicionar o Portal à Tela Inicial</strong>:
            </p>
            <div style="text-align: left; background: #f8f8f8; border-radius: 16px; padding: 20px; margin-bottom: 20px;">
                <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px;">
                    <span style="font-size: 1.5rem; min-width: 32px; text-align: center;">1️⃣</span>
                    <span style="font-size: 0.9rem; color: #444;">Toque no botão <strong>Compartilhar</strong> (ícone <span style="font-size: 1.2rem;">⬆️</span>) na barra inferior do Safari</span>
                </div>
                <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px;">
                    <span style="font-size: 1.5rem; min-width: 32px; text-align: center;">2️⃣</span>
                    <span style="font-size: 0.9rem; color: #444;">Role para baixo e toque em <strong>"Adicionar à Tela Inicial"</strong></span>
                </div>
                <div style="display: flex; align-items: flex-start; gap: 12px;">
                    <span style="font-size: 1.5rem; min-width: 32px; text-align: center;">3️⃣</span>
                    <span style="font-size: 0.9rem; color: #444;">Abra o Portal pelo <strong>ícone na Tela Inicial</strong> e toque em <strong>"🔔 Ativar Notificações"</strong></span>
                </div>
            </div>
            <div class="congrats-actions">
                <button class="btn-primary" onclick="document.getElementById('iosInstallGuide').remove()" style="width: 100%;">Entendi!</button>
            </div>
        </div>
    `;
    document.body.appendChild(guide);
}
