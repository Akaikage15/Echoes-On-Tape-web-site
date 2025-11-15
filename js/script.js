// === script.js (FLIP + Spotify/Pinterest-style filtering + прочее) ===

// === Плавный скролл ===
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            window.scrollTo({
                top: target.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    });
});

// === Хедер при скролле ===
window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    if (window.scrollY > 100) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
});

// === Parallax для hero и логотипа релизов ===
window.addEventListener('scroll', () => {
    const parallax = document.querySelector('.parallax-bg');
    if (parallax) parallax.style.transform = `translateY(${window.scrollY * 0.5}px)`;

    const logoBg = document.querySelector('.releases-logo-bg');
    const releasesSection = document.querySelector('.releases');
    if (logoBg && releasesSection) {
        const rect = releasesSection.getBoundingClientRect();
        const sectionTop = rect.top + window.scrollY;
        const sectionCenter = sectionTop + rect.height / 2;
        const scrolled = window.scrollY + window.innerHeight / 2;
        const offset = (scrolled - sectionCenter) * 0.15;
        logoBg.style.transform = `translate(-50%, -50%) translateY(${offset}px)`;
    }
});

// IntersectionObserver для первоначального появления
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = 1;
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, { threshold: 0.12 });

document.querySelectorAll('.artist-card, .release-card').forEach(el => {
    el.style.opacity = 0;
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'all 0.6s ease';
    observer.observe(el);
});

// ========== ФИЛЬТРАЦИЯ (FLIP + stagger + no iframe reload) ==========
const grid = document.querySelector('.releases-grid');
let releaseCards = Array.from(document.querySelectorAll('.release-card'));
const filterBtns = Array.from(document.querySelectorAll('.filter-btn'));

// Сохраняем исходный порядок (DOM nodes)
const originalOrder = releaseCards.slice();

// Подготовка: оборачиваем .release-artist в span.artist-name (только если ещё не обёрнуто)
releaseCards.forEach(card => {
    const label = card.querySelector('.release-artist');
    if (!label) return;
    if (label.querySelector('.artist-name')) return;

    const parts = label.textContent.split(',').map(p => p.trim());
    label.innerHTML = parts.map((p, i) => `<span class="artist-name">${p}</span>${i < parts.length - 1 ? ', ' : ''}`).join('');
});

// Конфигурация анимации
const ANIM_MS = 420;      // длительность анимации
const STAGGER_MS = 80;    // задержка между появлением карточек

// Утилиты FLIP
function getRects(nodes) {
    return nodes.map(n => n.getBoundingClientRect());
}

function invertAndPlay(firstRects, lastRects, nodes, doneCallback) {
    nodes.forEach((node, i) => {
        const f = firstRects[i];
        const l = lastRects[i];
        if (!f || !l) return;
        const dx = f.left - l.left;
        const dy = f.top - l.top;
        if (dx || dy) {
            node.style.transform = `translate(${dx}px, ${dy}px) scale(${(f.width / l.width).toFixed(3)})`;
            node.style.transition = 'transform 0s';
            requestAnimationFrame(() => {
                node.style.transition = `transform ${ANIM_MS}ms cubic-bezier(.2,.9,.2,1), opacity ${ANIM_MS}ms ease`;
                node.style.transform = '';
            });
        }
    });
    // колбэк после анимации
    setTimeout(() => doneCallback && doneCallback(), ANIM_MS + 20);
}

// Скрываем карточку (не display:none, а сворачиваем в ноль, чтобы grid уплотнялся)
function markHidden(card) {
    card.classList.remove('show-anim');
    card.classList.add('hide-anim');
    // не ставим hidden/display:none тут — делаем это через класс .zero (в CSS он задаёт размеры 0)
    // убираем neon у span'ов
    card.querySelectorAll('.artist-name').forEach(s => s.classList.remove('neon'));
}

// Показать карточку (убирает zero/hide и запускает show-anim со stagger)
function markVisible(card, delay = 0) {
    // убираем zero если есть (чтобы занять место)
    card.classList.remove('hidden-zero'); // если использовали zero-before, удаляем
    // подготовим для появления
    card.classList.remove('hide-anim');
    card.classList.add('show-anim');
    // применяем stagger через inline transitionDelay
    card.style.transitionDelay = `${delay}ms`;
    // очистим delay позже
    setTimeout(() => card.style.transitionDelay = '', ANIM_MS + delay + 20);
}

// Основная логика фильтрации с FLIP:
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = (btn.dataset.filter || 'ALL').toUpperCase();

        // Получаем текущие видимые (по DOM) — используем snapshot
        releaseCards = Array.from(document.querySelectorAll('.release-card'));

        // FIRST: сохранение начальных прямоугольников
        const firstRects = getRects(releaseCards);

        // определяем какие должны быть видимы
        const willVisible = [];
        const willHidden = [];

        releaseCards.forEach(card => {
            const artists = Array.from(card.querySelectorAll('.artist-name'))
                .map(s => s.textContent.trim().toUpperCase());
            const isMatch = filter === 'ALL' || artists.includes(filter);
            if (isMatch) willVisible.push(card);
            else willHidden.push(card);

            // всегда убираем предыдущую neon
            card.querySelectorAll('.artist-name').forEach(s => s.classList.remove('neon'));
        });

        // Стадия: сворачиваем ненужные карточки (дадим им класс zero, чтобы они не занимали место)
        // Но прежде — плавно запустим их fade-out
        willHidden.forEach(card => {
            // если карточка уже collapse-нулевая — пропускаем
            if (card.classList.contains('zeroized')) return;
            markHidden(card);
        });

        // Через небольшой таймаут (даём карточкам aнимацию fade-out), сворачиваем их физически (zero sizing),
        // чтобы grid смог уплотниться. Не используем display:none — iframe не перезагружается.
        setTimeout(() => {
            willHidden.forEach(card => {
                // добавляем zeroized — в CSS она делает width/height/padding/margin = 0
                if (!card.classList.contains('zeroized')) {
                    card.classList.add('zeroized');
                    // уберём any inline transitionDelay
                    card.style.transitionDelay = '';
                }
            });

            // Теперь grid уплотнился (browser layout). Получим конечные rects.
            // Важно пересоздать список nod'ов и rects: порядок DOM не меняем — zeroized items занимают 0.
            const midNodes = Array.from(document.querySelectorAll('.release-card'));
            const lastRects = getRects(midNodes);

            // Запускаем FLIP (инвертируем перемещение - делаем гладкую анимацию перестройки)
            invertAndPlay(firstRects, lastRects, midNodes, () => {
                // После перестройки — показываем нужные элементы с stagger и подсветкой
                if (filter === 'ALL') {
                    // убираем zeroized у всех
                    midNodes.forEach((card, i) => {
                        if (card.classList.contains('zeroized')) card.classList.remove('zeroized');
                        markVisible(card, i * (STAGGER_MS / 2));
                    });
                } else {
                    willVisible.forEach((card, i) => {
                        // снимаем zeroized если был
                        if (card.classList.contains('zeroized')) card.classList.remove('zeroized');
                        // показываем и подсвечиваем нужный span
                        markVisible(card, i * STAGGER_MS);
                        card.querySelectorAll('.artist-name').forEach(span => {
                            if (span.textContent.trim().toUpperCase() === filter) span.classList.add('neon');
                        });
                    });
                }

                // специальная логика центрирования при 3 видимых:
                setTimeout(() => {
                    const visibleNow = Array.from(document.querySelectorAll('.release-card')).filter(c => !c.classList.contains('zeroized'));
                    // убираем класс grid-three с прошлых состояний
                    grid.classList.remove('grid-three-centered');
                    // удаляем третью центровку у всех
                    document.querySelectorAll('.release-card.third-centered').forEach(n => n.classList.remove('third-centered'));

                    if (visibleNow.length === 1) {
                        // Один в центре
                        grid.classList.add('single');

                    } else if (visibleNow.length === 2) {
                        // Две карточки должны стать в ряд (2 колонки)
                        grid.classList.remove('single');
                        grid.classList.remove('grid-three-centered');

                        visibleNow.forEach(c => c.classList.remove('third-centered'));

                        // Лишние zeroized могут оставлять «следы» — очищаем жёстко
                        releaseCards.forEach(c => c.classList.remove('third-centered'));

                    } else if (visibleNow.length === 3) {
                        // Три карточки: 2 сверху + 1 по центру
                        grid.classList.remove('single');

                        const third = visibleNow[2];
                        if (third) {
                            third.classList.add('third-centered');
                            grid.classList.add('grid-three-centered');
                        }

                    } else {
                        // 4+ карточек — обычный layout
                        grid.classList.remove('single');
                        grid.classList.remove('grid-three-centered');
                        releaseCards.forEach(c => c.classList.remove('third-centered'));
                    }

                }, ANIM_MS + 20);

            });

        }, 220); // время чтобы fade-out завершился и браузер успел перерисовать

    });
});

// === ИНИЦИАЛИЗАЦИЯ PARTICLES.JS ===
if (typeof particlesJS === 'function') {
    particlesJS('particles-js', {
      particles: {
        number: { value: 80, density: { enable: true, value_area: 800 } },
        color: { value: '#b19cd9' },
        shape: { type: 'circle' },
        opacity: { value: 0.6, random: true },
        size: { value: 3, random: true },
        line_linked: { enable: true, distance: 150, color: '#b19cd9', opacity: 0.3, width: 1 },
        move: { enable: true, speed: 2 }
      },
      interactivity: {
        detect_on: 'canvas',
        events: { onhover: { enable: true, mode: 'repulse' }, onclick: { enable: true, mode: 'push' }, resize: true },
        modes: { repulse: { distance: 100, duration: 0.4 }, push: { particles_nb: 4 } }
      },
      retina_detect: true
    });
}
