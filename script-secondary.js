// ========== הגדרות גלובליות ==========
const CONFIG = {
    pdfPath: 'pdf2.pdf',
    scale: 2.0,
    animationDuration: 800,
    autoFlipDelay: 0
};

// ========== State Management ==========
class FlipbookState {
    constructor() {
        this.currentPage = 1;
        this.totalPages = 0;
        this.pdfDoc = null;
        this.pages = [];
        this.isFlipping = false;
        this.zoom = 1;
    }
}

const state = new FlipbookState();

// ========== DOM Elements ==========
const elements = {
    book: document.getElementById('book'),
    loading: document.getElementById('loading'),
    currentPageEl: document.getElementById('currentPage'),
    totalPagesEl: document.getElementById('totalPages'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    fullscreenBtn: document.getElementById('fullscreenBtn'),
    zoomInBtn: document.getElementById('zoomInBtn'),
    zoomOutBtn: document.getElementById('zoomOutBtn'),
    downloadBtn: document.getElementById('downloadBtn')
};

// ========== PDF.js Setup ==========
pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ========== אתחול ==========
async function init() {
    try {
        showLoading(true);
        await loadPDF();
        await renderAllPages();
        setupEventListeners();
        updateNavigation();
        showLoading(false);
        animateEntrance();
    } catch (error) {
        console.error('שגיאה באתחול:', error);
        alert('אירעה שגיאה בטעינת החוברת. אנא נסה שוב.');
    }
}

// ========== טעינת PDF ==========
async function loadPDF() {
    const loadingTask = pdfjsLib.getDocument(CONFIG.pdfPath);

    loadingTask.onProgress = (progress) => {
        const percent = (progress.loaded / progress.total) * 100;
        console.log(`טוען: ${percent.toFixed(0)}%`);
    };

    state.pdfDoc = await loadingTask.promise;
    state.totalPages = state.pdfDoc.numPages;
    elements.totalPagesEl.textContent = state.totalPages;

    console.log(`PDF נטען בהצלחה. סה"כ עמודים: ${state.totalPages}`);
}

// ========== רינדור כל העמודים ==========
async function renderAllPages() {
    const fragment = document.createDocumentFragment();

    // רינדור בעברית:
    // עמוד 1 = שמאל (שער בודד)
    // עמוד 2 = ימין, עמוד 3 = שמאל (זוג ראשון)
    // עמוד 4 = ימין, עמוד 5 = שמאל (זוג שני) וכן הלאה

    // תחילה רנדר את כל העמודים הימניים (זוגיים), אחר כך את השמאליים (אי-זוגיים)
    const pages = [];
    for (let i = 1; i <= state.totalPages; i++) {
        let side;
        if (i === 1) {
            side = 'left'; // שער
        } else if (i % 2 === 0) {
            side = 'right'; // עמודים זוגיים (2,4,6...) = ימין
        } else {
            side = 'left'; // עמודים אי-זוגיים (3,5,7...) = שמאל
        }
        pages.push({ num: i, side: side });
    }

    // מיין: תחילה עמודים ימניים, אחר כך שמאליים
    pages.sort((a, b) => {
        if (a.side === 'right' && b.side === 'left') return -1;
        if (a.side === 'left' && b.side === 'right') return 1;
        return a.num - b.num;
    });

    for (const pageInfo of pages) {
        const page = await createPageElement(pageInfo.num, pageInfo.side);
        fragment.appendChild(page);
    }

    elements.book.appendChild(fragment);
    arrangePages();
}

// ========== יצירת אלמנט עמוד ==========
async function createPageElement(pageNum, side) {
    const pageDiv = document.createElement('div');
    pageDiv.className = `page page-${side}`;
    pageDiv.dataset.pageNum = pageNum;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'page-content';

    // רינדור העמוד
    const canvas = await renderPage(pageNum);
    contentDiv.appendChild(canvas);

    // הוספת מספר עמוד
    const pageNumber = document.createElement('div');
    pageNumber.className = 'page-number';
    pageNumber.textContent = pageNum;
    contentDiv.appendChild(pageNumber);

    pageDiv.appendChild(contentDiv);
    state.pages[pageNum] = pageDiv;

    return pageDiv;
}

// ========== רינדור עמוד בודד ==========
async function renderPage(pageNum) {
    const page = await state.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: CONFIG.scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };

    await page.render(renderContext).promise;
    return canvas;
}

// ========== סידור עמודים ==========
function arrangePages() {
    // מתחיל עם עמוד 1 בלבד (עמוד שער)
    state.pages.forEach((page, index) => {
        if (!page) return;

        const pageNum = parseInt(page.dataset.pageNum);

        if (pageNum === 1) {
            page.style.display = 'block';
            page.style.zIndex = 2;
            page.classList.remove('flipping');
        } else {
            page.style.display = 'none';
            page.classList.remove('flipping');
        }
    });
}


// ========== מעבר לעמוד הבא (שמאלה בעברית) ==========
async function nextPage() {
    if (state.isFlipping) return;

    state.isFlipping = true;

    const currentPageNum = state.currentPage;

    // אם בעמוד הראשון (שער), עובר לעמודים 2-3
    if (currentPageNum === 1) {
        const page1 = state.pages[1];

        // הצג עמודים 2 (ימין) ו-3 (שמאל) מאחורה
        if (state.pages[2]) {
            state.pages[2].style.display = 'block';
            state.pages[2].style.zIndex = 1;
        }
        if (state.pages[3]) {
            state.pages[3].style.display = 'block';
            state.pages[3].style.zIndex = 1;
        }

        // הפוך את עמוד 1 (ימינה) - אנימציה של העברת דף משמאל לימין
        if (page1) {
            page1.style.zIndex = 10;
            page1.classList.add('flipping');

            playFlipSound();

            await new Promise(resolve => setTimeout(resolve, CONFIG.animationDuration));

            // הסתר את העמוד
            page1.style.display = 'none';
            page1.classList.remove('flipping');
            page1.style.transform = '';
        }

        state.currentPage = 2; // עובר לעמוד 2 (הימני הראשון)
    } else {
        // במצב רגיל, הופך את העמוד השמאלי (אי-זוגי) ימינה
        const currentLeftPage = state.pages[currentPageNum + 1]; // העמוד השמאלי (אי-זוגי)

        // הצג את העמודים הבאים
        const nextRight = state.pages[currentPageNum + 2];
        const nextLeft = state.pages[currentPageNum + 3];

        if (nextRight) {
            nextRight.style.display = 'block';
            nextRight.style.zIndex = 1;
        }
        if (nextLeft) {
            nextLeft.style.display = 'block';
            nextLeft.style.zIndex = 1;
        }

        // הפוך את העמוד השמאלי הנוכחי ימינה
        if (currentLeftPage) {
            currentLeftPage.style.zIndex = 10;
            await flipPage(currentLeftPage, 'left');
        }

        state.currentPage += 2;
    }

    showCurrentPages();
    updateNavigation();
    state.isFlipping = false;
}

// ========== מעבר לעמוד הקודם (ימינה בעברית) ==========
async function prevPage() {
    if (state.isFlipping || state.currentPage <= 1) return;

    state.isFlipping = true;

    const currentPageNum = state.currentPage;

    // אם בעמוד 2, חוזר לעמוד 1 (שער בלבד)
    if (currentPageNum === 2) {
        // הצג את עמוד 1 מאחורה
        const page1 = state.pages[1];

        if (page1) {
            page1.style.display = 'block';
            page1.style.zIndex = 1;
        }

        // הפוך את עמוד 2 (הימני) אחורה
        const page2 = state.pages[2];
        if (page2) {
            page2.style.zIndex = 10;
            await flipPage(page2, 'right');
        }

        state.currentPage = 1;
    } else {
        // במצב רגיל, חוזר 2 עמודים אחורה
        const prevRight = state.pages[currentPageNum - 2]; // העמוד הימני הקודם (זוגי)
        const prevLeft = state.pages[currentPageNum - 1]; // העמוד השמאלי הקודם (אי-זוגי)

        // הצג את הזוג הקודם מאחורה
        if (prevRight) {
            prevRight.style.display = 'block';
            prevRight.style.zIndex = 1;
        }
        if (prevLeft) {
            prevLeft.style.display = 'block';
            prevLeft.style.zIndex = 1;
        }

        // הפוך את העמוד הימני הנוכחי אחורה
        const currentRightPage = state.pages[currentPageNum];
        if (currentRightPage) {
            currentRightPage.style.zIndex = 10;
            await flipPage(currentRightPage, 'right');
        }

        state.currentPage -= 2;
    }

    showCurrentPages();
    updateNavigation();
    state.isFlipping = false;
}

// ========== אנימציית הפיכת עמוד ==========
function flipPage(pageElement, direction) {
    return new Promise((resolve) => {
        pageElement.classList.add('flipping');
        playFlipSound();

        setTimeout(() => {
            pageElement.style.display = 'none';
            pageElement.classList.remove('flipping');
            pageElement.style.transform = '';
            resolve();
        }, CONFIG.animationDuration);
    });
}

// ========== אנימציית הפיכה הפוכה ==========
function flipPageReverse(pageElement, direction) {
    return new Promise((resolve) => {
        // קבע את הזווית ההתחלתית בהתאם לצד
        const isLeft = pageElement.classList.contains('page-left');
        const startAngle = isLeft ? -180 : 180;

        // התחל במצב הפוך
        pageElement.style.transform = `rotateY(${startAngle}deg)`;
        pageElement.style.display = 'block';

        playFlipSound();

        // חזור למצב רגיל (0 מעלות)
        setTimeout(() => {
            pageElement.classList.add('flipping-reverse');
            pageElement.style.transform = 'rotateY(0deg)';

            setTimeout(() => {
                pageElement.classList.remove('flipping-reverse');
                resolve();
            }, CONFIG.animationDuration);
        }, 50);
    });
}

// ========== הצג עמודים נוכחיים ==========
function showCurrentPages() {
    // הסתר את כל העמודים
    state.pages.forEach((page) => {
        if (page) {
            page.style.display = 'none';
            page.classList.remove('flipping', 'flipping-reverse');
            page.style.transform = '';
        }
    });

    // עמוד 1 לבד, אחרת זוגות של עמודים זוגיים (ימין) ואי-זוגיים (שמאל)
    if (state.currentPage === 1) {
        // רק עמוד 1
        if (state.pages[1]) {
            state.pages[1].style.display = 'block';
            state.pages[1].style.zIndex = 2;
        }
    } else {
        // עמוד זוגי (ימין) ואי-זוגי הבא (שמאל)
        const rightPage = state.pages[state.currentPage]; // זוגי = ימין
        const leftPage = state.pages[state.currentPage + 1]; // אי-זוגי = שמאל

        if (rightPage) {
            rightPage.style.display = 'block';
            rightPage.style.zIndex = 2;
        }
        if (leftPage) {
            leftPage.style.display = 'block';
            leftPage.style.zIndex = 1;
        }
    }
}

// ========== עדכון ניווט ==========
function updateNavigation() {
    elements.currentPageEl.textContent = state.currentPage;

    // עדכון כפתורים בחוברת - הפוך לעברית
    elements.prevPageBtn.disabled = state.currentPage >= state.totalPages - 1;
    elements.nextPageBtn.disabled = state.currentPage <= 1;
}

// ========== Event Listeners ==========
function setupEventListeners() {
    // כפתורים בתוך החוברת - החלפה לעברית
    elements.prevPageBtn.addEventListener('click', nextPage);
    elements.nextPageBtn.addEventListener('click', prevPage);

    // פקדים נוספים
    elements.fullscreenBtn.addEventListener('click', toggleFullscreen);
    elements.zoomInBtn.addEventListener('click', zoomIn);
    elements.zoomOutBtn.addEventListener('click', zoomOut);
    elements.downloadBtn.addEventListener('click', downloadPDF);

    // מקלדת
    document.addEventListener('keydown', handleKeyboard);

    // גלגלת עכבר
    elements.book.addEventListener('wheel', handleWheel, { passive: false });

    // מגע (מובייל)
    setupTouchEvents();
}

// ========== טיפול במקלדת ==========
function handleKeyboard(e) {
    switch(e.key) {
        case 'ArrowRight':
            e.preventDefault();
            prevPage(); // בעברית ימין = קודם
            break;
        case 'ArrowLeft':
            e.preventDefault();
            nextPage(); // בעברית שמאל = הבא
            break;
        case 'Home':
            e.preventDefault();
            goToPage(1);
            break;
        case 'End':
            e.preventDefault();
            goToPage(state.totalPages);
            break;
        case 'f':
        case 'F':
            toggleFullscreen();
            break;
    }
}

// ========== טיפול בגלגלת ==========
function handleWheel(e) {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
            zoomIn();
        } else {
            zoomOut();
        }
    }
}

// ========== אירועי מגע ==========
function setupTouchEvents() {
    let touchStartX = 0;
    let touchEndX = 0;

    elements.book.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    elements.book.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const swipeDistance = touchStartX - touchEndX;
        const minSwipeDistance = 50;

        if (Math.abs(swipeDistance) > minSwipeDistance) {
            if (swipeDistance > 0) {
                // Swipe left - בעברית זה הבא
                nextPage();
            } else {
                // Swipe right - בעברית זה קודם
                prevPage();
            }
        }
    }
}

// ========== Zoom ==========
function zoomIn() {
    if (state.zoom >= 2) return;
    state.zoom += 0.1;
    applyZoom();
}

function zoomOut() {
    if (state.zoom <= 0.5) return;
    state.zoom -= 0.1;
    applyZoom();
}

function applyZoom() {
    elements.book.style.transform = `scale(${state.zoom})`;
}

// ========== מסך מלא ==========
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

// ========== הורדת PDF ==========
function downloadPDF() {
    const link = document.createElement('a');
    link.href = CONFIG.pdfPath;
    link.download = 'תכנית_הבוקר_טכנודע.pdf';
    link.click();
}

// ========== מעבר לעמוד ספציפי ==========
async function goToPage(pageNum) {
    if (pageNum < 1 || pageNum > state.totalPages) return;

    // עיגול לעמוד זוגי (תמיד מתחילים בעמוד ימני)
    pageNum = pageNum % 2 === 0 ? pageNum - 1 : pageNum;

    state.currentPage = pageNum;
    arrangePages();
    showNextPages();
    updateNavigation();
}

// ========== אפקט קול הפיכת עמוד ==========
function playFlipSound() {
    // ניתן להוסיף קובץ אודיו של הפיכת דף
    // const audio = new Audio('flip-sound.mp3');
    // audio.volume = 0.3;
    // audio.play();
}

// ========== Loading ==========
function showLoading(show) {
    if (show) {
        elements.loading.classList.remove('hidden');
    } else {
        elements.loading.classList.add('hidden');
    }
}

// ========== אנימציית כניסה ==========
function animateEntrance() {
    elements.book.classList.add('fade-in');

    // אנימציה עדינה לכפתורים
    setTimeout(() => {
        document.querySelectorAll('.nav-btn, .control-btn').forEach((btn, index) => {
            setTimeout(() => {
                btn.style.animation = 'fadeIn 0.5s ease-out';
            }, index * 50);
        });
    }, 300);
}

// ========== אתחול האפליקציה ==========
document.addEventListener('DOMContentLoaded', init);

// ========== טיפול בשינוי גודל חלון ==========
window.addEventListener('resize', () => {
    // התאמה אוטומטית
    if (state.zoom !== 1) {
        state.zoom = 1;
        applyZoom();
    }
});

// ========== Debug Mode ==========
if (window.location.search.includes('debug')) {
    console.log('Debug mode enabled');
    window.flipbookState = state;
    window.flipbookGoToPage = goToPage;
}
