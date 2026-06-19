const state = {
    chapters: [],
    currIndex: 0,
    wordsLimit: 2949,
    fontSize: 18,
    lineHeight: 1.8,
    theme: 'light',
    bookTitle: ''
};

const el = {
    main: document.getElementById('main-container'),
    uploadView: document.getElementById('upload-view'),
    readerView: document.getElementById('reader-view'),
    content: document.getElementById('reader-content'),
    bookTitle: document.getElementById('book-title'),
    title: document.getElementById('chapter-title'),
    footer: document.getElementById('reader-footer'),
    tocList: document.getElementById('toc-list'),
    loader: document.getElementById('loader'),
    status: document.getElementById('status-text'),
    fileInput: document.getElementById('file-upload'),
    controls: document.querySelector('.controls'),
    // Modal Elements
    modal: document.getElementById('custom-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalMsg: document.getElementById('modal-msg'),
    modalActions: document.getElementById('modal-actions')
};

// --- CUSTOM MODAL LOGIC (Replacement for alert/confirm) ---
function showModal(title, msg, type = 'alert', callback = null) {
    el.modalTitle.textContent = title;
    el.modalMsg.textContent = msg;
    el.modalActions.innerHTML = ''; // Clear buttons

    if (type === 'confirm') {
        const btnCancel = document.createElement('button');
        btnCancel.className = 'btn-modal btn-cancel';
        btnCancel.textContent = 'Batal';
        btnCancel.onclick = closeModal;

        const btnConfirm = document.createElement('button');
        btnConfirm.className = 'btn-modal btn-confirm';
        btnConfirm.textContent = 'Ya, Lanjutkan';
        btnConfirm.onclick = () => { closeModal(); if (callback) callback(); };

        el.modalActions.append(btnCancel, btnConfirm);
    } else {
        // Alert type
        const btnOk = document.createElement('button');
        btnOk.className = 'btn-modal btn-confirm';
        btnOk.textContent = 'OK';
        btnOk.onclick = closeModal;
        el.modalActions.appendChild(btnOk);
    }

    el.modal.classList.add('active');
}

function closeModal() {
    el.modal.classList.remove('active');
}

// --- Event Listeners ---
el.fileInput.addEventListener('change', handleUpload);
document.getElementById('prev-btn').addEventListener('click', () => goChapter(-1));
document.getElementById('next-btn').addEventListener('click', () => goChapter(1));

// Sidebar Logic
const toggleToc = () => document.body.classList.toggle('toc-open');
document.getElementById('toc-btn').addEventListener('click', toggleToc);
document.getElementById('close-toc').addEventListener('click', toggleToc);
document.getElementById('toc-overlay').addEventListener('click', toggleToc);

// Header Buttons
document.getElementById('theme-btn').addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', state.theme);
});

document.getElementById('font-btn').addEventListener('click', () => {
    const sizes = [16, 18, 22, 26];
    let nextIdx = (sizes.indexOf(state.fontSize) + 1) % sizes.length;
    state.fontSize = sizes[nextIdx];
    document.documentElement.style.setProperty('--font-size', state.fontSize + 'px');
});

document.getElementById('line-height-btn').addEventListener('click', () => {
    const heights = [1.5, 1.8, 2.2, 2.6];
    let nextIdx = (heights.indexOf(state.lineHeight) + 1) % heights.length;
    state.lineHeight = heights[nextIdx];
    document.documentElement.style.setProperty('--line-height', state.lineHeight);
});

// Reset Button with Custom Modal
document.getElementById('reset-btn').addEventListener('click', () => {
    if (state.chapters.length > 0) {
        showModal(
            "Ganti Buku?",
            "Progres bacaan saat ini akan hilang jika Anda kembali ke menu upload.",
            'confirm',
            resetApp
        );
    } else {
        resetApp();
    }
});

function resetApp() {
    state.chapters = [];
    state.currIndex = 0;
    state.bookTitle = '';
    el.readerView.style.display = 'none';
    el.footer.style.display = 'none';
    el.uploadView.style.display = 'flex';
    el.controls.style.display = 'none';
    el.fileInput.value = '';
    el.content.innerHTML = '';
    el.tocList.innerHTML = '';
    el.bookTitle.textContent = '';
    document.getElementById('progress-fill').style.width = '0%';
    document.title = "Zen Reader";
}

// --- Core Logic ---
function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    el.loader.style.display = 'block';
    el.status.textContent = "Sedang memproses...";

    const bookTitle = file.name.replace('.txt', '');
    state.bookTitle = bookTitle;
    el.bookTitle.textContent = bookTitle;
    document.title = bookTitle + " - Zen Reader";

    const reader = new FileReader();
    reader.onload = (ev) => {
        setTimeout(() => processTextWithParagraphs(ev.target.result), 50);
    };
    reader.readAsText(file);
}

function processTextWithParagraphs(rawText) {
    const paragraphs = rawText.split(/\r?\n/).filter(line => line.trim().length > 0);
    state.chapters = [];
    let currentChapterHTML = "";
    let currentWordCount = 0;

    paragraphs.forEach((para) => {
        // Hitung jumlah karakter Mandarin (tiap karakter/Hanzi dihitung sebagai 1 kata)
        const cjkChars = para.match(/[\u3400-\u9FFF]/g) || [];
        
        // Hapus karakter Mandarin, lalu sisa teks (alfabet/latin) dihitung berdasarkan spasi
        const nonCjkText = para.replace(/[\u3400-\u9FFF]/g, ' ').trim();
        const nonCjkWords = nonCjkText.length > 0 ? nonCjkText.split(/\s+/).length : 0;
        
        const wordsInPara = cjkChars.length + nonCjkWords;
        currentChapterHTML += `<p>${para.trim()}</p>`;
        currentWordCount += wordsInPara;

        if (currentWordCount >= state.wordsLimit) {
            state.chapters.push(currentChapterHTML);
            currentChapterHTML = "";
            currentWordCount = 0;
        }
    });

    if (currentChapterHTML.length > 0) state.chapters.push(currentChapterHTML);

    if (state.chapters.length === 0) {
        el.loader.style.display = 'none';
        showModal("Error", "File kosong atau format tidak didukung.", 'alert');
        return;
    }

    generateToC();
    el.loader.style.display = 'none';
    el.uploadView.style.display = 'none';
    el.readerView.style.display = 'block';
    el.footer.style.display = 'flex';
    el.controls.style.display = 'flex';
    goChapter(0, true);
}

// --- Rendering ---
function goChapter(delta, absolute = false) {
    const newIndex = absolute ? delta : state.currIndex + delta;

    if (newIndex >= 0 && newIndex < state.chapters.length) {
        state.currIndex = newIndex;
        el.title.textContent = `Chapter ${state.currIndex + 1}`;
        el.content.innerHTML = state.chapters[state.currIndex];
        el.main.scrollTop = 0;
        updateProgress();
    }
}

function updateProgress() {
    const percent = ((state.currIndex + 1) / state.chapters.length) * 100;
    document.getElementById('progress-fill').style.width = percent + '%';
    document.getElementById('prev-btn').disabled = state.currIndex === 0;
    document.getElementById('next-btn').disabled = state.currIndex === state.chapters.length - 1;

    // Highlight Active ToC
    document.querySelectorAll('.toc-item').forEach((item, idx) => {
        if (idx === state.currIndex) {
            item.classList.add('active');
            item.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } else {
            item.classList.remove('active');
        }
    });
}

function generateToC() {
    el.tocList.innerHTML = '';
    state.chapters.forEach((_, idx) => {
        const li = document.createElement('li');
        li.className = 'toc-item';
        li.textContent = `Chapter ${idx + 1}`;
        li.onclick = () => {
            goChapter(idx, true);
            toggleToc();
        };
        el.tocList.appendChild(li);
    });
}

// Init
document.documentElement.style.setProperty('--font-size', state.fontSize + 'px');
document.documentElement.style.setProperty('--line-height', state.lineHeight);
