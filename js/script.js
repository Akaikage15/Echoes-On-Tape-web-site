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
    if (window.scrollY > 100) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// === Parallax для hero фона ===
window.addEventListener('scroll', () => {
    const parallax = document.querySelector('.parallax-bg');
    if (parallax) {
        let scrollPos = window.scrollY;
        parallax.style.transform = `translateY(${scrollPos * 0.5}px)`;
    }
});

// === PARALLAX для фонового лого в релизах ===
window.addEventListener('scroll', () => {
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

// === Анимация появления ===
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = 1;
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.artist-card, .release-card').forEach(el => {
    el.style.opacity = 0;
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'all 0.6s ease';
    observer.observe(el);
});

// ===========================================
// === ОЧЕНЬ ВАЖНАЯ ЧАСТЬ — ФИЛЬТРАЦИЯ ===
// ===========================================

const releaseCards = Array.from(document.querySelectorAll('.release-card'));
const grid = document.querySelector('.releases-grid');
const filterBtns = Array.from(document.querySelectorAll('.filter-btn'));

// сохраняем исходный порядок
const originalOrder = releaseCards.slice();

// оборачиваем имена артистов в span'ы для точечной подсветки
releaseCards.forEach(card => {
    const label = card.querySelector('.release-artist');
    if (!label) return;

    if (label.querySelector('.artist-name')) return;

    const parts = label.textContent.split(',').map(s => s.trim());
    label.innerHTML = parts
        .map((p, i) => `<span class="artist-name">${p}</span>${i < parts.length - 1 ? ', ' : ''}`)
        .join('');
});

const ANIM_MS = 450;
const STAGGER_MS = 80;

function hideCard(card) {
    card.classList.remove('show-anim');
    card.classList.add('hide-anim');
    card.querySelectorAll('.artist-name').forEach(s => s.classList.remove('neon'));

    setTimeout(() => {
        card.classList.add('hidden');
        card.style.transitionDelay = '';
    }, ANIM_MS + 20);
}

function showCard(card, delay = 0) {
    card.classList.remove('hidden');
    card.style.transitionDelay = `${delay}ms`;

    requestAnimationFrame(() => {
        card.classList.remove('hide-anim');
        card.classList.add('show-anim');
    });

    setTimeout(() => card.style.transitionDelay = '', ANIM_MS + delay + 20);
}

function restoreOriginalOrder() {
    originalOrder.forEach(node => grid.appendChild(node));
}

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {

        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = (btn.dataset.filter || 'ALL').toUpperCase();

        grid.classList.remove('single');
        releaseCards.forEach(c => c.classList.remove('third-centered'));

        restoreOriginalOrder();

        const visible = [];

        releaseCards.forEach(card => {
            const artists = Array.from(card.querySelectorAll('.artist-name'))
                .map(s => s.textContent.trim().toUpperCase());

            const match = filter === 'ALL' || artists.includes(filter);

            card.querySelectorAll('.artist-name').forEach(s => s.classList.remove('neon'));

            if (match) {
                visible.push(card);
            } else {
                if (!card.classList.contains('hidden')) hideCard(card);
            }
        });

        if (filter === 'ALL') {
            releaseCards.forEach((card, i) => showCard(card, i * (STAGGER_MS / 2)));
            if (releaseCards.length === 1) grid.classList.add('single');
            return;
        }

        visible.forEach((card, idx) => {
            showCard(card, idx * STAGGER_MS);

            card.querySelectorAll('.artist-name').forEach(span => {
                if (span.textContent.trim().toUpperCase() === filter) {
                    span.classList.add('neon');
                }
            });
        });

        setTimeout(() => {
            const count = visible.length;

            releaseCards.forEach(c => c.classList.remove('third-centered'));

            if (count === 1) {
                grid.classList.add('single');
            } 
            else if (count === 3) {
                const third = visible[2];
                if (third) {
                    grid.appendChild(third);
                    third.classList.add('third-centered');
                }
            }

        }, ANIM_MS + 10);
    });
});

// === PARTICLES ===
particlesJS('particles-js', {
  particles: {
    number: { value: 80, density: { enable: true, value_area: 800 } },
    color: { value: '#b19cd9' },
    shape: { type: 'circle' },
    opacity: { value: 0.6, random: true },
    size: { value: 3, random: true },
    line_linked: {
      enable: true,
      distance: 150,
      color: '#b19cd9',
      opacity: 0.3,
      width: 1
    },
    move: { enable: true, speed: 2 }
  }
});
