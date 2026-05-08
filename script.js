let supabase;

const writers = [
    {
        id: "clara",
        name: "Clara Mendes",
        role: "Escritora Principal",
        photo: "assets/writers/clara.jpg",
        folderLink: "#" 
    },
    {
        id: "beatriz",
        name: "Beatriz Silveira",
        role: "Co-autora",
        photo: "assets/writers/beatriz.jpg",
        folderLink: "#"
    },
    {
        id: "mariana",
        name: "Mariana Rocha",
        role: "Escritora Convidada",
        photo: "assets/writers/mariana.jpg",
        folderLink: "#"
    },
    {
        id: "lucia",
        name: "Lúcia Ferreira",
        role: "Escritora Convidada",
        photo: "assets/writers/lucia.jpg",
        folderLink: "#"
    }
];

function initSupabase() {
    console.log("Iniciando inicialização do Supabase...");
    const supabaseUrl = 'https://hxaqahyraybmotmmhszc.supabase.co';
    const supabaseKey = 'sb_publishable_8wzDM9sC7e6EAlJhQqHbuQ_sNru6LN1';
    
    try {
        if (window.supabase) {
            supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
            console.log("Supabase inicializado com sucesso.");
        } else {
            console.warn("Aviso: SDK do Supabase não foi detectado no window. O upload de vídeos não funcionará.");
        }
    } catch (error) {
        console.error("Erro crítico ao inicializar Supabase:", error);
    }
}

function renderWriters() {
    console.log("Iniciando renderização das escritoras...");
    const grid = document.getElementById('writersGrid');
    
    if (!grid) {
        console.error("Erro: Elemento 'writersGrid' não encontrado no DOM.");
        return;
    }
    
    grid.innerHTML = '';

    writers.forEach((writer, index) => {
        const card = document.createElement('div');
        card.className = 'writer-card';
        card.style.animationDelay = `${index * 0.1}s`;

        card.innerHTML = `
            <div class="photo-container">
                <img src="${writer.photo}" alt="${writer.name}" class="writer-photo" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(writer.name)}&background=B31312&color=fff&size=200'">
            </div>
            <h2 class="writer-name">${writer.name}</h2>
            <span class="writer-role">${writer.role}</span>
            
            <div class="upload-container">
                <label for="file-${writer.id}" class="upload-btn" id="label-${writer.id}">
                    <span>📤 Subir Vídeo</span>
                </label>
                <input type="file" id="file-${writer.id}" accept="video/*" style="display:none" onchange="handleFileUpload(event, '${writer.id}', '${writer.name}')">
                <div class="progress-wrapper" id="progress-wrapper-${writer.id}">
                    <div class="progress-bar" id="progress-${writer.id}"></div>
                </div>
                <span class="status-text" id="status-${writer.id}"></span>
            </div>

            <a href="${writer.folderLink}" target="_blank" class="access-btn">Acessar Pasta</a>
        `;

        grid.appendChild(card);
    });
    console.log("Renderização concluída.");
}

async function handleFileUpload(event, writerId, writerName) {
    const file = event.target.files[0];
    if (!file) return;

    if (!supabase) {
        alert("Erro: Sistema de upload não inicializado corretamente. Verifique se o Supabase está configurado.");
        return;
    }

    const label = document.getElementById(`label-${writerId}`);
    const progressWrapper = document.getElementById(`progress-wrapper-${writerId}`);
    const progressBar = document.getElementById(`progress-${writerId}`);
    const statusText = document.getElementById(`status-${writerId}`);

    label.classList.add('disabled');
    progressWrapper.style.display = 'block';
    statusText.innerText = 'Enviando...';
    progressBar.style.width = '0%';

    try {
        const fileName = `${Date.now()}_${file.name}`;
        const filePath = `${writerName.replace(/\s+/g, '_')}/${fileName}`;

        const { data, error } = await supabase.storage
            .from('videos-escritoras')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        progressBar.style.width = '100%';
        progressBar.style.backgroundColor = '#2ecc71';
        statusText.innerText = '✅ Vídeo enviado com sucesso!';
        statusText.style.color = '#2ecc71';
        
    } catch (error) {
        console.error('Erro no upload:', error);
        statusText.innerText = '❌ Erro ao enviar. Tente novamente.';
        statusText.style.color = '#e74c3c';
        progressBar.style.backgroundColor = '#e74c3c';
    } finally {
        label.classList.remove('disabled');
        setTimeout(() => {
            if (statusText.innerText.includes('sucesso')) {
                progressWrapper.style.display = 'none';
                statusText.innerText = '';
            }
        }, 5000);
    }
}

// Inicialização segura
function main() {
    console.log("DOM carregado. Iniciando script principal...");
    try {
        renderWriters();
        initSupabase();
    } catch (e) {
        console.error("Erro fatal no main:", e);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}
