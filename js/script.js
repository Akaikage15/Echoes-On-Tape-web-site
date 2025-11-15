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
const ANIM_MS = 1000;     // длительность анимации (увеличено для максимальной плавности)
const STAGGER_MS = 120;   // задержка между появлением карточек
const EASING = 'cubic-bezier(0.4, 0.0, 0.2, 1)'; // очень плавный easing (material design)

// Утилиты FLIP
function getRects(nodes) {
    return nodes.map(n => n.getBoundingClientRect());
}

function invertAndPlay(firstRects, lastRects, nodes, doneCallback) {
    let animatedCount = 0;
    const totalNodes = nodes.length;
    
    nodes.forEach((node, i) => {
        const f = firstRects[i];
        const l = lastRects[i];
        if (!f || !l) {
            animatedCount++;
            if (animatedCount === totalNodes && doneCallback) doneCallback();
            return;
        }
        
        const dx = f.left - l.left;
        const dy = f.top - l.top;
        const scaleX = f.width / l.width;
        const scaleY = f.height / l.height;
        
        // Применяем анимацию даже при небольших изменениях для плавности
        if (dx || dy || Math.abs(scaleX - 1) > 0.001 || Math.abs(scaleY - 1) > 0.001) {
            // Применяем инвертированное преобразование (FLIP техника)
            node.style.transform = `translate(${dx}px, ${dy}px) scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`;
            node.style.transition = 'transform 0s, opacity 0s, grid-column 0s, grid-row 0s';
            
            // Используем двойной requestAnimationFrame для гарантированного применения
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    // Убираем inline transform, чтобы применились CSS transitions с очень плавным easing
                    node.style.transition = `transform ${ANIM_MS}ms ${EASING}, opacity ${ANIM_MS}ms ${EASING}, grid-column ${ANIM_MS}ms ${EASING}, grid-row ${ANIM_MS}ms ${EASING}`;
                    node.style.transform = '';
                    
                    // Отслеживаем завершение анимации
                    node.addEventListener('transitionend', function onEnd() {
                        node.removeEventListener('transitionend', onEnd);
                        animatedCount++;
                        if (animatedCount === totalNodes && doneCallback) {
                            doneCallback();
                        }
                    }, { once: true });
                });
            });
        } else {
            animatedCount++;
            if (animatedCount === totalNodes && doneCallback) doneCallback();
        }
    });
    
    // Fallback timeout на случай если transitionend не сработает
    if (totalNodes > 0) {
        setTimeout(() => {
            if (animatedCount < totalNodes && doneCallback) {
                doneCallback();
            }
        }, ANIM_MS + 200);
    }
}

// Скрываем карточку (не display:none, а сворачиваем в ноль, чтобы grid уплотнялся)
function markHidden(card) {
    card.classList.remove('show-anim');
    card.classList.add('hide-anim');
    // не ставим hidden/display:none тут — делаем это через класс .zero (в CSS он задаёт размеры 0)
    // убираем neon у span'ов
    card.querySelectorAll('.artist-name').forEach(s => s.classList.remove('neon'));
    // Устанавливаем плавный transition для скрытия
    card.style.transition = `opacity ${ANIM_MS}ms ${EASING}, transform ${ANIM_MS}ms ${EASING}`;
}

// Показать карточку (убирает zero/hide и запускает show-anim со stagger)
function markVisible(card, delay = 0) {
    // убираем zero если есть (чтобы занять место)
    card.classList.remove('hidden-zero');
    // подготовим для появления с начальным состоянием
    card.style.opacity = '0';
    card.style.transform = 'translateY(40px) scale(0.85)';
    card.style.transition = `opacity ${ANIM_MS}ms ${EASING}, transform ${ANIM_MS}ms ${EASING}`;
    card.style.transitionDelay = `${delay}ms`;
    
    // Применяем класс для показа
    card.classList.remove('hide-anim');
    card.classList.add('show-anim');
    
    // Запускаем анимацию появления с небольшой задержкой для плавности
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            card.style.opacity = '';
            card.style.transform = '';
        });
    });
    
    // очистим delay позже
    setTimeout(() => {
        card.style.transitionDelay = '';
        card.style.transition = '';
    }, ANIM_MS + delay + 100);
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

        // Плавно скрываем ненужные карточки, затем перестраиваем сетку
        setTimeout(() => {
            // Сворачиваем скрытые карточки физически (zero sizing)
            willHidden.forEach(card => {
                if (!card.classList.contains('zeroized')) {
                    card.classList.add('zeroized');
                    card.style.transitionDelay = '';
                }
            });

            // ВАЖНО: Убираем zeroized у скрытых карточек, но делаем их невидимыми через opacity
            // чтобы они занимали место в grid и не вызывали скачки при появлении
            const hiddenCards = willVisible.filter(c => c.classList.contains('zeroized'));
            hiddenCards.forEach(card => {
                card.classList.remove('zeroized');
                // Делаем невидимыми, но они занимают место в grid
                card.style.opacity = '0';
                card.style.visibility = 'hidden';
                card.style.pointerEvents = 'none';
            });

            // Принудительно вызываем reflow для применения изменений
            void grid.offsetHeight;

            // Получаем текущие позиции ВСЕХ карточек (включая невидимые)
            const allCardsBefore = willVisible;
            const beforeRects = getRects(allCardsBefore);
            
            // Убираем все старые классы центрирования и сбрасываем grid стили
            document.querySelectorAll('.release-card').forEach(c => {
                c.classList.remove('last-centered', 'third-centered');
                c.style.gridColumn = '';
                c.style.gridRow = '';
                c.style.justifySelf = '';
            });
            grid.classList.remove('single', 'grid-three-centered');

            // Настраиваем grid на основе общего количества видимых карточек
            const totalVisible = willVisible.length;
            
            if (totalVisible === 1) {
                grid.classList.add('single');
                grid.style.gridTemplateColumns = '1fr';
            } else if (totalVisible >= 2) {
                grid.classList.remove('single');
                grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
                grid.style.gridAutoFlow = 'row';
                
                // Применяем позиционирование ко ВСЕМ карточкам сразу
                // Сортируем по порядку в DOM для правильного позиционирования
                const sortedCards = Array.from(document.querySelectorAll('.release-card'))
                    .filter(c => willVisible.includes(c))
                    .sort((a, b) => {
                        const allCards = Array.from(document.querySelectorAll('.release-card'));
                        return allCards.indexOf(a) - allCards.indexOf(b);
                    });
                
                sortedCards.forEach((card, index) => {
                    card.classList.remove('last-centered');
                    card.style.gridColumn = '';
                    card.style.gridRow = '';
                    card.style.justifySelf = '';
                    
                    if (totalVisible % 2 === 1 && index === sortedCards.length - 1) {
                        card.classList.add('last-centered');
                        card.style.gridColumn = '1 / -1';
                        card.style.justifySelf = 'center';
                    } else {
                        const col = (index % 2) + 1;
                        const row = Math.floor(index / 2) + 1;
                        card.style.gridColumn = col.toString();
                        card.style.gridRow = row.toString();
                        card.style.justifySelf = 'start';
                    }
                });
            }
            
            // Принудительно вызываем reflow для применения изменений
            void grid.offsetHeight;
            
            // Получаем новые позиции после применения классов
            const afterRects = getRects(allCardsBefore);
            
            // Применяем FLIP анимацию для плавной перестройки сетки
            // Ко ВСЕМ карточкам одновременно (включая невидимые)
            invertAndPlay(beforeRects, afterRects, allCardsBefore, () => {
                // После завершения FLIP анимации - очищаем inline transition
                allCardsBefore.forEach(card => {
                    card.style.transition = '';
                });
                
                // Теперь показываем скрытые карточки с fade-in анимацией
                if (hiddenCards.length > 0) {
                    hiddenCards.forEach((card, i) => {
                        // Убираем hide-anim и делаем видимыми
                        card.classList.remove('hide-anim');
                        card.style.visibility = '';
                        card.style.pointerEvents = '';
                        
                        // Показываем с fade-in анимацией
                        markVisible(card, i * STAGGER_MS);
                    });
                }
                
                // Добавляем подсветку артистов после небольшой задержки
                setTimeout(() => {
                    if (filter !== 'ALL') {
                        willVisible.forEach((card) => {
                            card.querySelectorAll('.artist-name').forEach(span => {
                                if (span.textContent.trim().toUpperCase() === filter) span.classList.add('neon');
                            });
                        });
                    }
                }, 100);
            });

        }, ANIM_MS); // Ждем полного завершения fade-out перед перестройкой

    });
});

// === ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ===
// Применяем правильное центрирование при загрузке страницы
function initializeCardLayout() {
    const grid = document.querySelector('.releases-grid');
    if (!grid) return;
    
    const visibleCards = Array.from(document.querySelectorAll('.release-card')).filter(c => !c.classList.contains('zeroized'));
    
    if (visibleCards.length === 0) return;
    
    // Убираем все старые классы центрирования и сбрасываем grid стили
    document.querySelectorAll('.release-card').forEach(c => {
        c.classList.remove('last-centered', 'third-centered');
        c.style.gridColumn = '';
        c.style.gridRow = '';
        c.style.justifySelf = '';
    });
    grid.classList.remove('single', 'grid-three-centered');
    
    if (visibleCards.length === 1) {
        grid.classList.add('single');
        grid.style.gridTemplateColumns = '1fr';
    } else if (visibleCards.length >= 2) {
        // Принудительно устанавливаем grid на 2 колонки
        grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        grid.style.gridAutoFlow = 'row';
        
        // Явно устанавливаем позиции для каждой карточки
        visibleCards.forEach((card, index) => {
            // Убеждаемся, что класс удален перед проверкой
            card.classList.remove('last-centered');
            card.style.gridColumn = '';
            card.style.gridRow = '';
            card.style.justifySelf = '';
            
            // ТОЛЬКО если нечетное количество И это последняя карточка
            if (visibleCards.length % 2 === 1 && index === visibleCards.length - 1) {
                // Последняя карточка занимает обе колонки и центрируется
                card.classList.add('last-centered');
                card.style.gridColumn = '1 / -1';
                card.style.justifySelf = 'center';
            } else {
                // Для всех остальных - обычное позиционирование по 2 в ряд
                const col = (index % 2) + 1;
                const row = Math.floor(index / 2) + 1;
                card.style.gridColumn = col.toString();
                card.style.gridRow = row.toString();
                card.style.justifySelf = 'start';
            }
        });
    }
}

// Инициализируем при загрузке DOM и после небольшой задержки (на случай если карточки загружаются асинхронно)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCardLayout);
} else {
    initializeCardLayout();
}
// Дополнительная инициализация после небольшой задержки
setTimeout(initializeCardLayout, 100);

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
