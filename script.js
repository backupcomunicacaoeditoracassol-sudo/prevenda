const writers = [
    {
        name: "Clara Mendes",
        role: "Escritora Principal",
        photo: "assets/writers/clara.jpg",
        folderLink: "#" // Link para a pasta dela
    },
    {
        name: "Beatriz Silveira",
        role: "Co-autora",
        photo: "assets/writers/beatriz.jpg",
        folderLink: "#"
    },
    {
        name: "Mariana Rocha",
        role: "Escritora Convidada",
        photo: "assets/writers/mariana.jpg",
        folderLink: "#"
    },
    {
        name: "Lúcia Ferreira",
        role: "Escritora Convidada",
        photo: "assets/writers/lucia.jpg",
        folderLink: "#"
    }
];

function renderWriters() {
    const grid = document.getElementById('writersGrid');
    grid.innerHTML = '';

    writers.forEach((writer, index) => {
        const card = document.createElement('a');
        card.href = writer.folderLink;
        card.className = 'writer-card';
        card.style.animationDelay = `${index * 0.1}s`;
        card.target = "_blank";

        card.innerHTML = `
            <div class="photo-container">
                <img src="${writer.photo}" alt="${writer.name}" class="writer-photo" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(writer.name)}&background=A67C37&color=fff&size=200'">
            </div>
            <h2 class="writer-name">${writer.name}</h2>
            <span class="writer-role">${writer.role}</span>
            <div class="access-btn">Entrar na Pasta</div>
        `;

        grid.appendChild(card);
    });
}

document.addEventListener('DOMContentLoaded', renderWriters);
