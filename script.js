document.addEventListener('DOMContentLoaded', () => {
    // Node.jsモジュールの読み込み（Electron環境用）
    let fs = null;
    let path = null;
    let cacheDir = '';
    try {
        fs = require('fs');
        path = require('path');
    } catch (e) {
        console.warn('Node.js modules not available. Offline caching disabled.');
    }

    if (fs && path) {
        cacheDir = path.join(__dirname, 'book_cache');
        try {
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }
        } catch (e) {
            console.error('Failed to create cache directory:', e);
        }
    }

    function getCacheFilename(url) {
        return encodeURIComponent(url).replace(/%/g, '_') + '.html';
    }

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
    const addBookmarkBtn = document.getElementById('addBookmarkBtn');

    let booksData = [];
    let currentBook = null;
    let isBookLoading = false;
    let isCSVLoading = true;

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
        isCSVLoading = true;
        try {
            const response = await fetch('aozora_books.csv');
            if (!response.ok) throw new Error('aozora_books.csv が見つかりません。');
            const text = await response.text();
            booksData = parseCSV(text);
            isCSVLoading = false;
            console.log('CSV Loaded:', booksData.length, 'books');
            if (searchInput.value.trim() === '') {
                displayReadingList();
            } else {
                statusMessage.textContent = '作品名や著者名で検索してください';
            }
        } catch (error) {
            console.error('CSV load error:', error);
            isCSVLoading = false;
            statusMessage.textContent = 'データの読み込みに失敗しました。ファイルを確認してください。';
        }
    }

    // 検索処理
    function searchBooks() {
        const query = searchInput.value.trim().toLowerCase();
        if (!query) {
            displayReadingList();
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
        currentBook = book;
        isBookLoading = true;
        readerOverlay.classList.remove('hidden');
        textContent.innerHTML = '';
        loadingOverlay.classList.remove('hidden');
        document.getElementById('readerProgress').textContent = '';
        
        try {
            const aozoraUrl = book.url;
            if (!aozoraUrl) throw new Error('本文のURLがCSVに記載されていません。');

            let htmlContent = '';
            let isLoadedFromCache = false;

            // キャッシュからの読み込みを試行
            if (fs && path && cacheDir) {
                const cachePath = path.join(cacheDir, getCacheFilename(aozoraUrl));
                if (fs.existsSync(cachePath)) {
                    try {
                        htmlContent = fs.readFileSync(cachePath, 'utf8');
                        isLoadedFromCache = true;
                        console.log('Loaded from local cache:', cachePath);
                    } catch (err) {
                        console.error('Failed to read from cache:', err);
                    }
                }
            }

            if (!isLoadedFromCache) {
                // オフライン状態でキャッシュにもない場合
                if (!navigator.onLine) {
                    throw new Error('オフラインです。この本はまだ保存（キャッシュ）されていないため、読むにはインターネット接続が必要です。');
                }

                // 直接フェッチ
                const arrayBuffer = await fetchContent(aozoraUrl);
                
                // 青空文庫はShift_JIS
                const decoder = new TextDecoder('shift-jis');
                htmlContent = decoder.decode(arrayBuffer);

                // キャッシュに保存
                if (fs && path && cacheDir) {
                    const cachePath = path.join(cacheDir, getCacheFilename(aozoraUrl));
                    try {
                        fs.writeFileSync(cachePath, htmlContent, 'utf8');
                        console.log('Saved to local cache:', cachePath);
                    } catch (err) {
                        console.error('Failed to write to cache:', err);
                    }
                }
            }
            
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
                
                // しおりを復元
                const bookmark = getBookmark(book.url);
                if (bookmark && bookmark.progress) {
                    setTimeout(() => {
                        const maxScroll = textContent.scrollWidth - textContent.clientWidth;
                        textContent.scrollLeft = - (bookmark.progress * maxScroll);
                        updateReaderProgress(bookmark.progress);
                        setBookmarkButtonState(true);
                        isBookLoading = false;
                    }, 100);
                } else {
                    textContent.scrollLeft = 0; // 冒頭（右端）
                    updateReaderProgress(0);
                    setBookmarkButtonState(false);
                    isBookLoading = false;
                }
            } else {
                textContent.textContent = '本文の抽出に失敗しました。HTML構造が特殊な可能性があります。';
                isBookLoading = false;
            }
        } catch (error) {
            console.error('Fetch book error:', error);
            textContent.textContent = 'エラーが発生しました: ' + error.message;
            isBookLoading = false;
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    }

    // --- しおり（ブックマーク）管理機能 ---
    function getBookmarks() {
        const bookmarksJson = localStorage.getItem('aozora_bookmarks');
        try {
            return bookmarksJson ? JSON.parse(bookmarksJson) : {};
        } catch (e) {
            console.error('Error parsing bookmarks:', e);
            return {};
        }
    }

    function saveBookmark(book, progress) {
        if (progress < 0) progress = 0;
        if (progress > 1) progress = 1;

        const bookmarks = getBookmarks();
        bookmarks[book.url] = {
            title: book.title,
            author: book.author,
            url: book.url,
            progress: progress,
            lastRead: Date.now()
        };
        localStorage.setItem('aozora_bookmarks', JSON.stringify(bookmarks));
    }

    function removeBookmark(url) {
        const bookmarks = getBookmarks();
        delete bookmarks[url];
        localStorage.setItem('aozora_bookmarks', JSON.stringify(bookmarks));

        // キャッシュファイルの削除
        if (fs && path && cacheDir) {
            const cachePath = path.join(cacheDir, getCacheFilename(url));
            if (fs.existsSync(cachePath)) {
                try {
                    fs.unlinkSync(cachePath);
                    console.log('Removed cache file:', cachePath);
                } catch (err) {
                    console.error('Failed to delete cache file:', err);
                }
            }
        }
    }

    function getBookmark(url) {
        const bookmarks = getBookmarks();
        return bookmarks[url];
    }

    function updateReaderProgress(progress) {
        const progressPercent = Math.round(progress * 100);
        document.getElementById('readerProgress').textContent = `読了率: ${progressPercent}%`;
    }

    function debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    // 現在読んでいる本の一覧表示
    function displayReadingList() {
        const bookmarks = getBookmarks();
        const bookmarkList = Object.values(bookmarks).sort((a, b) => b.lastRead - a.lastRead);

        bookList.innerHTML = '';

        if (bookmarkList.length === 0) {
            if (isCSVLoading) {
                statusMessage.textContent = '初期データを読み込み中... (約15MB)';
            } else {
                statusMessage.textContent = '作品名や著者名で検索してください。読んだ本にしおりを挟むと、ここに表示されます。';
            }
            return;
        }

        let headerText = '現在読んでいる本（しおり一覧）';
        if (isCSVLoading) {
            headerText += ' （初期データを読み込み中...）';
        }
        statusMessage.textContent = headerText;

        bookmarkList.forEach(book => {
            const li = document.createElement('li');
            li.className = 'book-item bookmark-item';
            
            const progressPercent = Math.round(book.progress * 100);
            
            li.innerHTML = `
                <div class="book-info-container">
                    <div class="book-title">${book.title}</div>
                    <div class="book-author">${book.author}</div>
                    <div class="progress-container">
                        <div class="progress-bar-bg">
                            <div class="progress-bar" style="width: ${progressPercent}%"></div>
                        </div>
                        <span class="progress-text">読了率: ${progressPercent}%</span>
                    </div>
                </div>
                <button class="delete-bookmark-btn" title="しおりを消す">削除</button>
            `;
            
            li.querySelector('.book-info-container').onclick = () => openReader(book);
            
            li.querySelector('.delete-bookmark-btn').onclick = (e) => {
                e.stopPropagation();
                if (confirm(`「${book.title}」のしおりを削除しますか？`)) {
                    removeBookmark(book.url);
                    displayReadingList();
                }
            };
            
            bookList.appendChild(li);
        });
    }

    // スクロール時のしおり状態更新（自動保存はせず、進捗表示の更新とボタン状態のリセットのみ）
    const handleScroll = debounce(() => {
        if (!currentBook || isBookLoading) return;
        
        const maxScroll = textContent.scrollWidth - textContent.clientWidth;
        if (maxScroll <= 0) return;
        
        const scrollLeft = textContent.scrollLeft;
        const progress = Math.abs(scrollLeft) / maxScroll;
        
        updateReaderProgress(progress);
        
        // スクロールしたら未保存状態に戻す
        setBookmarkButtonState(false);
    }, 300);

    textContent.onscroll = handleScroll;

    // しおりボタンの状態管理
    function setBookmarkButtonState(isSaved) {
        if (isSaved) {
            addBookmarkBtn.textContent = 'しおり保存済み';
            addBookmarkBtn.classList.add('saved');
        } else {
            addBookmarkBtn.textContent = 'しおりを挟む';
            addBookmarkBtn.classList.remove('saved');
        }
    }

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

    // 検索入力の変更イベント
    searchInput.oninput = () => {
        if (searchInput.value.trim() === '') {
            displayReadingList();
        }
    };

    // しおりを挟むボタンのクリックイベント
    addBookmarkBtn.onclick = () => {
        if (!currentBook || isBookLoading) return;
        
        const maxScroll = textContent.scrollWidth - textContent.clientWidth;
        const progress = maxScroll > 0 ? Math.abs(textContent.scrollLeft) / maxScroll : 0;
        
        saveBookmark(currentBook, progress);
        setBookmarkButtonState(true);
    };

    closeReader.onclick = () => {
        // 自動保存は行わず、単に閉じる
        stopText();
        readerOverlay.classList.add('hidden');
        currentBook = null;
        displayReadingList();
    };

    playBtn.onclick = speakText;
    pauseBtn.onclick = pauseText;
    stopBtn.onclick = stopText;

    // 初期起動処理
    initCSV();
    displayReadingList();
});
