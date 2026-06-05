document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const bookList = document.getElementById('bookList');
    const statusMessage = document.getElementById('statusMessage');
    
    const readerOverlay = document.getElementById('readerOverlay');
    const closeReader = document.getElementById('closeReader');
    const textContent = document.getElementById('textContent');
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');

    let booksData = [];

    // CSVのパース処理（クォート対応版）
    function parseCSV(text) {
        const result = [];
        let i = 0;
        // BOMの除去
        if (text.startsWith('\ufeff')) i = 1;

        let row = [];
        let field = '';
        let inQuotes = false;

        for (; i < text.length; i++) {
            const char = text[i];
            if (inQuotes) {
                if (char === '"' && text[i + 1] === '"') {
                    field += '"'; i++;
                } else if (char === '"') {
                    inQuotes = false;
                } else {
                    field += char;
                }
            } else {
                if (char === '"') {
                    inQuotes = true;
                } else if (char === ',') {
                    row.push(field); field = '';
                } else if (char === '\n' || char === '\r') {
                    row.push(field);
                    if (row.length >= 52) {
                        result.push({
                            title: row[1],
                            author: row[15],
                            url: row[51]
                        });
                    }
                    row = []; field = '';
                    if (char === '\r' && text[i + 1] === '\n') i++;
                } else {
                    field += char;
                }
            }
        }
        return result;
    }

    // CSVの読み込み
    async function initCSV() {
        statusMessage.textContent = '初期データを読み込み中... (約15MB)';
        try {
            const response = await fetch('aozora_books.csv');
            if (!response.ok) throw new Error('aozora_books.csv が見つかりません。');
            const text = await response.text();
            booksData = parseCSV(text);
            statusMessage.textContent = '作品名や著者名で検索してください';
            console.log('CSV Loaded:', booksData.length, 'books');
        } catch (error) {
            console.error('CSV load error:', error);
            statusMessage.textContent = 'データの読み込みに失敗しました。ファイルを確認してください。';
        }
    }

    // 検索処理
    function searchBooks() {
        const query = searchInput.value.trim().toLowerCase();
        if (!query) {
            bookList.innerHTML = '';
            statusMessage.textContent = '作品名や著者名で検索してください';
            return;
        }

        statusMessage.textContent = '検索中...';
        bookList.innerHTML = '';

        const results = booksData.filter(book => 
            (book.title && book.title.toLowerCase().includes(query)) || 
            (book.author && book.author.toLowerCase().includes(query))
        ).slice(0, 50); // パフォーマンスのため50件に制限

        if (results.length > 0) {
            statusMessage.textContent = `${results.length} 件表示しています`;
            results.forEach(book => {
                const li = document.createElement('li');
                li.className = 'book-item';
                li.innerHTML = `
                    <div class="book-title">${book.title}</div>
                    <div class="book-author">${book.author}</div>
                `;
                li.onclick = () => openReader(book);
                bookList.appendChild(li);
            });
        } else {
            statusMessage.textContent = '作品が見つかりませんでした';
        }
    }

    // Electron環境ではCORS制限を無効化しているため、直接アクセス可能
    async function fetchContent(url) {
        console.log('Fetching directly:', url);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.arrayBuffer();
    }

    // 読書画面を開く
    async function openReader(book) {
        readerOverlay.classList.remove('hidden');
        textContent.innerHTML = '';
        loadingOverlay.classList.remove('hidden');
        
        try {
            const aozoraUrl = book.url;
            if (!aozoraUrl) throw new Error('本文のURLがCSVに記載されていません。');

            // 直接フェッチ
            const arrayBuffer = await fetchContent(aozoraUrl);
            
            // 青空文庫はShift_JIS
            const decoder = new TextDecoder('shift-jis');
            const htmlContent = decoder.decode(arrayBuffer);
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            
            const mainText = doc.querySelector('.main_text');
            if (mainText) {
                // ルビの削除処理
                const rubyTags = mainText.querySelectorAll('ruby');
                rubyTags.forEach(ruby => {
                    const rt = ruby.querySelector('rt');
                    if (rt) rt.remove();
                });
                
                textContent.innerHTML = `
                    <div class="book-info">
                        <h2 class="title">${book.title}</h2>
                        <p class="author">${book.author}</p>
                    </div>
                    <div class="text-body">${mainText.innerHTML}</div>
                `;
                // スクロール位置を冒頭（右端）に
                textContent.scrollLeft = textContent.scrollWidth;
            } else {
                textContent.textContent = '本文の抽出に失敗しました。HTML構造が特殊な可能性があります。';
            }
        } catch (error) {
            console.error('Fetch book error:', error);
            textContent.textContent = 'エラーが発生しました: ' + error.message;
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    }

    initCSV();

    // TTS 制御
    function speakText() {
        if (isPaused) {
            window.speechSynthesis.resume();
            isPaused = false;
            updateTTSButtons(true);
            return;
        }

        const text = textContent.innerText;
        if (!text) return;

        window.speechSynthesis.cancel(); // 既存の再生を停止

        currentUtterance = new SpeechSynthesisUtterance(text);
        currentUtterance.lang = 'ja-JP';
        currentUtterance.rate = 1.0;

        currentUtterance.onend = () => {
            updateTTSButtons(false);
        };

        window.speechSynthesis.speak(currentUtterance);
        updateTTSButtons(true);
    }

    function pauseText() {
        window.speechSynthesis.pause();
        isPaused = true;
        updateTTSButtons(false, true);
    }

    function stopText() {
        window.speechSynthesis.cancel();
        isPaused = false;
        updateTTSButtons(false);
    }

    function updateTTSButtons(playing, paused = false) {
        if (playing) {
            playBtn.classList.add('hidden');
            pauseBtn.classList.remove('hidden');
        } else {
            playBtn.classList.remove('hidden');
            pauseBtn.classList.add('hidden');
            if (paused) {
                playBtn.textContent = '再開';
            } else {
                playBtn.textContent = '再生';
            }
        }
    }

    // イベントリスナー
    searchBtn.onclick = searchBooks;
    searchInput.onkeypress = (e) => {
        if (e.key === 'Enter') searchBooks();
    };

    closeReader.onclick = () => {
        stopText();
        readerOverlay.classList.add('hidden');
    };

    playBtn.onclick = speakText;
    pauseBtn.onclick = pauseText;
    stopBtn.onclick = stopText;
});
